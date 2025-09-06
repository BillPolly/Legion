import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';

test('tuple attribute auto-populates and updates', () => {
  const schema = {
    ':a+b+c': { tupleAttrs: [':a', ':b', ':c'], card: 'one' }
  };
  let { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':a': 'a', ':b': 'b' }
  ]);
  const e = db.datoms('avet', ':a', 'a')[0].e;
  let tup = db.datoms('eavt', e, ':a+b+c')[0].v;
  assert.deepEqual(tup, ['a', 'b', null]);

  ({ db } = db.withTx([
    { ':db/id': e, ':a': 'A', ':b': 'B', ':c': 'c' }
  ]));
  tup = db.datoms('eavt', e, ':a+b+c')[0].v;
  assert.deepEqual(tup, ['A', 'B', 'c']);

  ({ db } = db.withTx([
    ['-', e, ':a', 'A'],
    ['-', e, ':b', 'B'],
    ['-', e, ':c', 'c']
  ]));
  assert.equal(db.datoms('eavt', e, ':a+b+c').length, 0);
});

test('cannot modify tuple attribute directly', () => {
  const schema = {
    ':a+b': { tupleAttrs: [':a', ':b'], card: 'one' }
  };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':a': 'a', ':b': 'b' }
  ]);
  const e = db.datoms('avet', ':a', 'a')[0].e;
  assert.throws(() => {
    db.withTx([[ '+', e, ':a+b', ['x','y'] ]]);
  });
});

test('tuple unique value constraint', () => {
  const schema = {
    ':a+b': { tupleAttrs: [':a', ':b'], unique: 'value' }
  };
  let { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':a': 'a', ':b': 'b' },
    { ':db/id': -2, ':a': 'A', ':b': 'B' },
  ]);
  assert.throws(() => {
    db.withTx([{ ':db/id': -3, ':a': 'a', ':b': 'b' }]);
  });
});

test('lookup-ref via tuple unique identity', () => {
  const schema = {
    ':a+b': { tupleAttrs: [':a', ':b'], unique: 'identity' }
  };
  const { db } = DB.empty(schema).withTx([
    { ':db/id': -1, ':a': 'a', ':b': 'b' }
  ]);
  const e1 = db.entity([':a+b', ['a','b']]);
  assert.equal(e1[':a'], 'a');
});

