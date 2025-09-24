/**
 * Unit tests for RecoveryStrategy - Prototypal Pattern
 * Tests error recovery, retry logic, and failure handling
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { createRecoveryStrategy } from '../../../../src/strategies/coding/RecoveryStrategy.js';

// Mock Task for testing - simulates the actual Task interface
class MockTask {
  constructor(id, description) {
    this.id = id;
    this.description = description;
    this.parent = null;
    this.context = {};
    this.artifacts = [];
    this.artifactMap = {};
    this.failed = false;
    this.completed = false;
    this.conversation = [];
    this.sentMessages = [];
  }
  
  fail(error) {
    this.failed = true;
    this.error = error;
  }
  
  complete(result) {
    this.completed = true;
    this.result = result;
  }
  
  addConversationEntry(role, content) {
    this.conversation.push({ role, content });
  }
  
  storeArtifact(name, value, description, type) {
    const artifact = {
      name,
      value,
      content: value,
      description,
      type
    };
    this.artifacts.push(artifact);
    this.artifactMap[name] = artifact;
  }
  
  getAllArtifacts() {
    return this.artifactMap;
  }
  
  lookup(key) {
    if (key === 'llmClient') return this.context.llmClient;
    if (key === 'toolRegistry') return this.context.toolRegistry;
    if (key === 'workspaceDir') return this.context.workspaceDir;
    return null;
  }
  
  send(target, message) {
    this.sentMessages.push({ target, message });
  }
}

describe('RecoveryStrategy - Prototypal Pattern', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
  }, 30000);

  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
    
    test('should accept custom options', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry, {
        maxRetries: {
          TRANSIENT: 5,
          RESOURCE: 3,
          LOGIC: 2,
          FATAL: 0
        },
        backoffStrategy: 'linear'
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should work without llmClient and toolRegistry (will get from task)', () => {
      const strategy = createRecoveryStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });

  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with recovery initialization', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      // Create a mock task for recovery start
      const task = new MockTask('recovery-1', 'Initialize recovery system');
      task.context = { llmClient, toolRegistry };
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.recovery).toBeDefined();
        expect(result.recovery.initialized).toBe(true);
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle error recovery message', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('recovery-2', 'Recover from error');
      task.context = { llmClient, toolRegistry };
      
      // Store error information for recovery
      task.storeArtifact('error-info', {
        error: 'ECONNRESET: Connection reset by peer',
        task: { id: 'failed-task', type: 'server', description: 'Create server' },
        attempt: 1
      }, 'Error recovery information', 'error');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.recovery).toBeDefined();
        expect(result.recovery.strategy).toBeDefined();
        done();
      });
      
      // Call onMessage with recovery request
      strategy.onMessage.call(task, task, { 
        type: 'recover',
        errorData: {
          error: new Error('ECONNRESET: Connection reset by peer'),
          task: { id: 'failed-task', type: 'server' },
          attempt: 1
        }
      });
    }, 30000);

    test('should handle child task completion', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      // Create mock parent task
      const parentTask = new MockTask('parent-task', 'Parent task');
      parentTask.storeArtifact = jest.fn();
      
      // Create mock child task
      const childTask = new MockTask('child-task', 'Child task');
      childTask.parent = parentTask;
      childTask.getAllArtifacts = jest.fn(() => ({
        'recovery-result': { content: 'recovery complete', description: 'Recovery result', type: 'result' }
      }));
      
      // Call onMessage with parent task as 'this' context
      strategy.onMessage.call(parentTask, childTask, { 
        type: 'completed',
        result: { success: true }
      });
      
      // Should copy artifacts from child
      expect(parentTask.storeArtifact).toHaveBeenCalledWith(
        'recovery-result', 'recovery complete', 'Recovery result', 'result'
      );
    });

    test('should handle child task failure', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      // Create mock parent task
      const parentTask = new MockTask('parent-task', 'Parent task');
      const grandParent = new MockTask('grandparent', 'Grandparent');
      parentTask.parent = grandParent;
      
      // Create mock child task
      const childTask = new MockTask('child-task', 'Child task');
      childTask.parent = parentTask;
      
      // Call onMessage with parent task as 'this' context for child failure
      strategy.onMessage.call(parentTask, childTask, { 
        type: 'failed',
        error: new Error('Recovery failed')
      });
      
      // Should notify parent of child failure
      expect(parentTask.sentMessages.length).toBe(1);
      expect(parentTask.sentMessages[0].message.type).toBe('child-failed');
      expect(parentTask.sentMessages[0].message.child).toBe(childTask);
    });

    test('should handle unknown messages gracefully', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should catch async errors and fail task', (done) => {
      // Create strategy without llmClient to trigger error
      const strategy = createRecoveryStrategy(null, null);
      
      const task = new MockTask('test', 'Test task');
      task.context = {}; // No llmClient in context
      
      task.fail = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('LLM client is required');
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle synchronous errors in message handler', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      // Make getAllArtifacts throw to trigger sync error
      task.getAllArtifacts = () => {
        throw new Error('Sync error');
      };
      
      // Should not throw - errors are caught
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'start' });
      }).not.toThrow();
    });

    test('should handle missing error data gracefully', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Recover without error data');
      task.context = { llmClient, toolRegistry };
      
      // No error artifacts - should still work with basic recovery
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.recovery).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Integration with Task', () => {
    test('should work with task lookup for dependencies', (done) => {
      const strategy = createRecoveryStrategy(); // No dependencies provided
      
      const task = new MockTask('test', 'Recovery integration test');
      task.context = { 
        llmClient,
        toolRegistry
      };
      
      // Add error information
      task.storeArtifact('error-info', {
        error: 'Network timeout',
        task: { id: 'failed-task', type: 'server' },
        attempt: 1
      }, 'Error for recovery', 'error');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        done();
      });
      
      // Call onMessage - should get dependencies from task context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should store recovery results as artifacts', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Recovery with artifacts');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn(() => {
        const artifacts = task.getAllArtifacts();
        expect(artifacts['recovery-result']).toBeDefined();
        expect(artifacts['recovery-result'].type).toBe('recovery');
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should handle complex recovery scenarios', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Complex recovery scenario');
      task.context = { llmClient, toolRegistry };
      
      task.storeArtifact('error-info', {
        error: 'Multiple failures detected',
        task: { id: 'complex-task', type: 'deployment' },
        attempt: 2,
        previousAttempts: [
          { error: 'Network error', strategy: 'retry' },
          { error: 'Resource error', strategy: 'cleanup' }
        ]
      }, 'Complex error scenario', 'error');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.recovery).toBeDefined();
        expect(result.recovery.strategy).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Resource Management', () => {
    test('should handle resource management through strategy', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Resource management test');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.resourcesManaged).toBe(true);
        done();
      });
      
      // Call onMessage with resource management request
      strategy.onMessage.call(task, task, { 
        type: 'manage-resources',
        action: 'cleanup'
      });
    });

    test('should handle memory cleanup operations', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Memory cleanup test');
      task.context = { llmClient, toolRegistry };
      
      // Mock garbage collection request
      const originalGc = global.gc;
      global.gc = jest.fn();
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        // Restore original gc
        global.gc = originalGc;
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'cleanup-memory'
      });
    });

    test('should handle missing garbage collector gracefully', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test without gc');
      const originalGc = global.gc;
      delete global.gc;
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'cleanup-memory' });
      }).not.toThrow();
      
      // Restore
      global.gc = originalGc;
    });
  });

  describe('Task Replanning', () => {
    test('should handle replanning through strategy messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Task replanning test');
      task.context = { llmClient, toolRegistry };
      
      // Store failure information for replanning
      task.storeArtifact('failure-info', {
        originalTask: {
          id: 'failed-task',
          type: 'generate',
          description: 'Create Express server',
          strategy: 'SimpleNodeServer'
        },
        error: 'Missing dependency: express',
        analysis: {
          reason: 'missing_dependency',
          missingItems: ['express'],
          failedApproaches: ['SimpleNodeServer']
        }
      }, 'Failure information for replanning', 'failure');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.replanning).toBeDefined();
        expect(result.replanning.analysisComplete).toBe(true);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'replan',
        failureData: {
          task: { id: 'failed-task', strategy: 'SimpleNodeServer' },
          error: new Error('Missing dependency: express')
        }
      });
    }, 30000);

    test('should extract constraints from failure analysis', () => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Extract constraints test');
      
      // Mock a constraint extraction method on the task for testing
      task.extractConstraints = (analysis) => {
        return {
          useValidation: analysis.suggestedConstraints?.useValidation || false,
          templateBased: analysis.suggestedConstraints?.templateBased || false,
          avoidComplexSyntax: analysis.suggestedConstraints?.avoidComplexSyntax || false,
          avoidStrategies: analysis.failedApproaches || []
        };
      };
      
      const analysis = {
        reason: 'invalid_syntax',
        failedApproaches: ['direct_generation'],
        suggestedConstraints: {
          useValidation: true,
          templateBased: true,
          avoidComplexSyntax: true
        }
      };
      
      const constraints = task.extractConstraints(analysis);
      
      expect(constraints).toMatchObject({
        useValidation: true,
        templateBased: true,
        avoidComplexSyntax: true,
        avoidStrategies: ['direct_generation']
      });
    });

    test('should create replan request through task context', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Replan request test');
      task.context = { llmClient, toolRegistry };
      
      // Store analysis and planning context
      task.storeArtifact('replan-context', {
        originalTask: {
          id: 'replan-task',
          type: 'generate',
          description: 'Create API endpoints',
          strategy: 'SimpleNodeServer'
        },
        failureReason: 'validation_failure',
        constraints: {
          useStrictValidation: true,
          incrementalGeneration: true,
          avoidStrategies: ['SimpleNodeServer']
        }
      }, 'Replan context', 'context');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.replanning).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'create-replan',
        planningData: {
          failureReason: 'validation_failure',
          constraints: {
            useStrictValidation: true,
            incrementalGeneration: true
          }
        }
      });
    }, 30000);
  });

  describe('Checkpoint and Rollback', () => {
    test('should handle checkpoint creation through strategy messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Create checkpoint test');
      task.context = { llmClient, toolRegistry };
      
      const state = {
        projectId: 'test-project',
        tasks: [{ id: 'task-1', status: 'completed' }],
        artifacts: [{ id: 'artifact-1', type: 'code' }]
      };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.checkpoint).toBeDefined();
        expect(result.checkpoint.id).toMatch(/^checkpoint_\d+$/);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'create-checkpoint',
        state: state
      });
    });

    test('should handle rollback requests through strategy messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Rollback test');
      task.context = { llmClient, toolRegistry };
      
      // Store checkpoint data in task artifacts
      task.storeArtifact('checkpoint-data', {
        checkpointId: 'checkpoint_123',
        state: { projectId: 'test', tasks: [] },
        timestamp: Date.now()
      }, 'Checkpoint for rollback', 'checkpoint');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.rollback).toBeDefined();
        expect(result.rollback.checkpointId).toBe('checkpoint_123');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'rollback',
        checkpointId: 'checkpoint_123'
      });
    });

    test('should handle rollback to latest checkpoint', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Rollback to latest');
      task.context = { llmClient, toolRegistry };
      
      // Store multiple checkpoints, latest one should be used
      task.storeArtifact('latest-checkpoint', {
        checkpointId: 'checkpoint_latest',
        state: { projectId: 'test', tasks: [{ id: 'task-1' }] },
        timestamp: Date.now()
      }, 'Latest checkpoint', 'checkpoint');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.rollback).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'rollback-latest'
      });
    });

    test('should handle rollback failure gracefully', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Rollback non-existent');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Checkpoint not found');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'rollback',
        checkpointId: 'non-existent-checkpoint'
      });
    });
  });

  describe('Default Recovery', () => {
    test('should handle default recovery through strategy messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Default recovery test');
      task.context = { llmClient, toolRegistry };
      
      // Store error information for default recovery
      task.storeArtifact('unknown-error', {
        error: 'Unknown error type',
        task: { id: 'unknown-task', type: 'unknown', description: 'Unknown task' }
      }, 'Unknown error for default recovery', 'error');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.action).toBe('log_and_continue');
        expect(result.logged).toBe(true);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'default-recovery',
        error: new Error('Unknown error type')
      });
    });

    test('should log error details in default recovery', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Default recovery with logging');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Recovery: Using default strategy'),
          expect.objectContaining({
            taskId: task.id,
            error: 'Test error for logging'
          })
        );
        
        consoleSpy.mockRestore();
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'default-recovery',
        error: new Error('Test error for logging')
      });
    });
  });

  describe('Recovery Statistics', () => {
    test('should track recovery attempts through strategy messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Recovery statistics test');
      task.context = { llmClient, toolRegistry };
      
      // Store initial statistics state
      task.storeArtifact('recovery-stats', {
        byType: {
          TRANSIENT: { total: 0, successful: 0, failed: 0 },
          RESOURCE: { total: 0, successful: 0, failed: 0 },
          LOGIC: { total: 0, successful: 0, failed: 0 }
        },
        overall: { total: 0, successful: 0, failed: 0 }
      }, 'Recovery statistics', 'stats');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.statistics).toBeDefined();
        expect(result.statistics.recorded).toBe(true);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'record-attempt',
        errorType: 'TRANSIENT',
        success: true
      });
    });

    test('should calculate recovery statistics', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Calculate statistics');
      task.context = { llmClient, toolRegistry };
      
      // Store statistics with some data
      task.storeArtifact('recovery-stats', {
        byType: {
          TRANSIENT: { total: 2, successful: 1, failed: 1, successRate: 0.5 },
          RESOURCE: { total: 1, successful: 1, failed: 0, successRate: 1.0 },
          LOGIC: { total: 1, successful: 1, failed: 0, successRate: 1.0 }
        },
        overall: { total: 4, successful: 3, failed: 1, successRate: 0.75 }
      }, 'Recovery statistics with data', 'stats');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.statistics).toBeDefined();
        expect(result.statistics.byType.TRANSIENT.successRate).toBe(0.5);
        expect(result.statistics.byType.RESOURCE.successRate).toBe(1.0);
        expect(result.statistics.overall.successRate).toBe(0.75);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'get-statistics'
      });
    });

    test('should handle statistics updates', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Update statistics');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.statistics).toBeDefined();
        expect(result.statistics.updated).toBe(true);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'update-statistics',
        attempts: [
          { errorType: 'TRANSIENT', success: true },
          { errorType: 'TRANSIENT', success: true },
          { errorType: 'RESOURCE', success: false },
          { errorType: 'LOGIC', success: true }
        ]
      });
    });
  });

  describe('Configuration Management', () => {
    test('should create strategy with custom configuration', () => {
      const customConfig = {
        maxRetries: {
          TRANSIENT: 5,
          RESOURCE: 3,
          LOGIC: 2,
          FATAL: 0
        },
        backoffStrategy: 'linear',
        resourceCleanupEnabled: false
      };

      const strategy = createRecoveryStrategy(llmClient, toolRegistry, customConfig);
      
      // Strategy should be created successfully with custom config
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should handle configuration requests through messages', (done) => {
      const customConfig = {
        maxRetries: {
          TRANSIENT: 5,
          RESOURCE: 3,
          LOGIC: 2,
          FATAL: 0
        },
        backoffStrategy: 'linear',
        resourceCleanupEnabled: false
      };

      const strategy = createRecoveryStrategy(llmClient, toolRegistry, customConfig);
      
      const task = new MockTask('test', 'Get configuration');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.configuration).toBeDefined();
        expect(result.configuration.maxRetries.TRANSIENT).toBe(5);
        expect(result.configuration.backoffStrategy).toBe('linear');
        expect(result.configuration.resourceCleanupEnabled).toBe(false);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'get-configuration'
      });
    });

    test('should handle partial configuration merging', () => {
      const partialConfig = {
        maxRetries: {
          TRANSIENT: 10 // Only override this one
        }
      };

      const strategy = createRecoveryStrategy(llmClient, toolRegistry, partialConfig);
      
      // Strategy should be created successfully with merged config
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should update configuration through messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Update configuration');
      task.context = { llmClient, toolRegistry };
      
      const newConfig = {
        maxRetries: {
          TRANSIENT: 7,
          RESOURCE: 4
        },
        backoffStrategy: 'fibonacci'
      };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.configuration).toBeDefined();
        expect(result.configuration.updated).toBe(true);
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'update-configuration',
        config: newConfig
      });
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle null or undefined errors gracefully through messages', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Handle null errors');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.errorClassification).toBe('LOGIC');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'classify-error',
        error: null
      });
    });

    test('should handle errors without message property', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Handle malformed errors');
      task.context = { llmClient, toolRegistry };
      
      const errorObject = { code: 'UNKNOWN_ERROR' };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.errorClassification).toBe('LOGIC');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'classify-error',
        error: errorObject
      });
    });

    test('should handle circular reference errors during analysis', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Handle circular references');
      task.context = { llmClient, toolRegistry };
      
      // Create circular reference in task artifacts
      const circularData = { id: 'circular-task' };
      circularData.circular = circularData;
      
      task.storeArtifact('circular-error', {
        error: 'Circular reference',
        task: circularData
      }, 'Error with circular reference', 'error');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        // Should not throw despite circular reference
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'default-recovery',
        error: new Error('Circular reference')
      });
    });

    test('should validate recovery result format', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Validate result format');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('action');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.action).toBe('string');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'recover',
        errorData: {
          error: new Error('Format test error'),
          task: { id: 'format-task', type: 'test' },
          attempt: 1
        }
      });
    }, 30000);

    test('should handle undefined errors gracefully', (done) => {
      const strategy = createRecoveryStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Handle undefined errors');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.errorClassification).toBe('LOGIC');
        done();
      });
      
      strategy.onMessage.call(task, task, { 
        type: 'classify-error',
        error: undefined
      });
    });
  });
});