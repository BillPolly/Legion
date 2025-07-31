/**
 * Integration test for complete plan validation flow
 */

import { jest } from '@jest/globals';
import { PlanExecutorModule } from '../../PlanExecutorModule.js';
import { PlanExecutor } from '../../core/PlanExecutor.js';
import { PlanToolRegistry } from '../../core/PlanToolRegistry.js';
import { PlanInspectorTool } from '../../tools/PlanInspectorTool.js';

describe('Plan Validation Integration Flow', () => {
  let planExecutorModule;
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    // Create mocks
    mockResourceManager = {
      initialized: true,
      initialize: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      register: jest.fn(),
      findProjectRoot: jest.fn().mockReturnValue('/mock/project/root')
    };

    mockModuleFactory = {
      createModule: jest.fn()
    };

    // Manually create the module to control dependencies
    planExecutorModule = new PlanExecutorModule({
      resourceManager: mockResourceManager,
      moduleFactory: mockModuleFactory
    });
  });

  describe('Plan validation with tool checking', () => {
    it('should reject plan when validated plan uses non-existent tools', async () => {
      // Arrange - Set up registry with some tools
      planExecutorModule.planToolRegistry.moduleLoader.toolRegistry.set('command_executor', {
        name: 'command_executor',
        execute: jest.fn()
      });
      
      // Plan that uses a tool that doesn't exist
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated', // Already marked as validated
        metadata: { requiredModules: ['file'] },
        steps: [{
          id: 'step1',
          actions: [{
            id: 'action1',
            type: 'non_existent_tool',
            parameters: {}
          }]
        }]
      };

      // Get the plan executor tool
      const tools = planExecutorModule.getTools();
      const planExecutorTool = tools.find(t => t.name === 'plan_execute');

      // Act & Assert - Should fail during loadModulesForPlan
      await expect(planExecutorTool.execute({
        plan: plan,
        mode: 'sequential'
      })).resolves.toMatchObject({
        success: false,
        status: 'failed',
        error: expect.stringContaining('Required tools not found: non_existent_tool')
      });
    });

    it('should properly validate plan with plan_inspect before execution', async () => {
      // Arrange - Set up registry with required tool
      planExecutorModule.planToolRegistry.moduleLoader.toolRegistry.set('test_tool', {
        name: 'test_tool',
        execute: jest.fn().mockResolvedValue({ success: true })
      });

      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'draft', // Not validated yet
        metadata: {},
        steps: [{
          id: 'step1',
          actions: [{
            id: 'action1',
            type: 'test_tool',
            parameters: {}
          }]
        }]
      };

      // Get tools
      const tools = planExecutorModule.getTools();
      const planInspectorTool = tools.find(t => t.name === 'plan_inspect');
      const planExecutorTool = tools.find(t => t.name === 'plan_execute');

      // Act - Validate the plan
      const validationResult = await planInspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert validation results
      expect(validationResult.success).toBe(true);
      expect(validationResult.validation.isValid).toBe(true);
      expect(validationResult.toolAnalysis.toolStatus.test_tool).toEqual({
        available: true,
        module: 'loaded'
      });

      // Update plan status based on validation
      if (validationResult.validation.isValid) {
        plan.status = 'validated';
      }

      // Now execute the validated plan
      const executionResult = await planExecutorTool.execute({
        plan: plan,
        mode: 'sequential'
      });

      // Should succeed
      expect(executionResult.success).toBe(true);
      expect(executionResult.status).toBe('completed');
    });

    it('should fail validation when required tools are missing', async () => {
      // Arrange - No tools in registry
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'draft',
        metadata: {},
        steps: [{
          id: 'step1',
          actions: [
            { id: 'action1', type: 'missing_tool_1', parameters: {} },
            { id: 'action2', type: 'missing_tool_2', parameters: {} }
          ]
        }]
      };

      // Get plan inspector
      const tools = planExecutorModule.getTools();
      const planInspectorTool = tools.find(t => t.name === 'plan_inspect');

      // Act - Validate the plan
      const validationResult = await planInspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert
      expect(validationResult.success).toBe(true); // Validation process succeeded
      expect(validationResult.validation.isValid).toBe(false); // But plan is not valid
      expect(validationResult.validation.errors).toContain(
        'Required tools not available: missing_tool_1, missing_tool_2'
      );
      expect(validationResult.toolAnalysis.toolStatus).toEqual({
        missing_tool_1: { available: false, module: 'not found' },
        missing_tool_2: { available: false, module: 'not found' }
      });
    });

    it('should enforce validation status check during execution', async () => {
      // Arrange
      const planWithoutValidation = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'draft', // Not validated
        metadata: {},
        steps: [{
          id: 'step1',
          actions: [{ id: 'action1', type: 'any_tool', parameters: {} }]
        }]
      };

      const tools = planExecutorModule.getTools();
      const planExecutorTool = tools.find(t => t.name === 'plan_execute');

      // Act & Assert - Should fail validation status check
      await expect(planExecutorTool.execute({
        plan: planWithoutValidation,
        mode: 'sequential'
      })).resolves.toMatchObject({
        success: false,
        status: 'failed',
        error: expect.stringContaining('Plan must be validated before execution')
      });
    });
  });
});