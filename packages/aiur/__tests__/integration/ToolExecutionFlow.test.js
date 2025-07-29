/**
 * Tool Execution Flow Integration Tests
 * 
 * Tests complete tool execution workflows including module loading,
 * tool execution, and response handling with real service calls.
 */

import { jest } from '@jest/globals';
import { TestServer } from '../helpers/TestServer.js';
import { TestClient } from '../helpers/TestClient.js';
import { TestAssertions } from '../helpers/TestAssertions.js';
import { testData } from '../fixtures/testSchemas.js';
import { tmpdir } from 'os';
import { join } from 'path';

// Extended timeout for integration tests with real service calls
jest.setTimeout(60000);

describe('Tool Execution Flow Integration', () => {
  let testServer;
  let client;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    console.log('Tool execution test server started');
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
      console.log('Tool execution test server stopped');
    }
  });

  beforeEach(async () => {
    client = new TestClient();
    await client.connect(testServer.getWebSocketUrl());
    await client.waitForMessage('welcome');
    await client.createSession();
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Basic Tool Operations', () => {
    test('should list available tools initially', async () => {
      const response = await client.listTools();
      
      TestAssertions.assertToolResponse(response, true);
      
      const result = response.result;
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      
      console.log(`Initially available tools: ${result.tools.length}`);
      result.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    });

    test('should handle tool execution before module loading', async () => {
      // Try to execute calculator without loading module
      try {
        const response = await client.executeTool('calculator_evaluate', { 
          expression: '2 + 2' 
        });
        
        // Should either work (if module auto-loaded) or fail appropriately
        if (response.error || (response.result && response.result.error)) {
          console.log('Tool execution failed as expected (module not loaded)');
          expect(response.error || response.result.error).toBeDefined();
        } else {
          console.log('Tool execution succeeded (module was available)');
          TestAssertions.assertToolResponse(response, true);
        }
      } catch (error) {
        console.log('Tool execution threw error as expected:', error.message);
        expect(error.message).toMatch(/not.*found|unknown.*tool|not available/i);
      }
    });
  });

  describe('Module Loading', () => {
    test('should load calculator module successfully', async () => {
      const response = await client.loadModule('calculator');
      
      TestAssertions.assertModuleLoaded(response, 'calculator');
      
      console.log('Calculator module loaded successfully');
    });

    test('should load file module successfully', async () => {
      const response = await client.loadModule('file');
      
      TestAssertions.assertModuleLoaded(response, 'file');
      
      console.log('File module loaded successfully');
    });

    test('should load json module successfully', async () => {
      const response = await client.loadModule('json');
      
      TestAssertions.assertModuleLoaded(response, 'json');
      
      console.log('JSON module loaded successfully');
    });

    test('should handle loading non-existent module', async () => {
      try {
        const response = await client.loadModule('non_existent_module');
        
        // Should fail with appropriate error  
        TestAssertions.assertToolResponse(response, false);
        expect(response.result.error || response.error.message).toMatch(/unknown.*module|not.*found/i);
      } catch (error) {
        expect(error.message).toMatch(/unknown.*module|not.*found/i);
        console.log('Non-existent module load failed as expected');
      }
    });
  });

  describe('Calculator Tool Execution', () => {
    beforeEach(async () => {
      await client.loadModule('calculator');
    });

    test.each(testData.calculations)(
      'should calculate $expression = $expected',
      async ({ expression, expected }) => {
        const response = await client.executeTool('calculator_evaluate', { 
          expression 
        });
        
        TestAssertions.assertCalculationResult(response, expected);
        
        console.log(`✓ ${expression} = ${expected}`);
      }
    );

    test('should handle invalid calculation', async () => {
      try {
        const response = await client.executeTool('calculator_evaluate', {
          expression: 'invalid + + expression'
        });
        
        TestAssertions.assertToolResponse(response, false);
        expect(response.result.error || response.error.message).toMatch(/invalid|error/i);
      } catch (error) {
        expect(error.message).toMatch(/invalid|error|not defined/i);
        console.log('Invalid calculation failed as expected');
      }
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      await client.loadModule('file');
    });

    test('should write and read file', async () => {
      const testFile = join(tmpdir(), 'aiur-test-file.txt');
      const testContent = testData.files.testContent;
      
      try {
        // Write file
        const writeResponse = await client.executeTool('file_write', {
          filepath: testFile,
          content: testContent
        });
        
        TestAssertions.assertFileOperation(writeResponse, true);
        
        // Read file back
        const readResponse = await client.executeTool('file_read', {
          filepath: testFile
        });
        
        TestAssertions.assertFileOperation(readResponse, true);
        
        const result = readResponse.result;
        const actualContent = result.data?.content || result.content;
        expect(actualContent).toBe(testContent);
        
        console.log('File write/read cycle successful');
      } catch (error) {
        console.error('File operation failed:', error.message);
        throw error;
      }
    });

    test('should list directory contents', async () => {
      const testDir = tmpdir();
      
      const response = await client.executeTool('directory_list', {
        directory: testDir
      });
      
      TestAssertions.assertFileOperation(response, true);
      
      const result = response.result;
      const contents = result.data?.contents || result.files || result.items;
      expect(Array.isArray(contents)).toBe(true);
      
      console.log(`Directory listing successful: ${contents.length} items`);
    });

    test('should handle file not found', async () => {
      const nonExistentFile = join(tmpdir(), 'non-existent-file.txt');
      
      try {
        const response = await client.executeTool('file_read', {
          filepath: nonExistentFile
        });
        
        TestAssertions.assertFileOperation(response, false);
        expect(response.result.error || response.error.message).toMatch(/not.*found|ENOENT/i);
      } catch (error) {
        expect(error.message).toMatch(/not.*found|ENOENT/i);
        console.log('File not found handled correctly');
      }
    });
  });

  describe('JSON Operations', () => {
    beforeEach(async () => {
      await client.loadModule('json');
    });

    test('should stringify JSON object', async () => {
      const testObject = { name: 'test', value: 123, nested: { key: 'value' } };
      
      const response = await client.executeTool('json_stringify', {
        object: testObject,
        indent: 2
      });
      
      TestAssertions.assertToolResponse(response, true);
      
      const result = response.result;
      const jsonString = result.data?.json || result.json_string || result.result;
      expect(typeof jsonString).toBe('string');
      expect(jsonString).toContain('"name"');
      expect(jsonString).toContain('"test"');
      
      console.log('JSON stringify successful');
    });

    test('should parse JSON string', async () => {
      const testObject = { message: 'hello', count: 42 };
      const jsonString = JSON.stringify(testObject);
      
      const response = await client.executeTool('json_parse', {
        json_string: jsonString
      });
      
      TestAssertions.assertToolResponse(response, true);
      
      const result = response.result;
      const parsedObject = result.data?.parsed || result.result || result.parsed || result.data;
      expect(parsedObject).toEqual(testObject);
      
      console.log('JSON parse successful');
    });

    test('should validate valid JSON', async () => {
      const validJson = JSON.stringify({ valid: true });
      
      const response = await client.executeTool('json_validate', {
        json_string: validJson
      });
      
      TestAssertions.assertToolResponse(response, true);
      
      const result = response.result;
      const isValid = result.data?.valid || result.valid || result.isValid;
      expect(isValid).toBe(true);
      
      console.log('JSON validation successful');
    });

    test('should handle invalid JSON', async () => {
      try {
        const response = await client.executeTool('json_parse', {
          json_string: 'invalid json {'
        });
        
        TestAssertions.assertToolResponse(response, false);
        expect(response.result.error || response.error.message).toMatch(/invalid|parse|JSON/i);
      } catch (error) {
        expect(error.message).toMatch(/invalid|parse|JSON|Unexpected token/i);
        console.log('Invalid JSON handled correctly');
      }
    });
  });

  describe('Tool Discovery After Module Loading', () => {
    test('should show increased tool count after loading modules', async () => {
      // Get initial tool count
      const initialResponse = await client.listTools();
      const initialCount = initialResponse.result.tools.length;
      
      // Load calculator module
      await client.loadModule('calculator');
      
      // Get updated tool count
      const updatedResponse = await client.listTools();
      const updatedCount = updatedResponse.result.tools.length;
      
      expect(updatedCount).toBeGreaterThan(initialCount);
      
      console.log(`Tool count increased from ${initialCount} to ${updatedCount}`);
    });

    test('should show specific tools after module loading', async () => {
      await client.loadModule('calculator');
      
      const response = await client.listTools();
      const tools = response.result.tools;
      
      const calculatorTool = tools.find(t => t.name === 'calculator_evaluate');
      expect(calculatorTool).toBeDefined();
      expect(calculatorTool.description).toBeDefined();
      
      console.log('Calculator tool found:', calculatorTool.name);
    });
  });
});