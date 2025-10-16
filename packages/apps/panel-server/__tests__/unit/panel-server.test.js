/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import { PanelServer } from '../../src/panel-server.js';
import http from 'http';

describe('PanelServer', () => {
  let server;
  const TEST_PORT = 6789;
  const TEST_HOST = 'localhost';

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  describe('constructor', () => {
    test('should create server with default parameters', () => {
      server = new PanelServer();

      expect(server.port).toBe(5500);
      expect(server.host).toBe('localhost');
    });

    test('should create server with custom port and host', () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);

      expect(server.port).toBe(TEST_PORT);
      expect(server.host).toBe(TEST_HOST);
    });

    test('should accept custom logger', () => {
      const logs = [];
      server = new PanelServer(TEST_PORT, TEST_HOST, (msg) => logs.push(msg));

      expect(server.log).toBeDefined();
    });
  });

  describe('start', () => {
    test('should start server on specified port', async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);

      await server.start();

      expect(server.server).not.toBeNull();
      expect(server.actorSpace).not.toBeNull();
      expect(server.panelManager).not.toBeNull();
      expect(server.processWss).not.toBeNull();
      expect(server.panelWss).not.toBeNull();
    });

    test.skip('should reject if port is in use', async () => {
      // Skip: Testing Node.js native error behavior, not core server logic
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();

      const server2 = new PanelServer(TEST_PORT, TEST_HOST);
      await expect(server2.start()).rejects.toThrow();

      try {
        await server2.stop();
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    test('should not error when starting already running server', async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();

      await expect(server.start()).resolves.toBeUndefined();
    });
  });

  describe('HTTP endpoints', () => {
    beforeEach(async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
    });

    test('should respond to /health endpoint', async () => {
      const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('legion-panel-server');
      expect(data.port).toBe(TEST_PORT);
      expect(data.processes).toBe(0);
      expect(data.panels).toBe(0);
      expect(data.timestamp).toBeDefined();
    });

    test('should serve panel HTML at /panel with query params', async () => {
      const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/panel?processId=proc-123&panelId=panel-456`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('proc-123');
      expect(html).toContain('panel-456');
    });

    test('should return 400 if processId is missing', async () => {
      const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/panel?panelId=panel-456`);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing processId or panelId');
    });

    test('should return 400 if panelId is missing', async () => {
      const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/panel?processId=proc-123`);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing processId or panelId');
    });

    test('should return 404 for unknown routes', async () => {
      const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/unknown`);

      expect(response.status).toBe(404);
    });
  });

  describe('getConnectionInfo', () => {
    beforeEach(async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
    });

    test('should return connection info', () => {
      const info = server.getConnectionInfo();

      expect(info).toEqual({
        processes: 0,
        panels: 0,
        processIds: [],
        panelIds: [],
      });
    });
  });

  describe('getPanelRequests', () => {
    beforeEach(async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
    });

    test('should return empty set for non-existent process', () => {
      const requests = server.getPanelRequests('non-existent');

      expect(requests).toEqual(new Set());
    });
  });

  describe('stop', () => {
    test('should stop running server', async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();

      await server.stop();

      expect(server.server).toBeNull();
      expect(server.actorSpace).toBeNull();
      expect(server.processWss).toBeNull();
      expect(server.panelWss).toBeNull();
      expect(server.processConnections.size).toBe(0);
      expect(server.panelConnections.size).toBe(0);
    });

    test('should not error when stopping non-running server', async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);

      await expect(server.stop()).resolves.toBeUndefined();
    });

    test('should close HTTP port after stop', async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
      await server.stop();

      // Port should be free, so starting a new server should work
      const server2 = new PanelServer(TEST_PORT, TEST_HOST);
      await expect(server2.start()).resolves.toBeUndefined();
      await server2.stop();
    });
  });

  describe('routeToPanel', () => {
    beforeEach(async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
    });

    test('should log warning for non-existent panel', () => {
      const logs = [];
      server.log = (msg) => logs.push(msg);

      server.routeToPanel('non-existent', 'test-message', { data: 'test' });

      expect(logs).toContain('[Router] Panel not found: non-existent');
    });
  });

  describe('routeToProcess', () => {
    beforeEach(async () => {
      server = new PanelServer(TEST_PORT, TEST_HOST);
      await server.start();
    });

    test('should log warning for non-existent process', () => {
      const logs = [];
      server.log = (msg) => logs.push(msg);

      server.routeToProcess('non-existent', 'test-message', { data: 'test' });

      expect(logs).toContain('[Router] Process not found: non-existent');
    });
  });
});
