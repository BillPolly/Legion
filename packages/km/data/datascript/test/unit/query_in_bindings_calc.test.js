import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('collection binding in :in expands envs', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':x', 1],
    ['+', -2, ':x', 2],
    ['+', -3, ':x', 3],
  ]);
  const query = {
    find: ['?e'],
    in: [['?vals', '...']],
    where: [
      ['?e', ':x', '?v'],
      ['>=', '?v', '?vals']
    ]
  };
  const res = q(query, db, [2,3]);
  // vals = 2 or 3; matches entities where v >= 2 or v >= 3
  // e with v=2,3 should appear (two entities)
  assert.equal(res.length, 2);
});

test('tuple binding in :in assigns variables', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':x', 5],
    ['+', -2, ':x', 10],
  ]);
  const query = {
    find: ['?e'],
    in: [['?lo', '?hi']],
    where: [
      ['?e', ':x', '?v'],
      ['>=', '?v', '?lo'],
      ['<=', '?v', '?hi']
    ]
  };
  const res = q(query, db, [6, 10]);
  assert.equal(res.length, 1);
});

test('calc clause binds an output var', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':n', 2],
    ['+', -2, ':n', 3],
  ]);
  const query = {
    find: ['?n2'],
    where: [
      ['?e', ':n', '?n'],
      ['calc', '+', '?n', 1, '?n2']
    ]
  };
  const res = q(query, db);
  const vals = res.map(r => r[0]).sort((a,b)=>a-b);
  assert.deepEqual(vals, [3,4]);
});

