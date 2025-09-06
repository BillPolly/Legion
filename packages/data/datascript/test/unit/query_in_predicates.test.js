import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('query with :in scalar binding', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':person/name', 'Alice'],
    ['+', -1, ':person/age', 33],
    ['+', -2, ':person/name', 'Bob'],
    ['+', -2, ':person/age', 40],
  ]);
  const query = {
    find: ['?n'],
    in: ['?minAge'],
    where: [
      ['?e', ':person/name', '?n'],
      ['?e', ':person/age', '?age'],
      ['>=', '?age', '?minAge']
    ]
  };
  const res = q(query, db, 35);
  assert.deepEqual(res.map(r => r[0]).sort(), ['Bob']);
});

test('predicate filters results', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':x', 1],
    ['+', -2, ':x', 5],
    ['+', -3, ':x', 10],
  ]);
  const query = {
    find: ['?e'],
    where: [
      ['?e', ':x', '?v'],
      ['>', '?v', 4]
    ]
  };
  const res = q(query, db);
  assert.equal(res.length, 2);
});

