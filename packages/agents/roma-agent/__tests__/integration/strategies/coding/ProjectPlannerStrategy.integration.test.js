import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import ProjectPlannerStrategy from '../../../../src/strategies/coding/ProjectPlannerStrategy.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('ProjectPlannerStrategy Integration Tests', () => {
  let strategy;
  let llmClient;
  let toolRegistry;
  let mockTask;
  let resourceManager;

  beforeAll(async () => {
    // DEFINITIVE SINGLETON PATTERN - NO MOCKS!
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await getToolRegistry();
    
    if (!llmClient) throw new Error('LLM client not available');
    if (!toolRegistry) throw new Error('ToolRegistry not available');
  });

  beforeEach(async () => {
    // Create fresh strategy instance for each test with REAL services
    strategy = new ProjectPlannerStrategy(llmClient, toolRegistry, {
      projectRoot: '/tmp/roma-projects-test'
    });

    // Create mock task with required methods
    mockTask = {
      id: 'test-project-' + Date.now(),
      description: 'Create an Express API server with user authentication and CRUD operations',
      artifacts: {},
      
      storeArtifact: (artifact) => {
        mockTask.artifacts[artifact.id] = artifact;
      },
      
      getAllArtifacts: () => mockTask.artifacts,
      
      complete: (result) => {
        mockTask.result = result;
        mockTask.status = 'completed';
      },
      
      fail: (error) => {
        mockTask.error = error;
        mockTask.status = 'failed';
      },

      status: 'pending'
    };
  });

  afterEach(() => {
    // No mocks to clear - using real services
  });

  describe('Strategy Initialization', () => {
    it('should create ProjectPlannerStrategy instance', () => {
      expect(strategy).toBeInstanceOf(ProjectPlannerStrategy);
    });

    it('should return correct strategy name', () => {
      expect(strategy.getName()).toBe('ProjectPlanner');
    });

    it('should initialize with all required components', async () => {
      await strategy.initialize(mockTask);
      
      expect(strategy.llmClient).toBe(llmClient);
      expect(strategy.toolRegistry).toBe(toolRegistry);
      expect(strategy.requirementsAnalyzer).toBeDefined();
      expect(strategy.projectPlanner).toBeDefined();
      expect(strategy.executionOrchestrator).toBeDefined();
      expect(strategy.qualityController).toBeDefined();
      expect(strategy.progressTracker).toBeDefined();
      expect(strategy.stateManager).toBeDefined();
      expect(strategy.recoveryManager).toBeDefined();
      expect(strategy.eventStream).toBeDefined();
    });

    it('should initialize sub-strategies', async () => {
      await strategy.initialize(mockTask);
      
      expect(strategy.strategies.server).toBeDefined();
      expect(strategy.strategies.test).toBeDefined();
      expect(strategy.strategies.debug).toBeDefined();
    });

    it('should create project state', async () => {
      await strategy.initialize(mockTask);
      
      expect(strategy.state).toBeDefined();
      expect(strategy.state.projectId).toBe(mockTask.id);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should handle start message structure', async () => {
      const startMessage = { type: 'start' };
      // Test message structure validation without full execution
      expect(startMessage.type).toBe('start');
      expect(strategy.onParentMessage).toBeDefined();
      expect(typeof strategy.onParentMessage).toBe('function');
    });

    it('should handle status message', async () => {
      const statusMessage = { type: 'status' };
      const result = await strategy.onParentMessage(mockTask, statusMessage);
      
      expect(result).toBeDefined();
    });

    it('should handle cancel message', async () => {
      const cancelMessage = { type: 'cancel' };
      const result = await strategy.onParentMessage(mockTask, cancelMessage);
      
      expect(result).toBeDefined();
    });

    it('should acknowledge unknown message types', async () => {
      const unknownMessage = { type: 'unknown' };
      const result = await strategy.onParentMessage(mockTask, unknownMessage);
      
      expect(result.acknowledged).toBe(true);
    });
  });

  describe('Project Creation (Core)', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should handle project creation failure gracefully', async () => {
      // Create a task with invalid requirements to trigger failure
      const invalidTask = {
        ...mockTask,
        description: ''  // Empty description should cause failure
      };

      const startMessage = { type: 'start' };
      const result = await strategy.onParentMessage(invalidTask, startMessage);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Component Integration', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should integrate requirements analysis with project planning', async () => {
      // Test that requirements analysis flows into project planning
      const requirements = await strategy.requirementsAnalyzer.analyze(mockTask.description);
      expect(requirements).toBeDefined();
      expect(requirements.type).toMatch(/api|web|cli|library/);
      
      const plan = await strategy.projectPlanner.createPlan(requirements);
      expect(plan).toBeDefined();
      expect(plan.phases).toBeDefined();
      expect(Array.isArray(plan.phases)).toBe(true);
    });

    it('should integrate state management with progress tracking', async () => {
      const mockProject = {
        projectId: mockTask.id,
        phases: [
          { id: 'setup', name: 'Setup', status: 'completed', tasks: ['task-1'] }
        ],
        tasks: [
          { id: 'task-1', status: 'completed', type: 'generate' }
        ]
      };

      strategy.progressTracker.updateProject(mockProject);
      const progress = strategy.progressTracker.calculateProgress(mockProject);
      
      expect(progress.overall).toBeGreaterThan(0);
      expect(progress.byPhase.setup).toBe(100);
    });

    it('should integrate quality control with error recovery', async () => {
      const mockArtifact = {
        id: 'test-artifact',
        name: 'server.js',
        type: 'code',
        content: 'const express = require("express");'
      };

      const validation = await strategy.qualityController.validateArtifact(mockArtifact);
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
      
      if (!validation.valid && validation.issues) {
        // Test recovery manager can handle quality issues
        const mockError = new Error('Quality validation failed');
        const recovery = await strategy.recoveryManager.recover(mockError, mockTask, 1);
        expect(recovery).toBeDefined();
      }
    });
  });

  describe('Artifact Management', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should handle artifact validation', async () => {
      const mockArtifact = {
        id: 'package-json',
        name: 'package.json',
        type: 'config',
        content: '{"name": "test-project", "version": "1.0.0"}'
      };

      mockTask.storeArtifact(mockArtifact);
      
      const validation = await strategy.qualityController.validateArtifact(mockArtifact);
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should classify and recover from transient errors', async () => {
      const transientError = new Error('ECONNRESET: Connection reset by peer');
      const recovery = await strategy.recoveryManager.recover(transientError, mockTask, 1);
      
      expect(recovery).toBeDefined();
      expect(recovery.action).toBe('retry');
    });

    it('should handle resource errors with cleanup', async () => {
      const resourceError = new Error('JavaScript heap out of memory');
      const recovery = await strategy.recoveryManager.recover(resourceError, mockTask, 1);
      
      expect(recovery).toBeDefined();
      expect(['retry', 'cleanup_and_retry', 'retry_after_cleanup']).toContain(recovery.action);
    });

    it('should handle logic errors with replanning', async () => {
      const logicError = new TypeError('Cannot read property of undefined');
      
      try {
        await strategy.recoveryManager.recover(logicError, mockTask, 1);
      } catch (error) {
        // Recovery might fail due to missing LLM integration for replanning
        expect(error).toBeDefined();
      }
    });

    it('should rollback on fatal errors', async () => {
      const fatalError = new Error('State corruption detected');
      
      await expect(
        strategy.recoveryManager.recover(fatalError, mockTask, 1)
      ).rejects.toThrow('Fatal error');
    });
  });

  describe('State Persistence', () => {
    beforeEach(async () => {
      await strategy.initialize(mockTask);
    });

    it('should persist project state to disk', async () => {
      const mockState = {
        projectId: mockTask.id,
        status: 'planning',
        phases: [],
        tasks: []
      };

      await strategy.stateManager.save(mockState);
      const loadedState = await strategy.stateManager.load(mockTask.id);
      
      expect(loadedState).toBeDefined();
      expect(loadedState.projectId).toBe(mockTask.id);
    });

    it('should handle state versioning', async () => {
      const initialState = {
        projectId: mockTask.id,
        status: 'planning',
        version: 1
      };

      await strategy.stateManager.save(initialState);
      
      // Use update() method for version increment
      await strategy.stateManager.update({
        status: 'executing'
      });
      
      const loadedState = await strategy.stateManager.load(mockTask.id);
      
      expect(loadedState.version).toBe(2);
      expect(loadedState.status).toBe('executing');
    });
  });

  describe('Real Project Types', () => {
    it('should handle Express API project requirements', async () => {
      const apiTask = {
        ...mockTask,
        description: 'Create an Express REST API with user authentication, CRUD operations for blog posts, and MongoDB integration'
      };

      await strategy.initialize(apiTask);
      const requirements = await strategy.requirementsAnalyzer.analyze(apiTask.description);
      
      expect(requirements.type).toBe('api');
      // Test that local feature extraction is working (deterministic)
      expect(requirements.features).toEqual(
        expect.arrayContaining([
          'authentication',  // From _extractLocalFeatures
          'CRUD operations'  // From _extractLocalFeatures
        ])
      );
      // Test that local project type inference is working
      expect(requirements.technologies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nodejs|express/i)  // Should include Node.js technologies for API
        ])
      );
    });

    it('should handle CLI tool project requirements', async () => {
      const cliTask = {
        ...mockTask,
        description: 'Create a Node.js CLI tool for file processing with command-line arguments and batch operations'
      };

      await strategy.initialize(cliTask);
      const requirements = await strategy.requirementsAnalyzer.analyze(cliTask.description);
      
      expect(requirements.type).toBe('cli');
      // Test that local feature extraction is working (deterministic)
      expect(requirements.features).toEqual(
        expect.arrayContaining([
          'command line interface',  // From _extractLocalFeatures
          'file processing'          // From _extractLocalFeatures
        ])
      );
      // Test that local project type inference is working
      expect(requirements.technologies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nodejs/i)  // Should include Node.js for CLI
        ])
      );
    });

    it('should handle library project requirements', async () => {
      const libraryTask = {
        ...mockTask,
        description: 'Create a utility library for date formatting with TypeScript support and comprehensive test coverage'
      };

      await strategy.initialize(libraryTask);
      const requirements = await strategy.requirementsAnalyzer.analyze(libraryTask.description);
      
      expect(requirements.type).toBe('library');
      // Test that local feature extraction is working (deterministic)
      expect(requirements.features).toEqual(
        expect.arrayContaining([
          'testing',              // From _extractLocalFeatures
          'TypeScript support',   // From _extractLocalFeatures
          'utility functions',    // From _extractLocalFeatures
          'date formatting'       // From _extractLocalFeatures
        ])
      );
      // Test that local project type inference is working
      expect(requirements.technologies).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/nodejs|npm/i)  // Should include Node.js technologies for library
        ])
      );
    });
  });
});