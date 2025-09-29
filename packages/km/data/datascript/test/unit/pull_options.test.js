import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull, pullMany } from '../../index.js';

test('pull alias and default', () => {
  const { db } = DB.empty().withTx([[ '+', -1, ':name', 'Petr' ], [ '+', -1, ':aka', 'Devil' ], [ '+', -1, ':aka', 'Tupen' ]]);
  const e = db.datoms('aevt', ':name')[0].e;
  const res = pull(db, [[ ':aka', ':as', ':alias' ], [ ':foo', ':default', '[foo]' ]], e);
  assert.deepEqual(res[':alias'].sort(), ['Devil','Tupen']);
  assert.equal(res[':foo'], '[foo]');
});

test('pull limit option and default limit', () => {
  const values = Array.from({ length: 1500 }, (_, i) => `aka-${i}`);
  const tx = [ { ':db/id': -1, ':name': 'Kerri', ':aka': values } ];
  const { db } = DB.empty().withTx(tx);
  const e = db.datoms('aevt', ':name')[0].e;
  const r1 = pull(db, [ [':aka', ':limit', 500] ], e);
  assert.equal(r1[':aka'].length, 500);
  const r2 = pull(db, [ ':aka' ], e);
  assert.equal(r2[':aka'].length, 1000);
  const r3 = pull(db, [ [':aka', ':limit', null] ], e);
  assert.equal(r3[':aka'].length, 1500);
});

test('pullMany preserves order and nulls for missing', () => {
  const { db } = DB.empty().withTx([[ '+', -1, ':name', 'Petr' ], [ '+', -2, ':name', 'Lucy' ]]);
  const e1 = db.datoms('aevt', ':name')[0].e;
  const e2 = db.datoms('aevt', ':name')[1].e;
  const res = pullMany(db, [':name'], [e2, 999, e1]);
  assert.equal(res[0][':name'], 'Lucy');
  assert.equal(res[1], null);
  assert.equal(res[2][':name'], 'Petr');
});

