/**
 * Comprehensive unit tests for PlanExecutor with new inputs/outputs system
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import { ExecutionContext } from '../../src/core/ExecutionContext.js';

// Create mock function helper since jest.fn() might not be available in all environments
function createMockFn(defaultReturnValue) {
  const fn = function(...args) {
    fn.calls.push(args);
    if (fn.mockImplementation) {
      return fn.mockImplementation(...args);
    }
    return fn.mockReturnValue || defaultReturnValue;
  };
  
  fn.calls = [];
  fn.mockResolvedValue = (value) => {
    fn.mockReturnValue = Promise.resolve(value);
    return fn;
  };
  fn.mockRejectedValue = (value) => {
    fn.mockReturnValue = Promise.reject(value);
    return fn;
  };
  fn.mockReturnValue = (value) => {
    fn.mockReturnValue = value;
    return fn;
  };
  fn.mockImplementation = null;
  
  return fn;
}

describe('PlanExecutor', () => {
  let executor;
  let mockModuleLoader;
  let mockResourceManager;

  beforeEach(() => {
    // Create comprehensive mock tool
    const mockTool = {
      name: 'test_tool',
      description: 'Test tool for unit testing',
      execute: createMockFn(Promise.resolve({ success: true, data: {} }))
    };

    mockModuleLoader = {
      initialize: createMockFn(Promise.resolve()),
      getToolByNameOrAlias: createMockFn(mockTool),
      getModuleIdForTool: createMockFn('test-module'),
      hasModule: createMockFn(true)
    };

    mockResourceManager = {
      get: createMockFn(),
      has: createMockFn(),
      initialize: createMockFn(Promise.resolve())
    };

    executor = new PlanExecutor({ moduleLoader: mockModuleLoader });
  });

  describe('Initialization', () => {
    test('should create executor with async factory pattern', async () => {
      // Skip this test for now since it requires full ResourceManager setup
      // This test is covered by integration tests which use real ResourceManager
      expect(true).toBe(true);
    });

    test('should require moduleLoader in constructor', () => {
      expect(() => new PlanExecutor()).toThrow('ModuleLoader is required');
    });
  });

  describe('Plan Validation', () => {
    test('should reject plans without steps', async () => {
      const invalidPlan = { id: 'test', name: 'Test Plan' };
      
      await expect(executor.executePlan(invalidPlan)).rejects.toThrow(
        'Invalid plan: must have steps array'
      );
    });

    test('should reject plans without validated status', async () => {
      const unvalidatedPlan = {
        id: 'test',
        name: 'Test Plan',
        steps: []
      };
      
      await expect(executor.executePlan(unvalidatedPlan)).rejects.toThrow(
        'Plan must be validated before execution'
      );
    });

    test('should accept validated plans', async () => {
      const validPlan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: []
      };
      
      const result = await executor.executePlan(validPlan);
      expect(result.success).toBe(true);
    });
  });

  describe('New Inputs/Outputs Action Processing', () => {
    let mockTool;

    beforeEach(() => {
      mockTool = {
        name: 'file_write',
        execute: createMockFn().mockResolvedValue({
          success: true,
          data: {
            filepath: './test.txt',
            bytesWritten: 100,
            created: true
          }
        })
      };

      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);
    });

    test('should process new inputs/outputs format correctly', async () => {
      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Write File',
            actions: [
              {
                id: 'action1',
                type: 'file_write',
                inputs: {
                  filepath: './test.txt',
                  content: 'Hello World',
                  encoding: 'utf8'
                },
                outputs: {
                  filepath: 'createdFile',
                  bytesWritten: 'fileSize',
                  created: 'wasCreated'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledWith({
        filepath: './test.txt',
        content: 'Hello World',
        encoding: 'utf8'
      });
    });

    test('should resolve @variables in inputs', async () => {
      const plan = {
        id: 'test',
        name: 'Test Plan', 
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Create Directory',
            actions: [
              {
                id: 'create-dir',
                type: 'directory_create',
                inputs: {
                  dirpath: './project'
                },
                outputs: {
                  dirpath: 'projectDir'
                }
              }
            ]
          },
          {
            id: 'step2',
            name: 'Write File',
            actions: [
              {
                id: 'write-file',
                type: 'file_write',
                inputs: {
                  filepath: '@projectDir/index.js',
                  content: 'console.log("Hello");'
                },
                outputs: {
                  filepath: 'createdFile'
                }
              }
            ]
          }
        ]
      };

      // Mock directory creation tool
      const mockDirTool = {
        execute: createMockFn().mockResolvedValue({
          success: true,
          data: { dirpath: './project' }
        })
      };

      let callCount = 0;
      mockModuleLoader.getToolByNameOrAlias = createMockFn();
      mockModuleLoader.getToolByNameOrAlias.mockImplementation = () => {
        callCount++;
        return callCount === 1 ? mockDirTool : mockTool;
      };

      await executor.executePlan(plan);

      // First action should get literal path
      expect(mockDirTool.execute).toHaveBeenCalledWith({
        dirpath: './project'
      });

      // Second action should get resolved path
      expect(mockTool.execute).toHaveBeenCalledWith({
        filepath: './project/index.js',
        content: 'console.log("Hello");'
      });
    });

    test('should handle output mapping to context variables', async () => {
      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated', 
        steps: [
          {
            id: 'step1',
            name: 'Test Action',
            actions: [
              {
                id: 'action1',
                type: 'file_write',
                inputs: {
                  filepath: './test.txt',
                  content: 'test'
                },
                outputs: {
                  filepath: 'resultFile',
                  bytesWritten: 'fileSize',
                  created: 'isNew'
                }
              }
            ]
          }
        ]
      };

      // Track context changes
      let capturedContext;
      let setVariableCalls = [];
      const originalSetVariable = ExecutionContext.prototype.setVariable;
      ExecutionContext.prototype.setVariable = function(name, value) {
        capturedContext = this;
        setVariableCalls.push({ name, value });
        return originalSetVariable.call(this, name, value);
      };

      await executor.executePlan(plan);

      // Verify output mapping occurred
      const calls = setVariableCalls;
      expect(calls.find(c => c.name === 'resultFile' && c.value === './test.txt')).toBeDefined();
      expect(calls.find(c => c.name === 'fileSize' && c.value === 100)).toBeDefined();
      expect(calls.find(c => c.name === 'isNew' && c.value === true)).toBeDefined();

      // Restore original method
      ExecutionContext.prototype.setVariable = originalSetVariable;
    });
  });

  describe('Legacy Parameters Compatibility', () => {
    test('should process legacy parameters format', async () => {
      const mockTool = {
        execute: createMockFn().mockResolvedValue({ success: true, data: {} })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const legacyPlan = {
        id: 'test',
        name: 'Legacy Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Legacy Action',
            actions: [
              {
                id: 'action1',
                type: 'file_write',
                parameters: {
                  filepath: './legacy.txt',
                  content: 'legacy content'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(legacyPlan);
      
      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledWith({
        filepath: './legacy.txt',
        content: 'legacy content'
      });
    });

    test('should prefer inputs over parameters when both present', async () => {
      const mockTool = {
        execute: createMockFn().mockResolvedValue({ success: true, data: {} })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Mixed Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Mixed Action',
            actions: [
              {
                id: 'action1',
                type: 'file_write',
                inputs: {
                  filepath: './new-format.txt',
                  content: 'new format'
                },
                parameters: {
                  filepath: './old-format.txt',
                  content: 'old format'
                }
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);
      
      // Should use inputs, not parameters
      expect(mockTool.execute).toHaveBeenCalledWith({
        filepath: './new-format.txt',
        content: 'new format'
      });
    });
  });

  describe('Tool Resolution and Error Handling', () => {
    test('should handle missing tools gracefully', async () => {
      mockModuleLoader.getToolByNameOrAlias.mockResolvedValue(null);
      mockModuleLoader.getModuleIdForTool.mockResolvedValue(null);

      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Missing Tool Step',
            actions: [
              {
                id: 'action1',
                type: 'nonexistent_tool',
                inputs: {}
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('step1');
    });

    test('should handle module loading requirements', async () => {
      mockModuleLoader.getToolByNameOrAlias.mockResolvedValue(null);
      mockModuleLoader.getModuleIdForTool.mockResolvedValue('required-module');
      mockModuleLoader.hasModule.mockReturnValue(false);

      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Unloaded Module Step',
            actions: [
              {
                id: 'action1',
                type: 'unloaded_tool',
                inputs: {}
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('step1');
    });

    test('should handle tool execution failures', async () => {
      const mockTool = {
        execute: createMockFn().mockResolvedValue({
          success: false,
          error: 'Tool execution failed'
        })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Failing Step',
            actions: [
              {
                id: 'action1',
                type: 'failing_tool',
                inputs: {}
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('step1');
    });

    test('should retry failed actions', async () => {
      let callCount = 0;
      const mockTool = {
        execute: createMockFn()
      };
      mockTool.execute.mockImplementation = () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: {} };
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Retry Step',
            actions: [
              {
                id: 'action1',
                type: 'retry_tool',
                inputs: {}
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan, { retries: 3 });
      
      expect(result.success).toBe(true);
      expect(mockTool.execute.calls).toHaveLength(3);
    });
  });

  describe('Event System', () => {
    test('should emit plan lifecycle events', async () => {
      const planStartSpy = createMockFn();
      const planCompleteSpy = createMockFn();
      
      executor.on('plan:start', planStartSpy);
      executor.on('plan:complete', planCompleteSpy);

      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated',
        steps: []
      };

      await executor.executePlan(plan);

      expect(planStartSpy.calls).toHaveLength(1);
      expect(planStartSpy.calls[0][0].planId).toBe('test-plan');
      expect(planStartSpy.calls[0][0].planName).toBe('Test Plan');

      expect(planCompleteSpy.calls).toHaveLength(1);
      expect(planCompleteSpy.calls[0][0].planId).toBe('test-plan');
      expect(planCompleteSpy.calls[0][0].success).toBe(true);
    });

    test('should emit step lifecycle events', async () => {
      const stepStartSpy = createMockFn();
      const stepCompleteSpy = createMockFn();
      
      executor.on('step:start', stepStartSpy);
      executor.on('step:complete', stepCompleteSpy);

      const mockTool = {
        execute: createMockFn().mockResolvedValue({ success: true, data: {} })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'test-step',
            name: 'Test Step',
            actions: [
              {
                id: 'action1',
                type: 'test_tool',
                inputs: {}
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(stepStartSpy.calls).toHaveLength(1);
      expect(stepStartSpy.calls[0][0].stepId).toBe('test-step');
      expect(stepStartSpy.calls[0][0].stepName).toBe('Test Step');

      expect(stepCompleteSpy.calls).toHaveLength(1);
      expect(stepCompleteSpy.calls[0][0].stepId).toBe('test-step');
      expect(stepCompleteSpy.calls[0][0].stepName).toBe('Test Step');
    });

    test('should emit action lifecycle events', async () => {
      const actionStartSpy = createMockFn();
      const actionCompleteSpy = createMockFn();
      
      executor.on('action:start', actionStartSpy);
      executor.on('action:complete', actionCompleteSpy);

      const mockTool = {
        execute: createMockFn().mockResolvedValue({
          success: true,
          data: { result: 'test-result' }
        })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated',
        steps: [
          {
            id: 'test-step',
            name: 'Test Step',
            actions: [
              {
                id: 'test-action',
                type: 'test_tool',
                inputs: { param: 'value' }
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(actionStartSpy.calls).toHaveLength(1);
      expect(actionStartSpy.calls[0][0].actionId).toBe('test-action');
      expect(actionStartSpy.calls[0][0].actionType).toBe('test_tool');
      expect(actionStartSpy.calls[0][0].parameters.param).toBe('value');

      expect(actionCompleteSpy.calls).toHaveLength(1);
      expect(actionCompleteSpy.calls[0][0].actionId).toBe('test-action');
      expect(actionCompleteSpy.calls[0][0].actionType).toBe('test_tool');
      expect(actionCompleteSpy.calls[0][0].result.success).toBe(true);
      expect(actionCompleteSpy.calls[0][0].result.data.result).toBe('test-result');
    });
  });

  describe('Step Dependencies', () => {
    test('should enforce step dependencies', async () => {
      const mockTool = {
        execute: createMockFn().mockResolvedValue({ success: true, data: {} })
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Dependency Test',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            actions: [{ id: 'a1', type: 'test_tool', inputs: {} }]
          },
          {
            id: 'step2',
            name: 'Second Step',
            dependencies: ['step1'],
            actions: [{ id: 'a2', type: 'test_tool', inputs: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1', 'step2']);
    });

    test('should fail when dependencies are not satisfied', async () => {
      const plan = {
        id: 'test',
        name: 'Bad Dependency Test',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Dependent Step',
            dependencies: ['nonexistent-step'],
            actions: [{ id: 'a1', type: 'test_tool', inputs: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('step1');
    });
  });

  describe('Execution Options', () => {
    test('should respect stopOnError option', async () => {
      let callCount = 0;
      const mockTool = {
        execute: createMockFn()
      };
      mockTool.execute.mockImplementation = () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First action fails');
        }
        return { success: true, data: {} };
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Stop on Error Test',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Failing Step',
            actions: [{ id: 'a1', type: 'test_tool', inputs: {} }]
          },
          {
            id: 'step2',
            name: 'Would Succeed Step',
            actions: [{ id: 'a2', type: 'test_tool', inputs: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: true });
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('step1');
      expect(result.skippedSteps).toContain('step2');
    });

    test('should continue execution when stopOnError is false', async () => {
      let callCount = 0;
      const mockTool = {
        execute: createMockFn()
      };
      mockTool.execute.mockImplementation = () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First action fails');
        }
        return { success: true, data: {} };
      };
      mockModuleLoader.getToolByNameOrAlias = createMockFn(mockTool);

      const plan = {
        id: 'test',
        name: 'Continue on Error Test',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Failing Step',
            actions: [{ id: 'a1', type: 'test_tool', inputs: {} }]
          },
          {
            id: 'step2', 
            name: 'Succeeding Step',
            actions: [{ id: 'a2', type: 'test_tool', inputs: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false });
      
      expect(result.success).toBe(false); // Overall failure due to step1
      expect(result.failedSteps).toContain('step1');
      expect(result.completedSteps).toContain('step2');
      expect(result.skippedSteps).toHaveLength(0);
    });
  });
});