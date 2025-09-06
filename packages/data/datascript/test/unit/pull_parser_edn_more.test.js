import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pullEdn } from '../../src/query/query_edn.js';

test('Pull EDN reverse and nested map specs', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice' },
    { ':db/id': -2, ':name': 'Bob', ':friend': -1 }
  ]);
  const alice = db.datoms('avet', ':name', 'Alice')[0].e;
  const bob = db.datoms('avet', ':name', 'Bob')[0].e;
  const pat = `[
    {:_friend [:name]}
    {:friend [:name]}
  ]`;
  const resBob = pullEdn(db, pat, bob);
  assert.equal(resBob[':friend'][':name'], 'Alice');
  const resAlice = pullEdn(db, pat, alice);
  // Alice has a reverse ref from Bob via :friend
  assert.equal(resAlice[':_friend'][0][':name'], 'Bob');
});
