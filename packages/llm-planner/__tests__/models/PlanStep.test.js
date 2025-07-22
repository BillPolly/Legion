/**
 * @jest-environment node
 */

import { describe, test, expect } from '@jest/globals';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';

describe('PlanStep', () => {
  const allowableActions = [
    { type: 'create-file', inputs: ['file-content'], outputs: ['file-created'] },
    { type: 'run-command', inputs: ['command'], outputs: ['command-result'] }
  ];

  describe('constructor', () => {
    test('should create a PlanStep with basic properties', () => {
      const step = new PlanStep({
        name: 'Test Step',
        description: 'Test description',
        type: 'implementation'
      }, allowableActions);
      
      expect(step.name).toBe('Test Step');
      expect(step.description).toBe('Test description');
      expect(step.type).toBe('implementation');
      expect(step.status).toBe('pending');
      expect(step.id).toBeDefined();
      expect(step.steps).toEqual([]);
      expect(step.actions).toEqual([]);
    });

    test('should initialize with sub-steps', () => {
      const stepData = {
        name: 'Parent Step',
        steps: [
          { name: 'Child Step 1', type: 'setup' },
          { name: 'Child Step 2', type: 'implementation' }
        ]
      };
      
      const step = new PlanStep(stepData, allowableActions);
      
      expect(step.steps.length).toBe(2);
      expect(step.steps[0].name).toBe('Child Step 1');
      expect(step.steps[1].name).toBe('Child Step 2');
    });

    test('should initialize with actions', () => {
      const stepData = {
        name: 'Action Step',
        actions: [
          { type: 'create-file', parameters: { filePath: '/test.txt' } },
          { type: 'run-command', parameters: { command: 'test' } }
        ]
      };
      
      const step = new PlanStep(stepData, allowableActions);
      
      expect(step.actions.length).toBe(2);
      expect(step.actions[0].type).toBe('create-file');
      expect(step.actions[1].type).toBe('run-command');
    });
  });

  describe('addStep', () => {
    test('should add a sub-step', () => {
      const parentStep = new PlanStep({ name: 'Parent' }, allowableActions);
      const childStep = new PlanStep({ name: 'Child' }, allowableActions);
      
      parentStep.addStep(childStep);
      
      expect(parentStep.steps.length).toBe(1);
      expect(parentStep.steps[0]).toBe(childStep);
    });

    test('should throw error if not a PlanStep instance', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      expect(() => step.addStep({})).toThrow('Must be a PlanStep instance');
    });
  });

  describe('addAction', () => {
    test('should add action from data', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      step.addAction({ type: 'create-file', parameters: { filePath: '/test.txt' } });
      
      expect(step.actions.length).toBe(1);
      expect(step.actions[0].type).toBe('create-file');
    });

    test('should add PlanAction instance', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      const action = new PlanAction(allowableActions[0]);
      
      step.addAction(action);
      
      expect(step.actions.length).toBe(1);
      expect(step.actions[0]).toBe(action);
    });

    test('should throw error for unknown action type', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      expect(() => step.addAction({ type: 'unknown-action' })).toThrow('Unknown action type: unknown-action');
    });
  });

  describe('isLeaf', () => {
    test('should return true for leaf step (has actions, no sub-steps)', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addAction({ type: 'create-file' });
      
      expect(step.isLeaf()).toBe(true);
    });

    test('should return false for branch step (has sub-steps)', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addStep(new PlanStep({ name: 'Child' }, allowableActions));
      
      expect(step.isLeaf()).toBe(false);
    });

    test('should return false for empty step', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      expect(step.isLeaf()).toBe(false);
    });
  });

  describe('isBranch', () => {
    test('should return true for branch step (has sub-steps)', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addStep(new PlanStep({ name: 'Child' }, allowableActions));
      
      expect(step.isBranch()).toBe(true);
    });

    test('should return false for leaf step', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addAction({ type: 'create-file' });
      
      expect(step.isBranch()).toBe(false);
    });
  });

  describe('getAllActions', () => {
    test('should return all actions from step and sub-steps', () => {
      const parentStep = new PlanStep({ name: 'Parent' }, allowableActions);
      const childStep = new PlanStep({ name: 'Child' }, allowableActions);
      
      parentStep.addAction({ type: 'create-file' });
      childStep.addAction({ type: 'run-command' });
      parentStep.addStep(childStep);
      
      const allActions = parentStep.getAllActions();
      
      expect(allActions.length).toBe(2);
      expect(allActions[0].type).toBe('create-file');
      expect(allActions[1].type).toBe('run-command');
    });

    test('should return empty array for step with no actions', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      expect(step.getAllActions()).toEqual([]);
    });
  });

  describe('getInputs', () => {
    test('should return inputs from step, actions, and sub-steps', () => {
      const parentStep = new PlanStep({ 
        name: 'Parent',
        inputs: ['step-input']
      }, allowableActions);
      
      const childStep = new PlanStep({ name: 'Child' }, allowableActions);
      
      parentStep.addAction({ type: 'create-file' }); // inputs: ['file-content']
      childStep.addAction({ type: 'run-command' }); // inputs: ['command']
      parentStep.addStep(childStep);
      
      const inputs = parentStep.getInputs();
      
      expect(inputs).toContain('step-input');
      expect(inputs).toContain('file-content');
      expect(inputs).toContain('command');
    });
  });

  describe('getOutputs', () => {
    test('should return outputs from step, actions, and sub-steps', () => {
      const parentStep = new PlanStep({ 
        name: 'Parent',
        outputs: ['step-output']
      }, allowableActions);
      
      const childStep = new PlanStep({ name: 'Child' }, allowableActions);
      
      parentStep.addAction({ type: 'create-file' }); // outputs: ['file-created']
      childStep.addAction({ type: 'run-command' }); // outputs: ['command-result']
      parentStep.addStep(childStep);
      
      const outputs = parentStep.getOutputs();
      
      expect(outputs).toContain('step-output');
      expect(outputs).toContain('file-created');
      expect(outputs).toContain('command-result');
    });
  });

  describe('validateInputs', () => {
    test('should validate inputs are satisfied', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addAction({ type: 'create-file' }); // needs 'file-content'
      
      const validation = step.validateInputs(['file-content']);
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingInputs).toEqual([]);
      expect(validation.satisfiedInputs).toEqual(['file-content']);
    });

    test('should detect missing inputs', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addAction({ type: 'create-file' }); // needs 'file-content'
      
      const validation = step.validateInputs(['other-input']);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingInputs).toEqual(['file-content']);
    });
  });

  describe('getDepth', () => {
    test('should return 0 for leaf step', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      step.addAction({ type: 'create-file' });
      
      expect(step.getDepth()).toBe(0);
    });

    test('should return correct depth for nested steps', () => {
      const parentStep = new PlanStep({ name: 'Parent' }, allowableActions);
      const childStep = new PlanStep({ name: 'Child' }, allowableActions);
      const grandChildStep = new PlanStep({ name: 'GrandChild' }, allowableActions);
      
      childStep.addStep(grandChildStep);
      parentStep.addStep(childStep);
      
      expect(parentStep.getDepth()).toBe(2);
    });
  });

  describe('findStep', () => {
    test('should find step by ID', () => {
      const parentStep = new PlanStep({ name: 'Parent' }, allowableActions);
      const childStep = new PlanStep({ name: 'Child', id: 'child-id' }, allowableActions);
      
      parentStep.addStep(childStep);
      
      const found = parentStep.findStep('child-id');
      expect(found).toBe(childStep);
    });

    test('should return null if step not found', () => {
      const step = new PlanStep({ name: 'Test' }, allowableActions);
      
      expect(step.findStep('nonexistent')).toBeNull();
    });
  });

  describe('getFlatSteps', () => {
    test('should return flat list of all steps', () => {
      const parentStep = new PlanStep({ name: 'Parent' }, allowableActions);
      const childStep1 = new PlanStep({ name: 'Child1' }, allowableActions);
      const childStep2 = new PlanStep({ name: 'Child2' }, allowableActions);
      
      parentStep.addStep(childStep1);
      parentStep.addStep(childStep2);
      
      const flatSteps = parentStep.getFlatSteps();
      
      expect(flatSteps.length).toBe(3);
      expect(flatSteps[0]).toBe(parentStep);
      expect(flatSteps[1]).toBe(childStep1);
      expect(flatSteps[2]).toBe(childStep2);
    });
  });

  describe('toJSON', () => {
    test('should export to JSON', () => {
      const step = new PlanStep({
        name: 'Test Step',
        description: 'Test description',
        type: 'implementation'
      }, allowableActions);
      
      step.addAction({ type: 'create-file' });
      
      const json = step.toJSON();
      
      expect(json.name).toBe('Test Step');
      expect(json.description).toBe('Test description');
      expect(json.type).toBe('implementation');
      expect(json.actions).toHaveLength(1);
      expect(json.actions[0].type).toBe('create-file');
    });
  });

  describe('fromJSON', () => {
    test('should create from JSON', () => {
      const json = {
        name: 'Test Step',
        type: 'implementation',
        actions: [
          { type: 'create-file', parameters: {} }
        ]
      };
      
      const step = PlanStep.fromJSON(json, allowableActions);
      
      expect(step.name).toBe('Test Step');
      expect(step.type).toBe('implementation');
      expect(step.actions).toHaveLength(1);
    });
  });
});