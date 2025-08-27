/**
 * InfrastructureError - Base class for infrastructure layer errors
 * Following Clean Architecture - infrastructure-specific error handling
 */

export class InfrastructureError extends Error {
  constructor(message, code = 'INFRASTRUCTURE_ERROR', details = {}) {
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

export class AdapterError extends InfrastructureError {
  constructor(message, adapter = null, method = null) {
    super(message, 'ADAPTER_ERROR', { adapter, method });
  }
}

export class LLMError extends AdapterError {
  constructor(message, prompt = null, response = null) {
    super(message, 'LLMAdapter');
    this.code = 'LLM_ERROR';
    this.details.prompt = prompt ? prompt.substring(0, 500) : null;
    this.details.response = response ? response.substring(0, 500) : null;
  }
}

export class LLMParseError extends LLMError {
  constructor(response, expectedFormat) {
    super('Failed to parse LLM response', null, response);
    this.code = 'LLM_PARSE_ERROR';
    this.details.expectedFormat = expectedFormat;
  }
}

export class ToolRegistryError extends AdapterError {
  constructor(message, toolName = null) {
    super(message, 'ToolRegistryAdapter');
    this.code = 'TOOL_REGISTRY_ERROR';
    this.details.toolName = toolName;
  }
}

export class StorageError extends InfrastructureError {
  constructor(message, operation = null, entity = null) {
    super(message, 'STORAGE_ERROR', { operation, entity });
  }
}

export class ConnectionError extends InfrastructureError {
  constructor(message, service = null, host = null, port = null) {
    super(message, 'CONNECTION_ERROR', { service, host, port });
  }
}

export class AuthenticationError extends InfrastructureError {
  constructor(message, service = null) {
    super(message, 'AUTHENTICATION_ERROR', { service });
  }
}

export class RateLimitError extends InfrastructureError {
  constructor(service, limit, resetTime = null) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT', {
      service,
      limit,
      resetTime
    });
  }
}

export class NetworkError extends InfrastructureError {
  constructor(message, url = null, statusCode = null) {
    super(message, 'NETWORK_ERROR', { url, statusCode });
  }
}