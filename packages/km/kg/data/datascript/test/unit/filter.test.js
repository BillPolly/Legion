import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';
import { filteredDB } from '../../src/utils/filter.js';

test('filtered DB limits visible datoms to predicate', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':tag', 'public'],
    ['+', -1, ':n', 1],
    ['+', -2, ':tag', 'private'],
    ['+', -2, ':n', 2],
  ]);
  const pub = filteredDB(db, d => d.a === ':tag' ? d.v === 'public' : true);
  // Only entity with ':tag' 'public' should appear in query results when filtering by tag first
  const res = q({ find: ['?e'], where: [['?e', ':tag', 'public'], ['?e', ':n', '?n']] }, pub);
  assert.equal(res.length, 1);
});

