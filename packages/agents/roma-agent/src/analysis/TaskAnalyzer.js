/**
 * TaskAnalyzer - Provides intelligent strategy selection for task execution
 * 
 * Features:
 * - Task complexity analysis
 * - Dependency graph analysis
 * - Resource requirement estimation
 * - Strategy recommendation based on task characteristics
 * - Performance pattern learning
 */

import { Logger } from '../utils/Logger.js';
import { 
  TaskError,
  DependencyError,
  CircularDependencyError 
} from '../errors/ROMAErrors.js';

export class TaskAnalyzer {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('TaskAnalyzer');
    this.performanceHistory = [];
    this.strategyMetrics = new Map();
    this.enableLearning = options.enableLearning !== false;
    this.maxHistorySize = options.maxHistorySize || 1000;
    
    // Initialize strategy performance baselines
    this.initializeStrategyBaselines();
  }

  /**
   * Analyze task and recommend optimal execution strategy
   * @param {Object} task - Task to analyze
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Analysis result with strategy recommendation
   */
  async analyzeTask(task, context = {}) {
    const analysisId = this.generateAnalysisId();
    const startTime = Date.now();

    try {
      this.logger.debug('Starting task analysis', {
        analysisId,
        taskId: task?.id || 'unknown',
        hasSubtasks: !!(task?.subtasks && task.subtasks.length > 0),
        hasDependencies: !!(task?.dependencies && task.dependencies.length > 0)
      });

      // Perform comprehensive analysis
      const complexityAnalysis = await this.analyzeComplexity(task);
      const dependencyAnalysis = await this.analyzeDependencies(task);
      const resourceAnalysis = await this.analyzeResourceRequirements(task, context);
      const parallelizationAnalysis = await this.analyzeParallelizationPotential(task);
      
      // Generate strategy recommendation
      const recommendation = await this.recommendStrategy(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        parallelizationAnalysis,
        context
      );

      // Calculate confidence score
      const confidence = this.calculateRecommendationConfidence(
        complexityAnalysis,
        dependencyAnalysis,
        resourceAnalysis,
        recommendation
      );

      const result = {
        analysisId,
        task: {
          id: task?.id || 'unknown',
          type: this.classifyTaskType(task),
          estimatedComplexity: complexityAnalysis.overallComplexity
        },
        recommendation: {
          strategy: recommendation.strategy,
          confidence: confidence,
          reasoning: recommendation.reasoning,
          alternatives: recommendation.alternatives
        },
        analysis: {
          complexity: complexityAnalysis,
          dependencies: dependencyAnalysis,
          resources: resourceAnalysis,
          parallelization: parallelizationAnalysis
        },
        metadata: {
          analysisTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

      this.logger.debug('Task analysis completed', {
        analysisId,
        recommendedStrategy: recommendation.strategy,
        confidence: Math.round(confidence * 100),
        analysisTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Task analysis failed', {
        analysisId,
        error: error.message,
        taskId: task?.id || 'unknown'
      });

      return {
        analysisId,
        error: error.message,
        recommendation: {
          strategy: 'AtomicExecutionStrategy',
          confidence: 0.5,
          reasoning: ['Analysis failed, defaulting to safe atomic execution'],
          alternatives: []
        },
        metadata: {
          analysisTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          fallback: true
        }
      };
    }
  }

  /**
   * Analyze task complexity
   * @param {Object} task - Task to analyze
   * @returns {Promise<Object>} Complexity analysis
   */
  async analyzeComplexity(task) {
    const analysis = {
      structural: 0,
      computational: 0,
      dependency: 0,
      overallComplexity: 0,
      factors: []
    };

    // Structural complexity (subtasks, nesting)
    if (task.subtasks && Array.isArray(task.subtasks)) {
      analysis.structural += task.subtasks.length * 0.2;
      analysis.factors.push(`${task.subtasks.length} subtasks`);

      // Check for nested subtasks
      const nestedLevels = this.calculateNestingLevels(task.subtasks);
      analysis.structural += nestedLevels * 0.3;
      if (nestedLevels > 1) {
        analysis.factors.push(`${nestedLevels} nesting levels`);
      }
    }

    // Computational complexity (tools, operations)
    if (task.tool || task.toolName) {
      analysis.computational += 0.3;
      analysis.factors.push('tool execution');
    }

    if (task.execute || task.fn) {
      analysis.computational += 0.4;
      analysis.factors.push('custom function');
    }

    if (task.prompt || task.description) {
      analysis.computational += 0.5;
      analysis.factors.push('LLM processing');
    }

    // Dependency complexity
    if (task.dependencies && Array.isArray(task.dependencies)) {
      analysis.dependency += task.dependencies.length * 0.15;
      analysis.factors.push(`${task.dependencies.length} dependencies`);
    }

    // Calculate overall complexity
    analysis.overallComplexity = analysis.structural + analysis.computational + analysis.dependency;

    // Normalize to 0-1 scale
    analysis.overallComplexity = Math.min(analysis.overallComplexity, 1.0);

    return analysis;
  }

  /**
   * Analyze task dependencies
   * @param {Object} task - Task to analyze
   * @returns {Promise<Object>} Dependency analysis
   */
  async analyzeDependencies(task) {
    const analysis = {
      count: 0,
      types: [],
      hasCircular: false,
      parallelizable: true,
      criticalPath: [],
      dependencyGraph: null
    };

    if (!task.dependencies || !Array.isArray(task.dependencies)) {
      return analysis;
    }

    analysis.count = task.dependencies.length;

    // Classify dependency types
    for (const dep of task.dependencies) {
      if (typeof dep === 'string') {
        analysis.types.push('simple');
      } else if (dep.type) {
        analysis.types.push(dep.type);
      } else {
        analysis.types.push('complex');
      }
    }

    // Build dependency graph for further analysis
    if (task.subtasks) {
      analysis.dependencyGraph = this.buildDependencyGraph(task);
      
      // Check for circular dependencies
      try {
        analysis.hasCircular = this.detectCircularDependencies(analysis.dependencyGraph);
      } catch (error) {
        if (error instanceof CircularDependencyError) {
          analysis.hasCircular = true;
          analysis.cycles = error.cycles;
        }
      }

      // Analyze parallelization potential
      analysis.parallelizable = !analysis.hasCircular && this.canParallelize(analysis.dependencyGraph);
      
      // Calculate critical path
      if (!analysis.hasCircular) {
        analysis.criticalPath = this.calculateCriticalPath(analysis.dependencyGraph);
      }
    }

    return analysis;
  }

  /**
   * Analyze resource requirements
   * @param {Object} task - Task to analyze
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Resource analysis
   */
  async analyzeResourceRequirements(task, context) {
    const analysis = {
      memory: 'low',
      cpu: 'low',
      io: 'low',
      network: 'low',
      estimatedDuration: 0,
      scalability: 'good'
    };

    // Estimate based on task characteristics
    const subtaskCount = task.subtasks ? task.subtasks.length : 0;
    
    // Memory requirements
    if (subtaskCount > 50) {
      analysis.memory = 'high';
    } else if (subtaskCount > 10) {
      analysis.memory = 'medium';
    }

    // CPU requirements
    if (task.tool || task.execute) {
      analysis.cpu = 'medium';
    }
    if (subtaskCount > 20) {
      analysis.cpu = 'high';
    }

    // I/O requirements
    if (task.createsFiles || task.readsFiles) {
      analysis.io = 'medium';
    }

    // Network requirements
    if (task.tool || task.prompt) {
      analysis.network = 'medium';
    }

    // Estimate duration based on historical data
    analysis.estimatedDuration = this.estimateExecutionTime(task);

    // Scalability assessment
    if (subtaskCount > 100) {
      analysis.scalability = 'poor';
    } else if (subtaskCount > 50) {
      analysis.scalability = 'fair';
    }

    return analysis;
  }

  /**
   * Analyze parallelization potential
   * @param {Object} task - Task to analyze
   * @returns {Promise<Object>} Parallelization analysis
   */
  async analyzeParallelizationPotential(task) {
    const analysis = {
      canParallelize: false,
      maxParallelism: 1,
      bottlenecks: [],
      efficiency: 0.0
    };

    if (!task.subtasks || task.subtasks.length < 2) {
      return analysis;
    }

    // Check for independent subtasks
    const independentTasks = task.subtasks.filter(subtask => 
      !subtask.dependencies || subtask.dependencies.length === 0
    );

    if (independentTasks.length > 1) {
      analysis.canParallelize = true;
      analysis.maxParallelism = independentTasks.length;
      analysis.efficiency = independentTasks.length / task.subtasks.length;
    }

    // Identify bottlenecks
    if (task.subtasks.some(subtask => subtask.tool || subtask.prompt)) {
      analysis.bottlenecks.push('external_api_calls');
    }

    if (task.subtasks.some(subtask => subtask.createsFiles)) {
      analysis.bottlenecks.push('file_io');
    }

    // Adjust efficiency based on bottlenecks
    analysis.efficiency *= Math.max(0.1, 1.0 - (analysis.bottlenecks.length * 0.2));

    return analysis;
  }

  /**
   * Recommend optimal strategy based on analysis
   * @param {Object} complexityAnalysis - Complexity analysis
   * @param {Object} dependencyAnalysis - Dependency analysis  
   * @param {Object} resourceAnalysis - Resource analysis
   * @param {Object} parallelizationAnalysis - Parallelization analysis
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Strategy recommendation
   */
  async recommendStrategy(complexityAnalysis, dependencyAnalysis, resourceAnalysis, parallelizationAnalysis, context) {
    const recommendation = {
      strategy: 'AtomicExecutionStrategy',
      reasoning: [],
      alternatives: [],
      parameters: {}
    };

    // Strategy selection logic based on analysis
    
    // 1. Check for circular dependencies (forces atomic or sequential)
    if (dependencyAnalysis.hasCircular) {
      recommendation.strategy = 'AtomicExecutionStrategy';
      recommendation.reasoning.push('Circular dependencies detected, requiring atomic execution');
      return recommendation;
    }

    // 2. High parallelization potential
    if (parallelizationAnalysis.canParallelize && parallelizationAnalysis.efficiency > 0.6) {
      recommendation.strategy = 'ParallelExecutionStrategy';
      recommendation.reasoning.push(`High parallelization efficiency (${Math.round(parallelizationAnalysis.efficiency * 100)}%)`);
      recommendation.parameters.maxConcurrency = Math.min(parallelizationAnalysis.maxParallelism, 10);
      
      recommendation.alternatives.push({
        strategy: 'SequentialExecutionStrategy',
        reason: 'Conservative fallback if parallel execution fails'
      });
    }
    // 3. High complexity with good structure
    else if (complexityAnalysis.overallComplexity > 0.6 && !dependencyAnalysis.hasCircular) {
      recommendation.strategy = 'RecursiveExecutionStrategy';
      recommendation.reasoning.push(`High complexity (${Math.round(complexityAnalysis.overallComplexity * 100)}%) benefits from recursive decomposition`);
      
      recommendation.alternatives.push({
        strategy: 'SequentialExecutionStrategy', 
        reason: 'Fallback for linear execution if recursion fails'
      });
    }
    // 4. Dependencies require ordering
    else if (dependencyAnalysis.count > 0) {
      recommendation.strategy = 'SequentialExecutionStrategy';
      recommendation.reasoning.push(`${dependencyAnalysis.count} dependencies require ordered execution`);
      
      recommendation.alternatives.push({
        strategy: 'AtomicExecutionStrategy',
        reason: 'Simplified execution if dependency resolution fails'
      });
    }
    // 5. Performance optimization candidates
    else if (this.shouldUseOptimizedStrategy(complexityAnalysis, resourceAnalysis, context)) {
      recommendation.strategy = 'OptimizedExecutionStrategy';
      recommendation.reasoning.push('Task characteristics suitable for performance optimization');
      
      recommendation.alternatives.push({
        strategy: 'RecursiveExecutionStrategy',
        reason: 'Standard recursive execution as fallback'
      });
    }
    // 6. Default to atomic for simple tasks
    else {
      recommendation.strategy = 'AtomicExecutionStrategy';
      recommendation.reasoning.push('Simple task structure suitable for atomic execution');
    }

    // Apply learning from historical performance
    if (this.enableLearning) {
      const historicalRecommendation = this.getHistoricalRecommendation(complexityAnalysis, context);
      if (historicalRecommendation && historicalRecommendation !== recommendation.strategy) {
        recommendation.alternatives.unshift({
          strategy: historicalRecommendation,
          reason: 'Historical performance suggests this alternative'
        });
      }
    }

    return recommendation;
  }

  /**
   * Calculate recommendation confidence score
   * @param {Object} complexityAnalysis - Complexity analysis
   * @param {Object} dependencyAnalysis - Dependency analysis
   * @param {Object} resourceAnalysis - Resource analysis
   * @param {Object} recommendation - Strategy recommendation
   * @returns {number} Confidence score (0-1)
   */
  calculateRecommendationConfidence(complexityAnalysis, dependencyAnalysis, resourceAnalysis, recommendation) {
    let confidence = 0.7; // Base confidence

    // Increase confidence for clear-cut cases
    if (dependencyAnalysis.hasCircular) {
      confidence = 0.95; // Very confident about atomic for circular deps
    } else if (recommendation.strategy === 'ParallelExecutionStrategy' && 
               dependencyAnalysis.count === 0) {
      confidence = 0.9; // High confidence for independent parallel tasks
    } else if (complexityAnalysis.overallComplexity < 0.2) {
      confidence = 0.85; // High confidence for simple atomic tasks
    }

    // Decrease confidence for edge cases
    if (complexityAnalysis.overallComplexity > 0.8) {
      confidence *= 0.8; // Less confident for very complex tasks
    }

    if (resourceAnalysis.scalability === 'poor') {
      confidence *= 0.7; // Less confident for poor scalability
    }

    // Factor in historical success rate
    if (this.enableLearning) {
      const historicalSuccess = this.getHistoricalSuccessRate(recommendation.strategy);
      confidence = (confidence * 0.7) + (historicalSuccess * 0.3);
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Record strategy performance for learning
   * @param {string} strategy - Strategy used
   * @param {Object} analysis - Task analysis
   * @param {Object} result - Execution result
   */
  recordPerformance(strategy, analysis, result) {
    if (!this.enableLearning) return;

    const record = {
      timestamp: new Date().toISOString(),
      strategy,
      taskComplexity: analysis.complexity?.overallComplexity || 0,
      dependencyCount: analysis.dependencies?.count || 0,
      success: result.success || false,
      duration: result.duration || 0,
      errorType: result.error ? this.classifyError(result.error) : null
    };

    this.performanceHistory.push(record);

    // Maintain history size limit
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }

    // Update strategy metrics
    if (!this.strategyMetrics.has(strategy)) {
      this.strategyMetrics.set(strategy, {
        totalAttempts: 0,
        successes: 0,
        failures: 0,
        avgDuration: 0,
        successRate: 0
      });
    }

    const metrics = this.strategyMetrics.get(strategy);
    metrics.totalAttempts++;
    
    if (result.success) {
      metrics.successes++;
      metrics.avgDuration = ((metrics.avgDuration * (metrics.successes - 1)) + record.duration) / metrics.successes;
    } else {
      metrics.failures++;
    }
    
    metrics.successRate = metrics.successes / metrics.totalAttempts;

    this.logger.debug('Recorded strategy performance', {
      strategy,
      success: result.success,
      duration: record.duration,
      newSuccessRate: Math.round(metrics.successRate * 100)
    });
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    const stats = {
      totalAnalyses: this.performanceHistory.length,
      strategyMetrics: {},
      overallSuccessRate: 0,
      recommendations: {
        atomic: 0,
        sequential: 0,
        parallel: 0,
        recursive: 0,
        optimized: 0
      }
    };

    // Convert strategy metrics to plain object
    for (const [strategy, metrics] of this.strategyMetrics) {
      stats.strategyMetrics[strategy] = { ...metrics };
    }

    // Calculate overall success rate
    if (this.performanceHistory.length > 0) {
      const successes = this.performanceHistory.filter(r => r.success).length;
      stats.overallSuccessRate = successes / this.performanceHistory.length;
    }

    return stats;
  }

  /**
   * Clear performance history
   */
  clearHistory() {
    this.performanceHistory = [];
    this.strategyMetrics.clear();
    this.initializeStrategyBaselines();
    this.logger.info('Performance history cleared');
  }

  // Helper methods

  /**
   * Classify task type
   * @private
   */
  classifyTaskType(task) {
    if (!task) return 'simple';
    if (task.tool || task.toolName) return 'tool';
    if (task.execute || task.fn) return 'function';
    if (task.prompt || task.description) return 'llm';
    if (task.subtasks && task.subtasks.length > 0) return 'composite';
    return 'simple';
  }

  /**
   * Calculate nesting levels in subtasks
   * @private
   */
  calculateNestingLevels(subtasks, currentLevel = 1) {
    let maxLevel = currentLevel;
    
    for (const subtask of subtasks) {
      if (subtask.subtasks && subtask.subtasks.length > 0) {
        const nestedLevel = this.calculateNestingLevels(subtask.subtasks, currentLevel + 1);
        maxLevel = Math.max(maxLevel, nestedLevel);
      }
    }
    
    return maxLevel;
  }

  /**
   * Build dependency graph
   * @private
   */
  buildDependencyGraph(task) {
    const graph = new Map();
    
    if (!task.subtasks) return graph;
    
    // Initialize nodes
    for (const subtask of task.subtasks) {
      graph.set(subtask.id || subtask.taskId, {
        task: subtask,
        dependencies: [],
        dependents: []
      });
    }
    
    // Add edges
    for (const subtask of task.subtasks) {
      const nodeId = subtask.id || subtask.taskId;
      const node = graph.get(nodeId);
      
      if (subtask.dependencies) {
        for (const dep of subtask.dependencies) {
          const depId = typeof dep === 'string' ? dep : (dep.id || dep.taskId);
          if (graph.has(depId)) {
            node.dependencies.push(depId);
            graph.get(depId).dependents.push(nodeId);
          }
        }
      }
    }
    
    return graph;
  }

  /**
   * Detect circular dependencies
   * @private
   */
  detectCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    
    for (const nodeId of graph.keys()) {
      if (this.hasCycleDFS(nodeId, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * DFS cycle detection
   * @private
   */
  hasCycleDFS(nodeId, graph, visited, recursionStack) {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const node = graph.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        if (this.hasCycleDFS(depId, graph, visited, recursionStack)) {
          return true;
        }
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Check if graph can be parallelized
   * @private
   */
  canParallelize(graph) {
    // Count nodes with no dependencies
    let independentNodes = 0;
    for (const node of graph.values()) {
      if (node.dependencies.length === 0) {
        independentNodes++;
      }
    }
    
    return independentNodes > 1;
  }

  /**
   * Calculate critical path
   * @private
   */
  calculateCriticalPath(graph) {
    // Simplified critical path calculation
    // In a real implementation, this would use proper CPM algorithm
    let longestPath = [];
    let maxDepth = 0;
    
    for (const nodeId of graph.keys()) {
      const depth = this.calculateNodeDepth(nodeId, graph);
      if (depth > maxDepth) {
        maxDepth = depth;
        longestPath = [nodeId];
      }
    }
    
    return longestPath;
  }

  /**
   * Calculate node depth in dependency graph
   * @private
   */
  calculateNodeDepth(nodeId, graph, visited = new Set()) {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    
    const node = graph.get(nodeId);
    if (!node || node.dependencies.length === 0) return 1;
    
    let maxDepth = 0;
    for (const depId of node.dependencies) {
      const depth = this.calculateNodeDepth(depId, graph, new Set(visited));
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth + 1;
  }

  /**
   * Estimate execution time based on task characteristics
   * @private
   */
  estimateExecutionTime(task) {
    let baseTime = 1000; // 1 second base
    
    if (task.tool || task.toolName) baseTime += 2000;
    if (task.prompt || task.description) baseTime += 5000;
    if (task.subtasks) baseTime += task.subtasks.length * 500;
    
    return baseTime;
  }

  /**
   * Check if optimized strategy should be used
   * @private
   */
  shouldUseOptimizedStrategy(complexityAnalysis, resourceAnalysis, context) {
    return complexityAnalysis.overallComplexity > 0.4 && 
           complexityAnalysis.overallComplexity < 0.8 &&
           resourceAnalysis.scalability !== 'poor';
  }

  /**
   * Get historical recommendation based on similar tasks
   * @private
   */
  getHistoricalRecommendation(complexityAnalysis, context) {
    if (this.performanceHistory.length < 10) return null;
    
    // Find similar complexity tasks
    const similarTasks = this.performanceHistory.filter(record => 
      Math.abs(record.taskComplexity - complexityAnalysis.overallComplexity) < 0.2
    );
    
    if (similarTasks.length < 3) return null;
    
    // Find most successful strategy for similar tasks
    const strategySuccess = {};
    for (const record of similarTasks) {
      if (!strategySuccess[record.strategy]) {
        strategySuccess[record.strategy] = { successes: 0, total: 0 };
      }
      strategySuccess[record.strategy].total++;
      if (record.success) {
        strategySuccess[record.strategy].successes++;
      }
    }
    
    let bestStrategy = null;
    let bestRate = 0;
    
    for (const [strategy, stats] of Object.entries(strategySuccess)) {
      const rate = stats.successes / stats.total;
      if (rate > bestRate && stats.total >= 2) {
        bestRate = rate;
        bestStrategy = strategy;
      }
    }
    
    return bestStrategy;
  }

  /**
   * Get historical success rate for strategy
   * @private
   */
  getHistoricalSuccessRate(strategy) {
    const metrics = this.strategyMetrics.get(strategy);
    return metrics ? metrics.successRate : 0.5;
  }

  /**
   * Classify error type
   * @private
   */
  classifyError(error) {
    const message = error.message || error.toString();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('dependency')) return 'dependency';
    if (message.includes('resource')) return 'resource';
    if (message.includes('validation')) return 'validation';
    
    return 'unknown';
  }

  /**
   * Initialize strategy performance baselines
   * @private
   */
  initializeStrategyBaselines() {
    const strategies = [
      'AtomicExecutionStrategy',
      'SequentialExecutionStrategy', 
      'ParallelExecutionStrategy',
      'RecursiveExecutionStrategy',
      'OptimizedExecutionStrategy'
    ];
    
    for (const strategy of strategies) {
      this.strategyMetrics.set(strategy, {
        totalAttempts: 0,
        successes: 0,
        failures: 0,
        avgDuration: 0,
        successRate: 0.5 // Start with neutral baseline
      });
    }
  }

  /**
   * Generate analysis ID
   * @private
   */
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default TaskAnalyzer;