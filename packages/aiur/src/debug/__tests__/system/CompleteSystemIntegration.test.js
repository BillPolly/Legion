/**
 * Complete System Integration Tests
 * 
 * Tests the entire Aiur MCP server with debug interface integrated,
 * simulating real-world usage scenarios and comprehensive workflows.
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const aiurServerPath = join(__dirname, '../../../index.js');

describe('Complete System Integration', () => {
  let aiurProcess;
  let webDebugServer;

  beforeAll(async () => {
    webDebugServer = await getSharedWebDebugServer();
  });

  afterAll(async () => {
    if (aiurProcess) {
      aiurProcess.kill('SIGTERM');
      await waitForAsync(100);
    }
  });

  describe('Aiur MCP Server with Debug Interface', () => {
    test('should start Aiur server with debug tools available', async () => {
      // Start Aiur MCP server
      const serverReady = new Promise((resolve, reject) => {
        aiurProcess = spawn('node', [aiurServerPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'test' }
        });

        let output = '';
        aiurProcess.stderr.on('data', (data) => {
          output += data.toString();
          if (output.includes('Aiur MCP Server started successfully')) {
            resolve();
          }
        });

        aiurProcess.on('error', reject);
        setTimeout(() => reject(new Error('Server startup timeout')), 5000);
      });

      await serverReady;

      // Send MCP list_tools request
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      aiurProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');

      // Wait for response
      const response = await new Promise((resolve, reject) => {
        let buffer = '';
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 3000);

        aiurProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          try {
            const lines = buffer.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const response = JSON.parse(line);
              if (response.id === 1) {
                clearTimeout(timeout);
                resolve(response);
                return;
              }
            }
          } catch (e) {
            // Continue parsing
          }
        });
      });

      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      
      // Check that debug tools are included
      const toolNames = response.result.tools.map(tool => tool.name);
      expect(toolNames).toContain('web_debug_start');
      expect(toolNames).toContain('web_debug_stop');
      expect(toolNames).toContain('web_debug_status');
      
      // Check that context tools are included
      expect(toolNames).toContain('context_add');
      expect(toolNames).toContain('context_get');
      expect(toolNames).toContain('context_list');

      // Should have at least 10 tools (context + debug + module tools)
      expect(response.result.tools.length).toBeGreaterThanOrEqual(10);
    }, 10000);

    test('should execute web_debug_start through MCP protocol', async () => {
      const debugStartRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'web_debug_start',
          arguments: {
            port: 3010,
            openBrowser: false
          }
        }
      };

      aiurProcess.stdin.write(JSON.stringify(debugStartRequest) + '\n');

      const response = await new Promise((resolve, reject) => {
        let buffer = '';
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000);

        aiurProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          try {
            const lines = buffer.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const response = JSON.parse(line);
              if (response.id === 2) {
                clearTimeout(timeout);
                resolve(response);
                return;
              }
            }
          } catch (e) {
            // Continue parsing
          }
        });
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toHaveLength(1);
      expect(response.result.content[0].type).toBe('text');
      
      const resultData = JSON.parse(response.result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.port).toBe(3010);
      expect(resultData.url).toContain('3010');
    }, 8000);

    test('should handle concurrent tool executions', async () => {
      const requests = [
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'context_add',
            arguments: {
              name: 'test_concurrent_1',
              data: { test: 'concurrent1' },
              description: 'Concurrent test 1'
            }
          }
        },
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'context_add',
            arguments: {
              name: 'test_concurrent_2',
              data: { test: 'concurrent2' },
              description: 'Concurrent test 2'
            }
          }
        },
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'web_debug_status',
            arguments: {}
          }
        }
      ];

      // Send all requests simultaneously
      requests.forEach(req => {
        aiurProcess.stdin.write(JSON.stringify(req) + '\n');
      });

      // Collect all responses
      const responses = await new Promise((resolve, reject) => {
        let buffer = '';
        const collectedResponses = [];
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000);

        aiurProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          try {
            const lines = buffer.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const response = JSON.parse(line);
              if ([3, 4, 5].includes(response.id)) {
                collectedResponses.push(response);
                if (collectedResponses.length === 3) {
                  clearTimeout(timeout);
                  resolve(collectedResponses);
                  return;
                }
              }
            }
          } catch (e) {
            // Continue parsing
          }
        });
      });

      expect(responses).toHaveLength(3);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.result).toBeDefined();
        expect(response.result.content).toHaveLength(1);
      });

      // Stop the debug server
      const stopRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'web_debug_stop',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(stopRequest) + '\n');
      await waitForAsync(500);
    }, 10000);
  });

  describe('Multiple Concurrent Debug Clients', () => {
    let debugServer;
    let clients = [];

    beforeAll(async () => {
      // Start debug server for this test suite
      const startRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'web_debug_start',
          arguments: {
            port: 3011,
            openBrowser: false
          }
        }
      };

      aiurProcess.stdin.write(JSON.stringify(startRequest) + '\n');
      await waitForAsync(1000); // Allow server to start
    });

    afterAll(async () => {
      // Close all clients
      await Promise.all(clients.map(client => {
        return new Promise((resolve) => {
          client.close();
          client.on('close', resolve);
        });
      }));

      // Stop debug server
      const stopRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'web_debug_stop',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(stopRequest) + '\n');
      await waitForAsync(500);
    });

    test('should handle multiple WebSocket connections', async () => {
      const connectionPromises = [];

      // Create 3 concurrent WebSocket connections
      for (let i = 0; i < 3; i++) {
        const connectionPromise = new Promise((resolve, reject) => {
          const client = new WebSocket('ws://localhost:3011/ws');
          
          client.on('open', () => {
            clients.push(client);
            resolve({ client, id: i });
          });

          client.on('error', reject);
          setTimeout(() => reject(new Error(`Client ${i} connection timeout`)), 3000);
        });

        connectionPromises.push(connectionPromise);
      }

      const connections = await Promise.all(connectionPromises);
      expect(connections).toHaveLength(3);

      // Test that all clients can receive welcome messages
      const welcomePromises = connections.map(({ client, id }) => {
        return new Promise((resolve) => {
          client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'welcome') {
              resolve({ id, message });
            }
          });
        });
      });

      const welcomeMessages = await Promise.all(welcomePromises);
      expect(welcomeMessages).toHaveLength(3);

      // Each client should receive the same server info
      welcomeMessages.forEach(({ message }) => {
        expect(message.data.serverId).toBeDefined();
        expect(message.data.version).toBe('1.0.0');
        expect(message.data.capabilities).toContain('tool-execution');
      });
    }, 10000);

    test('should broadcast events to all connected clients', async () => {
      expect(clients.length).toBeGreaterThan(0);

      // Setup event listeners on all clients
      const eventPromises = clients.map((client, index) => {
        return new Promise((resolve) => {
          const receivedEvents = [];
          
          client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'event') {
              receivedEvents.push(message);
              if (receivedEvents.length >= 1) {
                resolve({ clientIndex: index, events: receivedEvents });
              }
            }
          });
        });
      });

      // Execute a tool that should trigger events
      const toolRequest = {
        type: 'tool_request',
        id: 'test-broadcast-' + Date.now(),
        tool: 'context_list',
        args: {}
      };

      // Send through first client
      clients[0].send(JSON.stringify(toolRequest));

      // Wait for events on all clients
      const eventResults = await Promise.all(eventPromises);
      expect(eventResults).toHaveLength(clients.length);

      // All clients should receive the same events
      eventResults.forEach(({ events }) => {
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].eventType).toBeDefined();
      });
    }, 8000);
  });

  describe('Server Lifecycle with Active Sessions', () => {
    test('should gracefully handle server restart with active debug sessions', async () => {
      // Start debug server
      const startRequest = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'web_debug_start',
          arguments: {
            port: 3012,
            openBrowser: false
          }
        }
      };

      aiurProcess.stdin.write(JSON.stringify(startRequest) + '\n');
      await waitForAsync(1000);

      // Create WebSocket connection
      let client;
      await new Promise((resolve, reject) => {
        client = new WebSocket('ws://localhost:3012/ws');
        client.on('open', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });

      // Verify connection is working
      let connectionWorking = false;
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'welcome') {
          connectionWorking = true;
        }
      });

      await waitForAsync(500);
      expect(connectionWorking).toBe(true);

      // Stop debug server (simulating restart)
      const stopRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'web_debug_stop',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(stopRequest) + '\n');
      await waitForAsync(500);

      // WebSocket should be closed
      const disconnectPromise = new Promise((resolve) => {
        client.on('close', resolve);
      });

      await disconnectPromise;

      // Restart debug server
      aiurProcess.stdin.write(JSON.stringify(startRequest) + '\n');
      await waitForAsync(1000);

      // Should be able to connect again
      let newClient;
      await new Promise((resolve, reject) => {
        newClient = new WebSocket('ws://localhost:3012/ws');
        newClient.on('open', resolve);
        newClient.on('error', reject);
        setTimeout(() => reject(new Error('Reconnection timeout')), 3000);
      });

      newClient.close();

      // Final cleanup
      const finalStopRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'web_debug_stop',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(finalStopRequest) + '\n');
      await waitForAsync(500);
    }, 15000);
  });

  describe('Resource Management and Cleanup', () => {
    test('should properly clean up resources on server shutdown', async () => {
      const startRequest = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'web_debug_start',
          arguments: {
            port: 3013,
            openBrowser: false
          }
        }
      };

      aiurProcess.stdin.write(JSON.stringify(startRequest) + '\n');
      await waitForAsync(1000);

      // Check server status
      const statusRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'web_debug_status',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(statusRequest) + '\n');

      const statusResponse = await new Promise((resolve, reject) => {
        let buffer = '';
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 3000);

        aiurProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          try {
            const lines = buffer.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const response = JSON.parse(line);
              if (response.id === 13) {
                clearTimeout(timeout);
                resolve(response);
                return;
              }
            }
          } catch (e) {
            // Continue parsing
          }
        });
      });

      const statusData = JSON.parse(statusResponse.result.content[0].text);
      expect(statusData.success).toBe(true);
      expect(statusData.status.status).toBe('running');
      expect(statusData.status.port).toBe(3013);

      // Stop server
      const stopRequest = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'web_debug_stop',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(stopRequest) + '\n');
      await waitForAsync(500);

      // Verify server is stopped
      const finalStatusRequest = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'web_debug_status',
          arguments: {}
        }
      };

      aiurProcess.stdin.write(JSON.stringify(finalStatusRequest) + '\n');

      const finalStatusResponse = await new Promise((resolve, reject) => {
        let buffer = '';
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 3000);

        aiurProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          try {
            const lines = buffer.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const response = JSON.parse(line);
              if (response.id === 15) {
                clearTimeout(timeout);
                resolve(response);
                return;
              }
            }
          } catch (e) {
            // Continue parsing
          }
        });
      });

      const finalStatusData = JSON.parse(finalStatusResponse.result.content[0].text);
      expect(finalStatusData.success).toBe(true);
      expect(finalStatusData.status.status).toBe('stopped');
    }, 10000);
  });
});