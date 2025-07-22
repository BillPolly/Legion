/**
 * Tests for State Capture System
 * 
 * Tests handle state serialization, plan state capture, validation result storage,
 * and incremental state capture functionality
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { StateCaptureSystem } from '../../../src/checkpoint/StateCaptureSystem.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';

describe('StateCaptureSystem', () => {
  let handleRegistry;
  let toolRegistry;
  let plan;
  let stateCapture;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry();
    
    const mockPlanData = {
      id: 'state-capture-test-plan',
      title: 'State Capture Test Plan',
      description: 'A plan for testing state capture',
      steps: [
        {
          id: 'step1',
          title: 'Generate data',
          action: 'generate_data',
          parameters: { type: 'test' },
          expectedOutputs: ['generatedData']
        },
        {
          id: 'step2',
          title: 'Transform data',
          action: 'transform_data',
          parameters: { input: '@generatedData', transform: 'upper' },
          expectedOutputs: ['transformedData'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Store data',
          action: 'store_data',
          parameters: { data: '@transformedData', location: 'output' },
          dependsOn: ['step2']
        }
      ]
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
    stateCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry);
  });

  describe('StateCaptureSystem Creation and Configuration', () => {
    test('should create state capture system with required dependencies', () => {
      expect(stateCapture.plan).toBe(plan);
      expect(stateCapture.handleRegistry).toBe(handleRegistry);
      expect(stateCapture.toolRegistry).toBe(toolRegistry);
    });

    test('should initialize with default options', () => {
      expect(stateCapture.options.includeHandleData).toBe(true);
      expect(stateCapture.options.includeMetadata).toBe(true);
      expect(stateCapture.options.compressData).toBe(false);
      expect(stateCapture.options.validateOnCapture).toBe(true);
      expect(stateCapture.options.maxDepth).toBe(10);
    });

    test('should accept custom options', () => {
      const customCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        includeHandleData: false,
        includeMetadata: false,
        compressData: true,
        validateOnCapture: false,
        maxDepth: 5
      });

      expect(customCapture.options.includeHandleData).toBe(false);
      expect(customCapture.options.includeMetadata).toBe(false);
      expect(customCapture.options.compressData).toBe(true);
      expect(customCapture.options.validateOnCapture).toBe(false);
      expect(customCapture.options.maxDepth).toBe(5);
    });

    test('should provide capture statistics', () => {
      const stats = stateCapture.getStatistics();
      
      expect(stats.totalCaptures).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.lastCaptureTime).toBeNull();
      expect(stats.captureTypes).toEqual({});
    });
  });

  describe('Handle State Serialization', () => {
    test('should serialize simple handle data', () => {
      handleRegistry.create('simpleHandle', { value: 'test', number: 42 });
      
      const serialized = stateCapture.serializeHandleState();
      
      expect(serialized).toHaveProperty('simpleHandle');
      expect(serialized.simpleHandle.data.value).toBe('test');
      expect(serialized.simpleHandle.data.number).toBe(42);
      expect(serialized.simpleHandle.metadata).toBeDefined();
    });

    test('should serialize complex nested handle data', () => {
      const complexData = {
        user: {
          id: 123,
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        settings: ['opt1', 'opt2', 'opt3'],
        timestamp: new Date()
      };

      handleRegistry.create('complexHandle', complexData);
      
      const serialized = stateCapture.serializeHandleState();
      
      expect(serialized.complexHandle.data.user.profile.name).toBe('Test User');
      expect(serialized.complexHandle.data.settings).toEqual(['opt1', 'opt2', 'opt3']);
      expect(serialized.complexHandle.data.timestamp).toBeInstanceOf(Date);
    });

    test('should handle circular references in handle data', () => {
      const circularData = { name: 'root' };
      circularData.self = circularData;

      handleRegistry.create('circularHandle', circularData);
      
      const serialized = stateCapture.serializeHandleState();
      
      expect(serialized.circularHandle.data.name).toBe('root');
      expect(serialized.circularHandle.data.self).toBe('[Circular Reference]');
    });

    test('should preserve handle metadata during serialization', () => {
      const metadata = { 
        source: 'test',
        version: '1.0',
        tags: ['important', 'test'] 
      };
      
      handleRegistry.create('metadataHandle', { value: 'test' }, metadata);
      
      const serialized = stateCapture.serializeHandleState();
      
      expect(serialized.metadataHandle.metadata.source).toBe('test');
      expect(serialized.metadataHandle.metadata.version).toBe('1.0');
      expect(serialized.metadataHandle.metadata.tags).toEqual(['important', 'test']);
    });

    test('should exclude handle data when disabled', () => {
      const noDataCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        includeHandleData: false
      });

      handleRegistry.create('excludeHandle', { value: 'should not be included' });
      
      const serialized = noDataCapture.serializeHandleState();
      
      expect(serialized.excludeHandle.data).toBeUndefined();
      expect(serialized.excludeHandle.metadata).toBeDefined();
    });

    test('should respect maximum serialization depth', () => {
      const deepData = { level: 1 };
      let current = deepData;
      
      // Create deeply nested structure
      for (let i = 2; i <= 15; i++) {
        current.next = { level: i };
        current = current.next;
      }

      const shallowCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        maxDepth: 5
      });

      handleRegistry.create('deepHandle', deepData);
      
      const serialized = shallowCapture.serializeHandleState();
      const data = serialized.deepHandle.data;
      
      // Should preserve up to maxDepth levels
      expect(data.next.next.next.next).toBeDefined();
      expect(data.next.next.next.next.next).toBe('[Max Depth Exceeded]');
    });
  });

  describe('Plan State Capture', () => {
    test('should capture basic plan execution state', () => {
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 complete' });
      
      const planState = stateCapture.capturePlanState();
      
      expect(planState.id).toBe(plan.id);
      expect(planState.title).toBe(plan.title);
      expect(planState.status).toBe('created');
      expect(planState.completedSteps).toEqual(['step1']);
      expect(planState.currentStep).toBeNull();
      expect(planState.stepStates.step1.status).toBe('completed');
    });

    test('should capture step execution details', () => {
      const stepOutput = { data: 'processed', metrics: { duration: 150 } };
      
      plan.startStep('step1');
      plan.completeStep('step1', stepOutput);
      plan.startStep('step2');
      plan.failStep('step2', { message: 'Processing failed', code: 'PROC_ERROR' });
      
      const planState = stateCapture.capturePlanState();
      
      expect(planState.stepStates.step1.output).toEqual(stepOutput);
      expect(planState.stepStates.step1.completedAt).toBeInstanceOf(Date);
      expect(planState.stepStates.step2.status).toBe('failed');
      expect(planState.stepStates.step2.error.message).toBe('Processing failed');
    });

    test('should capture handle relationships in plan state', () => {
      plan.createStepHandle('step1', 'output1', { value: 'data1' });
      plan.createStepHandle('step1', 'output2', { value: 'data2' });
      plan.createStepHandle('step2', 'result', { combined: '@output1 + @output2' });
      
      const planState = stateCapture.capturePlanState();
      
      expect(planState.handles).toHaveProperty('output1');
      expect(planState.handles).toHaveProperty('output2');
      expect(planState.handles).toHaveProperty('result');
      expect(planState.handles.output1.stepId).toBe('step1');
      expect(planState.handles.result.stepId).toBe('step2');
    });

    test('should capture plan validation state', () => {
      // Create invalid state
      plan.state.completedSteps = ['step1', 'step2'];
      plan.state.failedSteps = ['step2']; // Same step both completed and failed
      
      const planState = stateCapture.capturePlanState();
      const validation = planState.validation;
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should exclude metadata when disabled', () => {
      const noMetadataCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        includeMetadata: false
      });

      const planState = noMetadataCapture.capturePlanState();
      
      expect(planState.metadata).toBeUndefined();
      expect(planState.captureMetadata).toBeUndefined();
    });

    test('should include capture metadata when enabled', () => {
      const planState = stateCapture.capturePlanState();
      
      expect(planState.metadata).toBeDefined();
      expect(planState.captureMetadata).toBeDefined();
      expect(planState.captureMetadata.capturedAt).toBeInstanceOf(Date);
      expect(planState.captureMetadata.captureVersion).toBeDefined();
    });
  });

  describe('Validation Result Storage', () => {
    test('should store validation results', () => {
      const validation = {
        valid: false,
        errors: ['Step dependency not found', 'Circular dependency detected'],
        warnings: ['Step may be slow'],
        timestamp: new Date()
      };

      stateCapture.storeValidationResult('plan-validation', validation);
      
      const stored = stateCapture.getValidationResult('plan-validation');
      expect(stored.valid).toBe(false);
      expect(stored.errors).toEqual(validation.errors);
      expect(stored.warnings).toEqual(validation.warnings);
    });

    test('should store multiple validation types', () => {
      stateCapture.storeValidationResult('plan-structure', { valid: true, errors: [] });
      stateCapture.storeValidationResult('handle-consistency', { valid: false, errors: ['Missing handle'] });
      stateCapture.storeValidationResult('tool-availability', { valid: true, errors: [] });
      
      const results = stateCapture.getAllValidationResults();
      
      expect(results).toHaveProperty('plan-structure');
      expect(results).toHaveProperty('handle-consistency');
      expect(results).toHaveProperty('tool-availability');
      expect(results['handle-consistency'].valid).toBe(false);
    });

    test('should provide validation history', () => {
      const validation1 = { valid: true, errors: [], timestamp: new Date() };
      const validation2 = { valid: false, errors: ['Error occurred'], timestamp: new Date() };

      stateCapture.storeValidationResult('test-validation', validation1);
      stateCapture.storeValidationResult('test-validation', validation2);
      
      const history = stateCapture.getValidationHistory('test-validation');
      
      expect(history).toHaveLength(2);
      expect(history[0].valid).toBe(true);
      expect(history[1].valid).toBe(false);
    });

    test('should clean up old validation results', () => {
      jest.useFakeTimers();
      
      stateCapture.storeValidationResult('old-validation', { valid: true, errors: [], timestamp: new Date() });
      
      jest.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours
      
      stateCapture.storeValidationResult('new-validation', { valid: true, errors: [], timestamp: new Date() });
      
      // Clean up results older than 12 hours
      const cleaned = stateCapture.cleanupValidationResults(12 * 60 * 60 * 1000);
      
      expect(cleaned).toBe(1);
      expect(stateCapture.getValidationResult('old-validation')).toBeNull();
      expect(stateCapture.getValidationResult('new-validation')).toBeDefined();
      
      jest.useRealTimers();
    });
  });

  describe('Incremental State Capture', () => {
    test('should perform incremental capture', () => {
      // Initial state
      plan.startStep('step1');
      const snapshot1 = stateCapture.createFullCapture('initial');
      
      // Modify state
      plan.completeStep('step1', { result: 'done' });
      plan.startStep('step2');
      handleRegistry.create('newHandle', { data: 'new' });
      
      const snapshot2 = stateCapture.createIncremental('after-step1', snapshot1);
      
      expect(snapshot2.type).toBe('incremental');
      expect(snapshot2.basedOn).toBe(snapshot1.id);
      expect(snapshot2.changes.planState).toBeDefined();
      expect(snapshot2.changes.handles).toBeDefined();
    });

    test('should detect plan state changes', () => {
      const snapshot1 = stateCapture.createFullCapture('before');
      
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'test' });
      
      const snapshot2 = stateCapture.createIncremental('after', snapshot1);
      const changes = snapshot2.changes.planState;
      
      expect(changes.completedSteps.added).toEqual(['step1']);
      expect(changes.stepStates.step1).toBeDefined();
      expect(changes.stepStates.step1.type).toBe('modified');
    });

    test('should detect handle changes', () => {
      handleRegistry.create('handle1', { value: 'original' });
      const snapshot1 = stateCapture.createFullCapture('before');
      
      // Modify existing handle
      handleRegistry.update('handle1', { value: 'modified' });
      // Add new handle
      handleRegistry.create('handle2', { value: 'new' });
      
      const snapshot2 = stateCapture.createIncremental('after', snapshot1);
      const changes = snapshot2.changes.handles;
      
      expect(changes.added).toHaveProperty('handle2');
      expect(changes.modified).toHaveProperty('handle1');
    });

    test('should apply incremental changes', () => {
      const original = stateCapture.createFullCapture('original');
      
      // Make changes
      plan.startStep('step1');
      handleRegistry.create('testHandle', { value: 'test' });
      
      const incremental = stateCapture.createIncremental('changes', original);
      const reconstructed = stateCapture.applyIncremental(original, incremental);
      
      expect(reconstructed.planState.currentStep).toBe('step1');
      expect(reconstructed.handles).toHaveProperty('testHandle');
    });

    test('should optimize incremental chains', () => {
      const base = stateCapture.createFullCapture('base');
      
      // Create separate incremental snapshots based on same base
      plan.startStep('step1');
      const inc1 = stateCapture.createIncremental('inc1', base);
      
      plan.completeStep('step1', { result: 'done' });
      const inc2 = stateCapture.createIncremental('inc2', base);
      
      plan.startStep('step2');
      const inc3 = stateCapture.createIncremental('inc3', base);
      
      // Optimize the chain
      const optimized = stateCapture.optimizeIncrementalChain([base, inc1, inc2, inc3]);
      
      expect(optimized.length).toBeLessThanOrEqual(4);
      expect(optimized[optimized.length - 1].changes).toBeDefined();
    });
  });

  describe('Full State Capture', () => {
    test('should create complete state capture', () => {
      // Set up complex state
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'step1 done' });
      plan.createStepHandle('step1', 'output', { data: 'test data' });
      handleRegistry.create('externalHandle', { value: 'external' });
      
      const capture = stateCapture.createFullCapture('complete-state');
      
      expect(capture.type).toBe('full');
      expect(capture.planState).toBeDefined();
      expect(capture.handles).toBeDefined();
      expect(capture.metadata).toBeDefined();
      expect(capture.metadata.captureSize).toBeGreaterThan(0);
    });

    test('should validate captured state', () => {
      const capture = stateCapture.createFullCapture('validation-test');
      const validation = stateCapture.validateCapture(capture);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.integrity).toBe('valid');
    });

    test('should detect corrupted state', () => {
      const capture = stateCapture.createFullCapture('corruption-test');
      
      // Corrupt the capture
      capture.planState = null;
      
      const validation = stateCapture.validateCapture(capture);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.integrity).toBe('corrupted');
    });

    test('should compress captured state when enabled', () => {
      const compressCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        compressData: true
      });

      // Create large data
      const largeData = { data: 'x'.repeat(10000) };
      handleRegistry.create('largeHandle', largeData);
      
      const compressed = compressCapture.createFullCapture('compressed');
      const uncompressed = stateCapture.createFullCapture('uncompressed');
      
      expect(compressed.metadata.compressed).toBe(true);
      expect(compressed.metadata.originalSize).toBeGreaterThan(compressed.metadata.compressedSize);
    });
  });

  describe('State Comparison and Diff', () => {
    test('should compare two state captures', () => {
      const state1 = stateCapture.createFullCapture('state1');
      
      // Make changes
      plan.startStep('step1');
      handleRegistry.create('newHandle', { value: 'new' });
      
      const state2 = stateCapture.createFullCapture('state2');
      const diff = stateCapture.compareCaptures(state1, state2);
      
      expect(diff.planState.changed).toBe(true);
      expect(diff.handles.added).toContain('newHandle');
      expect(diff.planState.changes.currentStep).toEqual({
        from: null,
        to: 'step1'
      });
    });

    test('should detect no changes between identical captures', () => {
      const state1 = stateCapture.createFullCapture('identical1');
      const state2 = stateCapture.createFullCapture('identical2');
      
      const diff = stateCapture.compareCaptures(state1, state2);
      
      expect(diff.planState.changed).toBe(false);
      expect(diff.handles.added).toEqual([]);
      expect(diff.handles.removed).toEqual([]);
      expect(diff.handles.modified).toEqual([]);
    });

    test('should provide detailed change information', () => {
      const state1 = stateCapture.createFullCapture('before-change');
      
      // Make specific changes
      plan.state.status = 'running';
      plan.state.completedSteps = ['step1'];
      handleRegistry.create('changedHandle', { value: 'original' });
      
      const state2 = stateCapture.createFullCapture('after-change');
      handleRegistry.update('changedHandle', { value: 'modified' });
      
      const state3 = stateCapture.createFullCapture('final-change');
      const diff = stateCapture.compareCaptures(state1, state3);
      
      expect(diff.summary.totalChanges).toBeGreaterThan(0);
      expect(diff.summary.planStateChanges).toBeGreaterThan(0);
      expect(diff.summary.handleChanges).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty state gracefully', () => {
      const emptyCapture = stateCapture.createFullCapture('empty');
      
      expect(emptyCapture.planState).toBeDefined();
      expect(emptyCapture.handles).toEqual({});
      expect(emptyCapture.metadata.captureSize).toBeGreaterThan(0);
    });

    test('should handle serialization errors', () => {
      // Create circular reference data (which should be handled as circular, not error)
      const circularData = {};
      circularData.self = circularData;
      
      handleRegistry.create('circular', circularData);
      
      const capture = stateCapture.createFullCapture('error-test');
      
      // Should handle circular reference gracefully
      expect(capture.handles.circular.data.self).toBe('[Circular Reference]');
    });

    test('should validate capture parameters', () => {
      expect(() => {
        stateCapture.createFullCapture('');
      }).toThrow('Invalid capture name');
      
      expect(() => {
        stateCapture.createIncremental('test', null);
      }).toThrow('Invalid base capture');
    });

    test('should handle memory constraints', () => {
      // Create very large state
      for (let i = 0; i < 1000; i++) {
        handleRegistry.create(`handle${i}`, { data: 'x'.repeat(1000) });
      }
      
      const largeCapture = stateCapture.createFullCapture('large-state');
      
      expect(largeCapture.metadata.captureSize).toBeGreaterThan(1000000);
      expect(largeCapture.metadata.handleCount).toBe(1000);
    });
  });

  describe('Performance and Optimization', () => {
    test('should provide performance metrics', () => {
      const startTime = Date.now();
      
      // Create some test data
      for (let i = 0; i < 100; i++) {
        handleRegistry.create(`perf${i}`, { value: i });
      }
      
      const capture = stateCapture.createFullCapture('performance-test');
      const metrics = stateCapture.getPerformanceMetrics();
      
      expect(metrics.lastCaptureTime).toBeGreaterThan(0);
      expect(metrics.averageCaptureTime).toBeGreaterThan(0);
      expect(metrics.totalCaptureTime).toBeGreaterThan(0);
      expect(capture.metadata.captureTime).toBeGreaterThan(0);
    });

    test('should optimize capture size', () => {
      const regularCapture = stateCapture.createFullCapture('regular');
      
      const optimizedCapture = new StateCaptureSystem(plan, handleRegistry, toolRegistry, {
        compressData: true,
        includeMetadata: false
      });
      
      const optimized = optimizedCapture.createFullCapture('optimized');
      
      expect(optimized.metadata.captureSize).toBeLessThanOrEqual(regularCapture.metadata.captureSize);
    });
  });
});