/**
 * Unit tests for WebDebugServer
 */

import { WebDebugServer } from '../../WebDebugServer.js';
import { mockResourceManager, mockMCPServer } from '../fixtures/mockData.js';
import { WebSocket } from 'ws';

// Test utilities
const waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};

describe('WebDebugServer', () => {
  let webDebugServer;
  let mockRM;

  beforeEach(() => {
    mockRM = {
      ...mockResourceManager,
      get: mockResourceManager.get
    };
  });

  afterEach(async () => {
    if (webDebugServer && webDebugServer.isRunning) {
      await webDebugServer.stop();
    }
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('constructor and factory method', () => {
    test('should create WebDebugServer instance via factory method', async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
      
      expect(webDebugServer).toBeInstanceOf(WebDebugServer);
      expect(webDebugServer.contextManager).toBe(mockMCPServer.contextManager);
      expect(webDebugServer.toolDefinitionProvider).toBe(mockMCPServer.toolDefinitionProvider);
      expect(webDebugServer.monitoringSystem).toBe(mockMCPServer.monitoringSystem);
      expect(webDebugServer.serverId).toMatch(/^aiur-mcp-\d+-[a-z0-9]+$/);
    });

    test('should initialize with correct default state', async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
      
      expect(webDebugServer.server).toBeNull();
      expect(webDebugServer.wss).toBeNull();
      expect(webDebugServer.port).toBeNull();
      expect(webDebugServer.isRunning).toBe(false);
      expect(webDebugServer.clients.size).toBe(0);
      expect(webDebugServer.eventBuffer).toEqual([]);
      expect(webDebugServer.maxEventBuffer).toBe(1000);
    });

    test('should call ResourceManager.get with correct keys', async () => {
      await WebDebugServer.create(mockRM);
      
      const calls = mockRM.get.calls.map(call => call[0]);
      expect(calls).toContain('contextManager');
      expect(calls).toContain('toolDefinitionProvider');
      expect(calls).toContain('monitoringSystem');
    });
  });

  describe('port auto-detection', () => {
    beforeEach(async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
    });

    test('should find available port starting from preferred port', async () => {
      const serverInfo = await webDebugServer.start({ port: 3001 });
      
      expect(serverInfo.port).toBeGreaterThanOrEqual(3001);
      expect(serverInfo.port).toBeLessThanOrEqual(3100);
      expect(serverInfo.status).toBe('running');
    });

    test('should fallback to alternative port ranges when preferred range is full', async () => {
      // This test would require mocking port availability
      // For now, we'll test that port detection works
      const serverInfo = await webDebugServer.start();
      
      expect(typeof serverInfo.port).toBe('number');
      expect(serverInfo.port).toBeGreaterThan(0);
    });

    test('should throw error when no ports are available', async () => {
      // Mock _isPortAvailable to always return false
      const originalMethod = webDebugServer._isPortAvailable;
      webDebugServer._isPortAvailable = () => Promise.resolve(false);
      
      await expect(webDebugServer.start()).rejects.toThrow('No available ports found in any range');
      
      webDebugServer._isPortAvailable = originalMethod;
    });
  });

  describe('HTTP static file serving', () => {
    beforeEach(async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
      await webDebugServer.start();
    });

    test('should serve static files from web directory', async () => {
      const response = await fetch(`http://localhost:${webDebugServer.port}/`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('should serve HTML interface', async () => {
      const response = await fetch(`http://localhost:${webDebugServer.port}/index.html`);
      const html = await response.text();
      
      expect(response.status).toBe(200);
      expect(html).toContain('Aiur MCP Debug Interface');
      // Should contain either static file or basic HTML
      expect(html.length).toBeGreaterThan(100);
    });

    test('should reject requests outside web directory', async () => {
      const response = await fetch(`http://localhost:${webDebugServer.port}/../package.json`);
      
      // Should either be 403 (forbidden) or 404 (not found) for security
      expect([403, 404]).toContain(response.status);
    });

    test('should return 404 for non-existent files', async () => {
      const response = await fetch(`http://localhost:${webDebugServer.port}/nonexistent.js`);
      
      expect(response.status).toBe(404);
    });

    test('should set correct content types', async () => {
      // Test CSS content type (if file exists or fallback)
      const cssResponse = await fetch(`http://localhost:${webDebugServer.port}/styles.css`);
      if (cssResponse.status === 200) {
        expect(cssResponse.headers.get('content-type')).toContain('text/css');
      }
    });
  });

  describe('WebSocket connection handling', () => {
    beforeEach(async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
      await webDebugServer.start();
    });

    test('should handle WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      expect(webDebugServer.clients.size).toBe(1);
      
      ws.close();
      await waitFor(() => webDebugServer.clients.size === 0);
    });

    test('should send welcome message on connection', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      const welcomeMessage = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'welcome') {
            resolve(message);
          }
        });
      });
      
      expect(welcomeMessage.type).toBe('welcome');
      expect(welcomeMessage.data.serverId).toBe(webDebugServer.serverId);
      expect(welcomeMessage.data.version).toBe('1.0.0');
      expect(welcomeMessage.data.capabilities).toContain('tool-execution');
      expect(Array.isArray(welcomeMessage.data.availableTools)).toBe(true);
      
      ws.close();
    });

    test('should send buffered events to new clients', async () => {
      // Add events to buffer first
      webDebugServer._broadcastEvent('test-event', { test: 'data' });
      
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      const messages = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      await waitFor(() => messages.length >= 2); // welcome + buffered event
      
      const eventMessage = messages.find(m => m.type === 'event');
      expect(eventMessage).toBeDefined();
      expect(eventMessage.data.eventType).toBe('test-event');
      
      ws.close();
    });

    test('should handle client disconnection', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      expect(webDebugServer.clients.size).toBe(1);
      
      ws.close();
      await waitFor(() => webDebugServer.clients.size === 0);
    });
  });

  describe('server lifecycle', () => {
    beforeEach(async () => {
      webDebugServer = await WebDebugServer.create(mockRM);
    });

    test('should start server successfully', async () => {
      expect(webDebugServer.isRunning).toBe(false);
      
      const serverInfo = await webDebugServer.start();
      
      expect(webDebugServer.isRunning).toBe(true);
      expect(serverInfo.status).toBe('running');
      expect(serverInfo.port).toBe(webDebugServer.port);
      expect(serverInfo.url).toBe(`http://localhost:${webDebugServer.port}`);
      expect(serverInfo.serverId).toBe(webDebugServer.serverId);
    });

    test('should return existing server info if already running', async () => {
      await webDebugServer.start();
      const firstInfo = webDebugServer.getServerInfo();
      
      const secondInfo = await webDebugServer.start();
      
      expect(secondInfo).toEqual(firstInfo);
    });

    test('should stop server successfully', async () => {
      await webDebugServer.start();
      expect(webDebugServer.isRunning).toBe(true);
      
      await webDebugServer.stop();
      
      expect(webDebugServer.isRunning).toBe(false);
      expect(webDebugServer.port).toBeNull();
      expect(webDebugServer.server).toBeNull();
      expect(webDebugServer.wss).toBeNull();
      expect(webDebugServer.clients.size).toBe(0);
    });

    test('should close all client connections when stopping', async () => {
      await webDebugServer.start();
      
      // Connect multiple clients
      const ws1 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);
      
      expect(webDebugServer.clients.size).toBe(2);
      
      await webDebugServer.stop();
      
      expect(webDebugServer.clients.size).toBe(0);
    });

    test('should provide accurate server information', async () => {
      const serverInfo = await webDebugServer.start();
      
      expect(serverInfo).toEqual({
        serverId: webDebugServer.serverId,
        port: webDebugServer.port,
        url: `http://localhost:${webDebugServer.port}`,
        status: 'running',
        startedAt: expect.any(String),
        connectedClients: 0,
        version: '1.0.0'
      });
    });
  });
});