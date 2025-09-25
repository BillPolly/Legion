/**
 * Endpoint Entity
 * 
 * Represents API endpoint specifications used for server code generation.
 * Used by server generation strategies and API development prompts.
 */

import { BaseEntity } from './BaseEntity.js';

export class EndpointEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'endpoint';
  }

  static getSchema() {
    return {
      ':endpoint/method': { type: 'string', cardinality: 'one' }, // GET, POST, PUT, DELETE, PATCH
      ':endpoint/path': { type: 'string', cardinality: 'one' },
      ':endpoint/description': { type: 'string', cardinality: 'one' },
      ':endpoint/project': { type: 'ref', cardinality: 'one' },
      ':endpoint/parameters': { type: 'string', cardinality: 'one' }, // JSON string of parameter specs
      ':endpoint/responses': { type: 'string', cardinality: 'one' }, // JSON string of response specs
      ':endpoint/middleware': { type: 'string', cardinality: 'many' },
      ':endpoint/authentication': { type: 'boolean', cardinality: 'one' },
    };
  }

  static getRequiredFields() {
    return [':endpoint/method', ':endpoint/path', ':endpoint/project'];
  }

  // Getters and setters for main properties
  get method() {
    return this.getField('method');
  }

  set method(value) {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(value.toUpperCase())) {
      throw new Error(`Invalid HTTP method: ${value}`);
    }
    this.setField('method', value.toUpperCase());
  }

  get path() {
    return this.getField('path');
  }

  set path(value) {
    if (!value.startsWith('/')) {
      value = '/' + value;
    }
    this.setField('path', value);
  }

  get description() {
    return this.getField('description');
  }

  set description(value) {
    this.setField('description', value);
  }

  get projectId() {
    return this.getField('project');
  }

  set projectId(value) {
    this.setField('project', value);
  }

  get parameters() {
    const params = this.getField('parameters');
    return params ? JSON.parse(params) : {};
  }

  set parameters(value) {
    this.setField('parameters', JSON.stringify(value || {}));
  }

  get responses() {
    const responses = this.getField('responses');
    return responses ? JSON.parse(responses) : {};
  }

  set responses(value) {
    this.setField('responses', JSON.stringify(value || {}));
  }

  get middleware() {
    return this.getField('middleware') || [];
  }

  set middleware(value) {
    this.setField('middleware', Array.isArray(value) ? value : [value]);
  }

  get requiresAuthentication() {
    return this.getField('authentication') || false;
  }

  set requiresAuthentication(value) {
    this.setField('authentication', Boolean(value));
  }

  // Helper methods
  addMiddleware(middleware) {
    const existing = this.middleware;
    this.middleware = [...existing, middleware];
  }

  removeMiddleware(middleware) {
    const existing = this.middleware;
    this.middleware = existing.filter(m => m !== middleware);
  }

  addParameter(name, type, required = false, description = '') {
    const params = this.parameters;
    params[name] = {
      type,
      required,
      description
    };
    this.parameters = params;
  }

  addResponse(statusCode, description, schema = null) {
    const responses = this.responses;
    responses[statusCode] = {
      description,
      schema
    };
    this.responses = responses;
  }

  // Validation specific to endpoints
  validate() {
    const baseValid = super.validate();
    
    if (this.path && !this.path.match(/^\/[a-zA-Z0-9\-_\/\:]*$/)) {
      this._errors.push('Path must be a valid URL path starting with /');
    }
    
    return this._errors.length === 0 && baseValid;
  }

  // Factory methods for common endpoint types
  static createHealthCheck(projectId) {
    return new EndpointEntity({
      ':endpoint/method': 'GET',
      ':endpoint/path': '/api/health',
      ':endpoint/description': 'Health check endpoint',
      ':endpoint/project': projectId,
      ':endpoint/parameters': JSON.stringify({}),
      ':endpoint/responses': JSON.stringify({
        '200': {
          description: 'Service is healthy',
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }),
      ':endpoint/middleware': [],
      ':endpoint/authentication': false
    });
  }

  static createCRUDEndpoint(resource, method, projectId, requiresAuth = true) {
    const methodMap = {
      'CREATE': { method: 'POST', path: `/${resource}` },
      'READ': { method: 'GET', path: `/${resource}/:id` },
      'UPDATE': { method: 'PUT', path: `/${resource}/:id` },
      'DELETE': { method: 'DELETE', path: `/${resource}/:id` },
      'LIST': { method: 'GET', path: `/${resource}` }
    };

    const config = methodMap[method.toUpperCase()];
    if (!config) {
      throw new Error(`Invalid CRUD method: ${method}`);
    }

    return new EndpointEntity({
      ':endpoint/method': config.method,
      ':endpoint/path': config.path,
      ':endpoint/description': `${method} ${resource}`,
      ':endpoint/project': projectId,
      ':endpoint/parameters': JSON.stringify({}),
      ':endpoint/responses': JSON.stringify({}),
      ':endpoint/middleware': requiresAuth ? ['auth'] : [],
      ':endpoint/authentication': requiresAuth
    });
  }

  // Convert to format expected by code generation prompts
  toPromptFormat() {
    return {
      method: this.method,
      path: this.path,
      description: this.description,
      parameters: this.parameters,
      responses: this.responses,
      middleware: this.middleware,
      authentication: this.requiresAuthentication
    };
  }

  // Create from prompt input format
  static fromPromptInput(endpointData, projectId) {
    return new EndpointEntity({
      ':endpoint/method': endpointData.method || 'GET',
      ':endpoint/path': endpointData.path,
      ':endpoint/description': endpointData.description || '',
      ':endpoint/project': projectId,
      ':endpoint/parameters': JSON.stringify(endpointData.parameters || {}),
      ':endpoint/responses': JSON.stringify(endpointData.responses || {}),
      ':endpoint/middleware': endpointData.middleware || [],
      ':endpoint/authentication': endpointData.authentication || false
    });
  }
}