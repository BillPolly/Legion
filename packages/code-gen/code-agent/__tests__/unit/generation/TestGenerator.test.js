/**
 * Tests for TestGenerator
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TestGenerator } from '../../../src/generation/TestGenerator.js';

describe('TestGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TestGenerator();
  });

  describe('Constructor', () => {
    test('should create generator with default config', () => {
      expect(generator.config.framework).toBe('jest');
      expect(generator.config.mocking).toBe('jest');
      expect(generator.config.assertions).toBe('jest');
      expect(generator.config.coverage.threshold).toBe(80);
      expect(generator.config.setup).toBe(true);
      expect(generator.config.teardown).toBe(true);
    });

    test('should create generator with custom config', () => {
      const customGenerator = new TestGenerator({
        framework: 'mocha',
        mocking: 'sinon',
        coverage: { threshold: 90 },
        setup: false
      });
      
      expect(customGenerator.config.framework).toBe('mocha');
      expect(customGenerator.config.mocking).toBe('sinon');
      expect(customGenerator.config.coverage.threshold).toBe(90);
      expect(customGenerator.config.setup).toBe(false);
    });

    test('should have test data generators', () => {
      expect(generator.testDataGenerators.string()).toBe('test-string');
      expect(generator.testDataGenerators.number()).toBe(42);
      expect(generator.testDataGenerators.boolean()).toBe(true);
      expect(generator.testDataGenerators.array()).toEqual([1, 2, 3]);
    });
  });

  describe('generateTestSuite', () => {
    test('should generate empty test suite', async () => {
      const spec = {
        name: 'Calculator',
        tests: [],
        setup: false,
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain("import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';");
    });

    test('should generate test suite with tests', async () => {
      const spec = {
        name: 'Calculator',
        tests: [{
          description: 'should add two numbers',
          arrange: 'const a = 2; const b = 3;',
          act: 'const result = add(a, b);',
          assert: 'expect(result).toBe(5);'
        }],
        setup: false,
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain("test('should add two numbers'");
      expect(result).toContain('const a = 2; const b = 3;');
      expect(result).toContain('const result = add(a, b);');
      expect(result).toContain('expect(result).toBe(5);');
    });

    test('should generate test suite with setup', async () => {
      const spec = {
        name: 'Database',
        setup: 'const db = new Database();',
        tests: [{
          description: 'should connect',
          act: 'const connected = db.connect();',
          assert: 'expect(connected).toBe(true);'
        }],
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain('beforeEach(() => {');
      expect(result).toContain('const db = new Database();');
    });

    test('should generate test suite with teardown', async () => {
      const spec = {
        name: 'FileSystem',
        teardown: 'fs.cleanup();',
        tests: [{
          description: 'should create file',
          act: 'fs.writeFile("test.txt", "data");'
        }],
        setup: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain('afterEach(() => {');
      expect(result).toContain('fs.cleanup();');
    });

    test('should generate test suite with imports', async () => {
      const spec = {
        imports: [
          { named: ['add', 'subtract'], from: '../src/math.js' },
          { named: ['User'], from: '../src/models/User.js' }
        ],
        tests: [],
        setup: false,
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain("import { add, subtract } from '../src/math.js';");
      expect(result).toContain("import { User } from '../src/models/User.js';");
    });

    test('should generate test suite with mocks', async () => {
      const spec = {
        mocks: [
          { type: 'function', name: 'mockFetch', implementation: '() => Promise.resolve({ data: "test" })' },
          { type: 'module', path: 'axios', implementation: '{ get: jest.fn() }' }
        ],
        tests: [],
        setup: false,
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      expect(result).toContain('const mockFetch = jest.fn(() => Promise.resolve({ data: "test" }));');
      expect(result).toContain("jest.mock('axios', () => ({ get: jest.fn() }));");
    });

    test('should throw error for invalid spec', async () => {
      await expect(generator.generateTestSuite(null)).rejects.toThrow('Invalid test spec');
    });
  });

  describe('generateUnitTest', () => {
    test('should generate unit test with default cases', async () => {
      const functionSpec = {
        name: 'multiply',
        params: ['a', 'b'],
        returnType: 'number'
      };

      const result = await generator.generateUnitTest(functionSpec);
      
      expect(result).toContain("describe('multiply', () => {");
      expect(result).toContain('test(');
      expect(result).toContain('expect(');
    });

    test('should generate unit test with custom cases', async () => {
      const functionSpec = {
        name: 'divide',
        cases: [
          { description: 'should divide positive numbers', input: [10, 2], expected: 5 },
          { description: 'should handle division by zero', input: [10, 0], throws: true }
        ]
      };

      const result = await generator.generateUnitTest(functionSpec);
      
      expect(result).toContain('should divide positive numbers');
      expect(result).toContain('should handle division by zero');
    });

    test('should generate async unit test', async () => {
      const functionSpec = {
        name: 'fetchData',
        async: true,
        cases: [{
          description: 'should fetch user data',
          input: { userId: 1 },
          expected: { id: 1, name: 'John' }
        }]
      };

      const result = await generator.generateUnitTest(functionSpec);
      
      expect(result).toContain('async');
      expect(result).toContain('await');
    });
  });

  describe('generateIntegrationTest', () => {
    test('should generate basic integration test', async () => {
      const integrationSpec = {
        name: 'User API Integration',
        setup: 'const server = await startServer();',
        teardown: 'await server.close();',
        workflow: [
          { description: 'Create user', action: 'const user = await api.createUser({ name: "Test" });' },
          { description: 'Verify user exists', action: 'const found = await api.getUser(user.id);', assertions: [{ type: 'toEqual', actual: 'found.name', expected: 'Test' }] }
        ]
      };

      const result = await generator.generateIntegrationTest(integrationSpec);
      
      expect(result).toContain('User API Integration');
      expect(result).toContain('const server = await startServer();');
      expect(result).toContain('Create user');
      expect(result).toContain('await api.createUser');
    });
  });

  describe('generateAPITest', () => {
    test('should generate API test', async () => {
      const apiSpec = {
        name: 'User API',
        endpoint: '/api/users',
        method: 'POST',
        testCases: [{
          description: 'should create user',
          data: { name: 'John', email: 'john@example.com' },
          expectedStatus: 201,
          expectedData: { success: true }
        }]
      };

      const result = await generator.generateAPITest(apiSpec);
      
      expect(result).toContain('POST /api/users');
      expect(result).toContain('should create user');
      expect(result).toContain('.post(\'/api/users\')');
      expect(result).toContain('expect(201)');
    });
  });

  describe('generateComponentTest', () => {
    test('should generate component test', async () => {
      const componentSpec = {
        name: 'Button',
        props: {
          label: 'Click me',
          onClick: 'mockOnClick'
        },
        render: true,
        snapshot: true,
        interactions: true
      };

      const result = await generator.generateComponentTest(componentSpec);
      
      expect(result).toContain("describe('Button Component', () => {");
      expect(result).toContain('render');
      expect(result).toContain('Click me');
    });
  });

  describe('generateTest', () => {
    test('should generate individual test', async () => {
      const testSpec = {
        description: 'should handle edge case',
        arrange: 'const input = null;',
        act: 'const result = processInput(input);',
        assert: 'expect(result).toBeNull();'
      };

      const result = await generator.generateTest(testSpec);
      
      expect(result).toContain("test('should handle edge case', () => {");
      expect(result).toContain('// Arrange');
      expect(result).toContain('const input = null;');
      expect(result).toContain('// Act');
      expect(result).toContain('const result = processInput(input);');
      expect(result).toContain('// Assert');
      expect(result).toContain('expect(result).toBeNull();');
    });

    test('should generate async test', async () => {
      const testSpec = {
        description: 'should fetch data',
        async: true,
        act: 'const data = await fetchData();',
        assertions: [
          { type: 'toBeDefined', actual: 'data' },
          { type: 'toHaveLength', actual: 'data', expected: 5 }
        ]
      };

      const result = await generator.generateTest(testSpec);
      
      expect(result).toContain('async () => {');
      expect(result).toContain('await fetchData()');
      expect(result).toContain('expect(data).toBeDefined()');
      expect(result).toContain('expect(data).toHaveLength(5)');
    });

    test('should generate test with timeout', async () => {
      const testSpec = {
        description: 'should complete within timeout',
        timeout: 10000,
        act: 'await longRunningOperation();'
      };

      const result = await generator.generateTest(testSpec);
      
      expect(result).toContain(', 10000);');
    });
  });

  describe('validateSpec', () => {
    test('should validate valid spec', async () => {
      const spec = {
        tests: [{ description: 'test 1' }]
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should invalidate null spec', async () => {
      const result = await generator.validateSpec(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Specification must be an object');
    });

    test('should invalidate spec with invalid tests', async () => {
      const spec = {
        tests: 'not-array'
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tests must be an array');
    });

    test('should invalidate tests without description', async () => {
      const spec = {
        tests: [{ act: 'doSomething()' }]
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test at index 0 missing description');
    });

    test('should invalidate spec with invalid test suites', async () => {
      const spec = {
        testSuites: 'not-array'
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test suites must be an array');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty test', async () => {
      const testSpec = {
        description: 'should not throw'
      };

      const result = await generator.generateTest(testSpec);
      
      expect(result).toContain("test('should not throw', () => {");
      expect(result).toContain('});');
    });

    test('should handle test with only assertions', async () => {
      const testSpec = {
        description: 'should validate environment',
        assertions: [
          { type: 'toBeDefined', actual: 'process.env.NODE_ENV' },
          { type: 'toBe', actual: 'process.env.NODE_ENV', expected: 'test' }
        ]
      };

      const result = await generator.generateTest(testSpec);
      
      expect(result).toContain('// Assert');
      expect(result).toContain('expect(process.env.NODE_ENV).toBeDefined()');
      expect(result).toContain('expect(process.env.NODE_ENV).toBe("test")');
    });

    test('should handle nested test suites', async () => {
      const spec = {
        name: 'Main Suite',
        testSuites: [{
          name: 'Nested Suite',
          tests: [{
            description: 'nested test',
            assert: 'expect(true).toBe(true);'
          }],
          setup: false,
          teardown: false
        }],
        setup: false,
        teardown: false
      };

      const result = await generator.generateTestSuite(spec);
      
      // Should handle recursion properly
      expect(result).toContain('import');
    });
  });
});