import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN: simple find where', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':person/name', 'Alice'],
    ['+', -1, ':person/age', 33],
    ['+', -2, ':person/name', 'Bob'],
    ['+', -2, ':person/age', 40],
  ]);
  const edn = `[:find ?n :where [[?e :person/name ?n] [?e :person/age 33]]]`;
  const res = qEdn(edn, db).flat();
  assert.deepEqual(res, ['Alice']);
});

test('EDN: :in scalar and predicate', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':x', 1], ['+', -2, ':x', 5], ['+', -3, ':x', 10]
  ]);
  const edn = `[:find ?e :in ?min :where [[?e :x ?v] [(>= ?v ?min)]]]`;
  const res = qEdn(edn, db, 5);
  assert.equal(res.length, 2);
});

test('EDN: aggregates and shapes', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':a', 1], ['+', -2, ':a', 2], ['+', -3, ':a', 3]
  ]);
  const ednCount = `[:find (count) . :where [[?e :a ?v]]]`;
  const ednColl = `[:find [?v ...] :where [[?e :a ?v]]]`;
  const c = qEdn(ednCount, db);
  const coll = qEdn(ednColl, db).sort((a,b)=>a-b);
  assert.equal(c, 3);
  assert.deepEqual(coll, [1,2,3]);
});

test('EDN: pull in find', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'A', ':age': 33 },
  ]);
  const eid = db.datoms('aevt', ':name')[0].e;
  const edn = `[:find (pull ?e [:db/id :name]) :where [[?e :name "A"]]]`;
  const res = qEdn(edn, db);
  assert.equal(res.length, 1);
  const obj = Array.isArray(res[0]) ? res[0][0] : res[0];
  assert.equal(typeof obj.id, 'number');
});
