import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('pull recursion with ellipsis', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'A', ':friend': -2 },
    { ':db/id': -2, ':name': 'B', ':friend': -3 },
    { ':db/id': -3, ':name': 'C' }
  ]);
  const a = db.datoms('aevt', ':name').find(d => d.v === 'A').e;
  const res = pull(db, [':db/id', { ':friend': '...' }], a);
  assert.equal(res[':friend'][':friend'].id > 0, true);
});

test('pull numeric recursion depth', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'A', ':friend': -2 },
    { ':db/id': -2, ':name': 'B', ':friend': -3 },
    { ':db/id': -3, ':name': 'C' }
  ]);
  const a = db.datoms('aevt', ':name').find(d => d.v === 'A').e;
  const res = pull(db, [':db/id', { ':friend': 1 }], a);
  assert.equal(typeof res[':friend'].id, 'number');
  assert.equal(typeof res[':friend'][':friend'], 'number');
});

