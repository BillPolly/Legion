/**
 * RetryManager - Handles retry logic with exponential backoff and circuit breaker
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern for failing operations
 * - Configurable retry policies
 * - Error classification for retry decisions
 * - Recovery strategy support
 */

export class RetryManager {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffFactor = options.backoffFactor || 2;
    this.jitterMax = options.jitterMax || 1000;
    this.logger = options.logger || null;
    
    // Circuit breaker settings
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000;
    
    // Circuit breaker state
    this.circuitBreakers = new Map();
    
    // Retry policies for different error types
    this.retryPolicies = new Map([
      ['network', { maxAttempts: 5, baseDelay: 2000 }],
      ['timeout', { maxAttempts: 3, baseDelay: 1500 }],
      ['rate_limit', { maxAttempts: 4, baseDelay: 5000 }],
      ['llm_failure', { maxAttempts: 2, baseDelay: 3000 }],
      ['tool_missing', { maxAttempts: 1, baseDelay: 0 }], // Don't retry missing tools
      ['parsing', { maxAttempts: 2, baseDelay: 500 }],
      ['unknown', { maxAttempts: this.maxAttempts, baseDelay: this.baseDelay }]
    ]);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (1-based)
   * @param {number} baseDelay - Base delay in milliseconds
   * @param {number} backoffFactor - Exponential backoff factor
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt, baseDelay = this.baseDelay, backoffFactor = this.backoffFactor) {
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(backoffFactor, attempt - 1),
      this.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.jitterMax;
    
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Determine if an error should be retried
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number
   * @param {string} errorType - Classified error type
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, attempt, errorType = 'unknown') {
    const policy = this.retryPolicies.get(errorType) || this.retryPolicies.get('unknown');
    
    // Don't retry if we've exceeded max attempts for this error type
    if (attempt >= policy.maxAttempts) {
      return false;
    }
    
    // Don't retry certain types of errors
    const nonRetryablePatterns = [
      'Authentication failed',
      'Invalid API key',
      'Tool not found',
      'Permission denied',
      'Invalid request format'
    ];
    
    const errorMessage = error.message || '';
    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Classify error type for retry policy selection
   * @param {Error} error - The error to classify
   * @returns {string} Error type classification
   */
  classifyError(error) {
    const message = error.message || '';
    const code = error.code || '';
    
    const classifications = {
      'ECONNREFUSED': 'network',
      'ENOTFOUND': 'network',
      'ECONNRESET': 'network',
      'ETIMEDOUT': 'timeout',
      'ESOCKETTIMEDOUT': 'timeout',
      'Rate limit': 'rate_limit',
      'rate limit': 'rate_limit',
      'Too many requests': 'rate_limit',
      'Invalid JSON': 'parsing',
      'JSON.parse': 'parsing',
      'Tool not found': 'tool_missing',
      'LLM error': 'llm_failure',
      'OpenAI error': 'llm_failure',
      'Anthropic error': 'llm_failure',
      'Model not found': 'llm_failure'
    };
    
    // Check error code first
    if (code && classifications[code]) {
      return classifications[code];
    }
    
    // Check error message patterns
    for (const [pattern, type] of Object.entries(classifications)) {
      if (message.includes(pattern)) {
        return type;
      }
    }
    
    return 'unknown';
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Async operation to execute
   * @param {Object} context - Context for operation and error recovery
   * @returns {Promise<any>} Operation result
   */
  async retry(operation, context = {}) {
    const operationId = context.operationId || 'unknown';
    let lastError;
    let errorType = 'unknown';
    
    // Check circuit breaker first
    if (await this.isCircuitOpen(operationId)) {
      throw new Error(`Circuit breaker is open for operation: ${operationId}`);
    }
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Reset circuit breaker on success
        this.recordSuccess(operationId);
        
        if (attempt > 1 && this.logger) {
          this.logger.info('Operation succeeded after retry', {
            operationId,
            attempt,
            totalAttempts: this.maxAttempts
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        errorType = this.classifyError(error);
        
        // Record failure for circuit breaker
        this.recordFailure(operationId);
        
        if (this.logger) {
          this.logger.warn('Operation attempt failed', {
            operationId,
            attempt,
            maxAttempts: this.maxAttempts,
            errorType,
            error: error.message
          });
        }
        
        // Check if we should retry
        if (!this.shouldRetry(error, attempt, errorType)) {
          if (this.logger) {
            this.logger.info('Not retrying due to error type or attempt limit', {
              operationId,
              attempt,
              errorType,
              reason: attempt >= this.maxAttempts ? 'max_attempts' : 'error_type'
            });
          }
          break;
        }
        
        // Don't delay after the last attempt
        if (attempt < this.maxAttempts) {
          const policy = this.retryPolicies.get(errorType) || this.retryPolicies.get('unknown');
          const delay = this.calculateDelay(attempt, policy.baseDelay);
          
          if (this.logger) {
            this.logger.debug('Retrying operation after delay', {
              operationId,
              attempt,
              delay,
              errorType
            });
          }
          
          await this.sleep(delay);
        }
      }
    }
    
    // All retries exhausted
    if (this.logger) {
      this.logger.error('Operation failed after all retries', {
        operationId,
        attempts: this.maxAttempts,
        finalErrorType: errorType,
        finalError: lastError.message
      });
    }
    
    throw lastError;
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker for operation
   * @param {string} operationId - Operation identifier
   * @returns {Object} Circuit breaker state
   */
  getCircuitBreaker(operationId) {
    if (!this.circuitBreakers.has(operationId)) {
      this.circuitBreakers.set(operationId, {
        state: 'closed', // closed, open, half-open
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      });
    }
    return this.circuitBreakers.get(operationId);
  }

  /**
   * Check if circuit breaker is open
   * @param {string} operationId - Operation identifier
   * @returns {boolean} Whether circuit is open
   */
  async isCircuitOpen(operationId) {
    const circuitBreaker = this.getCircuitBreaker(operationId);
    const now = Date.now();
    
    if (circuitBreaker.state === 'open') {
      if (now >= circuitBreaker.nextAttemptTime) {
        // Transition to half-open
        circuitBreaker.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Record operation success for circuit breaker
   * @param {string} operationId - Operation identifier
   */
  recordSuccess(operationId) {
    const circuitBreaker = this.getCircuitBreaker(operationId);
    circuitBreaker.failureCount = 0;
    circuitBreaker.state = 'closed';
  }

  /**
   * Record operation failure for circuit breaker
   * @param {string} operationId - Operation identifier
   */
  recordFailure(operationId) {
    const circuitBreaker = this.getCircuitBreaker(operationId);
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();
    
    if (circuitBreaker.failureCount >= this.circuitBreakerThreshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;
      
      if (this.logger) {
        this.logger.warn('Circuit breaker opened', {
          operationId,
          failureCount: circuitBreaker.failureCount,
          threshold: this.circuitBreakerThreshold,
          timeout: this.circuitBreakerTimeout
        });
      }
    }
  }

  /**
   * Get retry statistics
   * @returns {Object} Retry statistics
   */
  getStats() {
    const circuitBreakerStats = Array.from(this.circuitBreakers.entries()).map(([id, cb]) => ({
      operationId: id,
      state: cb.state,
      failureCount: cb.failureCount,
      lastFailureTime: cb.lastFailureTime
    }));
    
    return {
      maxAttempts: this.maxAttempts,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      backoffFactor: this.backoffFactor,
      circuitBreakers: circuitBreakerStats,
      retryPolicies: Object.fromEntries(this.retryPolicies)
    };
  }

  /**
   * Reset circuit breakers
   * @param {string} operationId - Optional specific operation to reset
   */
  resetCircuitBreakers(operationId = null) {
    if (operationId) {
      this.circuitBreakers.delete(operationId);
    } else {
      this.circuitBreakers.clear();
    }
  }

  /**
   * Create a bound retry function for a specific operation
   * @param {string} operationId - Operation identifier
   * @param {Object} options - Override options for this operation
   * @returns {Function} Bound retry function
   */
  createRetryFunction(operationId, options = {}) {
    const context = { operationId, ...options };
    return (operation) => this.retry(operation, context);
  }
}

/**
 * Circuit breaker implementation for preventing cascade failures
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, options = {}) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'closed'; // closed, open, half-open
    this.nextAttempt = 0;
    this.logger = options.logger || null;
    this.onStateChange = options.onStateChange || null;
  }

  /**
   * Execute operation through circuit breaker
   * @param {Function} operation - Operation to execute
   * @returns {Promise<any>} Operation result
   */
  async execute(operation) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is open');
      }
      this.setState('half-open');
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.failureCount = 0;
    if (this.state !== 'closed') {
      this.setState('closed');
    }
  }

  /**
   * Handle failed operation
   */
  onFailure() {
    this.failureCount++;
    
    if (this.state === 'half-open' || this.failureCount >= this.threshold) {
      this.setState('open');
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  /**
   * Set circuit breaker state
   * @param {string} newState - New state
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    if (this.logger && oldState !== newState) {
      this.logger.info('Circuit breaker state changed', {
        oldState,
        newState,
        failureCount: this.failureCount,
        threshold: this.threshold
      });
    }
    
    if (this.onStateChange) {
      this.onStateChange(oldState, newState, this.failureCount);
    }
  }

  /**
   * Get current state
   * @returns {Object} Circuit breaker state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.threshold,
      timeout: this.timeout,
      nextAttempt: this.nextAttempt
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.failureCount = 0;
    this.setState('closed');
    this.nextAttempt = 0;
  }
}

export default RetryManager;