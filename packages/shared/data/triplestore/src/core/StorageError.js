/**
 * Base class for storage-related errors
 */
export class StorageError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error for connection-related issues
 */
export class ConnectionError extends StorageError {
  constructor(message, cause) {
    super(message, 'CONNECTION_ERROR', cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Error for transaction-related issues
 */
export class TransactionError extends StorageError {
  constructor(message, cause) {
    super(message, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}

/**
 * Error for validation issues
 */
export class ValidationError extends StorageError {
  constructor(message, cause) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

/**
 * Error for capacity/limit issues
 */
export class CapacityError extends StorageError {
  constructor(message, cause) {
    super(message, 'CAPACITY_ERROR', cause);
    this.name = 'CapacityError';
  }
}

/**
 * Error for authentication issues
 */
export class AuthenticationError extends StorageError {
  constructor(message, cause) {
    super(message, 'AUTHENTICATION_ERROR', cause);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for network-related issues
 */
export class NetworkError extends StorageError {
  constructor(message, cause) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'NetworkError';
  }
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
export function isRetryableError(error) {
  if (error instanceof NetworkError) return true;
  if (error instanceof ConnectionError) return true;
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
  if (error.status === 429 || error.status === 503) return true; // Rate limiting or service unavailable
  return false;
}