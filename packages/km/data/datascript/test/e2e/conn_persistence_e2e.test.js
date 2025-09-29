import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createConn } from '../../src/core/conn.js';
import { saveDBToFile, loadDBFromFile } from '../../src/storage/storage.js';

test('E2E: transact, persist, reload, continue transacting', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsjs-'));
  const file = path.join(tmp, 'db.json');

  const conn1 = createConn();
  const { dbAfter } = conn1.transact([{ ':db/id': -1, ':n': 1 }]);
  const e1 = dbAfter.datoms('aevt', ':n')[0].e;
  await saveDBToFile(dbAfter, file);

  const dbReloaded = await loadDBFromFile(file);
  // Ensure we can continue transacting with incremented ids
  const eMax = Math.max(...dbReloaded.datoms('eavt').map(d => typeof d.e === 'number' ? d.e : 0));
  const { db: db2 } = dbReloaded.withTx([[ '+', -1, ':m', 2 ]]);
  const e2 = db2.datoms('aevt', ':m')[0].e;
  assert.ok(e2 > eMax);
});

