/**
 * @jest-environment node
 */

import { describe, test, expect } from '@jest/globals';
import { PlanAction } from '../../src/models/PlanAction.js';

describe('PlanAction', () => {
  const sampleActionDef = {
    type: 'create-file',
    inputs: ['file-content'],
    outputs: ['file-created']
  };

  describe('constructor', () => {
    test('should create a PlanAction with action definition', () => {
      const action = new PlanAction(sampleActionDef);
      
      expect(action.type).toBe('create-file');
      expect(action.definedInputs).toEqual(['file-content']);
      expect(action.definedOutputs).toEqual(['file-created']);
      expect(action.status).toBe('pending');
      expect(action.id).toBeDefined();
    });

    test('should create a PlanAction with parameters', () => {
      const parameters = {
        id: 'test-action',
        description: 'Test action',
        filePath: '/test/file.txt'
      };
      
      const action = new PlanAction(sampleActionDef, parameters);
      
      expect(action.id).toBe('test-action');
      expect(action.description).toBe('Test action');
      expect(action.parameters.filePath).toBe('/test/file.txt');
    });

    test('should throw error if action definition is missing', () => {
      expect(() => new PlanAction()).toThrow('Action definition with type is required');
    });

    test('should throw error if action type is missing', () => {
      expect(() => new PlanAction({})).toThrow('Action definition with type is required');
    });
  });

  describe('getInputs', () => {
    test('should return defined inputs', () => {
      const action = new PlanAction(sampleActionDef);
      expect(action.getInputs()).toEqual(['file-content']);
    });

    test('should return empty array if no inputs defined', () => {
      const actionDef = { type: 'simple-action' };
      const action = new PlanAction(actionDef);
      expect(action.getInputs()).toEqual([]);
    });
  });

  describe('getOutputs', () => {
    test('should return defined outputs', () => {
      const action = new PlanAction(sampleActionDef);
      expect(action.getOutputs()).toEqual(['file-created']);
    });

    test('should return empty array if no outputs defined', () => {
      const actionDef = { type: 'simple-action' };
      const action = new PlanAction(actionDef);
      expect(action.getOutputs()).toEqual([]);
    });
  });

  describe('validateInputs', () => {
    test('should validate inputs are satisfied', () => {
      const action = new PlanAction(sampleActionDef);
      const availableOutputs = ['file-content', 'other-output'];
      
      const validation = action.validateInputs(availableOutputs);
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingInputs).toEqual([]);
      expect(validation.satisfiedInputs).toEqual(['file-content']);
    });

    test('should detect missing inputs', () => {
      const action = new PlanAction(sampleActionDef);
      const availableOutputs = ['other-output'];
      
      const validation = action.validateInputs(availableOutputs);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingInputs).toEqual(['file-content']);
      expect(validation.satisfiedInputs).toEqual([]);
    });

    test('should handle empty available outputs', () => {
      const action = new PlanAction(sampleActionDef);
      
      const validation = action.validateInputs([]);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingInputs).toEqual(['file-content']);
    });
  });

  describe('updateStatus', () => {
    test('should update status to valid values', () => {
      const action = new PlanAction(sampleActionDef);
      
      action.updateStatus('in-progress');
      expect(action.status).toBe('in-progress');
      
      action.updateStatus('completed');
      expect(action.status).toBe('completed');
    });

    test('should throw error for invalid status', () => {
      const action = new PlanAction(sampleActionDef);
      
      expect(() => action.updateStatus('invalid-status')).toThrow('Invalid status: invalid-status');
    });
  });

  describe('recordResult', () => {
    test('should record successful result', () => {
      const action = new PlanAction(sampleActionDef);
      const result = { success: true, data: 'test-data' };
      
      action.recordResult(result);
      
      expect(action.result.success).toBe(true);
      expect(action.result.data).toBe('test-data');
      expect(action.result.timestamp).toBeDefined();
      expect(action.status).toBe('completed');
    });

    test('should record failed result', () => {
      const action = new PlanAction(sampleActionDef);
      const result = { success: false, error: 'test-error' };
      
      action.recordResult(result);
      
      expect(action.result.success).toBe(false);
      expect(action.result.error).toBe('test-error');
      expect(action.status).toBe('failed');
    });
  });

  describe('toJSON', () => {
    test('should export to JSON', () => {
      const action = new PlanAction(sampleActionDef, { description: 'Test action' });
      
      const json = action.toJSON();
      
      expect(json.type).toBe('create-file');
      expect(json.inputs).toEqual(['file-content']);
      expect(json.outputs).toEqual(['file-created']);
      expect(json.description).toBe('Test action');
      expect(json.status).toBe('pending');
    });
  });

  describe('fromJSON', () => {
    test('should create from JSON with allowable actions', () => {
      const json = {
        id: 'test-action',
        type: 'create-file',
        parameters: { filePath: '/test/file.txt' },
        status: 'completed'
      };
      
      const allowableActions = [sampleActionDef];
      const action = PlanAction.fromJSON(json, allowableActions);
      
      expect(action.id).toBe('test-action');
      expect(action.type).toBe('create-file');
      expect(action.parameters.filePath).toBe('/test/file.txt');
      expect(action.status).toBe('completed');
    });

    test('should throw error for unknown action type', () => {
      const json = { type: 'unknown-action' };
      const allowableActions = [sampleActionDef];
      
      expect(() => PlanAction.fromJSON(json, allowableActions)).toThrow('Unknown action type: unknown-action');
    });
  });

  describe('create', () => {
    test('should create action from definition', () => {
      const action = PlanAction.create(sampleActionDef, { description: 'Test' });
      
      expect(action.type).toBe('create-file');
      expect(action.description).toBe('Test');
    });
  });
});