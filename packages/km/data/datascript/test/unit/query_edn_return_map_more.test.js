import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN return map with :strs and :syms', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':age': 33, ':email': 'a@x' },
    { ':db/id': -2, ':name': 'Bob', ':age': 40, ':email': 'b@x' },
  ]);
  const rmStrs = qEdn(`[:find ?name ?age :strs name age :where [[?e :name ?name] [?e :age ?age]]]`, db);
  assert.ok(rmStrs.every(m => typeof m.name === 'string'));
  const rmSyms = qEdn(`[:find ?name ?age :syms name age :where [[?e :name ?name] [?e :age ?age]]]`, db);
  assert.ok(rmSyms.length === 2);
});
