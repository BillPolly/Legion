import test from 'node:test';
import assert from 'node:assert/strict';

import { DB, retractEntity } from '../../src/core/db.js';

test('component retract cascades to children', () => {
  const schema = {
    ':task/subtasks': { card: 'many', component: true },
  };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':task/title': 'Root', ':task/subtasks': [-2, -3] },
    { ':db/id': -2, ':task/title': 'Child A' },
    { ':db/id': -3, ':task/title': 'Child B' },
  ]);
  const root = db.datoms('avet', ':task/title', 'Root')[0].e;
  const db2 = retractEntity(db, root);
  // Root and children gone
  assert.equal(db2.datoms('eavt', root).length, 0);
  const a = db.datoms('avet', ':task/title', 'Child A')[0].e;
  const b = db.datoms('avet', ':task/title', 'Child B')[0].e;
  assert.equal(db2.datoms('eavt', a).length, 0);
  assert.equal(db2.datoms('eavt', b).length, 0);
});

test('non-component refs are not cascaded', () => {
  const schema = {
    ':task/subtasks': { card: 'many', component: false },
  };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':task/title': 'Root', ':task/subtasks': [-2] },
    { ':db/id': -2, ':task/title': 'Child' },
  ]);
  const root = db.datoms('avet', ':task/title', 'Root')[0].e;
  const child = db.datoms('avet', ':task/title', 'Child')[0].e;
  const db2 = retractEntity(db, root);
  // Root gone, child remains
  assert.equal(db2.datoms('eavt', root).length, 0);
  assert.ok(db2.entity(child));
});
