/**
 * Unit tests for TaskAnalyzer
 * Tests intelligent strategy selection, complexity analysis, and performance learning
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskAnalyzer } from '../../../src/analysis/TaskAnalyzer.js';
import { 
  TaskError,
  DependencyError,
  CircularDependencyError 
} from '../../../src/errors/ROMAErrors.js';

describe('TaskAnalyzer', () => {
  let taskAnalyzer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    taskAnalyzer = new TaskAnalyzer({
      logger: mockLogger,
      enableLearning: true,
      maxHistorySize: 100
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default options', () => {
      const analyzer = new TaskAnalyzer();
      
      expect(analyzer.performanceHistory).toEqual([]);
      expect(analyzer.strategyMetrics).toBeInstanceOf(Map);
      expect(analyzer.enableLearning).toBe(true);
      expect(analyzer.maxHistorySize).toBe(1000);
    });

    it('should initialize with custom options', () => {
      const analyzer = new TaskAnalyzer({
        enableLearning: false,
        maxHistorySize: 500,
        logger: mockLogger
      });
      
      expect(analyzer.enableLearning).toBe(false);
      expect(analyzer.maxHistorySize).toBe(500);
      expect(analyzer.logger).toBe(mockLogger);
    });

    it('should initialize strategy baselines', () => {
      const expectedStrategies = [
        'AtomicExecutionStrategy',
        'SequentialExecutionStrategy',
        'ParallelExecutionStrategy',
        'RecursiveExecutionStrategy',
        'OptimizedExecutionStrategy'
      ];

      for (const strategy of expectedStrategies) {
        expect(taskAnalyzer.strategyMetrics.has(strategy)).toBe(true);
        
        const metrics = taskAnalyzer.strategyMetrics.get(strategy);
        expect(metrics).toEqual({
          totalAttempts: 0,
          successes: 0,
          failures: 0,
          avgDuration: 0,
          successRate: 0.5
        });
      }
    });
  });

  describe('Task Analysis', () => {
    it('should analyze simple atomic task', async () => {
      const task = {
        id: 'simple-task',
        description: 'Simple atomic task',
        tool: 'test_tool'
      };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.analysisId).toBeDefined();
      expect(result.task.id).toBe('simple-task');
      expect(result.task.type).toBe('tool');
      expect(result.recommendation.strategy).toBe('AtomicExecutionStrategy');
      expect(result.recommendation.confidence).toBeGreaterThan(0.7);
      expect(result.recommendation.reasoning).toContain('Simple task structure suitable for atomic execution');
      expect(result.analysis.complexity.overallComplexity).toBeLessThan(0.5);
    });

    it('should analyze complex recursive task', async () => {
      const task = {
        id: 'complex-task',
        description: 'Complex task with multiple subtasks',
        subtasks: Array.from({ length: 10 }, (_, i) => ({
          id: `subtask-${i}`,
          description: `Subtask ${i}`,
          tool: `tool_${i}`
        }))
      };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.task.type).toBe('composite');
      expect(result.recommendation.strategy).toBe('RecursiveExecutionStrategy');
      expect(result.analysis.complexity.overallComplexity).toBeGreaterThan(0.6);
      expect(result.recommendation.reasoning).toContain('High complexity');
      expect(result.recommendation.reasoning).toContain('recursive decomposition');
    });

    it('should analyze parallel execution candidate', async () => {
      const task = {
        id: 'parallel-task',
        description: 'Task with independent subtasks',
        subtasks: [
          { id: 'independent1', tool: 'tool1' },
          { id: 'independent2', tool: 'tool2' },
          { id: 'independent3', tool: 'tool3' },
          { id: 'independent4', tool: 'tool4' }
        ]
      };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.recommendation.strategy).toBe('ParallelExecutionStrategy');
      expect(result.analysis.parallelization.canParallelize).toBe(true);
      expect(result.analysis.parallelization.efficiency).toBe(1.0);
      expect(result.recommendation.parameters.maxConcurrency).toBeDefined();
      expect(result.recommendation.reasoning).toContain('parallelization efficiency');
    });

    it('should analyze task with dependencies', async () => {
      const task = {
        id: 'dependency-task',
        description: 'Task with dependencies',
        subtasks: [
          { 
            id: 'task1', 
            tool: 'tool1'
          },
          { 
            id: 'task2', 
            tool: 'tool2',
            dependencies: ['task1']
          },
          { 
            id: 'task3', 
            tool: 'tool3',
            dependencies: ['task2']
          }
        ]
      };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.recommendation.strategy).toBe('SequentialExecutionStrategy');
      expect(result.analysis.dependencies.count).toBe(0); // Root task has no dependencies
      expect(result.recommendation.reasoning).toContain('dependencies require ordered execution');
    });

    it('should handle analysis errors gracefully', async () => {
      const invalidTask = null;

      const result = await taskAnalyzer.analyzeTask(invalidTask);

      expect(result.error).toBeDefined();
      expect(result.recommendation.strategy).toBe('AtomicExecutionStrategy');
      expect(result.recommendation.confidence).toBe(0.5);
      expect(result.metadata.fallback).toBe(true);
    });
  });

  describe('Complexity Analysis', () => {
    it('should analyze structural complexity', async () => {
      const task = {
        id: 'structural-test',
        subtasks: [
          { 
            id: 'level1',
            subtasks: [
              { id: 'level2a' },
              { id: 'level2b', subtasks: [{ id: 'level3' }] }
            ]
          }
        ]
      };

      const complexity = await taskAnalyzer.analyzeComplexity(task);

      expect(complexity.structural).toBeGreaterThan(0);
      expect(complexity.factors).toContain('1 subtasks');
      expect(complexity.factors).toContain('3 nesting levels');
    });

    it('should analyze computational complexity', async () => {
      const task = {
        id: 'computational-test',
        tool: 'complex_tool',
        prompt: 'Complex LLM processing task',
        execute: () => {}
      };

      const complexity = await taskAnalyzer.analyzeComplexity(task);

      expect(complexity.computational).toBeGreaterThan(0);
      expect(complexity.factors).toContain('tool execution');
      expect(complexity.factors).toContain('LLM processing');
      expect(complexity.factors).toContain('custom function');
    });

    it('should analyze dependency complexity', async () => {
      const task = {
        id: 'dependency-test',
        dependencies: ['dep1', 'dep2', 'dep3']
      };

      const complexity = await taskAnalyzer.analyzeComplexity(task);

      expect(complexity.dependency).toBeGreaterThan(0);
      expect(complexity.factors).toContain('3 dependencies');
    });

    it('should normalize complexity to 0-1 scale', async () => {
      const highComplexityTask = {
        id: 'high-complexity',
        tool: 'tool',
        prompt: 'prompt',
        execute: () => {},
        dependencies: Array.from({ length: 20 }, (_, i) => `dep-${i}`),
        subtasks: Array.from({ length: 50 }, (_, i) => ({ id: `sub-${i}` }))
      };

      const complexity = await taskAnalyzer.analyzeComplexity(highComplexityTask);

      expect(complexity.overallComplexity).toBeGreaterThanOrEqual(0);
      expect(complexity.overallComplexity).toBeLessThanOrEqual(1);
    });
  });

  describe('Dependency Analysis', () => {
    it('should analyze simple dependencies', async () => {
      const task = {
        id: 'dep-test',
        dependencies: ['string-dep', { id: 'object-dep' }, { type: 'typed-dep' }]
      };

      const analysis = await taskAnalyzer.analyzeDependencies(task);

      expect(analysis.count).toBe(3);
      expect(analysis.types).toEqual(['simple', 'complex', 'typed-dep']);
      expect(analysis.hasCircular).toBe(false);
      expect(analysis.parallelizable).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const task = {
        id: 'circular-test',
        subtasks: [
          { id: 'A', dependencies: ['B'] },
          { id: 'B', dependencies: ['C'] },
          { id: 'C', dependencies: ['A'] }
        ]
      };

      const analysis = await taskAnalyzer.analyzeDependencies(task);

      expect(analysis.hasCircular).toBe(true);
      expect(analysis.parallelizable).toBe(false);
    });

    it('should build dependency graph correctly', async () => {
      const task = {
        id: 'graph-test',
        subtasks: [
          { id: 'A' },
          { id: 'B', dependencies: ['A'] },
          { id: 'C', dependencies: ['A', 'B'] }
        ]
      };

      const analysis = await taskAnalyzer.analyzeDependencies(task);

      expect(analysis.dependencyGraph).toBeDefined();
      expect(analysis.dependencyGraph.size).toBe(3);
      expect(analysis.hasCircular).toBe(false);
      expect(analysis.parallelizable).toBe(false); // Dependencies prevent full parallelization
    });

    it('should handle tasks without dependencies', async () => {
      const task = { id: 'no-deps' };

      const analysis = await taskAnalyzer.analyzeDependencies(task);

      expect(analysis.count).toBe(0);
      expect(analysis.types).toEqual([]);
      expect(analysis.hasCircular).toBe(false);
      expect(analysis.parallelizable).toBe(true);
      expect(analysis.criticalPath).toEqual([]);
    });
  });

  describe('Resource Analysis', () => {
    it('should estimate resource requirements for small task', async () => {
      const task = {
        id: 'small-task',
        tool: 'simple_tool',
        subtasks: [{ id: 'sub1' }, { id: 'sub2' }]
      };

      const analysis = await taskAnalyzer.analyzeResourceRequirements(task, {});

      expect(analysis.memory).toBe('low');
      expect(analysis.cpu).toBe('medium');
      expect(analysis.scalability).toBe('good');
    });

    it('should estimate resource requirements for large task', async () => {
      const task = {
        id: 'large-task',
        subtasks: Array.from({ length: 60 }, (_, i) => ({ id: `sub-${i}` }))
      };

      const analysis = await taskAnalyzer.analyzeResourceRequirements(task, {});

      expect(analysis.memory).toBe('high');
      expect(analysis.cpu).toBe('high');
      expect(analysis.scalability).toBe('poor');
    });

    it('should consider I/O operations', async () => {
      const task = {
        id: 'io-task',
        createsFiles: true,
        readsFiles: true
      };

      const analysis = await taskAnalyzer.analyzeResourceRequirements(task, {});

      expect(analysis.io).toBe('medium');
    });

    it('should consider network operations', async () => {
      const task = {
        id: 'network-task',
        tool: 'api_tool',
        prompt: 'Make API calls'
      };

      const analysis = await taskAnalyzer.analyzeResourceRequirements(task, {});

      expect(analysis.network).toBe('medium');
    });
  });

  describe('Parallelization Analysis', () => {
    it('should identify parallelizable tasks', async () => {
      const task = {
        id: 'parallel-test',
        subtasks: [
          { id: 'independent1' },
          { id: 'independent2' },
          { id: 'independent3' }
        ]
      };

      const analysis = await taskAnalyzer.analyzeParallelizationPotential(task);

      expect(analysis.canParallelize).toBe(true);
      expect(analysis.maxParallelism).toBe(3);
      expect(analysis.efficiency).toBe(1.0);
    });

    it('should identify bottlenecks', async () => {
      const task = {
        id: 'bottleneck-test',
        subtasks: [
          { id: 'task1', tool: 'api_tool' },
          { id: 'task2', createsFiles: true },
          { id: 'task3' }
        ]
      };

      const analysis = await taskAnalyzer.analyzeParallelizationPotential(task);

      expect(analysis.bottlenecks).toContain('external_api_calls');
      expect(analysis.bottlenecks).toContain('file_io');
      expect(analysis.efficiency).toBeLessThan(1.0);
    });

    it('should handle tasks with dependencies', async () => {
      const task = {
        id: 'dependent-test',
        subtasks: [
          { id: 'task1' },
          { id: 'task2', dependencies: ['task1'] }
        ]
      };

      const analysis = await taskAnalyzer.analyzeParallelizationPotential(task);

      expect(analysis.canParallelize).toBe(true); // One independent task
      expect(analysis.maxParallelism).toBe(1);
      expect(analysis.efficiency).toBe(0.5);
    });

    it('should handle single task', async () => {
      const task = {
        id: 'single-test',
        subtasks: [{ id: 'only-task' }]
      };

      const analysis = await taskAnalyzer.analyzeParallelizationPotential(task);

      expect(analysis.canParallelize).toBe(false);
      expect(analysis.maxParallelism).toBe(1);
      expect(analysis.efficiency).toBe(0.0);
    });
  });

  describe('Strategy Recommendation', () => {
    it('should recommend atomic for circular dependencies', async () => {
      const complexityAnalysis = { overallComplexity: 0.5 };
      const dependencyAnalysis = { hasCircular: true, count: 3 };
      const resourceAnalysis = { scalability: 'good' };
      const parallelizationAnalysis = { canParallelize: false, efficiency: 0 };

      const recommendation = await taskAnalyzer.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        {}
      );

      expect(recommendation.strategy).toBe('AtomicExecutionStrategy');
      expect(recommendation.reasoning).toContain('Circular dependencies detected');
    });

    it('should recommend parallel for high parallelization potential', async () => {
      const complexityAnalysis = { overallComplexity: 0.4 };
      const dependencyAnalysis = { hasCircular: false, count: 0 };
      const resourceAnalysis = { scalability: 'good' };
      const parallelizationAnalysis = { canParallelize: true, efficiency: 0.8, maxParallelism: 5 };

      const recommendation = await taskAnalyzer.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        {}
      );

      expect(recommendation.strategy).toBe('ParallelExecutionStrategy');
      expect(recommendation.reasoning).toContain('High parallelization efficiency');
      expect(recommendation.parameters.maxConcurrency).toBe(5);
      expect(recommendation.alternatives).toHaveLength(1);
      expect(recommendation.alternatives[0].strategy).toBe('SequentialExecutionStrategy');
    });

    it('should recommend recursive for high complexity', async () => {
      const complexityAnalysis = { overallComplexity: 0.8 };
      const dependencyAnalysis = { hasCircular: false, count: 2 };
      const resourceAnalysis = { scalability: 'good' };
      const parallelizationAnalysis = { canParallelize: false, efficiency: 0.3 };

      const recommendation = await taskAnalyzer.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        {}
      );

      expect(recommendation.strategy).toBe('RecursiveExecutionStrategy');
      expect(recommendation.reasoning).toContain('High complexity');
      expect(recommendation.reasoning).toContain('recursive decomposition');
    });

    it('should recommend sequential for dependencies', async () => {
      const complexityAnalysis = { overallComplexity: 0.3 };
      const dependencyAnalysis = { hasCircular: false, count: 5 };
      const resourceAnalysis = { scalability: 'good' };
      const parallelizationAnalysis = { canParallelize: false, efficiency: 0.2 };

      const recommendation = await taskAnalyzer.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        {}
      );

      expect(recommendation.strategy).toBe('SequentialExecutionStrategy');
      expect(recommendation.reasoning).toContain('dependencies require ordered execution');
    });

    it('should include historical recommendations when learning enabled', async () => {
      // Add some performance history
      taskAnalyzer.performanceHistory = [
        { strategy: 'ParallelExecutionStrategy', taskComplexity: 0.4, success: true },
        { strategy: 'ParallelExecutionStrategy', taskComplexity: 0.45, success: true },
        { strategy: 'RecursiveExecutionStrategy', taskComplexity: 0.4, success: false }
      ];

      const complexityAnalysis = { overallComplexity: 0.42 };
      const dependencyAnalysis = { hasCircular: false, count: 0 };
      const resourceAnalysis = { scalability: 'good' };
      const parallelizationAnalysis = { canParallelize: false, efficiency: 0.3 };

      const recommendation = await taskAnalyzer.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        {}
      );

      expect(recommendation.alternatives.some(alt => 
        alt.reason.includes('Historical performance')
      )).toBe(true);
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence for circular dependencies', () => {
      const complexityAnalysis = { overallComplexity: 0.5 };
      const dependencyAnalysis = { hasCircular: true, count: 3 };
      const resourceAnalysis = { scalability: 'good' };
      const recommendation = { strategy: 'AtomicExecutionStrategy' };

      const confidence = taskAnalyzer.calculateRecommendationConfidence(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        recommendation
      );

      expect(confidence).toBe(0.95);
    });

    it('should have high confidence for independent parallel tasks', () => {
      const complexityAnalysis = { overallComplexity: 0.4 };
      const dependencyAnalysis = { hasCircular: false, count: 0 };
      const resourceAnalysis = { scalability: 'good' };
      const recommendation = { strategy: 'ParallelExecutionStrategy' };

      const confidence = taskAnalyzer.calculateRecommendationConfidence(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        recommendation
      );

      expect(confidence).toBe(0.9);
    });

    it('should have lower confidence for very complex tasks', () => {
      const complexityAnalysis = { overallComplexity: 0.9 };
      const dependencyAnalysis = { hasCircular: false, count: 5 };
      const resourceAnalysis = { scalability: 'poor' };
      const recommendation = { strategy: 'RecursiveExecutionStrategy' };

      const confidence = taskAnalyzer.calculateRecommendationConfidence(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        recommendation
      );

      expect(confidence).toBeLessThan(0.7);
    });

    it('should factor in historical success rate when learning enabled', () => {
      // Set up strategy metrics
      taskAnalyzer.strategyMetrics.set('AtomicExecutionStrategy', {
        totalAttempts: 10,
        successes: 9,
        failures: 1,
        avgDuration: 1000,
        successRate: 0.9
      });

      const complexityAnalysis = { overallComplexity: 0.2 };
      const dependencyAnalysis = { hasCircular: false, count: 0 };
      const resourceAnalysis = { scalability: 'good' };
      const recommendation = { strategy: 'AtomicExecutionStrategy' };

      const confidence = taskAnalyzer.calculateRecommendationConfidence(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        recommendation
      );

      expect(confidence).toBeGreaterThan(0.8);
    });
  });


  describe('Helper Methods', () => {
    it('should classify task types correctly', () => {
      expect(taskAnalyzer.classifyTaskType({ tool: 'test' })).toBe('tool');
      expect(taskAnalyzer.classifyTaskType({ toolName: 'test' })).toBe('tool');
      expect(taskAnalyzer.classifyTaskType({ execute: () => {} })).toBe('function');
      expect(taskAnalyzer.classifyTaskType({ fn: () => {} })).toBe('function');
      expect(taskAnalyzer.classifyTaskType({ prompt: 'test' })).toBe('llm');
      expect(taskAnalyzer.classifyTaskType({ description: 'test' })).toBe('llm');
      expect(taskAnalyzer.classifyTaskType({ subtasks: [{}] })).toBe('composite');
      expect(taskAnalyzer.classifyTaskType({})).toBe('simple');
    });

    it('should calculate nesting levels correctly', () => {
      const subtasks = [
        { id: 'flat' },
        { 
          id: 'nested1',
          subtasks: [
            { id: 'level2' },
            { 
              id: 'deeper',
              subtasks: [{ id: 'level3' }]
            }
          ]
        }
      ];

      const levels = taskAnalyzer.calculateNestingLevels(subtasks);
      expect(levels).toBe(3);
    });

    it('should estimate execution time based on task characteristics', () => {
      const simpleTask = { id: 'simple' };
      const toolTask = { id: 'tool', tool: 'test_tool' };
      const llmTask = { id: 'llm', prompt: 'test prompt' };
      const complexTask = { 
        id: 'complex', 
        tool: 'test_tool',
        prompt: 'test prompt',
        subtasks: Array.from({ length: 5 }, (_, i) => ({ id: `sub-${i}` }))
      };

      expect(taskAnalyzer.estimateExecutionTime(simpleTask)).toBe(1000);
      expect(taskAnalyzer.estimateExecutionTime(toolTask)).toBe(3000);
      expect(taskAnalyzer.estimateExecutionTime(llmTask)).toBe(6000);
      expect(taskAnalyzer.estimateExecutionTime(complexTask)).toBe(10500);
    });

    it('should classify errors correctly', () => {
      expect(taskAnalyzer.classifyError(new Error('timeout occurred'))).toBe('timeout');
      expect(taskAnalyzer.classifyError(new Error('network failure'))).toBe('network');
      expect(taskAnalyzer.classifyError(new Error('dependency issue'))).toBe('dependency');
      expect(taskAnalyzer.classifyError(new Error('validation failed'))).toBe('validation');
      expect(taskAnalyzer.classifyError(new Error('unknown issue'))).toBe('unknown');
    });

    it('should generate unique analysis IDs', () => {
      const id1 = taskAnalyzer.generateAnalysisId();
      const id2 = taskAnalyzer.generateAnalysisId();

      expect(id1).toMatch(/^analysis_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^analysis_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined tasks gracefully', async () => {
      const result1 = await taskAnalyzer.analyzeTask(null);
      const result2 = await taskAnalyzer.analyzeTask(undefined);

      expect(result1.error).toBeDefined();
      expect(result2.error).toBeDefined();
      expect(result1.recommendation.strategy).toBe('AtomicExecutionStrategy');
      expect(result2.recommendation.strategy).toBe('AtomicExecutionStrategy');
    });

    it('should handle empty subtasks arrays', async () => {
      const task = { id: 'empty', subtasks: [] };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.recommendation).toBeDefined();
      expect(result.analysis.parallelization.canParallelize).toBe(false);
    });

    it('should handle malformed dependency objects', async () => {
      const task = {
        id: 'malformed',
        subtasks: [
          { id: 'task1', dependencies: [null, undefined, '', { malformed: true }] }
        ]
      };

      const result = await taskAnalyzer.analyzeTask(task);
      
      expect(result.success !== false).toBe(true); // Should not fail completely
    });

    it('should handle circular dependency detection errors', async () => {
      const task = {
        id: 'circular-error',
        subtasks: [
          { id: 'A', dependencies: ['B'] },
          { id: 'B', dependencies: ['A'] }
        ]
      };

      const result = await taskAnalyzer.analyzeTask(task);

      expect(result.analysis.dependencies.hasCircular).toBe(true);
      expect(result.recommendation.strategy).toBe('AtomicExecutionStrategy');
    });

    it('should handle missing context gracefully', async () => {
      const task = { id: 'no-context' };

      const result = await taskAnalyzer.analyzeTask(task); // No context provided

      expect(result.analysisId).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });
  });
});