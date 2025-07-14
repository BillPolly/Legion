/**
 * Tests for Plan model
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { Plan } from '../../src/models/Plan.js';

describe('Plan', () => {
  let planData;

  beforeEach(() => {
    planData = {
      id: 'plan-123',
      name: 'Create Todo Application',
      version: '1.0.0',
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'CodePlanner',
        estimatedDuration: '2 hours',
        complexity: 'medium'
      },
      context: {
        projectType: 'fullstack',
        technologies: ['react', 'nodejs', 'postgresql'],
        constraints: ['accessibility', 'responsive']
      },
      steps: [
        {
          id: 'step-1',
          name: 'Initialize project',
          description: 'Set up project structure',
          type: 'setup',
          dependencies: [],
          inputs: { projectName: 'todo-app' },
          outputs: { directories: ['src'], files: ['package.json'] },
          actions: [
            { type: 'create-directory', path: 'todo-app' }
          ]
        }
      ],
      executionOrder: ['step-1'],
      successCriteria: ['All tests pass', 'Application runs']
    };
  });

  describe('Constructor', () => {
    test('should create a Plan instance with all properties', () => {
      const plan = new Plan(planData);

      expect(plan.id).toBe('plan-123');
      expect(plan.name).toBe('Create Todo Application');
      expect(plan.version).toBe('1.0.0');
      expect(plan.metadata).toEqual(planData.metadata);
      expect(plan.context).toEqual(planData.context);
      expect(plan.steps).toHaveLength(1);
      expect(plan.executionOrder).toEqual(['step-1']);
      expect(plan.successCriteria).toHaveLength(2);
    });

    test('should generate ID if not provided', () => {
      const dataWithoutId = { ...planData };
      delete dataWithoutId.id;
      
      const plan = new Plan(dataWithoutId);
      
      expect(plan.id).toBeDefined();
      expect(plan.id).toMatch(/^plan-[a-z0-9-]+$/);
    });

    test('should set default version if not provided', () => {
      const dataWithoutVersion = { ...planData };
      delete dataWithoutVersion.version;
      
      const plan = new Plan(dataWithoutVersion);
      
      expect(plan.version).toBe('1.0.0');
    });

    test('should initialize empty arrays if not provided', () => {
      const minimalData = {
        name: 'Test Plan'
      };
      
      const plan = new Plan(minimalData);
      
      expect(plan.steps).toEqual([]);
      expect(plan.executionOrder).toEqual([]);
      expect(plan.successCriteria).toEqual([]);
    });

    test('should set metadata defaults', () => {
      const dataWithoutMetadata = {
        name: 'Test Plan'
      };
      
      const plan = new Plan(dataWithoutMetadata);
      
      expect(plan.metadata.createdAt).toBeDefined();
      expect(plan.metadata.createdBy).toBe('LLMPlanner');
      expect(plan.metadata.estimatedDuration).toBeUndefined();
      expect(plan.metadata.complexity).toBe('unknown');
    });
  });

  describe('Methods', () => {
    test('should add a step to the plan', () => {
      const plan = new Plan(planData);
      const newStep = {
        id: 'step-2',
        name: 'Install dependencies',
        type: 'setup',
        dependencies: ['step-1']
      };

      plan.addStep(newStep);

      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[1]).toEqual(newStep);
    });

    test('should remove a step from the plan', () => {
      const plan = new Plan(planData);
      
      plan.removeStep('step-1');

      expect(plan.steps).toHaveLength(0);
      expect(plan.executionOrder).not.toContain('step-1');
    });

    test('should get step by ID', () => {
      const plan = new Plan(planData);
      
      const step = plan.getStep('step-1');

      expect(step).toBeDefined();
      expect(step.name).toBe('Initialize project');
    });

    test('should return undefined for non-existent step', () => {
      const plan = new Plan(planData);
      
      const step = plan.getStep('non-existent');

      expect(step).toBeUndefined();
    });

    test('should update execution order', () => {
      const plan = new Plan(planData);
      const newOrder = ['step-1', 'step-2'];

      plan.updateExecutionOrder(newOrder);

      expect(plan.executionOrder).toEqual(newOrder);
    });

    test('should validate plan structure', () => {
      const plan = new Plan(planData);
      
      const validation = plan.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const invalidPlan = new Plan({ steps: [] });
      
      const validation = invalidPlan.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Plan name is required');
    });

    test('should detect invalid dependencies', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            dependencies: ['step-2'] // step-2 doesn't exist
          }
        ]
      });
      
      const validation = plan.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Step step-1 depends on non-existent step: step-2');
    });

    test('should calculate total estimated duration', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          { id: '1', name: 'Step 1', estimatedDuration: 30 },
          { id: '2', name: 'Step 2', estimatedDuration: 45 },
          { id: '3', name: 'Step 3', estimatedDuration: 15 }
        ]
      });

      const duration = plan.getTotalDuration();

      expect(duration).toBe(90);
    });

    test('should get steps by type', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          { id: '1', name: 'Setup 1', type: 'setup' },
          { id: '2', name: 'Code 1', type: 'implementation' },
          { id: '3', name: 'Setup 2', type: 'setup' }
        ]
      });

      const setupSteps = plan.getStepsByType('setup');

      expect(setupSteps).toHaveLength(2);
      expect(setupSteps[0].id).toBe('1');
      expect(setupSteps[1].id).toBe('3');
    });

    test('should clone the plan', () => {
      const plan = new Plan(planData);
      
      const cloned = plan.clone();

      expect(cloned).not.toBe(plan);
      expect(cloned.id).not.toBe(plan.id);
      expect(cloned.name).toBe(plan.name);
      expect(cloned.steps).toEqual(plan.steps);
    });

    test('should export to JSON', () => {
      const plan = new Plan(planData);
      
      const json = plan.toJSON();

      expect(json).toEqual({
        id: plan.id,
        name: plan.name,
        version: plan.version,
        metadata: plan.metadata,
        context: plan.context,
        steps: plan.steps,
        executionOrder: plan.executionOrder,
        successCriteria: plan.successCriteria
      });
    });

    test('should import from JSON', () => {
      const json = {
        id: 'imported-plan',
        name: 'Imported Plan',
        version: '2.0.0',
        steps: [{ id: 'step-1', name: 'Step 1' }]
      };

      const plan = Plan.fromJSON(json);

      expect(plan).toBeInstanceOf(Plan);
      expect(plan.id).toBe('imported-plan');
      expect(plan.name).toBe('Imported Plan');
      expect(plan.version).toBe('2.0.0');
    });
  });

  describe('Dependency Management', () => {
    test('should detect circular dependencies', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          { id: 'step-1', name: 'Step 1', dependencies: ['step-2'] },
          { id: 'step-2', name: 'Step 2', dependencies: ['step-3'] },
          { id: 'step-3', name: 'Step 3', dependencies: ['step-1'] }
        ]
      });

      const hasCycles = plan.hasCircularDependencies();

      expect(hasCycles).toBe(true);
    });

    test('should generate correct execution order with dependencies', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          { id: 'step-1', name: 'Step 1', dependencies: [] },
          { id: 'step-2', name: 'Step 2', dependencies: ['step-1'] },
          { id: 'step-3', name: 'Step 3', dependencies: ['step-1', 'step-2'] }
        ]
      });

      const order = plan.generateExecutionOrder();

      expect(order).toEqual(['step-1', 'step-2', 'step-3']);
    });

    test('should identify independent steps for parallel execution', () => {
      const plan = new Plan({
        name: 'Test Plan',
        steps: [
          { id: 'step-1', name: 'Step 1', dependencies: [] },
          { id: 'step-2', name: 'Step 2', dependencies: [] },
          { id: 'step-3', name: 'Step 3', dependencies: ['step-1', 'step-2'] }
        ]
      });

      const parallelGroups = plan.getParallelExecutionGroups();

      expect(parallelGroups).toHaveLength(2);
      expect(parallelGroups[0]).toEqual(['step-1', 'step-2']);
      expect(parallelGroups[1]).toEqual(['step-3']);
    });
  });
});