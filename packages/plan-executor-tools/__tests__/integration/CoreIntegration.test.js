/**
 * Integration test between plan-executor core and plan-executor-tools
 */

import { PlanExecutorToolsModule } from '../../src/index.js';
import { PlanExecutor, ExecutionContext } from '@legion/plan-executor';
import { ResourceManager } from '@legion/module-loader';

describe('Core Integration', () => {
  let resourceManager;
  let module;

  beforeEach(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  afterEach(() => {
    if (module) {
      // Clean up if needed
    }
  });

  test('should be able to create PlanExecutor directly from core package', async () => {
    const executor = await PlanExecutor.create(resourceManager);
    expect(executor).toBeInstanceOf(PlanExecutor);
    expect(executor.moduleLoader).toBeDefined();
  });

  test('should be able to create tools module that uses core executor', async () => {
    module = await PlanExecutorToolsModule.create(resourceManager);
    
    expect(module).toBeInstanceOf(PlanExecutorToolsModule);
    expect(module.executor).toBeInstanceOf(PlanExecutor);
    
    const tools = module.getTools();
    expect(tools).toHaveLength(6);
  });

  test('should be able to execute a simple plan validation', async () => {
    module = await PlanExecutorToolsModule.create(resourceManager);
    
    const planInspectorTool = module.getTool('plan_inspect');
    expect(planInspectorTool).toBeDefined();
    
    // Test with a minimal valid plan
    const testPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        {
          id: 'step1',
          name: 'Test Step',
          actions: [
            { type: 'test_action', parameters: {} }
          ]
        }
      ]
    };
    
    const result = await planInspectorTool.execute({ plan: testPlan });
    expect(result.success).toBe(true);
    expect(result.validation).toBeDefined();
    expect(result.validation.isValid).toBe(true);
  });
});