import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import './runtime-config.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const blockedV4 = [
  [0, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
  [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24],
  [0xc0000200, 24], [0xc0586300, 24], [0xc0a80000, 16],
  [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24], [0xe0000000, 3],
];

export function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const number = address.split('.').reduce((value, part) => (value * 256 + Number(part)) >>> 0, 0);
    return !blockedV4.some(([base, bits]) => (number >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (net.isIP(address) !== 6 || address.includes('%')) return false;
  // Only global unicast: mapped IPv4, local, link-local and multicast are excluded.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  const first = parseInt(normalized.split(':')[0], 16);
  if (!Number.isFinite(first) || first < 0x2000 || first >= 0x4000) return false;
  if (/^2002:|^3fff:|^2001:db8:/.test(normalized)) return false;
  // IETF special-purpose assignments, including Teredo and benchmarking.
  if (first === 0x2001 && (parseInt(normalized.split(':')[1] || '0', 16) < 0x200)) return false;
  return true;
}

export function validateEvidenceUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Gebruik een volledige openbare http- of https-link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw Error('Bewijsbeelden mogen alleen van openbare http- of https-links zonder inloggegevens komen.');
  if (url.port && !['80', '443'].includes(url.port)) throw Error('Deze bron gebruikt geen gewone webpoort.');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || /(^|\.)(localhost|local|internal|home|lan)$/.test(host) || (net.isIP(host) && !isPublicAddress(host)))
    throw Error('Een lokale of interne bron kan niet als openbaar bewijsbeeld worden opgehaald.');
  return url;
}

export async function resolvePublicEvidenceUrl(value, lookup = dns.lookup) {
  const url = validateEvidenceUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  let timer;
  const records = net.isIP(host) ? [{address: host, family: net.isIP(host)}] : await Promise.race([
    lookup(host, {all: true, verbatim: true}),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('De bronserver antwoordt niet op de adrescontrole.')), 4000); }),
  ]).finally(() => clearTimeout(timer));
  if (!records.length || records.some(record => !isPublicAddress(record.address)))
    throw Error('De bron verwijst naar een lokaal of intern netwerkadres.');
  return {url, address: records[0].address, family: records[0].family};
}

export async function normalizeEvidenceImage(input, {maxDimension = 4096, maxBytes = MAX_BYTES} = {}) {
  if (!input?.length || input.length > 25 * 1024 * 1024) throw Error('Het bewijsbeeld is leeg of te groot.');
  for (let dimension = Math.min(4096, maxDimension); dimension >= 256; dimension = Math.floor(dimension * 0.75)) {
    const {data, info} = await sharp(input, {limitInputPixels: 32_000_000})
      .rotate().resize({width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true})
      .flatten({background: '#ffffff'}).png({palette: true, quality: 90, colours: 256})
      .toBuffer({resolveWithObject: true});
    if (data.length < maxBytes) return {bytes: data, width: info.width, height: info.height};
  }
  throw Error('Dit bewijsbeeld blijft te groot om veilig te bewaren.');
}

export async function findEvidenceBrowser({executablePath, env = process.env, platform = process.platform} = {}) {
  const candidates = [executablePath, env.FMT_BROWSER_BIN];
  if (platform === 'darwin') candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  else if (platform === 'win32') {
    for (const base of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean))
      candidates.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'));
  } else candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome');
  for (const candidate of candidates.filter(Boolean)) {
    try { await fs.access(candidate); return candidate; } catch {}
  }
  throw Error('Installeer Chrome of Chromium om bewijsbeelden te maken, of stel FMT_BROWSER_BIN in.');
}

// Chromium uses this proxy for every request. The proxy connects to the checked IP,
// rather than asking DNS again after validation (including HTTPS CONNECT requests).
async function createPublicProxy(lookup) {
  const sockets = new Set();
  const server = http.createServer();
  let closed = false;
  let totalReceived = 0;
  server.maxConnections = 32;
  const countBytes = chunk => {
    totalReceived += chunk.length;
    if (totalReceived > 64 * 1024 * 1024) for (const socket of sockets) socket.destroy();
  };
  const track = socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.setTimeout(12000, () => socket.destroy());
    return socket;
  };
  server.on('connection', track);
  server.on('clientError', (_, socket) => socket.destroy());
  server.on('request', async (request, response) => {
    let upstream;
    try {
      const target = await resolvePublicEvidenceUrl(request.url, lookup);
      if (target.url.protocol !== 'http:' || !['GET', 'HEAD'].includes(request.method)) throw Error('Blocked request');
      if (closed || request.destroyed) return response.destroy();
      const headers = {...request.headers, host: target.url.host};
      for (const key of ['proxy-authorization', 'proxy-connection', 'authorization', 'cookie']) delete headers[key];
      upstream = http.request({hostname: target.address, family: target.family, port: target.url.port || 80,
        path: target.url.pathname + target.url.search, method: request.method, headers}, incoming => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.on('data', countBytes);
        incoming.on('error', () => response.destroy());
        incoming.pipe(response);
      });
      upstream.on('socket', track);
      upstream.on('error', () => response.destroy());
      response.on('close', () => upstream.destroy());
      upstream.end();
    } catch { upstream?.destroy(); if (!response.headersSent) response.writeHead(403); response.end(); }
  });
  server.on('connect', async (request, client, head) => {
    try {
      const target = await resolvePublicEvidenceUrl(`https://${request.url}/`, lookup);
      if (closed || client.destroyed) return client.destroy();
      const upstream = track(net.connect({host: target.address, family: target.family, port: target.url.port || 443}));
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
      upstream.on('data', countBytes);
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(client); client.pipe(upstream);
      });
    } catch { client.destroy(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {port: server.address().port, close: async () => {
    closed = true;
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }};
}

export async function captureEvidence(value, {
  timeoutMs = 25000, lookup = dns.lookup, launch = options => puppeteer.launch(options), executablePath,
  createProxy = createPublicProxy,
} = {}) {
  const {url} = await resolvePublicEvidenceUrl(value, lookup);
  const browserPath = await findEvidenceBrowser({executablePath});
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'fmt-evidence-'));
  let proxy;
  let browser, timer, cancelled = false;
  try {
    proxy = await createProxy(lookup);
    const work = async () => {
      browser = await launch({headless: true, executablePath: browserPath, userDataDir: profile,
        timeout: 10000, args: [`--proxy-server=http://127.0.0.1:${proxy.port}`, '--proxy-bypass-list=<-loopback>',
          '--disable-quic', '--disable-background-networking', '--disable-extensions',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
      if (cancelled) { await browser.close(); throw Error('Het maken van het bewijsbeeld is afgebroken.'); }
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1});
      const session = await page.createCDPSession();
      await session.send('Browser.setDownloadBehavior', {behavior: 'deny'});
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', request => {
        try {
          validateEvidenceUrl(request.url());
          if (!['GET', 'HEAD'].includes(request.method()) || ['media', 'websocket', 'eventsource'].includes(request.resourceType()))
            return void request.abort().catch(() => {});
          void request.continue().catch(() => {});
        } catch { void request.abort().catch(() => {}); }
      });
      browser.on('targetcreated', async target => {
        if (target.type() === 'page') { const other = await target.page().catch(() => null); if (other && other !== page) await other.close().catch(() => {}); }
      });
      const response = await page.goto(url.href, {waitUntil: 'domcontentloaded', timeout: Math.min(15000, timeoutMs)});
      if (!response || response.status() >= 400) throw Error(`De bronpagina kon niet worden geopend (${response?.status() || 'geen antwoord'}).`);
      await page.waitForNetworkIdle({idleTime: 600, timeout: 3500}).catch(() => {});
      const finalUrl = validateEvidenceUrl(page.url()).href;
      const title = (await page.title()).replace(/\s+/g, ' ').trim().slice(0, 250);
      const viewport = await normalizeEvidenceImage(await page.screenshot({type: 'png', fullPage: false}));
      const candidates = [{...viewport, description: 'Zichtbare bronpagina'}];
      const handles = await page.$$('img');
      const ranked = [];
      for (let i = 0; i < Math.min(handles.length, 80); i++) {
        const info = await handles[i].evaluate(img => {
          const rect = img.getBoundingClientRect();
          return {width: rect.width, height: rect.height, naturalWidth: img.naturalWidth,
            description: (img.alt || img.getAttribute('title') || '').slice(0, 200), src: img.currentSrc || ''};
        });
        if (info.width < 480 || info.height < 240 || info.width > 4000 || info.height > 3000 || info.naturalWidth < 480 || /logo|avatar|icon/i.test(info.description + info.src)) continue;
        const relevant = /demo|product|screen|interface|workflow|dashboard|agent/i.test(info.description + info.src);
        ranked.push({handle: handles[i], info, score: info.width * info.height * (relevant ? 3 : 1)});
      }
      for (const {handle, info} of ranked.sort((a, b) => b.score - a.score).slice(0, 3)) {
        try {
          const image = await normalizeEvidenceImage(await handle.screenshot({type: 'png'}));
          candidates.push({...image, description: info.description || 'Groot beeld uit de bronpagina'});
        } catch { /* The complete viewport remains available when an image disappears. */ }
      }
      return {...viewport, url: finalUrl, title, capturedAt: new Date().toISOString(), candidates};
    };
    return await Promise.race([work(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('Het maken van het bewijsbeeld duurde te lang. Kies een andere bron.')), Math.max(1000, Math.min(40000, timeoutMs)));
    })]);
  } finally {
    cancelled = true;
    clearTimeout(timer);
    await browser?.close().catch(() => {});
    await proxy?.close();
    await fs.rm(profile, {recursive: true, force: true});
  }
}
