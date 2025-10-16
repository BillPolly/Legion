/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import { PanelServer } from '../../src/panel-server.js';

describe('PanelServer Lifecycle Integration', () => {
  const TEST_PORT = 7890;
  const TEST_HOST = 'localhost';
  let server;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    // Give time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  test('should complete full start/stop cycle', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);

    // Start server
    await server.start();

    // Verify all components initialized
    expect(server.server).not.toBeNull();
    expect(server.actorSpace).not.toBeNull();
    expect(server.panelManager).not.toBeNull();
    expect(server.processWss).not.toBeNull();
    expect(server.panelWss).not.toBeNull();

    // Verify health endpoint works
    const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
    expect(response.status).toBe(200);

    // Stop server
    await server.stop();

    // Verify cleanup
    expect(server.server).toBeNull();
    expect(server.actorSpace).toBeNull();
    expect(server.processWss).toBeNull();
    expect(server.panelWss).toBeNull();
  });

  test('should handle multiple start/stop cycles', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);

    // Cycle 1
    await server.start();
    let response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
    expect(response.status).toBe(200);
    await server.stop();

    // Cycle 2
    await server.start();
    response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
    expect(response.status).toBe(200);
    await server.stop();

    // Cycle 3
    await server.start();
    response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
    expect(response.status).toBe(200);
    await server.stop();
  });

  test('should initialize ActorSpace correctly', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();

    expect(server.actorSpace).not.toBeNull();
    expect(server.actorSpace.spaceId).toBe('panel-server');
  });

  test('should create WebSocket servers on correct paths', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();

    // WebSocket servers should be listening
    expect(server.processWss).not.toBeNull();
    expect(server.panelWss).not.toBeNull();

    // Verify paths by checking internal options
    expect(server.processWss.options.path).toBe('/ws/process');
    expect(server.panelWss.options.path).toBe('/ws/panel');
  });

  test('should handle graceful shutdown with no active connections', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();

    // No connections, just stop
    await expect(server.stop()).resolves.toBeUndefined();

    // Verify cleanup
    expect(server.processConnections.size).toBe(0);
    expect(server.panelConnections.size).toBe(0);
  });

  test('should not double-start', async () => {
    const logs = [];
    server = new PanelServer(TEST_PORT, TEST_HOST, (msg) => logs.push(msg));

    await server.start();
    await server.start(); // Second start should be no-op

    expect(logs.filter((msg) => msg.includes('already running'))).toHaveLength(1);
  });

  test('should allow stop when never started', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);

    // Should not throw
    await expect(server.stop()).resolves.toBeUndefined();
  });

  test('should release port after stop', async () => {
    server = new PanelServer(TEST_PORT, TEST_HOST);
    await server.start();
    await server.stop();

    // Port should be free - starting new server should work
    const server2 = new PanelServer(TEST_PORT, TEST_HOST);
    await expect(server2.start()).resolves.toBeUndefined();
    await server2.stop();
  });
});
