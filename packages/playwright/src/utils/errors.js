/**
 * Custom error classes and error handling utilities for Playwright operations
 */

/**
 * Base error class for Playwright operations
 */
export class PlaywrightError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'PlaywrightError';
    this.code = options.code || 'PLAYWRIGHT_ERROR';
    this.details = options.details || {};
    this.action = options.action || 'unknown';
    this.selector = options.selector || null;
    this.url = options.url || null;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PlaywrightError);
    }
  }
}

/**
 * Error for element not found
 */
export class ElementNotFoundError extends PlaywrightError {
  constructor(selector, options = {}) {
    super(`Element not found: ${selector}`, options);
    this.name = 'ElementNotFoundError';
    this.code = 'ELEMENT_NOT_FOUND';
    this.selector = selector;
  }
}

/**
 * Error for timeout operations
 */
export class TimeoutError extends PlaywrightError {
  constructor(action, timeout, options = {}) {
    super(`Timeout after ${timeout}ms waiting for: ${action}`, options);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.timeout = timeout;
    this.action = action;
  }
}

/**
 * Error for navigation failures
 */
export class NavigationError extends PlaywrightError {
  constructor(url, reason, options = {}) {
    super(`Navigation failed for ${url}: ${reason}`, options);
    this.name = 'NavigationError';
    this.code = 'NAVIGATION_FAILED';
    this.url = url;
    this.reason = reason;
  }
}

/**
 * Error for form interaction failures
 */
export class FormError extends PlaywrightError {
  constructor(action, formData, options = {}) {
    super(`Form ${action} failed`, options);
    this.name = 'FormError';
    this.code = 'FORM_ERROR';
    this.action = action;
    this.formData = formData;
  }
}

/**
 * Error for screenshot failures
 */
export class ScreenshotError extends PlaywrightError {
  constructor(reason, options = {}) {
    super(`Screenshot failed: ${reason}`, options);
    this.name = 'ScreenshotError';
    this.code = 'SCREENSHOT_ERROR';
    this.reason = reason;
  }
}

/**
 * Enhanced error handler that provides better error messages
 */
export function handlePlaywrightError(error, context = {}) {
  const { action, selector, url, timeout } = context;
  
  // Handle common Playwright errors
  if (error.message.includes('Target closed')) {
    return new PlaywrightError('Browser or page was closed unexpectedly', {
      code: 'TARGET_CLOSED',
      action,
      details: { originalError: error.message }
    });
  }
  
  if (error.message.includes('Timeout')) {
    return new TimeoutError(action || 'operation', timeout || 30000, {
      selector,
      url,
      details: { originalError: error.message }
    });
  }
  
  if (error.message.includes('not found') || error.message.includes('No element')) {
    return new ElementNotFoundError(selector || 'unknown', {
      action,
      url,
      details: { originalError: error.message }
    });
  }
  
  if (error.message.includes('Navigation')) {
    return new NavigationError(url || 'unknown', error.message, {
      action,
      details: { originalError: error.message }
    });
  }
  
  // Return wrapped error if not a known type
  return new PlaywrightError(error.message, {
    code: 'UNKNOWN_ERROR',
    action,
    selector,
    url,
    details: { originalError: error.message, stack: error.stack }
  });
}

/**
 * Retry wrapper for operations that might fail
 */
export async function withRetry(operation, options = {}) {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) {
        throw handlePlaywrightError(error, options);
      }
      
      // Wait before retry with backoff
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Safe operation wrapper that catches and formats errors
 */
export async function safeOperation(operation, context = {}) {
  try {
    return await operation();
  } catch (error) {
    throw handlePlaywrightError(error, context);
  }
}

/**
 * Validate required parameters
 */
export function validateParams(params, required = []) {
  const missing = required.filter(param => !(param in params) || params[param] === undefined);
  
  if (missing.length > 0) {
    throw new PlaywrightError(`Missing required parameters: ${missing.join(', ')}`, {
      code: 'MISSING_PARAMETERS',
      details: { missing, provided: Object.keys(params) }
    });
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error, context = {}) {
  const playwrightError = error instanceof PlaywrightError ? error : handlePlaywrightError(error, context);
  
  return {
    success: false,
    error: playwrightError.message,
    code: playwrightError.code,
    action: playwrightError.action,
    selector: playwrightError.selector,
    url: playwrightError.url,
    details: playwrightError.details
  };
}