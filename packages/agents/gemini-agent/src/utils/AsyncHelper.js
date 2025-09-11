/**
 * Utility class for handling asynchronous operations
 */
class AsyncHelper {
  /**
   * Executes an async operation with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} - Promise that resolves or rejects based on timeout
   */
  static async withTimeout(promise, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Retries an async operation with exponential backoff
   * @param {Function} operation - Async function to retry
   * @param {number} maxAttempts - Maximum number of retry attempts
   * @param {number} initialDelay - Initial delay in milliseconds
   * @returns {Promise} - Promise that resolves with operation result
   */
  static async retry(operation, maxAttempts = 3, initialDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
        
        await new Promise(resolve => {
          setTimeout(resolve, initialDelay * Math.pow(2, attempt - 1));
        });
      }
    }
    
    throw lastError;
  }
}

export default AsyncHelper;
