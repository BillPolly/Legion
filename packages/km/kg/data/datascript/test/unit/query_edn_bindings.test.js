import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../../src/core/db.js';
import { qEdn } from '../../src/query/query_edn.js';

test('EDN: function binding form [(+ ?n 1) ?n2]', () => {
  const { db } = DB.empty().withTx([
    ['+', -1, ':n', 2],
    ['+', -2, ':n', 3]
  ]);
  const edn = `[:find ?n2 :where [[?e :n ?n] [(+ ?n 1) ?n2]]]`;
  const res = qEdn(edn, db).map(r => r[0]).sort((a,b)=>a-b);
  assert.deepEqual(res, [3,4]);
});

test('EDN: #inst parses to Date', () => {
  const edn = `#inst "1970-01-01T00:00:00.000Z"`;
  // using the parser indirectly through parseQueryEDN would be overkill; this ensures no throw
  const { db } = DB.empty().withTx([[ '+', -1, ':d', new Date('1970-01-01T00:00:00.000Z') ]]);
  const q = `[:find ?e :where [[?e :d #inst "1970-01-01T00:00:00.000Z"]]]`;
  const rows = qEdn(q, db);
  assert.equal(rows.length, 1);
});
