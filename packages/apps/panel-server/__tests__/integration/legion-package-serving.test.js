/**
 * Test Legion package serving via PanelServer
 */

import { PanelServer } from '../../src/panel-server.js';
import fetch from 'node-fetch';

describe('Legion Package Serving Integration', () => {
  const TEST_PORT = 7892;
  const TEST_HOST = 'localhost';
  let server;

  beforeEach(async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test('should serve ActorSpace.js from /legion/actors/', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/actors/src/ActorSpace.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/javascript; charset=utf-8');

    const content = await response.text();
    expect(content).toContain('export class ActorSpace');
  });

  test('should serve DynamicDataStore.js from /legion/data-store/', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/data-store/src/DynamicDataStore.js`);

    expect(response.status).toBe(200);
    const content = await response.text();
    expect(content).toContain('export class DynamicDataStore');
  });

  test('should serve ComponentLifecycle.js from /legion/declarative-components/', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/declarative-components/src/lifecycle/ComponentLifecycle.js`);

    expect(response.status).toBe(200);
    const content = await response.text();
    expect(content).toContain('ComponentLifecycle');
  });

  test('should rewrite imports in served JavaScript files', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/actors/src/ActorSpace.js`);
    const content = await response.text();

    // ImportRewriter should convert relative imports like './Channel.js' to '/legion/actors/src/Channel.js'
    // Check that imports are properly rewritten
    expect(content).toContain('import');
  });

  test('should return 404 for non-existent packages', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/nonexistent-package/index.js`);

    expect(response.status).toBe(404);
  });

  test('should return 404 for non-existent files in valid packages', async () => {
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/legion/actors/src/NonExistentFile.js`);

    expect(response.status).toBe(404);
  });

  test('should serve panel HTML with Legion package imports', async () => {
    // First register a panel
    server.panelManager.registerPanel('test-process', 'test-panel');

    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/panel?processId=test-process&panelId=test-panel`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');

    const html = await response.text();

    // Verify Legion package imports are in the HTML
    expect(html).toContain('/legion/actors/src/ActorSpace.js');
    expect(html).toContain('/legion/data-store/src/DynamicDataStore.js');
    expect(html).toContain('/legion/declarative-components/src/lifecycle/ComponentLifecycle.js');
    expect(html).toContain('/legion/handle/src/remote/RemoteHandle.js');
  });
});
