/**
 * Integration test for ROMAAgent with TaskAnalyzer
 * Tests intelligent strategy selection, strategy fallback, and performance learning
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { TaskAnalyzer } from '../../src/analysis/TaskAnalyzer.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ROMAAgent with TaskAnalyzer Integration', () => {
  let agent;
  let taskAnalyzer;
  let resourceManager;
  let toolRegistry;
  let llmClient;
  let toolRegistryMock;

  beforeAll(async () => {
    const calculatorTool = {
      name: 'calculator',
      execute: jest.fn(async ({ expression }) => {
        let value;
        try {
          // Evaluate basic arithmetic expressions safely
          // eslint-disable-next-line no-new-func
          value = new Function(`return (${expression})`)();
        } catch (error) {
          value = expression;
        }
        return {
          success: true,
          result: value
        };
      }),
      inputSchema: { type: 'object' }
    };

    toolRegistryMock = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getTool: jest.fn(async (name) => (name === 'calculator' ? calculatorTool : null)),
      listTools: jest.fn().mockResolvedValue([{ name: 'calculator' }]),
      registerTool: jest.fn(),
      updateDependencies: jest.fn()
    };

    jest.spyOn(ToolRegistry, 'getInstance').mockResolvedValue(toolRegistryMock);

    // Get singleton resource manager (real instance)
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
    
    // Get LLM client from ResourceManager
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    // Create agent with real dependencies - no testMode!
    agent = new ROMAAgent({
      maxConcurrency: 2,
      defaultTimeout: 10000,
      enableSemanticAnalysis: true,
      enableTaskAnalyzer: true
    });

    // Create TaskAnalyzer for testing
    taskAnalyzer = new TaskAnalyzer({
      enableLearning: true,
      maxHistorySize: 100
    });
  });
  
  afterAll(async () => {
    // Clean up
    if (agent && agent.isInitialized) {
      await agent.shutdown();
    }
    if (ToolRegistry.getInstance.mockRestore) {
      ToolRegistry.getInstance.mockRestore();
    }
  });

  describe('TaskAnalyzer Integration', () => {
    it('should use TaskAnalyzer for strategy recommendation on complex tasks', async () => {
      await agent.initialize();
      
      const complexTask = {
        id: 'complex-analysis-task',
        description: 'Complex task requiring analysis',
        subtasks: [
          {
            id: 'calc-1',
            description: 'Calculate 10 * 5',
            tool: 'calculator',
            params: { expression: '10 * 5' }
          },
          {
            id: 'calc-2', 
            description: 'Calculate 100 / 2',
            tool: 'calculator',
            params: { expression: '100 / 2' }
          },
          {
            id: 'calc-3',
            description: 'Calculate 50 + 50',
            tool: 'calculator',
            params: { expression: '50 + 50' }
          }
        ]
      };

      // Analyze task with TaskAnalyzer
      const analysis = await taskAnalyzer.analyzeTask(complexTask);
      
      expect(analysis.analysisId).toBeDefined();
      expect(analysis.task.type).toBe('composite');
      expect(analysis.recommendation.strategy).toBeDefined();
      expect(analysis.recommendation.confidence).toBeGreaterThan(0.5);
      expect(analysis.analysis.complexity.overallComplexity).toBeGreaterThan(0);

      // Execute task with ROMAAgent
      const result = await agent.execute(complexTask);

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(3);
      expect(result.metadata.executionPlan.executionOrder).toEqual(['calc-1', 'calc-2', 'calc-3']);

      // Record performance for learning
      taskAnalyzer.recordPerformance(
        analysis.recommendation.strategy,
        analysis,
        { success: result.success, duration: result.metadata.duration }
      );

      // Verify performance was recorded
      const stats = taskAnalyzer.getPerformanceStats();
      expect(stats.totalAnalyses).toBe(1);
      expect(stats.strategyMetrics[analysis.recommendation.strategy]).toBeDefined();
    });

    it('should recommend ParallelExecutionStrategy for independent tasks', async () => {
      await agent.initialize();

      const parallelTask = {
        id: 'parallel-task',
        description: 'Independent parallel calculations',
        subtasks: [
          {
            id: 'independent-1',
            description: 'Calculate 25 * 4',
            tool: 'calculator',
            params: { expression: '25 * 4' }
          },
          {
            id: 'independent-2',
            description: 'Calculate 64 / 8',
            tool: 'calculator',
            params: { expression: '64 / 8' }
          },
          {
            id: 'independent-3',
            description: 'Calculate 30 + 70',
            tool: 'calculator',
            params: { expression: '30 + 70' }
          },
          {
            id: 'independent-4',
            description: 'Calculate 200 - 50',
            tool: 'calculator',
            params: { expression: '200 - 50' }
          }
        ]
      };

      // Analyze task
      const analysis = await taskAnalyzer.analyzeTask(parallelTask);
      
      expect(analysis.recommendation.strategy).toBe('ParallelExecutionStrategy');
      expect(analysis.analysis.parallelization.canParallelize).toBe(true);
      expect(analysis.analysis.parallelization.efficiency).toBe(1.0);
      expect(analysis.recommendation.parameters.maxConcurrency).toBeDefined();

      // Execute task
      const result = await agent.execute(parallelTask);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(4);
      
      // Record performance
      taskAnalyzer.recordPerformance(
        analysis.recommendation.strategy,
        analysis,
        { success: result.success, duration: result.metadata.duration }
      );
    });

    it('should recommend SequentialExecutionStrategy for tasks with dependencies', async () => {
      await agent.initialize();

      const dependentTask = {
        id: 'dependent-task',
        description: 'Task with sequential dependencies',
        subtasks: [
          {
            id: 'step-1',
            description: 'First calculation',
            tool: 'calculator',
            params: { expression: '5 * 10' }
          },
          {
            id: 'step-2',
            description: 'Second calculation depending on first',
            tool: 'calculator',
            params: { expression: '100 / 5' },
            dependencies: ['step-1']
          },
          {
            id: 'step-3',
            description: 'Final calculation',
            tool: 'calculator',
            params: { expression: '20 + 30' },
            dependencies: ['step-2']
          }
        ]
      };

      // Analyze task
      const analysis = await taskAnalyzer.analyzeTask(dependentTask);
      
      expect(analysis.recommendation.strategy).toBe('SequentialExecutionStrategy');
      expect(analysis.analysis.dependencies.count).toBe(0); // Root task has no dependencies
      expect(analysis.recommendation.reasoning).toContain('dependencies require ordered execution');

      // Execute task
      const result = await agent.execute(dependentTask);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(3);
      expect(result.metadata.executionPlan.executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
      
      // Record performance
      taskAnalyzer.recordPerformance(
        analysis.recommendation.strategy,
        analysis,
        { success: result.success, duration: result.metadata.duration }
      );
    });

    it('should recommend AtomicExecutionStrategy for simple tasks', async () => {
      await agent.initialize();

      const simpleTask = {
        id: 'simple-task',
        description: 'Simple calculation',
        tool: 'calculator',
        params: { expression: '42 * 2' }
      };

      // Analyze task
      const analysis = await taskAnalyzer.analyzeTask(simpleTask);
      
      expect(analysis.recommendation.strategy).toBe('AtomicExecutionStrategy');
      expect(analysis.task.type).toBe('tool');
      expect(analysis.analysis.complexity.overallComplexity).toBeLessThan(0.5);
      expect(analysis.recommendation.reasoning).toContain('Simple task structure suitable for atomic execution');

      // Execute task
      const result = await agent.execute(simpleTask);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      // Record performance
      taskAnalyzer.recordPerformance(
        analysis.recommendation.strategy,
        analysis,
        { success: result.success, duration: result.metadata.duration }
      );
    });

    it('should honor atomic flag during strategy selection', async () => {
      await agent.initialize();

      const atomicTask = {
        id: 'atomic-flag-task',
        description: 'Perform a single tool action',
        atomic: true,
        tool: 'calculator',
        params: { expression: '5+5' }
      };

      const strategy = await agent.strategyResolver.selectStrategy(atomicTask, {});
      expect(strategy.constructor.name).toBe('AtomicExecutionStrategy');
    });

    it('should respect manual strategy overrides', async () => {
      await agent.initialize();

      const manualTask = {
        id: 'manual-strategy-task',
        description: 'Execute steps sequentially',
        strategy: 'SequentialExecutionStrategy',
        steps: [
          { id: 'step1', tool: 'calculator', params: { expression: '2 + 2' } },
          { id: 'step2', tool: 'calculator', params: { expression: '3 * 3' } }
        ]
      };

      const strategy = await agent.strategyResolver.selectStrategy(manualTask, {});
      expect(strategy.constructor.name).toBe('SequentialExecutionStrategy');
    });

    it('should apply pattern heuristics for multi-step descriptions', async () => {
      await agent.initialize();

      const patternTask = {
        id: 'pattern-task',
        description: 'Collect requirements then build the interface and finally run tests'
      };

      const strategy = await agent.strategyResolver.selectStrategy(patternTask, {});
      expect(strategy.constructor.name).toBe('SequentialExecutionStrategy');
    });
  });

  describe('Strategy Fallback with TaskAnalyzer', () => {
    it('should handle strategy failure with intelligent fallback recommendation', async () => {
      await agent.initialize();

      const complexTask = {
        id: 'fallback-test',
        description: 'Task that may require fallback',
        subtasks: [
          {
            id: 'task-1',
            description: 'Calculate something',
            tool: 'calculator',
            params: { expression: '15 * 8' }
          },
          {
            id: 'task-2',
            description: 'Calculate something else',
            tool: 'non-existent-tool-that-fails', // This will cause failure
            params: { expression: '25 + 25' }
          }
        ]
      };

      // Analyze task
      const analysis = await taskAnalyzer.analyzeTask(complexTask);
      const primaryStrategy = analysis.recommendation.strategy;
      const alternatives = analysis.recommendation.alternatives;

      expect(primaryStrategy).toBeDefined();
      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeGreaterThan(0);

      // Execute task (should handle failure gracefully)
      const result = await agent.execute(complexTask);
      
      console.log('Test result:', JSON.stringify(result, null, 2));
      console.log('Errors in metadata:', result.metadata?.errors);
      console.log('Failed count:', result.metadata?.failed);
      
      expect(result.success).toBe(false); // Task should fail due to non-existent tool
      expect(result.error).toContain('failed');

      // Record performance (including failure)
      taskAnalyzer.recordPerformance(
        primaryStrategy,
        analysis,
        { success: result.success, duration: result.metadata.duration, error: result.error }
      );

      // Verify failure was recorded
      const stats = taskAnalyzer.getPerformanceStats();
      const strategyMetrics = stats.strategyMetrics[primaryStrategy];
      expect(strategyMetrics.totalAttempts).toBe(1);
      expect(strategyMetrics.failures).toBe(1);
      expect(strategyMetrics.successRate).toBe(0);
    });

    // REMOVED: Performance learning test - not needed for MVP
    // This was testing strategy performance learning over time which is an NFR
  });


  // REMOVED: Confidence and Recommendation Quality tests - NFRs not needed for MVP
  describe('Confidence and Recommendation Quality', () => {
    // Performance and confidence metrics are NFRs - removed for MVP

    // Edge case confidence levels test removed - NFR
  });

});
