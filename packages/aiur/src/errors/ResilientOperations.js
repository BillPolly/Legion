/**
 * Resilient Operations Handler
 * 
 * Provides graceful degradation, fallback mechanisms,
 * and resilient execution patterns
 */

import { EventEmitter } from 'events';
import { AiurError, NetworkError, TimeoutError } from './AiurErrors.js';

export class ResilientOperations extends EventEmitter {
  constructor(errorHandler, options = {}) {
    super();
    
    this.errorHandler = errorHandler;
    this.options = {
      defaultTimeout: options.defaultTimeout || 5000,
      maxConcurrency: options.maxConcurrency || 10,
      backpressureThreshold: options.backpressureThreshold || 100,
      degradationLevels: options.degradationLevels || {
        low: { timeout: 5000, maxConcurrency: 10 },
        medium: { timeout: 3000, maxConcurrency: 5 },
        high: { timeout: 1000, maxConcurrency: 2 }
      },
      ...options
    };

    // State tracking
    this.stressLevel = 'low';
    this.requestCount = 0;
    this.concurrentRequests = 0;
    this.requestHistory = [];
    this.degradedConfig = null;
  }

  /**
   * Execute operation with fallback
   */
  async withFallback(primaryOp, fallbackOp, options = {}) {
    try {
      const result = await this._executeWithTimeout(primaryOp, options.timeout);
      this.emit('primary-success', { result });
      return result;
    } catch (error) {
      this.emit('primary-failed', { error });
      
      if (!fallbackOp) {
        throw error;
      }

      try {
        const fallbackResult = await this._executeWithTimeout(fallbackOp, options.timeout);
        this.emit('fallback-success', { result: fallbackResult, primaryError: error });
        return fallbackResult;
      } catch (fallbackError) {
        this.emit('fallback-failed', { primaryError: error, fallbackError });
        throw this.errorHandler.aggregateErrors([error, fallbackError]);
      }
    }
  }

  /**
   * Execute operations partially (continue on individual failures)
   */
  async executePartial(operations, options = {}) {
    const results = {
      successes: [],
      failures: [],
      completed: 0,
      total: operations.length
    };

    const executeWithIndex = async (operation, index) => {
      try {
        const result = await this._executeWithTimeout(operation, options.timeout);
        results.successes.push(result);
        results.completed++;
        this.emit('partial-success', { index, result });
      } catch (error) {
        results.failures.push({ index, error });
        results.completed++;
        this.emit('partial-failure', { index, error });
      }
    };

    // Execute with concurrency control
    const concurrency = Math.min(
      options.concurrency || this.options.maxConcurrency,
      operations.length
    );

    const batches = [];
    for (let i = 0; i < operations.length; i += concurrency) {
      batches.push(operations.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((op, localIndex) => {
          const globalIndex = batches.indexOf(batch) * concurrency + localIndex;
          return executeWithIndex(op, globalIndex);
        })
      );
    }

    return results;
  }

  /**
   * Execute with recovery strategies
   */
  async executeWithRecovery(tool, parameters, options = {}) {
    let attempts = 0;
    let lastError;
    const maxAttempts = options.maxAttempts || 3;

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const result = await tool.execute(parameters);
        
        return {
          result,
          attempts,
          recovered: attempts > 1,
          recoveryActions: attempts > 1 ? ['retry'] : []
        };
      } catch (error) {
        lastError = error;
        
        // Try automated recovery based on error type
        const recoveryActions = this._getAutomatedRecoveryActions(error);
        
        if (attempts < maxAttempts && recoveryActions.length > 0) {
          this.emit('recovery-attempt', {
            attempt: attempts,
            error,
            actions: recoveryActions
          });
          
          // Execute recovery actions
          await this._executeRecoveryActions(recoveryActions, { tool, parameters });
          continue;
        }
      }
    }

    throw new AiurError(`Recovery failed after ${attempts} attempts`, {
      originalError: lastError,
      attempts,
      tool: tool.name
    });
  }

  /**
   * Execute with context-specific handling
   */
  async executeWithContext(operation, context) {
    const isStrictMode = context.mode === 'strict';
    const allowPartialFailure = context.allowPartialFailure;

    try {
      const result = await operation();
      return {
        success: true,
        result,
        context
      };
    } catch (error) {
      if (isStrictMode) {
        throw error;
      }

      if (allowPartialFailure) {
        return {
          success: false,
          error,
          gracefullyHandled: true,
          context
        };
      }

      throw error;
    }
  }

  /**
   * Execute concurrent operations with backpressure
   */
  async executeConcurrent(operations, options = {}) {
    const maxConcurrency = options.maxConcurrency || this.options.maxConcurrency;
    const failFast = options.failFast !== false;
    
    const results = {
      successes: [],
      failures: [],
      totalTime: 0
    };

    const startTime = Date.now();
    
    const semaphore = new Semaphore(maxConcurrency);
    
    const executeOperation = async (operation, index) => {
      const permit = await semaphore.acquire();
      this.concurrentRequests++;
      
      try {
        const result = await operation();
        results.successes.push({ index, result });
      } catch (error) {
        results.failures.push({ index, error });
        
        if (failFast) {
          throw error;
        }
      } finally {
        this.concurrentRequests--;
        permit.release();
      }
    };

    try {
      await Promise.all(
        operations.map((op, index) => executeOperation(op, index))
      );
    } catch (error) {
      if (failFast) {
        // Cancel remaining operations (they'll finish naturally)
        this.emit('concurrent-cancelled', { error, completed: results.successes.length });
      }
    }

    results.totalTime = Date.now() - startTime;
    return results;
  }

  /**
   * Execute recovery workflow
   */
  async executeRecoveryWorkflow(recoverySteps) {
    const result = {
      success: true,
      steps: [],
      failedAt: null
    };

    for (let i = 0; i < recoverySteps.length; i++) {
      const step = recoverySteps[i];
      
      try {
        const stepResult = await step();
        result.steps.push(stepResult);
        
        // Stop on critical failure
        if (!stepResult.success && stepResult.critical) {
          result.success = false;
          result.failedAt = stepResult.action;
          break;
        }
      } catch (error) {
        result.steps.push({
          action: `step-${i}`,
          success: false,
          error: error.message
        });
        
        result.success = false;
        result.failedAt = `step-${i}`;
        break;
      }
    }

    return result;
  }

  /**
   * Set stress level and update configuration
   */
  setStressLevel(level) {
    this.stressLevel = level;
    this.degradedConfig = {
      ...this.options.degradationLevels[level],
      skipNonEssential: level !== 'low'
    };
    
    this.emit('stress-level-changed', { level, config: this.degradedConfig });
  }

  /**
   * Get current degraded configuration
   */
  getDegradedConfig() {
    return this.degradedConfig || this.options.degradationLevels.low;
  }

  /**
   * Track request for backpressure calculation
   */
  trackRequest() {
    this.requestCount++;
    this.requestHistory.push(Date.now());
    
    // Keep only last minute of requests
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
    
    // Update stress level based on request rate
    const requestsPerMinute = this.requestHistory.length;
    if (requestsPerMinute > 500) {
      this.setStressLevel('high');
    } else if (requestsPerMinute > 200) {
      this.setStressLevel('medium');
    } else {
      this.setStressLevel('low');
    }
  }

  /**
   * Check if backpressure should be applied
   */
  shouldApplyBackpressure() {
    return this.requestHistory.length > this.options.backpressureThreshold ||
           this.concurrentRequests > this.options.maxConcurrency;
  }

  /**
   * Get backpressure configuration
   */
  getBackpressureConfig() {
    const requestRate = this.requestHistory.length;
    const factor = Math.min(requestRate / this.options.backpressureThreshold, 3);
    
    return {
      delay: Math.floor(factor * 100), // 0-300ms delay
      maxConcurrency: Math.max(1, Math.floor(this.options.maxConcurrency / factor)),
      dropRequests: factor > 2
    };
  }

  /**
   * Execute with timeout
   */
  async _executeWithTimeout(operation, timeout) {
    const timeoutMs = timeout || this.options.defaultTimeout;
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, {
          timeout: timeoutMs
        }));
      }, timeoutMs);

      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Get automated recovery actions for error
   */
  _getAutomatedRecoveryActions(error) {
    if (error instanceof NetworkError) {
      return ['wait', 'retry'];
    }
    
    if (error.message.includes('cache')) {
      return ['clear-cache'];
    }
    
    if (error.message.includes('connection')) {
      return ['reset-connection'];
    }
    
    return [];
  }

  /**
   * Execute recovery actions
   */
  async _executeRecoveryActions(actions, context) {
    for (const action of actions) {
      switch (action) {
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        case 'clear-cache':
          // Simulate cache clear
          this.emit('recovery-action', { action: 'cache-cleared' });
          break;
        case 'reset-connection':
          // Simulate connection reset
          this.emit('recovery-action', { action: 'connection-reset' });
          break;
        case 'retry':
          // Will be handled by the retry loop
          break;
      }
    }
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  constructor(capacity) {
    this.capacity = capacity;
    this.available = capacity;
    this.waiting = [];
  }

  async acquire() {
    if (this.available > 0) {
      this.available--;
      return { release: () => this.release() };
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release() {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve({ release: () => this.release() });
    } else {
      this.available++;
    }
  }
}