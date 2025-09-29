import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('query: find names of people age 33', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':person/name', 'Alice'],
    ['+', -1, ':person/age', 33],
    ['+', -2, ':person/name', 'Bob'],
    ['+', -2, ':person/age', 40],
  ]);
  const query = {
    find: ['?e', '?n'],
    where: [
      ['?e', ':person/name', '?n'],
      ['?e', ':person/age', 33]
    ]
  };
  const res = q(query, db);
  assert.equal(res.length, 1);
  assert.equal(res[0][1], 'Alice');
});

test('query: join across two attributes', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':n', 1],
    ['+', -1, ':m', 2],
    ['+', -1, ':n', 1],
    ['+', -1, ':m', 3],
  ]);
  const query = {
    find: ['?e'],
    where: [
      ['?e', ':n', 1],
      ['?e', ':m', 3]
    ]
  };
  const res = q(query, db);
  assert.equal(res.length, 1);
});
