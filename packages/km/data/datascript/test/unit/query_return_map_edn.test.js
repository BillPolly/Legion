import test from 'node:test';
import assert from 'node:assert/strict';

import { qEdn } from '../../src/query/query_edn.js';
import { DB } from '../../src/core/db.js';

test('EDN return map with :keys', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':age': 33, ':email': 'a@x' },
    { ':db/id': -2, ':name': 'Bob', ':age': 40, ':email': 'b@x' },
  ]);
  const edn = `[:find ?name ?age ?email :keys name age email :where [[?e :name ?name] [?e :age ?age] [?e :email ?email]]]`;
  const res = qEdn(edn, db);
  assert.equal(res.length, 2);
  assert.ok(res.find(x => x.name === 'Alice' && x.age === 33));
});

test('EDN return map with tuple find', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':age': 33 }
  ]);
  const edn = `[:find [?name ?age] :keys name age :where [[?e :name ?name] [?e :age ?age]]]`;
  const res = qEdn(edn, db);
  assert.equal(res.name, 'Alice');
  assert.equal(res.age, 33);
});
