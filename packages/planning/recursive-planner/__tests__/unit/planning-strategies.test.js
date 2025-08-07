/**
 * Unit tests for planning strategies
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { 
  PlanningStrategy,
  SequentialPlanningStrategy,
  TemplatePlanningStrategy,
  RuleBasedPlanningStrategy,
  LLMPlanningStrategy
} from '../../src/core/execution/planning/index.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';
import { PlanningError } from '../../src/foundation/types/errors/errors.js';
import { createTool } from '../../src/factories/ToolFactory.js';

describe('Planning Strategies', () => {
  let mockTools;

  beforeEach(() => {
    mockTools = [
      createTool('analyzeData', 'Analyze input data', async (input) => ({ analyzed: input })),
      createTool('processData', 'Process analyzed data', async (input) => ({ processed: input })),
      createTool('generateReport', 'Generate final report', async (input) => ({ report: input }))
    ];
  });

  describe('PlanningStrategy (Abstract Base)', () => {
    test('should not be instantiable directly', () => {
      expect(() => new PlanningStrategy()).toThrow('PlanningStrategy is abstract');
    });

    test('should require implementation of generatePlan', async () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      await expect(strategy.generatePlan('test goal', mockTools, {}))
        .rejects.toThrow('generatePlan method must be implemented');
    });

    test('should require implementation of replan', async () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      await expect(strategy.replan([], null, {}))
        .rejects.toThrow('replan method must be implemented');
    });

    test('should validate plan structure', () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      const validPlan = [
        new PlanStep('step1', 'First step', 'analyzeData', {}, [])
      ];
      
      expect(() => strategy.validatePlan(validPlan, mockTools)).not.toThrow();
    });

    test('should reject empty plans', () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      expect(() => strategy.validatePlan([], mockTools))
        .toThrow(PlanningError);
    });

    test('should reject plans with non-existent tools', () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      const invalidPlan = [
        new PlanStep('step1', 'First step', 'nonExistentTool', {}, [])
      ];
      
      expect(() => strategy.validatePlan(invalidPlan, mockTools))
        .toThrow('Tool not available: nonExistentTool');
    });

    test('should reject plans with duplicate step IDs', () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      const invalidPlan = [
        new PlanStep('step1', 'First step', 'analyzeData', {}, []),
        new PlanStep('step1', 'Duplicate step', 'processData', {}, [])
      ];
      
      expect(() => strategy.validatePlan(invalidPlan, mockTools))
        .toThrow('Duplicate step ID: step1');
    });

    test('should find parallel execution groups', () => {
      class TestStrategy extends PlanningStrategy {}
      const strategy = new TestStrategy();
      
      const plan = [
        new PlanStep('step1', 'Independent step 1', 'analyzeData', {}, []),
        new PlanStep('step2', 'Independent step 2', 'processData', {}, []),
        new PlanStep('step3', 'Depends on step1', 'generateReport', {}, ['step1']),
        new PlanStep('step4', 'Depends on step2', 'analyzeData', {}, ['step2'])
      ];
      
      const groups = strategy.findParallelGroups(plan);
      
      expect(groups).toHaveLength(2);
      expect(groups[0]).toContain('step1');
      expect(groups[0]).toContain('step2');
      expect(groups[1]).toContain('step3');
      expect(groups[1]).toContain('step4');
    });
  });

  describe('SequentialPlanningStrategy', () => {
    test('should create single-step plan with first available tool', async () => {
      const strategy = new SequentialPlanningStrategy();
      const plan = await strategy.generatePlan('Test goal', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(plan[0].tool).toBe('analyzeData');
      expect(plan[0].params.goal).toBe('Test goal');
    });

    test('should use default tool when specified', async () => {
      const strategy = new SequentialPlanningStrategy('processData');
      const plan = await strategy.generatePlan('Test goal', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(plan[0].tool).toBe('processData');
    });

    test('should fail when no tools available', async () => {
      const strategy = new SequentialPlanningStrategy();
      
      await expect(strategy.generatePlan('Test goal', [], {}))
        .rejects.toThrow('No tools available for planning');
    });

    test('should fail when default tool not available', async () => {
      const strategy = new SequentialPlanningStrategy('nonExistentTool');
      
      await expect(strategy.generatePlan('Test goal', mockTools, {}))
        .rejects.toThrow('Default tool not available: nonExistentTool');
    });

    test('should reset failed step on replan', async () => {
      const strategy = new SequentialPlanningStrategy();
      const originalPlan = [
        new PlanStep('step1', 'Failed step', 'analyzeData', {}, [])
      ];
      originalPlan[0].fail(new Error('Test failure'));
      
      const newPlan = await strategy.replan(originalPlan, originalPlan[0], {});
      
      expect(newPlan).toHaveLength(1);
      expect(newPlan[0].status).toBe('pending');
      expect(newPlan[0].error).toBeNull();
    });
  });

  describe('TemplatePlanningStrategy', () => {
    test('should create plan from matching template', async () => {
      const templates = {
        'data analysis': [
          { id: 'analyze', description: 'Analyze data', tool: 'analyzeData', params: { type: 'analysis' } },
          { id: 'process', description: 'Process results', tool: 'processData', params: { type: 'processing' }, dependencies: ['analyze'] }
        ]
      };
      
      const strategy = new TemplatePlanningStrategy(templates);
      const plan = await strategy.generatePlan('Perform data analysis', mockTools, {});
      
      expect(plan).toHaveLength(2);
      expect(plan[0].id).toBe('analyze');
      expect(plan[0].tool).toBe('analyzeData');
      expect(plan[1].dependencies).toContain('analyze');
    });

    test('should fail when no template matches', async () => {
      const strategy = new TemplatePlanningStrategy({});
      
      await expect(strategy.generatePlan('Unknown task', mockTools, {}))
        .rejects.toThrow('No template found for goal: Unknown task');
    });

    test('should fail when template requires unavailable tool', async () => {
      const templates = {
        'test': [
          { id: 'step1', description: 'Use missing tool', tool: 'missingTool', params: {} }
        ]
      };
      
      const strategy = new TemplatePlanningStrategy(templates);
      
      await expect(strategy.generatePlan('test task', mockTools, {}))
        .rejects.toThrow('Required tool not available: missingTool');
    });

    test('should add templates dynamically', async () => {
      const strategy = new TemplatePlanningStrategy();
      
      strategy.addTemplate('dynamic test', [
        { id: 'dynamic', description: 'Dynamic step', tool: 'analyzeData', params: {} }
      ]);
      
      const plan = await strategy.generatePlan('dynamic test', mockTools, {});
      expect(plan).toHaveLength(1);
      expect(plan[0].id).toBe('dynamic');
    });

    test('should match patterns case-insensitively', async () => {
      const templates = {
        'DATA ANALYSIS': [
          { id: 'analyze', description: 'Analyze data', tool: 'analyzeData', params: {} }
        ]
      };
      
      const strategy = new TemplatePlanningStrategy(templates);
      const plan = await strategy.generatePlan('perform data analysis', mockTools, {});
      
      expect(plan).toHaveLength(1);
    });
  });

  describe('RuleBasedPlanningStrategy', () => {
    test('should create plan using matching rules', async () => {
      const strategy = new RuleBasedPlanningStrategy();
      
      strategy.addRule(
        ({ goal }) => goal.includes('analysis'),
        () => [new PlanStep('rule1', 'Analysis step', 'analyzeData', {}, [])]
      );
      
      strategy.addRule(
        ({ goal }) => goal.includes('report'),
        () => [new PlanStep('rule2', 'Report step', 'generateReport', {}, ['rule1'])]
      );
      
      const plan = await strategy.generatePlan('Data analysis and report', mockTools, {});
      
      expect(plan).toHaveLength(2);
      expect(plan[0].tool).toBe('analyzeData');
      expect(plan[1].tool).toBe('generateReport');
      expect(plan[1].dependencies).toContain('rule1');
    });

    test('should fail when no rules match', async () => {
      const strategy = new RuleBasedPlanningStrategy();
      
      await expect(strategy.generatePlan('Unknown task', mockTools, {}))
        .rejects.toThrow('No rules generated steps for goal: Unknown task');
    });

    test('should handle rules that return single steps', async () => {
      const strategy = new RuleBasedPlanningStrategy();
      
      strategy.addRule(
        ({ goal }) => goal.toLowerCase().includes('simple'),
        () => new PlanStep('simple', 'Simple step', 'analyzeData', {}, [])
      );
      
      const plan = await strategy.generatePlan('Simple task', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(plan[0].id).toBe('simple');
    });

    test('should validate rule functions', () => {
      const strategy = new RuleBasedPlanningStrategy();
      
      expect(() => strategy.addRule('not a function', () => {}))
        .toThrow();
      
      expect(() => strategy.addRule(() => true, 'not a function'))
        .toThrow();
    });

    test('should include failure context in replanning', async () => {
      const strategy = new RuleBasedPlanningStrategy();
      
      let replanContext = null;
      strategy.addRule(
        (context) => {
          replanContext = context;
          return context.goal === 'test'; // Ensure rule matches
        },
        () => [new PlanStep('replan', 'Replan step', 'analyzeData', {}, [])]
      );
      
      const failedStep = new PlanStep('failed', 'Failed step', 'analyzeData', {}, []);
      failedStep.fail(new Error('Test failure'));
      
      await strategy.replan([], failedStep, { goal: 'test', tools: mockTools });
      
      expect(replanContext).toBeDefined();
      expect(replanContext.context.failedStep).toBe(failedStep);
      expect(replanContext.context.currentPlan).toEqual([]);
      expect(replanContext.goal).toBe('test');
    });
  });

  describe('LLMPlanningStrategy', () => {
    let mockLLM;

    beforeEach(() => {
      mockLLM = {
        complete: jest.fn()
      };
    });

    test('should create plan from LLM response', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM);
      
      const mockResponse = JSON.stringify([
        {
          id: 'llm_step_1',
          description: 'LLM generated step',
          tool: 'analyzeData',
          params: { input: 'test' },
          dependencies: []
        }
      ]);
      
      mockLLM.complete.mockResolvedValue(mockResponse);
      
      const plan = await strategy.generatePlan('Test LLM planning', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(plan[0].id).toBe('llm_step_1');
      expect(plan[0].tool).toBe('analyzeData');
      expect(plan[0].params.input).toBe('test');
    });

    test('should handle LLM response with markdown code blocks', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM);
      
      const mockResponse = `
Here's the plan:
\`\`\`json
[
  {
    "id": "step_1",
    "description": "First step",
    "tool": "analyzeData",
    "params": {},
    "dependencies": []
  }
]
\`\`\`
      `;
      
      mockLLM.complete.mockResolvedValue(mockResponse);
      
      const plan = await strategy.generatePlan('Test', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(plan[0].id).toBe('step_1');
    });

    test('should retry on LLM failures', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM, { maxRetries: 2 });
      
      const mockResponse = JSON.stringify([
        {
          id: 'retry_step',
          description: 'Retry step',
          tool: 'analyzeData',
          params: {},
          dependencies: []
        }
      ]);
      
      mockLLM.complete
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce(mockResponse);
      
      const plan = await strategy.generatePlan('Test retry', mockTools, {});
      
      expect(plan).toHaveLength(1);
      expect(mockLLM.complete).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM, { maxRetries: 1 });
      
      mockLLM.complete.mockRejectedValue(new Error('Persistent failure'));
      
      await expect(strategy.generatePlan('Test failure', mockTools, {}))
        .rejects.toThrow('LLM planning failed after 2 attempts');
    });

    test('should validate LLM response structure', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM);
      
      const invalidResponse = JSON.stringify([
        {
          // Missing required fields
          description: 'Invalid step'
        }
      ]);
      
      mockLLM.complete.mockResolvedValue(invalidResponse);
      
      await expect(strategy.generatePlan('Test validation', mockTools, {}))
        .rejects.toThrow("'id' must be a non-empty string");
    });

    test('should build comprehensive planning prompt', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM);
      
      const mockResponse = JSON.stringify([
        {
          id: 'prompt_test_step',
          description: 'Test step for prompt',
          tool: 'analyzeData',
          params: {},
          dependencies: []
        }
      ]);
      
      mockLLM.complete.mockResolvedValue(mockResponse);
      
      await strategy.generatePlan('Complex goal', mockTools, { 
        userPreference: 'fast execution' 
      });
      
      const promptCall = mockLLM.complete.mock.calls[0][0];
      expect(promptCall).toContain('Complex goal');
      expect(promptCall).toContain('analyzeData: Analyze input data');
      expect(promptCall).toContain('userPreference');
    });

    test('should handle replanning with context', async () => {
      const strategy = new LLMPlanningStrategy(mockLLM);
      
      const replanResponse = JSON.stringify([
        {
          id: 'replan_step',
          description: 'Replanned step',
          tool: 'processData',
          params: {},
          dependencies: []
        }
      ]);
      
      mockLLM.complete.mockResolvedValue(replanResponse);
      
      const currentPlan = [
        new PlanStep('completed', 'Completed step', 'analyzeData', {}, [])
      ];
      currentPlan[0].complete({ result: 'done' });
      
      const failedStep = new PlanStep('failed', 'Failed step', 'processData', {}, []);
      failedStep.fail(new Error('Step failed'));
      
      const newPlan = await strategy.replan(currentPlan, failedStep, {
        goal: 'Original goal',
        tools: mockTools
      });
      
      expect(newPlan).toHaveLength(1);
      expect(newPlan[0].id).toBe('replan_step');
      
      const replanPrompt = mockLLM.complete.mock.calls[0][0];
      expect(replanPrompt).toContain('Original goal');
      expect(replanPrompt).toContain('Completed steps (1)');
      expect(replanPrompt).toContain('Step failed');
    });

    test('should include examples in prompt when provided', async () => {
      const examples = [
        {
          goal: 'Example goal',
          plan: [{ id: 'ex1', description: 'Example step', tool: 'analyzeData' }]
        }
      ];
      
      const strategy = new LLMPlanningStrategy(mockLLM, { examples });
      
      const mockResponse = JSON.stringify([
        {
          id: 'example_test_step',
          description: 'Test step with examples',
          tool: 'analyzeData',
          params: {},
          dependencies: []
        }
      ]);
      
      mockLLM.complete.mockResolvedValue(mockResponse);
      
      await strategy.generatePlan('Test with examples', mockTools, {});
      
      const prompt = mockLLM.complete.mock.calls[0][0];
      expect(prompt).toContain('Example goal');
      expect(prompt).toContain('Example step');
    });

    test('should fail when no LLM provided', async () => {
      const strategy = new LLMPlanningStrategy(null);
      
      await expect(strategy.generatePlan('Test', mockTools, {}))
        .rejects.toThrow('LLM provider not configured for LLM planning strategy');
    });
  });

  describe('Plan Validation', () => {
    let strategy;

    beforeEach(() => {
      class TestStrategy extends PlanningStrategy {
        async generatePlan() { return []; }
        async replan() { return []; }
      }
      strategy = new TestStrategy();
    });

    test('should validate step dependencies exist', () => {
      const plan = [
        new PlanStep('step1', 'First step', 'analyzeData', {}, []),
        new PlanStep('step2', 'Second step', 'processData', {}, ['step1'])
      ];
      
      expect(() => strategy.validatePlan(plan, mockTools)).not.toThrow();
    });

    test('should reject invalid dependencies', () => {
      const plan = [
        new PlanStep('step1', 'First step', 'analyzeData', {}, ['nonexistent'])
      ];
      
      expect(() => strategy.validatePlan(plan, mockTools))
        .toThrow('Invalid dependency: nonexistent for step step1');
    });

    test('should handle complex dependency chains', () => {
      const plan = [
        new PlanStep('step1', 'First', 'analyzeData', {}, []),
        new PlanStep('step2', 'Second', 'processData', {}, ['step1']),
        new PlanStep('step3', 'Third', 'generateReport', {}, ['step1', 'step2'])
      ];
      
      expect(() => strategy.validatePlan(plan, mockTools)).not.toThrow();
    });
  });
});