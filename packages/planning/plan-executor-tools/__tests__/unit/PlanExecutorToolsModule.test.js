/**
 * Tests for PlanExecutorToolsModule
 */

import { PlanExecutorToolsModule } from '../../src/PlanExecutorToolsModule.js';
import { ResourceManager } from '@legion/module-loader';

describe('PlanExecutorToolsModule', () => {
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

  describe('async factory pattern', () => {
    test('should create module using async factory', async () => {
      module = await PlanExecutorToolsModule.create(resourceManager);
      
      expect(module).toBeInstanceOf(PlanExecutorToolsModule);
      expect(module.resourceManager).toBe(resourceManager);
      expect(module.executor).toBeDefined();
    });

    test('should have all 6 tools', async () => {
      module = await PlanExecutorToolsModule.create(resourceManager);
      
      const tools = module.getTools();
      expect(tools).toHaveLength(6);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toEqual([
        'plan_execute',
        'plan_execute_step', 
        'plan_debug',
        'plan_inspect',
        'plan_to_markdown',
        'plan_status'
      ]);
    });

    test('should get tool by name', async () => {
      module = await PlanExecutorToolsModule.create(resourceManager);
      
      const planExecutorTool = module.getTool('plan_execute');
      expect(planExecutorTool).toBeDefined();
      expect(planExecutorTool.name).toBe('plan_execute');
    });
  });

  describe('tool functionality', () => {
    beforeEach(async () => {
      module = await PlanExecutorToolsModule.create(resourceManager);
    });

    test('plan_execute tool should be properly configured', () => {
      const tool = module.getTool('plan_execute');
      expect(tool).toBeDefined();
      expect(tool.executor).toBe(module.executor);
      expect(typeof tool.execute).toBe('function');
    });

    test('plan_inspect tool should be properly configured', () => {
      const tool = module.getTool('plan_inspect');
      expect(tool).toBeDefined();
      // Note: ModuleLoader has hasTool method, so it should be detected correctly
      expect(tool.moduleLoader || tool.planToolRegistry).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
    });
  });
});