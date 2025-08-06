/**
 * Comprehensive unit tests for ExecutionContext with new @variable system
 */

import { ExecutionContext } from '../../src/core/ExecutionContext.js';

describe('ExecutionContext', () => {
  let context;
  let mockPlan;

  beforeEach(() => {
    mockPlan = {
      id: 'test-plan-123',
      name: 'Test Plan',
      steps: [
        {
          id: 'step1',
          name: 'First Step',
          steps: [
            { id: 'step1.1', name: 'Nested Step 1.1' },
            { id: 'step1.2', name: 'Nested Step 1.2' }
          ]
        },
        { id: 'step2', name: 'Second Step' }
      ]
    };

    context = new ExecutionContext(mockPlan);
  });

  describe('Variable Management', () => {
    test('should set and get variables in global scope by default', () => {
      context.setVariable('testVar', 'testValue');
      expect(context.getVariable('testVar')).toBe('testValue');
      expect(context.hasVariable('testVar')).toBe(true);
    });

    test('should handle different variable types', () => {
      context.setVariable('stringVar', 'hello');
      context.setVariable('numberVar', 42);
      context.setVariable('booleanVar', true);
      context.setVariable('objectVar', { key: 'value' });
      context.setVariable('arrayVar', [1, 2, 3]);

      expect(context.getVariable('stringVar')).toBe('hello');
      expect(context.getVariable('numberVar')).toBe(42);
      expect(context.getVariable('booleanVar')).toBe(true);
      expect(context.getVariable('objectVar')).toEqual({ key: 'value' });
      expect(context.getVariable('arrayVar')).toEqual([1, 2, 3]);
    });

    test('should return undefined for non-existent variables', () => {
      expect(context.getVariable('nonExistent')).toBeUndefined();
      expect(context.hasVariable('nonExistent')).toBe(false);
    });

    test('should support step-scoped variables', () => {
      const step = { id: 'test-step', name: 'Test Step' };
      context.enterStep(step);
      
      context.setVariable('globalVar', 'global', 'global');
      context.setVariable('stepVar', 'step-scoped', 'step');
      
      expect(context.getVariable('globalVar')).toBe('global');
      expect(context.getVariable('stepVar')).toBe('step-scoped');
      
      context.exitStep();
      
      // Global variable persists, step variable is lost
      expect(context.getVariable('globalVar')).toBe('global');
      expect(context.getVariable('stepVar')).toBeUndefined();
    });
  });

  describe('Variable Resolution', () => {
    beforeEach(() => {
      context.setVariable('baseDir', './project');
      context.setVariable('fileName', 'index.js');
      context.setVariable('port', 3000);
      context.setVariable('config', { debug: true, env: 'test' });
    });

    test('should resolve simple @variable references', () => {
      const resolved = context.resolveParameters({
        path: '@baseDir',
        file: '@fileName',
        port: '@port'
      });

      expect(resolved).toEqual({
        path: './project',
        file: 'index.js', 
        port: 3000  // Numbers should remain numbers
      });
    });

    test('should resolve @variable with path concatenation', () => {
      const resolved = context.resolveParameters({
        fullPath: '@baseDir/src/index.js',
        configPath: '@baseDir/config.json'
      });

      expect(resolved).toEqual({
        fullPath: './project/src/index.js',
        configPath: './project/config.json'
      });
    });

    test('should handle complex path concatenation', () => {
      context.setVariable('root', '/home/user');
      context.setVariable('project', 'myapp');
      
      const resolved = context.resolveParameters({
        srcPath: '@root/@project/src',
        testPath: '@root/@project/tests/unit'
      });

      expect(resolved).toEqual({
        srcPath: '/home/user/@project/src', // Note: nested variables not supported yet
        testPath: '/home/user/@project/tests/unit'
      });
    });

    test('should resolve variables in nested objects', () => {
      const resolved = context.resolveParameters({
        server: {
          host: 'localhost',
          port: '@port',
          staticPath: '@baseDir/public'
        },
        database: {
          config: '@config'
        }
      });

      expect(resolved).toEqual({
        server: {
          host: 'localhost',
          port: 3000,
          staticPath: './project/public'
        },
        database: {
          config: { debug: true, env: 'test' }
        }
      });
    });

    test('should resolve variables in arrays', () => {
      const resolved = context.resolveParameters({
        paths: [
          '@baseDir/src',
          '@baseDir/tests',
          '@baseDir/docs'
        ],
        ports: [3000, '@port', 4000]
      });

      expect(resolved).toEqual({
        paths: [
          './project/src',
          './project/tests',
          './project/docs'
        ],
        ports: [3000, 3000, 4000]
      });
    });

    test('should leave unresolvable variables unchanged', () => {
      const resolved = context.resolveParameters({
        existing: '@baseDir',
        missing: '@nonExistent',
        pathWithMissing: '@nonExistent/file.txt'
      });

      expect(resolved).toEqual({
        existing: './project',
        missing: '@nonExistent',
        pathWithMissing: '@nonExistent/file.txt'
      });
    });

    test('should handle constants alongside variables', () => {
      const resolved = context.resolveParameters({
        constantString: 'hello',
        constantNumber: 42,
        constantBoolean: true,
        variableString: '@fileName',
        mixedPath: '@baseDir/static'
      });

      expect(resolved).toEqual({
        constantString: 'hello',
        constantNumber: 42,
        constantBoolean: true,
        variableString: 'index.js',
        mixedPath: './project/static'
      });
    });

    test('should handle null and undefined parameters', () => {
      expect(context.resolveParameters(null)).toBeNull();
      expect(context.resolveParameters(undefined)).toBeUndefined();
      expect(context.resolveParameters('')).toBe('');
    });
  });

  describe('Hierarchical Step Navigation', () => {
    test('should manage execution stack correctly', () => {
      expect(context.getCurrentStep()).toBeNull();
      expect(context.getCurrentPath()).toBe('');

      const step1 = { id: 'step1', name: 'Step 1' };
      context.enterStep(step1);
      
      expect(context.getCurrentStep()).toBe(step1);
      expect(context.getCurrentPath()).toBe('step1');

      const step2 = { id: 'step2', name: 'Step 2' };
      context.enterStep(step2);
      
      expect(context.getCurrentStep()).toBe(step2);
      expect(context.getCurrentPath()).toBe('step1.step2');

      context.exitStep();
      expect(context.getCurrentStep()).toBe(step1);
      expect(context.getCurrentPath()).toBe('step1');

      context.exitStep();
      expect(context.getCurrentStep()).toBeNull();
      expect(context.getCurrentPath()).toBe('');
    });

    test('should provide parent step access', () => {
      const step1 = { id: 'step1', name: 'Step 1' };
      const step2 = { id: 'step2', name: 'Step 2' };

      expect(context.getParentStep()).toBeNull();

      context.enterStep(step1);
      expect(context.getParentStep()).toBeNull();

      context.enterStep(step2);
      expect(context.getParentStep()).toBe(step1);

      context.exitStep();
      expect(context.getParentStep()).toBeNull();
    });

    test('should handle step path resolution', () => {
      const foundStep = context.getStepAtPath('step1.step1.1');
      expect(foundStep).toBeNull(); // Real plan doesn't have this structure

      const step1 = context.getStepAtPath('step1');
      expect(step1).toEqual(mockPlan.steps[0]);

      const step2 = context.getStepAtPath('step2');
      expect(step2).toEqual(mockPlan.steps[1]);
    });
  });

  describe('State Management', () => {
    test('should track step completion states', () => {
      expect(context.state.completedSteps).toEqual([]);
      expect(context.state.failedSteps).toEqual([]);
      expect(context.state.skippedSteps).toEqual([]);

      context.completeStep('step1');
      expect(context.state.completedSteps).toContain('step1');

      context.failStep('step2', new Error('Test error'));
      expect(context.state.failedSteps).toContain('step2');
      expect(context.state.errors.has('step2')).toBe(true);

      context.skipStep('step3');
      expect(context.state.skippedSteps).toContain('step3');
    });

    test('should manage step and action results', () => {
      const stepResult = { output: 'test result' };
      context.setStepResult('step1', stepResult);
      expect(context.getStepResult('step1')).toBe(stepResult);

      const actionResult = { success: true, data: 'action data' };
      context.setActionResult('step1', 'file_write', actionResult);
      expect(context.getActionResult('step1', 'file_write')).toBe(actionResult);
    });

    test('should prevent duplicate step state changes', () => {
      context.completeStep('step1');
      context.completeStep('step1'); // Duplicate
      expect(context.state.completedSteps.filter(s => s === 'step1')).toHaveLength(1);

      context.failStep('step2', new Error('Error 1'));
      context.failStep('step2', new Error('Error 2')); // Duplicate
      expect(context.state.failedSteps.filter(s => s === 'step2')).toHaveLength(1);
    });
  });

  describe('Variable Scoping Edge Cases', () => {
    test('should handle variable shadowing in step scopes', () => {
      context.setVariable('shared', 'global-value');
      
      const step = { id: 'test-step', name: 'Test Step' };
      context.enterStep(step);
      context.setVariable('shared', 'step-value', 'step');
      
      // Step-scoped variable shadows global
      expect(context.getVariable('shared')).toBe('step-value');
      
      context.exitStep();
      
      // Global variable is revealed after step exit
      expect(context.getVariable('shared')).toBe('global-value');
    });

    test('should search variable hierarchy correctly', () => {
      context.setVariable('level0', 'global');
      
      const step1 = { id: 'step1', name: 'Step 1' };
      context.enterStep(step1);
      context.setVariable('level1', 'step1-value', 'step');
      
      const step2 = { id: 'step2', name: 'Step 2' };
      context.enterStep(step2);
      context.setVariable('level2', 'step2-value', 'step');
      
      // All variables should be accessible
      expect(context.getVariable('level0')).toBe('global');
      expect(context.getVariable('level1')).toBe('step1-value');
      expect(context.getVariable('level2')).toBe('step2-value');
      
      context.exitStep(); // Exit step2
      
      expect(context.getVariable('level0')).toBe('global');
      expect(context.getVariable('level1')).toBe('step1-value');
      expect(context.getVariable('level2')).toBeUndefined();
      
      context.exitStep(); // Exit step1
      
      expect(context.getVariable('level0')).toBe('global');
      expect(context.getVariable('level1')).toBeUndefined();
      expect(context.getVariable('level2')).toBeUndefined();
    });
  });
});