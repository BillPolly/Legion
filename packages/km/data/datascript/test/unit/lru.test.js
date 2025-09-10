import test from 'node:test';
import assert from 'node:assert/strict';

import { lru, lruAssoc, lruGet, cache, _get } from '../../src/utils/lru.js';

test('LRU basic assoc/get semantics', () => {
  const l0 = lru(2);
  const l1 = lruAssoc(l0, 'a', 1);
  const l2 = lruAssoc(l1, 'b', 2);
  const l3 = lruAssoc(l2, 'c', 3); // evicts 'a'
  const l4 = lruAssoc(l3, 'b', 4); // touches 'b', but keeps value 2
  const l5 = lruAssoc(l4, 'd', 5); // evicts oldest among {'b','c'} -> 'c'

  assert.equal(lruGet(l0, 'a'), undefined);
  assert.equal(lruGet(l1, 'a'), 1);
  assert.equal(lruGet(l2, 'a'), 1);
  assert.equal(lruGet(l2, 'b'), 2);
  assert.equal(lruGet(l3, 'a'), undefined);
  assert.equal(lruGet(l3, 'b'), 2);
  assert.equal(lruGet(l3, 'c'), 3);
  assert.equal(lruGet(l4, 'b'), 2);
  assert.equal(lruGet(l4, 'c'), 3);
  assert.equal(lruGet(l5, 'b'), 2);
  assert.equal(lruGet(l5, 'c'), undefined);
  assert.equal(lruGet(l5, 'd'), 5);
});

test('cache memoization respects LRU eviction and compute counts', () => {
  const c = cache(2);
  let a = 0, b = 0, d = 0;
  const af = () => { a++; return 1; };
  const bf = () => { b++; return 2; };
  const df = () => { d++; return 3; };

  assert.equal(_get(c, 'a', af), 1);
  assert.equal(_get(c, 'b', bf), 2);
  assert.equal(_get(c, 'a', af), 1); // a newer
  assert.equal(_get(c, 'd', df), 3); // evicts b
  assert.equal(_get(c, 'b', bf), 2); // recompute b

  assert.equal(a, 1);
  assert.equal(b, 2);
  assert.equal(d, 1);
});

