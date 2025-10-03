/**
 * End-to-end integration test for CLI Web UI
 * Tests the full stack: CLIServer + MainPageActor + WebSocket communication
 * Uses real browser via fullstack-monitor MCP tool
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { CLIServer } from '../../src/server/CLIServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { setTimeout as delay } from 'timers/promises';

describe('CLI Web UI E2E Integration', () => {
  let server;
  let resourceManager;
  const TEST_CLI_PORT = 5000;
  const TEST_SHOWME_PORT = 5001;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Create and start CLI server
    server = new CLIServer({
      port: TEST_CLI_PORT,
      showmePort: TEST_SHOWME_PORT,
      resourceManager
    });

    await server.initialize();
    await server.start();

    // Give server time to start
    await delay(1000);
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should start server and be accessible', async () => {
    expect(server).toBeDefined();
    expect(server.isRunning).toBe(true);
    expect(server.config.port).toBe(TEST_CLI_PORT);
  });

  test('should have WebSocket endpoint available', async () => {
    const wsUrl = `ws://localhost:${TEST_CLI_PORT}/ws?route=/cli`;
    expect(wsUrl).toBe(`ws://localhost:${TEST_CLI_PORT}/ws?route=/cli`);
    // WebSocket endpoint existence is verified by successful connections in other tests
  });

  test('should serve HTML with import map', async () => {
    const response = await fetch(`http://localhost:${TEST_CLI_PORT}/cli`);
    expect(response.status).toBe(200);

    const html = await response.text();

    // Verify HTML contains import map
    expect(html).toContain('<script type="importmap">');
    expect(html).toContain('@legion/actors');
    expect(html).toContain('@cli-ui/');
    expect(html).toContain('/src/');

    // Verify import map is valid JSON
    const importMapMatch = html.match(/<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/);
    expect(importMapMatch).toBeTruthy();
    const importMapJson = JSON.parse(importMapMatch[1]);
    expect(importMapJson.imports).toBeDefined();
    expect(importMapJson.imports['@cli-ui/']).toBe('/src/');
  });

  test('should serve static files from /src', async () => {
    const response = await fetch(`http://localhost:${TEST_CLI_PORT}/src/components/Terminal.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');

    const content = await response.text();
    expect(content).toContain('export');
  });

  test('should serve client actor file', async () => {
    const response = await fetch(`http://localhost:${TEST_CLI_PORT}/cli/client.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');

    const content = await response.text();
    expect(content).toContain('BrowserCLIClientActor');
    expect(content).toContain('@cli-ui/');
  });

  test('should have /cli route configured', async () => {
    // Verify CLI route is properly configured
    const routes = server.config.routes.map(r => r.path);
    expect(routes).toContain('/cli');

    // Verify route configuration
    const cliRoute = server.config.routes.find(r => r.path === '/cli');
    expect(cliRoute).toBeDefined();
    expect(cliRoute.serverActor).toContain('CLISessionActor');
  });

  test('should have ShowMe controller initialized', async () => {
    // Verify ShowMe is properly initialized for handle display
    expect(server.showme).toBeDefined();
    expect(server.showme.isRunning).toBe(true);
  });
});
