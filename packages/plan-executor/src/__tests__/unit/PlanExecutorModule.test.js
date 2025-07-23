/**
 * Unit tests for PlanExecutorModule
 */

import { PlanExecutorModule } from '../../PlanExecutorModule.js';

describe('PlanExecutorModule', () => {
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn(),
      register: jest.fn()
    };

    mockModuleFactory = {
      createModule: jest.fn()
    };
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      
      expect(module).toBeInstanceOf(PlanExecutorModule);
      expect(module.resourceManager).toBe(mockResourceManager);
      expect(module.moduleFactory).toBe(mockModuleFactory);
      expect(module.executor).toBeDefined();
      expect(module.tool).toBeDefined();
    });

    it('should have correct dependencies', () => {
      expect(PlanExecutorModule.dependencies).toEqual(['resourceManager', 'moduleFactory']);
    });
  });

  describe('getTools', () => {
    it('should return array with plan executor tool', () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(module.tool);
    });

    it('should return tool with correct properties', () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      const tools = module.getTools();
      const tool = tools[0];
      
      expect(tool.name).toBe('plan_execute');
      expect(tool.description).toBe('Execute a plan using available Legion tools');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.execute).toBeInstanceOf(Function);
    });
  });

  describe('dependency injection', () => {
    it('should pass dependencies to executor', () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      
      expect(module.executor.moduleFactory).toBe(mockModuleFactory);
      expect(module.executor.resourceManager).toBe(mockResourceManager);
    });

    it('should initialize with correct dependency list', () => {
      expect(PlanExecutorModule.dependencies).toEqual(['resourceManager', 'moduleFactory']);
    });
  });

  describe('integration', () => {
    it('should create fully functional tool', async () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      const tool = module.getTools()[0];

      // Mock the executor's module loader
      module.executor.moduleLoader.loadModulesForPlan = jest.fn().mockResolvedValue();
      module.executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'test result' })
      });

      const plan = {
        id: 'integration-test',
        steps: [
          {
            id: 'test-step',
            actions: [{ type: 'test_tool', parameters: { input: 'test' } }]
          }
        ]
      };

      const result = await tool.execute({ plan });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['test-step']);
    });

    it('should handle tool execution errors gracefully', async () => {
      const module = new PlanExecutorModule(mockResourceManager, mockModuleFactory);
      const tool = module.getTools()[0];

      // Mock the executor to throw an error
      module.executor.executePlan = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const plan = { id: 'error-test', steps: [] };
      const result = await tool.execute({ plan });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });
});