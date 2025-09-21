/**
 * Comprehensive tests for DebuggingStrategy
 */

import { jest } from '@jest/globals';
import DebuggingStrategy from '../../src/strategies/coding/DebuggingStrategy.js';
import { Task } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

describe('DebuggingStrategy', () => {
  let strategy;
  let mockLLMClient;
  let mockToolRegistry;
  let testWorkspaceDir;

  beforeEach(async () => {
    // Create unique test workspace for each test
    testWorkspaceDir = `/tmp/debugging-strategy-test-${Date.now()}`;
    await fs.mkdir(testWorkspaceDir, { recursive: true });

    // Mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn()
    };

    // Mock tool registry
    mockToolRegistry = {
      getTool: jest.fn()
    };

    strategy = new DebuggingStrategy(mockLLMClient, mockToolRegistry, {
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
      const defaultStrategy = new DebuggingStrategy();
      expect(defaultStrategy.projectRoot).toBe('/tmp');
      expect(defaultStrategy.llmClient).toBeNull();
      expect(defaultStrategy.toolRegistry).toBeNull();
      expect(defaultStrategy.maxFixAttempts).toBe(3);
    });

    test('should use custom project root from options', () => {
      const customRoot = '/custom/debug-workspace';
      const customStrategy = new DebuggingStrategy(null, null, { projectRoot: customRoot });
      expect(customStrategy.projectRoot).toBe(customRoot);
    });

    test('should use PROJECT_ROOT environment variable', () => {
      const originalEnv = process.env.PROJECT_ROOT;
      process.env.PROJECT_ROOT = '/env/debug-workspace';
      
      const envStrategy = new DebuggingStrategy();
      expect(envStrategy.projectRoot).toBe('/env/debug-workspace');
      
      // Restore environment
      if (originalEnv) {
        process.env.PROJECT_ROOT = originalEnv;
      } else {
        delete process.env.PROJECT_ROOT;
      }
    });

    test('should have correct name', () => {
      expect(strategy.getName()).toBe('Debugging');
    });
  });

  describe('Message Handling', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Debug calculator function errors',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('Error logs and code files'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'error_log': {
            name: 'error_log',
            value: 'TypeError: Cannot read property of undefined',
            type: 'error'
          },
          'calculator.js': {
            name: 'calculator.js',
            value: 'function add(a, b) { return a + b; }',
            type: 'file'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn(),
        getArtifact: jest.fn()
      };
    });

    test('should handle start message for error analysis', async () => {
      // Mock LLM responses for task classification and error analysis
      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'ERROR_ANALYSIS',
          reasoning: 'Analyzing runtime errors',
          severity: 'medium',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: [{
            rootCause: 'Undefined property access',
            impact: 'Runtime failure',
            solution: 'Add null check',
            prevention: 'Use optional chaining'
          }]
        }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.complete).toHaveBeenCalled();
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'error_analysis',
        expect.any(Object),
        'Error analysis results',
        'json'
      );
    });

    test('should handle CODE_FIXING type', async () => {
      // Mock validation tool
      const mockValidationTool = {
        execute: jest.fn().mockResolvedValue({
          success: true
        })
      };
      mockToolRegistry.getTool.mockResolvedValue(mockValidationTool);

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'CODE_FIXING',
          reasoning: 'Fixing bugs in code',
          severity: 'high',
          language: 'javascript'
        }))
        .mockResolvedValueOnce('function add(a, b) { return (a || 0) + (b || 0); }');

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'fixed_calculator.js',
        expect.any(String),
        'Fixed version of calculator.js',
        'file'
      );
    });

    test('should handle TEST_DEBUGGING type', async () => {
      // Set up test failures artifact
      mockTask.getArtifact.mockReturnValue({
        value: [
          {
            test: 'should add numbers',
            error: 'Expected 5, received NaN',
            stack: 'at calculator.test.js:10:5'
          }
        ]
      });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'TEST_DEBUGGING',
          reasoning: 'Debugging test failures',
          severity: 'medium',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          analysis: 'Test failure due to invalid input handling',
          suggestedFixes: []
        }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'test_debug_analysis',
        expect.any(Object),
        'Test debugging analysis',
        'json'
      );
    });

    test('should handle abort message', async () => {
      const result = await strategy.onParentMessage(mockTask, { type: 'abort' });

      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should acknowledge unknown messages', async () => {
      const result = await strategy.onParentMessage(mockTask, { type: 'unknown' });

      expect(result.acknowledged).toBe(true);
    });

    test('should reject child messages', async () => {
      const result = await strategy.onChildMessage(mockTask, { type: 'completed' });

      expect(result.acknowledged).toBe(false);
      expect(result.error).toContain('does not handle child messages');
    });
  });

  describe('Context Resolution', () => {
    test('should prioritize task lookup for workspace directory', () => {
      const mockTask = {
        lookup: jest.fn().mockImplementation((service) => {
          if (service === 'workspaceDir') return '/task/debug-workspace';
          return null;
        }),
        context: { workspaceDir: '/context/debug-workspace' }
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.workspaceDir).toBe('/task/debug-workspace');
    });

    test('should fallback to task context workspace directory', () => {
      const mockTask = {
        lookup: null,
        context: { workspaceDir: '/context/debug-workspace' }
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.workspaceDir).toBe('/context/debug-workspace');
    });

    test('should fallback to strategy project root', () => {
      const mockTask = {
        lookup: null,
        context: null
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.workspaceDir).toBe(testWorkspaceDir);
    });
  });

  describe('Error Analysis', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Analyze JavaScript runtime errors',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('Error logs available'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'runtime_error': {
            name: 'runtime_error',
            value: 'ReferenceError: myVar is not defined',
            type: 'error'
          },
          'stack_trace': {
            name: 'stack_trace',
            value: 'at myFunction (app.js:15:10)',
            type: 'log'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should analyze runtime errors', async () => {
      const expectedAnalysis = {
        errors: [{
          rootCause: 'Variable not declared',
          impact: 'Application crash',
          solution: 'Declare variable before use',
          prevention: 'Use strict mode'
        }]
      };

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'ERROR_ANALYSIS',
          reasoning: 'Analyzing runtime errors',
          severity: 'high',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify(expectedAnalysis));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.errorsAnalyzed).toBe(2); // runtime_error + stack_trace
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'error_analysis',
        expectedAnalysis,
        'Error analysis results',
        'json'
      );
    });

    test('should handle no error artifacts', async () => {
      mockTask.getAllArtifacts.mockReturnValue({
        'readme.md': {
          name: 'readme.md',
          value: 'Project documentation',
          type: 'file'
        }
      });

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'ERROR_ANALYSIS',
        reasoning: 'No errors to analyze',
        severity: 'low',
        language: 'javascript'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No error information found');
    });
  });

  describe('Code Fixing', () => {
    let mockTask;
    let mockValidationTool;

    beforeEach(async () => {
      // Create a buggy code file
      const buggyCode = `
function divide(a, b) {
  return a / b; // No zero division check
}

function process(items) {
  return items.map(item => item.value); // No null check
}
      `;
      await fs.writeFile(path.join(testWorkspaceDir, 'buggy.js'), buggyCode);

      mockValidationTool = {
        execute: jest.fn().mockResolvedValue({
          success: true
        })
      };
      mockToolRegistry.getTool.mockResolvedValue(mockValidationTool);

      mockTask = {
        description: 'Fix bugs in calculator code',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('Buggy code and error logs'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'buggy.js': {
            name: 'buggy.js',
            value: buggyCode,
            type: 'file'
          },
          'error_log': {
            name: 'error_log',
            value: 'Division by zero error',
            type: 'error'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should fix code successfully', async () => {
      const fixedCode = `
function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

function process(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => item && item.value !== undefined).map(item => item.value);
}
      `;

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'CODE_FIXING',
          reasoning: 'Fixing null pointer and division errors',
          severity: 'high',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(fixedCode);

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('Code fixed successfully');
      expect(result.result.filesFixed).toBe(1);
      expect(result.result.fixAttempts).toBe(1);

      // Check that fixed file was created
      const fixedFilePath = path.join(testWorkspaceDir, 'buggy.js');
      const fileExists = await fs.access(fixedFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should retry on validation failure', async () => {
      // First attempt fails validation, second succeeds
      mockValidationTool.execute
        .mockResolvedValueOnce({ success: false, error: 'Syntax error' })
        .mockResolvedValueOnce({ success: true });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'CODE_FIXING',
          reasoning: 'Fixing bugs with retry',
          severity: 'medium',
          language: 'javascript'
        }))
        .mockResolvedValue('// Fixed code attempt');

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.fixAttempts).toBe(2);
      expect(mockLLMClient.generateResponse).toHaveBeenCalledTimes(3); // 1 classification + 2 fix attempts
    });

    test('should fail after max attempts', async () => {
      // All validation attempts fail
      mockValidationTool.execute.mockResolvedValue({ 
        success: false, 
        error: 'Persistent syntax error' 
      });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'CODE_FIXING',
          reasoning: 'Attempting to fix persistent bugs',
          severity: 'high',
          language: 'javascript'
        }))
        .mockResolvedValue('// Attempted fix');

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fix code after 3 attempts');
      expect(mockLLMClient.generateResponse).toHaveBeenCalledTimes(4); // 1 classification + 3 fix attempts
    });

    test('should handle no code files to fix', async () => {
      mockTask.getAllArtifacts.mockReturnValue({
        'error_log': {
          name: 'error_log',
          value: 'Some error',
          type: 'error'
        }
      });

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'CODE_FIXING',
        reasoning: 'No code files found',
        severity: 'medium',
        language: 'javascript'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No code files found to fix');
    });
  });

  describe('Performance Debugging', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Debug slow algorithm performance',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('Performance data available'),
        getAllArtifacts: jest.fn().mockReturnValue({}),
        getArtifact: jest.fn(),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should analyze performance issues', async () => {
      const performanceData = {
        executionTime: 5000,
        memoryUsage: '512MB',
        bottlenecks: ['nested loops', 'inefficient sorting']
      };

      mockTask.getArtifact.mockReturnValue({ value: performanceData });

      const expectedAnalysis = {
        issues: ['O(n²) complexity in nested loops'],
        recommendations: ['Use efficient sorting algorithm', 'Optimize loop structure'],
        priority: 'high'
      };

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'PERFORMANCE_DEBUGGING',
          reasoning: 'Analyzing algorithm performance',
          severity: 'medium',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify(expectedAnalysis));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('Performance debugging analysis completed');
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'performance_analysis',
        expectedAnalysis,
        'Performance debugging analysis',
        'json'
      );
    });

    test('should handle missing performance data', async () => {
      mockTask.getArtifact.mockReturnValue(null);

      const expectedAnalysis = {
        note: 'No performance data available',
        generalRecommendations: ['Profile code execution', 'Monitor memory usage']
      };

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'PERFORMANCE_DEBUGGING',
          reasoning: 'General performance analysis',
          severity: 'low',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify(expectedAnalysis));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(mockTask.storeArtifact).toHaveBeenCalledWith(
        'performance_analysis',
        expectedAnalysis,
        'Performance debugging analysis',
        'json'
      );
    });
  });

  describe('Compilation Fixing', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = {
        description: 'Fix TypeScript compilation errors',
        lookup: jest.fn(),
        context: { workspaceDir: testWorkspaceDir },
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        getArtifactsContext: jest.fn().mockReturnValue('Compilation error logs'),
        getAllArtifacts: jest.fn().mockReturnValue({
          'compilation_error': {
            name: 'compilation_error',
            value: 'Type "string" is not assignable to type "number"',
            type: 'error'
          },
          'build_log': {
            name: 'build_log',
            value: 'tsc: 5 errors found',
            type: 'log'
          }
        }),
        complete: jest.fn(),
        fail: jest.fn()
      };
    });

    test('should fix compilation errors', async () => {
      const fixResult = {
        success: true,
        errorsFixed: 5,
        details: 'All type errors resolved'
      };

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'COMPILATION_FIXING',
        reasoning: 'Fixing TypeScript compilation errors',
        severity: 'high',
        language: 'typescript'
      }));

      // Mock the private method _fixCompilationErrors
      strategy._fixCompilationErrors = jest.fn().mockResolvedValue(fixResult);

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(true);
      expect(result.result.message).toContain('Compilation errors fixed');
      expect(result.result.errorsFixed).toBe(5);
    });

    test('should handle no compilation errors', async () => {
      mockTask.getAllArtifacts.mockReturnValue({
        'readme.md': {
          name: 'readme.md',
          value: 'Documentation',
          type: 'file'
        }
      });

      mockLLMClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        type: 'COMPILATION_FIXING',
        reasoning: 'No compilation errors found',
        severity: 'low',
        language: 'typescript'
      }));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No compilation errors found to fix');
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
      const strategyWithoutLLM = new DebuggingStrategy(null, mockToolRegistry, {
        projectRoot: testWorkspaceDir
      });

      const result = await strategyWithoutLLM.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM client is required');
      expect(mockTask.fail).toHaveBeenCalled();
    });

    test('should handle missing tool registry', async () => {
      const strategyWithoutTools = new DebuggingStrategy(mockLLMClient, null, {
        projectRoot: testWorkspaceDir
      });

      const result = await strategyWithoutTools.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ToolRegistry is required');
      expect(mockTask.fail).toHaveBeenCalled();
    });

    test('should handle LLM classification failure', async () => {
      mockLLMClient.generateResponse.mockRejectedValueOnce(new Error('LLM API error'));

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(mockTask.fail).toHaveBeenCalled();
    });

    test('should handle file system errors during fix application', async () => {
      // Mock task with invalid workspace directory
      mockTask.context.workspaceDir = '/invalid/path/that/cannot/be/accessed';
      mockTask.getAllArtifacts.mockReturnValue({
        'code.js': {
          name: 'code.js',
          value: 'function test() {}',
          type: 'file'
        },
        'error_log': {
          name: 'error_log',
          value: 'Some error',
          type: 'error'
        }
      });

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'CODE_FIXING',
          reasoning: 'Fixing code',
          severity: 'medium',
          language: 'javascript'
        }))
        .mockResolvedValueOnce('function test() { /* fixed */ }');

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });

      expect(result.success).toBe(false);
      expect(mockTask.fail).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should identify error artifacts correctly', () => {
      expect(strategy._isErrorArtifact('error_log', { type: 'error' })).toBe(true);
      expect(strategy._isErrorArtifact('exception_trace', { type: 'log' })).toBe(true);
      expect(strategy._isErrorArtifact('failure_report', { type: 'json' })).toBe(true);
      expect(strategy._isErrorArtifact('stack_trace', { type: 'text' })).toBe(true);
      expect(strategy._isErrorArtifact('readme.md', { type: 'file' })).toBe(false);
      expect(strategy._isErrorArtifact('config.json', { type: 'config' })).toBe(false);
    });

    test('should identify code files correctly', () => {
      expect(strategy._isCodeFile('test.js')).toBe(true);
      expect(strategy._isCodeFile('component.tsx')).toBe(true);
      expect(strategy._isCodeFile('utils.py')).toBe(true);
      expect(strategy._isCodeFile('Main.java')).toBe(true);
      expect(strategy._isCodeFile('readme.md')).toBe(false);
      expect(strategy._isCodeFile('config.json')).toBe(false);
    });

    test('should get compilation errors from artifacts', () => {
      const mockTask = {
        getAllArtifacts: jest.fn().mockReturnValue({
          'compilation_error': {
            name: 'compilation_error',
            value: 'Type error in line 5',
            type: 'error'
          },
          'build_log': {
            name: 'build_log', 
            value: 'Build failed with 3 errors',
            type: 'log'
          },
          'readme.md': {
            name: 'readme.md',
            value: 'Documentation',
            type: 'file'
          }
        })
      };

      const compilationErrors = strategy._getCompilationErrors(mockTask);
      expect(compilationErrors).toHaveLength(2);
      expect(compilationErrors[0].source).toBe('compilation_error');
      expect(compilationErrors[1].source).toBe('build_log');
    });

    test('should get runtime errors from artifacts', () => {
      const mockTask = {
        getAllArtifacts: jest.fn().mockReturnValue({
          'runtime_error': {
            name: 'runtime_error',
            value: 'NullPointerException at line 10',
            type: 'error'
          },
          'exception_trace': {
            name: 'exception_trace',
            value: 'Stack trace information',
            type: 'log'
          },
          'config.json': {
            name: 'config.json',
            value: '{}',
            type: 'config'
          }
        })
      };

      const runtimeErrors = strategy._getRuntimeErrors(mockTask);
      expect(runtimeErrors).toHaveLength(2);
      expect(runtimeErrors[0].source).toBe('runtime_error');
      expect(runtimeErrors[1].source).toBe('exception_trace');
    });
  });

  describe('Integration with Task Framework', () => {
    test('should work with real Task objects', async () => {
      // Create a real Task object
      const task = new Task('Debug calculator division by zero error', null, {
        workspaceDir: testWorkspaceDir,
        llmClient: mockLLMClient,
        toolRegistry: mockToolRegistry
      });

      // Add some error artifacts
      task.storeArtifact('error_log', 'Division by zero in calculator.js', 'Error log', 'error');
      task.storeArtifact('calculator.js', 'function divide(a, b) { return a / b; }', 'Buggy code', 'file');

      // Set the strategy
      task.setStrategy(strategy);

      mockLLMClient.generateResponse
        .mockResolvedValueOnce(JSON.stringify({
          type: 'ERROR_ANALYSIS',
          reasoning: 'Analyzing division error',
          severity: 'high',
          language: 'javascript'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: [{
            rootCause: 'No zero division check',
            impact: 'Runtime crash',
            solution: 'Add validation',
            prevention: 'Unit tests for edge cases'
          }]
        }));

      // Send start message to task
      const result = await task.receiveMessage({ type: 'start' });

      expect(result.success).toBe(true);
      expect(task.status).toBe('completed');
      expect(task.getAllArtifacts()).toHaveProperty('error_analysis');
    });
  });
});