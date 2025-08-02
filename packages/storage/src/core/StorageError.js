/**
 * StorageError - Custom error class for storage operations
 */

export class StorageError extends Error {
  constructor(message, code, provider, operation, details = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.provider = provider;
    this.operation = operation;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      operation: this.operation,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}