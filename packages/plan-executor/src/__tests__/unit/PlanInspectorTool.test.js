/**
 * Tests for PlanInspectorTool
 * 
 * Tests static analysis tool for plan structure validation and dependency analysis
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanInspectorTool } from '../../tools/PlanInspectorTool.js';

describe('PlanInspectorTool', () => {
  let tool;
  let mockPlan;

  beforeEach(() => {
    tool = new PlanInspectorTool();
    
    mockPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      description: 'A test plan for validation',
      steps: [
        {
          id: 'step1',
          title: 'First Step',
          actions: [
            { type: 'file_read', parameters: { path: 'input.txt' } }
          ]
        },
        {
          id: 'step2',
          title: 'Second Step',
          dependencies: ['step1'],
          actions: [
            { type: 'file_write', parameters: { path: 'output.txt', content: '@step1' } }
          ]
        },
        {
          id: 'step3',
          title: 'Third Step',
          dependencies: ['step2'],
          steps: [
            {
              id: 'step3.1',
              title: 'Sub Step',
              actions: [
                { type: 'calculator_evaluate', parameters: { expression: '2 + 2' } }
              ]
            }
          ]
        }
      ]
    };
  });

  describe('Constructor and Schema', () => {
    test('should have correct name', () => {
      expect(tool.name).toBe('plan_inspect');
    });

    test('should have correct description', () => {
      expect(tool.description).toBe('Analyze plan structure and validate dependencies');
    });

    test('should have correct input schema', () => {
      const schema = tool.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.plan).toBeDefined();
      expect(schema.required).toContain('plan');
      expect(schema.properties.analyzeDepth).toBeDefined();
      expect(schema.properties.validateTools).toBeDefined();
      expect(schema.properties.showDependencies).toBeDefined();
    });
  });

  describe('Plan Structure Validation', () => {
    test('should validate correct plan structure', async () => {
      const result = await tool.execute({ plan: mockPlan });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.errors).toEqual([]);
    });

    test('should detect missing plan ID', async () => {
      const invalidPlan = { ...mockPlan };
      delete invalidPlan.id;
      
      const result = await tool.execute({ plan: invalidPlan });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Plan missing required id field');
    });

    test('should detect missing steps', async () => {
      const invalidPlan = { ...mockPlan };
      delete invalidPlan.steps;
      
      const result = await tool.execute({ plan: invalidPlan });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Plan missing steps array');
    });

    test('should detect steps without IDs', async () => {
      const invalidPlan = {
        ...mockPlan,
        steps: [
          { title: 'No ID Step', actions: [] }
        ]
      };
      
      const result = await tool.execute({ plan: invalidPlan });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Step at index 0 missing required id field');
    });
  });

  describe('Dependency Analysis and Cycle Detection', () => {
    test('should analyze dependency chains', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        showDependencies: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.dependencyAnalysis).toBeDefined();
      expect(result.dependencyAnalysis.chains).toBeDefined();
      expect(result.dependencyAnalysis.chains['step2']).toEqual(['step1']);
      expect(result.dependencyAnalysis.chains['step3']).toEqual(['step1', 'step2']);
    });

    test('should detect circular dependencies', async () => {
      const circularPlan = {
        id: 'circular-plan',
        steps: [
          {
            id: 'step1',
            dependencies: ['step2'],
            actions: [{ type: 'mock_action' }]
          },
          {
            id: 'step2',
            dependencies: ['step1'],
            actions: [{ type: 'mock_action' }]
          }
        ]
      };
      
      const result = await tool.execute({ 
        plan: circularPlan, 
        showDependencies: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Circular dependency detected: step1 -> step2 -> step1');
    });

    test('should detect invalid dependency references', async () => {
      const invalidDepPlan = {
        id: 'invalid-dep-plan',
        steps: [
          {
            id: 'step1',
            dependencies: ['nonexistent'],
            actions: [{ type: 'mock_action' }]
          }
        ]
      };
      
      const result = await tool.execute({ 
        plan: invalidDepPlan, 
        showDependencies: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors).toContain('Step step1 depends on nonexistent step: nonexistent');
    });
  });

  describe('Tool Availability Checking', () => {
    test('should report required tools', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        validateTools: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.toolAnalysis).toBeDefined();
      expect(result.toolAnalysis.requiredTools).toContain('file_read');
      expect(result.toolAnalysis.requiredTools).toContain('file_write');
      expect(result.toolAnalysis.requiredTools).toContain('calculator_evaluate');
    });

    test('should include tool availability status', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        validateTools: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.toolAnalysis.toolStatus).toBeDefined();
      expect(typeof result.toolAnalysis.toolStatus).toBe('object');
    });
  });

  describe('Complexity Metrics Calculation', () => {
    test('should calculate basic complexity metrics', async () => {
      const result = await tool.execute({ plan: mockPlan });
      
      expect(result.success).toBe(true);
      expect(result.complexity).toBeDefined();
      expect(result.complexity.totalSteps).toBeGreaterThan(0);
      expect(result.complexity.totalActions).toBeGreaterThan(0);
      expect(result.complexity.maxDepth).toBeGreaterThan(0);
      expect(result.complexity.dependencyCount).toBeGreaterThan(0);
    });

    test('should handle hierarchical complexity', async () => {
      const result = await tool.execute({ plan: mockPlan });
      
      expect(result.success).toBe(true);
      expect(result.complexity.maxDepth).toBe(2); // plan -> step3 -> step3.1
      expect(result.complexity.totalSteps).toBe(4); // step1, step2, step3, step3.1
    });
  });

  describe('Analysis Depth Options', () => {
    test('should support shallow analysis', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        analyzeDepth: 'shallow' 
      });
      
      expect(result.success).toBe(true);
      expect(result.analysis.depth).toBe('shallow');
      // Shallow analysis should not include sub-step details
    });

    test('should support deep analysis', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        analyzeDepth: 'deep' 
      });
      
      expect(result.success).toBe(true);
      expect(result.analysis.depth).toBe('deep');
      // Deep analysis should include all hierarchical details
    });

    test('should support complete analysis', async () => {
      const result = await tool.execute({ 
        plan: mockPlan, 
        analyzeDepth: 'complete' 
      });
      
      expect(result.success).toBe(true);
      expect(result.analysis.depth).toBe('complete');
      expect(result.hierarchicalStructure).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing plan parameter', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan parameter is required');
    });

    test('should handle invalid plan object', async () => {
      const result = await tool.execute({ plan: 'invalid' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan must be an object');
    });

    test('should handle null plan', async () => {
      const result = await tool.execute({ plan: null });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan cannot be null');
    });
  });
});