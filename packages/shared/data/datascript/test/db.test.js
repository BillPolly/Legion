import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/core/db.js';
import { createConn } from '../src/core/conn.js';
import { pull } from '../src/query/pull.js';

test('transact map with tempid and query entity', () => {
  const schema = { ':person/pets': { card: 'many' } };
  const conn = createConn(schema);
  const tx = [
    { ':db/id': -1, ':person/name': 'Alice', ':person/age': 33, ':person/pets': ['Mittens', 'Fido'] },
  ];
  const { dbAfter } = conn.transact(tx);
  const eid = dbAfter.datoms('aevt', ':person/name')[0]?.e;
  assert.ok(eid, 'entity id allocated');
  const ent = dbAfter.entity(eid);
  assert.deepEqual(ent[':person/name'], 'Alice');
  assert.deepEqual([...ent[':person/pets']].sort(), ['Fido','Mittens']);
});

test('add and retract attribute value', () => {
  const db0 = DB.empty();
  const { db: db1 } = db0.withTx([[ '+', -1, ':tag/name', 'x' ]]);
  const eid = db1.datoms('aevt', ':tag/name')[0].e;
  const { db: db2 } = db1.withTx([[ '-', eid, ':tag/name', 'x' ]]);
  assert.equal(db2.datoms('aevt', ':tag/name').length, 0, 'retracted value removed');
});

test('pull flat attributes', () => {
  const conn = createConn();
  const { dbAfter } = conn.transact([{ ':db/id': -1, ':n': 1, ':m': 2 }]);
  const eid = dbAfter.datoms('aevt', ':n')[0].e;
  const res = pull(dbAfter, [':db/id', ':n'], eid);
  assert.deepEqual(res, { id: eid, ':n': 1 });
});

test('immutability: withTx returns new DB', () => {
  const db0 = DB.empty();
  const { db: db1 } = db0.withTx([[ '+', -1, ':a', 1 ]]);
  assert.notEqual(db0, db1);
  assert.equal(db0.datoms('aevt', ':a').length, 0);
  assert.equal(db1.datoms('aevt', ':a').length, 1);
});
