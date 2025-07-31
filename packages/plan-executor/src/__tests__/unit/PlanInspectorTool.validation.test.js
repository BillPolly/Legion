/**
 * Tests for PlanInspectorTool validation with tool availability checking
 */

import { jest } from '@jest/globals';
import { PlanInspectorTool } from '../../tools/PlanInspectorTool.js';

describe('PlanInspectorTool Tool Validation', () => {
  let inspectorTool;
  let mockPlanToolRegistry;

  beforeEach(() => {
    // Create mock plan tool registry
    mockPlanToolRegistry = {
      hasTool: jest.fn()
    };

    // Create inspector tool with mock registry
    inspectorTool = new PlanInspectorTool(mockPlanToolRegistry);
  });

  describe('_analyzeTools', () => {
    it('should check tool availability when registry is provided', () => {
      // Arrange
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'tool1' },
              { type: 'tool2' }
            ]
          },
          {
            id: 'step2',
            actions: [
              { type: 'tool3' }
            ]
          }
        ]
      };

      mockPlanToolRegistry.hasTool
        .mockReturnValueOnce(true)   // tool1
        .mockReturnValueOnce(false)  // tool2
        .mockReturnValueOnce(true);  // tool3

      // Act
      const result = inspectorTool._analyzeTools(plan);

      // Assert
      expect(result.requiredTools).toEqual(['tool1', 'tool2', 'tool3']);
      expect(result.toolStatus).toEqual({
        tool1: { available: true, module: 'loaded' },
        tool2: { available: false, module: 'not found' },
        tool3: { available: true, module: 'loaded' }
      });
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledTimes(3);
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledWith('tool1');
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledWith('tool2');
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledWith('tool3');
    });

    it('should return unknown status when no registry provided', () => {
      // Arrange
      inspectorTool = new PlanInspectorTool(null); // No registry
      
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'tool1' }
            ]
          }
        ]
      };

      // Act
      const result = inspectorTool._analyzeTools(plan);

      // Assert
      expect(result.toolStatus).toEqual({
        tool1: { available: 'unknown', module: 'unknown' }
      });
    });

    it('should handle nested steps', () => {
      // Arrange
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'tool1' }],
            steps: [
              {
                id: 'nested1',
                actions: [{ type: 'tool2' }]
              }
            ]
          }
        ]
      };

      mockPlanToolRegistry.hasTool.mockReturnValue(true);

      // Act
      const result = inspectorTool._analyzeTools(plan);

      // Assert
      expect(result.requiredTools).toEqual(['tool1', 'tool2']);
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledWith('tool1');
      expect(mockPlanToolRegistry.hasTool).toHaveBeenCalledWith('tool2');
    });
  });

  describe('execute with validateTools', () => {
    it('should add validation errors for unavailable tools', async () => {
      // Arrange
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'available-tool' },
              { type: 'missing-tool' }
            ]
          }
        ]
      };

      mockPlanToolRegistry.hasTool
        .mockReturnValueOnce(true)   // available-tool
        .mockReturnValueOnce(false); // missing-tool

      // Act
      const result = await inspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Required tools not available: missing-tool');
      expect(result.toolAnalysis.toolStatus).toEqual({
        'available-tool': { available: true, module: 'loaded' },
        'missing-tool': { available: false, module: 'not found' }
      });
    });

    it('should handle multiple missing tools', async () => {
      // Arrange
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'tool1' },
              { type: 'tool2' },
              { type: 'tool3' }
            ]
          }
        ]
      };

      mockPlanToolRegistry.hasTool
        .mockReturnValueOnce(false)  // tool1
        .mockReturnValueOnce(true)   // tool2
        .mockReturnValueOnce(false); // tool3

      // Act
      const result = await inspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Required tools not available: tool1, tool3');
    });

    it('should not fail validation when all tools are available', async () => {
      // Arrange
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'tool1' },
              { type: 'tool2' }
            ]
          }
        ]
      };

      mockPlanToolRegistry.hasTool.mockReturnValue(true); // All tools available

      // Act
      const result = await inspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });

    it('should not validate tools when validateTools is false', async () => {
      // Arrange
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'any-tool' }]
          }
        ]
      };

      // Act
      const result = await inspectorTool.execute({
        plan: plan,
        validateTools: false
      });

      // Assert
      expect(result.toolAnalysis).toBeNull();
      expect(mockPlanToolRegistry.hasTool).not.toHaveBeenCalled();
    });

    it('should combine tool validation errors with other validation errors', async () => {
      // Arrange
      const plan = {
        // Missing required id field
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'missing-tool' }]
          }
        ]
      };

      mockPlanToolRegistry.hasTool.mockReturnValue(false);

      // Act
      const result = await inspectorTool.execute({
        plan: plan,
        validateTools: true
      });

      // Assert
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Plan missing required id field');
      expect(result.validation.errors).toContain('Required tools not available: missing-tool');
      expect(result.validation.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});