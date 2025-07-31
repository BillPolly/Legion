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
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      
      expect(module).toBeInstanceOf(PlanExecutorModule);
      expect(module.resourceManager).toBe(mockResourceManager);
      expect(module.moduleFactory).toBe(mockModuleFactory);
      expect(module.executor).toBeDefined();
      expect(module.planExecutorTool).toBeDefined();
      expect(module.planInspectorTool).toBeDefined();
      expect(module.executionStatusTool).toBeDefined();
      expect(module.stepExecutorTool).toBeDefined();
      expect(module.debugExecutorTool).toBeDefined();
    });

    it('should have correct dependencies', () => {
      expect(PlanExecutorModule.dependencies).toEqual(['resourceManager', 'moduleFactory']);
    });
  });

  describe('getTools', () => {
    it('should return array with all six debugging tools', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(6);
      expect(tools[0]).toBe(module.planExecutorTool);
      expect(tools[1]).toBe(module.stepExecutorTool);
      expect(tools[2]).toBe(module.debugExecutorTool);
      expect(tools[3]).toBe(module.planInspectorTool);
      expect(tools[4]).toBe(module.planToMarkdownTool);
      expect(tools[5]).toBe(module.executionStatusTool);
    });

    it('should return tools with correct properties', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      const tools = module.getTools();
      
      // Check main execution tool
      const planExecuteTool = tools[0];
      expect(planExecuteTool.name).toBe('plan_execute');
      expect(planExecuteTool.description).toBe('Execute a plan using available Legion tools');
      expect(planExecuteTool.inputSchema).toBeDefined();
      expect(planExecuteTool.execute).toBeInstanceOf(Function);
      
      // Check debugging tools exist and have correct names
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('plan_execute');
      expect(toolNames).toContain('plan_execute_step');
      expect(toolNames).toContain('plan_debug');
      expect(toolNames).toContain('plan_inspect');
      expect(toolNames).toContain('plan_status');
    });
  });

  describe('dependency injection', () => {
    it('should store dependencies and create moduleLoader', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      
      expect(module.resourceManager).toBe(mockResourceManager);
      expect(module.moduleFactory).toBe(mockModuleFactory);
      expect(module.executor.moduleLoader).toBeDefined();
    });

    it('should initialize with correct dependency list', () => {
      expect(PlanExecutorModule.dependencies).toEqual(['resourceManager', 'moduleFactory']);
    });
  });

  describe('integration', () => {
    it('should create fully functional tool', async () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      const tool = module.getTools()[0];

      // Mock the executor's module loader
      module.executor.moduleLoader.initialize = jest.fn().mockResolvedValue();
      module.executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'test result' })
      });

      const plan = {
        id: 'integration-test',
        status: 'validated',
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
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      const tool = module.getTools()[0];

      // Mock the executor to throw an error
      module.executor.executePlan = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const plan = { id: 'error-test', status: 'validated', steps: [] };
      const result = await tool.execute({ plan });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('helper methods', () => {
    it('should get tool by name', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      
      const planExecuteTool = module.getTool('plan_execute');
      expect(planExecuteTool).toBe(module.planExecutorTool);
      
      const planInspectTool = module.getTool('plan_inspect');
      expect(planInspectTool).toBe(module.planInspectorTool);
      
      const nonExistentTool = module.getTool('nonexistent');
      expect(nonExistentTool).toBeUndefined();
    });

    it('should create execution context for plan', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      const mockPlan = { id: 'test-plan', steps: [] };
      
      const context = module.createExecutionContext(mockPlan);
      
      expect(context).toBeDefined();
      expect(module.executionContext).toBe(context);
      expect(context.plan).toBe(mockPlan);
    });

    it('should set up context registry for debugging tools', () => {
      const module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
      
      // All debugging tools should have access to execution context
      expect(module.executionStatusTool._getExecutionContext).toBeInstanceOf(Function);
      expect(module.stepExecutorTool._getExecutionContext).toBeInstanceOf(Function);
      expect(module.debugExecutorTool._getExecutionContext).toBeInstanceOf(Function);
      
      // Context should be created when accessed
      const context = module.executionStatusTool._getExecutionContext();
      expect(context).toBeDefined();
      expect(module.executionContext).toBe(context);
    });
  });
});