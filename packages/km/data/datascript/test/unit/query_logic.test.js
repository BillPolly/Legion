import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('or-like disjunction via collection binding', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':t', 'A'],
    ['+', -2, ':t', 'B'],
    ['+', -3, ':t', 'C']
  ]);
  const query = {
    find: ['?e'],
    in: [['?v', '...']],
    where: [ ['?e', ':t', '?v'] ]
  };
  const res = q(query, db, ['A','C']);
  assert.equal(res.length, 2);
});

test('not excludes matches of a subpattern', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':x', 1],
    ['+', -1, ':y', 2],
    ['+', -2, ':x', 1]
  ]);
  const query = {
    find: ['?e'],
    where: [
      ['?e', ':x', 1],
      ['not', ['?e', ':y', 2]]
    ]
  };
  const res = q(query, db);
  assert.equal(res.length, 1);
});
