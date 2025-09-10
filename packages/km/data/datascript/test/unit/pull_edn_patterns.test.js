import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { pullEdn } from '../../src/query/query_edn.js';

test('EDN pull alias and wildcard', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':name', 'Petr'],
    ['+', -1, ':aka', 'Devil'],
    ['+', -1, ':aka', 'Tupen']
  ]);
  const e = db.datoms('aevt', ':name')[0].e;
  const pat = `[[:aka :as :alias] [:name :as :first] *]`;
  const res = pullEdn(db, pat, e);
  assert.deepEqual(res[':alias'].sort(), ['Devil','Tupen']);
  assert.equal(res[':first'], 'Petr');
});

test('EDN pull list specs for limit and default', () => {
  const values = Array.from({ length: 1500 }, (_, i) => `aka-${i}`);
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Kerri', ':aka': values }
  ]);
  const e = db.datoms('aevt', ':name')[0].e;
  const pat1 = `[(limit :aka 500)]`;
  const r1 = pullEdn(db, pat1, e);
  assert.equal(r1[':aka'].length, 500);
  const pat2 = `[(default :foo "bar")]`;
  const r2 = pullEdn(db, pat2, e);
  assert.equal(r2[':foo'], 'bar');
});

test('EDN pull map spec with limit key', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -4, ':name': 'Lucy', ':friend': [-5, -6, -7, -8] },
    { ':db/id': -5, ':name': 'Elizabeth' },
    { ':db/id': -6, ':name': 'Matthew' },
    { ':db/id': -7, ':name': 'Eunan' },
    { ':db/id': -8, ':name': 'Kerri' }
  ]);
  const e = db.datoms('aevt', ':name').find(d => d.v === 'Lucy').e;
  const pat = `[:name {(limit :friend 2) [:name]}]`;
  const r = pullEdn(db, pat, e);
  assert.equal(r[':friend'].length, 2);
});

test('EDN pull map with default and recursion', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Petr', ':child': [-2, -3] },
    { ':db/id': -2, ':name': 'David' },
    { ':db/id': -3, ':name': 'Thomas' }
  ]);
  const e1 = db.datoms('aevt', ':name').find(d => d.v === 'Petr').e;
  const e2 = db.datoms('aevt', ':name').find(d => d.v === 'David').e;
  const pat = `[[:name :default "[name]"] {[:child :default "[child]"] ...}]`;
  const r1 = pullEdn(db, pat, e1);
  assert.equal(r1[':name'], 'Petr');
  assert.ok(Array.isArray(r1[':child']));
  const r2 = pullEdn(db, pat, e2);
  assert.equal(r2[':name'], 'David');
  assert.equal(r2[':child'], '[child]');
});
