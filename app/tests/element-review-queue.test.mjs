import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {elementReviewQueue} from '../element-review-queue.mjs';
import {elementProposalService} from '../element-proposal-service.mjs';
import {interviewStore, writeJSON} from '../interviews.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-element-queue-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'data'));
  const catalog = {title: 'Testinterview', duration: 100, primarySpeaker: 'Gast',
    quotes: Object.fromEntries(['q1', 'q2', 'q3'].map((id, i) => [id, {id, speaker: 'Gast', start: i * 25, end: i * 25 + 20, text: `Bron ${id}.`, nl: `Tekst ${id}.`}]))};
  const montage = {teaser: ['q1'], blocks: [{id: 'b1', title: 'Eerste hoofdstuk', clipIds: ['q1', 'q2']}, {id: 'b2', title: 'Tweede hoofdstuk', clipIds: ['q3']}], edits: {}};
  const state = {version: 1, revision: 9, mode: 'quoteverhaal', target: 600,
    modes: {quoteverhaal: structuredClone(montage), gespreksmontage: structuredClone(montage)}};
  const file = path.join(root, 'data/montages.json');
  writeJSON(file, state); writeJSON(path.join(root, 'data/catalog.json'), catalog);
  const queue = () => elementReviewQueue(root, catalog);
  function seed(id, blockId, statuses = ['pending'], mode = state.mode) {
    const scope = elementProposalService(root, catalog).read({mode, id, blockId});
    const element = {type: 'diagram', text: 'Uitleg', start: 0, end: 12, layout: 'side',
      source: 'Volgens de spreker', value: '', label: '', assetId: null, artworkId: null,
      diagram: {steps: ['Werk', 'Resultaat'], feedback: ''}};
    const result = {key: scope.key, status: 'ready', reason: 'Nuttige uitleg', createdAt: '2026-10-23T10:00:00Z', items: statuses.map((status, i) => ({
      proposalId: String(i), type: 'diagram', text: 'Uitleg', basis: `Bron ${id}.`, reason: 'Maakt de werking duidelijk',
      status, element: structuredClone(element),
    }))};
    const resultFile = path.join(root, 'data/element-work', scope.key, 'result.json');
    fs.mkdirSync(path.dirname(resultFile), {recursive: true}); writeJSON(resultFile, result);
    return {key: scope.key, token: `${scope.key}:0`, file: resultFile, result};
  }
  return {root, catalog, state, file, queue, seed};
}

test('GET is read-only and never generates missing proposals or creates progress', t => {
  const f = fixture(t), before = fs.readFileSync(f.file, 'utf8');
  assert.deepEqual(f.queue().read().counts, {total: 0, open: 0, pending: 0, draft: 0, approved: 0, rejected: 0, deferred: 0});
  assert.equal(fs.existsSync(path.join(f.root, 'data/element-work')), false);
  assert.equal(fs.existsSync(path.join(f.root, 'data/element-review-queue')), false);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});

test('queue contains made proposals from each montage position, plus approved/rejected history', t => {
  const f = fixture(t);
  f.seed('q1', 'teaser', ['pending']); f.seed('q1', 'b1', ['draft']);
  const failed = f.seed('q2', 'b1', ['pending']); failed.result.items[0].element = null;
  failed.result.items[0].creationError = 'Geen passend beeld'; writeJSON(failed.file, failed.result);
  f.seed('q3', 'b2', ['approved', 'rejected']);
  const q = f.queue().read({mode: 'quoteverhaal'});
  assert.deepEqual(q.items.map(i => [i.blockId, i.id, i.quoteIndex, i.status]), [['teaser', 'q1', 1, 'pending'], ['b1', 'q1', 2, 'draft'], ['b2', 'q3', 4, 'approved'], ['b2', 'q3', 4, 'rejected']]);
  assert.equal(q.items[1].title, 'Eerste hoofdstuk'); assert.equal(q.items[1].currentElement, null);
  assert.equal(q.items[0].token, `${q.items[0].key}:${q.items[0].proposalId}`);
  assert.deepEqual(q.counts, {total: 4, open: 2, pending: 1, draft: 1, approved: 1, rejected: 1, deferred: 0});
});

test('visit and later survive reopening, preserve decisions/montage, and place later items last', t => {
  const f = fixture(t), a = f.seed('q1', 'b1'), b = f.seed('q2', 'b1');
  const original = [f.file, a.file, b.file].map(file => fs.readFileSync(file, 'utf8'));
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token});
  const later = f.queue().progress({mode: 'quoteverhaal', action: 'later', token: a.token, currentToken: b.token});
  assert.deepEqual(later.items.map(i => i.token), [b.token, a.token]);
  assert.deepEqual(f.queue().read().progress, {currentToken: b.token, deferred: [a.token]});
  assert.equal(f.queue().read().counts.deferred, 1);
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token});
  assert.equal(f.queue().read().progress.currentToken, a.token);
  assert.deepEqual([f.file, a.file, b.file].map(file => fs.readFileSync(file, 'utf8')), original);
});

test('a relevant trim excludes stale source keys and progress without rewriting either file on GET', t => {
  const f = fixture(t), a = f.seed('q1', 'b1');
  f.queue().progress({mode: 'quoteverhaal', action: 'later', token: a.token, currentToken: a.token});
  f.state.modes.quoteverhaal.edits['b1:q1'] = {start: 1, end: 20, nl: 'Tekst q1.'}; writeJSON(f.file, f.state);
  const progressFile = path.join(f.root, 'data/element-review-queue/quoteverhaal.json');
  const original = [f.file, progressFile, a.file].map(file => fs.readFileSync(file, 'utf8'));
  const q = f.queue().read(); assert.equal(q.items.length, 0); assert.deepEqual(q.progress, {currentToken: null, deferred: []});
  assert.throws(() => f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token}), /gewijzigd/);
  assert.deepEqual([f.file, progressFile, a.file].map(file => fs.readFileSync(file, 'utf8')), original);
});

test('new montage order changes position numbers but preserves stable proposal tokens and current position', t => {
  const f = fixture(t), a = f.seed('q1', 'b1'), b = f.seed('q2', 'b1'), c = f.seed('q3', 'b2');
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: b.token});
  f.state.modes.quoteverhaal.blocks.reverse(); f.state.modes.quoteverhaal.blocks[1].clipIds.reverse(); writeJSON(f.file, f.state);
  const q = f.queue().read();
  assert.deepEqual(q.items.map(i => i.token), [c.token, b.token, a.token]);
  assert.deepEqual(q.items.map(i => i.quoteIndex), [2, 3, 4]); assert.equal(q.progress.currentToken, b.token);
});

test('progress is isolated per montage mode and rejects inactive modes or path-like inputs', t => {
  const f = fixture(t), a = f.seed('q1', 'b1');
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token});
  f.state.mode = 'gespreksmontage'; writeJSON(f.file, f.state);
  const b = f.seed('q1', 'b1', ['pending'], 'gespreksmontage');
  assert.notEqual(a.token, b.token); assert.deepEqual(f.queue().read().progress, {currentToken: null, deferred: []});
  f.queue().progress({mode: 'gespreksmontage', action: 'later', token: b.token});
  assert.throws(() => f.queue().read({mode: 'quoteverhaal'}), /montagevorm/);
  assert.throws(() => f.queue().progress({mode: '../escape', action: 'visit', token: b.token}), /geldige/);
  assert.throws(() => f.queue().progress({mode: 'gespreksmontage', action: 'visit', token: '../../escape'}), /gewijzigd/);
  f.state.mode = 'quoteverhaal'; writeJSON(f.file, f.state);
  assert.deepEqual(f.queue().read().progress, {currentToken: a.token, deferred: []});
});

test('new decisions move items to history and remove later flags without altering decisions', t => {
  const f = fixture(t), a = f.seed('q1', 'b1');
  f.queue().progress({mode: 'quoteverhaal', action: 'later', token: a.token});
  a.result.items[0].status = 'approved'; writeJSON(a.file, a.result);
  const q = f.queue().read(); assert.equal(q.counts.open, 0); assert.equal(q.counts.approved, 1); assert.equal(q.counts.deferred, 0);
  assert.throws(() => f.queue().progress({mode: 'quoteverhaal', action: 'later', token: a.token}), /afgehandeld/);
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token});
  assert.equal(JSON.parse(fs.readFileSync(a.file)).items[0].status, 'approved');
});

test('invalid next token never saves partial progress', t => {
  const f = fixture(t), a = f.seed('q1', 'b1');
  assert.throws(() => f.queue().progress({mode: 'quoteverhaal', action: 'later', token: a.token, currentToken: 'stale:0'}), /volgende/);
  assert.equal(fs.existsSync(path.join(f.root, 'data/element-review-queue')), false);
});

test('Strawberry archive/restore includes queue progress and original montage', t => {
  const f = fixture(t), a = f.seed('q1', 'b1');
  f.queue().progress({mode: 'quoteverhaal', action: 'visit', token: a.token});
  const before = fs.readFileSync(f.file, 'utf8'), store = interviewStore(f.root);
  const otherId = '52345678-1234-1234-1234-123456789abc', other = path.join(f.root, 'data/interviews', otherId);
  fs.mkdirSync(other); writeJSON(path.join(other, 'interview.json'), {id: otherId, status: 'ready', title: 'Ander interview', sourceFile: 'bron.mp4'});
  const archive = store.archive('demo');
  assert.equal(fs.existsSync(path.join(f.root, 'data/element-review-queue')), false);
  store.restore(archive.archiveId);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  assert.deepEqual(f.queue().read().progress, {currentToken: a.token, deferred: []});
});
