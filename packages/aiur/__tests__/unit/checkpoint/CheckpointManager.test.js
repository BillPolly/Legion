/**
 * Tests for CheckpointManager class
 * 
 * Tests checkpoint creation, state capture, validation execution, and metadata management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CheckpointManager } from '../../../src/checkpoint/CheckpointManager.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';

describe('CheckpointManager', () => {
  let handleRegistry;
  let plan;
  let checkpointManager;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    
    const mockPlanData = {
      id: 'test-checkpoint-plan',
      title: 'Checkpoint Test Plan',
      description: 'A plan for testing checkpoint functionality',
      steps: [
        {
          id: 'step1',
          title: 'Initialize data',
          action: 'test_init',
          parameters: { value: 10 },
          expectedOutputs: ['initData']
        },
        {
          id: 'step2',
          title: 'Process data',
          action: 'test_process',
          parameters: { data: '@initData', multiplier: 2 },
          expectedOutputs: ['processedData'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Finalize data',
          action: 'test_finalize',
          parameters: { data: '@processedData' },
          dependsOn: ['step2']
        }
      ],
      metadata: {
        created: new Date(),
        author: 'test'
      }
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
    checkpointManager = new CheckpointManager(plan, handleRegistry);
  });

  describe('CheckpointManager Creation and Configuration', () => {
    test('should create checkpoint manager with required dependencies', () => {
      expect(checkpointManager.plan).toBe(plan);
      expect(checkpointManager.handleRegistry).toBe(handleRegistry);
      expect(checkpointManager.checkpoints).toEqual(new Map());
    });

    test('should initialize with default options', () => {
      expect(checkpointManager.options.maxCheckpoints).toBe(10);
      expect(checkpointManager.options.autoCleanup).toBe(true);
      expect(checkpointManager.options.validateOnCreate).toBe(true);
      expect(checkpointManager.options.includeMetadata).toBe(true);
    });

    test('should accept custom options', () => {
      const customManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 5,
        autoCleanup: false,
        validateOnCreate: false,
        includeMetadata: false
      });

      expect(customManager.options.maxCheckpoints).toBe(5);
      expect(customManager.options.autoCleanup).toBe(false);
      expect(customManager.options.validateOnCreate).toBe(false);
      expect(customManager.options.includeMetadata).toBe(false);
    });

    test('should provide checkpoint statistics', () => {
      const stats = checkpointManager.getStatistics();
      
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.maxCheckpoints).toBe(10);
      expect(stats.autoCleanupEnabled).toBe(true);
      expect(stats.oldestCheckpoint).toBeNull();
      expect(stats.newestCheckpoint).toBeNull();
    });
  });

  describe('Checkpoint Creation', () => {
    test('should create basic checkpoint', () => {
      // Setup some plan state
      plan.startStep('step1');
      handleRegistry.create('testHandle', { data: 'test' });

      const checkpointId = checkpointManager.createCheckpoint('basic-checkpoint');
      
      expect(checkpointId).toBeDefined();
      expect(checkpointManager.hasCheckpoint(checkpointId)).toBe(true);
      
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      expect(checkpoint.name).toBe('basic-checkpoint');
      expect(checkpoint.planState).toBeDefined();
      expect(checkpoint.handleSnapshot).toBeDefined();
      expect(checkpoint.createdAt).toBeInstanceOf(Date);
    });

    test('should create checkpoint with auto-generated name', () => {
      const checkpointId = checkpointManager.createCheckpoint();
      
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      expect(checkpoint.name).toMatch(/^checkpoint-\d+-/);
    });

    test('should capture plan state in checkpoint', () => {
      // Execute first step
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 complete' });

      const checkpointId = checkpointManager.createCheckpoint('plan-state-test');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.planState.completedSteps).toContain('step1');
      expect(checkpoint.planState.currentStep).toBeNull();
      expect(checkpoint.planState.status).toBe('created');
    });

    test('should capture handle snapshot in checkpoint', () => {
      handleRegistry.create('handle1', { value: 'test1' });
      handleRegistry.create('handle2', { value: 'test2', nested: { data: 42 } });

      const checkpointId = checkpointManager.createCheckpoint('handle-test');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.handleSnapshot).toHaveProperty('handle1');
      expect(checkpoint.handleSnapshot).toHaveProperty('handle2');
      expect(checkpoint.handleSnapshot.handle1.data).toEqual({ value: 'test1' });
      expect(checkpoint.handleSnapshot.handle2.data.nested.data).toBe(42);
    });

    test('should include metadata when enabled', () => {
      const checkpointId = checkpointManager.createCheckpoint('metadata-test');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.metadata).toBeDefined();
      expect(checkpoint.metadata.planId).toBe(plan.id);
      expect(checkpoint.metadata.planTitle).toBe(plan.title);
      expect(checkpoint.metadata.totalSteps).toBe(3);
      expect(checkpoint.metadata.completedSteps).toBe(0);
      expect(checkpoint.metadata.handleCount).toBe(0);
    });

    test('should exclude metadata when disabled', () => {
      const noMetadataManager = new CheckpointManager(plan, handleRegistry, {
        includeMetadata: false
      });

      const checkpointId = noMetadataManager.createCheckpoint('no-metadata-test');
      const checkpoint = noMetadataManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.metadata).toBeUndefined();
    });

    test('should validate checkpoint before creation when enabled', () => {
      // Create an invalid state
      plan.state.completedSteps = ['nonexistent-step'];

      expect(() => {
        checkpointManager.createCheckpoint('invalid-test');
      }).toThrow('Checkpoint validation failed');
    });

    test('should skip validation when disabled', () => {
      const noValidationManager = new CheckpointManager(plan, handleRegistry, {
        validateOnCreate: false
      });

      // Create an invalid state
      plan.state.completedSteps = ['nonexistent-step'];

      const checkpointId = noValidationManager.createCheckpoint('skip-validation-test');
      expect(checkpointId).toBeDefined();
    });

    test('should respect max checkpoints limit', () => {
      const limitedManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 2,
        autoCleanup: true
      });

      const id1 = limitedManager.createCheckpoint('checkpoint1');
      const id2 = limitedManager.createCheckpoint('checkpoint2');
      const id3 = limitedManager.createCheckpoint('checkpoint3');

      expect(limitedManager.getCheckpointCount()).toBe(2);
      expect(limitedManager.hasCheckpoint(id1)).toBe(false); // Oldest evicted
      expect(limitedManager.hasCheckpoint(id2)).toBe(true);
      expect(limitedManager.hasCheckpoint(id3)).toBe(true);
    });

    test('should fail when exceeding max checkpoints without auto-cleanup', () => {
      const limitedManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 1,
        autoCleanup: false
      });

      limitedManager.createCheckpoint('checkpoint1');
      
      expect(() => {
        limitedManager.createCheckpoint('checkpoint2');
      }).toThrow('Maximum number of checkpoints reached');
    });
  });

  describe('Checkpoint Retrieval and Management', () => {
    test('should retrieve checkpoint by ID', () => {
      const checkpointId = checkpointManager.createCheckpoint('retrieve-test');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBe(checkpointId);
      expect(checkpoint.name).toBe('retrieve-test');
    });

    test('should return null for non-existent checkpoint', () => {
      const checkpoint = checkpointManager.getCheckpoint('nonexistent');
      expect(checkpoint).toBeNull();
    });

    test('should check checkpoint existence', () => {
      const checkpointId = checkpointManager.createCheckpoint('exists-test');
      
      expect(checkpointManager.hasCheckpoint(checkpointId)).toBe(true);
      expect(checkpointManager.hasCheckpoint('nonexistent')).toBe(false);
    });

    test('should list all checkpoints', () => {
      const id1 = checkpointManager.createCheckpoint('list-test-1');
      const id2 = checkpointManager.createCheckpoint('list-test-2');
      
      const checkpoints = checkpointManager.listCheckpoints();
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints.map(c => c.id)).toContain(id1);
      expect(checkpoints.map(c => c.id)).toContain(id2);
    });

    test('should list checkpoints with sorting options', () => {
      jest.useFakeTimers();
      
      const id1 = checkpointManager.createCheckpoint('first');
      jest.advanceTimersByTime(1000);
      const id2 = checkpointManager.createCheckpoint('second');
      
      const byDate = checkpointManager.listCheckpoints({ sortBy: 'createdAt', order: 'desc' });
      expect(byDate[0].id).toBe(id2);
      expect(byDate[1].id).toBe(id1);
      
      const byName = checkpointManager.listCheckpoints({ sortBy: 'name' });
      expect(byName[0].name).toBe('first');
      expect(byName[1].name).toBe('second');
      
      jest.useRealTimers();
    });

    test('should get checkpoint count', () => {
      expect(checkpointManager.getCheckpointCount()).toBe(0);
      
      checkpointManager.createCheckpoint('count-test-1');
      expect(checkpointManager.getCheckpointCount()).toBe(1);
      
      checkpointManager.createCheckpoint('count-test-2');
      expect(checkpointManager.getCheckpointCount()).toBe(2);
    });

    test('should find checkpoints by name pattern', () => {
      checkpointManager.createCheckpoint('test-checkpoint-1');
      checkpointManager.createCheckpoint('test-checkpoint-2');
      checkpointManager.createCheckpoint('other-checkpoint');
      
      const testCheckpoints = checkpointManager.findCheckpoints({ namePattern: 'test-*' });
      expect(testCheckpoints).toHaveLength(2);
      
      const allCheckpoints = checkpointManager.findCheckpoints({ namePattern: '*checkpoint*' });
      expect(allCheckpoints).toHaveLength(3);
    });

    test('should find checkpoints by date range', () => {
      jest.useFakeTimers();
      const startDate = new Date();
      
      const id1 = checkpointManager.createCheckpoint('before');
      jest.advanceTimersByTime(10000); // 10 seconds
      const id2 = checkpointManager.createCheckpoint('after');
      
      const endDate = new Date();
      
      const inRange = checkpointManager.findCheckpoints({
        dateRange: { start: startDate, end: endDate }
      });
      
      expect(inRange).toHaveLength(2);
      
      jest.useRealTimers();
    });
  });

  describe('Checkpoint Deletion and Cleanup', () => {
    test('should delete checkpoint by ID', () => {
      const checkpointId = checkpointManager.createCheckpoint('delete-test');
      
      expect(checkpointManager.hasCheckpoint(checkpointId)).toBe(true);
      
      const deleted = checkpointManager.deleteCheckpoint(checkpointId);
      expect(deleted).toBe(true);
      expect(checkpointManager.hasCheckpoint(checkpointId)).toBe(false);
    });

    test('should return false when deleting non-existent checkpoint', () => {
      const deleted = checkpointManager.deleteCheckpoint('nonexistent');
      expect(deleted).toBe(false);
    });

    test('should clear all checkpoints', () => {
      checkpointManager.createCheckpoint('clear-test-1');
      checkpointManager.createCheckpoint('clear-test-2');
      
      expect(checkpointManager.getCheckpointCount()).toBe(2);
      
      checkpointManager.clearCheckpoints();
      expect(checkpointManager.getCheckpointCount()).toBe(0);
    });

    test('should perform automatic cleanup of old checkpoints', () => {
      jest.useFakeTimers();
      
      const cleanupManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 3,
        autoCleanup: true,
        cleanupThreshold: 2
      });

      // Create checkpoints over time
      const id1 = cleanupManager.createCheckpoint('old1');
      jest.advanceTimersByTime(1000);
      const id2 = cleanupManager.createCheckpoint('old2');
      jest.advanceTimersByTime(1000);
      const id3 = cleanupManager.createCheckpoint('new1');
      jest.advanceTimersByTime(1000);
      const id4 = cleanupManager.createCheckpoint('new2'); // Should trigger cleanup

      expect(cleanupManager.getCheckpointCount()).toBe(3);
      expect(cleanupManager.hasCheckpoint(id1)).toBe(false); // Oldest cleaned up
      expect(cleanupManager.hasCheckpoint(id2)).toBe(true);
      expect(cleanupManager.hasCheckpoint(id3)).toBe(true);
      expect(cleanupManager.hasCheckpoint(id4)).toBe(true);
      
      jest.useRealTimers();
    });

    test('should clean up checkpoints by age', () => {
      jest.useFakeTimers();
      
      const id1 = checkpointManager.createCheckpoint('old');
      jest.advanceTimersByTime(60000); // 1 minute
      const id2 = checkpointManager.createCheckpoint('new');
      
      // Clean up checkpoints older than 30 seconds
      const cleaned = checkpointManager.cleanupByAge(30000);
      
      expect(cleaned).toBe(1);
      expect(checkpointManager.hasCheckpoint(id1)).toBe(false);
      expect(checkpointManager.hasCheckpoint(id2)).toBe(true);
      
      jest.useRealTimers();
    });
  });

  describe('Checkpoint Validation', () => {
    test('should validate checkpoint structure', () => {
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'test' });
      
      const validation = checkpointManager.validateCheckpoint();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(validation.canCreateCheckpoint).toBe(true);
    });

    test('should detect validation issues', () => {
      // Create invalid plan state
      plan.state.completedSteps = ['nonexistent-step'];
      plan.state.stepStates = {}; // Missing step state
      
      const validation = checkpointManager.validateCheckpoint();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.canCreateCheckpoint).toBe(false);
    });

    test('should validate specific checkpoint', () => {
      const checkpointId = checkpointManager.createCheckpoint('validate-test');
      
      const validation = checkpointManager.validateSpecificCheckpoint(checkpointId);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    test('should detect corrupted checkpoint data', () => {
      const checkpointId = checkpointManager.createCheckpoint('corruption-test');
      
      // Manually corrupt checkpoint data
      const checkpoint = checkpointManager.checkpoints.get(checkpointId);
      checkpoint.planState = null;
      
      const validation = checkpointManager.validateSpecificCheckpoint(checkpointId);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('corrupted'))).toBe(true);
    });
  });

  describe('Checkpoint Metadata and Statistics', () => {
    test('should provide detailed checkpoint statistics', () => {
      jest.useFakeTimers();
      
      checkpointManager.createCheckpoint('stat-test-1');
      jest.advanceTimersByTime(1000);
      checkpointManager.createCheckpoint('stat-test-2');
      
      const stats = checkpointManager.getStatistics();
      
      expect(stats.totalCheckpoints).toBe(2);
      expect(stats.maxCheckpoints).toBe(10);
      expect(stats.oldestCheckpoint).toBeDefined();
      expect(stats.newestCheckpoint).toBeDefined();
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });

    test('should calculate checkpoint sizes', () => {
      handleRegistry.create('largeHandle', { data: 'x'.repeat(1000) });
      
      const checkpointId = checkpointManager.createCheckpoint('size-test');
      const size = checkpointManager.getCheckpointSize(checkpointId);
      
      expect(size).toBeGreaterThan(1000);
    });

    test('should provide checkpoint health information', () => {
      checkpointManager.createCheckpoint('health-test-1');
      checkpointManager.createCheckpoint('health-test-2');
      
      const health = checkpointManager.getHealthInfo();
      
      expect(health.healthy).toBe(true);
      expect(health.checkpointCount).toBe(2);
      expect(health.memoryUsage).toBeGreaterThan(0);
      expect(health.issues).toEqual([]);
    });

    test('should detect health issues', () => {
      const unhealthyManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 2
      });

      // Fill to capacity
      unhealthyManager.createCheckpoint('health1');
      unhealthyManager.createCheckpoint('health2');
      
      const health = unhealthyManager.getHealthInfo();
      
      expect(health.healthy).toBe(false);
      expect(health.issues.some(issue => issue.includes('capacity'))).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle checkpoint creation errors', () => {
      // Mock a scenario where state capture fails
      const errorManager = new CheckpointManager(plan, handleRegistry);
      
      // Override the _captureState method to simulate error
      errorManager._captureState = () => {
        throw new Error('State capture failed');
      };

      expect(() => {
        errorManager.createCheckpoint('error-test');
      }).toThrow('Failed to create checkpoint: State capture failed');
    });

    test('should handle invalid checkpoint names', () => {
      expect(() => {
        checkpointManager.createCheckpoint('');
      }).toThrow('Invalid checkpoint name');
      
      expect(() => {
        checkpointManager.createCheckpoint(123);
      }).toThrow('Invalid checkpoint name');
    });

    test('should handle memory pressure gracefully', () => {
      const memoryManager = new CheckpointManager(plan, handleRegistry, {
        maxCheckpoints: 1000, // Large number
        autoCleanup: true
      });

      // Create large handles to simulate memory pressure
      for (let i = 0; i < 10; i++) {
        handleRegistry.create(`large${i}`, { data: 'x'.repeat(10000) });
        memoryManager.createCheckpoint(`memory-test-${i}`);
      }

      // Should not crash and should manage memory
      expect(memoryManager.getCheckpointCount()).toBeGreaterThan(0);
      expect(memoryManager.getCheckpointCount()).toBeLessThanOrEqual(1000);
    });

    test('should handle concurrent checkpoint operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          Promise.resolve().then(() => {
            return checkpointManager.createCheckpoint(`concurrent-${i}`);
          })
        );
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(results.every(id => typeof id === 'string')).toBe(true);
      expect(checkpointManager.getCheckpointCount()).toBe(5);
    });
  });

  describe('Integration with Plan State', () => {
    test('should capture complex plan state', () => {
      // Execute multiple steps with various states
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 complete' });
      plan.createStepHandle('step1', 'step1Output', { data: 'step1 data' });
      
      plan.startStep('step2');
      plan.failStep('step2', { message: 'Step 2 failed', code: 'TEST_ERROR' });
      
      const checkpointId = checkpointManager.createCheckpoint('complex-state');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.planState.completedSteps).toContain('step1');
      expect(checkpoint.planState.failedSteps).toContain('step2');
      expect(checkpoint.planState.stepStates.step1.status).toBe('completed');
      expect(checkpoint.planState.stepStates.step2.status).toBe('failed');
      expect(checkpoint.planState.handles).toHaveProperty('step1Output');
    });

    test('should capture handle relationships', () => {
      // Create handles with dependencies
      handleRegistry.create('baseData', { value: 10 });
      handleRegistry.create('derivedData', { base: '@baseData', computed: 20 });
      
      const checkpointId = checkpointManager.createCheckpoint('relationships');
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      
      expect(checkpoint.handleSnapshot.baseData).toBeDefined();
      expect(checkpoint.handleSnapshot.derivedData).toBeDefined();
      expect(checkpoint.handleSnapshot.derivedData.data.base).toBe('@baseData');
    });
  });
});