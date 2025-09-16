/**
 * StrategySelector - Selects appropriate execution strategy for tasks
 * Single responsibility: Strategy selection and evaluation logic
 */

import { Logger } from '../../utils/Logger.js';
import { 
  StrategyError, 
  StrategySelectionError, 
  ValidationError 
} from '../../errors/ROMAErrors.js';

export class StrategySelector {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('StrategySelector');
    this.fallbackStrategyName = options.fallbackStrategy || 'AtomicExecutionStrategy';
    this.enableLogging = options.enableLogging !== false;
  }

  /**
   * Select the best strategy for a task
   * @param {Object} task - Task to execute
   * @param {Object} context - Execution context
   * @param {StrategyRegistry} registry - Strategy registry
   * @returns {Object} - Selected strategy instance
   */
  select(taskDefinition, executionContext, strategyRegistry) {
    if (!taskDefinition) {
      throw new ValidationError('Task is required for strategy selection', [], {
        operation: 'select'
      });
    }
    if (!executionContext) {
      throw new ValidationError('ExecutionContext is required for strategy selection', [], {
        operation: 'select'
      });
    }
    if (!strategyRegistry) {
      throw new ValidationError('StrategyRegistry is required for strategy selection', [], {
        operation: 'select'
      });
    }

    const priorityOrderedStrategies = strategyRegistry.getSortedByPriority();
    const taskIdentifier = taskDefinition.id || taskDefinition.taskId || 'unknown';

    if (this.enableLogging) {
      this.logger.debug('Starting strategy selection', {
        taskId: taskIdentifier,
        availableStrategies: priorityOrderedStrategies.length
      });
    }

    // Find first strategy that can handle the task
    for (const candidateStrategy of priorityOrderedStrategies) {
      try {
        if (candidateStrategy.canHandle(taskDefinition, executionContext)) {
          if (this.enableLogging) {
            this.logger.debug('Strategy selected', {
              taskId: taskIdentifier,
              strategy: candidateStrategy.constructor.name,
              priority: strategyRegistry.getPriority(candidateStrategy.constructor.name)
            });
          }
          return candidateStrategy;
        }
      } catch (evaluationError) {
        // Log strategy evaluation error but continue
        if (this.enableLogging) {
          this.logger.warn('Strategy evaluation failed', {
            strategy: candidateStrategy.constructor.name,
            error: evaluationError.message,
            taskId: taskIdentifier
          });
        }
        continue;
      }
    }

    // If no strategy can handle the task, return fallback
    const defaultFallbackStrategy = strategyRegistry.get(this.fallbackStrategyName);
    if (defaultFallbackStrategy) {
      if (this.enableLogging) {
        this.logger.warn('Using fallback strategy', {
          taskId: taskIdentifier,
          fallback: this.fallbackStrategyName,
          reason: 'No suitable strategy found'
        });
      }
      return defaultFallbackStrategy;
    }

    throw new StrategySelectionError(
      `No suitable execution strategy found for task ${taskIdentifier}`,
      taskIdentifier,
      priorityOrderedStrategies.map(strategyInstance => strategyInstance.constructor.name)
    );
  }

  /**
   * Evaluate which strategies can handle a task
   * @param {Object} task - Task to evaluate
   * @param {Object} context - Execution context
   * @param {StrategyRegistry} registry - Strategy registry
   * @returns {Array<Object>} - Array of strategy evaluations
   */
  evaluate(task, context, registry) {
    if (!task || !context || !registry) {
      throw new Error('Task, context, and registry are required for strategy evaluation');
    }

    const strategies = registry.getSortedByPriority();
    const evaluations = [];
    const taskId = task.id || task.taskId || 'unknown';

    for (const strategy of strategies) {
      const strategyName = strategy.constructor.name;
      const priority = registry.getPriority(strategyName);
      
      try {
        const canHandle = strategy.canHandle(task, context);
        const evaluation = {
          strategyName,
          canHandle,
          priority,
          reason: canHandle ? 'Can handle task' : 'Cannot handle task'
        };

        // Add complexity estimate if available
        if (canHandle && typeof strategy.estimateComplexity === 'function') {
          try {
            evaluation.complexity = strategy.estimateComplexity(task, context);
          } catch (error) {
            evaluation.complexityError = error.message;
          }
        }

        evaluations.push(evaluation);
      } catch (error) {
        evaluations.push({
          strategyName,
          canHandle: false,
          priority,
          reason: `Evaluation error: ${error.message}`,
          error: error.message
        });
      }
    }

    if (this.enableLogging) {
      this.logger.debug('Strategy evaluation completed', {
        taskId,
        totalStrategies: evaluations.length,
        canHandleCount: evaluations.filter(e => e.canHandle).length
      });
    }

    return evaluations;
  }

  /**
   * Select strategy with detailed evaluation
   * @param {Object} task - Task to execute
   * @param {Object} context - Execution context
   * @param {StrategyRegistry} registry - Strategy registry
   * @returns {Object} - Selection result with evaluation details
   */
  selectWithEvaluation(task, context, registry) {
    const evaluations = this.evaluate(task, context, registry);
    const selectedStrategy = this.select(task, context, registry);
    
    return {
      selected: {
        strategy: selectedStrategy,
        name: selectedStrategy.constructor.name,
        priority: registry.getPriority(selectedStrategy.constructor.name)
      },
      evaluations,
      fallbackUsed: selectedStrategy === registry.get(this.fallbackStrategyName),
      selectionTime: Date.now()
    };
  }

  /**
   * Find best strategies for a task (multiple candidates)
   * @param {Object} task - Task to evaluate
   * @param {Object} context - Execution context
   * @param {StrategyRegistry} registry - Strategy registry
   * @param {number} limit - Maximum number of strategies to return
   * @returns {Array<Object>} - Best strategy candidates
   */
  findBestCandidates(task, context, registry, limit = 3) {
    const evaluations = this.evaluate(task, context, registry);
    
    return evaluations
      .filter(e => e.canHandle)
      .sort((a, b) => {
        // Sort by priority first, then by complexity if available
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        if (a.complexity !== undefined && b.complexity !== undefined) {
          return a.complexity - b.complexity; // Lower complexity is better
        }
        return 0;
      })
      .slice(0, limit)
      .map(e => ({
        strategy: registry.get(e.strategyName),
        ...e
      }));
  }

  /**
   * Check if a specific strategy can handle a task
   * @param {string} strategyName - Strategy name to check
   * @param {Object} task - Task to check
   * @param {Object} context - Execution context
   * @param {StrategyRegistry} registry - Strategy registry
   * @returns {Object} - Check result
   */
  checkStrategy(strategyName, task, context, registry) {
    const strategy = registry.get(strategyName);
    if (!strategy) {
      return {
        exists: false,
        error: `Strategy ${strategyName} not found in registry`
      };
    }

    try {
      const canHandle = strategy.canHandle(task, context);
      const result = {
        exists: true,
        canHandle,
        strategyName,
        priority: registry.getPriority(strategyName)
      };

      // Add complexity estimate if available
      if (canHandle && typeof strategy.estimateComplexity === 'function') {
        try {
          result.complexity = strategy.estimateComplexity(task, context);
        } catch (error) {
          result.complexityError = error.message;
        }
      }

      return result;
    } catch (error) {
      return {
        exists: true,
        canHandle: false,
        strategyName,
        error: error.message
      };
    }
  }

  /**
   * Get selection statistics
   * @param {Array<Object>} evaluationHistory - History of evaluations
   * @returns {Object} - Selection statistics
   */
  getStatistics(evaluationHistory = []) {
    if (evaluationHistory.length === 0) {
      return {
        totalSelections: 0,
        strategyUsage: {},
        fallbackUsage: 0,
        averageEvaluationTime: 0
      };
    }

    const strategyUsage = {};
    let fallbackUsage = 0;
    let totalEvaluationTime = 0;

    for (const evaluation of evaluationHistory) {
      const strategyName = evaluation.selected?.name;
      if (strategyName) {
        strategyUsage[strategyName] = (strategyUsage[strategyName] || 0) + 1;
      }
      
      if (evaluation.fallbackUsed) {
        fallbackUsage++;
      }
      
      if (evaluation.evaluationTime) {
        totalEvaluationTime += evaluation.evaluationTime;
      }
    }

    return {
      totalSelections: evaluationHistory.length,
      strategyUsage,
      fallbackUsage,
      fallbackRate: (fallbackUsage / evaluationHistory.length) * 100,
      averageEvaluationTime: totalEvaluationTime / evaluationHistory.length,
      mostUsedStrategy: Object.entries(strategyUsage)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }

  /**
   * Set fallback strategy
   * @param {string} strategyName - Name of fallback strategy
   */
  setFallbackStrategy(strategyName) {
    this.fallbackStrategyName = strategyName;
  }

  /**
   * Get fallback strategy name
   * @returns {string} - Fallback strategy name
   */
  getFallbackStrategy() {
    return this.fallbackStrategyName;
  }
}