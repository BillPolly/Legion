import test from 'node:test';
import assert from 'node:assert/strict';

import { qV3 } from '../../src/query/query_v3.js';

test('query_v3 validation: arity and source collection checks', () => {
  const arity1 = `[:find ?a :in $ ?a]`;
  assert.throws(() => qV3(arity1, 0), /Wrong number of arguments/);

  const arity2 = `[:find ?a :in $ :where [?a]]`;
  assert.throws(() => qV3(arity2, 0, 1), /Wrong number of arguments/);

  const arityDefault = `[:find ?a :where [?a]]`;
  assert.throws(() => qV3(arityDefault, 0, 1), /Wrong number of arguments/);

  const notColl = `[:find ?a :where [?a 1]]`;
  assert.throws(() => qV3(notColl, ':a'), /source is not a collection/);
});
