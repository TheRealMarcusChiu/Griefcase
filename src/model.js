// Pure data model: kinds, limits, validation. No DOM, no storage.

export const SCHEMA_VERSION = 1;
export const APP_ID = 'griefcase';

export const KINDS = Object.freeze({
  memory: { label: 'Memories & photos', noun: 'memory', extra: 'image' },
  words: { label: 'Words to keep', noun: 'words', extra: null },
  sound: { label: 'Familiar sounds', noun: 'sound', extra: 'url' },
  people: { label: 'People & places', noun: 'person or place', extra: 'contact' },
});

export const LIMITS = Object.freeze({
  title: 120,
  body: 2000,
  contact: 200,
  url: 2048,
  imageChars: 450_000, // ~330 KB JPEG after compression
  items: 300,
  uploadBytes: 15 * 1024 * 1024,
  backupBytes: 25 * 1024 * 1024,
});

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > LIMITS.url) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  return url.href;
}

export function isSafeImageDataUrl(value) {
  return typeof value === 'string' && value.length <= LIMITS.imageChars && IMAGE_RE.test(value);
}

function text(raw, name, max, required, errors) {
  const v = raw[name];
  if (v === undefined || v === null) {
    if (required) errors.push(`A ${name} is needed.`);
    return '';
  }
  if (typeof v !== 'string') { errors.push(`The ${name} must be text.`); return ''; }
  const t = v.trim();
  if (required && !t) errors.push(`A ${name} is needed.`);
  if (t.length > max) errors.push(`The ${name} is too long (max ${max} characters).`);
  return t;
}

const validTime = (n) => Number.isFinite(n) && n > 0;

export function validateItem(raw, opts = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Not an item.'] };
  if (typeof raw.kind !== 'string' || !Object.hasOwn(KINDS, raw.kind)) return { ok: false, errors: ['Unknown compartment.'] };
  const errors = [];
  const now = opts.now ?? Date.now();
  const item = {
    id: raw.id === undefined ? newId() : raw.id,
    kind: raw.kind,
    title: text(raw, 'title', LIMITS.title, true, errors),
    body: text(raw, 'body', LIMITS.body, false, errors),
    sample: raw.sample === true,
    createdAt: validTime(raw.createdAt) ? raw.createdAt : now,
    updatedAt: opts.now ?? (validTime(raw.updatedAt) ? raw.updatedAt : now),
  };
  if (typeof item.id !== 'string' || !ID_RE.test(item.id)) errors.push('Invalid id.');

  const extra = KINDS[raw.kind].extra;
  if (extra === 'url' && raw.url) {
    const url = safeUrl(raw.url);
    if (url) item.url = url;
    else errors.push('The link must be a full web address starting with https:// or http://.');
  }
  if (extra === 'image' && raw.image) {
    if (isSafeImageDataUrl(raw.image)) item.image = raw.image;
    else errors.push('The photo must be a JPEG, PNG or WebP image saved by Griefcase.');
  }
  if (extra === 'contact') {
    const c = text(raw, 'contact', LIMITS.contact, false, errors);
    if (c) item.contact = c;
  }
  return errors.length ? { ok: false, errors } : { ok: true, item };
}

export function validateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Not a Griefcase file.' };
  if (raw.schema !== SCHEMA_VERSION) return { ok: false, error: `Unsupported version (${String(raw.schema)}).` };
  if (!Array.isArray(raw.items)) return { ok: false, error: 'No items list found.' };
  if (raw.items.length > LIMITS.items) return { ok: false, error: `Too many items (max ${LIMITS.items}).` };
  const items = [];
  const seen = new Set();
  for (let i = 0; i < raw.items.length; i++) {
    const r = validateItem(raw.items[i]);
    if (!r.ok) return { ok: false, error: `Item ${i + 1}: ${r.errors.join(' ')}` };
    if (seen.has(r.item.id)) return { ok: false, error: `Item ${i + 1}: duplicate id.` };
    seen.add(r.item.id);
    items.push(r.item);
  }
  return { ok: true, state: { schema: SCHEMA_VERSION, items } };
}

export function parseBackup(textValue) {
  let data;
  try { data = JSON.parse(textValue); } catch { return { ok: false, error: 'This file isn’t valid JSON.' }; }
  if (!data || typeof data !== 'object' || data.app !== APP_ID) return { ok: false, error: 'This doesn’t look like a Griefcase backup.' };
  return validateState({ schema: data.schema, items: data.items });
}

export function serializeBackup(state, date = new Date()) {
  return JSON.stringify({ app: APP_ID, schema: SCHEMA_VERSION, exportedAt: date.toISOString(), items: state.items }, null, 2);
}

export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Please choose a JPEG, PNG or WebP photo.';
  if (file.size > LIMITS.uploadBytes) return 'That photo is too large to open (max 15 MB).';
  return null;
}

export function validateBackupFile(file) {
  if (!file.size) return 'That file is empty.';
  if (file.size > LIMITS.backupBytes) return 'That file is too large to be a Griefcase backup (max 25 MB).';
  return null;
}

const SAMPLES = [
  ['memory', 'A photo from an ordinary day', 'A kitchen, a walk, a wave from a doorway. The everyday ones often hold the most.'],
  ['words', 'Something they always said', 'A saying, a nickname, a line from a card you kept.'],
  ['sound', 'A song that sounds like home', 'Add a link to a song or playlist you can come back to, on any music service you use.'],
  ['people', 'Someone you can text without explaining', 'Or a place where you can simply sit for a while.'],
];

export function sampleState() {
  return {
    schema: SCHEMA_VERSION,
    items: SAMPLES.map(([kind, title, body], i) => ({
      id: `sample-${i + 1}`, kind, title, body, sample: true, createdAt: 1, updatedAt: 1,
    })),
  };
}
