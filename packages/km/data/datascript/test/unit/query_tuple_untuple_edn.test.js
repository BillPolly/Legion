import test from 'node:test';
import assert from 'node:assert/strict';

import { qEdn } from '../../src/query/query_edn.js';
import { DB } from '../../src/core/db.js';

test('EDN tuple and untuple functions', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':a', 1],
    ['+', -1, ':b', 2],
  ]);
  let res = qEdn(`[:find ?t :where [[?e :a ?a] [?e :b ?b] [(tuple ?a ?b) ?t]]]`, db);
  assert.ok(Array.isArray(res[0][0]));
  const tup = res[0][0];
  assert.equal(tup[0], 1);
  assert.equal(tup[1], 2);

  res = qEdn(`[:find ?b :in ?t :where [[(untuple ?t) [?a ?b]]]]`, db, [1,2]);
  assert.equal(res[0][0], 2);
});
