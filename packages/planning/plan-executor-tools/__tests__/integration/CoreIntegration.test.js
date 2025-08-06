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
    expect(tools).toHaveLength(7);
  });

  // Note: Plan validation testing is covered in dedicated validation test files
});