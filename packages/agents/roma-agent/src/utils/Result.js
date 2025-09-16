/**
 * Result - Type-safe error handling without exceptions
 * Implements the Result pattern for better error propagation
 */

export class Result {
  constructor(success, value, error = null, metadata = {}) {
    this.success = success;
    this.value = value;
    this.error = error;
    this.metadata = metadata;
  }

  /**
   * Create a successful result
   */
  static ok(value, metadata = {}) {
    return new Result(true, value, null, metadata);
  }

  /**
   * Create a failed result
   */
  static fail(error, metadata = {}) {
    const errorInfo = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : {
      message: String(error)
    };
    
    return new Result(false, null, errorInfo, metadata);
  }

  /**
   * Execute a function and return Result
   */
  static async from(fn, metadata = {}) {
    try {
      const value = await fn();
      return Result.ok(value, metadata);
    } catch (error) {
      return Result.fail(error, metadata);
    }
  }

  /**
   * Map successful value to new Result
   */
  map(fn) {
    if (!this.success) {
      return this;
    }
    
    try {
      const newValue = fn(this.value);
      return Result.ok(newValue, this.metadata);
    } catch (error) {
      return Result.fail(error, this.metadata);
    }
  }

  /**
   * Async map successful value to new Result
   */
  async mapAsync(fn) {
    if (!this.success) {
      return this;
    }
    
    try {
      const newValue = await fn(this.value);
      return Result.ok(newValue, this.metadata);
    } catch (error) {
      return Result.fail(error, this.metadata);
    }
  }

  /**
   * Chain Results together
   */
  chain(fn) {
    if (!this.success) {
      return this;
    }
    
    try {
      return fn(this.value);
    } catch (error) {
      return Result.fail(error, this.metadata);
    }
  }

  /**
   * Get value or throw error
   */
  unwrap() {
    if (!this.success) {
      const error = new Error(this.error.message || 'Result failed');
      if (this.error.stack) {
        error.stack = this.error.stack;
      }
      throw error;
    }
    return this.value;
  }

  /**
   * Get value or default
   */
  unwrapOr(defaultValue) {
    return this.success ? this.value : defaultValue;
  }

  /**
   * Get value or compute default
   */
  unwrapOrElse(fn) {
    return this.success ? this.value : fn(this.error);
  }

  /**
   * Execute side effect if successful
   */
  ifOk(fn) {
    if (this.success) {
      fn(this.value);
    }
    return this;
  }

  /**
   * Execute side effect if failed
   */
  ifFail(fn) {
    if (!this.success) {
      fn(this.error);
    }
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(metadata) {
    return new Result(
      this.success,
      this.value,
      this.error,
      { ...this.metadata, ...metadata }
    );
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      success: this.success,
      ...(this.success ? { result: this.value } : { error: this.error }),
      metadata: this.metadata
    };
  }

  /**
   * Check if Result is ok
   */
  isOk() {
    return this.success;
  }

  /**
   * Check if Result is error
   */
  isError() {
    return !this.success;
  }
}

/**
 * Helper function for combining multiple Results
 */
export function combineResults(results) {
  const errors = [];
  const values = [];
  
  for (const result of results) {
    if (result.isError()) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }
  
  if (errors.length > 0) {
    return Result.fail({
      message: 'Multiple errors occurred',
      errors
    }, {
      failedCount: errors.length,
      successCount: values.length,
      totalCount: results.length
    });
  }
  
  return Result.ok(values, {
    successCount: values.length,
    totalCount: results.length
  });
}

/**
 * Execute functions in parallel and collect Results
 */
export async function parallel(...fns) {
  const results = await Promise.all(
    fns.map(fn => Result.from(fn))
  );
  return combineResults(results);
}

/**
 * Execute functions in sequence and collect Results
 */
export async function sequence(...fns) {
  const results = [];
  
  for (const fn of fns) {
    const result = await Result.from(fn);
    results.push(result);
    
    // Stop on first error if desired
    if (result.isError()) {
      break;
    }
  }
  
  return combineResults(results);
}