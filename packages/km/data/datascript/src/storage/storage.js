// Node persistence: save/load from filesystem
import { serializeDB, deserializeDB } from './storage_common.js';
export { serializeDB, deserializeDB };
import fs from 'node:fs/promises';
import path from 'node:path';

export async function saveDBToFile(db, filePath) {
  const obj = serializeDB(db);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj), 'utf8');
}

export async function loadDBFromFile(filePath) {
  const txt = await fs.readFile(filePath, 'utf8');
  const obj = JSON.parse(txt);
  return deserializeDB(obj);
}
