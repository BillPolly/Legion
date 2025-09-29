import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn, parseRulesEDN } from '../../src/query/query_edn.js';

test('EDN rules with two bodies', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':p', 'A'],
    ['+', -2, ':q', 'A'],
    ['+', -3, ':p', 'B'],
  ]);
  const rules = `[
    [(r ?x) [?e :p ?x]]
    [(r ?x) [?e :q ?x]]
  ]`;
  const res = qEdn(`[:find ?x :in $ % :where [(r ?x)]]`, db, db, rules);
  const s = new Set(res.map(r => r[0]));
  assert.ok(s.has('A') && s.has('B'));
});
