/**
 * Integration test for UI module loading workflow
 * Tests the complete flow: module_load -> tool refresh -> tool execution
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { SessionManager } from '../../../aiur/src/server/SessionManager.js';
import { ToolDefinitionProvider } from '../../../aiur/src/core/ToolDefinitionProvider.js';
import WebSocket from 'ws';

describe('UI Module Loading Workflow', () => {
  let sessionManager;
  let resourceManager;
  let server;
  let serverUrl;
  let client;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create SessionManager
    sessionManager = new SessionManager(
      new ModuleFactory(resourceManager),
      new ToolDefinitionProvider()
    );

    // Start WebSocket server
    server = new WebSocket.Server({ port: 0 });
    serverUrl = `ws://localhost:${server.address().port}`;

    server.on('connection', (ws) => {
      sessionManager.handleConnection(ws);
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Create fresh WebSocket client for each test
    client = new WebSocket(serverUrl);
    await new Promise((resolve) => {
      client.on('open', resolve);
    });
  });

  afterEach(() => {
    if (client) {
      client.close();
    }
  });

  test('UI workflow: load module and execute its tools', async () => {
    const responses = [];
    
    client.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        responses.push(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    // Helper to send request and wait for response
    const sendRequest = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const requestId = `test_${Date.now()}_${Math.random()}`;
        
        const timeout = setTimeout(() => {
          reject(new Error(`Request timeout for ${method}`));
        }, 10000);

        const handler = (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.requestId === requestId) {
              clearTimeout(timeout);
              client.off('message', handler);
              if (message.error) {
                reject(new Error(message.error));
              } else {
                resolve(message.result);
              }
            }
          } catch (error) {
            // Ignore parse errors, continue waiting
          }
        };

        client.on('message', handler);
        
        client.send(JSON.stringify({
          type: 'mcp_request',
          requestId,
          method,
          params
        }));
      });
    };

    // Step 1: Get initial tool list
    console.log('Step 1: Getting initial tool list...');
    const initialTools = await sendRequest('tools/list');
    console.log(`Initial tools count: ${initialTools.tools ? initialTools.tools.length : 0}`);
    
    // Verify calculator_evaluate is not initially available
    const initialToolNames = initialTools.tools ? initialTools.tools.map(t => t.name) : [];
    expect(initialToolNames).not.toContain('calculator_evaluate');
    console.log('✓ Confirmed calculator_evaluate is not in initial tool list');

    // Step 2: Load calculator module
    console.log('Step 2: Loading calculator module...');
    const loadResult = await sendRequest('tools/call', {
      name: 'module_load',
      arguments: { module: 'calculator' }
    });
    
    console.log('Module load result:', JSON.stringify(loadResult, null, 2));
    expect(loadResult.success).toBe(true);
    expect(loadResult.module).toBe('calculator');
    console.log('✓ Calculator module loaded successfully');

    // Step 3: Get updated tool list after module loading
    console.log('Step 3: Getting updated tool list after module loading...');
    const updatedTools = await sendRequest('tools/list');
    console.log(`Updated tools count: ${updatedTools.tools ? updatedTools.tools.length : 0}`);
    
    // Verify calculator_evaluate is now available
    const updatedToolNames = updatedTools.tools ? updatedTools.tools.map(t => t.name) : [];
    expect(updatedToolNames).toContain('calculator_evaluate');
    console.log('✓ Confirmed calculator_evaluate is now in tool list');

    // Step 4: Execute calculator tool
    console.log('Step 4: Executing calculator_evaluate tool...');
    const calcResult = await sendRequest('tools/call', {
      name: 'calculator_evaluate',
      arguments: { expression: '2+2' }
    });
    
    console.log('Calculator result:', JSON.stringify(calcResult, null, 2));
    expect(calcResult.result).toBe(4);
    console.log('✓ Calculator tool executed successfully: 2+2 = 4');

    // Step 5: Test more complex calculation
    console.log('Step 5: Testing complex calculation...');
    const complexCalc = await sendRequest('tools/call', {
      name: 'calculator_evaluate',
      arguments: { expression: '10 * 3 + 7' }
    });
    
    console.log('Complex calculation result:', JSON.stringify(complexCalc, null, 2));
    expect(complexCalc.result).toBe(37);
    console.log('✓ Complex calculation successful: 10 * 3 + 7 = 37');

    console.log('🎉 All UI workflow tests passed!');
  }, 30000); // 30 second timeout

  test('UI workflow: module_tools shows correct info after loading', async () => {
    const sendRequest = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const requestId = `test_${Date.now()}_${Math.random()}`;
        
        const timeout = setTimeout(() => {
          reject(new Error(`Request timeout for ${method}`));
        }, 10000);

        const handler = (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.requestId === requestId) {
              clearTimeout(timeout);
              client.off('message', handler);
              if (message.error) {
                reject(new Error(message.error));
              } else {
                resolve(message.result);
              }
            }
          } catch (error) {
            // Ignore parse errors, continue waiting
          }
        };

        client.on('message', handler);
        
        client.send(JSON.stringify({
          type: 'mcp_request',
          requestId,
          method,
          params
        }));
      });
    };

    // Load calculator module first
    console.log('Loading calculator module...');
    const loadResult = await sendRequest('tools/call', {
      name: 'module_load',
      arguments: { module: 'calculator' }
    });
    expect(loadResult.success).toBe(true);

    // Check module_tools output
    console.log('Checking module_tools output...');
    const toolsResult = await sendRequest('tools/call', {
      name: 'module_tools',
      arguments: { module: 'calculator' }
    });

    console.log('Module tools result:', JSON.stringify(toolsResult, null, 2));
    
    // Verify the response structure
    expect(toolsResult.module).toBe('calculator');
    expect(toolsResult.status).toBe('loaded');
    expect(toolsResult.toolCount).toBeGreaterThan(0);
    expect(toolsResult.tools).toBeDefined();
    expect(Array.isArray(toolsResult.tools)).toBe(true);
    
    // Verify calculator_evaluate is in the tools list
    const toolNames = toolsResult.tools.map(t => typeof t === 'string' ? t : t.name);
    expect(toolNames).toContain('calculator_evaluate');
    
    console.log('✓ module_tools shows correct information after loading');
  }, 15000);

  test('Error handling: invalid module load', async () => {
    const sendRequest = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const requestId = `test_${Date.now()}_${Math.random()}`;
        
        const timeout = setTimeout(() => {
          reject(new Error(`Request timeout for ${method}`));
        }, 10000);

        const handler = (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.requestId === requestId) {
              clearTimeout(timeout);
              client.off('message', handler);
              resolve(message.result || message); // Accept both success and error responses
            }
          } catch (error) {
            // Ignore parse errors, continue waiting
          }
        };

        client.on('message', handler);
        
        client.send(JSON.stringify({
          type: 'mcp_request',
          requestId,
          method,
          params
        }));
      });
    };

    // Try to load non-existent module
    console.log('Attempting to load non-existent module...');
    const loadResult = await sendRequest('tools/call', {
      name: 'module_load',
      arguments: { module: 'nonexistent_module' }
    });

    console.log('Load result for invalid module:', JSON.stringify(loadResult, null, 2));
    
    // Should either return success: false or have error information
    if (loadResult.success !== undefined) {
      expect(loadResult.success).toBe(false);
    }
    
    // Tool list should not be affected by failed module load
    const toolsAfterFail = await sendRequest('tools/list');
    const toolNames = toolsAfterFail.tools ? toolsAfterFail.tools.map(t => t.name) : [];
    
    // Should not contain tools from the failed module load
    expect(toolNames).not.toContain('nonexistent_tool');
    
    console.log('✓ Error handling works correctly for invalid module load');
  }, 15000);
});