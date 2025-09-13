import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DB } from '../../src/core/db.js';
import { saveDBToFile, loadDBFromFile } from '../../src/storage/storage.js';

test('save and load DB from file', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsjs-'));
  const file = path.join(tmp, 'db.json');

  const { db: db1 } = DB.empty({ ':tags': { card: 'many' } }).withTx([
    ['+', -1, ':name', 'A'],
    ['+', -1, ':tags', 'x'],
    ['+', -1, ':tags', 'y'],
  ]);
  await saveDBToFile(db1, file);

  const db2 = await loadDBFromFile(file);
  assert.deepEqual(db2.datoms('aevt', ':name')[0].v, 'A');
  assert.equal(db2.datoms('aevt', ':tags').length, 2);
});

