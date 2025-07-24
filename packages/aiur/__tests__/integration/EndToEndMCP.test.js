/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Increase timeout for end-to-end tests
jest.setTimeout(60000);

describe('End-to-End MCP Protocol Tests', () => {
  let testPort;
  let stubProcess;
  let wsClient;

  beforeAll(() => {
    // Use a random port for testing to avoid conflicts
    testPort = 8100 + Math.floor(Math.random() * 100);
  });

  afterEach(async () => {
    // Clean up WebSocket connection
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
      await new Promise(resolve => {
        wsClient.on('close', resolve);
      });
    }

    // Clean up stub process
    if (stubProcess && !stubProcess.killed) {
      stubProcess.kill('SIGTERM');
      await new Promise(resolve => {
        stubProcess.on('exit', resolve);
      });
    }
  });

  describe('MCP Stub Auto-Launch Integration', () => {
    test('should start auto-stub and establish MCP connection', async () => {
      const stubPath = path.join(__dirname, '../../src/index-auto-stub.js');
      
      // Start the auto stub with test configuration
      stubProcess = spawn('node', [stubPath], {
        env: {
          ...process.env,
          AIUR_SERVER_PORT: testPort.toString(),
          AIUR_VERBOSE: 'true',
          AIUR_AUTO_LAUNCH_SERVER: 'true'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for stub to initialize
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stub initialization timeout'));
        }, 15000);

        let output = '';
        
        stubProcess.stdout.on('data', (data) => {
          output += data.toString();
          console.log('STUB OUTPUT:', data.toString());
          
          // Look for successful connection message
          if (output.includes('MCP ready') || output.includes('Connected')) {
            clearTimeout(timeout);
            resolve();
          }
        });

        stubProcess.stderr.on('data', (data) => {
          console.error('STUB ERROR:', data.toString());
        });

        stubProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        stubProcess.on('exit', (code) => {
          if (code !== null && code !== 0) {
            clearTimeout(timeout);
            reject(new Error(`Stub exited with code ${code}`));
          }
        });
      });

      expect(stubProcess.pid).toBeDefined();
      expect(stubProcess.killed).toBe(false);
    }, 20000);

    test('should handle MCP initialization sequence', async () => {
      const stubPath = path.join(__dirname, '../../src/index-auto-stub.js');
      
      stubProcess = spawn('node', [stubPath], {
        env: {
          ...process.env,
          AIUR_SERVER_PORT: testPort.toString(),
          AIUR_VERBOSE: 'false'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Send MCP initialization message
      const initMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      };

      // Wait for process to be ready for input
      await new Promise(resolve => setTimeout(resolve, 2000));

      stubProcess.stdin.write(JSON.stringify(initMessage) + '\n');

      // Wait for initialization response
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Initialization response timeout'));
        }, 10000);

        let buffer = '';
        
        stubProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          
          // Look for complete JSON-RPC message
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('"id":1')) {
              try {
                const response = JSON.parse(line.trim());
                if (response.id === 1) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (e) {
                // Continue parsing
              }
            }
          }
        });

        stubProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            server: expect.any(Object)
          },
          serverInfo: {
            name: "aiur",
            version: expect.any(String)
          }
        }
      });
    }, 15000);
  });

  describe('MCP Tool Execution', () => {
    let mcpConnection;

    beforeEach(async () => {
      const stubPath = path.join(__dirname, '../../src/index-auto-stub.js');
      
      stubProcess = spawn('node', [stubPath], {
        env: {
          ...process.env,
          AIUR_SERVER_PORT: testPort.toString(),
          AIUR_VERBOSE: 'false'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Initialize MCP connection
      await new Promise(resolve => setTimeout(resolve, 3000));

      const initMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };

      stubProcess.stdin.write(JSON.stringify(initMessage) + '\n');

      // Wait for init response
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Init timeout')), 5000);
        
        stubProcess.stdout.on('data', (data) => {
          if (data.toString().includes('"id":1')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      mcpConnection = {
        send: (message) => {
          stubProcess.stdin.write(JSON.stringify(message) + '\n');
        },
        waitForResponse: (id) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Response timeout for id ${id}`));
            }, 10000);

            let buffer = '';
            
            const dataHandler = (data) => {
              buffer += data.toString();
              const lines = buffer.split('\n');
              
              for (const line of lines) {
                if (line.trim() && line.includes(`"id":${id}`)) {
                  try {
                    const response = JSON.parse(line.trim());
                    if (response.id === id) {
                      clearTimeout(timeout);
                      stubProcess.stdout.removeListener('data', dataHandler);
                      resolve(response);
                      return;
                    }
                  } catch (e) {
                    // Continue parsing
                  }
                }
              }
            };

            stubProcess.stdout.on('data', dataHandler);
          });
        }
      };
    });

    test('should execute context_add tool via MCP', async () => {
      const toolCall = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "context_add",
          arguments: {
            name: "test_data",
            data: {
              message: "Hello from MCP test",
              timestamp: new Date().toISOString(),
              nested: {
                value: 42,
                array: [1, 2, 3]
              }
            },
            description: "Test data from end-to-end MCP test"
          }
        }
      };

      mcpConnection.send(toolCall);
      const response = await mcpConnection.waitForResponse(2);

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 2,
        result: {
          content: [{
            type: "text",
            text: expect.stringContaining("Context item 'test_data' added successfully")
          }]
        }
      });
    });

    test('should execute context_list tool via MCP', async () => {
      // First add some context
      const addCall = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "context_add",
          arguments: {
            name: "item1",
            data: { value: "first item" },
            description: "First test item"
          }
        }
      };

      mcpConnection.send(addCall);
      await mcpConnection.waitForResponse(3);

      // Then list context
      const listCall = {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "context_list",
          arguments: {}
        }
      };

      mcpConnection.send(listCall);
      const response = await mcpConnection.waitForResponse(4);

      expect(response.result.content).toHaveLength(1);
      expect(response.result.content[0].type).toBe("text");
      
      const contextList = JSON.parse(response.result.content[0].text);
      expect(Array.isArray(contextList)).toBe(true);
      expect(contextList.length).toBeGreaterThan(0);
      
      const item1 = contextList.find(item => item.name === 'item1');
      expect(item1).toBeDefined();
      expect(item1.data.value).toBe('first item');
    });

    test('should handle context_get tool via MCP', async () => {
      // First add context
      const addCall = {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "context_add",
          arguments: {
            name: "get_test",
            data: { 
              complex: {
                nested: {
                  data: "retrieved successfully",
                  numbers: [10, 20, 30]
                }
              }
            },
            description: "Data for get test"
          }
        }
      };

      mcpConnection.send(addCall);
      await mcpConnection.waitForResponse(5);

      // Then get the context
      const getCall = {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "context_get",
          arguments: {
            name: "get_test"
          }
        }
      };

      mcpConnection.send(getCall);
      const response = await mcpConnection.waitForResponse(6);

      expect(response.result.content).toHaveLength(1);
      const contextData = JSON.parse(response.result.content[0].text);
      
      expect(contextData.name).toBe('get_test');
      expect(contextData.data.complex.nested.data).toBe('retrieved successfully');
      expect(contextData.data.complex.nested.numbers).toEqual([10, 20, 30]);
    });

    test('should handle tool execution errors via MCP', async () => {
      const invalidCall = {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "nonexistent_tool",
          arguments: {}
        }
      };

      mcpConnection.send(invalidCall);
      const response = await mcpConnection.waitForResponse(7);

      expect(response.result.isError).toBe(true);
      expect(response.result.content).toHaveLength(1);
      expect(response.result.content[0].text).toContain('Error:');
    });
  });

  describe('MCP Session Management', () => {
    test('should maintain session state across multiple tool calls', async () => {
      const stubPath = path.join(__dirname, '../../src/index-auto-stub.js');
      
      stubProcess = spawn('node', [stubPath], {
        env: {
          ...process.env,
          AIUR_SERVER_PORT: testPort.toString(),
          AIUR_VERBOSE: 'false'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Initialize connection
      const initMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "session-test-client", version: "1.0.0" }
        }
      };

      stubProcess.stdin.write(JSON.stringify(initMessage) + '\n');
      
      // Wait for init
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Init timeout')), 5000);
        stubProcess.stdout.on('data', (data) => {
          if (data.toString().includes('"id":1')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      // Helper function to send and wait for response
      const sendAndWait = async (message) => {
        stubProcess.stdin.write(JSON.stringify(message) + '\n');
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for response to ${message.id}`));
          }, 5000);

          let buffer = '';
          
          const dataHandler = (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            
            for (const line of lines) {
              if (line.trim() && line.includes(`"id":${message.id}`)) {
                try {
                  const response = JSON.parse(line.trim());
                  if (response.id === message.id) {
                    clearTimeout(timeout);
                    stubProcess.stdout.removeListener('data', dataHandler);
                    resolve(response);
                    return;
                  }
                } catch (e) {
                  // Continue parsing
                }
              }
            }
          };

          stubProcess.stdout.on('data', dataHandler);
        });
      };

      // Add multiple context items
      const addCalls = [
        {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "context_add",
            arguments: {
              name: "session_item_1",
              data: { session: "test", item: 1 },
              description: "First session item"
            }
          }
        },
        {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "context_add",
            arguments: {
              name: "session_item_2", 
              data: { session: "test", item: 2 },
              description: "Second session item"
            }
          }
        },
        {
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: {
            name: "context_add",
            arguments: {
              name: "session_item_3",
              data: { session: "test", item: 3 },
              description: "Third session item"
            }
          }
        }
      ];

      // Execute all add calls
      for (const call of addCalls) {
        const response = await sendAndWait(call);
        expect(response.result.content[0].text).toContain('added successfully');
      }

      // List all context items
      const listCall = {
        jsonrpc: "2.0",
        id: 13,
        method: "tools/call",
        params: {
          name: "context_list",
          arguments: {}
        }
      };

      const listResponse = await sendAndWait(listCall);
      const contextList = JSON.parse(listResponse.result.content[0].text);
      
      expect(contextList).toHaveLength(3);
      
      const itemNames = contextList.map(item => item.name).sort();
      expect(itemNames).toEqual(['session_item_1', 'session_item_2', 'session_item_3']);

      // Verify each item maintains its data
      for (let i = 1; i <= 3; i++) {
        const getCall = {
          jsonrpc: "2.0",
          id: 13 + i,
          method: "tools/call",
          params: {
            name: "context_get",
            arguments: {
              name: `session_item_${i}`
            }
          }
        };

        const getResponse = await sendAndWait(getCall);
        const itemData = JSON.parse(getResponse.result.content[0].text);
        
        expect(itemData.data.item).toBe(i);
        expect(itemData.data.session).toBe('test');
      }
    }, 25000);
  });
});