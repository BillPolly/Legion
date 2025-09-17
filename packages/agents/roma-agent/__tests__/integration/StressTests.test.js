/**
 * Stress tests for ROMA Agent learning system
 * Tests system behavior under high load, edge cases, and failure scenarios
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { TaskAnalyzer } from '../../src/analysis/TaskAnalyzer.js';
import { ErrorRecovery } from '../../src/errors/ErrorRecovery.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ROMA Agent Stress Tests', () => {
  let agent;
  let taskAnalyzer;
  let errorRecovery;
  let resourceManager;
  let toolRegistry;
  let llmClient;

  beforeAll(async () => {
    // Get singletons for stress testing
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    agent = new ROMAAgent({
      maxConcurrency: 8,
      defaultTimeout: 30000,
      enableSemanticAnalysis: true,
      enableTaskAnalyzer: true
    });

    taskAnalyzer = new TaskAnalyzer({
      enableLearning: true,
      maxHistorySize: 2000
    });

    errorRecovery = new ErrorRecovery({
      maxRecoveryAttempts: 5,
      enableStateRollback: true
    });
  });
  
  afterAll(async () => {
    if (agent && agent.isInitialized) {
      await agent.shutdown();
    }
  });

  describe('High Volume Task Processing', () => {
    it('should handle burst of concurrent tasks without degradation', async () => {
      await agent.initialize();

      const taskCount = 50;
      const batchSize = 10;
      const executionTimes = [];
      const successCount = { value: 0 };

      // Generate large number of tasks
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        id: `stress-burst-${i}`,
        description: `Stress test task ${i}`,
        tool: 'calculator',
        params: { expression: `${i} * 2 + ${i % 10}` }
      }));

      // Process in batches to avoid overwhelming the system
      for (let batch = 0; batch < taskCount / batchSize; batch++) {
        const batchTasks = tasks.slice(batch * batchSize, (batch + 1) * batchSize);
        
        const batchStart = Date.now();
        const promises = batchTasks.map(async (task) => {
          try {
            const analysis = await taskAnalyzer.analyzeTask(task);
            const result = await agent.execute(task);
            
            if (result.success) {
              successCount.value++;
              taskAnalyzer.recordPerformance(
                analysis.recommendation.strategy,
                analysis,
                { success: result.success, duration: result.metadata.duration }
              );
            }
            
            return result;
          } catch (error) {
            console.warn(`Task ${task.id} failed:`, error.message);
            return { success: false, error: error.message };
          }
        });

        const batchResults = await Promise.all(promises);
        const batchTime = Date.now() - batchStart;
        executionTimes.push(batchTime);

        // Verify batch results
        const batchSuccesses = batchResults.filter(r => r.success).length;
        expect(batchSuccesses).toBeGreaterThan(batchSize * 0.8); // At least 80% success

        console.log(`Batch ${batch + 1}: ${batchSuccesses}/${batchSize} succeeded in ${batchTime}ms`);
      }

      // Overall success rate should be high
      expect(successCount.value).toBeGreaterThan(taskCount * 0.85); // At least 85% overall success

      // Execution times should remain consistent
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      
      expect(maxTime).toBeLessThan(avgTime * 3); // No batch should take more than 3x average

      console.log(`Total success rate: ${(successCount.value / taskCount * 100).toFixed(1)}%`);
      console.log(`Average batch time: ${avgTime.toFixed(0)}ms`);
    });

    it('should maintain memory stability under continuous load', async () => {
      await agent.initialize();

      const initialMemory = process.memoryUsage();
      const memorySnapshots = [];
      const iterations = 20;
      const tasksPerIteration = 10;

      for (let iteration = 0; iteration < iterations; iteration++) {
        // Generate tasks for this iteration
        const tasks = Array.from({ length: tasksPerIteration }, (_, i) => ({
          id: `memory-stress-${iteration}-${i}`,
          tool: 'calculator',
          params: { expression: `${iteration * 10 + i} / 2` }
        }));

        // Execute tasks
        for (const task of tasks) {
          const analysis = await taskAnalyzer.analyzeTask(task);
          const result = await agent.execute(task);
          
          if (result.success) {
            taskAnalyzer.recordPerformance(
              analysis.recommendation.strategy,
              analysis,
              { success: result.success, duration: result.metadata.duration }
            );
          }
        }

        // Take memory snapshot
        const currentMemory = process.memoryUsage();
        memorySnapshots.push({
          iteration,
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Analyze memory growth
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      // Memory growth should be reasonable (less than 100MB for this test)
      expect(memoryGrowthMB).toBeLessThan(100);

      // Check for memory leaks (growth should level off)
      const recentGrowth = memorySnapshots.slice(-5);
      const maxRecentHeap = Math.max(...recentGrowth.map(s => s.heapUsed));
      const minRecentHeap = Math.min(...recentGrowth.map(s => s.heapUsed));
      const recentVariation = (maxRecentHeap - minRecentHeap) / 1024 / 1024;

      expect(recentVariation).toBeLessThan(50); // Recent variation should be under 50MB

      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
      console.log(`Recent variation: ${recentVariation.toFixed(2)}MB`);
    });
  });

  describe('Error Recovery Stress Testing', () => {
    it('should handle cascade of different error types gracefully', async () => {
      await agent.initialize();

      const errorScenarios = [
        {
          name: 'Tool not found',
          task: {
            id: 'error-tool-missing',
            tool: 'non-existent-tool-xyz123',
            params: { input: 'test' }
          },
          expectedRecoverable: false
        },
        {
          name: 'Invalid parameters',
          task: {
            id: 'error-invalid-params',
            tool: 'calculator',
            params: { expression: 'invalid-expression' }
          },
          expectedRecoverable: true
        },
        {
          name: 'Complex task with errors',
          task: {
            id: 'error-complex',
            subtasks: [
              {
                id: 'good-task',
                tool: 'calculator',
                params: { expression: '10 + 10' }
              },
              {
                id: 'bad-task',
                tool: 'non-existent-tool',
                params: { input: 'fail' }
              }
            ]
          },
          expectedRecoverable: true
        }
      ];

      const recoveryResults = [];

      for (const scenario of errorScenarios) {
        try {
          const analysis = await taskAnalyzer.analyzeTask(scenario.task);
          const result = await agent.execute(scenario.task);

          // Task should fail but system should remain stable
          expect(result.success).toBe(false);

          // Record the failure for learning
          taskAnalyzer.recordPerformance(
            analysis.recommendation.strategy,
            analysis,
            { success: result.success, duration: result.metadata.duration, error: result.error }
          );

          recoveryResults.push({
            scenario: scenario.name,
            handled: true,
            error: result.error
          });

        } catch (systemError) {
          // System-level failures should not occur
          recoveryResults.push({
            scenario: scenario.name,
            handled: false,
            systemError: systemError.message
          });
        }
      }

      // All error scenarios should be handled gracefully
      const handledCount = recoveryResults.filter(r => r.handled).length;
      expect(handledCount).toBe(errorScenarios.length);

      console.log('Error recovery results:');
      recoveryResults.forEach(result => {
        console.log(`  ${result.scenario}: ${result.handled ? 'Handled' : 'System failure'}`);
      });
    });

    it('should maintain system stability under repeated failure scenarios', async () => {
      await agent.initialize();

      const failureTask = {
        id: 'repeated-failure',
        tool: 'non-existent-tool',
        params: { input: 'always-fails' }
      };

      const iterations = 15;
      const systemErrors = [];
      const handledFailures = [];

      for (let i = 0; i < iterations; i++) {
        try {
          const task = {
            ...failureTask,
            id: `${failureTask.id}-${i}`
          };

          const analysis = await taskAnalyzer.analyzeTask(task);
          const result = await agent.execute(task);

          // Should fail gracefully
          expect(result.success).toBe(false);
          handledFailures.push(i);

          // Record failure for learning
          taskAnalyzer.recordPerformance(
            analysis.recommendation.strategy,
            analysis,
            { success: false, duration: 0, error: result.error }
          );

        } catch (systemError) {
          systemErrors.push({ iteration: i, error: systemError.message });
        }
      }

      // System should handle all failures gracefully
      expect(systemErrors.length).toBe(0);
      expect(handledFailures.length).toBe(iterations);

      // Agent should still be functional after repeated failures
      const healthCheck = {
        id: 'health-check',
        tool: 'calculator',
        params: { expression: '42 + 8' }
      };

      const healthResult = await agent.execute(healthCheck);
      expect(healthResult.success).toBe(true);

      console.log(`Handled ${handledFailures.length}/${iterations} failures gracefully`);
    });
  });

  describe('Learning System Stress Tests', () => {
    it('should handle rapid learning data accumulation without performance degradation', async () => {
      const stressAnalyzer = new TaskAnalyzer({
        enableLearning: true,
        maxHistorySize: 1000
      });

      const strategies = [
        'AtomicExecutionStrategy',
        'SequentialExecutionStrategy', 
        'ParallelExecutionStrategy',
        'RecursiveExecutionStrategy'
      ];

      const learningStart = Date.now();
      const analysisTimesWithLearning = [];

      // Rapidly add learning data
      for (let i = 0; i < 500; i++) {
        const strategy = strategies[i % strategies.length];
        const complexity = Math.random();
        const success = Math.random() > 0.2; // 80% success rate
        const duration = Math.random() * 3000 + 500;

        stressAnalyzer.recordPerformance(
          strategy,
          {
            complexity: { overallComplexity: complexity },
            dependencies: { count: Math.floor(Math.random() * 5) }
          },
          { success, duration }
        );

        // Periodically test analysis performance
        if (i % 50 === 0) {
          const testTask = {
            id: `learning-stress-${i}`,
            tool: 'calculator',
            params: { expression: `${i} + 1` }
          };

          const analysisStart = Date.now();
          const analysis = await stressAnalyzer.analyzeTask(testTask);
          const analysisTime = Date.now() - analysisStart;

          analysisTimesWithLearning.push(analysisTime);
          expect(analysis.recommendation.strategy).toBeDefined();
        }
      }

      const totalLearningTime = Date.now() - learningStart;

      // Learning should complete reasonably quickly
      expect(totalLearningTime).toBeLessThan(5000); // Under 5 seconds

      // Analysis times should remain reasonable even with lots of learning data
      const avgAnalysisTime = analysisTimesWithLearning.reduce((a, b) => a + b, 0) / analysisTimesWithLearning.length;
      expect(avgAnalysisTime).toBeLessThan(200); // Under 200ms average

      // History should be properly limited
      expect(stressAnalyzer.performanceHistory.length).toBeLessThanOrEqual(1000);

      console.log(`Learning 500 records: ${totalLearningTime}ms`);
      console.log(`Average analysis time with learning: ${avgAnalysisTime.toFixed(2)}ms`);
    });

    it('should maintain recommendation quality under conflicting learning data', async () => {
      await agent.initialize();

      const conflictAnalyzer = new TaskAnalyzer({
        enableLearning: true,
        maxHistorySize: 200
      });

      // Add conflicting performance data for same strategy
      const strategy = 'ParallelExecutionStrategy';
      const baseComplexity = 0.5;

      // Add successful records
      for (let i = 0; i < 30; i++) {
        conflictAnalyzer.recordPerformance(
          strategy,
          {
            complexity: { overallComplexity: baseComplexity + (Math.random() - 0.5) * 0.1 },
            dependencies: { count: 0 }
          },
          { success: true, duration: Math.random() * 1000 + 500 }
        );
      }

      // Add failure records
      for (let i = 0; i < 20; i++) {
        conflictAnalyzer.recordPerformance(
          strategy,
          {
            complexity: { overallComplexity: baseComplexity + (Math.random() - 0.5) * 0.1 },
            dependencies: { count: 0 }
          },
          { success: false, duration: Math.random() * 2000 + 1000, error: 'Random failure' }
        );
      }

      // Test task similar to training data
      const testTask = {
        id: 'conflict-test',
        subtasks: [
          { id: 'conflict-1', tool: 'calculator', params: { expression: '10 + 5' } },
          { id: 'conflict-2', tool: 'calculator', params: { expression: '20 - 8' } }
        ]
      };

      const analysis = await conflictAnalyzer.analyzeTask(testTask);

      // Should still provide reasonable recommendations despite conflicts
      expect(analysis.recommendation.strategy).toBeDefined();
      expect(analysis.recommendation.confidence).toBeGreaterThan(0.3);
      expect(analysis.recommendation.confidence).toBeLessThan(0.95);

      // Should acknowledge uncertainty through lower confidence or alternatives
      const hasAlternatives = analysis.recommendation.alternatives.length > 0;
      const moderateConfidence = analysis.recommendation.confidence < 0.8;

      expect(hasAlternatives || moderateConfidence).toBe(true);

      console.log(`Conflicting data recommendation: ${analysis.recommendation.strategy}`);
      console.log(`Confidence: ${analysis.recommendation.confidence.toFixed(3)}`);
      console.log(`Alternatives: ${analysis.recommendation.alternatives.length}`);
    });
  });

  describe('Resource Exhaustion Tests', () => {
    it('should handle memory pressure gracefully', async () => {
      await agent.initialize();

      // Create tasks that might consume significant memory
      const memoryIntensiveTasks = Array.from({ length: 20 }, (_, i) => ({
        id: `memory-intensive-${i}`,
        description: `Memory intensive task ${i}`,
        subtasks: Array.from({ length: 25 }, (_, j) => ({
          id: `memory-subtask-${i}-${j}`,
          tool: 'calculator',
          params: { expression: `${i * 100 + j} * 2` }
        }))
      }));

      const results = [];
      const memorySnapshots = [];

      for (const task of memoryIntensiveTasks) {
        const memoryBefore = process.memoryUsage();
        
        try {
          const analysis = await taskAnalyzer.analyzeTask(task);
          const result = await agent.execute(task);
          
          results.push({
            taskId: task.id,
            success: result.success,
            subtaskCount: task.subtasks.length
          });

          if (result.success) {
            taskAnalyzer.recordPerformance(
              analysis.recommendation.strategy,
              analysis,
              { success: result.success, duration: result.metadata.duration }
            );
          }

        } catch (error) {
          results.push({
            taskId: task.id,
            success: false,
            error: error.message
          });
        }

        const memoryAfter = process.memoryUsage();
        memorySnapshots.push({
          task: task.id,
          heapUsed: memoryAfter.heapUsed,
          heapTotal: memoryAfter.heapTotal,
          memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
        });

        // Force garbage collection to help with memory pressure
        if (global.gc) {
          global.gc();
        }
      }

      // Most tasks should succeed even under memory pressure
      const successfulTasks = results.filter(r => r.success).length;
      expect(successfulTasks).toBeGreaterThan(memoryIntensiveTasks.length * 0.7); // At least 70%

      // System should remain responsive
      const finalHealthCheck = {
        id: 'final-health-check',
        tool: 'calculator',
        params: { expression: '100 - 1' }
      };

      const healthResult = await agent.execute(finalHealthCheck);
      expect(healthResult.success).toBe(true);

      console.log(`Memory intensive tasks: ${successfulTasks}/${memoryIntensiveTasks.length} succeeded`);
    });

    it('should handle concurrent execution limits appropriately', async () => {
      await agent.initialize();

      // Create more concurrent tasks than the system can handle
      const concurrencyLimit = agent.options.maxConcurrency || 8;
      const taskCount = concurrencyLimit * 3; // 3x the limit

      const heavyTasks = Array.from({ length: taskCount }, (_, i) => ({
        id: `concurrency-test-${i}`,
        subtasks: Array.from({ length: 5 }, (_, j) => ({
          id: `concurrent-${i}-${j}`,
          tool: 'calculator',
          params: { expression: `${i * 10 + j} / 3` }
        }))
      }));

      const executionStart = Date.now();
      
      // Execute all tasks concurrently
      const promises = heavyTasks.map(async (task, index) => {
        try {
          // Add slight delay to stagger starts
          await new Promise(resolve => setTimeout(resolve, index * 10));
          
          const analysis = await taskAnalyzer.analyzeTask(task);
          const result = await agent.execute(task);
          
          return {
            taskId: task.id,
            success: result.success,
            duration: result.metadata?.duration || 0
          };
        } catch (error) {
          return {
            taskId: task.id,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(promises);
      const totalTime = Date.now() - executionStart;

      // Most tasks should eventually succeed
      const successfulTasks = results.filter(r => r.success).length;
      expect(successfulTasks).toBeGreaterThan(taskCount * 0.8); // At least 80%

      // Total time should be reasonable (tasks should queue/batch appropriately)
      expect(totalTime).toBeLessThan(60000); // Under 1 minute

      console.log(`Concurrency test: ${successfulTasks}/${taskCount} tasks succeeded`);
      console.log(`Total execution time: ${totalTime}ms`);
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle malformed and extreme tasks gracefully', async () => {
      await agent.initialize();

      const edgeCases = [
        {
          name: 'Null task',
          task: null,
          shouldAnalyze: true
        },
        {
          name: 'Empty object',
          task: {},
          shouldAnalyze: true
        },
        {
          name: 'Extremely deep nesting',
          task: {
            id: 'deep-nesting',
            subtasks: [{
              id: 'level-1',
              subtasks: [{
                id: 'level-2',
                subtasks: [{
                  id: 'level-3',
                  subtasks: [{
                    id: 'level-4',
                    tool: 'calculator',
                    params: { expression: '1 + 1' }
                  }]
                }]
              }]
            }]
          },
          shouldAnalyze: true
        },
        {
          name: 'Circular dependencies',
          task: {
            id: 'circular',
            subtasks: [
              { id: 'A', dependencies: ['B'], tool: 'calculator', params: { expression: '1 + 1' } },
              { id: 'B', dependencies: ['C'], tool: 'calculator', params: { expression: '2 + 2' } },
              { id: 'C', dependencies: ['A'], tool: 'calculator', params: { expression: '3 + 3' } }
            ]
          },
          shouldAnalyze: true
        },
        {
          name: 'Massive task array',
          task: {
            id: 'massive',
            subtasks: Array.from({ length: 200 }, (_, i) => ({
              id: `massive-${i}`,
              tool: 'calculator',
              params: { expression: `${i} + 1` }
            }))
          },
          shouldAnalyze: true
        }
      ];

      for (const edgeCase of edgeCases) {
        try {
          if (edgeCase.shouldAnalyze) {
            const analysis = await taskAnalyzer.analyzeTask(edgeCase.task);
            expect(analysis).toBeDefined();
            expect(analysis.recommendation).toBeDefined();
            
            // For non-null tasks, try execution
            if (edgeCase.task !== null) {
              const result = await agent.execute(edgeCase.task);
              // Result should exist (success or failure)
              expect(result).toBeDefined();
              expect(typeof result.success).toBe('boolean');
            }
          }

          console.log(`✓ ${edgeCase.name}: Handled gracefully`);

        } catch (error) {
          // Should not throw unhandled errors
          console.error(`✗ ${edgeCase.name}: Unhandled error - ${error.message}`);
          throw error;
        }
      }
    });

    it('should maintain system stability after extended stress testing', async () => {
      await agent.initialize();

      // Run a comprehensive stress test combining multiple factors
      const stressPhases = [
        {
          name: 'Burst processing',
          duration: 5000,
          taskGenerator: (i) => ({
            id: `stress-burst-${i}`,
            tool: 'calculator',
            params: { expression: `${i} * 2` }
          })
        },
        {
          name: 'Error scenarios',
          duration: 3000,
          taskGenerator: (i) => ({
            id: `stress-error-${i}`,
            tool: i % 3 === 0 ? 'non-existent-tool' : 'calculator',
            params: { expression: `${i} + 1` }
          })
        },
        {
          name: 'Complex tasks',
          duration: 4000,
          taskGenerator: (i) => ({
            id: `stress-complex-${i}`,
            subtasks: Array.from({ length: Math.min(10, i % 8 + 1) }, (_, j) => ({
              id: `stress-complex-${i}-${j}`,
              tool: 'calculator',
              params: { expression: `${i + j} / 2` }
            }))
          })
        }
      ];

      const phaseResults = [];

      for (const phase of stressPhases) {
        const phaseStart = Date.now();
        const phaseTasks = [];
        let taskIndex = 0;

        // Generate and execute tasks for this phase duration
        while (Date.now() - phaseStart < phase.duration) {
          const task = phase.taskGenerator(taskIndex++);
          
          try {
            const analysis = await taskAnalyzer.analyzeTask(task);
            const result = await agent.execute(task);
            
            phaseTasks.push({
              success: result.success,
              strategy: analysis.recommendation.strategy
            });

            if (result.success) {
              taskAnalyzer.recordPerformance(
                analysis.recommendation.strategy,
                analysis,
                { success: result.success, duration: result.metadata.duration }
              );
            }

          } catch (error) {
            phaseTasks.push({ success: false, error: error.message });
          }
        }

        const phaseTime = Date.now() - phaseStart;
        const successRate = phaseTasks.filter(t => t.success).length / phaseTasks.length;

        phaseResults.push({
          phase: phase.name,
          tasks: phaseTasks.length,
          successRate,
          duration: phaseTime
        });

        console.log(`${phase.name}: ${phaseTasks.length} tasks, ${(successRate * 100).toFixed(1)}% success`);
      }

      // Final system health check
      const finalHealthTasks = [
        {
          id: 'final-health-simple',
          tool: 'calculator',
          params: { expression: '50 + 50' }
        },
        {
          id: 'final-health-complex',
          subtasks: [
            { id: 'health-1', tool: 'calculator', params: { expression: '10 * 5' } },
            { id: 'health-2', tool: 'calculator', params: { expression: '25 + 25' } }
          ]
        }
      ];

      for (const healthTask of finalHealthTasks) {
        const result = await agent.execute(healthTask);
        expect(result.success).toBe(true);
      }

      // System should still be learning and analyzing correctly
      const stats = taskAnalyzer.getPerformanceStats();
      expect(stats.totalAnalyses).toBeGreaterThan(0);

      console.log('\n📊 Stress test completed - System remains stable');
      console.log(`Total learning records: ${stats.totalAnalyses}`);
      console.log(`Overall success rate: ${(stats.overallSuccessRate * 100).toFixed(1)}%`);
    });
  });
});