/**
 * ApplicationError - Base class for application layer errors
 * Following Clean Architecture - application-specific error handling
 */

export class ApplicationError extends Error {
  constructor(message, code = 'APPLICATION_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

export class UseCaseError extends ApplicationError {
  constructor(message, useCase = null, input = null) {
    super(message, 'USE_CASE_ERROR', { useCase, input });
  }
}

export class RepositoryError extends ApplicationError {
  constructor(message, repository = null, operation = null) {
    super(message, 'REPOSITORY_ERROR', { repository, operation });
  }
}

export class NotFoundError extends RepositoryError {
  constructor(entity, id) {
    super(`${entity} with id ${id} not found`, entity, 'find');
    this.code = 'NOT_FOUND';
    this.details.entity = entity;
    this.details.id = id;
  }
}

export class DuplicateError extends RepositoryError {
  constructor(entity, id) {
    super(`${entity} with id ${id} already exists`, entity, 'save');
    this.code = 'DUPLICATE';
    this.details.entity = entity;
    this.details.id = id;
  }
}

export class ServiceError extends ApplicationError {
  constructor(message, service = null, method = null) {
    super(message, 'SERVICE_ERROR', { service, method });
  }
}

export class ExternalServiceError extends ServiceError {
  constructor(message, service = null, statusCode = null) {
    super(message, service);
    this.code = 'EXTERNAL_SERVICE_ERROR';
    this.details.statusCode = statusCode;
  }
}

export class TimeoutError extends ApplicationError {
  constructor(operation, timeout) {
    super(`Operation ${operation} timed out after ${timeout}ms`, 'TIMEOUT', {
      operation,
      timeout
    });
  }
}

export class CancellationError extends ApplicationError {
  constructor(operation) {
    super(`Operation ${operation} was cancelled`, 'CANCELLED', {
      operation
    });
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message, config = null, field = null) {
    super(message, 'CONFIGURATION_ERROR', { config, field });
  }
}