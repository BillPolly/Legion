import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { createConn } from '../../src/core/conn.js';

test('transact using lookup-ref as entity id', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':user/email': 'a@x.com' }
  ]);
  // second tx: reference same entity via lookup-ref in E position
  const { db: db2 } = db.withTx([
    ['+', [':user/email', 'a@x.com'], ':name', 'Alice']
  ]);
  const e = db2.datoms('avet', ':user/email', 'a@x.com')[0].e;
  const name = db2.datoms('eavt', e, ':name')[0].v;
  assert.equal(name, 'Alice');
});

test('transact using lookup-ref as value (ref attr)', () => {
  const { db } = DB.empty({ ':friend': { card: 'one' } }).withTx([
    { ':db/id': -1, ':name': 'Alice' },
    { ':db/id': -2, ':name': 'Bob' },
  ]);
  const { db: db2 } = db.withTx([
    ['+', [':name','Alice'], ':friend', [':name','Bob']]
  ]);
  const a = db2.datoms('avet', ':name', 'Alice')[0].e;
  const f = db2.datoms('eavt', a, ':friend')[0].v;
  const fname = db2.datoms('eavt', f, ':name')[0].v;
  assert.equal(fname, 'Bob');
});

test('retract using lookup-ref on value', () => {
  const { db } = DB.empty().withTx([
    { ':db/id': -1, ':name': 'Alice', ':aka': 'Al' },
  ]);
  const { db: db2 } = db.withTx([
    ['-', [':name','Alice'], ':aka', 'Al']
  ]);
  assert.equal(db2.datoms('eavt', 1, ':aka').length, 0);
});

test('entity() resolves lookup-ref and ident', () => {
  const schema = { ':db/ident': { unique: 'identity', card: 'one' } };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':db/ident': ':thing/A', ':name': 'A' }
  ]);
  const e1 = db.entity([':db/ident', ':thing/A']);
  const e2 = db.entity(':thing/A');
  assert.equal(e1[':name'], 'A');
  assert.equal(e2[':name'], 'A');
});

test('transacting with missing lookup-ref throws', () => {
  const conn = createConn();
  assert.throws(() => {
    conn.transact([
      ['+', [':email','missing@example.com'], ':x', 1]
    ]);
  });
});

