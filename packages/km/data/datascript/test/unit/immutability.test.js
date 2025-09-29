import test from 'node:test';
import assert from 'node:assert/strict';

import { datom } from '../../src/core/datom.js';
import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('datom objects are frozen', () => {
  const d = datom(1, ':a', 2, 3, true);
  assert.equal(Object.isFrozen(d), true);
});

test('entity is deeply immutable (arrays frozen)', () => {
  const schema = { ':tags': { card: 'many' } };
  const { db } = DB.empty(schema).withTx([
    ['+', -1, ':name', 'A'],
    ['+', -1, ':tags', 'x'],
    ['+', -1, ':tags', 'y'],
  ]);
  const eid = db.datoms('aevt', ':name')[0].e;
  const ent = db.entity(eid);
  assert.equal(Object.isFrozen(ent), true);
  assert.equal(Array.isArray(ent[':tags']), true);
  assert.equal(Object.isFrozen(ent[':tags']), true);
});

test('pull result object is frozen', () => {
  const { db } = DB.empty().withTx([[ '+', -1, ':n', 1 ]]);
  const eid = db.datoms('aevt', ':n')[0].e;
  const res = pull(db, [':db/id', ':n'], eid);
  assert.equal(Object.isFrozen(res), true);
});

