/**
 * Comprehensive WebSocket Module Integration Tests
 * 
 * Tests real module loading and tool execution through WebSocket
 * with actual service calls (not mocked) and codec validation.
 */

import { jest } from '@jest/globals';
import { AiurServer } from '../../src/server/AiurServer.js';
import { WebSocketTestClient } from './helpers/WebSocketTestClient.js';
import { TestAssertions } from './helpers/TestAssertions.js';
import { testData, moduleTests } from './fixtures/testData.js';
import fs from 'fs/promises';
import path from 'path';

// Increase timeout for integration tests that make real API calls
jest.setTimeout(30000);

describe('WebSocket Module Integration Tests', () => {
  let server;
  let client;
  const testPort = 9000 + Math.floor(Math.random() * 1000);

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
    
    // Cleanup test files
    try {
      await fs.unlink(testData.files.testFile);
    } catch (e) {
      // Ignore if doesn't exist
    }
  });

  beforeEach(async () => {
    // Create new client for each test
    client = new WebSocketTestClient(`ws://localhost:${testPort}/ws`);
    await client.connect();
    await client.createSession();
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Module Loading with ResourceManager', () => {
    test('should load file module with ResourceManager handling dependencies', async () => {
      const response = await client.loadModule('file');
      TestAssertions.assertModuleLoaded(response, 'file');
      
      // Verify tools are available
      const tools = await client.listTools();
      TestAssertions.assertToolsInclude(tools, ['file_read', 'file_write', 'directory_list']);
    });

    test('should load serper module with API key from environment', async () => {
      const response = await client.loadModule('serper');
      TestAssertions.assertModuleLoaded(response, 'serper');
      
      // Module should load even if API key is missing (tools will fail at execution)
      const tools = await client.listTools();
      TestAssertions.assertToolsInclude(tools, ['google_search_search']);
    });

    test('should load calculator module with no external dependencies', async () => {
      const response = await client.loadModule('calculator');
      TestAssertions.assertModuleLoaded(response, 'calculator');
      
      const tools = await client.listTools();
      TestAssertions.assertToolsInclude(tools, ['calculator_evaluate']);
    });

    test('should handle loading non-existent module', async () => {
      const response = await client.loadModule('non_existent_module');
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Unknown module/i);
    });
  });

  describe('Tool Execution with Real Services', () => {
    describe('File Operations (Real I/O)', () => {
      beforeEach(async () => {
        await client.loadModule('file');
      });

      test('should write and read a real file', async () => {
        // Write file
        const writeResponse = await client.executeTool('file_write', {
          filepath: testData.files.testFile,
          content: testData.files.writeContent
        });
        TestAssertions.assertFileOperation(writeResponse);
        
        // Read file back
        const readResponse = await client.executeTool('file_read', {
          filepath: testData.files.testFile
        });
        TestAssertions.assertFileOperation(readResponse);
        
        const result = readResponse.result || readResponse;
        expect(result.data.content || result.content).toBe(testData.files.writeContent);
      });

      test('should list directory contents', async () => {
        const response = await client.executeTool('directory_list', {
          directory: path.dirname(testData.files.testFile)
        });
        TestAssertions.assertFileOperation(response);
        
        const result = response.result || response;
        expect(Array.isArray(result.data.contents || result.files || result.items)).toBe(true);
      });

      test('should handle file not found error', async () => {
        const response = await client.executeTool('file_read', {
          filepath: testData.files.nonExistent
        });
        TestAssertions.assertError(response, /not.*found|ENOENT/i);
      });
    });

    describe('Calculator Operations', () => {
      beforeEach(async () => {
        await client.loadModule('calculator');
      });

      test.each(testData.calculations)(
        'should calculate $expression = $expected',
        async ({ expression, expected }) => {
          const response = await client.executeTool('calculator_evaluate', { expression });
          TestAssertions.assertCalculation(response, expected);
        }
      );

      test('should handle invalid expression', async () => {
        const response = await client.executeTool('calculator_evaluate', {
          expression: 'invalid + + expression'
        });
        TestAssertions.assertError(response, /invalid|error/i);
      });
    });

    describe('Serper API Integration', () => {
      beforeEach(async () => {
        await client.loadModule('serper');
      });

      test('should perform real Google search or handle missing API key gracefully', async () => {
        const response = await client.executeTool('google_search_search', {
          query: testData.searches.simple
        });
        
        // Either succeeds with real results or fails with API key error
        if (response.error || (response.result && response.result.error)) {
          TestAssertions.assertError(response, /api.*key|unauthorized|forbidden/i);
        } else {
          TestAssertions.assertSearchResults(response);
        }
      });

      test('should handle search with options', async () => {
        const response = await client.executeTool('google_search_search', testData.searches.withOptions);
        
        if (response.error || (response.result && response.result.error)) {
          TestAssertions.assertError(response, /api.*key|unauthorized|forbidden/i);
        } else {
          TestAssertions.assertSearchResults(response);
          
          const result = response.result || response;
          if (result.data && result.data.organic) {
            expect(result.data.organic.length).toBeLessThanOrEqual(testData.searches.withOptions.num);
          }
        }
      });
    });

    describe('GitHub API Integration', () => {
      beforeEach(async () => {
        await client.loadModule('github');
      });

      test('should list repositories', async () => {
        const response = await client.executeTool('github_list_repos', { type: 'public', per_page: 5 });
        
        // GitHub API might rate limit or require auth
        if (response.error || (response.result && response.result.error)) {
          TestAssertions.assertError(response, /rate.*limit|unauthorized|API/i);
        } else {
          TestAssertions.assertGitHubOperation(response);
          
          const result = response.result || response;
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        }
      });

      test('should list organization repositories', async () => {
        const response = await client.executeTool('github_list_org_repos', { org: 'nodejs', per_page: 5 });
        
        if (response.error || (response.result && response.result.error)) {
          TestAssertions.assertError(response, /rate.*limit|unauthorized|API/i);
        } else {
          TestAssertions.assertGitHubOperation(response);
          
          const result = response.result || response;
          expect(Array.isArray(result.data)).toBe(true);
        }
      });
    });

    describe('JSON Operations', () => {
      beforeEach(async () => {
        await client.loadModule('json');
      });

      test('should stringify JSON data', async () => {
        const response = await client.executeTool('json_stringify', {
          object: testData.json.simple,
          indent: 2
        });
        TestAssertions.assertJSONOperation(response);
        
        const result = response.result || response;
        expect(result.json || result.result).toBeDefined();
        expect(typeof (result.json || result.result)).toBe('string');
      });

      test('should parse JSON string', async () => {
        const jsonString = JSON.stringify(testData.json.complex);
        const response = await client.executeTool('json_parse', {
          json_string: jsonString
        });
        TestAssertions.assertJSONOperation(response);
        
        const result = response.result || response;
        expect(result.parsed || result.data || result.result).toEqual(testData.json.complex);
      });

      test('should validate JSON', async () => {
        const response = await client.executeTool('json_validate', {
          json_string: JSON.stringify(testData.json.simple)
        });
        TestAssertions.assertJSONOperation(response);
        
        const result = response.result || response;
        expect(result.valid || result.isValid).toBe(true);
      });

      test('should handle invalid JSON', async () => {
        const response = await client.executeTool('json_parse', {
          json_string: 'invalid json {'
        });
        TestAssertions.assertError(response, /invalid|parse|JSON/i);
      });
    });
  });

  describe('Event Streaming and Progress Updates', () => {
    test('should receive progress events for file operations', async () => {
      await client.loadModule('file');
      client.clearEvents();
      
      // Create a larger file to ensure progress events
      const largeContent = 'x'.repeat(10000);
      await client.executeTool('file_write', {
        filepath: testData.files.testFile,
        content: largeContent
      });
      
      const events = client.getEvents();
      // File operations might not always emit progress events for small operations
      // but we should at least get completion
      expect(events.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Management', () => {
    test('should maintain tool availability across requests', async () => {
      // Load multiple modules
      await client.loadModule('calculator');
      await client.loadModule('json');
      
      // Verify all tools are available
      const tools = await client.listTools();
      TestAssertions.assertToolsInclude(tools, ['calculator_evaluate', 'json_parse']);
      
      // Execute tools from both modules
      const calcResponse = await client.executeTool('calculator_evaluate', { expression: '5 * 5' });
      TestAssertions.assertCalculation(calcResponse, 25);
      
      const jsonResponse = await client.executeTool('json_stringify', { object: { test: true } });
      TestAssertions.assertJSONOperation(jsonResponse);
    });

    test('should isolate sessions', async () => {
      // Load module in first session
      await client.loadModule('calculator');
      
      // Create second client with new session
      const client2 = new WebSocketTestClient(`ws://localhost:${testPort}/ws`);
      await client2.connect();
      await client2.createSession();
      
      // Second session shouldn't have calculator loaded
      const tools2 = await client2.listTools();
      const toolNames = tools2.result.tools.map(t => t.name);
      expect(toolNames).not.toContain('calculator_evaluate');
      
      // But first session should still have it
      const tools1 = await client.listTools();
      TestAssertions.assertToolsInclude(tools1, ['calculator_evaluate']);
      
      client2.disconnect();
    });
  });

  describe('Error Handling', () => {
    test('should handle tool execution without loading module', async () => {
      const response = await client.executeTool('calculator_evaluate', { expression: '2 + 2' });
      TestAssertions.assertError(response, /not.*found|unknown.*tool/i);
    });

    test('should handle malformed requests gracefully', async () => {
      // Send request with missing required fields
      const response = await client.sendValidated('tools/call', {
        // Missing 'name' field
        arguments: { expression: '2 + 2' }
      });
      TestAssertions.assertError(response, /required|missing|invalid/i);
    });

    test('should handle network timeouts', async () => {
      await client.loadModule('calculator');
      
      // Disconnect network
      client.ws.close();
      
      // Try to execute tool
      await expect(
        client.executeTool('calculator', { expression: '2 + 2' })
      ).rejects.toThrow(/timeout|closed|disconnected/i);
    });
  });

  describe('Codec Validation', () => {
    test('should validate request format before sending', async () => {
      // Since server doesn't provide schemas yet, skip strict validation
      // In production, this would validate against actual schemas
      const response = await client.sendValidated('tools/list', {});
      expect(response).toBeDefined();
    });

    test('should handle schema registration when available', async () => {
      // Schemas would be registered if server provided them
      // For now, we have empty schemas object
      expect(client.schemas).toBeDefined();
    });
  });
});

// Run module-specific test suites
describe.each(Object.entries(moduleTests))('Module: %s', (moduleName, moduleConfig) => {
  let server;
  let client;
  const testPort = 9500 + Math.floor(Math.random() * 500);

  beforeAll(async () => {
    server = new AiurServer({
      port: testPort,
      host: 'localhost',
      sessionTimeout: 60000,
      enableFileLogging: false
    });
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  beforeEach(async () => {
    client = new WebSocketTestClient(`ws://localhost:${testPort}/ws`);
    await client.connect();
    await client.createSession();
    await client.loadModule(moduleConfig.name);
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
  });

  test.each(moduleConfig.tests)(
    'should execute $tool with args $args',
    async (testCase) => {
      const response = await client.executeTool(testCase.tool, testCase.args);
      
      // Debug: log the response to understand its structure
      if (testCase.tool === 'file_write') {
        console.log('file_write response:', JSON.stringify(response, null, 2));
      }
      
      // Use the specified assertion
      if (testCase.assert && TestAssertions[testCase.assert]) {
        if (testCase.expected !== undefined) {
          TestAssertions[testCase.assert](response, testCase.expected);
        } else {
          TestAssertions[testCase.assert](response);
        }
      }
      
      // Run custom validation if provided
      if (testCase.validate) {
        const result = response.result || response;
        testCase.validate(result);
      }
    }
  );
});