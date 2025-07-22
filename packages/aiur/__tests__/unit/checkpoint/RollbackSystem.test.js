/**
 * Tests for Rollback System
 * 
 * Tests state restoration, handle state rollback, partial rollback,
 * and rollback validation functionality
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RollbackSystem } from '../../../src/checkpoint/RollbackSystem.js';
import { CheckpointManager } from '../../../src/checkpoint/CheckpointManager.js';
import { StateCaptureSystem } from '../../../src/checkpoint/StateCaptureSystem.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';

describe('RollbackSystem', () => {
  let handleRegistry;
  let toolRegistry;
  let plan;
  let checkpointManager;
  let stateCaptureSystem;
  let rollbackSystem;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry();
    
    const mockPlanData = {
      id: 'rollback-test-plan',
      title: 'Rollback Test Plan',
      description: 'A plan for testing rollback functionality',
      steps: [
        {
          id: 'step1',
          title: 'Initialize data',
          action: 'init_data',
          parameters: { value: 10 },
          expectedOutputs: ['initData']
        },
        {
          id: 'step2',
          title: 'Process data',
          action: 'process_data',
          parameters: { data: '@initData', multiplier: 2 },
          expectedOutputs: ['processedData'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Finalize data',
          action: 'finalize_data',
          parameters: { data: '@processedData' },
          dependsOn: ['step2']
        }
      ]
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
    checkpointManager = new CheckpointManager(plan, handleRegistry);
    stateCaptureSystem = new StateCaptureSystem(plan, handleRegistry, toolRegistry);
    rollbackSystem = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem);
  });

  describe('RollbackSystem Creation and Configuration', () => {
    test('should create rollback system with required dependencies', () => {
      expect(rollbackSystem.plan).toBe(plan);
      expect(rollbackSystem.handleRegistry).toBe(handleRegistry);
      expect(rollbackSystem.checkpointManager).toBe(checkpointManager);
      expect(rollbackSystem.stateCaptureSystem).toBe(stateCaptureSystem);
    });

    test('should initialize with default options', () => {
      expect(rollbackSystem.options.validateBeforeRollback).toBe(true);
      expect(rollbackSystem.options.createBackupBeforeRollback).toBe(true);
      expect(rollbackSystem.options.preserveRollbackHistory).toBe(true);
      expect(rollbackSystem.options.maxRollbackDepth).toBe(10);
    });

    test('should accept custom options', () => {
      const customRollback = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem, {
        validateBeforeRollback: false,
        createBackupBeforeRollback: false,
        preserveRollbackHistory: false,
        maxRollbackDepth: 5
      });

      expect(customRollback.options.validateBeforeRollback).toBe(false);
      expect(customRollback.options.createBackupBeforeRollback).toBe(false);
      expect(customRollback.options.preserveRollbackHistory).toBe(false);
      expect(customRollback.options.maxRollbackDepth).toBe(5);
    });

    test('should provide rollback statistics', () => {
      const stats = rollbackSystem.getStatistics();
      
      expect(stats.totalRollbacks).toBe(0);
      expect(stats.successfulRollbacks).toBe(0);
      expect(stats.failedRollbacks).toBe(0);
      expect(stats.lastRollbackTime).toBeNull();
    });
  });

  describe('State Restoration', () => {
    test('should restore state from checkpoint', () => {
      // Initial state
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 done' });
      plan.createStepHandle('step1', 'output1', { value: 'data1' });
      handleRegistry.create('externalHandle', { value: 'external' });
      
      // Create checkpoint
      const checkpointId = checkpointManager.createCheckpoint('restore-test');
      
      // Modify state after checkpoint
      plan.startStep('step2');
      plan.completeStep('step2', { result: 'step2 done' });
      handleRegistry.create('newHandle', { value: 'new data' });
      plan.createStepHandle('step2', 'output2', { value: 'data2' });
      
      // Restore to checkpoint
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      expect(plan.state.completedSteps).toEqual(['step1']);
      expect(plan.state.currentStep).toBeNull();
      expect(handleRegistry.existsByName('output1')).toBe(true);
      expect(handleRegistry.existsByName('output2')).toBe(false);
      expect(handleRegistry.existsByName('newHandle')).toBe(false);
      expect(handleRegistry.existsByName('externalHandle')).toBe(true);
    });

    test('should restore state from state capture', () => {
      // Initial state
      plan.startStep('step1');
      handleRegistry.create('testHandle', { value: 'original' });
      
      const capture = stateCaptureSystem.createFullCapture('capture-test');
      
      // Modify state
      plan.completeStep('step1', { result: 'modified' });
      handleRegistry.update('testHandle', { value: 'modified' });
      handleRegistry.create('newHandle', { value: 'new' });
      
      // Restore from capture
      const result = rollbackSystem.restoreFromCapture(capture);
      
      expect(result.success).toBe(true);
      expect(plan.state.currentStep).toBe('step1');
      expect(handleRegistry.getByName('testHandle').data.value).toBe('original');
      expect(handleRegistry.existsByName('newHandle')).toBe(false);
    });

    test('should validate state before rollback when enabled', () => {
      const checkpointId = checkpointManager.createCheckpoint('validation-test');
      
      // Corrupt current state
      plan.state.completedSteps = ['nonexistent-step'];
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    test('should skip validation when disabled', () => {
      const noValidationRollback = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem, {
        validateBeforeRollback: false
      });

      const checkpointId = checkpointManager.createCheckpoint('skip-validation-test');
      
      // Corrupt current state
      plan.state.completedSteps = ['nonexistent-step'];
      
      const result = noValidationRollback.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
    });

    test('should create backup before rollback when enabled', () => {
      const checkpointId = checkpointManager.createCheckpoint('backup-test');
      
      // Modify state
      plan.startStep('step1');
      handleRegistry.create('backupHandle', { value: 'backup data' });
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(rollbackSystem.hasBackup(result.backupId)).toBe(true);
    });

    test('should skip backup creation when disabled', () => {
      const noBackupRollback = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem, {
        createBackupBeforeRollback: false
      });

      const checkpointId = checkpointManager.createCheckpoint('no-backup-test');
      
      plan.startStep('step1');
      
      const result = noBackupRollback.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      expect(result.backupId).toBeUndefined();
    });
  });

  describe('Handle State Rollback', () => {
    test('should rollback handle registry state', () => {
      // Initial handles
      handleRegistry.create('handle1', { value: 'original1' });
      handleRegistry.create('handle2', { value: 'original2' });
      
      const capture = stateCaptureSystem.createFullCapture('handle-rollback-test');
      
      // Modify handles
      handleRegistry.update('handle1', { value: 'modified1' });
      handleRegistry.delete(handleRegistry.nameIndex.get('handle2'));
      handleRegistry.create('handle3', { value: 'new3' });
      
      // Rollback handle state only
      const result = rollbackSystem.rollbackHandleState(capture);
      
      expect(result.success).toBe(true);
      expect(handleRegistry.getByName('handle1').data.value).toBe('original1');
      expect(handleRegistry.existsByName('handle2')).toBe(true);
      expect(handleRegistry.existsByName('handle3')).toBe(false);
    });

    test('should rollback specific handles only', () => {
      handleRegistry.create('handle1', { value: 'original1' });
      handleRegistry.create('handle2', { value: 'original2' });
      handleRegistry.create('handle3', { value: 'original3' });
      
      const capture = stateCaptureSystem.createFullCapture('selective-rollback-test');
      
      // Modify all handles
      handleRegistry.update('handle1', { value: 'modified1' });
      handleRegistry.update('handle2', { value: 'modified2' });
      handleRegistry.update('handle3', { value: 'modified3' });
      
      // Rollback only specific handles
      const result = rollbackSystem.rollbackSpecificHandles(capture, ['handle1', 'handle3']);
      
      expect(result.success).toBe(true);
      expect(handleRegistry.getByName('handle1').data.value).toBe('original1');
      expect(handleRegistry.getByName('handle2').data.value).toBe('modified2'); // Not rolled back
      expect(handleRegistry.getByName('handle3').data.value).toBe('original3');
    });

    test('should handle missing handles during rollback', () => {
      handleRegistry.create('handle1', { value: 'original1' });
      
      const capture = stateCaptureSystem.createFullCapture('missing-handle-test');
      
      // Delete handle
      handleRegistry.deleteByName('handle1');
      
      // Rollback should recreate the handle
      const result = rollbackSystem.rollbackHandleState(capture);
      
      expect(result.success).toBe(true);
      expect(handleRegistry.existsByName('handle1')).toBe(true);
      expect(handleRegistry.getByName('handle1').data.value).toBe('original1');
    });

    test('should preserve handle metadata during rollback', () => {
      const customMetadata = { source: 'test', version: '1.0' };
      handleRegistry.create('metadataHandle', { value: 'test' }, customMetadata);
      
      const capture = stateCaptureSystem.createFullCapture('metadata-rollback-test');
      
      // Modify handle and metadata
      handleRegistry.update('metadataHandle', { value: 'modified' });
      const handle = handleRegistry.getByName('metadataHandle');
      handle.metadata.version = '2.0';
      
      // Rollback
      const result = rollbackSystem.rollbackHandleState(capture);
      
      expect(result.success).toBe(true);
      const restoredHandle = handleRegistry.getByName('metadataHandle');
      expect(restoredHandle.data.value).toBe('test');
      expect(restoredHandle.metadata.source).toBe('test');
      expect(restoredHandle.metadata.version).toBe('1.0');
    });
  });

  describe('Partial Rollback', () => {
    test('should perform partial rollback of plan state only', () => {
      // Initial state
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 done' });
      handleRegistry.create('handle1', { value: 'original' });
      
      const checkpointId = checkpointManager.createCheckpoint('partial-plan-test');
      
      // Modify both plan and handles
      plan.startStep('step2');
      plan.completeStep('step2', { result: 'step2 done' });
      handleRegistry.update('handle1', { value: 'modified' });
      
      // Partial rollback - plan state only
      const result = rollbackSystem.partialRollback(checkpointId, {
        includePlanState: true,
        includeHandleState: false
      });
      
      expect(result.success).toBe(true);
      expect(plan.state.completedSteps).toEqual(['step1']);
      expect(handleRegistry.getByName('handle1').data.value).toBe('modified'); // Not rolled back
    });

    test('should perform partial rollback of handle state only', () => {
      plan.startStep('step1');
      handleRegistry.create('handle1', { value: 'original' });
      
      const checkpointId = checkpointManager.createCheckpoint('partial-handle-test');
      
      // Modify both plan and handles
      plan.completeStep('step1', { result: 'completed' });
      handleRegistry.update('handle1', { value: 'modified' });
      
      // Partial rollback - handle state only
      const result = rollbackSystem.partialRollback(checkpointId, {
        includePlanState: false,
        includeHandleState: true
      });
      
      expect(result.success).toBe(true);
      expect(plan.state.completedSteps).toEqual(['step1']); // Not rolled back
      expect(handleRegistry.getByName('handle1').data.value).toBe('original');
    });

    test('should perform selective step rollback', () => {
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 done' });
      plan.startStep('step2');
      plan.completeStep('step2', { result: 'step2 done' });
      
      const checkpointId = checkpointManager.createCheckpoint('selective-step-test');
      
      plan.startStep('step3');
      plan.completeStep('step3', { result: 'step3 done' });
      
      // Rollback only step3
      const result = rollbackSystem.rollbackSteps(checkpointId, ['step3']);
      
      expect(result.success).toBe(true);
      expect(plan.state.completedSteps).toEqual(['step1', 'step2']);
      expect(plan.state.stepStates.step3).toBeUndefined();
    });

    test('should rollback with custom filters', () => {
      handleRegistry.create('important', { value: 'keep' });
      handleRegistry.create('temporary', { value: 'rollback' });
      
      const checkpointId = checkpointManager.createCheckpoint('filter-test');
      
      handleRegistry.update('important', { value: 'modified' });
      handleRegistry.update('temporary', { value: 'modified' });
      
      // Rollback with custom filter
      const result = rollbackSystem.rollbackWithFilter(checkpointId, {
        handleFilter: (handleName, handleData) => handleName === 'temporary'
      });
      
      expect(result.success).toBe(true);
      expect(handleRegistry.getByName('important').data.value).toBe('modified'); // Not rolled back
      expect(handleRegistry.getByName('temporary').data.value).toBe('rollback');
    });
  });

  describe('Rollback Validation', () => {
    test('should validate rollback target', () => {
      const checkpointId = checkpointManager.createCheckpoint('validation-target-test');
      
      const validation = rollbackSystem.validateRollbackTarget(checkpointId);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(validation.canRollback).toBe(true);
    });

    test('should detect invalid rollback target', () => {
      const validation = rollbackSystem.validateRollbackTarget('nonexistent-checkpoint');
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.canRollback).toBe(false);
    });

    test('should validate current state for rollback', () => {
      plan.startStep('step1');
      
      const validation = rollbackSystem.validateCurrentState();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(validation.canRollback).toBe(true);
    });

    test('should detect state conflicts', () => {
      // Create conflicted state
      plan.state.completedSteps = ['step1'];
      plan.state.failedSteps = ['step1'];
      
      const validation = rollbackSystem.validateCurrentState();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.canRollback).toBe(false);
    });

    test('should validate rollback compatibility', () => {
      const checkpointId = checkpointManager.createCheckpoint('compatibility-test');
      
      // Modify state in compatible way
      plan.startStep('step1');
      
      const validation = rollbackSystem.validateRollbackCompatibility(checkpointId);
      
      expect(validation.compatible).toBe(true);
      expect(validation.conflicts).toEqual([]);
    });

    test('should detect rollback conflicts', () => {
      handleRegistry.create('conflictHandle', { value: 'original' });
      const checkpointId = checkpointManager.createCheckpoint('conflict-test');
      
      // Create conflicting state
      handleRegistry.deleteByName('conflictHandle');
      handleRegistry.create('conflictHandle', { value: 'different type', type: 'conflict' });
      
      const validation = rollbackSystem.validateRollbackCompatibility(checkpointId);
      
      expect(validation.compatible).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Rollback History and Management', () => {
    test('should preserve rollback history when enabled', () => {
      const checkpointId = checkpointManager.createCheckpoint('history-test');
      
      plan.startStep('step1');
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      
      const history = rollbackSystem.getRollbackHistory();
      expect(history).toHaveLength(1);
      expect(history[0].checkpointId).toBe(checkpointId);
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    test('should limit rollback history depth', () => {
      const limitedRollback = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem, {
        maxRollbackDepth: 2
      });

      // Create multiple rollbacks without causing step dependency issues
      for (let i = 0; i < 4; i++) {
        const checkpointId = checkpointManager.createCheckpoint(`depth-test-${i}`);
        // Just do rollbacks without trying to start new steps
        limitedRollback.restoreFromCheckpoint(checkpointId);
      }
      
      const history = limitedRollback.getRollbackHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });

    test('should provide rollback statistics', () => {
      const checkpointId = checkpointManager.createCheckpoint('stats-test');
      
      plan.startStep('step1');
      rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      const stats = rollbackSystem.getStatistics();
      
      expect(stats.totalRollbacks).toBe(1);
      expect(stats.successfulRollbacks).toBe(1);
      expect(stats.failedRollbacks).toBe(0);
      expect(stats.lastRollbackTime).toBeInstanceOf(Date);
    });

    test('should track failed rollback attempts', () => {
      // Try to rollback to nonexistent checkpoint
      const result = rollbackSystem.restoreFromCheckpoint('nonexistent');
      
      expect(result.success).toBe(false);
      
      const stats = rollbackSystem.getStatistics();
      expect(stats.totalRollbacks).toBe(1);
      expect(stats.successfulRollbacks).toBe(0);
      expect(stats.failedRollbacks).toBe(1);
    });

    test('should clean up old rollback history', () => {
      // Create multiple rollbacks
      for (let i = 0; i < 5; i++) {
        const checkpointId = checkpointManager.createCheckpoint(`cleanup-test-${i}`);
        rollbackSystem.restoreFromCheckpoint(checkpointId);
      }
      
      const cleaned = rollbackSystem.cleanupRollbackHistory(3);
      
      expect(cleaned).toBe(2); // Should clean 2 old entries
      const history = rollbackSystem.getRollbackHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Backup Management', () => {
    test('should create and manage rollback backups', () => {
      plan.startStep('step1');
      handleRegistry.create('backupTest', { value: 'backup' });
      
      const backupId = rollbackSystem.createRollbackBackup('manual-backup');
      
      expect(backupId).toBeDefined();
      expect(rollbackSystem.hasBackup(backupId)).toBe(true);
      
      const backup = rollbackSystem.getBackup(backupId);
      expect(backup).toBeDefined();
      expect(backup.name).toBe('manual-backup');
    });

    test('should restore from backup', () => {
      plan.startStep('step1');
      const backupId = rollbackSystem.createRollbackBackup('restore-backup-test');
      
      // Modify state
      plan.completeStep('step1', { result: 'completed' });
      handleRegistry.create('newHandle', { value: 'new' });
      
      // Restore from backup
      const result = rollbackSystem.restoreFromBackup(backupId);
      
      expect(result.success).toBe(true);
      expect(plan.state.currentStep).toBe('step1');
      expect(plan.state.completedSteps).toEqual([]);
      expect(handleRegistry.existsByName('newHandle')).toBe(false);
    });

    test('should clean up old backups', () => {
      // Create multiple backups
      const backupIds = [];
      for (let i = 0; i < 5; i++) {
        backupIds.push(rollbackSystem.createRollbackBackup(`cleanup-backup-${i}`));
      }
      
      const cleaned = rollbackSystem.cleanupBackups(3);
      
      expect(cleaned).toBe(2);
      expect(rollbackSystem.hasBackup(backupIds[0])).toBe(false);
      expect(rollbackSystem.hasBackup(backupIds[4])).toBe(true);
    });

    test('should delete specific backup', () => {
      const backupId = rollbackSystem.createRollbackBackup('delete-test');
      
      expect(rollbackSystem.hasBackup(backupId)).toBe(true);
      
      const deleted = rollbackSystem.deleteBackup(backupId);
      
      expect(deleted).toBe(true);
      expect(rollbackSystem.hasBackup(backupId)).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle rollback to corrupted checkpoint', () => {
      const checkpointId = checkpointManager.createCheckpoint('corruption-test');
      
      // Corrupt the checkpoint
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      checkpoint.planState = null;
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('corrupted');
    });

    test('should handle handle registry conflicts gracefully', () => {
      handleRegistry.create('conflictHandle', { value: 'original' });
      const checkpointId = checkpointManager.createCheckpoint('conflict-handle-test');
      
      // Create a different type of handle with same name
      handleRegistry.deleteByName('conflictHandle');
      handleRegistry.create('conflictHandle', 'string instead of object');
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should validate rollback parameters', () => {
      expect(() => {
        rollbackSystem.restoreFromCheckpoint(null);
      }).toThrow('Invalid checkpoint ID');
      
      expect(() => {
        rollbackSystem.restoreFromCheckpoint('');
      }).toThrow('Invalid checkpoint ID');
    });

    test('should handle memory constraints during rollback', () => {
      // Create large state
      for (let i = 0; i < 1000; i++) {
        handleRegistry.create(`largeHandle${i}`, { data: 'x'.repeat(1000) });
      }
      
      const checkpointId = checkpointManager.createCheckpoint('memory-test');
      
      // Clear some handles
      for (let i = 0; i < 500; i++) {
        handleRegistry.deleteByName(`largeHandle${i}`);
      }
      
      const result = rollbackSystem.restoreFromCheckpoint(checkpointId);
      
      expect(result.success).toBe(true);
      expect(handleRegistry.size()).toBe(1000);
    });

    test('should provide detailed error information', () => {
      const result = rollbackSystem.restoreFromCheckpoint('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBeDefined();
      expect(result.details).toBeDefined();
    });
  });

  describe('Advanced Rollback Features', () => {
    test('should support conditional rollback', () => {
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'success' });
      
      const checkpointId = checkpointManager.createCheckpoint('conditional-test');
      
      plan.startStep('step2');
      plan.failStep('step2', { message: 'Step failed' });
      
      // Conditional rollback - only if there are failed steps
      const result = rollbackSystem.conditionalRollback(checkpointId, {
        condition: (currentState) => currentState.failedSteps.length > 0
      });
      
      expect(result.success).toBe(true);
      expect(result.triggered).toBe(true);
      expect(plan.state.failedSteps).toEqual([]);
    });

    test('should support rollback with custom transformations', () => {
      handleRegistry.create('transformHandle', { value: 10 });
      
      const checkpointId = checkpointManager.createCheckpoint('transform-test');
      
      handleRegistry.update('transformHandle', { value: 20 });
      
      // Rollback with transformation
      const result = rollbackSystem.rollbackWithTransform(checkpointId, {
        handleTransform: (handleName, data) => {
          if (handleName === 'transformHandle') {
            return { ...data, transformed: true };
          }
          return data;
        }
      });
      
      expect(result.success).toBe(true);
      const handle = handleRegistry.getByName('transformHandle');
      expect(handle.data.value).toBe(10);
      expect(handle.data.transformed).toBe(true);
    });

    test('should support incremental rollback chains', () => {
      const base = stateCaptureSystem.createFullCapture('base');
      
      plan.startStep('step1');
      const inc1 = stateCaptureSystem.createIncremental('inc1', base);
      
      plan.completeStep('step1', { result: 'done' });
      const inc2 = stateCaptureSystem.createIncremental('inc2', base);
      
      // Rollback using incremental chain
      const result = rollbackSystem.rollbackIncrementalChain([base, inc1, inc2], 'inc1');
      
      expect(result.success).toBe(true);
      expect(plan.state.currentStep).toBe('step1');
      expect(plan.state.completedSteps).toEqual([]);
    });
  });
});