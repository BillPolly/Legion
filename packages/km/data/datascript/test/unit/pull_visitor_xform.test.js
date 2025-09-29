import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('visitor basic and wildcard', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':name', 'Petr'],
    ['+', -1, ':aka', 'Devil'],
    ['+', -1, ':aka', 'Tupen'],
    ['+', -1, ':child', -2],
    ['+', -2, ':name', 'David']
  ]);
  const e = db.datoms('aevt', ':name').find(d => d.v === 'Petr').e;
  const trace = [];
  pull(db, [':name'], e, { visitor: (k,eid,a,v) => trace.push([k,eid,a,v]) });
  assert.deepEqual(trace, [[":db.pull/attr", e, ':name', null]]);

  const trace2 = [];
  pull(db, ['*'], e, { visitor: (k,eid,a,v) => trace2.push([k,eid,a,v]) });
  // wildcard then sorted attrs
  assert.equal(trace2[0][0], ':db.pull/wildcard');
  assert.deepEqual(trace2.slice(1), [
    [":db.pull/attr", e, ':aka', null],
    [":db.pull/attr", e, ':child', null],
    [":db.pull/attr", e, ':name', null]
  ]);
});

test('visitor reverse', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':name', 'Petr'],
    ['+', -2, ':name', 'David'],
    ['+', -1, ':child', -2]
  ]);
  const e = db.datoms('aevt', ':name').find(d => d.v === 'David').e;
  const tr = [];
  pull(db, [':name', ':_child'], e, { visitor: (k,eid,a,v) => tr.push([k,eid,a,v]) });
  assert.deepEqual(tr, [[":db.pull/attr", e, ':name', null], [":db.pull/attr", e, ':_child', null], [":db.pull/reverse", null, ':child', e]]);
});

test('xform on missing and default precedence', () => {
  const { db } = DB.empty().withTx([[ '+', -1, ':name', 'Petr' ]]);
  const e = db.datoms('aevt', ':name')[0].e;
  const res1 = pull(db, [[ ':foo', ':xform', (v)=>[v] ]], e);
  assert.deepEqual(res1[':foo'], [undefined]);
  const res2 = pull(db, [[ ':foo', ':default', '[unknown]', ':xform', (v)=>[v] ]], e);
  assert.equal(res2[':foo'], '[unknown]');
});
