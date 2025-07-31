/**
 * Unit tests for PlanExecutorTool
 */

import { PlanExecutorTool } from '../../tools/PlanExecutorTool.js';

describe('PlanExecutorTool', () => {
  let mockExecutor;
  let tool;

  beforeEach(() => {
    mockExecutor = {
      executePlan: jest.fn()
    };
    tool = new PlanExecutorTool(mockExecutor);
  });

  describe('constructor', () => {
    it('should create instance with executor', () => {
      expect(tool).toBeInstanceOf(PlanExecutorTool);
      expect(tool.executor).toBe(mockExecutor);
    });
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('plan_execute');
    });

    it('should have description', () => {
      expect(tool.description).toBe('Execute a plan using available Legion tools');
    });

    it('should have valid input schema', () => {
      const schema = tool.inputSchema;
      
      expect(schema).toBeDefined();
      expect(schema._def).toBeDefined(); // Zod schema
      // Test that the schema accepts the expected shape
      const validInput = { plan: { id: 'test', steps: [] }, options: {} };
      expect(() => schema.parse(validInput)).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should call executor.executePlan with parameters', async () => {
      const mockResult = {
        success: true,
        completedSteps: ['step1'],
        failedSteps: [],
        skippedSteps: [],
        stepResults: { step1: 'result' },
        statistics: { totalSteps: 1, executionTime: 1000 }
      };
      
      mockExecutor.executePlan.mockResolvedValue(mockResult);
      
      const params = {
        plan: { id: 'test', steps: [] },
        options: { timeout: 5000 }
      };
      
      const result = await tool.execute(params);
      
      expect(mockExecutor.executePlan.mock.calls.length).toBe(1);
      expect(mockExecutor.executePlan.mock.calls[0][0]).toBe(params.plan);
      expect(mockExecutor.executePlan.mock.calls[0][1]).toBe(params.options);
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1']);
    });

    it('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      mockExecutor.executePlan.mockRejectedValue(error);
      
      const params = { plan: { id: 'test', steps: [] } };
      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
      expect(result.completedSteps).toEqual([]);
    });

    it('should use default empty options when not provided', async () => {
      const mockResult = {
        success: true,
        completedSteps: [],
        failedSteps: [],
        skippedSteps: [],
        stepResults: {},
        statistics: { totalSteps: 0, executionTime: 100 }
      };
      
      mockExecutor.executePlan.mockResolvedValue(mockResult);
      
      const params = { plan: { id: 'test', steps: [] } };
      
      await tool.execute(params);
      
      expect(mockExecutor.executePlan.mock.calls[0][1]).toEqual({});
    });

    it('should map all result fields correctly', async () => {
      const mockResult = {
        success: true,
        completedSteps: ['step1', 'step2'],
        failedSteps: ['step3'],
        skippedSteps: ['step4'],
        stepResults: { step1: 'result1', step2: 'result2' },
        statistics: { totalSteps: 4, executionTime: 2500 },
        error: undefined
      };
      
      mockExecutor.executePlan.mockResolvedValue(mockResult);
      
      const params = { plan: { id: 'test', steps: [] } };
      const result = await tool.execute(params);
      
      expect(result).toEqual({
        success: true,
        status: 'completed',
        completedSteps: ['step1', 'step2'],
        failedSteps: ['step3'],
        skippedSteps: ['step4'],
        results: { step1: 'result1', step2: 'result2' },
        statistics: { totalSteps: 4, executionTime: 2500 },
        error: undefined
      });
    });

    it('should handle partial failure results', async () => {
      const mockResult = {
        success: false,
        completedSteps: ['step1'],
        failedSteps: ['step2'],
        skippedSteps: ['step3'],
        stepResults: { step1: 'result1' },
        statistics: { totalSteps: 3, executionTime: 1500 },
        error: 'Step 2 failed'
      };
      
      mockExecutor.executePlan.mockResolvedValue(mockResult);
      
      const params = { plan: { id: 'test', steps: [] } };
      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['step1']);
      expect(result.failedSteps).toEqual(['step2']);
      expect(result.skippedSteps).toEqual(['step3']);
      expect(result.error).toBe('Step 2 failed');
    });

    it('should handle complex plan structures', async () => {
      const complexPlan = {
        id: 'complex-test',
        name: 'Complex Test Plan',
        steps: [
          {
            id: 'parent1',
            steps: [
              {
                id: 'child1',
                actions: [{ type: 'tool1', parameters: { key: 'value' } }]
              }
            ]
          }
        ]
      };

      const mockResult = {
        success: true,
        completedSteps: ['child1', 'parent1'],
        failedSteps: [],
        skippedSteps: [],
        stepResults: { child1: 'child result', parent1: 'parent result' },
        statistics: { totalSteps: 2, executionTime: 800 }
      };
      
      mockExecutor.executePlan.mockResolvedValue(mockResult);
      
      const params = { 
        plan: complexPlan,
        options: { emitProgress: true, stopOnError: false }
      };
      
      const result = await tool.execute(params);
      
      expect(mockExecutor.executePlan.mock.calls[0][0]).toBe(complexPlan);
      expect(mockExecutor.executePlan.mock.calls[0][1]).toEqual({ emitProgress: true, stopOnError: false });
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['child1', 'parent1']);
    });
  });
});