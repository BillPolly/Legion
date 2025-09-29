import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pull } from '../../src/query/pull.js';

test('deep recursion stress (~500)', () => {
  const depth = 500;
  const tx = [];
  let prev = -1;
  for (let i = 0; i < depth; i++) {
    const cur = -2 - i;
    if (i === 0) tx.push({ ':db/id': prev, ':name': `P-${i}` });
    tx.push({ ':db/id': cur, ':name': `P-${i+1}` });
    tx.push(['+', prev, ':friend', cur]);
    prev = cur;
  }
  const { db } = DB.empty().withTx(tx);
  const start = db.datoms('aevt', ':name').find(d => d.v === 'P-0').e;
  const res = pull(db, [':name', { ':friend': '...' }], start);
  // Walk down depth steps following [:friend 0] repeatedly
  let node = res;
  for (let i = 0; i < Math.min(depth - 1, 50); i++) {
    node = node[':friend'];
    if (Array.isArray(node)) node = node[0];
  }
  assert.ok(node && node[':name'] && node[':name'].startsWith('P-'));
});

