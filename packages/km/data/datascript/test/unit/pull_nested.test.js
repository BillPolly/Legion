import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('pull nested forward ref', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':friend': -2 },
    { ':db/id': -2, ':name': 'Bob' }
  ]);
  const alice = db.datoms('aevt', ':name').find(d => d.v === 'Alice').e;
  const res = pull(db, [':name', { ':friend': [':name'] }], alice);
  assert.equal(res[':name'], 'Alice');
  assert.equal(res[':friend'][':name'], 'Bob');
});

test('pull reverse ref via :_attr', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':parent': -2, ':name': 'Child' },
    { ':db/id': -2, ':name': 'Parent' }
  ]);
  const parent = db.datoms('aevt', ':name').find(d => d.v === 'Parent').e;
  const res = pull(db, [':name', { ':_parent': [':name'] }], parent);
  assert.equal(res[':name'], 'Parent');
  assert.equal(Array.isArray(res[':_parent']), true);
  assert.equal(res[':_parent'][0][':name'], 'Child');
});

test('pull wildcard includes attributes', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':n': 1, ':m': 2 }
  ]);
  const e = db.datoms('aevt', ':n')[0].e;
  const res = pull(db, ['*'], e);
  assert.equal(res[':n'], 1);
  assert.equal(res[':m'], 2);
});

