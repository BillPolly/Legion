/**
 * Integration tests for DevelopmentOrchestrationStrategy
 * 
 * Tests the complete development workflow orchestration:
 * - Code generation → Test writing → Test execution → Debugging → Loop
 * - Failure routing logic (test vs code fixes)
 * - Iteration limits and convergence
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import DevelopmentOrchestrationStrategy from '../../src/strategies/orchestration/DevelopmentOrchestrationStrategy.js';
import { Task } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('DevelopmentOrchestrationStrategy Integration Tests', () => {
  let strategy;
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let testOutputDir;

  beforeEach(async () => {
    // Clear test output directory
    testOutputDir = '/tmp/roma-projects';
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }

    // Get real services
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await resourceManager.get('toolRegistry');

    // Create strategy with real services
    strategy = new DevelopmentOrchestrationStrategy(llmClient, toolRegistry, {
      projectRoot: '/tmp',
      maxIterations: 3
    });
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should initialize with required components', async () => {
    expect(strategy.getName()).toBe('DevelopmentOrchestration');
    expect(strategy.llmClient).toBe(llmClient);
    expect(strategy.toolRegistry).toBe(toolRegistry);
    expect(strategy.maxIterations).toBe(3);
  });

  test('should handle orchestration work message', async () => {
    const task = new Task('Create a simple calculator function', null);
    
    const message = { type: 'start' };
    
    // This will test the complete orchestration flow
    const result = await strategy.onParentMessage(task, message);
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('artifacts');
    
    if (result.success) {
      expect(result.result).toHaveProperty('message');
      expect(result.result).toHaveProperty('iterations');
      expect(result.result.iterations).toBeGreaterThan(0);
      expect(result.result.iterations).toBeLessThanOrEqual(3);
    } else {
      // If it fails, it should have a meaningful error
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  }, 120000); // 2 minute timeout for complex workflow

  test('should execute coding phase first', async () => {
    const task = new Task('Generate a simple Node.js HTTP server', null);
    
    // Initialize components
    await strategy._initializeComponents(task);
    
    expect(strategy.codingStrategy).toBeDefined();
    expect(strategy.testingStrategy).toBeDefined();
    expect(strategy.debuggingStrategy).toBeDefined();
    
    // Verify sub-strategies are properly configured
    expect(strategy.codingStrategy.llmClient).toBe(llmClient);
    expect(strategy.testingStrategy.llmClient).toBe(llmClient);
    expect(strategy.debuggingStrategy.llmClient).toBe(llmClient);
  });

  test('should handle simple successful workflow', async () => {
    const task = new Task('Create a function that adds two numbers', null);
    
    const result = await strategy._executeWorkflowLoop(task);
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('iterations');
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    
    if (result.success) {
      expect(result.result.finalState).toBe('COMPLETED');
      expect(result.result.message).toContain('completed successfully');
    }
    
    // Check that artifacts were generated
    const artifacts = task.getAllArtifacts();
    const artifactNames = Object.keys(artifacts);
    
    // Should have code artifacts
    const codeArtifacts = artifactNames.filter(name => 
      name.endsWith('.js') || name.includes('code') || name.includes('generated')
    );
    expect(codeArtifacts.length).toBeGreaterThan(0);
  }, 180000); // 3 minute timeout

  test('should handle iteration limits correctly', async () => {
    // Create strategy with very low iteration limit
    const limitedStrategy = new DevelopmentOrchestrationStrategy(llmClient, toolRegistry, {
      projectRoot: '/tmp',
      maxIterations: 1
    });
    
    const task = new Task('Create a complex distributed system', null);
    
    const result = await limitedStrategy._executeWorkflowLoop(task);
    
    // Should either succeed in 1 iteration or fail with iteration limit
    expect(result.iterations).toBe(1);
    
    if (!result.success) {
      expect(result.error).toContain('did not converge');
    }
  }, 90000);

  test('should route between code and test fixes correctly', async () => {
    const task = new Task('Create a function with intentional bugs', null);
    
    // Mock a debugging result that suggests fixing code
    const mockDebuggingResult = {
      success: true,
      result: {
        analysis: 'Code has syntax errors in the main function',
        suggestedFixes: ['Fix syntax error on line 5', 'Add missing semicolon']
      }
    };
    
    const nextAction = await strategy._determineNextAction(task, mockDebuggingResult);
    
    expect(nextAction).toHaveProperty('action');
    expect(nextAction).toHaveProperty('reasoning');
    expect(nextAction).toHaveProperty('confidence');
    expect(['FIX_CODE', 'FIX_TESTS', 'RETRY_TESTING']).toContain(nextAction.action);
  });

  test('should handle strategy failures gracefully', async () => {
    const task = new Task('', null); // Empty task that should cause failures
    
    const result = await strategy._executeWorkflowLoop(task);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  });

  test('should maintain workflow state correctly', async () => {
    const task = new Task('Create a simple greeting function', null);
    
    // Initialize components first
    await strategy._initializeComponents(task);
    
    expect(strategy.workflowState).toBe('INITIAL');
    
    // Test state progression would happen during actual workflow execution
    // This tests the initialization state
    expect(strategy.currentIteration).toBe(0);
  });

  test('should execute individual strategies correctly', async () => {
    const task = new Task('Create a utility function', null);
    
    await strategy._initializeComponents(task);
    
    // Test coding strategy execution
    const codingResult = await strategy._executeStrategy(task, strategy.codingStrategy, 'CODING');
    
    expect(codingResult).toHaveProperty('success');
    expect(codingResult).toHaveProperty('artifacts');
    
    if (codingResult.success) {
      // Should have generated code artifacts
      const artifacts = task.getAllArtifacts();
      expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    }
  }, 90000);

  test('should handle abort messages', async () => {
    const task = new Task('Any task', null);
    
    const result = await strategy.onParentMessage(task, { type: 'abort' });
    
    expect(result.acknowledged).toBe(true);
    expect(result.aborted).toBe(true);
  });

  test('should handle child strategy messages', async () => {
    const childTask = new Task('Child task', null);
    
    // Test completion message
    const completionResult = await strategy.onChildMessage(childTask, {
      type: 'completed',
      result: { success: true, message: 'Strategy completed' }
    });
    
    expect(completionResult.acknowledged).toBe(true);
    expect(completionResult.success).toBe(true);
    
    // Test failure message
    const failureResult = await strategy.onChildMessage(childTask, {
      type: 'failed',
      error: new Error('Strategy failed')
    });
    
    expect(failureResult.acknowledged).toBe(true);
    expect(failureResult.success).toBe(false);
  });

  test('should create organized project directories', async () => {
    const task = new Task('Create a web server with API endpoints', null);
    
    await strategy._initializeComponents(task);
    
    // Execute one iteration to see directory creation
    const result = await strategy._executeStrategy(task, strategy.codingStrategy, 'CODING');
    
    if (result.success) {
      // Check if project directory was created under /tmp/roma-projects
      const projectDirs = await fs.readdir('/tmp/roma-projects').catch(() => []);
      
      expect(projectDirs.length).toBeGreaterThan(0);
      
      // Should have descriptive project names
      const hasDescriptiveNames = projectDirs.some(dir => 
        dir.includes('project') || dir.includes('web') || dir.includes('server')
      );
      expect(hasDescriptiveNames).toBe(true);
    }
  }, 90000);

  test('should handle context extraction correctly', async () => {
    const task = new Task('Test task', null);
    
    // Mock task context
    task.context = {
      llmClient: llmClient,
      toolRegistry: toolRegistry,
      workspaceDir: '/custom/workspace'
    };
    
    const context = strategy._getContextFromTask(task);
    
    expect(context.llmClient).toBe(llmClient);
    expect(context.toolRegistry).toBe(toolRegistry);
    expect(context.workspaceDir).toBe('/custom/workspace');
  });
});