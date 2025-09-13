import test from 'node:test';
import assert from 'node:assert/strict';
import { Index } from '../../src/core/indexes.js';
import { datom } from '../../src/core/datom.js';

test('Index add/remove maintains order and immutability', () => {
  const idx0 = new Index('eavt');
  const d1 = datom(1, ':a', 1, 1, true);
  const d2 = datom(2, ':a', 1, 1, true);
  const idx1 = idx0.add(d2);
  const idx2 = idx1.add(d1);
  assert.equal(idx0.size(), 0);
  assert.equal(idx1.size(), 1);
  assert.equal(idx2.size(), 2);
  assert.deepEqual(idx2.all().map(d => d.e), [1,2]);
  const idx3 = idx2.remove(d1);
  assert.deepEqual(idx3.all().map(d => d.e), [2]);
});

