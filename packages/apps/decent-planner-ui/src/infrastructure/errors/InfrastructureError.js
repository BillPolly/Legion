/**
 * InfrastructureError
 * Base class for all infrastructure layer errors
 */

export class InfrastructureError extends Error {
  constructor(message, code = 'INFRASTRUCTURE_ERROR', originalError = null) {
    super(message);
    this.name = 'InfrastructureError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date();
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      originalError: this.originalError ? this.originalError.message : null
    };
  }
}

export class AdapterError extends InfrastructureError {
  constructor(message, adapter, operation, originalError = null) {
    super(message, 'ADAPTER_ERROR', originalError);
    this.name = 'AdapterError';
    this.adapter = adapter;
    this.operation = operation;
  }
}

export class NetworkError extends InfrastructureError {
  constructor(message, url = null, statusCode = null, originalError = null) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

export class FileSystemError extends InfrastructureError {
  constructor(message, path = null, operation = null, originalError = null) {
    super(message, 'FILESYSTEM_ERROR', originalError);
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
  }
}