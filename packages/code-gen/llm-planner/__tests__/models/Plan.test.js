/**
 * @jest-environment node
 */

import { describe, test, expect } from '@jest/globals';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';

describe('Plan', () => {
  const allowableActions = [
    { type: 'create-file', inputs: ['file-content'], outputs: ['file-created'] },
    { type: 'run-command', inputs: ['command'], outputs: ['command-result'] }
  ];

  describe('constructor', () => {
    test('should create a Plan with basic properties', () => {
      const plan = new Plan({
        name: 'Test Plan',
        description: 'Test description'
      }, allowableActions);
      
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('Test description');
      expect(plan.version).toBe('1.0.0');
      expect(plan.id).toBeDefined();
      expect(plan.steps).toEqual([]);
      expect(plan.allowableActions).toBe(allowableActions);
    });

    test('should initialize with steps', () => {
      const planData = {
        name: 'Test Plan',
        steps: [
          { name: 'Step 1', type: 'setup' },
          { name: 'Step 2', type: 'implementation' }
        ]
      };
      
      const plan = new Plan(planData, allowableActions);
      
      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].name).toBe('Step 1');
      expect(plan.steps[1].name).toBe('Step 2');
    });

    test('should set default metadata', () => {
      const plan = new Plan({}, allowableActions);
      
      expect(plan.metadata.createdBy).toBe('GenericPlanner');
      expect(plan.metadata.complexity).toBe('unknown');
      expect(plan.metadata.createdAt).toBeDefined();
    });
  });

  describe('addStep', () => {
    test('should add a step to the plan', () => {
      const plan = new Plan({}, allowableActions);
      const step = new PlanStep({ name: 'Test Step' }, allowableActions);
      
      plan.addStep(step);
      
      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0]).toBe(step);
    });

    test('should throw error if not a PlanStep instance', () => {
      const plan = new Plan({}, allowableActions);
      
      expect(() => plan.addStep({})).toThrow('Must be a PlanStep instance');
    });
  });

  describe('validate', () => {
    test('should validate plan structure', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      const step = new PlanStep({ name: 'Test Step', id: 'step-1' }, allowableActions);
      
      plan.addStep(step);
      
      const validation = plan.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should detect missing plan name', () => {
      const plan = new Plan({}, allowableActions);
      
      const validation = plan.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Plan name is required');
    });

    test('should detect invalid dependencies', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      const step = new PlanStep({ 
        name: 'Test Step', 
        id: 'step-1',
        dependencies: ['nonexistent-step']
      }, allowableActions);
      
      plan.addStep(step);
      
      const validation = plan.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Step step-1 depends on non-existent step: nonexistent-step');
    });
  });

  describe('validateInputOutputFlow', () => {
    test('should validate simple input/output flow', () => {
      const plan = new Plan({ 
        name: 'Test Plan',
        inputs: ['initial-input'],
        requiredOutputs: ['final-output']
      }, allowableActions);
      
      const step = new PlanStep({ 
        name: 'Test Step',
        id: 'step-1',
        inputs: ['initial-input'],
        outputs: ['final-output']
      }, allowableActions);
      
      plan.addStep(step);
      
      const validation = plan.validateInputOutputFlow();
      
      expect(validation.isValid).toBe(true);
      expect(validation.availableOutputs).toContain('final-output');
      expect(validation.missingOutputs).toEqual([]);
    });

    test('should detect missing required outputs', () => {
      const plan = new Plan({ 
        name: 'Test Plan',
        inputs: ['initial-input'],
        requiredOutputs: ['missing-output']
      }, allowableActions);
      
      const step = new PlanStep({ 
        name: 'Test Step',
        id: 'step-1',
        inputs: ['initial-input'],
        outputs: ['different-output']
      }, allowableActions);
      
      plan.addStep(step);
      
      const validation = plan.validateInputOutputFlow();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Plan does not produce required outputs: missing-output');
    });

    test('should detect missing step inputs', () => {
      const plan = new Plan({ 
        name: 'Test Plan',
        inputs: ['initial-input']
      }, allowableActions);
      
      const step = new PlanStep({ 
        name: 'Test Step',
        id: 'step-1',
        inputs: ['missing-input'],
        outputs: ['step-output']
      }, allowableActions);
      
      plan.addStep(step);
      
      const validation = plan.validateInputOutputFlow();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Step 'Test Step' (step-1) missing required inputs: missing-input");
    });
  });

  describe('hasCircularDependencies', () => {
    test('should detect circular dependencies', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      
      const step1 = new PlanStep({ 
        name: 'Step 1', 
        id: 'step-1',
        dependencies: ['step-2']
      }, allowableActions);
      
      const step2 = new PlanStep({ 
        name: 'Step 2', 
        id: 'step-2',
        dependencies: ['step-1']
      }, allowableActions);
      
      plan.addStep(step1);
      plan.addStep(step2);
      
      expect(plan.hasCircularDependencies()).toBe(true);
    });

    test('should return false for valid dependencies', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      
      const step1 = new PlanStep({ 
        name: 'Step 1', 
        id: 'step-1'
      }, allowableActions);
      
      const step2 = new PlanStep({ 
        name: 'Step 2', 
        id: 'step-2',
        dependencies: ['step-1']
      }, allowableActions);
      
      plan.addStep(step1);
      plan.addStep(step2);
      
      expect(plan.hasCircularDependencies()).toBe(false);
    });
  });

  describe('generateExecutionOrder', () => {
    test('should generate correct execution order', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      
      const step1 = new PlanStep({ 
        name: 'Step 1', 
        id: 'step-1'
      }, allowableActions);
      
      const step2 = new PlanStep({ 
        name: 'Step 2', 
        id: 'step-2',
        dependencies: ['step-1']
      }, allowableActions);
      
      const step3 = new PlanStep({ 
        name: 'Step 3', 
        id: 'step-3',
        dependencies: ['step-2']
      }, allowableActions);
      
      plan.addStep(step1);
      plan.addStep(step2);
      plan.addStep(step3);
      
      const executionOrder = plan.generateExecutionOrder();
      
      expect(executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('getParallelExecutionGroups', () => {
    test('should group independent steps for parallel execution', () => {
      const plan = new Plan({ name: 'Test Plan' }, allowableActions);
      
      const step1 = new PlanStep({ name: 'Step 1', id: 'step-1' }, allowableActions);
      const step2 = new PlanStep({ name: 'Step 2', id: 'step-2' }, allowableActions);
      const step3 = new PlanStep({ 
        name: 'Step 3', 
        id: 'step-3',
        dependencies: ['step-1', 'step-2']
      }, allowableActions);
      
      plan.addStep(step1);
      plan.addStep(step2);
      plan.addStep(step3);
      
      const groups = plan.getParallelExecutionGroups();
      
      expect(groups.length).toBe(2);
      expect(groups[0]).toEqual(expect.arrayContaining(['step-1', 'step-2']));
      expect(groups[1]).toEqual(['step-3']);
    });
  });

  describe('toJSON', () => {
    test('should export to JSON', () => {
      const plan = new Plan({
        name: 'Test Plan',
        description: 'Test description',
        inputs: ['input1'],
        requiredOutputs: ['output1']
      }, allowableActions);
      
      const step = new PlanStep({ name: 'Test Step' }, allowableActions);
      plan.addStep(step);
      
      const json = plan.toJSON();
      
      expect(json.name).toBe('Test Plan');
      expect(json.description).toBe('Test description');
      expect(json.inputs).toEqual(['input1']);
      expect(json.requiredOutputs).toEqual(['output1']);
      expect(json.steps).toHaveLength(1);
      expect(json.steps[0].name).toBe('Test Step');
    });
  });

  describe('fromJSON', () => {
    test('should create from JSON', () => {
      const json = {
        name: 'Test Plan',
        description: 'Test description',
        steps: [
          { name: 'Test Step', type: 'implementation' }
        ]
      };
      
      const plan = Plan.fromJSON(json, allowableActions);
      
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('Test description');
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].name).toBe('Test Step');
    });
  });

  describe('getInputs', () => {
    test('should return plan inputs', () => {
      const plan = new Plan({ inputs: ['input1', 'input2'] }, allowableActions);
      
      expect(plan.getInputs()).toEqual(['input1', 'input2']);
    });
  });

  describe('getRequiredOutputs', () => {
    test('should return plan required outputs', () => {
      const plan = new Plan({ requiredOutputs: ['output1', 'output2'] }, allowableActions);
      
      expect(plan.getRequiredOutputs()).toEqual(['output1', 'output2']);
    });
  });
});