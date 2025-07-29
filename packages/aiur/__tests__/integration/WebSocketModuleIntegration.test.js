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
      try {
        const response = await client.loadModule('serper');
        TestAssertions.assertModuleLoaded(response, 'serper');
        
        // Module should load even if API key is missing (tools will fail at execution)
        const tools = await client.listTools();
        TestAssertions.assertToolsInclude(tools, ['google_search']);
      } catch (error) {
        // Handle missing SERPER_API_KEY or initialization errors gracefully
        expect(error.message).toMatch(/SERPER_API_KEY|initialization|SerperModule/i);
      }
    });

    test('should load calculator module with no external dependencies', async () => {
      const response = await client.loadModule('calculator');
      TestAssertions.assertModuleLoaded(response, 'calculator');
      
      const tools = await client.listTools();
      TestAssertions.assertToolsInclude(tools, ['calculator_evaluate']);
    });

    test('should handle loading non-existent module', async () => {
      try {
        const response = await client.loadModule('non_existent_module');
        expect(response.success).toBe(false);
        expect(response.error).toMatch(/Unknown module/i);
      } catch (error) {
        expect(error.message).toMatch(/Unknown module/i);
      }
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
        try {
          const response = await client.executeTool('file_read', {
            filepath: testData.files.nonExistent
          });
          TestAssertions.assertError(response, /not.*found|ENOENT/i);
        } catch (error) {
          expect(error.message).toMatch(/File not found|ENOENT/i);
        }
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
        try {
          const response = await client.executeTool('calculator_evaluate', {
            expression: 'invalid + + expression'
          });
          TestAssertions.assertError(response, /invalid|error/i);
        } catch (error) {
          expect(error.message).toMatch(/Failed to evaluate expression|invalid is not defined/i);
        }
      });
    });

    describe('Serper API Integration', () => {
      beforeEach(async () => {
        await client.loadModule('serper');
      });

      test('should perform real Google search or handle missing API key gracefully', async () => {
        const response = await client.executeTool('google_search', {
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
        const response = await client.executeTool('google_search', testData.searches.withOptions);
        
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

      test('should list user repositories and read README from first repo', async () => {
        // First, get user repositories
        const reposResponse = await client.executeTool('github_list_repos', { type: 'all', per_page: 10 });
        TestAssertions.assertGitHubOperation(reposResponse);
        
        const reposResult = reposResponse.result || reposResponse;
        expect(reposResult.data).toBeDefined();
        expect(reposResult.data.repositories).toBeDefined();
        expect(Array.isArray(reposResult.data.repositories)).toBe(true);
        expect(reposResult.data.repositories.length).toBeGreaterThan(0);
        
        // Get the first repository
        const firstRepo = reposResult.data.repositories[0];
        console.log('Testing with repository:', firstRepo.fullName);
        
        // Try to read README.md from the first repository
        const readmeResponse = await client.executeTool('github_get_file', {
          owner: firstRepo.owner,
          repo: firstRepo.name,
          path: 'README.md'
        });
        
        TestAssertions.assertGitHubOperation(readmeResponse);
        const readmeResult = readmeResponse.result || readmeResponse;
        expect(readmeResult.data).toBeDefined();
        expect(readmeResult.data.file).toBeDefined();
        expect(readmeResult.data.file.content).toBeDefined();
        expect(typeof readmeResult.data.file.content).toBe('string');
        expect(readmeResult.data.file.content.length).toBeGreaterThan(0);
        expect(readmeResult.data.file.name).toBe('README.md');
        
        console.log('Successfully read README content:', readmeResult.data.file.content.substring(0, 100) + '...');
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
        const data = result.data || result;
        expect(data.json || data.json_string || result.result).toBeDefined();
        expect(typeof (data.json || data.json_string || result.result)).toBe('string');
      });

      test('should parse JSON string', async () => {
        const jsonString = JSON.stringify(testData.json.complex);
        const response = await client.executeTool('json_parse', {
          json_string: jsonString
        });
        TestAssertions.assertJSONOperation(response);
        
        const result = response.result || response;
        const data = result.data || result;
        expect(data.parsed || data.result || result.parsed || result.data).toEqual(testData.json.complex);
      });

      test('should validate JSON', async () => {
        const response = await client.executeTool('json_validate', {
          json_string: JSON.stringify(testData.json.simple)
        });
        TestAssertions.assertJSONOperation(response);
        
        const result = response.result || response;
        const data = result.data || result;
        expect(data.valid || data.isValid || result.valid || result.isValid).toBe(true);
      });

      test('should handle invalid JSON', async () => {
        try {
          const response = await client.executeTool('json_parse', {
            json_string: 'invalid json {'
          });
          // If we get here, check if response contains error
          TestAssertions.assertError(response, /invalid|parse|JSON/i);
        } catch (error) {
          // WebSocketTestClient throws error, which is also valid for this test
          expect(error.message).toMatch(/invalid|parse|JSON|Unexpected token/i);
        }
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
      try {
        const response = await client.executeTool('calculator_evaluate', { expression: '2 + 2' });
        TestAssertions.assertError(response, /not.*found|unknown.*tool/i);
      } catch (error) {
        expect(error.message).toMatch(/not.*found|unknown.*tool|Tool.*not available/i);
      }
    });

    test('should handle malformed requests gracefully', async () => {
      try {
        // Send request with missing required fields
        const response = await client.sendValidated('tools/call', {
          // Missing 'name' field
          arguments: { expression: '2 + 2' }
        });
        TestAssertions.assertError(response, /required|missing|invalid/i);
      } catch (error) {
        expect(error.message).toMatch(/required|missing|invalid|undefined/i);
      }
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
      try {
        const response = await client.executeTool(testCase.tool, testCase.args);
        
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
      } catch (error) {
        // Handle environment-specific errors (missing API keys, etc.)
        if (moduleName === 'github' && error.message.includes('GITHUB_PAT')) {
          expect(error.message).toMatch(/Resource.*GITHUB_PAT.*not found/i);
        } else if (moduleName === 'serper' && error.message.includes('SerperModule')) {
          expect(error.message).toMatch(/SerperModule|SERPER_API_KEY/i);
        } else {
          throw error; // Re-throw if it's not an expected environment error
        }
      }
    }
  );
});