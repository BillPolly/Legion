/**
 * Unit tests for ExecutionContext
 */

import { ExecutionContext } from '../../core/ExecutionContext.js';

describe('ExecutionContext', () => {
  let context;
  let mockPlan;

  beforeEach(() => {
    mockPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        {
          id: 'step1',
          name: 'Step 1',
          steps: [
            { id: 'step1.1', name: 'Sub Step 1.1' },
            { id: 'step1.2', name: 'Sub Step 1.2' }
          ]
        },
        { id: 'step2', name: 'Step 2' }
      ]
    };

    context = new ExecutionContext(mockPlan);
  });

  describe('constructor', () => {
    it('should initialize with plan and default options', () => {
      expect(context.plan).toBe(mockPlan);
      expect(context.options).toEqual({});
      expect(context.state.status).toBe('pending');
      expect(context.executionStack).toEqual([]);
      expect(context.currentPath).toEqual([]);
    });

    it('should initialize with custom options', () => {
      const options = { timeout: 5000, retries: 2 };
      const ctx = new ExecutionContext(mockPlan, options);
      
      expect(ctx.options).toBe(options);
    });
  });

  describe('hierarchical navigation', () => {
    it('should enter and exit steps correctly', () => {
      const step = mockPlan.steps[0];
      
      context.enterStep(step);
      
      expect(context.executionStack).toHaveLength(1);
      expect(context.currentPath).toEqual(['step1']);
      expect(context.getCurrentStep()).toBe(step);
      expect(context.getCurrentPath()).toBe('step1');
      
      context.exitStep();
      
      expect(context.executionStack).toHaveLength(0);
      expect(context.currentPath).toEqual([]);
      expect(context.getCurrentStep()).toBeNull();
    });

    it('should handle nested step navigation', () => {
      const parentStep = mockPlan.steps[0];
      const childStep = parentStep.steps[0];
      
      context.enterStep(parentStep);
      context.enterStep(childStep);
      
      expect(context.executionStack).toHaveLength(2);
      expect(context.currentPath).toEqual(['step1', 'step1.1']);
      expect(context.getCurrentPath()).toBe('step1.step1.1');
      expect(context.getCurrentStep()).toBe(childStep);
      expect(context.getParentStep()).toBe(parentStep);
      
      context.exitStep();
      
      expect(context.getCurrentStep()).toBe(parentStep);
      expect(context.getParentStep()).toBeNull();
    });
  });

  describe('state management', () => {
    it('should track completed steps', () => {
      context.completeStep('step1');
      context.completeStep('step2');
      
      expect(context.state.completedSteps).toEqual(['step1', 'step2']);
    });

    it('should track failed steps with errors', () => {
      const error = new Error('Step failed');
      context.failStep('step1', error);
      
      expect(context.state.failedSteps).toEqual(['step1']);
      expect(context.state.errors.get('step1')).toBe(error);
    });

    it('should track skipped steps', () => {
      context.skipStep('step1');
      context.skipStep('step2');
      
      expect(context.state.skippedSteps).toEqual(['step1', 'step2']);
    });
  });

  describe('variable management', () => {
    it('should set and get variables in current context', () => {
      const step = mockPlan.steps[0];
      context.enterStep(step);
      
      context.setVariable('testVar', 'testValue');
      
      expect(context.getVariable('testVar')).toBe('testValue');
      expect(context.hasVariable('testVar')).toBe(true);
    });

    it('should implement hierarchical variable scoping', () => {
      const parentStep = mockPlan.steps[0];
      const childStep = parentStep.steps[0];
      
      context.setVariable('globalVar', 'global');
      
      context.enterStep(parentStep);
      context.setVariable('parentVar', 'parent');
      
      context.enterStep(childStep);
      context.setVariable('childVar', 'child');
      
      // Child context should see all variables
      expect(context.getVariable('globalVar')).toBe('global');
      expect(context.getVariable('parentVar')).toBe('parent');
      expect(context.getVariable('childVar')).toBe('child');
      
      context.exitStep();
      
      // Parent context should not see child variables
      expect(context.getVariable('globalVar')).toBe('global');
      expect(context.getVariable('parentVar')).toBe('parent');
      expect(context.getVariable('childVar')).toBeUndefined();
    });
  });

  describe('parameter resolution', () => {
    beforeEach(() => {
      context.setVariable('testVar', 'variableValue');
      context.setStepResult('step1', 'step1Result');
      process.env.TEST_ENV = 'envValue';
    });

    afterEach(() => {
      delete process.env.TEST_ENV;
    });

    it('should resolve variable references', () => {
      const params = { key: '$testVar' };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.key).toBe('variableValue');
    });

    it('should resolve step result references', () => {
      const params = { key: '@step1' };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.key).toBe('step1Result');
    });

    it('should resolve environment variables', () => {
      const params = { key: '${TEST_ENV}' };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.key).toBe('envValue');
    });

    it('should handle nested objects and arrays', () => {
      const params = {
        nested: {
          var: '$testVar',
          result: '@step1'
        },
        array: ['$testVar', '@step1', 'literal']
      };
      
      const resolved = context.resolveParameters(params);
      
      expect(resolved.nested.var).toBe('variableValue');
      expect(resolved.nested.result).toBe('step1Result');
      expect(resolved.array).toEqual(['variableValue', 'step1Result', 'literal']);
    });
  });
});