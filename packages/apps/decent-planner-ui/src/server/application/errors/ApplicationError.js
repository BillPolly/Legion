/**
 * ApplicationError
 * Base class for all application layer errors
 */

export class ApplicationError extends Error {
  constructor(message, code = 'APPLICATION_ERROR', details = null) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export class UseCaseError extends ApplicationError {
  constructor(message, useCase, originalError = null) {
    super(message, 'USE_CASE_ERROR', { useCase });
    this.name = 'UseCaseError';
    this.originalError = originalError;
  }
}

export class ServiceError extends ApplicationError {
  constructor(message, service, operation, originalError = null) {
    super(message, 'SERVICE_ERROR', { service, operation });
    this.name = 'ServiceError';
    this.originalError = originalError;
  }
}

export class CommunicationError extends ApplicationError {
  constructor(message, messageType = null, originalError = null) {
    super(message, 'COMMUNICATION_ERROR', { messageType });
    this.name = 'CommunicationError';
    this.originalError = originalError;
  }
}

export class StorageError extends ApplicationError {
  constructor(message, operation, identifier = null, originalError = null) {
    super(message, 'STORAGE_ERROR', { operation, identifier });
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}