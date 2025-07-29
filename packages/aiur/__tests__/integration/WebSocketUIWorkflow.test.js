/**
 * WebSocket UI Workflow Integration Tests
 * 
 * This test suite simulates the Aiur Debug UI's WebSocket communication
 * to test the complete workflow from the UI's perspective.
 * 
 * Tests:
 * 1. Session creation
 * 2. Tool listing (should show 4 module management tools)
 * 3. Module loading (module_load)
 * 4. Tool execution after module load
 */

import { jest } from '@jest/globals';
import WebSocket from 'ws';
import { AiurServer } from '../../src/server/AiurServer.js';

// Increase timeout for integration tests
jest.setTimeout(30000);

describe('WebSocket UI Workflow Tests', () => {
  let server;
  let ws;
  let messageId = 1;
  let sessionId;
  const testPort = 8900 + Math.floor(Math.random() * 100);

  // Helper to send a message and wait for response
  const sendMessage = (ws, message) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to: ${JSON.stringify(message)}`));
      }, 5000);

      const handler = (data) => {
        const response = JSON.parse(data);
        console.log('Received:', JSON.stringify(response, null, 2));
        
        // Match response by requestId
        if (response.requestId === message.requestId) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(response);
        }
      };

      ws.on('message', handler);
      console.log('Sending:', JSON.stringify(message, null, 2));
      ws.send(JSON.stringify(message));
    });
  };

  beforeAll(async () => {
    // Start AiurServer
    server = new AiurServer({
      port: testPort,
      host: 'localhost',
      sessionTimeout: 60000,
      enableFileLogging: false
    });
    
    await server.start();
    console.log(`Test server started on port ${testPort}`);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  beforeEach(async () => {
    // Create WebSocket connection
    ws = new WebSocket(`ws://localhost:${testPort}/ws`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });
      ws.on('error', reject);
    });

    // Wait for welcome message
    await new Promise((resolve) => {
      ws.once('message', (data) => {
        const welcome = JSON.parse(data);
        console.log('Welcome message:', welcome);
        expect(welcome.type).toBe('welcome');
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      await new Promise(resolve => ws.on('close', resolve));
    }
  });

  describe('Session Creation', () => {
    test('should create session successfully', async () => {
      const response = await sendMessage(ws, {
        type: 'session_create',
        requestId: `req_${messageId++}`
      });

      expect(response.type).toBe('session_created');
      expect(response.success).toBe(true);
      expect(response.sessionId).toBeDefined();
      expect(response.capabilities).toEqual({
        tools: true,
        context: true,
        handles: true,
        planning: true
      });

      sessionId = response.sessionId;
      console.log('Session created:', sessionId);
    });
  });

  describe('Tool Management', () => {
    beforeEach(async () => {
      // Create session first
      const sessionResponse = await sendMessage(ws, {
        type: 'session_create',
        requestId: `req_${messageId++}`
      });
      sessionId = sessionResponse.sessionId;
    });

    test('should list module management tools', async () => {
      const response = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/list',
        params: {}
      });

      expect(response.type).toBe('mcp_response');
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      
      // Should have 4 module management tools
      console.log('Tools returned:', response.result.tools.length);
      console.log('Tool names:', response.result.tools.map(t => t.name));
      
      expect(response.result.tools.length).toBe(4);
      
      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('module_list');
      expect(toolNames).toContain('module_load');
      expect(toolNames).toContain('module_unload');
      expect(toolNames).toContain('module_tools');
    });

    test('should execute module_list command', async () => {
      const response = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_list',
          arguments: {}
        }
      });

      expect(response.type).toBe('mcp_response');
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.isError).toBe(false);
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.modules).toBeDefined();
      expect(result.modules.available).toContain('serper');
      expect(result.modules.available).toContain('file');
      expect(result.modules.available).toContain('calculator');
    });

    test('should load serper module', async () => {
      // First check tools before loading
      const beforeResponse = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/list',
        params: {}
      });
      
      const beforeCount = beforeResponse.result.tools.length;
      console.log(`Tools before module load: ${beforeCount}`);

      // Load serper module
      const loadResponse = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_load',
          arguments: {
            name: 'serper'
          }
        }
      });

      expect(loadResponse.type).toBe('mcp_response');
      expect(loadResponse.result.isError).toBe(false);
      
      const loadResult = JSON.parse(loadResponse.result.content[0].text);
      console.log('Module load result:', loadResult);
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.module).toBe('serper');
      expect(loadResult.toolsLoaded).toContain('google_search');
      
      // Check tools after loading
      const afterResponse = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/list',
        params: {}
      });
      
      const afterCount = afterResponse.result.tools.length;
      console.log(`Tools after module load: ${afterCount}`);
      
      expect(afterCount).toBeGreaterThan(beforeCount);
      
      const toolNames = afterResponse.result.tools.map(t => t.name);
      expect(toolNames).toContain('google_search');
    });

    test('should execute google_search after loading serper module', async () => {
      // Load serper module first
      await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_load',
          arguments: { name: 'serper' }
        }
      });

      // Execute google_search
      const searchResponse = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'google_search',
          arguments: {
            query: 'test search',
            limit: 1
          }
        }
      });

      expect(searchResponse.type).toBe('mcp_response');
      expect(searchResponse.result).toBeDefined();
      
      // Should either succeed (if API key is valid) or fail with auth error
      const result = JSON.parse(searchResponse.result.content[0].text);
      console.log('Search result:', result);
      
      if (!result.success) {
        // If it fails, should be due to API key
        expect(result.error).toMatch(/unauthorized|api.*key/i);
      } else {
        // If it succeeds, should have results
        expect(result.results).toBeDefined();
      }
    });

    test('should list tools for a specific module', async () => {
      // Load file module
      await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_load',
          arguments: { name: 'file' }
        }
      });

      // List tools for file module
      const response = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_tools',
          arguments: { module: 'file' }
        }
      });

      expect(response.type).toBe('mcp_response');
      expect(response.result.isError).toBe(false);
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.module).toBe('file');
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
      
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('directory_list');
      
      console.log(`File module has ${result.tools.length} tools:`, toolNames);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const sessionResponse = await sendMessage(ws, {
        type: 'session_create',
        requestId: `req_${messageId++}`
      });
      sessionId = sessionResponse.sessionId;
    });

    test('should handle unknown tool gracefully', async () => {
      const response = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'non_existent_tool',
          arguments: {}
        }
      });

      expect(response.type).toBe('mcp_response');
      expect(response.result).toBeDefined();
      
      const errorText = response.result.content?.[0]?.text || response.error?.message;
      expect(errorText).toMatch(/unknown tool|tool not found/i);
    });

    test('should handle module_load with invalid module name', async () => {
      const response = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/call',
        params: {
          name: 'module_load',
          arguments: { name: 'non_existent_module' }
        }
      });

      expect(response.type).toBe('mcp_response');
      expect(response.result.isError).toBe(true);
      
      const result = JSON.parse(response.result.content[0].text);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Debug Empty Tools Issue', () => {
    test('should trace why tools/list returns empty', async () => {
      // Create session
      const sessionResponse = await sendMessage(ws, {
        type: 'session_create',
        requestId: `req_${messageId++}`
      });
      sessionId = sessionResponse.sessionId;
      
      console.log('\n=== Debugging Empty Tools Issue ===');
      console.log('1. Session created:', sessionId);
      
      // List tools with detailed logging
      console.log('2. Sending tools/list request...');
      const toolsResponse = await sendMessage(ws, {
        type: 'mcp_request',
        requestId: `req_${messageId++}`,
        method: 'tools/list',
        params: {}
      });
      
      console.log('3. Tools response:', JSON.stringify(toolsResponse, null, 2));
      
      if (toolsResponse.result?.tools?.length === 0) {
        console.log('ERROR: No tools returned!');
        console.log('Check server logs for:');
        console.log('- [SessionToolProvider] getAllToolDefinitions called');
        console.log('- [SessionToolProvider] Added X module management tools');
        console.log('- Any error messages');
      }
      
      // The test expectation
      expect(toolsResponse.result.tools.length).toBeGreaterThan(0);
    });
  });
});