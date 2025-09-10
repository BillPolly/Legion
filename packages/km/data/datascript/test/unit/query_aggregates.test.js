import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('count aggregate (scalar)', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':a', 1],
    ['+', -2, ':a', 2],
    ['+', -3, ':a', 3]
  ]);
  const query = {
    find: [['count']],
    where: [['?e', ':a', '?v']],
    findType: 'scalar'
  };
  const res = q(query, db);
  assert.equal(res, 3);
});

test('sum aggregate grouped by key', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':k', 'x'], ['+', -1, ':n', 1],
    ['+', -2, ':k', 'x'], ['+', -2, ':n', 2],
    ['+', -3, ':k', 'y'], ['+', -3, ':n', 5]
  ]);
  const query = {
    find: ['?k', ['sum', '?n']],
    where: [
      ['?e', ':k', '?k'],
      ['?e', ':n', '?n']
    ]
  };
  const res = q(query, db);
  // Expect [['x', 3], ['y', 5]] ignoring order
  const m = new Map(res.map(([k,v]) => [k,v]));
  assert.equal(m.get('x'), 3);
  assert.equal(m.get('y'), 5);
});

test('with prevents double counting', () => {
  // Create duplicates for an entity that would otherwise be double-counted
  const { db } = DB.empty().withTx([
    ['+', -1, ':tag', 'a'],
    ['+', -1, ':tag', 'a'], // duplicate tag on same entity
  ]);
  const query = {
    find: [['count']],
    with: ['?e'],
    where: [
      ['?e', ':tag', 'a']
    ],
    findType: 'scalar'
  };
  const res = q(query, db);
  assert.equal(res, 1);
});

test('coll and tuple shapes', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':n', 1],
    ['+', -2, ':n', 2]
  ]);
  const qColl = { find: ['?n'], where: [['?e', ':n', '?n']], findType: 'coll' };
  const qTuple = { find: ['?n','?e'], where: [['?e', ':n', '?n']], findType: 'tuple' };
  const c = q(qColl, db).sort((a,b)=>a-b);
  const t = q(qTuple, db);
  assert.deepEqual(c, [1,2]);
  assert.equal(Array.isArray(t), true);
  assert.equal(t.length, 2);
});

