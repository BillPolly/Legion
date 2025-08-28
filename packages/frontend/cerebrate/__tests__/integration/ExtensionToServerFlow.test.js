/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import WebSocket from 'ws';
import { DebugServer } from '../../../src/server/debug-server.js';
import { WebSocketClient } from '../../../src/extension/WebSocketClient.js';
import { CommandInterface } from '../../../src/extension/CommandInterface.js';
import { TestServer } from '../../../src/testing/TestServer.js';

// Mock Chrome APIs
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

describe('Extension to Server Integration Flow', () => {
  let server;
  let testServer;
  let client;
  let commandInterface;
  
  beforeAll(async () => {
    // Start test server for mock data
    testServer = new TestServer({ port: 0 });
    await testServer.start();
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
    }
  });

  beforeEach(() => {
    // Mock WebSocket for jsdom environment
    global.WebSocket = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      CONNECTING: WebSocket.CONNECTING,
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED
    }));
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
      client = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
    jest.clearAllMocks();
  });

  describe('Server Startup and Connection', () => {
    test('should start debug server successfully', async () => {
      server = new DebugServer({ port: 0 });
      const serverInstance = await server.start();
      
      expect(serverInstance).toBeDefined();
      expect(server.isRunning()).toBe(true);
      expect(server.port).toBeGreaterThan(0);
    });

    test('should accept WebSocket connections', async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      
      client = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        reconnectDelay: 100
      });
      
      // Mock successful connection
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      const connected = await new Promise((resolve) => {
        client.on('connected', () => resolve(true));
        client.connect();
        // Simulate connection event
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    test('should handle connection failures gracefully', async () => {
      client = new WebSocketClient({
        url: 'ws://localhost:99999',
        reconnectDelay: 100
      });
      
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      
      const connectionError = await new Promise((resolve) => {
        client.on('error', (error) => resolve(error));
        client.connect();
        // Simulate connection error
        setTimeout(() => {
          const onErrorHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'error')?.[1];
          if (onErrorHandler) onErrorHandler(new Error('Connection failed'));
        }, 10);
      });
      
      expect(connectionError).toBeInstanceOf(Error);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Command Execution Flow', () => {
    beforeEach(async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      
      client = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        reconnectDelay: 100
      });
      
      commandInterface = new CommandInterface(client);
    });

    test('should execute inspect_element command successfully', async () => {
      // Mock successful connection and response
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      // Connect client
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      // Mock command response
      const mockResponse = {
        id: 'test-123',
        type: 'response',
        success: true,
        data: {
          element: {
            tagName: 'DIV',
            id: 'test-element',
            className: 'test-class',
            attributes: { 'data-test': 'value' }
          }
        }
      };
      
      const responsePromise = commandInterface.executeCommand('inspect_element', {
        selector: '#test-element'
      });
      
      // Simulate server response
      setTimeout(() => {
        const onMessageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        if (onMessageHandler) {
          onMessageHandler({
            data: JSON.stringify(mockResponse)
          });
        }
      }, 10);
      
      const result = await responsePromise;
      
      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });
    });

    test('should handle command errors properly', async () => {
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      const mockErrorResponse = {
        id: 'test-456',
        type: 'response',
        success: false,
        error: {
          code: 'ELEMENT_NOT_FOUND',
          message: 'Element not found'
        }
      };
      
      const errorPromise = commandInterface.executeCommand('inspect_element', {
        selector: '#nonexistent'
      });
      
      setTimeout(() => {
        const onMessageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        if (onMessageHandler) {
          onMessageHandler({
            data: JSON.stringify(mockErrorResponse)
          });
        }
      }, 10);
      
      const result = await errorPromise;
      
      expect(result).toEqual({
        success: false,
        error: mockErrorResponse.error
      });
    });

    test('should handle command timeouts', async () => {
      jest.useFakeTimers();
      
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      const timeoutPromise = commandInterface.executeCommand('slow_command', {}, {
        timeout: 1000
      });
      
      // Advance timers to trigger timeout
      jest.advanceTimersByTime(1100);
      
      const result = await timeoutPromise;
      
      expect(result).toEqual({
        success: false,
        error: {
          code: 'COMMAND_TIMEOUT',
          message: expect.stringContaining('timeout')
        }
      });
      
      jest.useRealTimers();
    });
  });

  describe('Multi-Command Sequences', () => {
    beforeEach(async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      
      client = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        reconnectDelay: 100
      });
      
      commandInterface = new CommandInterface(client);
      
      // Connect client
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
    });

    test('should execute multiple commands in sequence', async () => {
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      const responses = new Map();
      
      // Mock message handler to return appropriate responses
      const onMessageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      // Override to handle multiple responses
      if (onMessageHandler) {
        mockWebSocket.addEventListener = jest.fn((event, handler) => {
          if (event === 'message') {
            // Custom handler that responds based on command
            const customHandler = (event) => {
              const message = JSON.parse(event.data);
              if (message.type === 'command') {
                let response;
                switch (message.command) {
                  case 'inspect_element':
                    response = {
                      id: message.id,
                      type: 'response',
                      success: true,
                      data: { tagName: 'DIV', id: 'test' }
                    };
                    break;
                  case 'analyze_javascript':
                    response = {
                      id: message.id,
                      type: 'response',
                      success: true,
                      data: { syntax: 'valid', complexity: 'low' }
                    };
                    break;
                  case 'audit_accessibility':
                    response = {
                      id: message.id,
                      type: 'response',
                      success: true,
                      data: { score: 95, issues: [] }
                    };
                    break;
                }
                if (response) {
                  setTimeout(() => handler({ data: JSON.stringify(response) }), 10);
                }
              }
            };
            mockWebSocket.customMessageHandler = customHandler;
          }
          return onMessageHandler(event, handler);
        });
      }
      
      // Execute sequence of commands
      const commands = [
        { name: 'inspect_element', params: { selector: '#test' } },
        { name: 'analyze_javascript', params: { code: 'console.log("test")' } },
        { name: 'audit_accessibility', params: { selector: 'body' } }
      ];
      
      const results = [];
      for (const cmd of commands) {
        const promise = commandInterface.executeCommand(cmd.name, cmd.params);
        
        // Simulate sending command and receiving response
        setTimeout(() => {
          if (mockWebSocket.customMessageHandler) {
            mockWebSocket.customMessageHandler({
              data: JSON.stringify({
                id: `cmd-${Date.now()}`,
                type: 'command',
                command: cmd.name,
                params: cmd.params
              })
            });
          }
        }, 5);
        
        const result = await promise;
        results.push(result);
      }
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    test('should handle concurrent command execution', async () => {
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      const commandCount = 5;
      
      // Mock concurrent responses
      const onMessageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (onMessageHandler) {
        let responseCount = 0;
        mockWebSocket.addEventListener = jest.fn((event, handler) => {
          if (event === 'message') {
            const concurrentHandler = (event) => {
              const message = JSON.parse(event.data);
              if (message.type === 'command') {
                setTimeout(() => {
                  handler({
                    data: JSON.stringify({
                      id: message.id,
                      type: 'response',
                      success: true,
                      data: { result: `Command ${++responseCount}` }
                    })
                  });
                }, Math.random() * 50);
              }
            };
            mockWebSocket.concurrentHandler = concurrentHandler;
          }
          return onMessageHandler(event, handler);
        });
      }
      
      // Execute concurrent commands
      const promises = [];
      for (let i = 0; i < commandCount; i++) {
        const promise = commandInterface.executeCommand('test_command', { index: i });
        promises.push(promise);
        
        // Simulate command
        setTimeout(() => {
          if (mockWebSocket.concurrentHandler) {
            mockWebSocket.concurrentHandler({
              data: JSON.stringify({
                id: `concurrent-${i}`,
                type: 'command',
                command: 'test_command',
                params: { index: i }
              })
            });
          }
        }, i * 5);
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(commandCount);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.result).toMatch(/Command \d+/);
      });
    });
  });

  describe('Error Recovery and Reconnection', () => {
    test('should recover from connection loss', async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      
      client = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        reconnectDelay: 50,
        maxReconnectAttempts: 3
      });
      
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      // Initial connection
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      expect(client.isConnected()).toBe(true);
      
      // Simulate connection loss
      const reconnectedPromise = new Promise((resolve) => {
        client.on('reconnected', resolve);
      });
      
      // Trigger disconnect
      const onCloseHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')?.[1];
      if (onCloseHandler) {
        onCloseHandler({ code: 1006, reason: 'Connection lost' });
      }
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate successful reconnection
      const newMockWebSocket = global.WebSocket.mock.results[1]?.value || mockWebSocket;
      newMockWebSocket.readyState = WebSocket.OPEN;
      
      const newOnOpenHandler = newMockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')?.[1];
      if (newOnOpenHandler) {
        newOnOpenHandler();
      }
      
      await reconnectedPromise;
      expect(client.isConnected()).toBe(true);
    });

    test('should handle server restart gracefully', async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      const originalPort = server.port;
      
      client = new WebSocketClient({
        url: `ws://localhost:${originalPort}`,
        reconnectDelay: 100
      });
      
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      // Connect initially
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
      
      // Simulate server restart
      await server.stop();
      
      // Trigger client disconnect event
      const onCloseHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')?.[1];
      if (onCloseHandler) {
        onCloseHandler({ code: 1006, reason: 'Server shutdown' });
      }
      
      expect(client.isConnected()).toBe(false);
      
      // Restart server on same port
      server = new DebugServer({ port: originalPort });
      await server.start();
      
      // Client should eventually reconnect
      const reconnectedPromise = new Promise((resolve) => {
        client.on('reconnected', resolve);
      });
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Simulate successful reconnection
      const newMockWebSocket = global.WebSocket.mock.results[1]?.value || mockWebSocket;
      newMockWebSocket.readyState = WebSocket.OPEN;
      
      const newOnOpenHandler = newMockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')?.[1];
      if (newOnOpenHandler) {
        newOnOpenHandler();
      }
      
      await reconnectedPromise;
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Real-world Debugging Scenarios', () => {
    beforeEach(async () => {
      server = new DebugServer({ port: 0 });
      await server.start();
      
      client = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        reconnectDelay: 100
      });
      
      commandInterface = new CommandInterface(client);
      
      // Connect client
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      mockWebSocket.readyState = WebSocket.OPEN;
      
      await new Promise((resolve) => {
        client.on('connected', resolve);
        client.connect();
        setTimeout(() => {
          const onOpenHandler = mockWebSocket.addEventListener.mock.calls
            .find(call => call[0] === 'open')?.[1];
          if (onOpenHandler) onOpenHandler();
        }, 10);
      });
    });

    test('should handle complete DOM inspection workflow', async () => {
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      
      // Mock comprehensive DOM inspection response
      const setupMockHandler = () => {
        const onMessageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        if (onMessageHandler) {
          mockWebSocket.addEventListener = jest.fn((event, handler) => {
            if (event === 'message') {
              const workflowHandler = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'command') {
                  let response;
                  switch (message.command) {
                    case 'inspect_element':
                      response = {
                        id: message.id,
                        type: 'response',
                        success: true,
                        data: {
                          element: {
                            tagName: 'BUTTON',
                            id: 'submit-btn',
                            className: 'btn btn-primary',
                            textContent: 'Submit Form',
                            styles: {
                              backgroundColor: 'rgb(0, 123, 255)',
                              padding: '8px 16px',
                              border: 'none'
                            },
                            accessibility: {
                              role: 'button',
                              ariaLabel: null,
                              tabIndex: 0
                            }
                          }
                        }
                      };
                      break;
                    case 'analyze_dom_tree':
                      response = {
                        id: message.id,
                        type: 'response',
                        success: true,
                        data: {
                          nodeCount: 45,
                          depth: 6,
                          issues: ['Missing alt text on 2 images'],
                          performance: { renderingCost: 'low' }
                        }
                      };
                      break;
                  }
                  if (response) {
                    setTimeout(() => handler({ data: JSON.stringify(response) }), 10);
                  }
                }
              };
              mockWebSocket.workflowHandler = workflowHandler;
            }
            return onMessageHandler(event, handler);
          });
        }
      };
      
      setupMockHandler();
      
      // Execute DOM inspection workflow
      const elementResult = await new Promise(async (resolve) => {
        const promise = commandInterface.executeCommand('inspect_element', {
          selector: '#submit-btn'
        });
        
        setTimeout(() => {
          if (mockWebSocket.workflowHandler) {
            mockWebSocket.workflowHandler({
              data: JSON.stringify({
                id: 'inspect-1',
                type: 'command',
                command: 'inspect_element'
              })
            });
          }
        }, 5);
        
        const result = await promise;
        resolve(result);
      });
      
      const treeResult = await new Promise(async (resolve) => {
        const promise = commandInterface.executeCommand('analyze_dom_tree', {
          root: '#submit-btn',
          depth: 3
        });
        
        setTimeout(() => {
          if (mockWebSocket.workflowHandler) {
            mockWebSocket.workflowHandler({
              data: JSON.stringify({
                id: 'tree-1',
                type: 'command',
                command: 'analyze_dom_tree'
              })
            });
          }
        }, 5);
        
        const result = await promise;
        resolve(result);
      });
      
      expect(elementResult.success).toBe(true);
      expect(elementResult.data.element.tagName).toBe('BUTTON');
      expect(elementResult.data.element.id).toBe('submit-btn');
      
      expect(treeResult.success).toBe(true);
      expect(treeResult.data.nodeCount).toBe(45);
      expect(treeResult.data.issues).toContain('Missing alt text on 2 images');
    });

    test('should handle performance analysis scenario', async () => {
      const mockWebSocket = global.WebSocket.mock.results[0].value;
      
      const setupPerformanceHandler = () => {
        const onMessageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        if (onMessageHandler) {
          mockWebSocket.addEventListener = jest.fn((event, handler) => {
            if (event === 'message') {
              const perfHandler = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'command' && message.command === 'analyze_performance') {
                  const response = {
                    id: message.id,
                    type: 'response',
                    success: true,
                    data: {
                      metrics: {
                        loadTime: 1250,
                        domContentLoaded: 890,
                        firstPaint: 450,
                        largestContentfulPaint: 1100
                      },
                      bottlenecks: [
                        'Large bundle size (2.3MB)',
                        'Unused CSS rules (45%)',
                        'Unoptimized images (3 found)'
                      ],
                      score: 72,
                      recommendations: [
                        'Enable gzip compression',
                        'Optimize images',
                        'Remove unused CSS'
                      ]
                    }
                  };
                  setTimeout(() => handler({ data: JSON.stringify(response) }), 10);
                }
              };
              mockWebSocket.perfHandler = perfHandler;
            }
            return onMessageHandler(event, handler);
          });
        }
      };
      
      setupPerformanceHandler();
      
      const result = await new Promise(async (resolve) => {
        const promise = commandInterface.executeCommand('analyze_performance', {
          includeMetrics: true,
          includeBottlenecks: true
        });
        
        setTimeout(() => {
          if (mockWebSocket.perfHandler) {
            mockWebSocket.perfHandler({
              data: JSON.stringify({
                id: 'perf-1',
                type: 'command',
                command: 'analyze_performance'
              })
            });
          }
        }, 5);
        
        const result = await promise;
        resolve(result);
      });
      
      expect(result.success).toBe(true);
      expect(result.data.metrics.loadTime).toBe(1250);
      expect(result.data.bottlenecks).toContain('Large bundle size (2.3MB)');
      expect(result.data.score).toBe(72);
      expect(result.data.recommendations).toContain('Enable gzip compression');
    });
  });
});