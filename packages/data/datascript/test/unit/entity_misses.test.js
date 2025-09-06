import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';

test('entity misses and lookup-ref uniqueness requirement', () => {
  const { db } = DB.empty({ ':name': { unique: 'identity' } }).withTx([
    { ':db/id': 1, ':name': 'Ivan' },
    { ':db/id': 2, ':name': 'Oleg' },
  ]);
  assert.equal(db.entity(null), null);
  assert.equal(db.entity('abc'), null);
  assert.equal(db.entity(':keyword'), null);
  assert.equal(db.entity([':name','Petr']), null);
  // Using non-unique attribute as lookup-ref should throw
  const { db: db2 } = DB.empty().withTx([{ ':db/id': 1, ':name': 'Ivan' }]);
  assert.throws(() => db2.entity([':not-an-attr', 777]));
});

