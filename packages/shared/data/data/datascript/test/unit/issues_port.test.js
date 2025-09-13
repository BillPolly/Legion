import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';
import { filteredDB } from '../../src/utils/filter.js';
import { schema as schemaOf } from '../../index.js';

test('issue-262: vector function holds values', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':attr': 'A' },
    { ':db/id': -2, ':attr': 'B' },
  ]);
  const query = { find: ['?a','?b'], where: [['?e', ':attr', '?a'], ['call', 'vector', '?a', '?b']] };
  const res = q(query, db);
  const got = new Set(res.map(([a,b]) => `${a}|${JSON.stringify(b)}`));
  assert.ok(got.has('A|["A"]'));
  assert.ok(got.has('B|["B"]'));
});

test('issue-331: empty preserves schema', () => {
  const sch = { ':aka': { card: 'many' } };
  const db = DB.empty(sch).empty();
  assert.deepEqual(schemaOf(db), sch);
});

test('issue-330: filtered db pretty-print parity (datoms parity here)', () => {
  const sch = { ':aka': { card: 'many' } };
  const { db } = DB.empty(sch).withTx([
    { ':db/id': -1, ':name': 'Maksim', ':age': 45, ':aka': ['Max Otto von Stierlitz', 'Jack Ryan'] }
  ]);
  const fdb = filteredDB(db, () => true);
  // Compare datoms across all indexes
  const idxs = ['eavt','aevt','avet','vaet'];
  for (const idx of idxs) {
    const a = db.datoms(idx).map(d => [d.e,d.a,d.v]);
    const b = fdb.datoms(idx).map(d => [d.e,d.a,d.v]);
    assert.deepEqual(a, b);
  }
});

test('issue-369: different value types on same attr do not crash; can diff sets', () => {
  const db1 = DB.empty().withTx([[ '+', 1, ':attr', ':aa' ]]).db;
  const db2 = DB.empty().withTx([[ '+', 1, ':attr', 'aa' ]]).db;
  const s1 = new Set(db1.datoms('eavt').map(d => `${d.e}|${d.a}|${String(d.v)}`));
  const s2 = new Set(db2.datoms('eavt').map(d => `${d.e}|${d.a}|${String(d.v)}`));
  const only1 = [...s1].filter(x => !s2.has(x));
  const only2 = [...s2].filter(x => !s1.has(x));
  assert.ok(only1.find(x => x.includes(':aa')));
  assert.ok(only2.find(x => x.includes('aa')));
});

test('issue-381: expose schema via API', () => {
  const sch = { ':aka': { card: 'many' } };
  const db = DB.empty(sch);
  assert.deepEqual(schemaOf(db), sch);
});

