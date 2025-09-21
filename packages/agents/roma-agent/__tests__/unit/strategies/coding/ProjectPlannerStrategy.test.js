/**
 * Unit tests for ProjectPlannerStrategy
 * Tests constructor, initialization, and basic component setup
 * NO MOCKS - using real services where needed
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import ProjectPlannerStrategy from '../../../../src/strategies/coding/ProjectPlannerStrategy.js';

describe('ProjectPlannerStrategy', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;

  beforeEach(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();
  });

  describe('Constructor and Basic Properties', () => {
    test('should create strategy with default options', () => {
      const strategy = new ProjectPlannerStrategy();
      
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('ProjectPlanner');
      expect(strategy.projectRoot).toBe('/tmp/roma-projects');
    });

    test('should create strategy with custom options', () => {
      const options = {
        projectRoot: '/custom/path',
        maxConcurrent: 5,
        maxRetries: 4
      };
      
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry, options);
      
      expect(strategy.projectRoot).toBe('/custom/path');
      expect(strategy.maxConcurrent).toBe(5);
      expect(strategy.maxRetries).toBe(4);
    });

    test('should accept llmClient and toolRegistry in constructor', () => {
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry);
      
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
    });

    test('should initialize component placeholders', () => {
      const strategy = new ProjectPlannerStrategy();
      
      // Components should be null before initialization
      expect(strategy.requirementsAnalyzer).toBeNull();
      expect(strategy.projectPlanner).toBeNull();
      expect(strategy.executionOrchestrator).toBeNull();
      expect(strategy.qualityController).toBeNull();
      expect(strategy.progressTracker).toBeNull();
      expect(strategy.stateManager).toBeNull();
      expect(strategy.parallelExecutor).toBeNull();
      expect(strategy.recoveryManager).toBeNull();
      expect(strategy.eventStream).toBeNull();
    });

    test('should initialize sub-strategies object', () => {
      const strategy = new ProjectPlannerStrategy();
      
      expect(strategy.strategies).toBeDefined();
      expect(strategy.strategies.server).toBeNull();
      expect(strategy.strategies.test).toBeNull();
      expect(strategy.strategies.debug).toBeNull();
    });
  });

  describe('Initialization', () => {
    test('should initialize with task context', async () => {
      const strategy = new ProjectPlannerStrategy();
      
      // Create mock task with context
      const mockTask = {
        id: 'test-task-123',
        description: 'Test task',
        context: {
          llmClient,
          toolRegistry
        }
      };
      
      await strategy.initialize(mockTask);
      
      // Should get services from task context
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
      
      // Should initialize all components
      expect(strategy.requirementsAnalyzer).toBeDefined();
      expect(strategy.projectPlanner).toBeDefined();
      expect(strategy.executionOrchestrator).toBeDefined();
      expect(strategy.qualityController).toBeDefined();
      expect(strategy.progressTracker).toBeDefined();
      expect(strategy.stateManager).toBeDefined();
      expect(strategy.parallelExecutor).toBeDefined();
      expect(strategy.recoveryManager).toBeDefined();
      expect(strategy.eventStream).toBeDefined();
      
      // Should initialize sub-strategies
      expect(strategy.strategies.server).toBeDefined();
      expect(strategy.strategies.test).toBeDefined();
      expect(strategy.strategies.debug).toBeDefined();
      
      // Should create prompts
      expect(strategy.prompts).toBeDefined();
      
      // Should load or create project state
      expect(strategy.state).toBeDefined();
      expect(strategy.state.projectId).toBe('test-task-123');
    });

    test('should use provided llmClient and toolRegistry over task context', async () => {
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry);
      
      // Create mock task with different context
      const mockTask = {
        id: 'test-task-456',
        description: 'Test task',
        context: {
          llmClient: null,
          toolRegistry: null
        }
      };
      
      await strategy.initialize(mockTask);
      
      // Should use constructor-provided services
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
    });

    test('should throw error if no LLM client available', async () => {
      const strategy = new ProjectPlannerStrategy();
      
      const mockTask = {
        id: 'test-task-789',
        description: 'Test task',
        context: {}
      };
      
      await expect(strategy.initialize(mockTask)).rejects.toThrow('LLM client is required');
    });

    test('should throw error if no ToolRegistry available', async () => {
      const strategy = new ProjectPlannerStrategy(llmClient, null);
      
      const mockTask = {
        id: 'test-task-abc',
        description: 'Test task',
        context: {
          llmClient
        }
      };
      
      await expect(strategy.initialize(mockTask)).rejects.toThrow('ToolRegistry is required');
    });

    test('should initialize sub-strategies with correct configuration', async () => {
      const customProjectRoot = '/custom/project/root';
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry, {
        projectRoot: customProjectRoot
      });
      
      const mockTask = {
        id: 'test-task-sub',
        description: 'Test task',
        context: {}
      };
      
      await strategy.initialize(mockTask);
      
      // Check that sub-strategies are initialized with correct config
      expect(strategy.strategies.server.projectRoot).toBe(customProjectRoot);
      expect(strategy.strategies.test.projectRoot).toBe(customProjectRoot);
      expect(strategy.strategies.debug.projectRoot).toBe(customProjectRoot);
    });
  });

  describe('getName method', () => {
    test('should return correct strategy name', () => {
      const strategy = new ProjectPlannerStrategy();
      expect(strategy.getName()).toBe('ProjectPlanner');
    });
  });

  describe('Component Initialization Validation', () => {
    test('should initialize RequirementsAnalyzer with LLM client', async () => {
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry);
      const mockTask = { id: 'test-req', context: {} };
      
      await strategy.initialize(mockTask);
      
      expect(strategy.requirementsAnalyzer).toBeDefined();
      expect(strategy.requirementsAnalyzer.llmClient).toBe(llmClient);
    });

    test('should initialize ProjectStructurePlanner with services', async () => {
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry);
      const mockTask = { id: 'test-plan', context: {} };
      
      await strategy.initialize(mockTask);
      
      expect(strategy.projectPlanner).toBeDefined();
      expect(strategy.projectPlanner.llmClient).toBe(llmClient);
      expect(strategy.projectPlanner.toolRegistry).toBe(toolRegistry);
    });

    test('should initialize StateManager with project root', async () => {
      const customRoot = '/test/state/root';
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry, {
        projectRoot: customRoot
      });
      const mockTask = { id: 'test-state', context: {} };
      
      await strategy.initialize(mockTask);
      
      expect(strategy.stateManager).toBeDefined();
      expect(strategy.stateManager.projectRoot).toBe(customRoot);
    });

    test('should initialize ParallelExecutor with concurrency settings', async () => {
      const strategy = new ProjectPlannerStrategy(llmClient, toolRegistry, {
        maxConcurrent: 7
      });
      const mockTask = { id: 'test-parallel', context: {} };
      
      await strategy.initialize(mockTask);
      
      expect(strategy.parallelExecutor).toBeDefined();
      expect(strategy.parallelExecutor.maxConcurrent).toBe(7);
    });
  });
});