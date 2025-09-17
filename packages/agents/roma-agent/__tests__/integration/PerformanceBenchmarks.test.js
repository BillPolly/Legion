/**
 * Performance benchmarks for ROMA Agent strategy selection
 * Tests execution time, memory usage, and strategy efficiency
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { TaskAnalyzer } from '../../src/analysis/TaskAnalyzer.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ROMA Agent Performance Benchmarks', () => {
  let agent;
  let taskAnalyzer;
  let resourceManager;
  let toolRegistry;
  let llmClient;

  beforeAll(async () => {
    // Get singletons - real instances for realistic benchmarks
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    agent = new ROMAAgent({
      maxConcurrency: 4,
      defaultTimeout: 15000,
      enableSemanticAnalysis: true,
      enableTaskAnalyzer: true
    });

    taskAnalyzer = new TaskAnalyzer({
      enableLearning: true,
      maxHistorySize: 500
    });
  });
  
  afterAll(async () => {
    if (agent && agent.isInitialized) {
      await agent.shutdown();
    }
  });

  describe('Strategy Selection Performance', () => {
    it('should analyze tasks within acceptable time limits', async () => {
      await agent.initialize();

      const testCases = [
        {
          name: 'Simple task',
          task: {
            id: 'benchmark-simple',
            tool: 'calculator',
            params: { expression: '42 + 58' }
          },
          maxAnalysisTime: 100 // 100ms
        },
        {
          name: 'Medium complexity task',
          task: {
            id: 'benchmark-medium',
            subtasks: Array.from({ length: 5 }, (_, i) => ({
              id: `medium-${i}`,
              tool: 'calculator',
              params: { expression: `${i} * 10` }
            }))
          },
          maxAnalysisTime: 200 // 200ms
        },
        {
          name: 'Complex task',
          task: {
            id: 'benchmark-complex',
            subtasks: Array.from({ length: 20 }, (_, i) => ({
              id: `complex-${i}`,
              tool: 'calculator',
              params: { expression: `${i} + ${i * 2}` },
              dependencies: i > 0 ? [`complex-${i - 1}`] : []
            }))
          },
          maxAnalysisTime: 500 // 500ms
        },
        {
          name: 'Very complex task',
          task: {
            id: 'benchmark-very-complex',
            subtasks: Array.from({ length: 50 }, (_, i) => ({
              id: `very-complex-${i}`,
              tool: 'calculator',
              params: { expression: `${i} * ${i}` },
              dependencies: i > 0 && i % 3 === 0 ? [`very-complex-${i - 1}`] : []
            }))
          },
          maxAnalysisTime: 1000 // 1s
        }
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();
        const analysis = await taskAnalyzer.analyzeTask(testCase.task);
        const analysisTime = Date.now() - startTime;

        expect(analysisTime).toBeLessThan(testCase.maxAnalysisTime);
        expect(analysis.analysisId).toBeDefined();
        expect(analysis.recommendation.strategy).toBeDefined();
        expect(analysis.recommendation.confidence).toBeGreaterThan(0);

        console.log(`${testCase.name}: ${analysisTime}ms (limit: ${testCase.maxAnalysisTime}ms)`);
      }
    });

    it('should maintain consistent analysis performance with learning data', async () => {
      await agent.initialize();

      // Build up learning history
      const learningTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `learning-${i}`,
        tool: 'calculator',
        params: { expression: `${i} + 1` }
      }));

      // Add learning data
      for (const task of learningTasks) {
        const analysis = await taskAnalyzer.analyzeTask(task);
        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: true, duration: Math.random() * 1000 + 500 }
        );
      }

      // Test analysis performance with learning data
      const testTask = {
        id: 'performance-with-learning',
        tool: 'calculator',
        params: { expression: '100 * 5' }
      };

      const iterations = 10;
      const analysisTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const analysis = await taskAnalyzer.analyzeTask({
          ...testTask,
          id: `${testTask.id}-${i}`
        });
        const analysisTime = Date.now() - startTime;
        analysisTimes.push(analysisTime);

        expect(analysis.recommendation.strategy).toBeDefined();
      }

      const avgAnalysisTime = analysisTimes.reduce((a, b) => a + b, 0) / analysisTimes.length;
      const maxAnalysisTime = Math.max(...analysisTimes);

      expect(avgAnalysisTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxAnalysisTime).toBeLessThan(200); // No single analysis over 200ms

      console.log(`Average analysis time with learning: ${avgAnalysisTime.toFixed(2)}ms`);
      console.log(`Max analysis time: ${maxAnalysisTime}ms`);
    });
  });

  describe('Execution Performance Benchmarks', () => {
    it('should execute tasks efficiently with different strategies', async () => {
      await agent.initialize();

      const strategyBenchmarks = [
        {
          name: 'Atomic execution',
          task: {
            id: 'atomic-benchmark',
            tool: 'calculator',
            params: { expression: '123 * 456' }
          },
          expectedStrategy: 'AtomicExecutionStrategy',
          maxExecutionTime: 3000
        },
        {
          name: 'Sequential execution',
          task: {
            id: 'sequential-benchmark',
            subtasks: [
              {
                id: 'seq-1',
                tool: 'calculator',
                params: { expression: '10 + 20' }
              },
              {
                id: 'seq-2',
                tool: 'calculator',
                params: { expression: '30 * 2' },
                dependencies: ['seq-1']
              },
              {
                id: 'seq-3',
                tool: 'calculator',
                params: { expression: '100 / 4' },
                dependencies: ['seq-2']
              }
            ]
          },
          expectedStrategy: 'SequentialExecutionStrategy',
          maxExecutionTime: 8000
        },
        {
          name: 'Parallel execution',
          task: {
            id: 'parallel-benchmark',
            subtasks: [
              {
                id: 'par-1',
                tool: 'calculator',
                params: { expression: '15 + 25' }
              },
              {
                id: 'par-2',
                tool: 'calculator',
                params: { expression: '40 - 15' }
              },
              {
                id: 'par-3',
                tool: 'calculator',
                params: { expression: '8 * 7' }
              },
              {
                id: 'par-4',
                tool: 'calculator',
                params: { expression: '144 / 12' }
              }
            ]
          },
          expectedStrategy: 'ParallelExecutionStrategy',
          maxExecutionTime: 6000
        }
      ];

      for (const benchmark of strategyBenchmarks) {
        // Analyze strategy
        const analysis = await taskAnalyzer.analyzeTask(benchmark.task);
        expect(analysis.recommendation.strategy).toBe(benchmark.expectedStrategy);

        // Execute and time
        const startTime = Date.now();
        const result = await agent.execute(benchmark.task);
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(benchmark.maxExecutionTime);

        // Record performance
        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: result.success, duration: executionTime }
        );

        console.log(`${benchmark.name}: ${executionTime}ms (limit: ${benchmark.maxExecutionTime}ms)`);
      }
    });

    it('should demonstrate parallel execution efficiency gains', async () => {
      await agent.initialize();

      // Create task that benefits from parallelization
      const parallelTask = {
        id: 'parallel-efficiency-test',
        subtasks: Array.from({ length: 6 }, (_, i) => ({
          id: `parallel-task-${i}`,
          tool: 'calculator',
          params: { expression: `${i * 10} + ${i * 5}` }
        }))
      };

      // Force sequential execution for comparison
      const sequentialTask = {
        ...parallelTask,
        id: 'sequential-efficiency-test',
        subtasks: parallelTask.subtasks.map((subtask, i) => ({
          ...subtask,
          id: `sequential-task-${i}`,
          dependencies: i > 0 ? [`sequential-task-${i - 1}`] : []
        }))
      };

      // Test parallel execution
      const parallelStart = Date.now();
      const parallelResult = await agent.execute(parallelTask);
      const parallelTime = Date.now() - parallelStart;

      expect(parallelResult.success).toBe(true);

      // Test sequential execution
      const sequentialStart = Date.now();
      const sequentialResult = await agent.execute(sequentialTask);
      const sequentialTime = Date.now() - sequentialStart;

      expect(sequentialResult.success).toBe(true);

      // Parallel should be faster (or at least not significantly slower)
      const efficiencyRatio = parallelTime / sequentialTime;
      expect(efficiencyRatio).toBeLessThan(1.2); // Parallel should be within 20% of sequential

      console.log(`Parallel execution: ${parallelTime}ms`);
      console.log(`Sequential execution: ${sequentialTime}ms`);
      console.log(`Efficiency ratio: ${efficiencyRatio.toFixed(2)}`);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should manage memory efficiently with large task sets', async () => {
      await agent.initialize();

      const initialMemory = process.memoryUsage();

      // Create large task set
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `memory-test-${i}`,
        tool: 'calculator',
        params: { expression: `${i} * 2 + ${i}` }
      }));

      // Execute tasks and measure memory
      for (let batch = 0; batch < 5; batch++) {
        const batchTasks = largeTasks.slice(batch * 20, (batch + 1) * 20);
        
        for (const task of batchTasks) {
          const analysis = await taskAnalyzer.analyzeTask(task);
          const result = await agent.execute(task);
          
          expect(result.success).toBe(true);
          
          taskAnalyzer.recordPerformance(
            analysis.recommendation.strategy,
            analysis,
            { success: result.success, duration: 100 }
          );
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        
        console.log(`Batch ${batch + 1}: Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      }
    });

    it('should clean up performance history appropriately', async () => {
      const limitedAnalyzer = new TaskAnalyzer({
        enableLearning: true,
        maxHistorySize: 10
      });

      const initialMemory = process.memoryUsage();

      // Add many performance records
      for (let i = 0; i < 100; i++) {
        limitedAnalyzer.recordPerformance(
          'AtomicExecutionStrategy',
          { 
            complexity: { overallComplexity: Math.random() },
            dependencies: { count: 0 }
          },
          { success: true, duration: Math.random() * 1000 }
        );
      }

      // Should maintain size limit
      expect(limitedAnalyzer.performanceHistory.length).toBe(10);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB

      console.log(`Performance history memory impact: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should handle increasing task complexity gracefully', async () => {
      await agent.initialize();

      const complexityLevels = [
        { name: 'Small', subtaskCount: 5 },
        { name: 'Medium', subtaskCount: 15 },
        { name: 'Large', subtaskCount: 30 },
        { name: 'Very Large', subtaskCount: 50 }
      ];

      const results = [];

      for (const level of complexityLevels) {
        const task = {
          id: `scalability-${level.name.toLowerCase()}`,
          subtasks: Array.from({ length: level.subtaskCount }, (_, i) => ({
            id: `scale-${level.name.toLowerCase()}-${i}`,
            tool: 'calculator',
            params: { expression: `${i} + ${level.subtaskCount}` }
          }))
        };

        // Time analysis
        const analysisStart = Date.now();
        const analysis = await taskAnalyzer.analyzeTask(task);
        const analysisTime = Date.now() - analysisStart;

        // Time execution
        const executionStart = Date.now();
        const result = await agent.execute(task);
        const executionTime = Date.now() - executionStart;

        expect(result.success).toBe(true);
        expect(result.result).toHaveLength(level.subtaskCount);

        results.push({
          level: level.name,
          subtaskCount: level.subtaskCount,
          analysisTime,
          executionTime,
          strategy: analysis.recommendation.strategy
        });

        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: result.success, duration: executionTime }
        );
      }

      // Analyze scalability
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        const taskGrowth = curr.subtaskCount / prev.subtaskCount;
        const timeGrowth = curr.executionTime / prev.executionTime;
        
        // Time growth should be roughly linear or better
        expect(timeGrowth).toBeLessThan(taskGrowth * 1.5);
        
        console.log(`${curr.level}: ${curr.subtaskCount} tasks, ${curr.executionTime}ms (${curr.strategy})`);
      }
    });

    it('should maintain performance under concurrent task execution', async () => {
      await agent.initialize();

      const concurrentTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        subtasks: [
          {
            id: `concurrent-${i}-1`,
            tool: 'calculator',
            params: { expression: `${i} * 10` }
          },
          {
            id: `concurrent-${i}-2`,
            tool: 'calculator',
            params: { expression: `${i} + 100` }
          }
        ]
      }));

      // Execute tasks concurrently
      const startTime = Date.now();
      const promises = concurrentTasks.map(async (task) => {
        const analysis = await taskAnalyzer.analyzeTask(task);
        const result = await agent.execute(task);
        
        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: result.success, duration: 100 }
        );
        
        return result;
      });

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All tasks should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Concurrent execution should complete in reasonable time
      expect(totalTime).toBeLessThan(20000); // 20 seconds for 10 concurrent tasks

      console.log(`Concurrent execution of ${concurrentTasks.length} tasks: ${totalTime}ms`);
    });
  });

  describe('Strategy Learning Performance', () => {
    it('should improve recommendation accuracy over time', async () => {
      await agent.initialize();

      const baseTask = {
        subtasks: [
          {
            id: 'learn-1',
            tool: 'calculator',
            params: { expression: '10 + 20' }
          },
          {
            id: 'learn-2',
            tool: 'calculator',
            params: { expression: '30 * 2' }
          }
        ]
      };

      const iterations = 20;
      const confidenceScores = [];

      // Execute multiple similar tasks to build learning
      for (let i = 0; i < iterations; i++) {
        const task = {
          ...baseTask,
          id: `learning-iteration-${i}`,
          subtasks: baseTask.subtasks.map(subtask => ({
            ...subtask,
            id: `${subtask.id}-${i}`
          }))
        };

        const analysis = await taskAnalyzer.analyzeTask(task);
        const result = await agent.execute(task);

        expect(result.success).toBe(true);

        confidenceScores.push(analysis.recommendation.confidence);

        taskAnalyzer.recordPerformance(
          analysis.recommendation.strategy,
          analysis,
          { success: result.success, duration: result.metadata.duration }
        );
      }

      // Confidence should generally improve or remain stable
      const earlyConfidence = confidenceScores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const lateConfidence = confidenceScores.slice(-5).reduce((a, b) => a + b, 0) / 5;

      expect(lateConfidence).toBeGreaterThanOrEqual(earlyConfidence * 0.9); // At least 90% of early confidence

      console.log(`Early confidence: ${earlyConfidence.toFixed(3)}`);
      console.log(`Late confidence: ${lateConfidence.toFixed(3)}`);
      console.log(`Improvement: ${((lateConfidence / earlyConfidence - 1) * 100).toFixed(1)}%`);
    });

    it('should maintain learning performance with large datasets', async () => {
      const performanceAnalyzer = new TaskAnalyzer({
        enableLearning: true,
        maxHistorySize: 1000
      });

      // Add large amount of learning data
      const startTime = Date.now();
      
      for (let i = 0; i < 500; i++) {
        performanceAnalyzer.recordPerformance(
          i % 2 === 0 ? 'AtomicExecutionStrategy' : 'ParallelExecutionStrategy',
          {
            complexity: { overallComplexity: Math.random() },
            dependencies: { count: Math.floor(Math.random() * 5) }
          },
          {
            success: Math.random() > 0.1, // 90% success rate
            duration: Math.random() * 2000 + 500
          }
        );
      }

      const learningTime = Date.now() - startTime;

      // Learning should complete quickly
      expect(learningTime).toBeLessThan(1000); // Under 1 second

      // Test analysis performance with learning data
      const testTask = {
        id: 'performance-test',
        tool: 'calculator',
        params: { expression: '42 * 24' }
      };

      const analysisStart = Date.now();
      const analysis = await performanceAnalyzer.analyzeTask(testTask);
      const analysisTime = Date.now() - analysisStart;

      expect(analysis.recommendation.strategy).toBeDefined();
      expect(analysisTime).toBeLessThan(100); // Analysis should still be fast

      console.log(`Learning 500 records: ${learningTime}ms`);
      console.log(`Analysis with learning data: ${analysisTime}ms`);
    });
  });
});