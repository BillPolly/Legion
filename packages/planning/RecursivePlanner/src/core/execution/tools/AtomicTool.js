/**
 * Base stateless tool implementation
 */

import { Executable } from '../../../foundation/types/interfaces/interfaces.js';
import { ToolExecutionError, ValidationError } from '../../../foundation/types/errors/errors.js';
import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';
import { InputValidator } from '../../../foundation/utils/validation/InputValidator.js';

/**
 * Tool implementation function type
 * @typedef {Function} ToolImplementation
 * @param {any} input - Tool input
 * @returns {Promise<any>} Tool result
 */

/**
 * Tool metrics for monitoring
 */
export class ToolMetrics {
  constructor() {
    this.successCount = 0;
    this.failureCount = 0;
    this.totalExecutionTime = 0;
    this.averageExecutionTime = 0;
    this.lastExecutionTime = null;
    this.errors = [];
  }

  /**
   * Record successful execution
   * @param {number} executionTime - Execution time in milliseconds
   */
  recordSuccess(executionTime) {
    this.successCount++;
    this.totalExecutionTime += executionTime;
    this.averageExecutionTime = this.totalExecutionTime / (this.successCount + this.failureCount);
    this.lastExecutionTime = Date.now();
  }

  /**
   * Record failed execution
   * @param {number} executionTime - Execution time in milliseconds
   * @param {Error} error - Error that occurred
   */
  recordFailure(executionTime, error) {
    this.failureCount++;
    this.totalExecutionTime += executionTime;
    this.averageExecutionTime = this.totalExecutionTime / (this.successCount + this.failureCount);
    this.lastExecutionTime = Date.now();
    
    // Keep only last 10 errors
    this.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    });
    if (this.errors.length > 10) {
      this.errors.shift();
    }
  }

  /**
   * Get success rate
   * @returns {number} Success rate between 0 and 1
   */
  getSuccessRate() {
    const total = this.successCount + this.failureCount;
    return total === 0 ? 0 : this.successCount / total;
  }

  /**
   * Get total execution count
   * @returns {number} Total executions
   */
  getTotalExecutions() {
    return this.successCount + this.failureCount;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.successCount = 0;
    this.failureCount = 0;
    this.totalExecutionTime = 0;
    this.averageExecutionTime = 0;
    this.lastExecutionTime = null;
    this.errors = [];
  }
}

/**
 * Atomic tool configuration
 */
export class ToolConfig {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.retries = options.retries || 0;
    this.retryDelay = options.retryDelay || 1000;
    this.cacheResults = options.cacheResults || false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.enableMetrics = options.enableMetrics !== false; // Default true
    this.debugMode = options.debugMode || false;
  }
}

/**
 * Result cache for tools
 */
class ResultCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in milliseconds
   * @returns {any|null} Cached result or null
   */
  get(key, ttl) {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < ttl) {
      return entry.result;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set cached result
   * @param {string} key - Cache key
   * @param {any} result - Result to cache
   */
  set(key, result) {
    this.cache.set(key, {
      result: JSON.parse(JSON.stringify(result)), // Deep clone
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Generate cache key from input
   * @param {any} input - Tool input
   * @returns {string} Cache key
   */
  static generateKey(input) {
    const inputString = typeof input === 'string' ? input : JSON.stringify(input);
    return Buffer.from(inputString).toString('base64');
  }
}

/**
 * Atomic tool - stateless, single-operation executable
 */
export class AtomicTool extends Executable {
  constructor(name, description, implementation, validator = null, config = {}) {
    super(name, description);
    
    ValidationUtils.nonEmptyString(name, 'name');
    ValidationUtils.nonEmptyString(description, 'description');
    ValidationUtils.function(implementation, 'implementation');

    this.implementation = implementation;
    this.validator = validator;
    this.config = config instanceof ToolConfig ? config : new ToolConfig(config);
    this.metrics = new ToolMetrics();
    this.cache = this.config.cacheResults ? new ResultCache() : null;
    this.isRunning = false;
  }

  /**
   * Execute the tool
   * @param {any} input - Tool input
   * @returns {Promise<any>} Tool result
   * @throws {ToolExecutionError} If execution fails
   * @throws {ValidationError} If input validation fails
   */
  async run(input) {
    // Prevent concurrent execution
    if (this.isRunning) {
      throw new ToolExecutionError('Tool is already running', this.name, input);
    }

    // Validate input
    if (this.validator) {
      const validation = this.validator.validate(input);
      if (!validation.valid) {
        throw new ValidationError(
          `Input validation failed for tool ${this.name}`,
          'input',
          input,
          validation.errors
        );
      }
    }

    // Check cache
    if (this.cache) {
      const cacheKey = ResultCache.generateKey(input);
      const cachedResult = this.cache.get(cacheKey, this.config.cacheTTL);
      if (cachedResult !== null) {
        if (this.config.debugMode) {
          console.log(`[${this.name}] Cache hit for input:`, input);
        }
        return cachedResult;
      }
    }

    const startTime = Date.now();
    this.isRunning = true;

    try {
      // Execute with timeout and retries
      const result = await this._executeWithRetries(input);
      
      const executionTime = Date.now() - startTime;
      
      // Record success metrics
      if (this.config.enableMetrics) {
        this.metrics.recordSuccess(executionTime);
      }

      // Cache result
      if (this.cache) {
        const cacheKey = ResultCache.generateKey(input);
        this.cache.set(cacheKey, result);
      }

      if (this.config.debugMode) {
        console.log(`[${this.name}] Executed successfully in ${executionTime}ms`);
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record failure metrics
      if (this.config.enableMetrics) {
        this.metrics.recordFailure(executionTime, error);
      }

      if (this.config.debugMode) {
        console.error(`[${this.name}] Execution failed after ${executionTime}ms:`, error.message);
      }

      throw new ToolExecutionError(
        `Tool ${this.name} execution failed: ${error.message}`,
        this.name,
        input,
        error
      );

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute implementation with timeout and retries
   * @param {any} input - Tool input
   * @returns {Promise<any>} Execution result
   */
  async _executeWithRetries(input) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        // Execute with timeout
        const result = await Promise.race([
          this.implementation(input),
          this._timeout(this.config.timeout)
        ]);
        
        return result;

      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors or last attempt
        if (error instanceof ValidationError || attempt === this.config.retries) {
          throw error;
        }

        // Wait before retry
        if (this.config.retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }

        if (this.config.debugMode) {
          console.warn(`[${this.name}] Attempt ${attempt + 1} failed, retrying...`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Create timeout promise
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  _timeout(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Get tool metrics
   * @returns {ToolMetrics} Current metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Reset tool metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }

  /**
   * Clear result cache
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Create a copy of this tool with different configuration
   * @param {Object} newConfig - New configuration
   * @returns {AtomicTool} New tool instance
   */
  withConfig(newConfig) {
    const mergedConfig = { ...this.config, ...newConfig };
    return new AtomicTool(
      this.name,
      this.description,
      this.implementation,
      this.validator,
      mergedConfig
    );
  }

  /**
   * Create tool summary for display
   * @returns {Object} Tool summary
   */
  getSummary() {
    const metrics = this.metrics;
    return {
      name: this.name,
      description: this.description,
      executions: metrics.getTotalExecutions(),
      successRate: metrics.getSuccessRate(),
      averageTime: Math.round(metrics.averageExecutionTime),
      lastExecution: metrics.lastExecutionTime,
      isRunning: this.isRunning,
      cacheEnabled: !!this.cache,
      config: {
        timeout: this.config.timeout,
        retries: this.config.retries,
        cacheResults: this.config.cacheResults
      }
    };
  }

  /**
   * Validate tool configuration
   * @param {Object} config - Configuration to validate
   * @throws {ValidationError} If configuration is invalid
   */
  static validateConfig(config) {
    if (config.timeout !== undefined) {
      ValidationUtils.positiveNumber(config.timeout, 'config.timeout');
    }
    
    if (config.retries !== undefined) {
      ValidationUtils.nonNegativeNumber(config.retries, 'config.retries');
    }
    
    if (config.retryDelay !== undefined) {
      ValidationUtils.nonNegativeNumber(config.retryDelay, 'config.retryDelay');
    }
    
    if (config.cacheTTL !== undefined) {
      ValidationUtils.positiveNumber(config.cacheTTL, 'config.cacheTTL');
    }
  }
}