import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('rule invocation with parameter substitution', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':person/name', 'Alice'],
    ['+', -1, ':person/age', 20],
    ['+', -2, ':person/name', 'Bob'],
    ['+', -2, ':person/age', 15],
  ]);
  const rules = {
    hasName: {
      args: ['?e','?n'],
      bodies: [ [ ['?e', ':person/name', '?n'] ] ]
    }
  };
  const query = {
    find: ['?n'],
    where: [
      ['rule', 'hasName', '?e', '?n']
    ],
    rules,
    findType: 'coll'
  };
  const res = q(query, db).sort();
  assert.deepEqual(res, ['Alice','Bob']);
});
