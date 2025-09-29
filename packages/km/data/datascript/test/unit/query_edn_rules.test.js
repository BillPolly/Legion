import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN rules: non-recursive rule', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':person/name', 'Alice'],
    ['+', -2, ':person/name', 'Bob']
  ]);
  const q = `[:find ?n :in $ % :where [(hasName ?e ?n)]]`;
  const rulesEdn = `[
    [(hasName ?e ?n) [?e :person/name ?n]]
  ]`;
  const res = qEdn(q, db, db, rulesEdn).flat().sort();
  assert.deepEqual(res, ['Alice','Bob']);
});

test('EDN rules: simple recursive ancestor', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':parent', -2],
    ['+', -2, ':parent', -3]
  ]);
  const q = `[:find ?a ?c :in $ % :where [(ancestor ?a ?c)]]`;
  const rulesEdn = `[
    [(ancestor ?a ?b) [?a :parent ?b]]
    [(ancestor ?a ?c) [?a :parent ?b] (ancestor ?b ?c)]
  ]`;
  const res = qEdn(q, db, db, rulesEdn);
  // Should include direct pairs plus transitive pair => total 3 pairs
  assert.equal(res.length, 3);
});
