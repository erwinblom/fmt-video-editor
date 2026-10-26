import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {captureEvidence, isPublicAddress, validateEvidenceUrl, resolvePublicEvidenceUrl, normalizeEvidenceImage, findEvidenceBrowser} from '../evidence-capture.mjs';

test('evidence accepts public IPv4 and global-unicast IPv6 only', () => {
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888'])
    assert.equal(isPublicAddress(ip), true, ip);
  for (const ip of ['0.0.0.0', '10.3.2.1', '100.64.0.2', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1',
    'fe80::1%en0', 'ff02::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '2001:db8::1',
    '2001::abcd', '2002:7f00:1::', '3fff::1', 'invalid'])
    assert.equal(isPublicAddress(ip), false, ip);
});

test('URL guard rejects local aliases, credentials, other protocols and disguised IPs', () => {
  for (const url of ['file:///etc/passwd', 'data:text/html,hello', 'javascript:alert(1)',
    'ftp://example.com', 'https://user:secret@example.com', 'http://localhost', 'http://LOCALHOST.',
    'http://device.local', 'http://foo.localhost', 'http://server.internal', 'http://home.lan',
    'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]',
    'http://[::ffff:7f00:1]', 'http://example.com:4318'])
    assert.throws(() => validateEvidenceUrl(url), undefined, url);
  assert.equal(validateEvidenceUrl('https://example.com/demo?view=1').href, 'https://example.com/demo?view=1');
  assert.equal(validateEvidenceUrl('https://[2606:4700:4700::1111]/').protocol, 'https:');
});

test('all resolved addresses must be public, including mixed public/private answers', async () => {
  const lookup = async (host, options) => {
    assert.equal(host, 'example.com'); assert.equal(options.all, true);
    return [{address: '93.184.216.34', family: 4}];
  };
  const target = await resolvePublicEvidenceUrl('https://example.com', lookup);
  assert.equal(target.address, '93.184.216.34');
  for (const addresses of [[], ['127.0.0.1'], ['93.184.216.34', '10.0.0.1'], ['::ffff:169.254.169.254']])
    await assert.rejects(resolvePublicEvidenceUrl('https://example.com', async () => addresses.map(address => ({address, family: 4}))));
});

test('each new connection rechecks DNS, rather than trusting a previous public answer', async () => {
  let calls = 0;
  const lookup = async () => [{address: calls++ ? '169.254.169.254' : '93.184.216.34', family: 4}];
  assert.equal((await resolvePublicEvidenceUrl('https://example.com', lookup)).address, '93.184.216.34');
  await assert.rejects(resolvePublicEvidenceUrl('https://example.com/redirect', lookup), /intern/);
});

test('literal public IP does not need another DNS lookup', async () => {
  const result = await resolvePublicEvidenceUrl('https://8.8.8.8/', () => { throw Error('unexpected lookup'); });
  assert.equal(result.address, '8.8.8.8');
});

test('normalization produces a bounded PNG with truthful image dimensions', async () => {
  const source = await sharp({create: {width: 5000, height: 2000, channels: 3, background: '#e10600'}}).jpeg().toBuffer();
  const result = await normalizeEvidenceImage(source);
  assert.equal(result.width, 4096); assert.equal(result.height, 1638);
  assert.ok(Buffer.isBuffer(result.bytes)); assert.ok(result.bytes.length < 5 * 1024 * 1024);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, result.width);
});

test('normalization preserves small images without enlargement and rejects invalid/oversized content', async () => {
  const source = await sharp({create: {width: 640, height: 360, channels: 3, background: 'white'}}).png().toBuffer();
  assert.equal((await normalizeEvidenceImage(source)).width, 640);
  await assert.rejects(normalizeEvidenceImage(source, {maxBytes: 1}), /te groot/);
  await assert.rejects(normalizeEvidenceImage(Buffer.from('<html>not an image</html>')));
  await assert.rejects(normalizeEvidenceImage(Buffer.alloc(26 * 1024 * 1024)), /te groot/);
  await assert.rejects(normalizeEvidenceImage(Buffer.alloc(0)), /leeg/);
});

test('explicit portable browser path works without reading a personal browser profile', async () => {
  assert.equal(await findEvidenceBrowser({executablePath: process.execPath}), process.execPath);
  assert.equal(await findEvidenceBrowser({env: {FMT_BROWSER_BIN: process.execPath}, platform: 'other'}), process.execPath);
});

test('capture returns real candidate bytes and provenance, and closes isolated browser resources', async () => {
  const png = await sharp({create: {width: 640, height: 360, channels: 3, background: 'white'}}).png().toBuffer();
  let launchOptions, closedBrowser = false, closedProxy = false;
  const page = {
    setDefaultTimeout() {}, async setViewport() {}, async setBypassServiceWorker() {},
    async createCDPSession() { return {async send(name, options) { assert.equal(name, 'Browser.setDownloadBehavior'); assert.equal(options.behavior, 'deny'); }}; },
    async setRequestInterception() {}, on() {},
    async goto() { return {status() { return 200; }}; }, async waitForNetworkIdle() {},
    url() { return 'https://example.com/product'; }, async title() { return ' Product demo '; },
    async screenshot() { return png; }, async $$() {
      return [{async evaluate() { return {width: 640, height: 360, naturalWidth: 640, description: 'Product demo', src: 'https://example.com/demo.png'}; }, async screenshot() { return png; }}];
    },
  };
  const result = await captureEvidence('https://example.com/', {
    executablePath: process.execPath,
    lookup: async () => [{address: '93.184.216.34', family: 4}],
    createProxy: async () => ({port: 12345, async close() { closedProxy = true; }}),
    launch: async options => { launchOptions = options; return {async newPage() { return page; }, on() {}, async close() { closedBrowser = true; }}; },
  });
  assert.equal(result.url, 'https://example.com/product'); assert.equal(result.title, 'Product demo');
  assert.ok(Number.isFinite(Date.parse(result.capturedAt))); assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[1].description, 'Product demo'); assert.ok(result.candidates.every(candidate => Buffer.isBuffer(candidate.bytes)));
  assert.equal(closedBrowser, true); assert.equal(closedProxy, true);
  assert.ok(launchOptions.args.includes('--proxy-bypass-list=<-loopback>'));
  assert.ok(launchOptions.args.includes('--force-webrtc-ip-handling-policy=disable_non_proxied_udp'));
  assert.ok(!launchOptions.args.includes('--no-sandbox'));
  assert.match(launchOptions.userDataDir, /fmt-evidence-/);
  await assert.rejects(fs.access(launchOptions.userDataDir));
});
