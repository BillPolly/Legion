import test from 'node:test';
import assert from 'node:assert/strict';

import { createConn } from '../../src/core/conn.js';
import { ConstraintError } from '../../src/core/conn.js';

test('transactChecked does not mutate on failure', () => {
  const conn = createConn();
  const db0 = conn.db();
  const validator = ({ dbAfter }) => {
    // Reject any tx that sets :n to a value less than 10
    const ds = dbAfter.datoms('aevt', ':n');
    if (ds.length && ds[0].v < 10) return 'n must be >= 10';
  };
  try {
    conn.transactChecked([[ '+', -1, ':n', 1 ]], validator);
    assert.fail('expected constraint error');
  } catch (e) {
    assert.equal(e instanceof ConstraintError, true);
    assert.equal(conn.db(), db0, 'root DB unchanged');
    assert.equal(conn.db().datoms('aevt', ':n').length, 0);
  }
});

test('transactChecked commits on success', () => {
  const conn = createConn();
  const validator = ({ dbAfter }) => {
    const ds = dbAfter.datoms('aevt', ':n');
    if (ds.length && ds[0].v < 10) return 'n must be >= 10';
  };
  const { dbAfter } = conn.transactChecked([[ '+', -1, ':n', 42 ]], validator);
  assert.equal(dbAfter.datoms('aevt', ':n')[0].v, 42);
});

