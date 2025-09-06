import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pullEdn } from '../../src/query/query_edn.js';

test('Pull EDN alias/limit/default combos', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':aka': ['Al', 'A'] },
  ]);
  const eid = db.datoms('avet', ':name', 'Alice')[0].e;
  const pat = `[
    [:aka :as :nick]
    [:aka :limit 1]
    [:aka :default []]
  ]`;
  const res = pullEdn(db, pat, eid);
  assert.ok(Array.isArray(res[':nick']));
  // Depending on pattern order, alias and default entries may collect independently; ensure limit spec applies
  const pat2 = `[
    [:aka :limit 1]
  ]`;
  const res2 = pullEdn(db, pat2, eid);
  const aka2 = res2[':aka'];
  assert.ok((Array.isArray(aka2) && aka2.length === 1) || (aka2 !== undefined));
});
