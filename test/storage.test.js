import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadState, saveState, clearState } from '../src/storage.js';
import { SCHEMA_VERSION } from '../src/model.js';

function fakeStorage(init = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

const item = { kind: 'words', title: 'Keep', id: 'k1', sample: false, createdAt: 1, updatedAt: 1 };

test('missing data loads samples, not blocked', () => {
  const r = loadState(fakeStorage());
  assert.equal(r.blocked, false);
  assert.equal(r.error, undefined);
  assert.ok(r.state.items.every((i) => i.sample));
});

test('valid stored data loads', () => {
  const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ schema: SCHEMA_VERSION, items: [item] }) });
  const r = loadState(s);
  assert.equal(r.blocked, false);
  assert.equal(r.state.items[0].title, 'Keep');
});

test('corrupt stored data blocks saves and is not overwritten', () => {
  const s = fakeStorage({ [STORAGE_KEY]: '{oops' });
  const r = loadState(s);
  assert.equal(r.blocked, true);
  assert.match(r.error, /couldn.t be read/i);
  assert.deepEqual(r.state.items, []);
  assert.equal(s.data.get(STORAGE_KEY), '{oops');
});

test('read failure (storage unavailable) reports error', () => {
  const s = { getItem() { throw new Error('SecurityError'); } };
  const r = loadState(s);
  assert.equal(r.blocked, true);
  assert.match(r.error, /storage/i);
  assert.equal(loadState(null).blocked, true);
});

test('save writes versioned JSON', () => {
  const s = fakeStorage();
  assert.deepEqual(saveState(s, { schema: SCHEMA_VERSION, items: [item] }), { ok: true });
  assert.equal(JSON.parse(s.data.get(STORAGE_KEY)).schema, SCHEMA_VERSION);
});

test('quota failure is reported and previous data kept', () => {
  const s = fakeStorage({ [STORAGE_KEY]: 'previous' });
  s.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  const r = saveState(s, { schema: SCHEMA_VERSION, items: [item] });
  assert.equal(r.ok, false);
  assert.match(r.error, /full/i);
  assert.equal(s.data.get(STORAGE_KEY), 'previous');
});

test('other write failure is reported', () => {
  const s = fakeStorage();
  s.setItem = () => { throw new Error('nope'); };
  const r = saveState(s, { schema: SCHEMA_VERSION, items: [] });
  assert.equal(r.ok, false);
  assert.match(r.error, /not saved/i);
});

test('clear removes data', () => {
  const s = fakeStorage({ [STORAGE_KEY]: 'x', other: 'y' });
  assert.deepEqual(clearState(s), { ok: true });
  assert.equal(s.data.has(STORAGE_KEY), false);
  assert.equal(s.data.get('other'), 'y');
  s.removeItem = () => { throw new Error('x'); };
  assert.equal(clearState(s).ok, false);
});
