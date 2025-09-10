// Web persistence: save/load using Web Storage (localStorage or custom Storage)
import { serializeDB, deserializeDB } from './storage_common.js';

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  throw new Error('No Web Storage available. Pass a Storage instance explicitly.');
}

export { serializeDB, deserializeDB };

// Keep Node API parity: name suggests file, but stores under a key
export async function saveDBToFile(db, key, storage) {
  const obj = serializeDB(db);
  const s = resolveStorage(storage);
  s.setItem(key, JSON.stringify(obj));
}

export async function loadDBFromFile(key, storage) {
  const s = resolveStorage(storage);
  const txt = s.getItem(key);
  if (!txt) return undefined;
  const obj = JSON.parse(txt);
  return deserializeDB(obj);
}

// Convenience wrappers with clearer names
export const saveDBToStorage = saveDBToFile;
export const loadDBFromStorage = loadDBFromFile;

