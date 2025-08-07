/**
 * Integration tests for PlanToBTConverter
 * Tests conversion of linear plans to BT format and execution
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanToBTConverter } from '../../src/integration/PlanToBTConverter.js';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.executionOrder = [];
  }

  async getTool(toolName) {
    this.executionOrder.push(toolName);
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  getExecutionOrder() {
    return this.executionOrder;
  }

  resetExecutionOrder() {
    this.executionOrder = [];
  }
}

// Mock tool factory
const createMockTool = (name, behavior = 'success') => ({
  name,
  async execute(params) {
    if (behavior === 'success') {
      return {
        success: true,
        data: {
          result: `${name} completed`,
          params,
          executedAt: Date.now()
        }
      };
    } else if (behavior === 'failure') {
      return {
        success: false,
        data: {
          error: `${name} failed`,
          params
        }
      };
    }
    throw new Error(`${name} error`);
  },
  getMetadata() {
    return {
      name,
      description: `Mock tool ${name}`
    };
  }
});

describe('PlanToBTConverter Integration Tests', () => {
  let toolRegistry;
  let executor;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);

    // Register mock tools
    toolRegistry.registerTool('analyzeCode', createMockTool('analyzeCode'));
    toolRegistry.registerTool('generateTests', createMockTool('generateTests'));
    toolRegistry.registerTool('runTests', createMockTool('runTests'));
    toolRegistry.registerTool('generateReport', createMockTool('generateReport'));
    toolRegistry.registerTool('validateData', createMockTool('validateData'));
    toolRegistry.registerTool('processData', createMockTool('processData'));
  });

  describe('Basic Plan Conversion', () => {
    test('should convert simple linear plan to BT sequence', () => {
      const plan = [
        { id: 'step1', tool: 'analyzeCode', params: { file: 'main.js' } },
        { id: 'step2', tool: 'generateTests', params: { coverage: 80 } },
        { id: 'step3', tool: 'runTests', params: { verbose: true } }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.type).toBe('sequence');
      expect(btConfig.children).toHaveLength(3);
      expect(btConfig.children[0].tool).toBe('analyzeCode');
      expect(btConfig.children[1].tool).toBe('generateTests');
      expect(btConfig.children[2].tool).toBe('runTests');
    });

    test('should preserve step IDs and parameters', () => {
      const plan = [
        {
          id: 'analyze',
          tool: 'analyzeCode',
          params: { 
            file: 'app.js',
            depth: 3,
            includeTests: true
          }
        }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.children[0].id).toBe('analyze');
      expect(btConfig.children[0].params.file).toBe('app.js');
      expect(btConfig.children[0].params.depth).toBe(3);
      expect(btConfig.children[0].params.includeTests).toBe(true);
    });

    test('should handle empty plan', () => {
      const plan = [];
      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.type).toBe('sequence');
      expect(btConfig.children).toHaveLength(0);
      expect(btConfig.description).toBe('Converted linear plan');
    });

    test('should handle plan with descriptions', () => {
      const plan = [
        {
          id: 'step1',
          tool: 'analyzeCode',
          description: 'Analyze the codebase for issues'
        },
        {
          id: 'step2',
          tool: 'generateReport',
          description: 'Generate analysis report'
        }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.children[0].description).toBe('Analyze the codebase for issues');
      expect(btConfig.children[1].description).toBe('Generate analysis report');
    });
  });

  describe('Plan Execution as BT', () => {
    test('should execute converted plan successfully', async () => {
      const plan = [
        { id: 'step1', tool: 'validateData', params: { strict: true } },
        { id: 'step2', tool: 'processData', params: { mode: 'fast' } },
        { id: 'step3', tool: 'generateReport', params: { format: 'pdf' } }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);
      const result = await executor.executeTree(btConfig, {});

      expect(result.success).toBe(true);
      expect(result.status).toBe(NodeStatus.SUCCESS);
      
      // Verify execution order
      const executionOrder = toolRegistry.getExecutionOrder();
      expect(executionOrder).toEqual(['validateData', 'processData', 'generateReport']);
    });

    test('should stop execution on failure in sequence', async () => {
      // Register a failing tool
      toolRegistry.registerTool('failingStep', createMockTool('failingStep', 'failure'));

      const plan = [
        { id: 'step1', tool: 'validateData' },
        { id: 'step2', tool: 'failingStep' },  // This will fail
        { id: 'step3', tool: 'generateReport' } // This should not execute
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);
      const result = await executor.executeTree(btConfig, {});

      expect(result.success).toBe(false);
      expect(result.status).toBe(NodeStatus.FAILURE);
      
      // Verify step3 was not executed
      const executionOrder = toolRegistry.getExecutionOrder();
      expect(executionOrder).toEqual(['validateData', 'failingStep']);
      expect(executionOrder).not.toContain('generateReport');
    });

    test('should pass context through plan steps', async () => {
      const plan = [
        { id: 'step1', tool: 'analyzeCode', params: { file: '{{inputFile}}' } },
        { id: 'step2', tool: 'generateTests', params: { target: '{{targetModule}}' } }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);
      const context = {
        inputFile: 'app.js',
        targetModule: 'UserService'
      };

      const result = await executor.executeTree(btConfig, context);

      expect(result.success).toBe(true);
      expect(result.context.inputFile).toBe('app.js');
      expect(result.context.targetModule).toBe('UserService');
    });
  });

  describe('Advanced Plan Conversion', () => {
    test('should convert plan with options to BT with metadata', () => {
      const plan = [
        { id: 'step1', tool: 'analyzeCode' },
        { id: 'step2', tool: 'generateTests' }
      ];

      const options = {
        description: 'Code analysis workflow',
        timeout: 5000,
        retryOnFailure: true
      };

      const btConfig = PlanToBTConverter.convertPlanToBT(plan, options);

      expect(btConfig.description).toBe('Code analysis workflow');
      expect(btConfig.timeout).toBe(5000);
      expect(btConfig.retryOnFailure).toBe(true);
    });

    test('should support conversion to different coordination patterns', () => {
      const plan = [
        { id: 'option1', tool: 'processData', params: { method: 'fast' } },
        { id: 'option2', tool: 'processData', params: { method: 'accurate' } }
      ];

      // Convert to selector (try until one succeeds)
      const selectorConfig = PlanToBTConverter.convertPlanToSelector(plan);
      
      expect(selectorConfig.type).toBe('selector');
      expect(selectorConfig.children).toHaveLength(2);
      expect(selectorConfig.children[0].tool).toBe('processData');
      expect(selectorConfig.children[0].params.method).toBe('fast');
    });

    test('should handle nested plan structures', () => {
      const plan = [
        {
          id: 'phase1',
          type: 'group',
          steps: [
            { id: 'step1a', tool: 'validateData' },
            { id: 'step1b', tool: 'processData' }
          ]
        },
        { id: 'step2', tool: 'generateReport' }
      ];

      const btConfig = PlanToBTConverter.convertNestedPlanToBT(plan);

      expect(btConfig.type).toBe('sequence');
      expect(btConfig.children).toHaveLength(2);
      expect(btConfig.children[0].type).toBe('sequence'); // Nested sequence
      expect(btConfig.children[0].children).toHaveLength(2);
      expect(btConfig.children[1].tool).toBe('generateReport');
    });
  });

  describe('BT Tool Creation from Plan', () => {
    test('should create executable BT tool from plan', async () => {
      const plan = [
        { id: 'step1', tool: 'analyzeCode', params: { depth: 2 } },
        { id: 'step2', tool: 'generateReport', params: { format: 'html' } }
      ];

      const btConfig = {
        name: 'AnalysisWorkflow',
        description: 'Automated code analysis',
        input: {
          targetFile: { type: 'string', required: true }
        },
        implementation: PlanToBTConverter.convertPlanToBT(plan)
      };

      const btTool = new BehaviorTreeTool(btConfig, toolRegistry);
      const result = await btTool.execute({ targetFile: 'main.js' });

      expect(result.success).toBe(true);
      
      // Verify both steps executed
      const executionOrder = toolRegistry.getExecutionOrder();
      expect(executionOrder).toContain('analyzeCode');
      expect(executionOrder).toContain('generateReport');
    });

    test('should preserve plan metadata in BT tool', () => {
      const plan = [
        {
          id: 'validation',
          tool: 'validateData',
          description: 'Validate input data',
          params: { strict: true }
        }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);
      const btTool = new BehaviorTreeTool({
        name: 'ValidationTool',
        implementation: btConfig
      }, toolRegistry);

      const metadata = btTool.getMetadata();
      
      expect(metadata.name).toBe('ValidationTool');
      expect(metadata.toolType).toBe('behavior-tree');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid plan format', () => {
      const invalidPlans = [
        null,
        undefined,
        'not-an-array',
        123,
        { notAPlan: true }
      ];

      for (const invalidPlan of invalidPlans) {
        expect(() => {
          PlanToBTConverter.convertPlanToBT(invalidPlan);
        }).toThrow('Plan must be an array');
      }
    });

    test('should handle plan steps without tools', () => {
      const plan = [
        { id: 'step1', tool: 'analyzeCode' },
        { id: 'step2' }, // Missing tool
        { id: 'step3', tool: 'generateReport' }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);
      
      // Should still convert but with undefined tool for step2
      expect(btConfig.children).toHaveLength(3);
      expect(btConfig.children[1].tool).toBeUndefined();
    });

    test('should generate IDs for steps without them', () => {
      const plan = [
        { tool: 'analyzeCode' },      // No ID
        { id: 'step2', tool: 'runTests' },
        { tool: 'generateReport' }     // No ID
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.children[0].id).toMatch(/^step_0$/);
      expect(btConfig.children[1].id).toBe('step2');
      expect(btConfig.children[2].id).toMatch(/^step_2$/);
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large plans efficiently', () => {
      // Create a large plan with many steps
      const largePlan = Array.from({ length: 100 }, (_, i) => ({
        id: `step_${i}`,
        tool: `tool_${i % 5}`, // Cycle through 5 tools
        params: { index: i }
      }));

      const startTime = Date.now();
      const btConfig = PlanToBTConverter.convertPlanToBT(largePlan);
      const conversionTime = Date.now() - startTime;

      expect(btConfig.children).toHaveLength(100);
      expect(conversionTime).toBeLessThan(100); // Should convert quickly
    });

    test('should preserve parameter references in conversion', () => {
      const plan = [
        {
          id: 'step1',
          tool: 'processData',
          params: {
            input: '{{previousResult}}',
            config: '{{globalConfig}}',
            nested: {
              value: '{{nested.param}}'
            }
          }
        }
      ];

      const btConfig = PlanToBTConverter.convertPlanToBT(plan);

      expect(btConfig.children[0].params.input).toBe('{{previousResult}}');
      expect(btConfig.children[0].params.config).toBe('{{globalConfig}}');
      expect(btConfig.children[0].params.nested.value).toBe('{{nested.param}}');
    });
  });
});