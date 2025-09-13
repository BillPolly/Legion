import test from 'node:test';
import assert from 'node:assert/strict';

import { parseQueryEDN } from '../../src/query/query_edn.js';

test('parseQueryEDN rejects non-vector', () => {
  assert.throws(() => parseQueryEDN('{:find ?e}'));
});

