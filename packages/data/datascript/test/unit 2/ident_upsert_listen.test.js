import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { Conn, createConn } from '../../src/core/conn.js';
import { pull } from '../../src/query/pull.js';

test('ident resolution and pull by ident', () => {
  const schema = {
    ':db/ident': { unique: 'identity', card: 'one' },
  };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':db/ident': ':color/red' },
    { ':db/id': -2, ':db/ident': ':color/blue' },
  ]);
  // Pull by ident directly
  const red = pull(db, [':db/ident'], ':color/red');
  assert.equal(red[':db/ident'], ':color/red');
});

test('upsert via unique identity attribute in map tx', () => {
  const schema = {
    ':person/email': { unique: 'identity', card: 'one' },
    ':person/name': { card: 'one' },
  };
  let { db } = DB.empty(schema).withTx([
    { ':person/email': 'a@x.com', ':person/name': 'Alice' }
  ]);
  // Second tx same email but new name should merge onto same entity (no dup)
  ({ db } = db.withTx([
    { ':person/email': 'a@x.com', ':person/name': 'Alicia' }
  ]));
  const all = Array.from(db.datoms('avet', ':person/email', 'a@x.com'));
  assert.equal(all.length, 1);
  const e = all[0].e;
  const nameDatoms = Array.from(db.datoms('eavt', e, ':person/name'));
  assert.equal(nameDatoms.length, 1);
  assert.equal(nameDatoms[0].v, 'Alicia');
});

test('unique value constraint violation throws', () => {
  const schema = {
    ':person/ssn': { unique: 'value', card: 'one' },
  };
  let { db } = DB.empty(schema).withTx([
    { ':person/ssn': '111-22-3333' }
  ]);
  assert.throws(() => {
    db.withTx([
      { ':person/ssn': '111-22-3333' }
    ]);
  });
});

test('cardinality one enforces single value (replaces)', () => {
  const schema = {
    ':a': { card: 'one' },
  };
  let { db } = DB.empty(schema).withTx([
    ['+', -1, ':a', 1],
  ]);
  ({ db } = db.withTx([
    ['+', 1, ':a', 2],
  ]));
  const vals = Array.from(db.datoms('eavt', 1, ':a'));
  assert.equal(vals.length, 1);
  assert.equal(vals[0].v, 2);
});

test('listen receives tx reports', () => {
  const c = createConn();
  const seen = [];
  c.listen('t', (report) => {
    seen.push({ tx: report.tx, size: report.txData.length });
  });
  c.transact([
    ['+', -1, ':a', 1],
    ['+', -1, ':b', 2],
  ]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].size, 2);
  c.unlisten('t');
});
