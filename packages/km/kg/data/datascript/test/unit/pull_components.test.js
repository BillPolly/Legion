import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('component forward auto-expansion', () => {
  const schema = { ':part': { component: true, card: 'many' } };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -10, ':name': 'Part A', ':part': [-11, -15] },
    { ':db/id': -11, ':name': 'Part A.A', ':part': [-12] },
    { ':db/id': -12, ':name': 'Part A.A.A' },
    { ':db/id': -15, ':name': 'Part A.B' }
  ]);
  const e = db.datoms('aevt', ':name').find(d => d.v === 'Part A').e;
  const res = pull(db, [':name', ':part'], e);
  assert.equal(res[':name'], 'Part A');
  assert.equal(Array.isArray(res[':part']), true);
  const names = res[':part'].map(p => p[':name']).sort();
  assert.deepEqual(names, ['Part A.A','Part A.B']);
  const a_a = res[':part'].find(p => p[':name'] === 'Part A.A');
  assert.equal(a_a[':part'][0][':name'], 'Part A.A.A');
});

test('reverse component yields single', () => {
  const schema = { ':part': { component: true, card: 'many' } };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -10, ':name': 'Part A', ':part': [-11] },
    { ':db/id': -11, ':name': 'Part A.A' }
  ]);
  const child = db.datoms('aevt', ':name').find(d => d.v === 'Part A.A').e;
  const res = pull(db, [':name', { ':_part': [':name'] }], child);
  assert.equal(res[':_part'][':name'], 'Part A');
});

test('reverse component recursion with ellipsis', () => {
  const schema = { ':part': { component: true, card: 'many' } };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -10, ':name': 'Part A', ':part': [-11] },
    { ':db/id': -11, ':name': 'Part A.A', ':part': [-12] },
    { ':db/id': -12, ':name': 'Part A.A.A' }
  ]);
  const leaf = db.datoms('aevt', ':name').find(d => d.v === 'Part A.A.A').e;
  const res = pull(db, [':name', { ':_part': '...' }], leaf);
  assert.equal(res[':_part'][':_part'][':name'], 'Part A');
});
