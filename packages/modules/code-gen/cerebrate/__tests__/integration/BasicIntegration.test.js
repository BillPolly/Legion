/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { TestServer } from '../../src/testing/TestServer.js';

// Mock Chrome APIs for extension components
global.chrome = {
  runtime: {
    connect: jest.fn(),
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn()
  },
  devtools: {
    panels: {
      create: jest.fn()
    },
    inspectedWindow: {
      eval: jest.fn()
    }
  }
};

describe('Basic Integration Tests', () => {
  let testServer;
  
  beforeAll(async () => {
    testServer = new TestServer({ port: 0 });
    await testServer.start();
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
    }
  });

  describe('Test Server Integration', () => {
    test('should serve test pages for extension testing', async () => {
      const response = await fetch(`${testServer.getUrl()}/test-page.html`);
      
      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Test Page');
      expect(html).toContain('id="test-element"');
    });

    test('should provide mock API data', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/mock/users`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('users');
      expect(data.users).toBeInstanceOf(Array);
      expect(data.users.length).toBeGreaterThan(0);
      expect(data.users[0]).toHaveProperty('id');
      expect(data.users[0]).toHaveProperty('email');
    });

    test('should provide test scenarios for debugging', async () => {
      const response = await fetch(`${testServer.getUrl()}/api/scenarios`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('scenarios');
      expect(data.scenarios).toBeInstanceOf(Array);
      expect(data.scenarios.length).toBeGreaterThan(0);
      
      const domScenario = data.scenarios.find(s => s.id === 'dom-testing');
      expect(domScenario).toBeDefined();
      expect(domScenario.name).toBe('DOM Testing Scenario');
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
  });

  describe('Mock WebSocket Communication', () => {
    beforeEach(() => {
      // Mock WebSocket for jsdom environment
      global.WebSocket = jest.fn().mockImplementation(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1, // OPEN
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      }));
    });

    test('should simulate WebSocket connection establishment', () => {
      const mockUrl = `ws://localhost:${testServer.getPort()}/ws`;
      const ws = new global.WebSocket(mockUrl);
      
      expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
      expect(ws.addEventListener).toBeDefined();
      expect(ws.send).toBeDefined();
      expect(ws.close).toBeDefined();
    });

    test('should simulate message sending and receiving', async () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Simulate sending a command
      const command = {
        id: 'test-123',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#test-element' }
      };
      
      ws.send(JSON.stringify(command));
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(command));
      
      // Simulate receiving a response
      const mockResponse = {
        id: 'test-123',
        type: 'response',
        success: true,
        data: {
          element: {
            tagName: 'DIV',
            id: 'test-element',
            className: 'test-class'
          }
        }
      };
      
      // Find the message event handler
      const messageHandler = ws.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(mockResponse)
        });
      }
      
      // Verify the mock was set up correctly
      expect(ws.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should simulate connection error handling', () => {
      const ws = new global.WebSocket('ws://localhost:99999');
      
      // Simulate connection error
      const errorHandler = ws.addEventListener.mock.calls
        .find(call => call[0] === 'error')?.[1];
      
      if (errorHandler) {
        const mockError = new Error('Connection failed');
        errorHandler(mockError);
      }
      
      expect(ws.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Multi-Command Workflow Simulation', () => {
    test('should simulate complete debugging workflow', async () => {
      // Step 1: Get test page
      const pageResponse = await fetch(`${testServer.getUrl()}/scenarios/dom-testing`);
      expect(pageResponse.status).toBe(200);
      
      // Step 2: Mock WebSocket connection for commands
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Step 3: Simulate DOM inspection command
      const inspectCommand = {
        id: 'cmd-1',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#test-element' }
      };
      
      ws.send(JSON.stringify(inspectCommand));
      
      // Step 4: Simulate code analysis command
      const analyzeCommand = {
        id: 'cmd-2',
        type: 'command',
        command: 'analyze_javascript',
        params: { selector: 'script' }
      };
      
      ws.send(JSON.stringify(analyzeCommand));
      
      // Step 5: Simulate accessibility audit
      const auditCommand = {
        id: 'cmd-3',
        type: 'command',
        command: 'audit_accessibility',
        params: { selector: 'body' }
      };
      
      ws.send(JSON.stringify(auditCommand));
      
      // Verify all commands were sent
      expect(ws.send).toHaveBeenCalledTimes(3);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(inspectCommand));
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(analyzeCommand));
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(auditCommand));
    });

    test('should handle concurrent debugging operations', async () => {
      const operations = [];
      
      // Simulate multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        const operation = {
          fetchScenario: fetch(`${testServer.getUrl()}/scenarios/dom-testing`),
          fetchMockData: fetch(`${testServer.getUrl()}/api/mock/users`),
          wsConnection: new global.WebSocket('ws://localhost:9222')
        };
        operations.push(operation);
      }
      
      // Wait for all fetch operations
      const results = await Promise.all(
        operations.map(async (op) => {
          const [scenarioResponse, mockDataResponse] = await Promise.all([
            op.fetchScenario,
            op.fetchMockData
          ]);
          
          return {
            scenarioStatus: scenarioResponse.status,
            mockDataStatus: mockDataResponse.status,
            wsCreated: !!op.wsConnection
          };
        })
      );
      
      // Verify all operations completed successfully
      results.forEach(result => {
        expect(result.scenarioStatus).toBe(200);
        expect(result.mockDataStatus).toBe(200);
        expect(result.wsCreated).toBe(true);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle server errors gracefully', async () => {
      // Test 404 error
      const notFoundResponse = await fetch(`${testServer.getUrl()}/nonexistent`);
      expect(notFoundResponse.status).toBe(404);
      
      // Test API error simulation
      const errorResponse = await fetch(`${testServer.getUrl()}/api/mock/error`);
      expect(errorResponse.status).toBe(500);
      
      const errorData = await errorResponse.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData.error).toBe('Mock server error');
    });

    test('should handle malformed requests', async () => {
      const malformedResponse = await fetch(`${testServer.getUrl()}/api/mock/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      expect(malformedResponse.status).toBe(400);
      const errorData = await malformedResponse.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData.error).toBe('Bad Request');
    });

    test('should simulate WebSocket reconnection', async () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Simulate initial connection
      const openHandler = ws.addEventListener.mock.calls
        .find(call => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      
      // Simulate disconnection
      const closeHandler = ws.addEventListener.mock.calls
        .find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler({ code: 1006, reason: 'Connection lost' });
      
      // Simulate reconnection attempt
      const newWs = new global.WebSocket('ws://localhost:9222');
      const newOpenHandler = newWs.addEventListener.mock.calls
        .find(call => call[0] === 'open')?.[1];
      if (newOpenHandler) newOpenHandler();
      
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(fetch(`${testServer.getUrl()}/api/mock/users?limit=5`));
      }
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Verify all responses contain expected data
      const dataPromises = responses.map(r => r.json());
      const allData = await Promise.all(dataPromises);
      
      allData.forEach(data => {
        expect(data).toHaveProperty('users');
        expect(data.users).toHaveLength(5);
      });
    });

    test('should handle API delays appropriately', async () => {
      const startTime = Date.now();
      const response = await fetch(`${testServer.getUrl()}/api/mock/slow`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(200); // At least 200ms delay
      
      const data = await response.json();
      expect(data).toHaveProperty('delay');
      expect(data.delay).toBe(200);
    });
  });
});