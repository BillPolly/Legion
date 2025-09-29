import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN not/not-join', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':t', 'A'],
    ['+', -2, ':t', 'B'],
    ['+', -3, ':u', 'C'],
  ]);

  // not excludes
  const notq = qEdn(`[:find ?x :where [[?e :t ?x] (not [?e :u ?x])]]`, db);
  const sNot = new Set(notq.map(r => r[0]));
  assert.ok(sNot.has('A') && sNot.has('B'));

  // not-join excludes when bound
  const notjoin = qEdn(`[:find ?x :where [[?e :t ?x] (not-join [?x] [?e2 :u ?x])]]`, db);
  const sNj = new Set(notjoin.map(r => r[0]));
  assert.ok(sNj.has('A') && sNj.has('B'));
});
