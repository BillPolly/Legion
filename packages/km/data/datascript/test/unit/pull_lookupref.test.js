import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull, pullMany } from '../../index.js';

test('pull by lookup ref', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':name', 'Petr'],
    ['+', -1, ':aka', 'Devil'],
    ['+', -1, ':aka', 'Tupen']
  ]);
  const res = pull(db, [':name', ':aka'], [':name', 'Petr']);
  assert.equal(res[':name'], 'Petr');
  assert.equal(res[':aka'].length, 2);
});

test('pullMany with lookup refs and missing', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':name', 'Elizabeth'],
    ['+', -2, ':name', 'Petr'], ['+', -2, ':aka', 'Devil'], ['+', -2, ':aka', 'Tupen'],
    ['+', -3, ':name', 'Eunan'],
    ['+', -4, ':name', 'Rebecca']
  ]);
  const refs = [ [':name','Elizabeth'], [':name','Petr'], [':name','Eunan'], [':name','Rebecca'], [':name','Unknown'] ];
  const res = pullMany(db, [':aka'], refs);
  assert.deepEqual(res.map(x => (x ? x[':aka'] : x)), [undefined, ['Devil','Tupen'], undefined, undefined, null]);
});

