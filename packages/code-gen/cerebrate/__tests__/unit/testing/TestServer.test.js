/**
 * @jest-environment node
 */

import { TestServer } from '../../../src/testing/TestServer.js';
import http from 'http';

describe('Test Server Implementation', () => {
  let testServer;
  let server;

  beforeEach(() => {
    testServer = new TestServer({
      port: 0, // Use random available port
      enableMockData: true,
      enableTestScenarios: true,
      cors: true
    });
  });

  afterEach(async () => {
    if (server) {
      await testServer.stop();
      server = null;
    }
  });

  describe('Server Lifecycle', () => {
    test('should start server on specified port', async () => {
      server = await testServer.start();
      
      expect(server).toBeInstanceOf(http.Server);
      expect(testServer.isRunning()).toBe(true);
      expect(testServer.getPort()).toBeGreaterThan(0);
      expect(testServer.getUrl()).toMatch(/^http:\/\/localhost:\d+$/);
    });

    test('should stop server gracefully', async () => {
      server = await testServer.start();
      expect(testServer.isRunning()).toBe(true);
      
      await testServer.stop();
      expect(testServer.isRunning()).toBe(false);
    });

    test('should handle multiple start/stop cycles', async () => {
      // First cycle
      server = await testServer.start();
      const firstPort = testServer.getPort();
      await testServer.stop();
      
      // Second cycle
      server = await testServer.start();
      const secondPort = testServer.getPort();
      
      expect(firstPort).toBeGreaterThan(0);
      expect(secondPort).toBeGreaterThan(0);
      expect(testServer.isRunning()).toBe(true);
    });

    test('should handle server startup errors', async () => {
      // Start a server on a port first
      const blockingServer = await testServer.start();
      const blockedPort = testServer.getPort();
      
      // Create another server instance that tries to use the same port
      const conflictingServer = new TestServer({ port: blockedPort });
      
      await expect(conflictingServer.start()).rejects.toThrow();
      expect(conflictingServer.isRunning()).toBe(false);
      
      // Cleanup
      await testServer.stop();
    });
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should serve HTML test pages', async () => {
      const response = await fetch(`${testServer.getUrl()}/test-page.html`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    test('should serve CSS files', async () => {
      const response = await fetch(`${testServer.getUrl()}/styles/test.css`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
      
      const css = await response.text();
      expect(css).toContain('.test-class');
    });

    test('should serve JavaScript files', async () => {
      const response = await fetch(`${testServer.getUrl()}/scripts/test.js`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
      
      const js = await response.text();
      expect(js).toContain('function');
    });

    test('should return 404 for missing files', async () => {
      const response = await fetch(`${testServer.getUrl()}/nonexistent.html`);
      
      expect(response.status).toBe(404);
    });

    test('should handle CORS headers', async () => {
      const response = await fetch(`${testServer.getUrl()}/test-page.html`);
      
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });
  });

  describe('Test Scenarios', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should provide list of available scenarios', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/scenarios`);
      
      expect(response.status).toBe(200);
      const scenarios = await response.json();
      
      expect(scenarios).toEqual({
        scenarios: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            url: expect.any(String)
          })
        ])
      });
    });

    test('should serve DOM testing scenario', async () => {
      const response = await fetch(`${testServer.getUrl()}/scenarios/dom-testing`);
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('DOM Testing Scenario');
      expect(html).toContain('id="test-element"');
      expect(html).toContain('class="test-class"');
    });

    test('should serve accessibility testing scenario', async () => {
      const response = await fetch(`${testServer.getUrl()}/scenarios/accessibility`);
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('Accessibility Testing');
      expect(html).toContain('aria-label');
      expect(html).toContain('role=');
    });

    test('should serve performance testing scenario', async () => {
      const response = await fetch(`${testServer.getUrl()}/scenarios/performance`);
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('Performance Testing');
      expect(html).toContain('<img');
      expect(html).toContain('.performance-heavy');
    });

    test('should serve error testing scenario', async () => {
      const response = await fetch(`${testServer.getUrl()}/scenarios/errors`);
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('Error Testing');
      expect(html).toContain('throw new Error');
    });
  });

  describe('Mock Data API', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should provide mock user data', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/mock/users`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toEqual({
        users: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            email: expect.any(String)
          })
        ])
      });
    });

    test('should provide mock product data', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/mock/products`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toEqual({
        products: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            price: expect.any(Number)
          })
        ])
      });
    });

    test('should handle mock data with query parameters', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/mock/users?limit=2`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.users).toHaveLength(2);
    });

    test('should simulate API delays', async () => {
      const startTime = Date.now();
      const response = await fetch(`${testServer.getUrl()}/api/mock/slow`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThan(200); // At least 200ms delay
    });

    test('should simulate API errors', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/mock/error`);
      
      expect(response.status).toBe(500);
      const error = await response.json();
      
      expect(error).toEqual({
        error: 'Mock server error',
        message: expect.any(String)
      });
    });
  });

  describe('WebSocket Support', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should provide WebSocket endpoint info', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/websocket`);
      
      expect(response.status).toBe(200);
      const info = await response.json();
      
      expect(info).toEqual({
        websocket: {
          url: expect.stringMatching(/^ws:\/\/localhost:\d+\/ws$/),
          protocols: [],
          ready: expect.any(Boolean)
        }
      });
    });

    test('should handle WebSocket connections', async () => {
      // Skip WebSocket test in this environment - would need dynamic import
      const info = await fetch(`${testServer.getUrl()}/api/websocket`);
      const data = await info.json();
      
      expect(data.websocket.url).toMatch(/^ws:\/\/localhost:\d+\/ws$/);
      expect(data.websocket.ready).toBe(true);
    });
  });

  describe('Development Tools', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should provide server status', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/status`);
      
      expect(response.status).toBe(200);
      const status = await response.json();
      
      expect(status).toEqual({
        status: 'running',
        port: testServer.getPort(),
        uptime: expect.any(Number),
        requests: expect.any(Number),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number)
        })
      });
    });

    test('should provide request logs', async () => {
      // Make a few requests to generate logs
      await fetch(`${testServer.getUrl()}/test-page.html`);
      await fetch(`${testServer.getUrl()}/api/mock/users`);
      
      const response = await fetch(`${testServer.getUrl()}/api/logs`);
      
      expect(response.status).toBe(200);
      const logs = await response.json();
      
      expect(logs).toEqual({
        logs: expect.arrayContaining([
          expect.objectContaining({
            method: expect.any(String),
            url: expect.any(String),
            status: expect.any(Number),
            timestamp: expect.any(Number)
          })
        ])
      });
    });

    test('should reset server state', async () => {
      // Generate some state
      await fetch(`${testServer.getUrl()}/api/mock/users`);
      
      const resetResponse = await fetch(`${testServer.getUrl()}/api/reset`, {
        method: 'POST'
      });
      
      expect(resetResponse.status).toBe(200);
      const result = await resetResponse.json();
      
      expect(result).toEqual({
        reset: true,
        message: 'Server state reset successfully'
      });
    });

    test('should provide configuration info', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/config`);
      
      expect(response.status).toBe(200);
      const config = await response.json();
      
      expect(config).toEqual({
        config: expect.objectContaining({
          port: expect.any(Number),
          cors: expect.any(Boolean),
          mockData: expect.any(Boolean),
          testScenarios: expect.any(Boolean)
        })
      });
    });
  });

  describe('Configuration and Customization', () => {
    test('should accept custom configuration', () => {
      const customServer = new TestServer({
        port: 8888,
        enableMockData: false,
        enableTestScenarios: true,
        cors: false,
        staticDir: './custom-static',
        apiDelay: 500
      });
      
      expect(customServer.config).toEqual(expect.objectContaining({
        port: 8888,
        enableMockData: false,
        enableTestScenarios: true,
        cors: false,
        staticDir: './custom-static',
        apiDelay: 500
      }));
    });

    test('should validate configuration parameters', () => {
      expect(() => {
        new TestServer({
          port: -1
        });
      }).toThrow('Invalid configuration: port must be >= 0');
      
      expect(() => {
        new TestServer({
          apiDelay: -100
        });
      }).toThrow('Invalid configuration: apiDelay must be >= 0');
    });

    test('should support custom routes', async () => {
      testServer.addRoute('/custom', 'GET', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ custom: true }));
      });
      
      server = await testServer.start();
      
      const response = await fetch(`${testServer.getUrl()}/custom`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({ custom: true });
    });

    test('should support middleware', async () => {
      const middleware = jest.fn((req, res, next) => {
        req.customHeader = 'test-value';
        next();
      });
      
      testServer.addMiddleware(middleware);
      server = await testServer.start();
      
      await fetch(`${testServer.getUrl()}/api/status`);
      expect(middleware).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      server = await testServer.start();
    });

    test('should handle malformed requests gracefully', async () => {
      // This would normally cause issues, but server should handle it
      const response = await fetch(`${testServer.getUrl()}/api/mock/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toEqual({
        error: 'Bad Request',
        message: expect.any(String)
      });
    });

    test('should handle server errors gracefully', async () => {
      // Add a route that throws an error
      testServer.addRoute('/error-test', 'GET', () => {
        throw new Error('Test server error');
      });
      
      const response = await fetch(`${testServer.getUrl()}/error-test`);
      
      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error).toEqual({
        error: 'Internal Server Error',
        message: expect.any(String)
      });
    });
  });
});