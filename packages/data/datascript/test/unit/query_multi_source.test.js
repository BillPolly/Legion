import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('multi-source join via :in bound sources', () => {
  const { db: a } = DB.empty().withTx([
    ['+', -1, ':dept', 'eng'],
    ['+', -1, ':person/name', 'Alice'],
  ]);
  const { db: b } = DB.empty().withTx([
    ['+', -1, ':deptCode', 'eng'],
    ['+', -1, ':deptTitle', 'Engineering'],
  ]);

  const query = {
    find: ['?title'],
    in: ['$a', '$b'],
    where: [
      ['$a', '?e', ':dept', '?code'],
      ['$b', '?d', ':deptCode', '?code'],
      ['$b', '?d', ':deptTitle', '?title']
    ]
  };
  const res = q(query, a, a, b);
  assert.equal(res.length, 1);
  assert.equal(res[0][0], 'Engineering');
});

test('default source for 3-term clause plus explicit source for 4-term clause', () => {
  const { db: a } = DB.empty().withTx([
    ['+', -1, ':x', 1],
  ]);
  const { db: b } = DB.empty().withTx([
    ['+', -1, ':y', 1],
  ]);
  const query = {
    find: ['?v'],
    in: ['$b'],
    where: [
      ['?e', ':x', '?v'], // uses default db (a)
      ['$b', '?e2', ':y', '?v'] // uses b
    ]
  };
  const res = q(query, a, b);
  assert.deepEqual(res, [[1]]);
});

