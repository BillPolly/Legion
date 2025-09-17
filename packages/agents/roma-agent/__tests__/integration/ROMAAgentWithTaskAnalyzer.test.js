/**
 * Integration test for ROMAAgent with TaskAnalyzer
 * Tests intelligent strategy selection, strategy fallback, and performance learning
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
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

  beforeAll(async () => {
    // Get singletons - real instances, no mocks!
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

    it('should learn from strategy performance over time', async () => {
      await agent.initialize();

      // Execute multiple similar tasks to build learning data
      const taskTemplate = {
        description: 'Learning test task',
        subtasks: [
          {
            id: 'calc-a',
            tool: 'calculator',
            params: { expression: '10 + 10' }
          },
          {
            id: 'calc-b', 
            tool: 'calculator',
            params: { expression: '20 - 5' }
          }
        ]
      };

      // Execute several similar tasks
      for (let i = 0; i < 3; i++) {
        const task = {
          ...taskTemplate,
          id: `learning-task-${i}`,
          subtasks: taskTemplate.subtasks.map(subtask => ({
            ...subtask,
            id: `${subtask.id}-${i}`
          }))
        };

        const analysis = await taskAnalyzer.analyzeTask(task);
        const result = await agent.execute(task);
        
        expect(result.success).toBe(true);
        
        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: result.success, duration: result.metadata.duration }
        );
      }

      // Analyze a new similar task
      const newTask = {
        ...taskTemplate,
        id: 'new-learning-task',
        subtasks: taskTemplate.subtasks.map(subtask => ({
          ...subtask,
          id: `${subtask.id}-new`
        }))
      };

      const finalAnalysis = await taskAnalyzer.analyzeTask(newTask);
      
      // Should have historical recommendations in alternatives
      const hasHistoricalAlternative = finalAnalysis.recommendation.alternatives.some(alt => 
        alt.reason.includes('Historical performance')
      );
      
      // If we have enough historical data, should include historical alternatives
      const stats = taskAnalyzer.getPerformanceStats();
      if (stats.totalAnalyses >= 3) {
        expect(hasHistoricalAlternative).toBe(true);
      }

      expect(finalAnalysis.recommendation.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Performance Learning Integration', () => {
    it('should build strategy performance metrics through multiple executions', async () => {
      await agent.initialize();

      const performanceTests = [
        {
          task: {
            id: 'perf-atomic',
            description: 'Simple atomic task',
            tool: 'calculator',
            params: { expression: '7 * 6' }
          },
          expectedStrategy: 'AtomicExecutionStrategy'
        },
        {
          task: {
            id: 'perf-parallel',
            description: 'Parallel task',
            subtasks: [
              { id: 'p1', tool: 'calculator', params: { expression: '5 + 5' } },
              { id: 'p2', tool: 'calculator', params: { expression: '8 * 2' } }
            ]
          },
          expectedStrategy: 'ParallelExecutionStrategy'
        }
      ];

      // Execute each test case multiple times
      for (const testCase of performanceTests) {
        for (let iteration = 0; iteration < 2; iteration++) {
          const task = {
            ...testCase.task,
            id: `${testCase.task.id}-${iteration}`
          };

          if (task.subtasks) {
            task.subtasks = task.subtasks.map(subtask => ({
              ...subtask,
              id: `${subtask.id}-${iteration}`
            }));
          }

          const analysis = await taskAnalyzer.analyzeTask(task);
          expect(analysis.recommendation.strategy).toBe(testCase.expectedStrategy);

          const result = await agent.execute(task);
          expect(result.success).toBe(true);

          taskAnalyzer.recordPerformance(
            analysis.recommendation.strategy,
            analysis,
            { success: result.success, duration: result.metadata.duration }
          );
        }
      }

      // Verify performance statistics
      const stats = taskAnalyzer.getPerformanceStats();
      
      expect(stats.totalAnalyses).toBe(4); // 2 test cases * 2 iterations
      expect(stats.overallSuccessRate).toBe(1.0); // All should succeed
      
      // Check individual strategy metrics
      const atomicMetrics = stats.strategyMetrics.AtomicExecutionStrategy;
      const parallelMetrics = stats.strategyMetrics.ParallelExecutionStrategy;
      
      expect(atomicMetrics.totalAttempts).toBe(2);
      expect(atomicMetrics.successRate).toBe(1.0);
      expect(parallelMetrics.totalAttempts).toBe(2);
      expect(parallelMetrics.successRate).toBe(1.0);
    });

    it('should provide performance statistics and insights', async () => {
      await agent.initialize();

      // Add some performance data
      const testTask = {
        id: 'stats-test',
        description: 'Statistics test',
        tool: 'calculator', 
        params: { expression: '100 / 4' }
      };

      const analysis = await taskAnalyzer.analyzeTask(testTask);
      const result = await agent.execute(testTask);

      expect(result.success).toBe(true);

      taskAnalyzer.recordPerformance(
        analysis.recommendation.strategy,
        analysis,
        { success: result.success, duration: result.metadata.duration }
      );

      // Get comprehensive statistics
      const stats = taskAnalyzer.getPerformanceStats();
      
      expect(stats.totalAnalyses).toBeGreaterThan(0);
      expect(stats.overallSuccessRate).toBeGreaterThanOrEqual(0);
      expect(stats.strategyMetrics).toBeDefined();
      
      // Should have metrics for the strategy we used
      const usedStrategy = analysis.recommendation.strategy;
      expect(stats.strategyMetrics[usedStrategy]).toBeDefined();
      expect(stats.strategyMetrics[usedStrategy].totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Confidence and Recommendation Quality', () => {
    it('should provide high confidence for clear-cut strategy decisions', async () => {
      await agent.initialize();

      const testCases = [
        {
          name: 'Simple atomic task',
          task: {
            id: 'high-confidence-atomic',
            tool: 'calculator',
            params: { expression: '9 * 3' }
          },
          expectedConfidence: 0.8 // Should be high confidence for simple tasks
        },
        {
          name: 'Independent parallel tasks',
          task: {
            id: 'high-confidence-parallel',
            subtasks: [
              { id: 'ind1', tool: 'calculator', params: { expression: '12 + 8' } },
              { id: 'ind2', tool: 'calculator', params: { expression: '35 - 15' } },
              { id: 'ind3', tool: 'calculator', params: { expression: '6 * 7' } }
            ]
          },
          expectedConfidence: 0.8 // Should be high confidence for clearly parallel tasks
        }
      ];

      for (const testCase of testCases) {
        const analysis = await taskAnalyzer.analyzeTask(testCase.task);
        
        expect(analysis.recommendation.confidence).toBeGreaterThan(testCase.expectedConfidence);
        expect(analysis.recommendation.reasoning).toBeDefined();
        expect(analysis.recommendation.reasoning.length).toBeGreaterThan(0);
        
        // Verify execution works as expected
        const result = await agent.execute(testCase.task);
        expect(result.success).toBe(true);
      }
    });

    it('should handle edge cases with appropriate confidence levels', async () => {
      const edgeCases = [
        {
          name: 'Empty task',
          task: { id: 'empty-task' },
          shouldAnalyze: true
        },
        {
          name: 'Task with empty subtasks',
          task: { id: 'empty-subtasks', subtasks: [] },
          shouldAnalyze: true
        },
        {
          name: 'Very complex task',
          task: {
            id: 'very-complex',
            subtasks: Array.from({ length: 15 }, (_, i) => ({
              id: `complex-${i}`,
              tool: 'calculator',
              params: { expression: `${i} + ${i}` }
            }))
          },
          shouldAnalyze: true
        }
      ];

      for (const edgeCase of edgeCases) {
        const analysis = await taskAnalyzer.analyzeTask(edgeCase.task);
        
        if (edgeCase.shouldAnalyze) {
          expect(analysis.analysisId).toBeDefined();
          expect(analysis.recommendation).toBeDefined();
          expect(analysis.recommendation.strategy).toBeDefined();
          expect(analysis.recommendation.confidence).toBeGreaterThanOrEqual(0);
          expect(analysis.recommendation.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Memory and Performance Management', () => {
    it('should manage performance history size limits', async () => {
      // Create TaskAnalyzer with small history limit for testing
      const limitedAnalyzer = new TaskAnalyzer({
        enableLearning: true,
        maxHistorySize: 3
      });

      // Add more records than the limit
      for (let i = 0; i < 5; i++) {
        limitedAnalyzer.recordPerformance(
          'AtomicExecutionStrategy',
          { complexity: { overallComplexity: 0.1 }, dependencies: { count: 0 } },
          { success: true, duration: 1000 }
        );
      }

      // Should only keep the most recent records
      expect(limitedAnalyzer.performanceHistory).toHaveLength(3);
      
      const stats = limitedAnalyzer.getPerformanceStats();
      expect(stats.totalAnalyses).toBe(3);
    });

    it('should handle clearing performance history', async () => {
      // Add some performance data
      taskAnalyzer.recordPerformance(
        'AtomicExecutionStrategy',
        { complexity: { overallComplexity: 0.1 } },
        { success: true, duration: 1000 }
      );
      
      taskAnalyzer.recordPerformance(
        'ParallelExecutionStrategy', 
        { complexity: { overallComplexity: 0.3 } },
        { success: false, duration: 2000 }
      );

      expect(taskAnalyzer.performanceHistory.length).toBe(2);

      // Clear history
      taskAnalyzer.clearHistory();

      expect(taskAnalyzer.performanceHistory.length).toBe(0);
      
      const stats = taskAnalyzer.getPerformanceStats();
      expect(stats.totalAnalyses).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      
      // Strategy metrics should be reset to baseline
      for (const [strategy, metrics] of taskAnalyzer.strategyMetrics) {
        expect(metrics.totalAttempts).toBe(0);
        expect(metrics.successRate).toBe(0.5); // Baseline
      }
    });
  });
});