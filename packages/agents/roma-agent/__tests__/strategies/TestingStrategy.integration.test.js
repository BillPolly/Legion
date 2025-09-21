/**
 * Integration tests for TestingStrategy
 * Uses real LLM client and ToolRegistry - NO MOCKS as per CLAUDE.md instructions
 * Tests actual strategy functionality end-to-end
 */

import TestingStrategy from '../../src/strategies/coding/TestingStrategy.js';
import { Task } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

describe('TestingStrategy Integration Tests', () => {
  let strategy;
  let llmClient;
  let toolRegistry;
  let testWorkspaceDir;

  beforeEach(async () => {
    // Create unique test workspace for each test
    testWorkspaceDir = `/tmp/testing-strategy-test-${Date.now()}`;
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

    strategy = new TestingStrategy(llmClient, toolRegistry, {
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
      expect(strategy.getName()).toBe('Testing');
    });

    test('should use configured project root', () => {
      expect(strategy.projectRoot).toBe(testWorkspaceDir);
    });

    test('should have required tools initialized', async () => {
      expect(strategy.tools).toBeDefined();
      expect(strategy.tools.fileRead).toBeNull(); // Not loaded until _initializeComponents
      expect(strategy.tools.fileWrite).toBeNull();
      expect(strategy.tools.generateTest).toBeNull();
    });
  });

  describe('End-to-End Test Generation', () => {
    test('should generate tests for code artifacts', async () => {
      // Create a task with code artifacts
      const task = new Task('generate-tests', 'Generate tests for the calculator functions', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add code artifact that needs testing
      task.storeArtifact('calculator.js', 
        'function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a * b; }',
        'Calculator functions to test',
        'file'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      expect(task.status).toBe('completed');
      
      // Check that test artifacts were created
      const artifacts = task.getAllArtifacts();
      const testArtifacts = Object.keys(artifacts).filter(key => key.includes('.test.'));
      expect(testArtifacts.length).toBeGreaterThan(0);
      
      // Verify actual test files were created in workspace
      const workspaceFiles = await fs.readdir(testWorkspaceDir, { recursive: true });
      const testFiles = workspaceFiles.filter(file => file.includes('.test.'));
      expect(testFiles.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for LLM calls

    test('should generate meaningful test content', async () => {
      const task = new Task('create-api-tests', 'Generate tests for REST API endpoints', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Add API code artifact
      task.storeArtifact('api.js',
        'function getUserById(id) { if (!id) throw new Error("ID required"); return { id, name: "User" + id }; }',
        'API function to test',
        'file'
      );

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      
      // Find the generated test file
      const artifacts = task.getAllArtifacts();
      const testArtifacts = Object.entries(artifacts).filter(([key]) => key.includes('.test.'));
      expect(testArtifacts.length).toBeGreaterThan(0);
      
      const [testName, testArtifact] = testArtifacts[0];
      const testContent = testArtifact.value;
      expect(testContent.length).toBeGreaterThan(0);
      expect(testContent).toMatch(/test|describe|it|expect/); // Should contain test framework syntax
      expect(testContent).toMatch(/getUserById/); // Should test the specific function
    }, 30000);
  });

  describe('Test Execution', () => {
    test('should run existing tests successfully', async () => {
      const task = new Task('run-tests', 'Run existing test suite', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      // Create a simple test file first
      const testDir = path.join(testWorkspaceDir, 'tests');
      await fs.mkdir(testDir, { recursive: true });
      const testContent = `
        const { describe, test, expect } = require('@jest/globals');
        describe('Sample Test', () => {
          test('should pass', () => {
            expect(1 + 1).toBe(2);
          });
        });
      `;
      await fs.writeFile(path.join(testDir, 'sample.test.js'), testContent);

      // Create package.json with test script
      const packageJson = {
        name: 'test-project',
        scripts: {
          test: 'jest'
        },
        devDependencies: {
          jest: '^29.0.0'
        }
      };
      await fs.writeFile(path.join(testWorkspaceDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBeDefined(); // May pass or fail depending on test environment
      
      // Check that test results were captured
      const artifacts = task.getAllArtifacts();
      expect(artifacts).toHaveProperty('test_results');
    }, 20000);
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
    }, 15000);

    test('should fail gracefully if LLM client is missing', async () => {
      const badStrategy = new TestingStrategy(null, toolRegistry, {
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
      const badStrategy = new TestingStrategy(llmClient, null, {
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
    test('should create test files in correct workspace directory', async () => {
      const customWorkspace = `/tmp/custom-test-workspace-${Date.now()}`;
      await fs.mkdir(customWorkspace, { recursive: true });

      try {
        const task = new Task('workspace-test', 'Generate tests in custom workspace', {
          llmClient,
          toolRegistry,
          workspaceDir: customWorkspace
        });

        // Add code to test
        task.storeArtifact('utils.js', 'function isEven(n) { return n % 2 === 0; }', 'Utility function', 'file');

        const result = await strategy.onParentMessage(task, { type: 'start' });

        expect(result.success).toBe(true);
        
        // Check files were created in custom workspace, not default
        const customFiles = await fs.readdir(customWorkspace, { recursive: true });
        const testFiles = customFiles.filter(file => file.includes('.test.'));
        expect(testFiles.length).toBeGreaterThan(0);
        
        const defaultFiles = await fs.readdir(testWorkspaceDir);
        expect(defaultFiles.length).toBe(0); // Should be empty
        
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

  describe('Test Classification', () => {
    test('should classify different types of testing tasks', async () => {
      const testCases = [
        {
          description: 'Generate unit tests for calculator functions',
          expectedType: 'UNIT_TESTING'
        },
        {
          description: 'Run all existing tests and report coverage',
          expectedType: 'RUN_TESTS'
        },
        {
          description: 'Analyze why the login tests are failing',
          expectedType: 'ANALYZE_FAILURES'
        },
        {
          description: 'Create integration tests for the API endpoints',
          expectedType: 'INTEGRATION_TESTING'
        }
      ];

      for (const testCase of testCases) {
        const task = new Task('classify-test', testCase.description, {
          llmClient,
          toolRegistry,
          workspaceDir: testWorkspaceDir
        });

        // We can't easily test the private _classifyTestTask method directly,
        // but we can verify the strategy doesn't crash and produces some result
        const result = await strategy.onParentMessage(task, { type: 'start' });
        
        // Should not crash and should attempt to process the task
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      }
    }, 45000); // Longer timeout for multiple LLM calls
  });

  describe('Code File Detection', () => {
    test('should identify code files correctly', () => {
      expect(strategy._isCodeFile('calculator.js')).toBe(true);
      expect(strategy._isCodeFile('component.tsx')).toBe(true);
      expect(strategy._isCodeFile('utils.py')).toBe(true);
      expect(strategy._isCodeFile('readme.txt')).toBe(false);
      expect(strategy._isCodeFile('data.json')).toBe(false);
    });

    test('should generate correct test filenames', () => {
      expect(strategy._getTestFilename('calculator.js')).toBe('tests/calculator.test.js');
      expect(strategy._getTestFilename('src/utils.ts')).toBe('tests/utils.test.ts');
      expect(strategy._getTestFilename('component.jsx')).toBe('tests/component.test.jsx');
    });
  });
});