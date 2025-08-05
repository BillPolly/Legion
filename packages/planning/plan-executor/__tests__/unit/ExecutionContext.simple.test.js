/**
 * Jest tests for ExecutionContext - simplified version focusing on core functionality
 */

import { ExecutionContext } from '../../src/core/ExecutionContext.js';

describe('ExecutionContext Simple', () => {
  let context;
  let testPlan;

  beforeEach(() => {
    testPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        { id: 'step1', name: 'First Step' },
        { id: 'step2', name: 'Second Step' }
      ]
    };
    context = new ExecutionContext(testPlan);
  });

  describe('initialization', () => {
    test('should initialize with plan and options', () => {
      expect(context.plan).toBe(testPlan);
      expect(context.state).toBeDefined();
      expect(context.state.status).toBe('pending');
      expect(context.state.completedSteps).toEqual([]);
      expect(context.state.failedSteps).toEqual([]);
      expect(context.state.skippedSteps).toEqual([]);
    });

    test('should initialize with default options', () => {
      expect(context.options).toBeDefined();
      expect(context.executionStack).toEqual([]);
      expect(context.currentPath).toEqual([]);
    });
  });

  describe('step state management', () => {
    test('should track completed steps', () => {
      context.completeStep('step1');
      expect(context.state.completedSteps).toEqual(['step1']);
      
      context.completeStep('step2');
      expect(context.state.completedSteps).toEqual(['step1', 'step2']);
    });

    test('should track failed steps', () => {
      const error = new Error('Test error');
      context.failStep('step1', error);
      
      expect(context.state.failedSteps).toEqual(['step1']);
      expect(context.state.errors.get('step1')).toBe(error);
    });

    test('should track skipped steps', () => {
      context.skipStep('step1');
      expect(context.state.skippedSteps).toEqual(['step1']);
    });

    test('should prevent duplicate entries', () => {
      context.completeStep('step1');
      context.completeStep('step1'); // Duplicate
      expect(context.state.completedSteps).toEqual(['step1']);
    });
  });

  describe('variable management', () => {
    test('should set and get variables', () => {
      context.setVariable('testVar', 'test value');
      expect(context.getVariable('testVar')).toBe('test value');
    });

    test('should check if variable exists', () => {
      context.setVariable('existingVar', 'value');
      expect(context.hasVariable('existingVar')).toBe(true);
      expect(context.hasVariable('nonExistentVar')).toBe(false);
    });

    test('should return undefined for non-existent variables', () => {
      expect(context.getVariable('nonExistentVar')).toBe(undefined);
    });
  });

  describe('result management', () => {
    test('should store and retrieve step results', () => {
      const result = { output: 'test output', status: 'success' };
      context.setStepResult('step1', result);
      expect(context.getStepResult('step1')).toBe(result);
    });

    test('should store and retrieve action results', () => {
      const result = { data: 'action data' };
      context.setActionResult('step1', 'action_type', result);
      expect(context.getActionResult('step1', 'action_type')).toBe(result);
    });

    test('should return undefined for non-existent results', () => {
      expect(context.getStepResult('nonExistentStep')).toBe(undefined);
      expect(context.getActionResult('step1', 'nonExistentAction')).toBe(undefined);
    });
  });

  describe('execution stack management', () => {
    test('should track current execution path', () => {
      const step1 = { id: 'step1', name: 'Step 1' };
      const step2 = { id: 'step2', name: 'Step 2' };
      
      expect(context.getCurrentPath()).toBe('');
      expect(context.getCurrentStep()).toBe(null);
      
      context.enterStep(step1);
      expect(context.getCurrentPath()).toBe('step1');
      expect(context.getCurrentStep()).toBe(step1);
      
      context.enterStep(step2);
      expect(context.getCurrentPath()).toBe('step1.step2');
      expect(context.getCurrentStep()).toBe(step2);
      expect(context.getParentStep()).toBe(step1);
      
      context.exitStep();
      expect(context.getCurrentPath()).toBe('step1');
      expect(context.getCurrentStep()).toBe(step1);
      
      context.exitStep();
      expect(context.getCurrentPath()).toBe('');
      expect(context.getCurrentStep()).toBe(null);
    });

    test('should handle empty execution stack', () => {
      expect(context.getCurrentStep()).toBe(null);
      expect(context.getParentStep()).toBe(null);
      
      // Exit when stack is empty should not crash
      context.exitStep();
      expect(context.getCurrentStep()).toBe(null);
    });
  });

  describe('parameter resolution basics', () => {
    test('should resolve simple variable references', () => {
      context.setVariable('name', 'John');
      
      const params = { greeting: '$name' };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.greeting).toBe('John');
    });

    test('should resolve step result references', () => {
      context.setStepResult('step1', { result: 'step1 output' });
      
      const params = { input: '@step1' };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.input).toEqual({ result: 'step1 output' });
    });

    test('should preserve unresolved references', () => {
      const params = { 
        unresolvedVar: '$nonExistent',
        unresolvedStep: '@nonExistent'
      };
      const resolved = context.resolveParameters(params);
      
      expect(resolved.unresolvedVar).toBe('$nonExistent');
      expect(resolved.unresolvedStep).toBe('@nonExistent');
    });

    test('should handle null and undefined parameters', () => {
      expect(context.resolveParameters(null)).toBe(null);
      expect(context.resolveParameters(undefined)).toBe(undefined);
      expect(context.resolveParameters('')).toBe('');
    });

    test('should handle nested object parameters', () => {
      context.setVariable('host', 'localhost');
      
      const params = {
        config: {
          database: {
            host: '$host',
            port: 5432
          }
        }
      };
      
      const resolved = context.resolveParameters(params);
      expect(resolved.config.database.host).toBe('localhost');
      expect(resolved.config.database.port).toBe(5432);
    });
  });
});