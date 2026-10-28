// DOM wiring. All visitor text goes through textContent; never innerHTML.
import { KINDS, LIMITS, validateItem, parseBackup, serializeBackup, validateBackupFile, validateImageFile, isSafeImageDataUrl, safeUrl } from './model.js';
import { loadState, saveState, clearState } from './storage.js';
import { compressImage } from './image.js';
import { breathAt } from './breath.js';

const $ = (sel) => document.querySelector(sel);

let storage = null;
try { storage = window.localStorage; } catch { /* loadState reports it */ }

const loaded = loadState(storage);
let state = loaded.state;
let blocked = loaded.blocked; // saved data exists but is unreadable, or storage is unavailable
let unsaved = false; // in-memory changes that didn't reach storage

const UNSAVED_MSG = 'Some changes are kept only in this open tab and are not saved in this browser. Export a backup before closing.';

// ---------- notices ----------
let toastTimer;
function toast(message, isError = false) {
  const box = $('#toast');
  $('#toast-text').textContent = message;
  box.classList.toggle('error', isError);
  box.setAttribute('role', isError ? 'alert' : 'status');
  box.hidden = false;
  clearTimeout(toastTimer);
  if (!isError) toastTimer = setTimeout(() => { box.hidden = true; }, 5000);
}
$('#toast-close').addEventListener('click', () => { $('#toast').hidden = true; });

// Apply to memory first so nothing typed is lost, then try to persist.
function commit(items, { force = false } = {}) {
  state = { ...state, items };
  let result;
  if (blocked && !force) {
    result = { ok: false, error: loaded.error };
  } else {
    result = saveState(storage, state);
    if (result.ok) blocked = false;
  }
  unsaved = !result.ok;
  render();
  return result;
}

window.addEventListener('beforeunload', (e) => { if (unsaved) e.preventDefault(); });

// ---------- rendering ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, label, onClick) {
  const b = el('button', 'small-btn', text);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function renderItem(item) {
  const li = el('li', item.sample ? 'item sample' : 'item');
  li.dataset.id = item.id;
  if (item.image && isSafeImageDataUrl(item.image)) {
    const img = el('img', 'item-photo');
    img.src = item.image;
    img.alt = item.title;
    img.loading = 'lazy';
    li.append(img);
  }
  if (item.sample) li.append(el('span', 'badge', 'Sample idea'));
  li.append(el('h4', 'item-title', item.title));
  if (item.body) li.append(el('p', 'item-body', item.body));
  if (item.contact) li.append(el('p', 'item-contact', item.contact));
  const href = item.url && safeUrl(item.url);
  if (href) {
    const a = el('a', 'item-link', 'Listen');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.append(el('span', 'visually-hidden', ` to ${item.title} (opens in a new tab)`));
    li.append(a);
  }
  const actions = el('div', 'item-actions');
  actions.append(
    button('Edit', `Edit ${item.title}`, () => openForm(item.kind, item)),
    button('Remove', `Remove ${item.title}`, () => removeItem(item)),
  );
  li.append(actions);
  return li;
}

function render() {
  for (const kind of Object.keys(KINDS)) {
    const list = document.querySelector(`[data-list="${kind}"]`);
    const items = state.items.filter((i) => i.kind === kind);
    list.replaceChildren(...items.map(renderItem));
    list.nextElementSibling.hidden = items.length > 0;
  }
  $('#remove-samples').hidden = !state.items.some((i) => i.sample);
  const warning = $('#save-warning');
  warning.textContent = unsaved ? UNSAVED_MSG : blocked ? loaded.error : '';
  warning.hidden = !warning.textContent;
}

function focusAfterRender(id, kind) {
  const target = id && document.querySelector(`[data-id="${CSS.escape(id)}"] .small-btn`);
  (target || document.querySelector(`[data-add="${kind}"]`)).focus();
}

// ---------- sections ----------
function openSection(id, opener) {
  const section = document.getElementById(id);
  section.hidden = false;
  opener.setAttribute('aria-expanded', 'true');
  section.focus();
}

function closeSection(id) {
  document.getElementById(id).hidden = true;
  const opener = document.querySelector(`[aria-controls="${id}"]`);
  opener.setAttribute('aria-expanded', 'false');
  if (id === 'quiet') stopBreathing('');
  opener.focus();
}

$('#open-case').addEventListener('click', (e) => openSection('case', e.currentTarget));
$('#open-quiet').addEventListener('click', (e) => openSection('quiet', e.currentTarget));
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => closeSection(b.dataset.close));

// ---------- item form ----------
const dialog = $('#item-dialog');
const form = $('#item-form');
const formError = $('#form-error');
const fields = { title: $('#f-title'), body: $('#f-body'), url: $('#f-url'), contact: $('#f-contact'), image: $('#f-image') };
let editing = null; // { kind, item }
let returnId = null; // item whose Edit button gets focus when the dialog closes
let formImage = null; // data URL for the photo field
let imageBusy = false;

function showPreview() {
  $('#f-preview').hidden = !formImage;
  if (formImage) $('#f-preview-img').src = formImage;
  else $('#f-preview-img').removeAttribute('src');
}

function openForm(kind, item = null) {
  editing = { kind, item };
  returnId = item?.id ?? null;
  form.reset();
  formError.textContent = '';
  const extra = KINDS[kind].extra;
  $('#dialog-h').textContent = item ? `Edit ${KINDS[kind].noun}` : `Add to ${KINDS[kind].label}`;
  for (const f of form.querySelectorAll('[data-for]')) f.hidden = f.dataset.for !== extra;
  fields.title.value = item?.title ?? '';
  fields.body.value = item?.body ?? '';
  fields.url.value = item?.url ?? '';
  fields.contact.value = item?.contact ?? '';
  formImage = item?.image ?? null;
  showPreview();
  dialog.showModal();
  fields.title.focus();
}

for (const b of document.querySelectorAll('[data-add]')) b.addEventListener('click', () => openForm(b.dataset.add));
$('#f-cancel').addEventListener('click', () => dialog.close());
$('#f-remove-image').addEventListener('click', () => {
  formImage = null;
  fields.image.value = '';
  showPreview();
  fields.image.focus();
});

fields.image.addEventListener('change', async () => {
  const file = fields.image.files[0];
  if (!file) return;
  formError.textContent = '';
  const problem = validateImageFile(file);
  if (problem) {
    formError.textContent = problem;
    fields.image.value = '';
    return;
  }
  imageBusy = true;
  $('#f-save').disabled = true;
  $('#f-save').textContent = 'Preparing photo…';
  const session = editing;
  try {
    const dataUrl = await compressImage(file);
    if (editing !== session || !dialog.open) return; // dialog closed or reopened meanwhile
    formImage = dataUrl;
    showPreview();
  } catch (err) {
    if (editing !== session || !dialog.open) return;
    formError.textContent = err.message;
    fields.image.value = '';
  } finally {
    imageBusy = false;
    $('#f-save').disabled = false;
    $('#f-save').textContent = 'Save';
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (imageBusy) return;
  const { kind, item } = editing;
  const extra = KINDS[kind].extra;
  const raw = { kind, title: fields.title.value, body: fields.body.value };
  if (item) Object.assign(raw, { id: item.id, createdAt: item.createdAt });
  if (extra === 'url') raw.url = fields.url.value;
  if (extra === 'contact') raw.contact = fields.contact.value;
  if (extra === 'image' && formImage) raw.image = formImage;
  if (!item && state.items.length >= LIMITS.items) {
    formError.textContent = `Your case is full (${LIMITS.items} items). Remove something to make room.`;
    return;
  }
  const r = validateItem(raw);
  if (!r.ok) {
    formError.textContent = r.errors.join(' ');
    (r.errors.some((m) => m.includes('title')) ? fields.title : fields[extra] || fields.body).focus();
    return;
  }
  const items = item ? state.items.map((i) => (i.id === item.id ? r.item : i)) : [...state.items, r.item];
  const result = commit(items);
  returnId = r.item.id;
  dialog.close();
  toast(result.ok ? 'Kept in your case.' : `${result.error} ${UNSAVED_MSG}`, !result.ok);
});

dialog.addEventListener('close', () => {
  formImage = null;
  fields.image.value = '';
  focusAfterRender(returnId, editing.kind);
});

function removeItem(item) {
  if (!confirm(`Remove “${item.title}” from your case?`)) return;
  const result = commit(state.items.filter((i) => i.id !== item.id));
  document.querySelector(`[data-add="${item.kind}"]`).focus();
  toast(result.ok ? 'Removed.' : `${result.error} ${UNSAVED_MSG}`, !result.ok);
}

// ---------- backup, samples, clear ----------
$('#export').addEventListener('click', () => {
  const blob = new Blob([serializeBackup(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = `griefcase-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Backup of ${state.items.length} item${state.items.length === 1 ? '' : 's'} downloaded. Keep the file somewhere private.`);
});

const importFile = $('#import-file');
$('#import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  const problem = validateBackupFile(file);
  if (problem) return toast(`Nothing was changed. ${problem}`, true);
  let text;
  try { text = await file.text(); } catch { return toast('Nothing was changed. That file couldn’t be read.', true); }
  const r = parseBackup(text);
  if (!r.ok) return toast(`Nothing was changed. ${r.error}`, true);
  const n = r.state.items.length;
  if (!confirm(`Replace everything currently in your case (${state.items.length} items) with this backup (${n} items)? This can’t be undone — export a backup first if you want a copy.`)) {
    return toast('Import cancelled. Nothing was changed.');
  }
  const result = commit(r.state.items, { force: true });
  toast(result.ok ? `Imported ${n} item${n === 1 ? '' : 's'}.` : `${result.error} ${UNSAVED_MSG}`, !result.ok);
});

$('#remove-samples').addEventListener('click', () => {
  const result = commit(state.items.filter((i) => !i.sample));
  $('#export').focus();
  toast(result.ok ? 'Sample ideas removed.' : `${result.error} ${UNSAVED_MSG}`, !result.ok);
});

$('#clear').addEventListener('click', () => {
  if (!confirm('Clear everything Griefcase has kept on this device — all photos, words, sounds and people? This can’t be undone. Export a backup first if you want a copy.')) return;
  const result = clearState(storage);
  if (!result.ok) return toast(result.error, true);
  state = { ...state, items: [] };
  blocked = false;
  unsaved = false;
  render();
  toast('Everything has been cleared from this browser.');
});

// ---------- quiet moment ----------
const PROMPTS = [
  'Name one thing you can see that has been in your life a long time.',
  'Feel the weight of your feet on the floor, or of your body in the chair.',
  'Listen for the quietest sound you can hear.',
  'Hold something with a texture you like — a sleeve, a cup, a blanket.',
  'Notice the temperature of the air on your hands.',
  'Find one colour nearby that you like.',
  'Take a sip of something and notice whether it is warm or cool.',
];
let promptIndex = -1;
$('#ground-next').addEventListener('click', () => {
  promptIndex = (promptIndex + 1) % PROMPTS.length;
  const p = $('#ground-prompt');
  p.textContent = PROMPTS[promptIndex];
  p.hidden = false;
  $('#ground-next').textContent = 'Another prompt';
  $('#ground-skip').hidden = false;
});
$('#ground-skip').addEventListener('click', () => {
  $('#ground-prompt').hidden = true;
  $('#ground-skip').hidden = true;
  $('#ground-next').textContent = 'Show a prompt';
  $('#ground-next').focus();
});

const orb = $('#orb');
const cue = $('#breath-cue');
const timeText = $('#breath-time');
let breathTimer = null;
let lastPhase = null;

function stopBreathing(message) {
  clearInterval(breathTimer);
  breathTimer = null;
  lastPhase = null;
  orb.className = 'orb';
  timeText.textContent = '';
  if (message !== undefined) cue.textContent = message || 'Starts only when you choose.';
  $('#breath-start').hidden = false;
  $('#breath-stop').hidden = true;
}

$('#breath-start').addEventListener('click', () => {
  const start = performance.now();
  $('#breath-start').hidden = true;
  $('#breath-stop').hidden = false;
  $('#breath-stop').focus();
  const tick = () => {
    const b = breathAt(performance.now() - start);
    if (b.phase === 'done') {
      stopBreathing('That was a minute. Stay here as long as you like.');
      $('#breath-start').textContent = 'Another minute';
      $('#breath-start').focus();
      return;
    }
    if (b.phase !== lastPhase) {
      lastPhase = b.phase;
      orb.className = `orb ${b.phase}`;
      cue.textContent = b.phase === 'inhale' ? 'Breathe in…' : 'And slowly out…';
    }
    timeText.textContent = `${b.totalSecondsLeft}s left`;
  };
  tick();
  breathTimer = setInterval(tick, 250);
});
$('#breath-stop').addEventListener('click', () => {
  stopBreathing('Stopped. Breathe however feels natural.');
  $('#breath-start').focus();
});

// ---------- start ----------
render();
if (blocked) toast(loaded.error, true);
