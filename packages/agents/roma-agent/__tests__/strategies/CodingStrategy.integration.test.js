/**
 * Integration tests for CodingStrategy
 * Uses real LLM client and ToolRegistry - NO MOCKS as per CLAUDE.md instructions
 * Tests actual strategy functionality end-to-end
 */

import CodingStrategy from '../../src/strategies/coding/CodingStrategy.js';
import { Task } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

describe('CodingStrategy Integration Tests', () => {
  let strategy;
  let llmClient;
  let toolRegistry;
  let testWorkspaceDir;

  beforeEach(async () => {
    // Create unique test workspace for each test
    testWorkspaceDir = `/tmp/coding-strategy-test-${Date.now()}`;
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

    strategy = new CodingStrategy(llmClient, toolRegistry, {
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
      expect(strategy.getName()).toBe('Coding');
    });

    test('should use configured project root', () => {
      expect(strategy.projectRoot).toBe(testWorkspaceDir);
    });

    test('should have required tools initialized', async () => {
      expect(strategy.tools).toBeDefined();
      expect(strategy.tools.fileWrite).toBeNull(); // Not loaded until _initializeComponents
      expect(strategy.tools.directoryCreate).toBeNull();
    });
  });

  describe('End-to-End Code Generation', () => {
    test('should handle simple file creation task', async () => {
      const task = new Task('create-file', 'Create a simple calculator function', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      expect(task.status).toBe('completed');
      
      // Check that artifacts were created
      const artifacts = task.getAllArtifacts();
      expect(Object.keys(artifacts).length).toBeGreaterThan(0);
      
      // Verify actual files were created in workspace
      const workspaceFiles = await fs.readdir(testWorkspaceDir);
      expect(workspaceFiles.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for LLM calls

    test('should create files with meaningful content', async () => {
      const task = new Task('create-utility', 'Create a utility function for string manipulation', {
        llmClient,
        toolRegistry,
        workspaceDir: testWorkspaceDir
      });

      const result = await strategy.onParentMessage(task, { type: 'start' });

      expect(result.success).toBe(true);
      
      // Find the generated file
      const workspaceFiles = await fs.readdir(testWorkspaceDir);
      const jsFiles = workspaceFiles.filter(file => file.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);
      
      // Check file content
      const filePath = path.join(testWorkspaceDir, jsFiles[0]);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/function|const|=>/); // Should contain function-like code
    }, 30000);
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
      expect(strategy.tools.fileWrite).toBeTruthy();
      expect(strategy.tools.directoryCreate).toBeTruthy();
      expect(typeof strategy.tools.fileWrite.execute).toBe('function');
      expect(typeof strategy.tools.directoryCreate.execute).toBe('function');
    }, 15000);

    test('should fail gracefully if LLM client is missing', async () => {
      const badStrategy = new CodingStrategy(null, toolRegistry, {
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
      const badStrategy = new CodingStrategy(llmClient, null, {
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
    test('should create files in correct workspace directory', async () => {
      const customWorkspace = `/tmp/custom-workspace-${Date.now()}`;
      await fs.mkdir(customWorkspace, { recursive: true });

      try {
        const task = new Task('workspace-test', 'Create a test file', {
          llmClient,
          toolRegistry,
          workspaceDir: customWorkspace
        });

        const result = await strategy.onParentMessage(task, { type: 'start' });

        expect(result.success).toBe(true);
        
        // Check files were created in custom workspace, not default
        const customFiles = await fs.readdir(customWorkspace);
        expect(customFiles.length).toBeGreaterThan(0);
        
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
      expect(result.acknowledged).toBe(true);
    });
  });
});