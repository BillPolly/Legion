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
   * Strategy fallback mechanism
   * @param {Object} task - Task that failed
   * @param {string} originalStrategy - Strategy that failed
   * @param {Error} error - Error that occurred
   * @returns {Promise<Object|null>} Fallback strategy or null
   */
  async fallbackStrategy(task, originalStrategy, error) {
    this.logger.warn(`Strategy ${originalStrategy} failed, trying fallback`, { 
      error: error.message,
      taskId: task.id || 'unknown'
    });
    
    const fallbackMap = {
      'RecursiveExecutionStrategy': 'AtomicExecutionStrategy',
      'ParallelExecutionStrategy': 'SequentialExecutionStrategy',
      'SequentialExecutionStrategy': 'AtomicExecutionStrategy',
      'OptimizedExecutionStrategy': 'RecursiveExecutionStrategy'
    };
    
    const fallback = fallbackMap[originalStrategy];
    if (fallback) {
      this.logger.info(`Using fallback strategy: ${fallback}`, {
        originalStrategy,
        taskId: task.id || 'unknown'
      });
      
      return {
        success: true,
        action: 'strategy_fallback',
        fallbackStrategy: fallback,
        message: `Falling back from ${originalStrategy} to ${fallback}`,
        delay: 1000 // Brief delay before retry
      };
    }
    
    return {
      success: false,
      action: 'no_fallback_available',
      message: `No fallback strategy available for ${originalStrategy}`
    };
  }

  /**
   * Recover partial results from failed execution
   * @param {Object} executionContext - Context with partial results
   * @param {Error} error - Error that occurred
   * @returns {Object} Partial recovery result
   */
  recoverPartialResults(executionContext, error) {
    const completed = executionContext.getCompletedSubtasks ? 
      executionContext.getCompletedSubtasks() : [];
    const pending = executionContext.getPendingSubtasks ? 
      executionContext.getPendingSubtasks() : [];
    const failed = executionContext.getFailedSubtasks ? 
      executionContext.getFailedSubtasks() : [];
    
    const recoverable = this.isRecoverable(error);
    const completionPercentage = completed.length / (completed.length + pending.length + failed.length) * 100;
    
    this.logger.info('Recovering partial results', {
      completed: completed.length,
      pending: pending.length,
      failed: failed.length,
      completionPercentage: Math.round(completionPercentage),
      recoverable
    });
    
    return {
      partial: true,
      completed: completed,
      pending: pending,
      failed: failed,
      error: error.message,
      errorType: this.classifyError(error),
      recoverable: recoverable,
      completionPercentage: Math.round(completionPercentage),
      canResume: recoverable && pending.length > 0,
      resumeStrategy: recoverable ? this.suggestResumeStrategy(completed, pending, failed) : null
    };
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error is recoverable
   */
  isRecoverable(error) {
    const nonRecoverablePatterns = [
      'Authentication failed',
      'Invalid API key',
      'Permission denied',
      'Tool not found',
      'Invalid task format',
      'Circular dependency detected',
      'Out of memory',
      'Disk full',
      'Network unreachable'
    ];
    
    const errorMessage = error.message || '';
    for (const pattern of nonRecoverablePatterns) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }
    
    // Check error codes
    const nonRecoverableCodes = [
      'AUTH_ERROR',
      'PERMISSION_DENIED',
      'INVALID_FORMAT',
      'CIRCULAR_DEPENDENCY',
      'RESOURCE_EXHAUSTED'
    ];
    
    if (error.code && nonRecoverableCodes.includes(error.code)) {
      return false;
    }
    
    return true;
  }

  /**
   * Suggest strategy for resuming partial execution
   * @param {Array} completed - Completed subtasks
   * @param {Array} pending - Pending subtasks
   * @param {Array} failed - Failed subtasks
   * @returns {Object} Resume strategy
   */
  suggestResumeStrategy(completed, pending, failed) {
    const totalTasks = completed.length + pending.length + failed.length;
    const completionRate = completed.length / totalTasks;
    
    if (completionRate > 0.8) {
      return {
        strategy: 'AtomicExecutionStrategy',
        reason: 'High completion rate, use atomic for remaining tasks',
        skipCompleted: true
      };
    } else if (failed.length > pending.length) {
      return {
        strategy: 'SequentialExecutionStrategy',
        reason: 'Many failures, use sequential for better error handling',
        retryFailed: true
      };
    } else {
      return {
        strategy: 'RecursiveExecutionStrategy',
        reason: 'Moderate completion, continue with recursive approach',
        continueFromCheckpoint: true
      };
    }
  }

  /**
   * Enhanced error classification
   * @param {Error} error - Error to classify
   * @returns {string} Error classification
   */
  classifyError(error) {
    const message = error.message || '';
    const code = error.code || '';
    const stack = error.stack || '';
    
    const classifications = {
      // Network errors
      'ECONNREFUSED': 'network',
      'ENOTFOUND': 'network',
      'ECONNRESET': 'network',
      'ETIMEDOUT': 'timeout',
      'ESOCKETTIMEDOUT': 'timeout',
      'socket hang up': 'network',
      'getaddrinfo ENOTFOUND': 'network',
      
      // Rate limiting
      'Rate limit': 'rate_limit',
      'rate limit': 'rate_limit',
      'Too many requests': 'rate_limit',
      '429': 'rate_limit',
      'quota exceeded': 'rate_limit',
      
      // Parsing errors
      'Invalid JSON': 'parsing',
      'JSON.parse': 'parsing',
      'SyntaxError': 'parsing',
      'Unexpected token': 'parsing',
      'Cannot parse': 'parsing',
      
      // Tool errors
      'Tool not found': 'tool_missing',
      'tool not found': 'tool_missing',
      'Unknown tool': 'tool_missing',
      'Tool execution failed': 'tool_failure',
      'Tool timeout': 'tool_timeout',
      
      // LLM errors
      'LLM error': 'llm_failure',
      'OpenAI error': 'llm_failure',
      'Anthropic error': 'llm_failure',
      'Claude error': 'llm_failure',
      'Model not found': 'llm_failure',
      'Token limit exceeded': 'llm_token_limit',
      'Context length exceeded': 'llm_token_limit',
      
      // Authentication errors
      'Authentication failed': 'auth_error',
      'Invalid API key': 'auth_error',
      'Unauthorized': 'auth_error',
      'Forbidden': 'auth_error',
      'Permission denied': 'permission_error',
      
      // Resource errors
      'Out of memory': 'resource_exhausted',
      'Disk full': 'resource_exhausted',
      'CPU throttled': 'resource_exhausted',
      'Memory limit exceeded': 'resource_exhausted',
      
      // Strategy errors
      'Strategy failed': 'strategy_error',
      'Execution strategy error': 'strategy_error',
      'Cannot handle task': 'strategy_error',
      
      // Dependency errors
      'Circular dependency': 'circular_dependency',
      'Dependency not found': 'dependency_missing',
      'Dependency cycle': 'circular_dependency',
      
      // Validation errors
      'Validation failed': 'validation_error',
      'Invalid schema': 'validation_error',
      'Schema mismatch': 'validation_error',
      'Required field missing': 'validation_error'
    };
    
    // Check error code first (most specific)
    if (code) {
      for (const [pattern, type] of Object.entries(classifications)) {
        if (code.includes(pattern)) {
          return type;
        }
      }
    }
    
    // Check error message
    const lowerMessage = message.toLowerCase();
    for (const [pattern, type] of Object.entries(classifications)) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return type;
      }
    }
    
    // Check stack trace for additional context
    if (stack) {
      if (stack.includes('TimeoutError')) return 'timeout';
      if (stack.includes('NetworkError')) return 'network';
      if (stack.includes('ValidationError')) return 'validation_error';
      if (stack.includes('ParseError')) return 'parsing';
    }
    
    // Check error type/constructor name
    const errorType = error.constructor.name;
    if (errorType === 'TimeoutError') return 'timeout';
    if (errorType === 'NetworkError') return 'network';
    if (errorType === 'ValidationError') return 'validation_error';
    if (errorType === 'SyntaxError') return 'parsing';
    
    return 'unknown';
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