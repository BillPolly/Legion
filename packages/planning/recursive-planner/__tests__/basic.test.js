/**
 * Basic tests for the framework
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import RecursivePlanner from '../src/index.js';

// Create instance of RecursivePlanner
const planner = new RecursivePlanner();

const {
  PlanningAgent,
  AgentConfig,
  AtomicTool,
  strategies: { SequentialPlanningStrategy },
  factories: { createPlanningAgent, createTool },
  utils: { IdGenerator, ValidationUtils }
} = planner;

describe('Core Framework Components', () => {
  describe('IdGenerator', () => {
    beforeEach(() => {
      IdGenerator.resetCounter();
    });

    test('should generate unique step IDs', () => {
      const id1 = IdGenerator.generateStepId();
      const id2 = IdGenerator.generateStepId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^step_\d+_\d+$/);
    });

    test('should generate span IDs', () => {
      const spanId = IdGenerator.generateSpanId();
      expect(spanId).toMatch(/^span_[A-Za-z0-9]{16}$/);
    });

    test('should generate trace IDs', () => {
      const traceId = IdGenerator.generateTraceId();
      expect(traceId).toMatch(/^trace_[A-Za-z0-9]{32}$/);
    });
  });

  describe('ValidationUtils', () => {
    test('should validate required fields', () => {
      expect(() => ValidationUtils.required(null, 'test')).toThrow();
      expect(() => ValidationUtils.required(undefined, 'test')).toThrow();
      expect(() => ValidationUtils.required('value', 'test')).not.toThrow();
    });

    test('should validate non-empty strings', () => {
      expect(() => ValidationUtils.nonEmptyString('', 'test')).toThrow();
      expect(() => ValidationUtils.nonEmptyString('  ', 'test')).toThrow();
      expect(() => ValidationUtils.nonEmptyString('valid', 'test')).not.toThrow();
    });

    test('should validate positive numbers', () => {
      expect(() => ValidationUtils.positiveNumber(0, 'test')).toThrow();
      expect(() => ValidationUtils.positiveNumber(-1, 'test')).toThrow();
      expect(() => ValidationUtils.positiveNumber(1, 'test')).not.toThrow();
    });
  });

  describe('AtomicTool', () => {
    test('should create and execute a simple tool', async () => {
      const tool = new AtomicTool(
        'testTool',
        'A test tool',
        async (input) => {
          return { result: input.value * 2 };
        }
      );

      const result = await tool.run({ value: 5 });
      expect(result).toEqual({ result: 10 });
    });

    test('should handle tool execution errors', async () => {
      const tool = new AtomicTool(
        'errorTool',
        'A tool that throws errors',
        async (input) => {
          throw new Error('Test error');
        }
      );

      await expect(tool.run({})).rejects.toThrow('Tool errorTool execution failed');
    });

    test('should track metrics', async () => {
      const tool = new AtomicTool(
        'metricsTool',
        'Tool for testing metrics',
        async (input) => {
          return { success: true };
        }
      );

      await tool.run({});
      await tool.run({});

      const metrics = tool.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.getSuccessRate()).toBe(1);
    });
  });

  describe('PlanningAgent', () => {
    test('should create agent with configuration', () => {
      const config = new AgentConfig({
        name: 'TestAgent',
        description: 'Test agent'
      });

      const agent = new PlanningAgent(config);
      expect(agent.name).toBe('TestAgent');
      expect(agent.description).toBe('Test agent');
    });

    test('should execute with sequential planning strategy', async () => {
      const tool = createTool(
        'simpleTask',
        'Execute a simple task',
        async (input) => {
          return { completed: true, goal: input.goal };
        }
      );

      const agent = createPlanningAgent({
        name: 'TestAgent',
        planningStrategy: new SequentialPlanningStrategy('simpleTask')
      });

      const result = await agent.run('Test goal', [tool]);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(1);
      expect(result.result.totalSteps).toBe(1);
    });

    test('should handle planning errors', async () => {
      const agent = createPlanningAgent({
        name: 'TestAgent',
        planningStrategy: new SequentialPlanningStrategy('nonExistentTool')
      });

      const result = await agent.run('Test goal', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Factory Functions', () => {
    test('createPlanningAgent should create agent with defaults', () => {
      const agent = createPlanningAgent();
      expect(agent.name).toBe('QuickStartAgent');
      expect(agent.planningStrategy).toBeInstanceOf(SequentialPlanningStrategy);
    });

    test('createTool should create tool with configuration', () => {
      const tool = createTool(
        'factoryTool',
        'Tool created by factory',
        async () => ({ success: true }),
        { timeout: 5000 }
      );

      expect(tool.name).toBe('factoryTool');
      expect(tool.config.timeout).toBe(5000);
    });
  });
});

describe('Integration Tests', () => {
  test('should complete a multi-step workflow', async () => {
    // Create tools for a simple workflow
    const step1 = createTool('step1', 'First step', async (input) => {
      return { step: 1, data: input.data, processed: true };
    });

    const step2 = createTool('step2', 'Second step', async (input) => {
      return { step: 2, data: input.data, doubled: input.data * 2 };
    });

    // Create agent
    const agent = createPlanningAgent({
      name: 'WorkflowAgent',
      planningStrategy: new SequentialPlanningStrategy('step1')
    });

    // Execute workflow
    const result = await agent.run('Process data: 42', [step1, step2]);

    expect(result.success).toBe(true);
  });

  test('should handle tool failures gracefully', async () => {
    const failingTool = createTool(
      'failingTool',
      'Tool that fails',
      async () => {
        throw new Error('Intentional failure');
      }
    );

    const agent = createPlanningAgent({
      name: 'FailureTestAgent',
      planningStrategy: new SequentialPlanningStrategy('failingTool')
    });

    const result = await agent.run('Test failure handling', [failingTool]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.partialResult).toBeDefined();
  });
});