import fs from 'node:fs';
import path from 'node:path';
import {elementProposalService} from './element-proposal-service.mjs';
import {resolveQuote} from './public/model.mjs';
import {writeJSON} from './interviews.mjs';

const modes = ['quoteverhaal', 'gespreksmontage'];
const statuses = ['pending', 'draft', 'approved', 'rejected'];
const isOpen = item => item.status === 'pending' || item.status === 'draft';

export function elementReviewQueue(root, catalog, metadata = {}) {
  const stateFile = path.join(root, 'data', 'montages.json');
  const progressDir = path.join(root, 'data', 'element-review-queue');

  function read(input = {}) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const mode = input.mode ?? state.mode;
    if (!modes.includes(mode) || mode !== state.mode)
      throw Error('De montagevorm is gewijzigd. Open de beeldvoorstellen opnieuw.');
    const montage = state.modes[mode];
    const service = elementProposalService(root, catalog, metadata);
    const slots = [
      ...(montage.teaser || []).map(id => ({id, blockId: 'teaser', title: 'Teaser'})),
      ...montage.blocks.flatMap(block => block.clipIds.map(id => ({id, blockId: block.id, title: block.title}))),
    ];
    const items = [];
    for (const [index, slot] of slots.entries()) {
      const result = service.read({mode, id: slot.id, blockId: slot.blockId});
      const quote = resolveQuote(state, catalog, slot.id, slot.blockId, mode);
      for (const proposal of result.items || []) {
        if (!proposal.element || proposal.creationError || !statuses.includes(proposal.status)) continue;
        items.push({
          token: `${result.key}:${proposal.proposalId}`, mode, ...slot,
          key: result.key, proposalId: proposal.proposalId, quoteIndex: index + 1,
          quoteStart: quote.start, quoteEnd: quote.end, quoteText: quote.nl || quote.text || '',
          type: proposal.type, text: proposal.text, basis: proposal.basis, reason: proposal.reason,
          element: proposal.element, currentElement: quote.element || null, status: proposal.status,
          createdAt: result.createdAt || null, decidedAt: proposal.decidedAt || null,
        });
      }
    }
    const progressFile = path.join(progressDir, `${mode}.json`);
    const saved = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, 'utf8')) : {};
    const activeTokens = new Set(items.map(item => item.token));
    const openTokens = new Set(items.filter(isOpen).map(item => item.token));
    const deferred = [...new Set(Array.isArray(saved.deferred) ? saved.deferred : [])].filter(token => openTokens.has(token));
    const deferredSet = new Set(deferred);
    const progress = {currentToken: activeTokens.has(saved.currentToken) ? saved.currentToken : null, deferred};
    const open = items.filter(isOpen), history = items.filter(item => !isOpen(item));
    const ordered = [...open.filter(item => !deferredSet.has(item.token)), ...open.filter(item => deferredSet.has(item.token)), ...history];
    return {
      mode, items: ordered, progress,
      counts: {total: items.length, open: open.length, pending: open.filter(item => item.status === 'pending').length,
        draft: open.filter(item => item.status === 'draft').length, approved: history.filter(item => item.status === 'approved').length,
        rejected: history.filter(item => item.status === 'rejected').length, deferred: deferred.length},
    };
  }

  function progress(input) {
    if (!input || !modes.includes(input.mode) || !['visit', 'later'].includes(input.action))
      throw Error('Kies een geldige montagevorm en voortgangsactie.');
    const queue = read({mode: input.mode});
    const item = queue.items.find(candidate => candidate.token === input.token);
    if (!item) throw Error('Dit beeldvoorstel is gewijzigd of hoort niet meer bij de montage. Herlaad de lijst.');
    if (input.currentToken !== undefined && input.currentToken !== null && !queue.items.some(candidate => candidate.token === input.currentToken))
      throw Error('Het volgende beeldvoorstel is gewijzigd. Herlaad de lijst.');
    if (input.action === 'later' && !isOpen(item)) throw Error('Dit beeldvoorstel is al afgehandeld.');
    const next = {...queue.progress};
    if (input.action === 'visit') next.currentToken = item.token;
    else {
      next.deferred = [...new Set([...next.deferred, item.token])];
      if (input.currentToken !== undefined) next.currentToken = input.currentToken;
    }
    fs.mkdirSync(progressDir, {recursive: true});
    writeJSON(path.join(progressDir, `${queue.mode}.json`), {version: 1, mode: queue.mode, ...next});
    return read({mode: queue.mode});
  }

  return {read, progress};
}
