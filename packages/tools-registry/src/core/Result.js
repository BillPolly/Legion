/**
 * Result Pattern Implementation - Uncle Bob's Clean Code
 * 
 * Eliminates exception control flow by returning success/failure objects
 * Inspired by functional programming Either/Result patterns
 * 
 * Benefits:
 * - No hidden control flow through exceptions
 * - Explicit error handling
 * - Composable operations
 * - Type-safe error propagation
 */

/**
 * Result class representing either success or failure
 * @template T - Type of the success value
 * @template E - Type of the error value
 */
export class Result {
  constructor(success, value, error = null) {
    this._success = success;
    this._value = value;
    this._error = error;
  }

  /**
   * Create a successful result
   * @template T
   * @param {T} value - The success value
   * @returns {Result<T, never>}
   */
  static success(value) {
    return new Result(true, value, null);
  }

  /**
   * Create a failed result
   * @template E
   * @param {E} error - The error value
   * @returns {Result<never, E>}
   */
  static failure(error) {
    return new Result(false, null, error);
  }

  /**
   * Execute a function and wrap the result
   * @template T
   * @param {Function} fn - Function to execute
   * @returns {Promise<Result<T, Error>>}
   */
  static async try(fn) {
    try {
      const value = await fn();
      return Result.success(value);
    } catch (error) {
      return Result.failure(error);
    }
  }

  /**
   * Check if the result is successful
   * @returns {boolean}
   */
  isSuccess() {
    return this._success;
  }

  /**
   * Check if the result is a failure
   * @returns {boolean}
   */
  isFailure() {
    return !this._success;
  }

  /**
   * Get the success value (throws if failure)
   * @returns {T}
   * @throws {Error} If result is failure
   */
  getValue() {
    if (this.isFailure()) {
      throw new Error('Cannot get value from failed result');
    }
    return this._value;
  }

  /**
   * Get the error value (throws if success)
   * @returns {E}
   * @throws {Error} If result is success
   */
  getError() {
    if (this.isSuccess()) {
      throw new Error('Cannot get error from successful result');
    }
    return this._error;
  }

  /**
   * Get the value or a default
   * @param {T} defaultValue - Default value if failure
   * @returns {T}
   */
  getValueOr(defaultValue) {
    return this.isSuccess() ? this._value : defaultValue;
  }

  /**
   * Map the success value
   * @template U
   * @param {Function} fn - Mapping function
   * @returns {Result<U, E>}
   */
  map(fn) {
    if (this.isSuccess()) {
      try {
        return Result.success(fn(this._value));
      } catch (error) {
        return Result.failure(error);
      }
    }
    return this;
  }

  /**
   * Map the error value
   * @template F
   * @param {Function} fn - Mapping function
   * @returns {Result<T, F>}
   */
  mapError(fn) {
    if (this.isFailure()) {
      return Result.failure(fn(this._error));
    }
    return this;
  }

  /**
   * Async map the success value
   * @template U
   * @param {Function} fn - Async mapping function
   * @returns {Promise<Result<U, E>>}
   */
  async mapAsync(fn) {
    if (this.isSuccess()) {
      try {
        const value = await fn(this._value);
        return Result.success(value);
      } catch (error) {
        return Result.failure(error);
      }
    }
    return this;
  }

  /**
   * Chain another result-returning operation
   * @template U
   * @param {Function} fn - Function returning a Result
   * @returns {Result<U, E>}
   */
  flatMap(fn) {
    if (this.isSuccess()) {
      try {
        return fn(this._value);
      } catch (error) {
        return Result.failure(error);
      }
    }
    return this;
  }

  /**
   * Async chain another result-returning operation
   * @template U
   * @param {Function} fn - Async function returning a Result
   * @returns {Promise<Result<U, E>>}
   */
  async flatMapAsync(fn) {
    if (this.isSuccess()) {
      try {
        return await fn(this._value);
      } catch (error) {
        return Result.failure(error);
      }
    }
    return this;
  }

  /**
   * Match pattern - handle both success and failure cases
   * @param {Object} patterns - Object with onSuccess and onFailure functions
   * @returns {*} Result of the matched function
   */
  match(patterns) {
    if (this.isSuccess()) {
      return patterns.onSuccess ? patterns.onSuccess(this._value) : this._value;
    }
    return patterns.onFailure ? patterns.onFailure(this._error) : this._error;
  }

  /**
   * Convert to a plain object for serialization
   * @returns {Object}
   */
  toObject() {
    return {
      success: this._success,
      value: this._value,
      error: this._error ? {
        message: this._error.message || String(this._error),
        code: this._error.code,
        name: this._error.name
      } : null
    };
  }

  /**
   * Combine multiple Results - all must succeed
   * @param {Result[]} results - Array of Results
   * @returns {Result<Array, Error>}
   */
  static all(results) {
    const values = [];
    for (const result of results) {
      if (result.isFailure()) {
        return Result.failure(result.getError());
      }
      values.push(result.getValue());
    }
    return Result.success(values);
  }

  /**
   * Combine multiple Results - collect all errors
   * @param {Result[]} results - Array of Results
   * @returns {Result<Array, Array>}
   */
  static allSettled(results) {
    const values = [];
    const errors = [];
    
    for (const result of results) {
      if (result.isSuccess()) {
        values.push(result.getValue());
      } else {
        errors.push(result.getError());
      }
    }
    
    return errors.length > 0 
      ? Result.failure(errors)
      : Result.success(values);
  }
}

/**
 * ResultBuilder - Fluent API for building Results
 */
export class ResultBuilder {
  constructor() {
    this._checks = [];
  }

  /**
   * Add a validation check
   * @param {boolean} condition - Condition to check
   * @param {string|Error} error - Error if condition fails
   * @returns {ResultBuilder}
   */
  validate(condition, error) {
    this._checks.push({ condition, error });
    return this;
  }

  /**
   * Build the final Result
   * @param {*} value - Success value if all checks pass
   * @returns {Result}
   */
  build(value) {
    for (const check of this._checks) {
      if (!check.condition) {
        const error = typeof check.error === 'string' 
          ? new Error(check.error)
          : check.error;
        return Result.failure(error);
      }
    }
    return Result.success(value);
  }
}