import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, KINDS, LIMITS, safeUrl, isSafeImageDataUrl, validateItem,
  validateState, parseBackup, serializeBackup, sampleState, validateImageFile, validateBackupFile,
} from '../src/model.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('safeUrl allows only http/https without credentials', () => {
  assert.equal(safeUrl('https://example.com/song'), 'https://example.com/song');
  assert.equal(safeUrl('  http://example.com  '), 'http://example.com/');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.org', 'example.com',
    '', '//evil.com', 'https://user:pw@example.com', 'JAVASCRIPT:alert(1)', 'vbscript:x']) {
    assert.equal(safeUrl(bad), null, bad);
  }
  assert.equal(safeUrl(42), null);
  assert.equal(safeUrl('https://x.org/' + 'a'.repeat(LIMITS.url)), null);
});

test('isSafeImageDataUrl accepts only jpeg/png/webp base64 under the size cap', () => {
  assert.ok(isSafeImageDataUrl(PNG));
  assert.ok(isSafeImageDataUrl('data:image/jpeg;base64,/9j/4AAQ'));
  assert.ok(isSafeImageDataUrl('data:image/webp;base64,UklGRg=='));
  assert.ok(!isSafeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='));
  assert.ok(!isSafeImageDataUrl('https://example.com/a.png'));
  assert.ok(!isSafeImageDataUrl('data:image/png;base64,<script>'));
  assert.ok(!isSafeImageDataUrl('data:image/png;base64,' + 'A'.repeat(LIMITS.imageChars)));
});

test('validateItem keeps only fields for the chosen kind', () => {
  const r = validateItem({
    kind: 'words', title: '  Her saying  ', body: 'Put the kettle on.',
    url: 'https://example.com', image: PNG, contact: '555', extra: '<b>x</b>',
  });
  assert.ok(r.ok, r.errors);
  assert.equal(r.item.title, 'Her saying');
  assert.equal(r.item.body, 'Put the kettle on.');
  assert.equal('url' in r.item, false);
  assert.equal('image' in r.item, false);
  assert.equal('contact' in r.item, false);
  assert.equal('extra' in r.item, false);
  assert.match(r.item.id, /^[a-z0-9-]+$/);
  assert.equal(r.item.sample, false);
});

test('validateItem per-kind optional fields', () => {
  const sound = validateItem({ kind: 'sound', title: 'Our song', url: 'https://music.example/x' });
  assert.ok(sound.ok);
  assert.equal(sound.item.url, 'https://music.example/x');
  assert.ok(validateItem({ kind: 'sound', title: 'Hum' }).ok, 'link optional');
  assert.ok(!validateItem({ kind: 'sound', title: 'Bad', url: 'javascript:alert(1)' }).ok);

  const photo = validateItem({ kind: 'memory', title: 'Beach', image: PNG });
  assert.ok(photo.ok);
  assert.equal(photo.item.image, PNG);
  assert.ok(!validateItem({ kind: 'memory', title: 'x', image: 'https://e.com/a.png' }).ok);

  const person = validateItem({ kind: 'people', title: 'Aunt May', contact: 'Call on Sundays' });
  assert.ok(person.ok);
  assert.equal(person.item.contact, 'Call on Sundays');
});

test('validateItem rejects missing title, unknown kind, oversize text, wrong types', () => {
  assert.ok(!validateItem({ kind: 'words', title: '   ' }).ok);
  assert.ok(!validateItem({ kind: 'nope', title: 'x' }).ok);
  assert.ok(!validateItem({ kind: 'words', title: 'x'.repeat(LIMITS.title + 1) }).ok);
  assert.ok(!validateItem({ kind: 'words', title: 'x', body: 'y'.repeat(LIMITS.body + 1) }).ok);
  assert.ok(!validateItem({ kind: 'words', title: { toString: () => 'x' } }).ok);
  assert.ok(!validateItem(null).ok);
  assert.ok(!validateItem({ kind: '__proto__', title: 'x' }).ok);
  assert.ok(!validateItem({ kind: 'words', title: 'x', id: '../../etc' }).ok);
});

test('validateItem preserves valid id/timestamps, refreshes updatedAt', () => {
  const r = validateItem({ kind: 'words', title: 'x', id: 'abc-1', createdAt: 1000, updatedAt: 1000 }, { now: 5000 });
  assert.equal(r.item.id, 'abc-1');
  assert.equal(r.item.createdAt, 1000);
  assert.equal(r.item.updatedAt, 5000);
});

test('validateState checks schema, item count, duplicates', () => {
  assert.ok(validateState({ schema: SCHEMA_VERSION, items: [] }).ok);
  assert.ok(!validateState({ schema: 99, items: [] }).ok);
  assert.ok(!validateState({ schema: SCHEMA_VERSION }).ok);
  assert.ok(!validateState([]).ok);
  const dup = { kind: 'words', title: 'x', id: 'same' };
  assert.ok(!validateState({ schema: SCHEMA_VERSION, items: [dup, dup] }).ok);
  const many = Array.from({ length: LIMITS.items + 1 }, (_, i) => ({ kind: 'words', title: 't', id: 'i' + i }));
  assert.ok(!validateState({ schema: SCHEMA_VERSION, items: many }).ok);
  const bad = validateState({ schema: SCHEMA_VERSION, items: [{ kind: 'words', title: 'ok', id: 'a' }, { kind: 'words', title: '' }] });
  assert.ok(!bad.ok);
  assert.match(bad.error, /item 2/i);
});

test('backup round-trips and rejects malformed input', () => {
  const state = validateState({ schema: SCHEMA_VERSION, items: [
    { kind: 'memory', title: 'Garden', body: 'Tomatoes', image: PNG, id: 'm1' },
    { kind: 'sound', title: 'Song', url: 'https://e.com/s', id: 's1' },
  ] }).state;
  const text = serializeBackup(state, new Date('2026-01-01T00:00:00Z'));
  const parsed = JSON.parse(text);
  assert.equal(parsed.app, 'griefcase');
  assert.equal(parsed.schema, SCHEMA_VERSION);
  assert.equal(parsed.exportedAt, '2026-01-01T00:00:00.000Z');
  const back = parseBackup(text);
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.state.items.map((i) => i.title), ['Garden', 'Song']);
  assert.equal(back.state.items[0].image, PNG);

  for (const bad of ['not json', '{}', 'null', '[]', '{"app":"other","schema":1,"items":[]}',
    '{"app":"griefcase","schema":1,"items":[{"kind":"sound","title":"x","url":"javascript:1"}]}']) {
    const r = parseBackup(bad);
    assert.equal(r.ok, false, bad);
    assert.equal(typeof r.error, 'string');
  }
});

test('sample state is clearly marked as samples, no personal records', () => {
  const s = sampleState();
  assert.ok(validateState(s).ok);
  assert.ok(s.items.length >= 4);
  assert.ok(s.items.every((i) => i.sample === true));
  assert.deepEqual(new Set(s.items.map((i) => i.kind)), new Set(Object.keys(KINDS)));
  assert.ok(s.items.every((i) => !i.image && !i.url && !i.contact), 'samples carry no links/contacts/photos');
});

test('validateImageFile checks type and size before reading', () => {
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 1000 }), null);
  assert.equal(validateImageFile({ type: 'image/webp', size: 1000 }), null);
  assert.equal(validateImageFile({ type: 'image/png', size: 1000 }), null);
  assert.match(validateImageFile({ type: 'image/svg+xml', size: 10 }), /JPEG, PNG or WebP/);
  assert.match(validateImageFile({ type: 'image/gif', size: 10 }), /JPEG, PNG or WebP/);
  assert.match(validateImageFile({ type: 'image/jpeg', size: LIMITS.uploadBytes + 1 }), /too large/);
});

test('validateBackupFile checks size before reading', () => {
  assert.equal(validateBackupFile({ size: 100 }), null);
  assert.match(validateBackupFile({ size: LIMITS.backupBytes + 1 }), /too large/);
  assert.match(validateBackupFile({ size: 0 }), /empty/);
});
