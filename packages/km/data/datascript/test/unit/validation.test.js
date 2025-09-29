import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';

test('rejects bad attribute names and nil values', () => {
  const db0 = DB.empty();
  assert.throws(() => db0.withTx([[ '+', -1, null, 'Ivan' ]]));
  assert.throws(() => db0.withTx([[ '+', -1, 17, 'Ivan' ]]));
  assert.throws(() => db0.withTx([[ '+', -1, ':name', null ]]));
  assert.throws(() => db0.withTx([{ ':db/id': -1, 17: 'Ivan' }]));
  assert.throws(() => db0.withTx([{ ':db/id': -1, ':name': null }]));
});

test('tempids only allowed in add, not retract', () => {
  const db0 = DB.empty();
  assert.throws(() => db0.withTx([[ '-', -1, ':name', 'Ivan' ]]));
});

test('valueType ref enforces number or lookup ref values', () => {
  const db0 = DB.empty({ ':profile': { valueType: 'ref' } });
  assert.throws(() => db0.withTx([[ '+', -1, ':profile', /re/ ]]));
  assert.throws(() => db0.withTx([{ ':db/id': -1, ':profile': {} }]));
});

test('invalid entity id types rejected', () => {
  const db0 = DB.empty();
  assert.throws(() => db0.withTx([[ '+', null, ':name', 'Ivan' ]]));
  assert.throws(() => db0.withTx([[ '+', {}, ':name', 'Ivan' ]]));
});

