/**
 * Comprehensive Error Handler
 * 
 * Provides error classification, retry mechanisms, circuit breaker,
 * and recovery strategies for the Aiur system
 */

import { EventEmitter } from 'events';
import { 
  AiurError, 
  ValidationError, 
  ExecutionError, 
  NetworkError, 
  ConfigurationError,
  TimeoutError,
  ResourceError 
} from './AiurErrors.js';

export class ErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      backoffFactor: options.backoffFactor || 2,
      baseDelay: options.baseDelay || 1000,
      timeout: options.timeout || 5000,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      ...options
    };

    // Circuit breaker state
    this._circuits = new Map();
    
    // Error classification patterns
    this._errorPatterns = {
      validation: [ValidationError, /validation|invalid|schema/i],
      execution: [ExecutionError, /execution|runtime|tool/i],
      network: [NetworkError, /network|connection|timeout|http/i],
      resource: [ResourceError, /memory|disk|cpu|limit/i],
      configuration: [ConfigurationError, /config|setting|parameter/i]
    };

    // Recovery strategies
    this._recoveryStrategies = new Map();
    this._setupDefaultRecoveryStrategies();
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    for (const [type, patterns] of Object.entries(this._errorPatterns)) {
      for (const pattern of patterns) {
        if (typeof pattern === 'function' && error instanceof pattern) {
          return type;
        }
        if (pattern instanceof RegExp && pattern.test(error.message)) {
          return type;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Determine if error is recoverable
   */
  isRecoverable(error) {
    if (error instanceof AiurError) {
      return error.recoverable;
    }

    const type = this.classifyError(error);
    return ['network', 'resource', 'execution'].includes(type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt, withJitter = false) {
    let delay = this.options.baseDelay * Math.pow(this.options.backoffFactor, attempt - 1);
    
    if (withJitter) {
      // Add ±50% jitter
      const jitter = (Math.random() - 0.5);
      delay += delay * jitter;
    }
    
    return Math.max(delay, 100); // Minimum 100ms
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry(operation, context = {}) {
    let lastError;
    let attempts = 0;

    while (attempts <= this.options.maxRetries) {
      attempts++;
      
      try {
        const result = await operation();
        
        // Record success metrics
        this.emit('retry-success', {
          attempts,
          context,
          recoveredFrom: lastError?.constructor.name
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry non-recoverable errors
        if (!this.isRecoverable(error)) {
          this.emit('retry-abandoned', {
            error,
            reason: 'non-recoverable',
            attempts,
            context
          });
          throw error;
        }

        // Don't retry if max attempts reached
        if (attempts > this.options.maxRetries) {
          this.emit('retry-exhausted', {
            error,
            attempts,
            context
          });
          throw error;
        }

        // Calculate delay and wait
        const delay = this.calculateRetryDelay(attempts, true);
        this.emit('retry-attempt', {
          attempt: attempts,
          delay,
          error: error.message,
          context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute operation with circuit breaker
   */
  async withCircuitBreaker(serviceKey, operation, options = {}) {
    const circuit = this._getOrCreateCircuit(serviceKey);
    
    // Check if circuit is open
    if (this.isCircuitOpen(serviceKey)) {
      const now = Date.now();
      const timeSinceLastFailure = now - circuit.lastFailureTime;
      
      if (timeSinceLastFailure < this.options.circuitBreakerTimeout) {
        throw new Error(`Circuit breaker is open for service: ${serviceKey}`);
      }
      
      // Try to reset circuit (half-open state)
      circuit.state = 'half-open';
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      circuit.state = 'closed';
      circuit.failureCount = 0;
      circuit.successCount++;
      circuit.totalRequests++;
      
      this.emit('circuit-success', { serviceKey, circuit });
      
      return result;
    } catch (error) {
      // Failure - update circuit
      circuit.failureCount++;
      circuit.totalRequests++;
      circuit.lastFailureTime = Date.now();
      
      // Open circuit if threshold reached
      if (circuit.failureCount >= this.options.circuitBreakerThreshold) {
        circuit.state = 'open';
        this.emit('circuit-opened', { serviceKey, circuit, error });
      }
      
      this.emit('circuit-failure', { serviceKey, circuit, error });
      
      throw error;
    }
  }

  /**
   * Check if circuit is open
   */
  isCircuitOpen(serviceKey) {
    const circuit = this._circuits.get(serviceKey);
    return circuit && circuit.state === 'open';
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics(serviceKey) {
    return this._circuits.get(serviceKey);
  }

  /**
   * Get or create circuit for service
   */
  _getOrCreateCircuit(serviceKey) {
    if (!this._circuits.has(serviceKey)) {
      this._circuits.set(serviceKey, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        lastFailureTime: null
      });
    }
    return this._circuits.get(serviceKey);
  }

  /**
   * Aggregate multiple errors
   */
  aggregateErrors(errors) {
    if (errors.length === 1) {
      return errors[0];
    }

    const errorTypes = [...new Set(errors.map(e => this.classifyError(e)))];
    const details = {
      errors: errors.map(e => ({
        type: this.classifyError(e),
        message: e.message,
        stack: e.stack
      })),
      errorTypes,
      count: errors.length
    };

    return new AiurError(
      `Multiple errors occurred (${errors.length}): ${errors.map(e => e.message).join('; ')}`,
      details
    );
  }

  /**
   * Group errors by type
   */
  groupErrorsByType(errors) {
    const groups = {};
    
    for (const error of errors) {
      const type = this.classifyError(error);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(error);
    }
    
    return groups;
  }

  /**
   * Suggest recovery actions for error
   */
  suggestRecovery(error) {
    const type = this.classifyError(error);
    const strategy = this._recoveryStrategies.get(type);
    
    if (strategy) {
      return strategy.suggestions;
    }

    return ['Review error details', 'Check system logs', 'Contact support'];
  }

  /**
   * Add context to error
   */
  addContext(error, context) {
    if (error instanceof AiurError) {
      return error.withContext(context);
    }

    // Enhance message with context information
    let enhancedMessage = error.message;
    if (context.tool) {
      enhancedMessage = `${context.tool}: ${enhancedMessage}`;
    }
    if (context.step) {
      enhancedMessage = `${enhancedMessage} (during ${context.step})`;
    }

    // Wrap non-Aiur errors
    const wrappedError = new AiurError(enhancedMessage, {
      context,
      originalError: error,
      stack: error.stack
    });
    
    wrappedError.context = context;
    return wrappedError;
  }

  /**
   * Validate input against schema
   */
  validateInput(input, schema) {
    const errors = this._validateAgainstSchema(input, schema, '');
    
    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`, {
        schema,
        input,
        errors
      });
    }
    
    return true;
  }

  /**
   * Detect configuration issues
   */
  detectConfigurationIssues(config) {
    const issues = [];
    
    // Check for common configuration problems
    for (const [key, value] of Object.entries(config)) {
      if (key.includes('timeout') && (typeof value !== 'number' || value < 0)) {
        issues.push({
          type: 'invalid-value',
          setting: key,
          value,
          problem: 'Timeout must be a positive number'
        });
      }
      
      if (key.includes('retries') && typeof value !== 'number') {
        issues.push({
          type: 'type-mismatch',
          setting: key,
          value,
          expected: 'number',
          actual: typeof value
        });
      }
      
      if (key.includes('Memory') && value > 1024 * 1024 * 1024 * 8) { // 8GB
        issues.push({
          type: 'resource-limit',
          setting: key,
          value,
          problem: 'Memory limit too high'
        });
      }
    }
    
    return issues;
  }

  /**
   * Get configuration recommendations
   */
  getConfigurationRecommendations(currentConfig) {
    const recommendations = [];
    
    if (currentConfig.timeout && currentConfig.timeout < 5000) {
      recommendations.push({
        setting: 'timeout',
        current: currentConfig.timeout,
        suggested: 5000,
        reason: 'Increase timeout for better reliability'
      });
    }
    
    if (currentConfig.retries && currentConfig.retries < 3) {
      recommendations.push({
        setting: 'retries',
        current: currentConfig.retries,
        suggested: 3,
        reason: 'Increase retries for network resilience'
      });
    }
    
    return recommendations;
  }

  /**
   * Setup default recovery strategies
   */
  _setupDefaultRecoveryStrategies() {
    this._recoveryStrategies.set('network', {
      suggestions: ['retry operation', 'check network connectivity', 'verify endpoint'],
      automated: ['retry with exponential backoff', 'switch to backup endpoint']
    });

    this._recoveryStrategies.set('validation', {
      suggestions: ['validate input data', 'fix data format', 'check schema'],
      automated: ['apply data sanitization', 'use default values']
    });

    this._recoveryStrategies.set('execution', {
      suggestions: ['check tool configuration', 'verify dependencies', 'review parameters'],
      automated: ['restart tool', 'clear cache', 'use fallback tool']
    });

    this._recoveryStrategies.set('resource', {
      suggestions: ['free up resources', 'increase limits', 'optimize usage'],
      automated: ['trigger garbage collection', 'close unused connections']
    });
  }

  /**
   * Simple schema validation
   */
  _validateAgainstSchema(value, schema, path) {
    const errors = [];
    
    if (schema.type && typeof value !== schema.type) {
      errors.push(`${path}: expected ${schema.type}, got ${typeof value}`);
      return errors;
    }
    
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in value)) {
          errors.push(`${path}: missing required field '${field}'`);
        }
      }
    }
    
    if (schema.properties && typeof value === 'object') {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const fieldPath = path ? `${path}.${key}` : key;
          errors.push(...this._validateAgainstSchema(value[key], subSchema, fieldPath));
        }
      }
    }
    
    if (schema.minimum && typeof value === 'number' && value < schema.minimum) {
      errors.push(`${path}: value ${value} is below minimum ${schema.minimum}`);
    }
    
    return errors;
  }
}