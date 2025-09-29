import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { q } from '../../src/query/query.js';

test('explode collections for card-many attributes', () => {
  for (const coll of [ ['Devil','Tupen'], new Set(['Devil','Tupen']) ]) {
    const { db } = DB.empty({ ':aka': { card: 'many' }, ':also': { card: 'many' } }).withTx([
      { ':db/id': -1, ':name': 'Ivan', ':age': 16, ':aka': coll, ':also': 'ok' }
    ]);
    const r1 = q({ find: ['?n','?a'], where: [['?e', ':name', '?n'], ['?e', ':age', '?a']] }, db);
    const s1 = new Set(r1.map(x => `${x[0]}|${x[1]}`));
    assert.ok(s1.has('Ivan|16'));
    const r2 = q({ find: ['?v'], where: [['?e', ':name', 'Ivan'], ['?e', ':also', '?v']] }, db);
    assert.ok(r2.some(x => x[0] === 'ok'));
    const e = db.datoms('avet', ':name', 'Ivan')[0].e;
    const s3 = new Set(db.datoms('eavt', e, ':aka').map(d => d.v));
    assert.ok(s3.has('Devil') && s3.has('Tupen'));
  }
});

test('explode ref + many and reverse attr', () => {
  const schema = { ':children': { valueType: 'ref', card: 'many' } };
  const db0 = DB.empty(schema);
  for (const children of [ [-2,-3], new Set([-2,-3]) ]) {
    const { db } = db0.withTx([
      { ':db/id': -1, ':name': 'Ivan', ':children': children },
      { ':db/id': -2, ':name': 'Petr' },
      { ':db/id': -3, ':name': 'Evgeny' }
    ]);
    const r = q({ find: ['?n'], where: [['?x', ':children', '?e' ], ['?e', ':name', '?n']] }, db);
    const s = new Set(r.map(x => x[0]));
    assert.ok(s.has('Petr') && s.has('Evgeny'));
  }
  const { db } = db0.withTx([
    { ':db/id': -1, ':name': 'Ivan' },
    { ':db/id': -2, ':name': 'Petr', ':_children': -1 },
    { ':db/id': -3, ':name': 'Evgeny', ':_children': -1 }
  ]);
  const r2 = q({ find: ['?n'], where: [['?x', ':children', '?e' ], ['?e', ':name', '?n']] }, db);
  const s2 = new Set(r2.map(x => x[0]));
  assert.ok(s2.has('Petr') && s2.has('Evgeny'));
  // invalid reverse attr when not ref
  assert.throws(() => db0.withTx([{ ':name': 'Sergey', ':_parent': 1 }]));
});

test('explode nested maps', () => {
  const schema = { ':profile': { valueType: 'ref' } };
  const db = DB.empty(schema);
  // Case 1
  {
    const { db: d2 } = db.withTx([{ ':db/id': -5, ':name': 'Ivan', ':profile': { ':db/id': -7, ':email': '@2' } }]);
    const e1 = d2.datoms('avet', ':name', 'Ivan')[0].e;
    const e2 = d2.datoms('avet', ':email', '@2')[0].e;
    assert.ok(d2.datoms('eavt', e1, ':profile').some(d => d.v === e2));
  }
  // Case 2
  {
    const { db: d2 } = db.withTx([{ ':name': 'Ivan', ':profile': { ':email': '@2' } }]);
    const e1 = d2.datoms('avet', ':name', 'Ivan')[0].e;
    const e2 = d2.datoms('avet', ':email', '@2')[0].e;
    assert.ok(d2.datoms('eavt', e1, ':profile').some(d => d.v === e2));
  }
  // Case 3
  {
    const { db: d2 } = db.withTx([{ ':profile': { ':email': '@2' } }]);
    const e1 = d2.datoms('avet', ':email', '@2')[0].e;
    const e2 = d2.datoms('eavt', undefined, ':profile');
    // ensure exists some :profile datom linking something to e1
    assert.ok(d2.datoms('avet', ':profile').some(d => d.v === e1));
  }
  // Case 4 reverse
  {
    const { db: d2 } = db.withTx([{ ':email': '@2', ':_profile': { ':name': 'Ivan' } }]);
    const e1 = d2.datoms('avet', ':name', 'Ivan')[0].e;
    const e2 = d2.datoms('avet', ':email', '@2')[0].e;
    assert.ok(d2.datoms('eavt', e1, ':profile').some(d => d.v === e2));
  }
});

test('explode nested maps multi-valued', () => {
  const schema = { ':profile': { valueType: 'ref', card: 'many' } };
  const db = DB.empty(schema);
  // Multi-valued scenarios (spot-check key relationships)
  {
    const { db: d2 } = db.withTx([{ ':db/id': -5, ':name': 'Ivan', ':profile': [ { ':db/id': -7, ':email': '@2' }, { ':db/id': -8, ':email': '@3' } ] }]);
    const e1 = d2.datoms('avet', ':name', 'Ivan')[0].e;
    const e2 = d2.datoms('avet', ':email', '@2')[0].e;
    const e3 = d2.datoms('avet', ':email', '@3')[0].e;
    const profs = d2.datoms('eavt', e1, ':profile').map(d => d.v);
    assert.ok(profs.includes(e2) && profs.includes(e3));
  }
});

test('circular refs via nested maps', () => {
  const cases = [
    { schema: { ':comp': { valueType: 'ref', card: 'many', component: true } } },
    { schema: { ':comp': { valueType: 'ref', card: 'many' } } },
    { schema: { ':comp': { valueType: 'ref', component: true } } },
    { schema: { ':comp': { valueType: 'ref' } } },
  ];
  for (const c of cases) {
    let d = DB.empty(c.schema);
    ({ db: d } = d.withTx([{ ':db/id': -1, ':name': 'Name' }]));
    const root = d.datoms('avet', ':name', 'Name')[0].e;
    ({ db: d } = d.withTx([{ ':db/id': root, ':comp': { ':name': 'C' } }]));
    const child = d.datoms('avet', ':name', 'C')[0].e;
    const link = d.datoms('eavt', root, ':comp').some(dd => dd.v === child);
    assert.ok(link);
  }
});
