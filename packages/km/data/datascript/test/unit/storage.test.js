import test from 'node:test';
import assert from 'node:assert/strict';
import { DB } from '../../src/core/db.js';
import { serializeDB, deserializeDB } from '../../src/storage/storage.js';

test('serialize/deserialize roundtrip', () => {
  const { db: db1 } = DB.empty().withTx([
    ['+', -1, ':x', 1],
    ['+', -1, ':y', new Date(0)],
  ]);
  const obj = serializeDB(db1);
  const db2 = deserializeDB(obj);
  // Ensure datoms preserved
  const d1 = db1.datoms('aevt', ':x');
  const d2 = db2.datoms('aevt', ':x');
  assert.equal(d1.length, 1);
  assert.equal(d2.length, 1);
  assert.equal(db2.datoms('aevt', ':y')[0].v instanceof Date, true);
});

