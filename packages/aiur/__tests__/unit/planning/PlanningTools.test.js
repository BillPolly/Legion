/**
 * Tests for Planning Tools
 * 
 * Tests basic planning tools for plan creation, execution, and status management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlanningTools } from '../../../src/planning/PlanningTools.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { PlanExecutor } from '../../../src/planning/PlanExecutor.js';

describe('PlanningTools', () => {
  let handleRegistry;
  let toolRegistry;
  let planExecutor;
  let planningTools;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry();
    planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
    planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);

    // Register some test tools
    const testTools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        execute: async (params) => ({ result: `Hello ${params.name || 'World'}` })
      },
      {
        name: 'math_add',
        description: 'Add two numbers',
        execute: async (params) => ({ sum: params.a + params.b })
      }
    ];

    toolRegistry.registerTools(testTools);
  });

  describe('Tool Registration', () => {
    test('should register all planning tools', () => {
      const tools = planningTools.getTools();
      
      expect(tools).toHaveProperty('plan_create');
      expect(tools).toHaveProperty('plan_execute');
      expect(tools).toHaveProperty('plan_status');
      expect(tools).toHaveProperty('plan_validate');
    });

    test('should register tools with proper schemas', () => {
      const tools = planningTools.getTools();
      
      for (const [name, tool] of Object.entries(tools)) {
        expect(tool.name).toBe(name);
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });

    test('should integrate with MCP server', () => {
      const mockServer = {
        addTool: jest.fn()
      };

      planningTools.registerWithMCPServer(mockServer);

      expect(mockServer.addTool).toHaveBeenCalledTimes(4);
    });
  });

  describe('plan_create tool', () => {
    test('should create simple plan', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({
        title: 'Test Plan',
        description: 'A simple test plan',
        steps: [
          {
            id: 'step1',
            title: 'Say hello',
            action: 'test_tool',
            parameters: { name: 'Alice' }
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan.id).toBeDefined();
      expect(result.plan.title).toBe('Test Plan');
      expect(result.plan.steps).toHaveLength(1);
      expect(handleRegistry.existsByName(result.planHandle)).toBe(true);
    });

    test('should create plan with dependencies', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({
        title: 'Math Plan',
        steps: [
          {
            id: 'add1',
            action: 'math_add',
            parameters: { a: 5, b: 3 },
            expectedOutputs: ['sum1']
          },
          {
            id: 'add2',
            action: 'math_add',
            parameters: { a: '@sum1', b: 2 },
            expectedOutputs: ['result'],
            dependsOn: ['add1']
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.plan.steps).toHaveLength(2);
      expect(result.plan.steps[1].dependsOn).toEqual(['add1']);
    });

    test('should validate plan during creation', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({
        title: 'Invalid Plan',
        steps: [
          {
            id: 'invalid',
            action: 'nonexistent_tool',
            parameters: {}
          }
        ],
        validateOnCreate: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });

    test('should generate plan ID if not provided', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({
        title: 'Auto ID Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: {}
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.plan.id).toBeDefined();
      expect(result.plan.id).toMatch(/^plan-/);
    });

    test('should handle auto checkpoint configuration', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({
        title: 'Checkpoint Plan',
        steps: [{ id: 'step1', action: 'test_tool', parameters: {} }],
        options: {
          autoCheckpoint: true,
          maxCheckpoints: 5
        }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('plan_execute tool', () => {
    let testPlanHandle;
    
    beforeEach(async () => {
      // Create a test plan first
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Execution Test Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: { name: 'Execute' },
            expectedOutputs: ['greeting']
          },
          {
            id: 'step2',
            action: 'math_add',
            parameters: { a: 1, b: 2 },
            expectedOutputs: ['sum']
          }
        ]
      });

      testPlanHandle = planResult.planHandle;
    });

    test('should execute plan successfully', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: testPlanHandle
      });

      expect(result.success).toBe(true);
      expect(result.execution.success).toBe(true);
      expect(result.execution.completedSteps).toHaveLength(2);
      expect(result.execution.failedSteps).toHaveLength(0);
    });

    test('should execute plan by plan reference', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        plan: `@${testPlanHandle}`
      });

      expect(result.success).toBe(true);
      expect(result.execution.success).toBe(true);
    });

    test('should handle execution with custom options', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: testPlanHandle,
        options: {
          parallel: false,
          stopOnError: true,
          timeout: 60000
        }
      });

      expect(result.success).toBe(true);
    });

    test('should handle plan execution failure', async () => {
      // Create a plan with failing step
      const createTool = planningTools.getTools().plan_create;
      const failPlanResult = await createTool.execute({
        title: 'Fail Plan',
        steps: [
          {
            id: 'fail-step',
            action: 'nonexistent_tool',
            parameters: {}
          }
        ],
        validateOnCreate: false
      });

      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: failPlanResult.planHandle
      });

      expect(result.success).toBe(false);
      expect(result.execution.success).toBe(false);
      expect(result.execution.failedSteps).toHaveLength(1);
    });

    test('should handle missing plan', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: 'nonexistent-plan'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    test('should create execution result handle', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: testPlanHandle,
        saveAs: 'executionResult'
      });

      expect(result.success).toBe(true);
      expect(handleRegistry.existsByName('executionResult')).toBe(true);
      
      const executionHandle = handleRegistry.getByName('executionResult');
      expect(executionHandle.data.execution).toBeDefined();
    });
  });

  describe('plan_status tool', () => {
    let statusPlanHandle;
    
    beforeEach(async () => {
      // Create and partially execute a plan
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Status Test Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: { name: 'Status' }
          },
          {
            id: 'step2',
            action: 'math_add',
            parameters: { a: 1, b: 2 },
            dependsOn: ['step1']
          }
        ]
      });

      statusPlanHandle = planResult.planHandle;
      
      // Execute first step only
      const plan = handleRegistry.getByName(statusPlanHandle).data;
      await planExecutor.executeStep(plan, 'step1');
    });

    test('should get plan status', async () => {
      const statusTool = planningTools.getTools().plan_status;
      
      const result = await statusTool.execute({
        planHandle: statusPlanHandle
      });

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status.planId).toBeDefined();
      expect(result.status.currentStatus).toBeDefined();
      expect(result.progress).toBeDefined();
    });

    test('should include detailed information when requested', async () => {
      const statusTool = planningTools.getTools().plan_status;
      
      const result = await statusTool.execute({
        planHandle: statusPlanHandle,
        includeSteps: true,
        includeHandles: true,
        includeCheckpoints: true
      });

      expect(result.success).toBe(true);
      expect(result.steps).toBeDefined();
      expect(result.handles).toBeDefined();
      expect(result.checkpoints).toBeDefined();
    });

    test('should show execution progress', async () => {
      const statusTool = planningTools.getTools().plan_status;
      
      const result = await statusTool.execute({
        planHandle: statusPlanHandle
      });

      expect(result.success).toBe(true);
      expect(result.progress.completed).toBe(1);
      expect(result.progress.total).toBe(2);
      expect(result.progress.percentage).toBe(50);
    });

    test('should handle missing plan', async () => {
      const statusTool = planningTools.getTools().plan_status;
      
      const result = await statusTool.execute({
        planHandle: 'nonexistent-plan'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });
  });

  describe('plan_validate tool', () => {
    test('should validate valid plan', async () => {
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Valid Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: {}
          }
        ],
        validateOnCreate: false
      });

      const validateTool = planningTools.getTools().plan_validate;
      
      const result = await validateTool.execute({
        planHandle: planResult.planHandle
      });

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toEqual([]);
    });

    test('should detect validation issues', async () => {
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Invalid Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: {},
            dependsOn: ['nonexistent']
          }
        ],
        validateOnCreate: false
      });

      const validateTool = planningTools.getTools().plan_validate;
      
      const result = await validateTool.execute({
        planHandle: planResult.planHandle
      });

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate step dependencies', async () => {
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Dependency Plan',
        steps: [
          {
            id: 'step1',
            action: 'test_tool',
            parameters: {}
          },
          {
            id: 'step2',
            action: 'test_tool',
            parameters: {},
            dependsOn: ['step1']
          }
        ],
        validateOnCreate: false
      });

      const validateTool = planningTools.getTools().plan_validate;
      
      const result = await validateTool.execute({
        planHandle: planResult.planHandle,
        checkDependencies: true
      });

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
    });

    test('should check tool availability', async () => {
      const createTool = planningTools.getTools().plan_create;
      const planResult = await createTool.execute({
        title: 'Tool Check Plan',
        steps: [
          {
            id: 'step1',
            action: 'nonexistent_tool',
            parameters: {}
          }
        ],
        validateOnCreate: false
      });

      const validateTool = planningTools.getTools().plan_validate;
      
      const result = await validateTool.execute({
        planHandle: planResult.planHandle,
        checkToolAvailability: true
      });

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.some(e => e.includes('tool') || e.includes('available'))).toBe(true);
    });
  });

  describe('Integration and Error Handling', () => {
    test('should handle invalid parameters gracefully', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      const result = await createTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should provide helpful error messages', async () => {
      const executeTool = planningTools.getTools().plan_execute;
      
      const result = await executeTool.execute({
        planHandle: 'invalid-handle'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    test('should support plan chaining through handles', async () => {
      const createTool = planningTools.getTools().plan_create;
      
      // Create first plan
      const plan1Result = await createTool.execute({
        title: 'Plan 1',
        steps: [{
          id: 'step1',
          action: 'test_tool',
          parameters: { name: 'Plan1' },
          expectedOutputs: ['result1']
        }]
      });

      // Execute first plan
      const executeTool = planningTools.getTools().plan_execute;
      await executeTool.execute({ planHandle: plan1Result.planHandle });

      // Create second plan that uses output from first
      const plan2Result = await createTool.execute({
        title: 'Plan 2',
        steps: [{
          id: 'step2',
          action: 'test_tool',
          parameters: { name: '@result1' },
          expectedOutputs: ['result2']
        }],
        validateOnCreate: false
      });

      expect(plan2Result.success).toBe(true);
      expect(plan2Result.plan.steps[0].parameters.name).toBe('@result1');
    });

    test('should maintain plan registry for quick access', () => {
      const planRegistry = planningTools.getPlanRegistry();
      
      expect(planRegistry).toBeDefined();
      expect(typeof planRegistry.listPlans).toBe('function');
      expect(typeof planRegistry.getPlan).toBe('function');
    });
  });
});