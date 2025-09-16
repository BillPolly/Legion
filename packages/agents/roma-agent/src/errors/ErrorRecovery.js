/**
 * ErrorRecovery - Implements recovery strategies for different error types
 * Single responsibility: Error recovery and state restoration
 */

import { Logger } from '../utils/Logger.js';
import { 
  TaskError,
  DependencyError,
  CircularDependencyError,
  ResourceError,
  StrategyError,
  QueueError,
  SystemError
} from './ROMAErrors.js';

export class ErrorRecovery {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('ErrorRecovery');
    this.recoveryStrategies = new Map();
    this.recoveryHistory = [];
    this.maxRecoveryAttempts = options.maxRecoveryAttempts || 3;
    this.enableStateRollback = options.enableStateRollback !== false;
    
    // Register default recovery strategies
    this.registerDefaultStrategies();
  }

  /**
   * Attempt to recover from an error
   * @param {ROMAError} error - Error to recover from
   * @param {Object} context - Recovery context
   * @returns {Promise<Object>} - Recovery result
   */
  async recover(error, context = {}) {
    const recoveryId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.logger.info('Starting error recovery', {
      recoveryId,
      errorType: error.constructor.name,
      errorCode: error.code,
      context: context
    });

    try {
      // Get appropriate recovery strategy
      const strategy = this.getRecoveryStrategy(error);
      if (!strategy) {
        return {
          success: false,
          reason: 'No recovery strategy available',
          error,
          recoveryId
        };
      }

      // Check recovery attempt limits
      const attemptCount = this.getRecoveryAttempts(error, context);
      if (attemptCount >= this.maxRecoveryAttempts) {
        return {
          success: false,
          reason: 'Maximum recovery attempts exceeded',
          attempts: attemptCount,
          error,
          recoveryId
        };
      }

      // Create recovery context
      const recoveryContext = {
        ...context,
        recoveryId,
        attemptNumber: attemptCount + 1,
        maxAttempts: this.maxRecoveryAttempts,
        startTime
      };

      // Execute recovery strategy
      const result = await this.executeRecoveryStrategy(strategy, error, recoveryContext);
      
      // Record recovery attempt
      this.recordRecoveryAttempt(error, recoveryContext, result);
      
      // Log result
      this.logger.info('Recovery attempt completed', {
        recoveryId,
        success: result.success,
        duration: Date.now() - startTime,
        strategy: strategy.name
      });

      return result;

    } catch (recoveryError) {
      this.logger.error('Recovery process failed', {
        recoveryId,
        originalError: error.message,
        recoveryError: recoveryError.message
      });

      return {
        success: false,
        reason: 'Recovery process failed',
        recoveryError,
        error,
        recoveryId
      };
    }
  }

  /**
   * Register a recovery strategy
   * @param {Function} errorClass - Error class to handle
   * @param {Object} strategy - Recovery strategy
   */
  registerStrategy(errorClass, strategy) {
    if (!strategy.name || typeof strategy.execute !== 'function') {
      throw new Error('Recovery strategy must have name and execute function');
    }

    this.recoveryStrategies.set(errorClass, strategy);
    this.logger.debug('Recovery strategy registered', {
      errorClass: errorClass.name,
      strategy: strategy.name
    });
  }

  /**
   * Get recovery strategy for error
   * @private
   */
  getRecoveryStrategy(error) {
    // Try exact class match first
    for (const [errorClass, strategy] of this.recoveryStrategies.entries()) {
      if (error instanceof errorClass) {
        return strategy;
      }
    }

    // Try parent class matches
    for (const [errorClass, strategy] of this.recoveryStrategies.entries()) {
      if (error.constructor.prototype instanceof errorClass) {
        return strategy;
      }
    }

    return null;
  }

  /**
   * Execute recovery strategy
   * @private
   */
  async executeRecoveryStrategy(strategy, error, context) {
    try {
      // Create state snapshot if rollback enabled
      let stateSnapshot = null;
      if (this.enableStateRollback && strategy.requiresRollback) {
        stateSnapshot = await this.createStateSnapshot(context);
      }

      // Execute strategy
      const result = await strategy.execute(error, context);
      
      if (result.success) {
        return {
          ...result,
          strategy: strategy.name,
          stateSnapshot
        };
      }

      // Strategy failed, attempt rollback if needed
      if (stateSnapshot && strategy.requiresRollback) {
        await this.rollbackState(stateSnapshot, context);
      }

      return {
        ...result,
        strategy: strategy.name
      };

    } catch (strategyError) {
      return {
        success: false,
        reason: 'Strategy execution failed',
        strategyError,
        strategy: strategy.name
      };
    }
  }

  /**
   * Create state snapshot for rollback
   * @private
   */
  async createStateSnapshot(context) {
    const snapshot = {
      timestamp: Date.now(),
      context: { ...context }
    };

    // Add component-specific state if available
    if (context.taskQueue) {
      snapshot.queueState = context.taskQueue.export();
    }
    
    if (context.progressStream) {
      snapshot.progressState = context.progressStream.export();
    }

    return snapshot;
  }

  /**
   * Rollback to previous state
   * @private
   */
  async rollbackState(snapshot, context) {
    this.logger.info('Rolling back to previous state', {
      snapshotTime: snapshot.timestamp,
      rollbackTime: Date.now()
    });

    try {
      // Restore component states
      if (snapshot.queueState && context.taskQueue) {
        await context.taskQueue.import(snapshot.queueState);
      }
      
      if (snapshot.progressState && context.progressStream) {
        await context.progressStream.import(snapshot.progressState);
      }

      this.logger.info('State rollback completed successfully');
      return true;

    } catch (rollbackError) {
      this.logger.error('State rollback failed', {
        error: rollbackError.message
      });
      return false;
    }
  }

  /**
   * Get number of recovery attempts for error/context
   * @private
   */
  getRecoveryAttempts(error, context) {
    const key = this.getRecoveryKey(error, context);
    return this.recoveryHistory.filter(h => h.key === key).length;
  }

  /**
   * Record recovery attempt
   * @private
   */
  recordRecoveryAttempt(error, context, result) {
    const key = this.getRecoveryKey(error, context);
    
    this.recoveryHistory.push({
      key,
      timestamp: Date.now(),
      error: error.constructor.name,
      context: { ...context },
      result: { ...result },
      success: result.success
    });

    // Cleanup old history
    this.cleanupRecoveryHistory();
  }

  /**
   * Generate recovery key for tracking attempts
   * @private
   */
  getRecoveryKey(error, context) {
    const errorId = error.code || error.constructor.name;
    const contextId = context.taskId || context.sessionId || 'global';
    return `${errorId}:${contextId}`;
  }

  /**
   * Cleanup old recovery history
   * @private
   */
  cleanupRecoveryHistory() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.recoveryHistory = this.recoveryHistory.filter(h => h.timestamp > cutoff);
  }

  /**
   * Register default recovery strategies
   * @private
   */
  registerDefaultStrategies() {
    // Task error recovery
    this.registerStrategy(TaskError, {
      name: 'task_recovery',
      requiresRollback: false,
      execute: async (error, context) => {
        if (error.isRetryable() && context.attemptNumber <= 2) {
          return {
            success: true,
            action: 'retry_task',
            delay: 2000 * context.attemptNumber,
            message: 'Task will be retried'
          };
        }
        
        return {
          success: false,
          action: 'fail_task',
          message: 'Task cannot be recovered'
        };
      }
    });

    // Circular dependency recovery
    this.registerStrategy(CircularDependencyError, {
      name: 'circular_dependency_recovery',
      requiresRollback: true,
      execute: async (error, context) => {
        if (error.cycles && error.cycles.length > 0) {
          // Try to break the shortest cycle
          const shortestCycle = error.cycles.reduce((shortest, current) => 
            current.length < shortest.length ? current : shortest
          );
          
          return {
            success: true,
            action: 'break_dependency',
            targetDependency: `${shortestCycle[0]} -> ${shortestCycle[1]}`,
            message: 'Breaking circular dependency by removing shortest cycle',
            recovery: {
              type: 'dependency_removal',
              from: shortestCycle[0],
              to: shortestCycle[1]
            }
          };
        }
        
        return {
          success: false,
          action: 'manual_intervention',
          message: 'Circular dependency requires manual resolution'
        };
      }
    });

    // Resource error recovery
    this.registerStrategy(ResourceError, {
      name: 'resource_recovery',
      requiresRollback: false,
      execute: async (error, context) => {
        if (error.isRetryable()) {
          const delay = Math.min(5000 * context.attemptNumber, 30000);
          
          return {
            success: true,
            action: 'wait_and_retry',
            delay,
            message: `Waiting ${delay}ms for resource availability`
          };
        }
        
        return {
          success: false,
          action: 'resource_substitution',
          message: 'Consider using alternative resources'
        };
      }
    });

    // Strategy error recovery
    this.registerStrategy(StrategyError, {
      name: 'strategy_recovery',
      requiresRollback: false,
      execute: async (error, context) => {
        return {
          success: true,
          action: 'fallback_strategy',
          fallbackStrategy: 'AtomicExecutionStrategy',
          message: 'Using fallback execution strategy'
        };
      }
    });

    // Queue error recovery
    this.registerStrategy(QueueError, {
      name: 'queue_recovery',
      requiresRollback: false,
      execute: async (error, context) => {
        if (error.code === 'QUEUE_CAPACITY_ERROR') {
          return {
            success: true,
            action: 'wait_for_capacity',
            delay: 1000,
            message: 'Waiting for queue capacity'
          };
        }
        
        if (error.code === 'QUEUE_DRAINING_ERROR') {
          return {
            success: true,
            action: 'create_new_queue',
            message: 'Creating new queue instance'
          };
        }
        
        return {
          success: false,
          action: 'queue_restart',
          message: 'Queue requires manual restart'
        };
      }
    });

    // System error recovery
    this.registerStrategy(SystemError, {
      name: 'system_recovery',
      requiresRollback: true,
      execute: async (error, context) => {
        const delay = Math.min(10000 * context.attemptNumber, 60000);
        
        return {
          success: true,
          action: 'exponential_backoff_retry',
          delay,
          message: `System error recovery: waiting ${delay}ms before retry`
        };
      }
    });
  }

  /**
   * Get recovery statistics
   * @returns {Object} - Recovery statistics
   */
  getStatistics() {
    const totalAttempts = this.recoveryHistory.length;
    const successfulRecoveries = this.recoveryHistory.filter(h => h.success).length;
    
    const errorTypeStats = {};
    const recoveryStrategies = {};
    
    for (const history of this.recoveryHistory) {
      errorTypeStats[history.error] = (errorTypeStats[history.error] || 0) + 1;
      
      const strategy = history.result.strategy;
      if (strategy) {
        if (!recoveryStrategies[strategy]) {
          recoveryStrategies[strategy] = { attempts: 0, successes: 0 };
        }
        recoveryStrategies[strategy].attempts++;
        if (history.success) {
          recoveryStrategies[strategy].successes++;
        }
      }
    }
    
    return {
      totalAttempts,
      successfulRecoveries,
      successRate: totalAttempts > 0 ? (successfulRecoveries / totalAttempts) * 100 : 0,
      errorTypeStats,
      recoveryStrategies,
      registeredStrategies: this.recoveryStrategies.size,
      maxRecoveryAttempts: this.maxRecoveryAttempts
    };
  }

  /**
   * Clear recovery history
   */
  clearHistory() {
    this.recoveryHistory = [];
    this.logger.info('Recovery history cleared');
  }

  /**
   * Export recovery configuration
   */
  exportConfig() {
    return {
      maxRecoveryAttempts: this.maxRecoveryAttempts,
      enableStateRollback: this.enableStateRollback,
      registeredStrategies: Array.from(this.recoveryStrategies.keys()).map(k => k.name),
      historySize: this.recoveryHistory.length
    };
  }
}