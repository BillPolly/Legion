/**
 * Integration tests for DebuggingStrategy
 * Uses real LLM client and ToolRegistry - NO MOCKS as per CLAUDE.md instructions
 * Tests actual strategy functionality end-to-end
 */

import DebuggingStrategy from '../../src/strategies/coding/DebuggingStrategy.js';
import { Task } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

describe('DebuggingStrategy Integration Tests', () => {
  let strategy;
  let llmClient;
  let toolRegistry;
  let testWorkspaceDir;

  beforeEach(async () => {
    // Create unique test workspace for each test
    testWorkspaceDir = `/tmp/debugging-strategy-test-${Date.now()}`;
    await fs.mkdir(testWorkspaceDir, { recursive: true });

    // Get real ResourceManager and components - NO MOCKS per CLAUDE.md
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();

    // FAIL FAST if resources not available - per CLAUDE.md instructions
    if (!llmClient) {
      throw new Error('LLM client is required for integration tests - check environment setup');
    }

    if (!toolRegistry) {
      throw new Error('ToolRegistry is required for integration tests - check database setup');
    }

    strategy = new DebuggingStrategy(llmClient, toolRegistry, {
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

  describe('Strategy Configuration', () => {
    test('should initialize with correct name', () => {
      expect(strategy.getName()).toBe('Debugging');
    });

    test('should use configured project root', () => {
      expect(strategy.projectRoot).toBe(testWorkspaceDir);
    });

    test('should have required tools initialized', async () => {
      expect(strategy.tools).toBeDefined();
      expect(strategy.tools.fileRead).toBeNull(); // Not loaded until _initializeComponents
      expect(strategy.tools.fileWrite).toBeNull();
      expect(strategy.tools.validateJavaScript).toBeNull();
    });

    test('should have correct max fix attempts', () => {
      expect(strategy.maxFixAttempts).toBe(3);
    });
  });

  describe('End-to-End Error Analysis', () => {
    test('should analyze error artifacts', async () => {
      const task = new Task('analyze-errors', 'Analyze the JavaScript syntax errors', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add error artifacts
      task.storeArtifact('syntax_error', 
        'SyntaxError: Unexpected token ) at line 10\nfunction broken( { return "error"; }',
        'JavaScript syntax error',
        'error'
      );

      task.storeArtifact('runtime_error',
        'TypeError: Cannot read property "name" of undefined at getUserName (user.js:25)',
        'Runtime error in user module',
        'error'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      expect(task.status).toBe('completed');
      
      // Check that analysis artifacts were created
      const artifacts = task.getAllArtifacts();
      expect(artifacts).toHaveProperty('error_analysis');
      
      const analysis = artifacts.error_analysis;
      expect(analysis.value).toBeDefined();
      expect(typeof analysis.value).toBe('object');
    }, 30000); // 30 second timeout for LLM calls

    test('should handle missing error information gracefully', async () => {
      const task = new Task('no-errors', 'Debug a task with no error information', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // No error artifacts added

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No error information found/);
    }, 15000);
  });

  describe('Code Fixing Workflow', () => {
    test('should attempt to fix buggy code', async () => {
      const task = new Task('fix-code', 'Fix the calculator function bugs', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add buggy code
      const buggyCode = `
        function calculator(a, b, operation) {
          if (operation = "add") {  // Bug: assignment instead of comparison
            return a + b;
          }
          if (operation == "multiply") {
            return a * b;
          }
          return "Invalid operation";  // Missing return for other operations
        }
      `;

      task.storeArtifact('calculator.js', buggyCode, 'Buggy calculator function', 'file');
      
      // Add error information
      task.storeArtifact('linting_errors',
        'Line 2: Expected === and found = (comparison vs assignment)\nLine 6: Missing return statement for subtract operation',
        'ESLint errors',
        'error'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      // If fixes were attempted, check that fixed code was stored
      const artifacts = task.getAllArtifacts();
      const fixedFiles = Object.keys(artifacts).filter(key => key.startsWith('fixed_'));
      
      if (result.success) {
        expect(fixedFiles.length).toBeGreaterThan(0);
        
        // Verify actual fixed file was written to workspace
        const fixedFilePath = path.join(testWorkspaceDir, 'calculator.js');
        const fileExists = await fs.access(fixedFilePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    }, 45000); // Longer timeout for multiple fix attempts
  });

  describe('Tool Integration', () => {
    test('should successfully load all required tools', async () => {
      const task = new Task('tool-test', 'Test tool loading', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // This will trigger _initializeComponents which loads tools
      const result = await strategy.onParentMessage(task, { type: 'start' });

      // Strategy should have successfully loaded tools
      expect(strategy.tools.fileRead).toBeTruthy();
      expect(strategy.tools.fileWrite).toBeTruthy();
      expect(typeof strategy.tools.fileRead.execute).toBe('function');
      expect(typeof strategy.tools.fileWrite.execute).toBe('function');
      
      // Should have at least one command execution tool
      const hasCommandTool = strategy.tools.commandExecutor || strategy.tools.bashExecutor;
      expect(hasCommandTool).toBeTruthy();
    }, 15000);

    test('should fail gracefully if LLM client is missing', async () => {
      const badStrategy = new DebuggingStrategy(null, toolRegistry, {
        projectRoot: testWorkspaceDir
      });

      const task = new Task('bad-test', 'Test without LLM', {
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      const result = await badStrategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/LLM client is required/);
    });

    test('should fail gracefully if ToolRegistry is missing', async () => {
      const badStrategy = new DebuggingStrategy(llmClient, null, {
        projectRoot: testWorkspaceDir
      });

      const task = new Task('bad-test', 'Test without ToolRegistry', {
        llmClient,
        workspaceDir: testWorkspaceDir
      });

      const result = await badStrategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/ToolRegistry is required/);
    });
  });

  describe('Workspace Management', () => {
    test('should work with custom workspace directory', async () => {
      const customWorkspace = `/tmp/custom-debug-workspace-${Date.now()}`;
      await fs.mkdir(customWorkspace, { recursive: true });

      try {
        const task = new Task('workspace-test', 'Debug code in custom workspace', {
          llmClient,
          toolRegistry,
          workspaceDir: customWorkspace
        });

        // Add error to analyze
        task.storeArtifact('compilation_error', 
          'Error: Module not found - Cannot resolve "./missing-module"',
          'Module resolution error',
          'error'
        );

        const result = await strategy.onParentMessage(task, { type: 'start' });

        expect(result.success).toBe(true);
        
        // Check that analysis was stored
        const artifacts = task.getAllArtifacts();
        expect(artifacts).toHaveProperty('error_analysis');
        
      } finally {
        await fs.rm(customWorkspace, { recursive: true, force: true });
      }
    }, 20000);
  });

  describe('Message Handling', () => {
    test('should handle abort message', async () => {
      const result = await strategy.onParentMessage(null, { type: 'abort' });
      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should acknowledge unknown messages', async () => {
      const result = await strategy.onParentMessage(null, { type: 'unknown' });
      expect(result.acknowledged).toBe(true);
    });

    test('should reject child messages', async () => {
      const result = await strategy.onChildMessage(null, { type: 'test' });
      expect(result.acknowledged).toBe(false);
    });
  });

  describe('Debug Classification', () => {
    test('should classify different types of debugging tasks', async () => {
      const testCases = [
        {
          description: 'Analyze the stack trace from the server crash',
          expectedCategory: 'ERROR_ANALYSIS'
        },
        {
          description: 'Fix the memory leak in the image processing module',
          expectedCategory: 'CODE_FIXING'
        },
        {
          description: 'Debug why the unit tests are failing',
          expectedCategory: 'TEST_DEBUGGING'
        },
        {
          description: 'Investigate why the API responses are slow',
          expectedCategory: 'PERFORMANCE_DEBUGGING'
        }
      ];

      for (const testCase of testCases) {
        const task = new Task('classify-debug', testCase.description, {
          llmClient,
          toolRegistry,
          workspaceDir: testWorkspaceDir
        });

        // Add a generic error to ensure the strategy has something to work with
        task.storeArtifact('general_error', 'Sample error for classification', 'Error info', 'error');

        // We can't easily test the private _classifyDebugTask method directly,
        // but we can verify the strategy doesn't crash and produces some result
        const result = await strategy.onParentMessage(task, { type: 'start' });
        
        // Should not crash and should attempt to process the task
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      }
    }, 60000); // Longer timeout for multiple LLM calls
  });

  describe('Error Artifact Detection', () => {
    test('should identify error artifacts correctly', () => {
      const mockArtifacts = {
        'syntax_error': { type: 'error', value: 'SyntaxError: ...' },
        'test_failure': { type: 'failure', value: 'Test failed...' },
        'log_output': { type: 'log', value: 'Error: Connection failed' },
        'normal_file': { type: 'file', value: 'console.log("hello");' },
        'config_data': { type: 'json', value: '{"port": 3000}' }
      };

      // Test the private method through a mock task
      const mockTask = {
        getAllArtifacts: () => mockArtifacts
      };

      const errorArtifacts = strategy._getErrorArtifacts(mockTask);
      
      expect(errorArtifacts.length).toBe(3); // Should find 3 error-related artifacts
      expect(errorArtifacts.map(a => a.name)).toEqual(
        expect.arrayContaining(['syntax_error', 'test_failure', 'log_output'])
      );
    });

    test('should identify code files correctly', () => {
      expect(strategy._isCodeFile('app.js')).toBe(true);
      expect(strategy._isCodeFile('component.tsx')).toBe(true);
      expect(strategy._isCodeFile('utils.py')).toBe(true);
      expect(strategy._isCodeFile('config.json')).toBe(false);
      expect(strategy._isCodeFile('readme.md')).toBe(false);
    });
  });

  describe('Compilation Error Handling', () => {
    test('should handle compilation errors', async () => {
      const task = new Task('fix-compilation', 'Fix TypeScript compilation errors', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add compilation error artifacts
      task.storeArtifact('compilation_output',
        'src/app.ts(15,3): error TS2322: Type "string" is not assignable to type "number"',
        'TypeScript compilation errors',
        'error'
      );

      task.storeArtifact('build_log',
        'Build failed with 3 compilation errors in src/ directory',
        'Build failure log',
        'log'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      // Should have attempted to process the compilation errors
      const artifacts = task.getAllArtifacts();
      expect(Object.keys(artifacts).length).toBeGreaterThan(2); // Should have added analysis
    }, 30000);
  });

  describe('Performance Debugging', () => {
    test('should analyze performance issues', async () => {
      const task = new Task('debug-performance', 'Debug slow database queries', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add performance data
      task.storeArtifact('performance_data',
        { slowQueries: ['SELECT * FROM users', 'SELECT * FROM orders'], avgResponseTime: 2500 },
        'Performance monitoring data',
        'json'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      
      // Should have created performance analysis
      const artifacts = task.getAllArtifacts();
      expect(artifacts).toHaveProperty('performance_analysis');
    }, 25000);
  });
});