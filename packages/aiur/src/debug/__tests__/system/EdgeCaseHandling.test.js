/**
 * Edge Case Handling Tests
 * 
 * Tests robust handling of malformed messages, invalid inputs,
 * network failures, and resource exhaustion scenarios.
 */

import { WebSocket } from 'ws';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';

describe('Edge Case Handling', () => {
  let webDebugServer;

  beforeAll(async () => {
    webDebugServer = await getSharedWebDebugServer();
  });

  beforeEach(async () => {
    if (!webDebugServer.isRunning) {
      await webDebugServer.start({ openBrowser: false });
    }
  });

  afterEach(async () => {
    if (webDebugServer.isRunning) {
      await webDebugServer.stop();
    }
  });

  describe('Malformed WebSocket Messages', () => {
    let client;

    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
        client.on('open', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should handle invalid JSON messages gracefully', async () => {
      const errorPromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            resolve(message);
          }
        });
      });

      // Send invalid JSON
      client.send('{ invalid json }');

      const errorMessage = await errorPromise;
      expect(errorMessage.type).toBe('error');
      expect(errorMessage.error).toContain('Invalid JSON');
      
      // Connection should remain open
      expect(client.readyState).toBe(WebSocket.OPEN);
    }, 5000);

    test('should handle missing required message fields', async () => {
      const responsePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error' || message.type === 'tool_result') {
            resolve(message);
          }
        });
      });

      // Send message without required 'type' field
      client.send(JSON.stringify({ id: 'test', data: {} }));

      const response = await responsePromise;
      expect(response.type).toBe('error');
      expect(response.error).toContain('type');
    }, 5000);

    test('should handle oversized messages', async () => {
      const errorPromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            resolve(message);
          }
        });
      });

      // Create a very large message (1MB+)
      const largeData = 'x'.repeat(1024 * 1024);
      const largeMessage = {
        type: 'tool_request',
        id: 'oversized-test',
        tool: 'context_add',
        args: {
          name: 'large_data',
          data: { content: largeData }
        }
      };

      client.send(JSON.stringify(largeMessage));

      const errorMessage = await errorPromise;
      expect(errorMessage.type).toBe('error');
      expect(errorMessage.error).toContain('too large');
    }, 8000);

    test('should handle rapid message flooding', async () => {
      let messageCount = 0;
      let errorReceived = false;

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;
        if (message.type === 'error') {
          errorReceived = true;
        }
      });

      // Send 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        client.send(JSON.stringify({
          type: 'tool_request',
          id: `flood-${i}`,
          tool: 'web_debug_status',
          args: {}
        }));
      }

      await waitForAsync(2000);

      // Server should either process all messages or implement rate limiting
      expect(messageCount).toBeGreaterThan(0);
      
      // Connection should remain stable
      expect(client.readyState).toBe(WebSocket.OPEN);
    }, 10000);
  });

  describe('Invalid Tool Parameters', () => {
    let client;

    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
        client.on('open', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should handle nonexistent tool names', async () => {
      const responsePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'tool_result') {
            resolve(message);
          }
        });
      });

      client.send(JSON.stringify({
        type: 'tool_request',
        id: 'invalid-tool-test',
        tool: 'nonexistent_tool',
        args: {}
      }));

      const response = await responsePromise;
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Unknown tool');
    }, 5000);

    test('should validate tool parameter types', async () => {
      const responsePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'tool_result') {
            resolve(message);
          }
        });
      });

      // Send web_debug_start with invalid port type
      client.send(JSON.stringify({
        type: 'tool_request',
        id: 'invalid-params-test',
        tool: 'web_debug_start',
        args: {
          port: 'not-a-number',
          openBrowser: 'not-a-boolean'
        }
      }));

      const response = await responsePromise;
      expect(response.data.success).toBe(false);
      expect(response.data.error).toBeDefined();
    }, 5000);

    test('should handle missing required parameters', async () => {
      const responsePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'tool_result') {
            resolve(message);
          }
        });
      });

      // Send context_add without required 'name' parameter
      client.send(JSON.stringify({
        type: 'tool_request',
        id: 'missing-params-test',
        tool: 'context_add',
        args: {
          data: { test: 'value' }
          // Missing 'name' parameter
        }
      }));

      const response = await responsePromise;
      expect(response.data.success).toBe(false);
      expect(response.data.error).toBeDefined();
    }, 5000);
  });

  describe('Network Interruption and Recovery', () => {
    test('should handle abrupt client disconnections', async () => {
      const initialClientCount = webDebugServer.clients.size;

      // Create and immediately close connection
      const client1 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      await new Promise((resolve) => {
        client1.on('open', () => {
          client1.close();
          resolve();
        });
      });

      await waitForAsync(100);

      // Create another connection that stays open briefly
      const client2 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      await new Promise((resolve) => {
        client2.on('open', resolve);
      });

      await waitForAsync(100);
      expect(webDebugServer.clients.size).toBe(initialClientCount + 1);

      // Abruptly terminate the connection
      client2.terminate();
      await waitForAsync(500);

      // Server should clean up the connection
      expect(webDebugServer.clients.size).toBe(initialClientCount);
    }, 8000);

    test('should handle connection timeouts gracefully', async () => {
      const client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Send a message and immediately close without waiting for response
      client.send(JSON.stringify({
        type: 'tool_request',
        id: 'timeout-test',
        tool: 'context_list',
        args: {}
      }));

      client.close();
      await waitForAsync(100);

      // Server should handle the incomplete request gracefully
      expect(webDebugServer.isRunning).toBe(true);
    }, 5000);
  });

  describe('Event Buffer Overflow', () => {
    let client;

    beforeEach(async () => {
      await new Promise((resolve, reject) => {
        client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
        client.on('open', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should handle event buffer overflow', async () => {
      let eventCount = 0;
      let bufferOverflowDetected = false;

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'event') {
          eventCount++;
        }
        if (message.type === 'buffer_overflow' || message.type === 'warning') {
          bufferOverflowDetected = true;
        }
      });

      // Generate many events rapidly
      for (let i = 0; i < 1000; i++) {
        // Trigger events by adding context items
        client.send(JSON.stringify({
          type: 'tool_request',
          id: `overflow-test-${i}`,
          tool: 'context_add',
          args: {
            name: `overflow_item_${i}`,
            data: { index: i }
          }
        }));
      }

      await waitForAsync(3000);

      // Either all events should be processed or overflow should be detected
      expect(eventCount > 0 || bufferOverflowDetected).toBe(true);
      
      // Server should remain responsive
      expect(client.readyState).toBe(WebSocket.OPEN);
    }, 15000);
  });

  describe('Port Collision and Fallback', () => {
    test('should handle port already in use', async () => {
      const originalPort = webDebugServer.port;
      
      // Stop current server
      await webDebugServer.stop();

      // Try to start on a port that's already in use
      const conflictingServer = await getSharedWebDebugServer();
      await conflictingServer.start({ port: originalPort, openBrowser: false });

      // Try to start another server on the same port
      const secondServer = await getSharedWebDebugServer();
      const serverInfo = await secondServer.start({ port: originalPort, openBrowser: false });

      // Should fallback to a different port
      expect(serverInfo.port).not.toBe(originalPort);
      expect(serverInfo.port).toBeGreaterThan(1024);
      expect(serverInfo.port).toBeLessThan(65536);

      // Clean up
      await conflictingServer.stop();
      await secondServer.stop();
      
      // Restore original server
      await webDebugServer.start({ port: originalPort, openBrowser: false });
    }, 10000);

    test('should handle port range exhaustion gracefully', async () => {
      // This test simulates what happens when all ports in a range are taken
      // We'll mock the port detection to simulate this scenario
      
      const testServer = await getSharedWebDebugServer();
      
      // Try to start with a very restricted port range that should fail
      try {
        await testServer.start({ 
          port: 99999, // Invalid port number
          openBrowser: false 
        });
        
        // If it succeeds, it should have chosen a valid fallback port
        expect(testServer.port).toBeGreaterThan(1024);
        expect(testServer.port).toBeLessThan(65536);
        
        await testServer.stop();
      } catch (error) {
        // Should fail gracefully with a meaningful error
        expect(error.message).toContain('port');
      }
    }, 8000);
  });

  describe('Memory and Resource Management', () => {
    test('should handle memory pressure from large context data', async () => {
      const client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      let successCount = 0;
      let errorCount = 0;

      // Add many large context items
      for (let i = 0; i < 50; i++) {
        const responsePromise = new Promise((resolve) => {
          client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.id === `memory-test-${i}`) {
              resolve(message);
            }
          });
        });

        const largeData = {
          index: i,
          content: 'x'.repeat(10000), // 10KB per item
          timestamp: Date.now(),
          metadata: {
            description: `Large context item ${i}`,
            tags: Array(100).fill(`tag-${i}`)
          }
        };

        client.send(JSON.stringify({
          type: 'tool_request',
          id: `memory-test-${i}`,
          tool: 'context_add',
          args: {
            name: `large_context_${i}`,
            data: largeData
          }
        }));

        const response = await responsePromise;
        if (response.data.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Server should either handle all requests or start rejecting them gracefully
      expect(successCount + errorCount).toBe(50);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      
      // Server should remain responsive
      expect(webDebugServer.isRunning).toBe(true);

      client.close();
    }, 20000);

    test('should clean up resources on client disconnection', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Create and disconnect many clients
      for (let i = 0; i < 20; i++) {
        const client = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
        
        await new Promise((resolve) => {
          client.on('open', resolve);
        });

        // Send some data
        client.send(JSON.stringify({
          type: 'tool_request',
          id: `cleanup-test-${i}`,
          tool: 'context_add',
          args: {
            name: `cleanup_item_${i}`,
            data: { test: 'cleanup data' }
          }
        }));

        await waitForAsync(50);
        client.close();
        await waitForAsync(50);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await waitForAsync(1000);

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // Server should still be responsive
      expect(webDebugServer.isRunning).toBe(true);
    }, 15000);
  });
});