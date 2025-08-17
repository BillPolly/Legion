/**
 * Unit tests for FormalPlanResult class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FormalPlanResult } from '../../FormalPlanResult.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('FormalPlanResult', () => {
  let result;

  beforeEach(() => {
    result = new FormalPlanResult();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(result.success).toBe(false);
      expect(result.rootBehaviorTree).toBeNull();
      expect(result.syntheticTools).toEqual({});
      expect(result.levelPlans).toEqual({});
      expect(result.artifacts).toEqual({});
      expect(result.validation).toEqual({
        valid: false,
        errors: [],
        warnings: []
      });
      expect(result.metadata).toBeDefined();
      expect(result.metadata.createdAt).toBeDefined();
    });

    it('should accept initial configuration', () => {
      const customResult = new FormalPlanResult({
        success: true,
        rootBehaviorTree: { type: 'sequence', children: [] }
      });

      expect(customResult.success).toBe(true);
      expect(customResult.rootBehaviorTree).toBeDefined();
      expect(customResult.rootBehaviorTree.type).toBe('sequence');
    });
  });

  describe('behavior tree management', () => {
    it('should set root behavior tree', () => {
      const bt = {
        type: 'sequence',
        id: 'root',
        children: [
          { type: 'action', tool: 'test_tool' }
        ]
      };

      result.setRootBehaviorTree(bt);

      expect(result.rootBehaviorTree).toBe(bt);
      expect(result.success).toBe(true);
    });

    it('should mark as failed if no root BT', () => {
      result.setRootBehaviorTree(null);
      expect(result.success).toBe(false);
    });
  });

  describe('synthetic tool management', () => {
    it('should add synthetic tools', () => {
      const tool1 = new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: { type: 'action' }
      });

      const tool2 = new SyntheticTool({
        name: 'tool2',
        description: 'Tool 2',
        executionPlan: { type: 'sequence' }
      });

      result.addSyntheticTool(tool1);
      result.addSyntheticTool(tool2);

      expect(result.syntheticTools['tool1']).toBe(tool1);
      expect(result.syntheticTools['tool2']).toBe(tool2);
    });

    it('should add multiple synthetic tools at once', () => {
      const tools = [
        new SyntheticTool({
          name: 'tool1',
          description: 'Tool 1',
          executionPlan: { type: 'action' }
        }),
        new SyntheticTool({
          name: 'tool2',
          description: 'Tool 2',
          executionPlan: { type: 'action' }
        })
      ];

      result.addSyntheticTools(tools);

      expect(Object.keys(result.syntheticTools)).toHaveLength(2);
      expect(result.syntheticTools['tool1']).toBeDefined();
      expect(result.syntheticTools['tool2']).toBeDefined();
    });

    it('should get synthetic tool by name', () => {
      const tool = new SyntheticTool({
        name: 'test_tool',
        description: 'Test tool',
        executionPlan: { type: 'action' }
      });

      result.addSyntheticTool(tool);
      
      const retrieved = result.getSyntheticTool('test_tool');
      expect(retrieved).toBe(tool);
    });

    it('should return null for non-existent tool', () => {
      const retrieved = result.getSyntheticTool('non_existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('level plan management', () => {
    it('should add level plans', () => {
      const level1Plans = {
        task1: { type: 'sequence', children: [] },
        task2: { type: 'action', tool: 'test' }
      };

      const level2Plans = {
        task3: { type: 'parallel', children: [] }
      };

      result.addLevelPlan(1, level1Plans);
      result.addLevelPlan(2, level2Plans);

      expect(result.levelPlans[1]).toEqual(level1Plans);
      expect(result.levelPlans[2]).toEqual(level2Plans);
    });

    it('should get plans for specific level', () => {
      const plans = {
        task1: { type: 'sequence' },
        task2: { type: 'action' }
      };

      result.addLevelPlan(1, plans);
      
      const retrieved = result.getLevelPlans(1);
      expect(retrieved).toEqual(plans);
    });

    it('should return empty object for non-existent level', () => {
      const retrieved = result.getLevelPlans(99);
      expect(retrieved).toEqual({});
    });
  });

  describe('artifact management', () => {
    it('should set artifacts for levels', () => {
      const level1Artifacts = {
        connection: { type: 'object', value: {} },
        schema: { type: 'object', value: {} }
      };

      const level2Artifacts = {
        config: { type: 'object', value: {} }
      };

      result.setArtifacts(1, level1Artifacts);
      result.setArtifacts(2, level2Artifacts);

      expect(result.artifacts[1]).toEqual(level1Artifacts);
      expect(result.artifacts[2]).toEqual(level2Artifacts);
    });

    it('should aggregate all artifacts', () => {
      result.setArtifacts(1, { art1: 'value1' });
      result.setArtifacts(2, { art2: 'value2', art3: 'value3' });

      const all = result.getAllArtifacts();
      expect(all).toEqual({
        art1: 'value1',
        art2: 'value2',
        art3: 'value3'
      });
    });
  });

  describe('validation', () => {
    it('should set validation result', () => {
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Warning 1']
      };

      result.setValidation(validation);
      expect(result.validation).toEqual(validation);
    });

    it('should add validation errors', () => {
      result.addValidationError('Error 1');
      result.addValidationError('Error 2');

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toContain('Error 1');
      expect(result.validation.errors).toContain('Error 2');
    });

    it('should add validation warnings', () => {
      result.addValidationWarning('Warning 1');
      result.addValidationWarning('Warning 2');

      expect(result.validation.warnings).toContain('Warning 1');
      expect(result.validation.warnings).toContain('Warning 2');
      // Warnings don't affect validity
      expect(result.validation.valid).toBe(false); // Still false by default
    });

    it('should check if result is valid', () => {
      expect(result.isValid()).toBe(false);

      result.setRootBehaviorTree({ type: 'sequence' });
      result.setValidation({ valid: true, errors: [], warnings: [] });

      expect(result.isValid()).toBe(true);
    });
  });

  describe('metadata', () => {
    it('should track processing time', () => {
      const before = Date.now();
      const customResult = new FormalPlanResult();
      const after = Date.now();

      expect(customResult.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(customResult.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('should add custom metadata', () => {
      result.addMetadata('processingTime', 1234);
      result.addMetadata('totalNodes', 42);

      expect(result.metadata.processingTime).toBe(1234);
      expect(result.metadata.totalNodes).toBe(42);
    });
  });

  describe('statistics', () => {
    it('should calculate statistics', () => {
      // Add synthetic tools
      result.addSyntheticTools([
        new SyntheticTool({ name: 't1', description: 'd1', executionPlan: {} }),
        new SyntheticTool({ name: 't2', description: 'd2', executionPlan: {} })
      ]);

      // Add level plans
      result.addLevelPlan(1, { task1: {}, task2: {} });
      result.addLevelPlan(2, { task3: {} });

      // Add validation
      result.addValidationError('Error 1');
      result.addValidationWarning('Warning 1');

      const stats = result.getStatistics();

      expect(stats.syntheticToolCount).toBe(2);
      expect(stats.levelCount).toBe(2);
      expect(stats.totalPlans).toBe(3);
      expect(stats.validationErrors).toBe(1);
      expect(stats.validationWarnings).toBe(1);
      expect(stats.isValid).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to JSON', () => {
      result.setRootBehaviorTree({ type: 'sequence', id: 'root' });
      result.addSyntheticTool(new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: { type: 'action' }
      }));
      result.addLevelPlan(1, { task1: { type: 'action' } });
      result.setValidation({ valid: true, errors: [], warnings: [] });

      const json = result.toJSON();

      expect(json.success).toBe(true);
      expect(json.rootBehaviorTree).toBeDefined();
      expect(json.syntheticTools).toBeDefined();
      expect(json.levelPlans).toBeDefined();
      expect(json.validation).toBeDefined();
    });

    it('should create summary', () => {
      result.setRootBehaviorTree({ type: 'sequence' });
      result.addSyntheticTools([
        new SyntheticTool({ name: 't1', description: 'd1', executionPlan: {} }),
        new SyntheticTool({ name: 't2', description: 'd2', executionPlan: {} })
      ]);
      result.setValidation({ valid: true, errors: [], warnings: ['Warning'] });

      const summary = result.getSummary();

      expect(summary).toContain('SUCCESS');
      expect(summary).toContain('2 synthetic tools');
      expect(summary).toContain('0 errors');
      expect(summary).toContain('1 warning');
    });
  });
});