/**
 * Tests for GenerateUnitTestsTool
 */

import { describe, test, expect } from '@jest/globals';
import { GenerateUnitTestsTool } from '../../src/tools/GenerateUnitTestsTool.js';

describe('GenerateUnitTestsTool', () => {
  let tool;

  beforeEach(() => {
    tool = new GenerateUnitTestsTool();
  });

  test('should have correct tool name and description', () => {
    expect(tool.name).toBe('generate_unit_tests');
    expect(tool.description).toBe('Generate Jest unit tests for JavaScript code');
  });

  test('should generate basic test suite', async () => {
    const args = {
      target_file: './src/utils.js',
      test_cases: [
        {
          function: 'add',
          description: 'should add two numbers',
          args: [2, 3],
          expectations: [
            {
              type: 'toBe',
              expected: 5
            }
          ]
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result).toHaveProperty('test_content');
    expect(result).toHaveProperty('test_path');
    expect(result).toHaveProperty('components');
    
    expect(result.test_content).toContain("import utils from './src/utils.js';");
    expect(result.test_content).toContain("describe('utils', () => {");
    expect(result.test_content).toContain("test('should add two numbers'");
    expect(result.test_content).toContain('expect(result).toBe(5);');
    expect(result.test_path).toBe('__tests__/utils.test.js');
  });

  test('should generate test with mocks', async () => {
    const args = {
      target_file: './src/api.js',
      test_cases: [
        {
          function: 'fetchData',
          description: 'should fetch data successfully',
          expectations: [
            {
              type: 'toBeTruthy'
            }
          ]
        }
      ],
      mocks: [
        {
          module: 'axios',
          functions: ['get'],
          mockImplementation: '() => Promise.resolve({ data: {} })'
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain("import axios from 'axios';");
    expect(result.test_content).toContain('axios.get = jest.fn(() => Promise.resolve({ data: {} }));');
    expect(result.components.has_mocks).toBe(true);
  });

  test('should generate test with setup hooks', async () => {
    const args = {
      target_file: './src/database.js',
      test_cases: [
        {
          function: 'connect',
          description: 'should connect to database',
          expectations: [
            {
              type: 'toBeTruthy'
            }
          ]
        }
      ],
      setup: {
        beforeAll: 'await initTestDatabase();',
        afterAll: 'await cleanupTestDatabase();',
        beforeEach: 'await clearTestData();'
      }
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain('beforeAll(async () => {');
    expect(result.test_content).toContain('await initTestDatabase();');
    expect(result.test_content).toContain('afterAll(async () => {');
    expect(result.test_content).toContain('beforeEach(async () => {');
    expect(result.components.has_setup).toBe(true);
  });

  test('should generate async tests', async () => {
    const args = {
      target_file: './src/async-utils.js',
      async_tests: true,
      test_cases: [
        {
          function: 'fetchUserData',
          description: 'should fetch user data',
          args: [123],
          expectations: [
            {
              type: 'toHaveProperty',
              expected: 'id'
            }
          ]
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain('test(\'should fetch user data\', async () => {');
    expect(result.test_content).toContain('const result = await fetchUserData(123);');
    expect(result.components.has_async).toBe(true);
  });

  test('should generate test with custom expectations', async () => {
    const args = {
      target_file: './src/validator.js',
      test_cases: [
        {
          function: 'validateEmail',
          description: 'should validate email format',
          expectations: [
            {
              type: 'custom',
              code: 'expect(validateEmail("test@example.com")).toBe(true);\n    expect(validateEmail("invalid-email")).toBe(false);'
            }
          ]
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain('expect(validateEmail("test@example.com")).toBe(true);');
    expect(result.test_content).toContain('expect(validateEmail("invalid-email")).toBe(false);');
  });

  test('should generate test with coverage annotations', async () => {
    const args = {
      target_file: './src/math.js',
      coverage: true,
      test_cases: [
        {
          function: 'multiply',
          description: 'should multiply two numbers',
          args: [4, 5],
          expectations: [
            {
              type: 'toBe',
              expected: 20
            }
          ]
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain('// Coverage annotations');
    expect(result.test_content).toContain('// @ts-coverage:ignore-file');
    expect(result.components.coverage_enabled).toBe(true);
  });

  test('should generate basic test when no test cases provided', async () => {
    const args = {
      target_file: './src/simple.js'
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain("test('should be defined', () => {");
    expect(result.test_content).toContain('expect(simple).toBeDefined();');
    expect(result.components.test_count).toBe(1);
  });

  test('should handle different expectation types', async () => {
    const args = {
      target_file: './src/utils.js',
      test_cases: [
        {
          function: 'processArray',
          description: 'should process array correctly',
          args: [[1, 2, 3]],
          expectations: [
            { type: 'toHaveLength', expected: 3 },
            { type: 'toContain', expected: 2 },
            { type: 'toEqual', expected: [1, 2, 3] }
          ]
        }
      ]
    };

    const result = await tool.execute(args);
    
    expect(result.test_content).toContain('expect(result).toHaveLength(3);');
    expect(result.test_content).toContain('expect(result).toContain(2);');
    expect(result.test_content).toContain('expect(result).toEqual([1,2,3]);');
  });

  test('should invoke tool correctly through invoke method', async () => {
    const toolCall = {
      function: {
        arguments: JSON.stringify({
          target_file: './src/test.js',
          test_cases: [
            {
              function: 'testFunction',
              description: 'should work',
              expectations: [{ type: 'toBeTruthy' }]
            }
          ]
        })
      }
    };

    const result = await tool.invoke(toolCall);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('test_content');
    expect(result.data).toHaveProperty('test_path');
  });

  test('should handle invalid arguments gracefully', async () => {
    const toolCall = {
      function: {
        arguments: '{"invalid": true}' // Missing required 'target_file'
      }
    };

    const result = await tool.invoke(toolCall);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});