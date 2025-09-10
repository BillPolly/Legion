import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('pull in find', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'A', ':age': 33 },
  ]);
  const eid = db.datoms('aevt', ':name')[0].e;
  const query = {
    find: [['pull', '?e', [':db/id', ':name']]],
    where: [['?e', ':name', 'A']],
    findType: 'coll'
  };
  const res = q(query, db);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, eid);
  assert.equal(res[0][':name'], 'A');
});

