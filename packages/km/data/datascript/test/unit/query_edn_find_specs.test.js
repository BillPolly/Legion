import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN :find scalar/coll/tuple and :with', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':a', 1], ['+', -1, ':b', 2],
    ['+', -2, ':a', 3], ['+', -2, ':b', 4],
  ]);

  // scalar form with trailing '.'
  const scalar = qEdn(`[:find ?a . :where [[?e :a ?a]]]`, db);
  assert.ok(scalar === 1 || scalar === 3);

  // coll form with ellipsis
  const coll = qEdn(`[:find [?a ...] :where [[?e :a ?a]]]`, db).sort((x,y)=>x-y);
  assert.deepEqual(coll, [1,3]);

  // tuple form returns first row as tuple
  const tuple = qEdn(`[:find [?a ?b] :where [[?e :a ?a] [?e :b ?b]]]`, db);
  assert.equal(tuple.length, 2);

  // :with preserves multiplicity (no dedupe of rows that differ only in :with)
  const withRows = qEdn(`[:find ?a :with ?e :where [[?e :a ?a]]]`, db);
  assert.equal(withRows.length, 2);
});

