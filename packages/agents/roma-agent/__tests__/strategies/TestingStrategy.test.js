/**
 * Comprehensive tests for TestingStrategy
 */

import { jest } from '@jest/globals';
import TestingStrategy from '../../src/strategies/coding/TestingStrategy.js';
import { Task } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

describe('TestingStrategy', () => {
  let strategy;
  let mockLLMClient;
  let mockToolRegistry;
  let testWorkspaceDir;

  beforeEach(async () => {
    // Create unique test workspace for each test
    testWorkspaceDir = `/tmp/testing-strategy-test-${Date.now()}`;
    await fs.mkdir(testWorkspaceDir, { recursive: true });

    // Mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn()
    };

    // Mock tool registry
    mockToolRegistry = {
      getTool: jest.fn()
    };

    strategy = new TestingStrategy(mockLLMClient, mockToolRegistry, {
      projectRoot: testWorkspaceDir
    });
  });

  afterEach(async () => {
    // Clean up test workspace
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default values', () => {
      const defaultStrategy = new TestingStrategy();
      expect(defaultStrategy.projectRoot).toBe('/tmp');
      expect(defaultStrategy.llmClient).toBeNull();
      expect(defaultStrategy.toolRegistry).toBeNull();
    });

    test('should use custom project root from options', () => {
      const customRoot = '/custom/test-workspace';
      const customStrategy = new TestingStrategy(null, null, { projectRoot: customRoot });
      expect(customStrategy.projectRoot).toBe(customRoot);
    });

    test('should have correct name', () => {
      expect(strategy.getName()).toBe('Testing');
    });
  });

  describe('Message Handling', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Generate tests for calculator module',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('calculator.js (file)'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'calculator.js': {
            name: 'calculator.js',
            value: 'export function add(a, b) { return a + b; }',
            type: 'file'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn(),
        getArtifact: jest.fn()
      };
    });

    test('should handle start message for test generation', async () => {
      // Mock LLM responses for task classification and test generation
      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'GENERATE_TESTS',
          reasoning: 'Generating tests for existing code',
          testFramework: 'jest',
          scope: 'unit'
        }))
        .mockResolvedValueOnce(`
import { add } from '../calculator.js';

describe('Calculator', () => {
  test('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
        `);

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.complete).toHaveBeenCalled();
      expect(mockTask.storeArtifact).toHaveBeenCalled();
    });

    test('should handle RUN_TESTS type', async () => {
      // Mock test tool
      const mockTestTool = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          testsRun: 5,
          testsPassed: 5,
          testsFailed: 0,
          coverage: { percentage: 95 }
        })
      };
      mockToolRegistry.getTool.mockResolvedValue(mockTestTool);

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'RUN_TESTS',
        reasoning: 'Running existing tests',
        testFramework: 'jest',
        scope: 'all'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTestTool.execute).toHaveBeenCalled();
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'test_results',
        expect.any(Object),
        'Test execution results',
        'json'
      );
    });

    test('should handle ANALYZE_FAILURES type', async () => {
      // Set up mock task with test failures
      const mockFailures = [
        {
          test: 'should handle edge case',
          error: 'Expected 5, received 6',
          stack: 'at calculator.test.js:10:5'
        }
      ];
      mockTask.getArtifact.mockReturnValue({ value: mockFailures });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'ANALYZE_FAILURES',
          reasoning: 'Analyzing test failures',
          testFramework: 'jest',
          scope: 'unit'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          failures: [{
            rootCause: 'Off-by-one error in calculation',
            suggestedFix: 'Check boundary conditions',
            prevention: 'Add more edge case tests'
          }]
        }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'failure_analysis',
        expect.any(Object),
        'Test failure analysis',
        'json'
      );
    });

    test('should handle abort message', async () => {
      const result = await strategy.onParentMessage(mockTask, { type: 'abort' });

      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should reject child messages', async () => {
      const result = await strategy.onChildMessage(mockTask, { type: 'completed' });

      expect(result.acknowledged).toBe(false);
      expect(result.error).toContain('does not handle child messages');
    });
  });

  describe('Test Generation', () => {
    let mockTask;

    beforeEach(async () => {
      // Create a sample code file
      const codeContent = `
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
      `;
      await fs.writeFile(path.join(testWorkspaceDir, 'math.js'), codeContent);

      mockTask = {
        description: 'Generate comprehensive tests for math module',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('math.js (file)'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'math.js': {
            name: 'math.js',
            value: codeContent,
            type: 'file'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should generate test files for code artifacts', async () => {
      const expectedTestContent = `
import { add, multiply } from '../math.js';

describe('Math utilities', () => {
  describe('add', () => {
    test('should add positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });
    
    test('should handle negative numbers', () => {
      expect(add(-1, -2)).toBe(-3);
    });
  });
  
  describe('multiply', () => {
    test('should multiply numbers', () => {
      expect(multiply(3, 4)).toBe(12);
    });
  });
});
      `;

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'GENERATE_TESTS',
          reasoning: 'Generating unit tests',
          testFramework: 'jest',
          scope: 'unit'
        }))
        .mockResolvedValueOnce(expectedTestContent);

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'tests/math.test.js',
        expectedTestContent,
        'Generated test for math.js',
        'test'
      );

      // Check that test file was created
      const testFilePath = path.join(testWorkspaceDir, 'tests/math.test.js');
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should handle multiple code files', async () => {
      // Add another code file
      await fs.writeFile(path.join(testWorkspaceDir, 'utils.js'), 'export const utils = {};');

      mockTask.getAllArtifacts.mockReturnValue({
        'math.js': { name: 'math.js', value: 'export function add() {}', type: 'file' },
        'utils.js': { name: 'utils.js', value: 'export const utils = {};', type: 'file' }
      });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'GENERATE_TESTS',
          reasoning: 'Generating tests for multiple files',
          testFramework: 'jest',
          scope: 'unit'
        }))
        .mockResolvedValue('// Test content');

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockLLMClient.generateResponse).toHaveBeenCalledTimes(3); // 1 classification + 2 test generations
    });
  });

  describe('Test Execution', () => {
    let mockTask;
    let mockTestTool;

    beforeEach(() => {
      mockTestTool = {
        execute: jest.fn()
      };
      mockToolRegistry.getTool.mockResolvedValue(mockTestTool);

      mockTask = {
        description: 'Run all tests in the project',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('test files available'),
        getAllArtifacts: jest.fn().mockReturnValue({}),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should execute tests successfully', async () => {
      const testResults = {
        success: true,
        testsRun: 10,
        testsPassed: 9,
        testsFailed: 1,
        coverage: { percentage: 85, lines: 85, functions: 90 }
      };
      mockTestTool.execute.mockResolvedValue(testResults);

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'RUN_TESTS',
        reasoning: 'Running test suite',
        testFramework: 'jest',
        scope: 'all'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.testsRun).toBe(10);
      expect(result.result.testsPassed).toBe(9);
      expect(result.result.testsFailed).toBe(1);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'test_results',
        testResults,
        'Test execution results',
        'json'
      );
    });

    test('should handle test failures', async () => {
      const testResults = {
        success: false,
        testsRun: 5,
        testsPassed: 3,
        testsFailed: 2,
        failures: [
          { test: 'should handle edge case', error: 'Expected 5, got 6' },
          { test: 'should validate input', error: 'TypeError: undefined is not a function' }
        ]
      };
      mockTestTool.execute.mockResolvedValue(testResults);

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'RUN_TESTS',
        reasoning: 'Running test suite',
        testFramework: 'jest',
        scope: 'all'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'test_failures',
        testResults.failures,
        'Test failures for analysis',
        'json'
      );
    });

    test('should handle missing test tool', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'RUN_TESTS',
        reasoning: 'Running tests',
        testFramework: 'vitest',
        scope: 'unit'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No test runner tool found for vitest');
    });
  });

  describe('Coverage Analysis', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Analyze test coverage',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('test results available'),
        getAllArtifacts: jest.fn().mockReturnValue({}),
        getArtifact: jest.fn(),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should analyze coverage data', async () => {
      const coverageData = {
        percentage: 75,
        lines: { covered: 75, total: 100 },
        functions: { covered: 8, total: 10 },
        branches: { covered: 12, total: 20 }
      };

      mockTask.getArtifact.mockReturnValue({
        value: { coverage: coverageData }
      });

      const expectedAnalysis = {
        assessment: 'Good coverage but room for improvement',
        recommendations: ['Add tests for uncovered branches', 'Focus on edge cases'],
        priority: 'medium'
      };

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'COVERAGE_ANALYSIS',
          reasoning: 'Analyzing test coverage',
          testFramework: 'jest',
          scope: 'all'
        }))
        .mockResolvedValueOnce(JSON.stringify(expectedAnalysis));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.coveragePercentage).toBe(75);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'coverage_analysis',
        expectedAnalysis,
        'Test coverage analysis',
        'json'
      );
    });

    test('should handle missing coverage data', async () => {
      mockTask.getArtifact.mockReturnValue(null);

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'COVERAGE_ANALYSIS',
        reasoning: 'Analyzing coverage',
        testFramework: 'jest',
        scope: 'all'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No coverage data found');
    });
  });

  describe('Integration Tests', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Generate integration tests for API endpoints',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('API server code'),
        getAllArtifacts: jest.fn().mockReturnValue({}),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should generate integration tests', async () => {
      const integrationTestContent = `
describe('API Integration Tests', () => {
  test('should create and retrieve user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'John Doe' });
    expect(response.status).toBe(201);
  });
});
      `;

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'INTEGRATION_TESTING',
          reasoning: 'Creating integration tests',
          testFramework: 'jest',
          scope: 'integration'
        }))
        .mockResolvedValueOnce(integrationTestContent);

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'integration.test.js',
        integrationTestContent,
        'Generated integration test',
        'test'
      );

      // Check that integration test file was created
      const testFilePath = path.join(testWorkspaceDir, 'tests/integration.test.js');
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('Error Handling', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Test error handling',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('No artifacts'),
        getAllArtifacts: jest.fn().mockReturnValue({}),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should handle missing LLM client', async () => {
      const strategyWithoutLLM = new TestingStrategy(null, mockToolRegistry, {
        projectRoot: testWorkspaceDir
      });

      const result = await strategyWithoutLLM.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM client is required');
    });

    test('should handle LLM classification failure', async () => {
      mockLLMClient.generateResponse.mockRejectedValueOnce(new Error('LLM API error'));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(mockTask.fail).toHaveBeenCalled();
    });

    test('should handle no code files to test', async () => {
      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'GENERATE_TESTS',
        reasoning: 'Generating tests',
        testFramework: 'jest',
        scope: 'unit'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No code files found');
    });
  });

  describe('Utility Functions', () => {
    test('should identify code files correctly', () => {
      expect(strategy._isCodeFile('test.js')).toBe(true);
      expect(strategy._isCodeFile('component.tsx')).toBe(true);
      expect(strategy._isCodeFile('utils.py')).toBe(true);
      expect(strategy._isCodeFile('readme.md')).toBe(false);
      expect(strategy._isCodeFile('config.json')).toBe(false);
    });

    test('should generate correct test filenames', () => {
      expect(strategy._getTestFilename('utils.js')).toBe('tests/utils.test.js');
      expect(strategy._getTestFilename('components/Button.tsx')).toBe('tests/Button.test.tsx');
      expect(strategy._getTestFilename('src/helpers.py')).toBe('tests/helpers.test.py');
    });

    test('should get correct test patterns', () => {
      expect(strategy._getTestPattern('jest')).toBe('**/*.test.js');
      expect(strategy._getTestPattern('mocha')).toBe('test/**/*.js');
      expect(strategy._getTestPattern('pytest')).toBe('test_*.py');
      expect(strategy._getTestPattern('unknown')).toBe('**/*.test.js');
    });
  });
});