import test from 'node:test';
import assert from 'node:assert/strict';

import { qEdn } from '../../src/query/query_edn.js';

const monsters = [["Medusa",1],["Cyclops",1],["Chimera",1]];

test('EDN aggregates: with, sum, count', () => {
  const r1 = qEdn('[:find ?heads :with ?monster :in [[?monster ?heads]]]', null, monsters);
  assert.deepEqual(r1, [[1],[1],[1]]);
  const r2 = qEdn('[:find (sum ?heads) :in [[?monster ?heads]]]', null, monsters);
  assert.deepEqual(r2, [[3]]);
});

test('EDN aggregates: min/max with k and median/variance/stddev', () => {
  const r3 = qEdn('[:find (min ?x) (max ?x) :in [?x ...]]', null, [':a-/b', ':a/b']);
  assert.deepEqual(r3, [[":a/b", ":a-/b"]]);
  const r4 = qEdn('[:find (min 2 ?x) (max 2 ?x) :in [?x ...]]', null, [':a/b', ':a-/b', ':a/c']);
  assert.deepEqual(r4, [[[":a-/b", ":a/b"],[":a/c", ":a/b"]]]);
  const nums = [10,15,20,35,75];
  const m  = qEdn('[:find (median ?x) :in [?x ...]]', null, nums);
  assert.equal(m[0][0], 20);
  const v  = qEdn('[:find (variance ?x) :in [?x ...]]', null, nums);
  assert.equal(Math.round(v[0][0]), 554);
  const sd = qEdn('[:find (stddev ?x) :in [?x ...]]', null, nums);
  assert.ok(Math.abs(sd[0][0] - 23.5372) < 1e-3);
});

test('EDN aggregates: custom aggregate function', () => {
  const data = [["red",1],["red",2],["blue",7]];
  const sortRev = (xs) => xs.slice().sort((a,b)=>a-b).reverse();
  const res = new Set(qEdn('[:find ?color (aggregate ?agg ?x) :in [[?color ?x]] ?agg]', null, data, sortRev).map(JSON.stringify));
  assert.ok(res.has(JSON.stringify(["red", [2,1]])) && res.has(JSON.stringify(["blue", [7]])));
});

