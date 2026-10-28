// localStorage adapter. Never throws; reports a human-readable error instead.
import { SCHEMA_VERSION, sampleState, validateState } from './model.js';

export const STORAGE_KEY = 'griefcase.v1';

// blocked: saved data exists but couldn't be read, so the app must not save over it.
export function loadState(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: { schema: SCHEMA_VERSION, items: [] }, blocked: true,
      error: 'This browser isn’t letting Griefcase use local storage (private mode or blocked site data?). Nothing you add can be kept here.',
    };
  }
  if (raw === null) return { state: sampleState(), blocked: false };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const r = validateState(parsed);
  if (r.ok) return { state: r.state, blocked: false };
  return {
    state: { schema: SCHEMA_VERSION, items: [] }, blocked: true,
    error: 'Your saved case couldn’t be read, so nothing will be saved over it. You can import a backup, or clear all data to start fresh.',
  };
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schema: SCHEMA_VERSION, items: state.items }));
    return { ok: true };
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
    return {
      ok: false,
      error: quota
        ? 'Browser storage is full, so this was not saved. Try removing a photo or two, and export a backup.'
        : 'This was not saved — the browser refused to store it. Your entry is still here; try again or export a backup.',
    };
  }
}

export function clearState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Couldn’t clear saved data. Try clearing this site’s data in your browser settings.' };
  }
}
