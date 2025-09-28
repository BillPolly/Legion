/**
 * Async utilities - pure JavaScript implementation
 * Replaces Node.js specific async functions
 */

/**
 * Defer execution to next tick
 * Replaces Node.js setImmediate
 * @param {Function} callback - Function to execute
 * @param {...any} args - Arguments to pass to callback
 */
export function defer(callback, ...args) {
  // Try queueMicrotask first (most modern)
  if (typeof queueMicrotask !== 'undefined') {
    queueMicrotask(() => callback(...args));
  } 
  // Fall back to Promise for broader compatibility
  else {
    Promise.resolve().then(() => callback(...args));
  }
}

/**
 * Delay execution by specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @param {any} value - Optional value to resolve with
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

/**
 * Create a deferred promise
 * @returns {Object} Object with promise, resolve, and reject
 */
export function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Run async function or promise with timeout
 * @param {Promise|Function} promiseOrFn - Promise or async function to run
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Optional timeout message
 * @returns {Promise} Promise that rejects on timeout
 */
export async function withTimeout(promiseOrFn, timeoutMs, timeoutMessage) {
  const message = timeoutMessage || `Operation timed out after ${timeoutMs}ms`;
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(message)), timeoutMs)
  );
  
  // Handle both promises and functions
  const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry an async function
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of successful execution
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay: delayMs = 1000,
    backoff = false
  } = options;
  
  let lastError;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Wrap in Promise.resolve to handle both sync and async functions
      return await Promise.resolve(fn());
    } catch (error) {
      lastError = error;
      if (i < maxAttempts - 1) {
        const waitTime = backoff ? delayMs * Math.pow(2, i) : delayMs;
        await delay(waitTime);
      }
    }
  }
  
  throw lastError;
}

// Default export
export default {
  defer,
  delay,
  createDeferred,
  withTimeout,
  retry
};