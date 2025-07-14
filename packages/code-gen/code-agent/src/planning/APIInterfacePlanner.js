/**
 * APIInterfacePlanner - Plans API interfaces and contracts
 * 
 * Creates comprehensive API interfaces, data transfer objects, and communication
 * patterns between frontend and backend components.
 */

class APIInterfacePlanner {
  constructor(config = {}) {
    this.config = {
      apiVersion: 'v1',
      responseFormat: 'JSON',
      enableWebSocket: false,
      enableGraphQL: false,
      paginationStrategy: 'page-based',
      authStrategy: 'JWT',
      ...config
    };

    // Standard HTTP status codes
    this.statusCodes = {
      ok: 200,
      created: 201,
      noContent: 204,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      notFound: 404,
      conflict: 409,
      validationError: 422,
      serverError: 500
    };

    // Standard field types
    this.fieldTypes = {
      string: { validation: ['minLength', 'maxLength', 'pattern'] },
      number: { validation: ['min', 'max', 'integer'] },
      boolean: { validation: [] },
      date: { validation: ['format', 'min', 'max'] },
      email: { validation: ['email', 'required'] },
      array: { validation: ['minItems', 'maxItems'] },
      object: { validation: ['properties'] }
    };
  }

  /**
   * Plan complete API interfaces between frontend and backend
   * 
   * @param {Object} frontendArchitecture - Frontend architecture plan
   * @param {Object} backendArchitecture - Backend architecture plan
   * @returns {Promise<Object>} Complete API interface plan
   */
  async planInterfaces(frontendArchitecture, backendArchitecture) {
    if (!frontendArchitecture || !backendArchitecture) {
      throw new Error('Frontend and backend architectures must be provided');
    }

    const interfaces = {
      contracts: [],
      dataTransferObjects: {},
      communication: {},
      errorHandling: {},
      authentication: {},
      pagination: {},
      fileHandling: {},
      metadata: {
        planner: 'APIInterfacePlanner',
        plannedAt: Date.now(),
        apiVersion: this.config.apiVersion
      }
    };

    try {
      // Plan API contracts
      if (backendArchitecture.apiDesign) {
        interfaces.contracts = await this.planApiContracts(backendArchitecture.apiDesign);
      }

      // Generate DTOs from backend models
      if (backendArchitecture.dataLayer?.models) {
        interfaces.dataTransferObjects = await this.generateDTOs(backendArchitecture.dataLayer.models);
      }

      // Plan communication patterns
      const features = this._extractFeatures(frontendArchitecture, backendArchitecture);
      interfaces.communication = await this.planCommunication(
        backendArchitecture.apiDesign?.style || 'REST',
        features
      );

      // Plan error handling
      interfaces.errorHandling = await this.planErrorHandling();

      // Plan authentication interfaces if needed
      if (features.includes('auth') || features.includes('authentication')) {
        interfaces.authentication = await this.planAuthInterfaces(features);
      }

      // Plan pagination if list endpoints exist
      if (interfaces.contracts.some(c => c.method === 'GET' && c.endpoint.includes('s'))) {
        interfaces.pagination = await this.planPaginationInterfaces(interfaces.contracts);
      }

      // Plan file handling if needed
      if (features.includes('file-upload') || features.includes('upload')) {
        interfaces.fileHandling = await this.planFileInterfaces(features);
      }

      return interfaces;

    } catch (error) {
      throw new Error(`API interface planning failed: ${error.message}`);
    }
  }

  /**
   * Plan API contracts for REST or GraphQL
   * 
   * @param {Object} apiDesign - Backend API design
   * @returns {Promise<Array|Object>} API contracts
   */
  async planApiContracts(apiDesign) {
    if (apiDesign.style === 'GraphQL') {
      return this._planGraphQLContracts(apiDesign);
    } else {
      return this._planRestContracts(apiDesign);
    }
  }

  /**
   * Generate Data Transfer Objects for models
   * 
   * @param {Array<string>} models - Model names
   * @returns {Promise<Object>} DTO definitions
   */
  async generateDTOs(models) {
    const dtos = {};

    for (const model of models) {
      dtos[model] = {
        request: this._generateRequestDTO(model),
        response: this._generateResponseDTO(model),
        create: this._generateCreateDTO(model),
        update: this._generateUpdateDTO(model)
      };
    }

    // Add relationships between DTOs
    this._addDTORelationships(dtos, models);

    return dtos;
  }

  /**
   * Plan communication patterns
   * 
   * @param {string} apiStyle - API style (REST, GraphQL)
   * @param {Array<string>} features - List of features
   * @returns {Promise<Object>} Communication plan
   */
  async planCommunication(apiStyle, features) {
    const communication = {
      protocol: 'HTTP',
      format: this.config.responseFormat,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      headers: this._planHeaders(),
      cors: this._planCORS()
    };

    // Add WebSocket for real-time features
    if (features.includes('real-time') || features.includes('live-updates') || features.includes('notifications')) {
      communication.webSocket = {
        enabled: true,
        url: '/ws',
        events: this._planWebSocketEvents(features),
        authentication: features.includes('auth')
      };
    }

    // Add Server-Sent Events for one-way updates
    if (features.includes('live-feed') || features.includes('notifications')) {
      communication.serverSentEvents = {
        enabled: true,
        endpoints: ['/events', '/notifications'],
        authentication: features.includes('auth')
      };
    }

    // Add GraphQL subscriptions
    if (apiStyle === 'GraphQL' && (features.includes('real-time') || features.includes('subscriptions'))) {
      communication.subscriptions = {
        enabled: true,
        types: this._planGraphQLSubscriptions(features),
        transport: 'WebSocket'
      };
    }

    return communication;
  }

  /**
   * Plan error handling interfaces
   * 
   * @returns {Promise<Object>} Error handling plan
   */
  async planErrorHandling() {
    return {
      standardFormat: {
        error: true,
        message: 'string',
        code: 'string',
        details: 'object',
        timestamp: 'string'
      },
      codes: {
        validation: 'VALIDATION_ERROR',
        authentication: 'AUTH_ERROR',
        authorization: 'PERMISSION_DENIED',
        notFound: 'NOT_FOUND',
        conflict: 'CONFLICT',
        serverError: 'INTERNAL_ERROR'
      },
      validation: {
        fieldErrors: {
          field: 'string',
          message: 'string',
          code: 'string',
          value: 'any'
        },
        format: 'array'
      },
      httpStatusMapping: this.statusCodes
    };
  }

  /**
   * Plan authentication interfaces
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Object>} Authentication interfaces
   */
  async planAuthInterfaces(features) {
    const authInterfaces = {
      endpoints: {
        login: {
          path: '/auth/login',
          method: 'POST',
          requestBody: 'LoginDTO',
          response: 'TokenResponseDTO'
        },
        logout: {
          path: '/auth/logout',
          method: 'POST',
          response: 'MessageResponseDTO'
        },
        refresh: {
          path: '/auth/refresh',
          method: 'POST',
          requestBody: 'RefreshTokenDTO',
          response: 'TokenResponseDTO'
        }
      },
      tokenResponse: {
        accessToken: { type: 'string', required: true },
        refreshToken: { type: 'string', required: true },
        expiresIn: { type: 'number', required: true },
        tokenType: { type: 'string', default: 'Bearer' }
      },
      headers: {
        authorization: 'Bearer {token}',
        required: ['Authorization']
      }
    };

    // Add user profile interfaces
    if (features.includes('user-profile') || features.includes('profile')) {
      authInterfaces.userProfile = {
        fields: {
          id: { type: 'string', required: true },
          email: { type: 'string', required: true },
          name: { type: 'string', required: true },
          roles: { type: 'array', items: 'string' },
          permissions: { type: 'array', items: 'string' }
        },
        permissions: ['read:profile', 'write:profile']
      };
    }

    // Add OAuth interfaces
    if (features.includes('oauth')) {
      authInterfaces.oauth = {
        providers: ['google', 'github', 'facebook'],
        endpoints: {
          authorize: '/auth/oauth/{provider}',
          callback: '/auth/oauth/{provider}/callback'
        }
      };
    }

    return authInterfaces;
  }

  /**
   * Plan pagination interfaces
   * 
   * @param {Array<Object>} endpoints - API endpoints
   * @returns {Promise<Object>} Pagination interfaces
   */
  async planPaginationInterfaces(endpoints) {
    const listEndpoints = endpoints.filter(e => e.method === 'GET' && this._isListEndpoint(e.endpoint));

    return {
      parameters: {
        page: { type: 'number', default: 1, min: 1 },
        limit: { type: 'number', default: 20, min: 1, max: 100 },
        offset: { type: 'number', default: 0, min: 0 },
        sort: { type: 'string', format: 'field:direction' },
        order: { type: 'string', enum: ['asc', 'desc'] }
      },
      responseFormat: {
        data: { type: 'array', items: 'object' },
        pagination: {
          total: { type: 'number' },
          page: { type: 'number' },
          limit: { type: 'number' },
          pages: { type: 'number' },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' }
        }
      },
      strategies: {
        pageSize: this.config.paginationStrategy,
        cursorBased: false,
        offsetBased: true
      }
    };
  }

  /**
   * Plan filtering interfaces
   * 
   * @param {Array<Object>} endpoints - API endpoints
   * @returns {Promise<Object>} Filtering interfaces
   */
  async planFilteringInterfaces(endpoints) {
    return {
      filters: {
        parameters: {
          filter: { type: 'object', description: 'Field filters' },
          search: { type: 'string', description: 'Global search term' },
          where: { type: 'object', description: 'Complex query conditions' }
        },
        operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'like', 'regex']
      },
      sorting: {
        parameter: 'sort',
        format: 'field:direction',
        multiple: true,
        directions: ['asc', 'desc']
      },
      search: {
        parameter: 'q',
        type: 'full-text',
        fields: ['name', 'description', 'title']
      }
    };
  }

  /**
   * Plan file handling interfaces
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Object>} File handling interfaces
   */
  async planFileInterfaces(features) {
    return {
      uploadEndpoint: {
        path: '/files/upload',
        method: 'POST',
        contentType: 'multipart/form-data'
      },
      downloadEndpoint: {
        path: '/files/{id}',
        method: 'GET',
        response: 'file-stream'
      },
      supportedTypes: this._getSupportedFileTypes(features),
      maxSize: 10 * 1024 * 1024, // 10MB
      encoding: 'multipart/form-data',
      metadata: {
        filename: { type: 'string', required: true },
        size: { type: 'number', required: true },
        mimeType: { type: 'string', required: true },
        uploadedAt: { type: 'date', required: true },
        url: { type: 'string', required: true }
      },
      validation: {
        maxSize: '10MB',
        allowedTypes: ['image/*', 'application/pdf', 'text/*'],
        virusScanning: true
      }
    };
  }

  /**
   * Map frontend components to API contracts
   * 
   * @param {Array<Object>} components - Frontend components
   * @returns {Promise<Object>} Component to contract mapping
   */
  async mapComponentsToContracts(components) {
    const mapping = {};

    for (const component of components) {
      mapping[component.name] = {
        contracts: this._getComponentContracts(component),
        dataFlow: this._getComponentDataFlow(component),
        events: this._getComponentEvents(component)
      };
    }

    return mapping;
  }

  /**
   * Align DTOs with backend models and frontend state
   * 
   * @param {Array<string>} backendModels - Backend model names
   * @param {Array<string>} frontendState - Frontend state names
   * @returns {Promise<Object>} DTO alignment
   */
  async alignDTOsWithModels(backendModels, frontendState) {
    const alignment = {};

    for (const model of backendModels) {
      const stateName = this._mapModelToState(model, frontendState);
      alignment[model] = {
        frontendState: stateName,
        transformations: this._getStateTransformations(model, stateName),
        synchronization: this._getSyncStrategy(model)
      };
    }

    return alignment;
  }

  /**
   * Validate interface completeness
   * 
   * @param {Object} interfaces - Interface definitions
   * @returns {Promise<Object>} Validation result
   */
  async validateInterfaces(interfaces) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check required components
    if (!interfaces.contracts || interfaces.contracts.length === 0) {
      validation.isValid = false;
      validation.errors.push('No API contracts defined');
    }

    if (!interfaces.dataTransferObjects || Object.keys(interfaces.dataTransferObjects).length === 0) {
      validation.warnings.push('No DTOs defined - consider adding data transfer objects');
    }

    if (!interfaces.communication) {
      validation.warnings.push('Communication patterns not defined');
    }

    if (!interfaces.errorHandling || !interfaces.errorHandling.standardFormat) {
      validation.warnings.push('Error handling format not standardized');
    }

    // Suggestions
    if (interfaces.contracts && interfaces.contracts.length > 5 && !interfaces.pagination) {
      validation.suggestions.push('Consider adding pagination for list endpoints');
    }

    if (interfaces.contracts && !interfaces.authentication) {
      validation.suggestions.push('Consider adding authentication interfaces for security');
    }

    return validation;
  }

  /**
   * Generate API documentation
   * 
   * @param {Object} interfaces - Interface definitions
   * @returns {Promise<Object>} API documentation
   */
  async generateDocumentation(interfaces) {
    const documentation = {
      apiReference: this._generateApiReference(interfaces),
      dataTypes: this._generateDataTypesDocs(interfaces),
      examples: this._generateExamples(interfaces),
      authenticationGuide: this._generateAuthGuide(interfaces),
      errorHandlingGuide: this._generateErrorGuide(interfaces)
    };

    return documentation;
  }

  /**
   * Generate OpenAPI specification
   * 
   * @param {Object} interfaces - Interface definitions
   * @returns {Promise<Object>} OpenAPI specification
   */
  async generateOpenAPISpec(interfaces) {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'API Specification',
        version: this.config.apiVersion,
        description: 'Generated API specification'
      },
      servers: [
        { url: `/api/${this.config.apiVersion}`, description: 'API Server' }
      ],
      paths: this._generateOpenAPIPaths(interfaces),
      components: {
        schemas: this._generateOpenAPISchemas(interfaces),
        securitySchemes: this._generateSecuritySchemes(interfaces)
      }
    };

    return spec;
  }

  /**
   * Helper methods
   */

  _planRestContracts(apiDesign) {
    const contracts = [];

    for (const endpoint of apiDesign.endpoints || []) {
      contracts.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        description: endpoint.description || `${endpoint.method} ${endpoint.path}`,
        requestBody: this._getRequestBodyType(endpoint),
        responseType: this._getResponseType(endpoint),
        statusCodes: this._getStatusCodes(endpoint),
        parameters: this._getParameters(endpoint),
        headers: this._getRequiredHeaders(endpoint)
      });
    }

    return contracts;
  }

  _planGraphQLContracts(apiDesign) {
    return {
      queries: apiDesign.queries || [],
      mutations: apiDesign.mutations || [],
      types: apiDesign.schema?.types || [],
      schema: this._generateGraphQLSchema(apiDesign),
      resolvers: this._planGraphQLResolvers(apiDesign)
    };
  }

  _generateRequestDTO(model) {
    const fields = this._getModelFields(model);
    return {
      name: `${model}RequestDTO`,
      fields: this._filterRequestFields(fields),
      validation: this._getValidationRules(fields)
    };
  }

  _generateResponseDTO(model) {
    const fields = this._getModelFields(model);
    return {
      name: `${model}ResponseDTO`,
      fields: this._addResponseFields(fields),
      relationships: this._getModelRelationships(model)
    };
  }

  _generateCreateDTO(model) {
    const fields = this._getModelFields(model);
    return {
      name: `${model}CreateDTO`,
      fields: this._filterCreateFields(fields),
      validation: this._getCreateValidation(model),
      required: this._getRequiredCreateFields(model)
    };
  }

  _generateUpdateDTO(model) {
    const fields = this._getModelFields(model);
    return {
      name: `${model}UpdateDTO`,
      fields: this._filterUpdateFields(fields),
      validation: this._getUpdateValidation(model),
      partial: true
    };
  }

  _addDTORelationships(dtos, models) {
    // Add User -> Todo relationship
    if (dtos.User && dtos.Todo) {
      dtos.User.response.fields.todos = {
        type: 'array',
        items: 'TodoResponseDTO',
        description: 'User todos'
      };
      dtos.Todo.response.fields.user = {
        type: 'object',
        ref: 'UserResponseDTO',
        description: 'Todo owner'
      };
    }

    // Add other common relationships
    for (const model of models) {
      if (model !== 'User' && dtos[model]) {
        dtos[model].response.fields.createdBy = {
          type: 'object',
          ref: 'UserResponseDTO',
          description: 'Created by user'
        };
      }
    }
  }

  _extractFeatures(frontendArchitecture, backendArchitecture) {
    const features = new Set();

    // Extract from frontend components
    if (frontendArchitecture.components) {
      for (const component of frontendArchitecture.components) {
        if (component.name.toLowerCase().includes('auth')) features.add('auth');
        if (component.type === 'form') features.add('form-validation');
        if (component.name.toLowerCase().includes('upload')) features.add('file-upload');
      }
    }

    // Extract from backend features
    if (backendArchitecture.components?.backend?.features) {
      backendArchitecture.components.backend.features.forEach(f => features.add(f));
    }

    // Extract from API endpoints
    if (backendArchitecture.apiDesign?.endpoints) {
      for (const endpoint of backendArchitecture.apiDesign.endpoints) {
        if (endpoint.path.includes('auth')) features.add('auth');
        if (endpoint.path.includes('upload')) features.add('file-upload');
        if (endpoint.method === 'GET' && endpoint.path.includes('s')) features.add('pagination');
      }
    }

    return Array.from(features);
  }

  _planHeaders() {
    return {
      standard: ['Content-Type', 'Accept', 'User-Agent'],
      authentication: ['Authorization'],
      cors: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods'],
      custom: ['X-Request-ID', 'X-API-Version']
    };
  }

  _planCORS() {
    return {
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true
    };
  }

  _planWebSocketEvents(features) {
    const events = ['connect', 'disconnect', 'error'];

    if (features.includes('notifications')) {
      events.push('notification', 'message');
    }

    if (features.includes('real-time') || features.includes('live-updates')) {
      events.push('update', 'change', 'sync');
    }

    if (features.includes('chat')) {
      events.push('chat-message', 'user-joined', 'user-left');
    }

    return events;
  }

  _planGraphQLSubscriptions(features) {
    const subscriptions = [];

    if (features.includes('notifications')) {
      subscriptions.push('notificationReceived');
    }

    if (features.includes('real-time')) {
      subscriptions.push('dataUpdated', 'itemChanged');
    }

    return subscriptions;
  }

  _getSupportedFileTypes(features) {
    const types = ['image/jpeg', 'image/png', 'image/gif'];

    if (features.includes('document-upload')) {
      types.push('application/pdf', 'application/msword', 'text/plain');
    }

    if (features.includes('media-upload')) {
      types.push('video/mp4', 'audio/mpeg');
    }

    return types;
  }

  _getComponentContracts(component) {
    const contracts = [];
    const componentType = component.type;
    const componentName = component.name.toLowerCase();

    if (componentType === 'display' || componentName.includes('list')) {
      const resource = this._extractResourceFromComponent(componentName);
      contracts.push(`GET /${resource}s`);
    }

    if (componentType === 'form' || componentName.includes('form')) {
      const resource = this._extractResourceFromComponent(componentName);
      contracts.push(`POST /${resource}s`);
      contracts.push(`PUT /${resource}s/{id}`);
    }

    if (componentName.includes('auth')) {
      contracts.push('POST /auth/login', 'POST /auth/logout');
    }

    return contracts;
  }

  _getComponentDataFlow(component) {
    const flows = [];
    
    if (component.type === 'form') {
      flows.push('user-input -> validation -> api-request');
    }
    
    if (component.type === 'display') {
      flows.push('api-request -> data-processing -> ui-render');
    }

    return flows;
  }

  _getComponentEvents(component) {
    const events = [];

    if (component.type === 'form') {
      events.push('submit', 'validate', 'error');
    }

    if (component.type === 'display') {
      events.push('load', 'refresh', 'select');
    }

    return events;
  }

  _mapModelToState(model, frontendState) {
    const modelLower = model.toLowerCase();
    
    for (const state of frontendState) {
      if (state.toLowerCase().includes(modelLower)) {
        return state;
      }
    }

    return `${modelLower}State`;
  }

  _getStateTransformations(model, stateName) {
    return {
      toState: `${model}DTO -> ${stateName}`,
      fromState: `${stateName} -> ${model}DTO`,
      normalize: true,
      denormalize: true
    };
  }

  _getSyncStrategy(model) {
    return {
      strategy: 'optimistic',
      conflictResolution: 'server-wins',
      offline: false
    };
  }

  _isListEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') {
      return false;
    }
    return endpoint.endsWith('s') && !endpoint.includes('{') && !endpoint.includes(':');
  }

  _getRequestBodyType(endpoint) {
    if (endpoint.method === 'POST') {
      const resource = this._extractResourceFromPath(endpoint.path);
      return `${resource}CreateDTO`;
    } else if (endpoint.method === 'PUT' || endpoint.method === 'PATCH') {
      const resource = this._extractResourceFromPath(endpoint.path);
      return `${resource}UpdateDTO`;
    }
    return null;
  }

  _getResponseType(endpoint) {
    const resource = this._extractResourceFromPath(endpoint.path);
    
    if (endpoint.method === 'GET' && this._isListEndpoint(endpoint.path)) {
      return `PaginatedResponse<${resource}ResponseDTO>`;
    } else if (endpoint.method === 'GET') {
      return `${resource}ResponseDTO`;
    } else if (endpoint.method === 'POST') {
      return `${resource}ResponseDTO`;
    } else if (endpoint.method === 'PUT') {
      return `${resource}ResponseDTO`;
    } else if (endpoint.method === 'DELETE') {
      return 'MessageResponseDTO';
    }
    
    return 'SuccessResponseDTO';
  }

  _getStatusCodes(endpoint) {
    const codes = [this.statusCodes.ok];
    
    if (endpoint.method === 'POST') {
      codes[0] = this.statusCodes.created;
    } else if (endpoint.method === 'DELETE') {
      codes[0] = this.statusCodes.noContent;
    }

    codes.push(
      this.statusCodes.badRequest,
      this.statusCodes.unauthorized,
      this.statusCodes.serverError
    );

    return codes;
  }

  _getParameters(endpoint) {
    const params = [];

    if (endpoint.path.includes('{id}') || endpoint.path.includes(':id')) {
      params.push({ name: 'id', type: 'string', in: 'path', required: true });
    }

    if (endpoint.method === 'GET' && this._isListEndpoint(endpoint.path)) {
      params.push(
        { name: 'page', type: 'number', in: 'query' },
        { name: 'limit', type: 'number', in: 'query' },
        { name: 'sort', type: 'string', in: 'query' }
      );
    }

    return params;
  }

  _getRequiredHeaders(endpoint) {
    const headers = ['Content-Type'];
    
    if (endpoint.path.includes('/auth/') && endpoint.path !== '/auth/login') {
      headers.push('Authorization');
    }

    return headers;
  }

  _getModelFields(model) {
    const commonFields = {
      id: { type: 'string', primary: true },
      createdAt: { type: 'date', readonly: true },
      updatedAt: { type: 'date', readonly: true }
    };

    const modelFields = {
      User: {
        email: { type: 'string', required: true, unique: true, validation: ['email'] },
        password: { type: 'string', required: true, writeOnly: true },
        name: { type: 'string', required: true },
        role: { type: 'string', enum: ['user', 'admin'] }
      },
      Todo: {
        title: { type: 'string', required: true },
        description: { type: 'string' },
        completed: { type: 'boolean', default: false },
        userId: { type: 'string', required: true, ref: 'User' }
      },
      Post: {
        title: { type: 'string', required: true },
        content: { type: 'string', required: true },
        published: { type: 'boolean', default: false },
        authorId: { type: 'string', required: true, ref: 'User' }
      }
    };

    return { ...commonFields, ...(modelFields[model] || {}) };
  }

  _filterRequestFields(fields) {
    const filtered = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!field.readonly && !field.primary) {
        filtered[key] = field;
      }
    }
    return filtered;
  }

  _filterCreateFields(fields) {
    const filtered = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!field.readonly && !field.primary && key !== 'id') {
        filtered[key] = field;
      }
    }
    return filtered;
  }

  _filterUpdateFields(fields) {
    const filtered = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!field.readonly && !field.primary && key !== 'id') {
        filtered[key] = { ...field, required: false };
      }
    }
    return filtered;
  }

  _addResponseFields(fields) {
    return fields; // All fields for response
  }

  _getValidationRules(fields) {
    const rules = {};
    for (const [key, field] of Object.entries(fields)) {
      if (field.required) rules[key] = ['required'];
      if (field.validation) rules[key] = (rules[key] || []).concat(field.validation);
      if (field.minLength) rules[key] = (rules[key] || []).concat([`minLength:${field.minLength}`]);
    }
    return rules;
  }

  _getCreateValidation(model) {
    const validations = {};
    const fields = this._getModelFields(model);
    
    for (const [key, field] of Object.entries(fields)) {
      if (field.required && key !== 'id') {
        validations[key] = ['required'];
      }
    }

    return validations;
  }

  _getUpdateValidation(model) {
    // Update validation is usually less strict
    return {};
  }

  _getRequiredCreateFields(model) {
    const fields = this._getModelFields(model);
    return Object.keys(fields).filter(key => fields[key].required && key !== 'id');
  }

  _getModelRelationships(model) {
    const relationships = {};

    if (model === 'User') {
      relationships.todos = { type: 'hasMany', model: 'Todo' };
      relationships.posts = { type: 'hasMany', model: 'Post' };
    } else if (model === 'Todo') {
      relationships.user = { type: 'belongsTo', model: 'User' };
    } else if (model === 'Post') {
      relationships.author = { type: 'belongsTo', model: 'User' };
    }

    return relationships;
  }

  _extractResourceFromComponent(componentName) {
    if (componentName.includes('user')) return 'user';
    if (componentName.includes('todo')) return 'todo';
    if (componentName.includes('post')) return 'post';
    return 'item';
  }

  _extractResourceFromPath(path) {
    const parts = path.split('/').filter(p => p && !p.includes('{') && !p.includes(':'));
    if (parts.length > 0) {
      const resource = parts[parts.length - 1];
      return resource.endsWith('s') ? resource.slice(0, -1) : resource;
    }
    return 'Item';
  }

  _generateApiReference(interfaces) {
    if (!interfaces.contracts || interfaces.contracts.length === 0) {
      return 'No API contracts available';
    }

    return interfaces.contracts
      .map(contract => `${contract.method} ${contract.endpoint} - ${contract.description}`)
      .join('\n');
  }

  _generateDataTypesDocs(interfaces) {
    if (!interfaces.dataTransferObjects) {
      return 'No data types defined';
    }

    const docs = [];
    for (const [model, dtos] of Object.entries(interfaces.dataTransferObjects)) {
      docs.push(`${model} DTOs:`);
      if (dtos.response) {
        docs.push(`  - ${dtos.response.name}: Response format`);
      }
      if (dtos.create) {
        docs.push(`  - ${dtos.create.name}: Creation format`);
      }
    }

    return docs.join('\n');
  }

  _generateExamples(interfaces) {
    const examples = {
      requests: {},
      responses: {}
    };

    // Generate request examples
    if (interfaces.dataTransferObjects) {
      for (const [model, dtos] of Object.entries(interfaces.dataTransferObjects)) {
        if (dtos.create && dtos.create.fields) {
          examples.requests[`${model}Create`] = this._generateExampleData(dtos.create.fields);
        }
      }
    }

    // Generate response examples
    if (interfaces.dataTransferObjects) {
      for (const [model, dtos] of Object.entries(interfaces.dataTransferObjects)) {
        if (dtos.response && dtos.response.fields) {
          examples.responses[`${model}Response`] = this._generateExampleData(dtos.response.fields);
        }
      }
    }

    return examples;
  }

  _generateExampleData(fields) {
    const example = {};
    
    for (const [key, field] of Object.entries(fields)) {
      if (field.example) {
        example[key] = field.example;
      } else if (field.type === 'string') {
        example[key] = `example_${key}`;
      } else if (field.type === 'email') {
        example[key] = 'user@example.com';
      } else if (field.type === 'number') {
        example[key] = 42;
      } else if (field.type === 'boolean') {
        example[key] = true;
      } else if (field.type === 'date') {
        example[key] = new Date().toISOString();
      }
    }

    return example;
  }

  _generateAuthGuide(interfaces) {
    if (!interfaces.authentication) {
      return 'No authentication configured';
    }

    return `Authentication Guide:
- Login: ${interfaces.authentication.endpoints?.login?.path || '/auth/login'}
- Token format: ${interfaces.authentication.tokenResponse ? 'Bearer token' : 'Not configured'}
- Headers: ${interfaces.authentication.headers?.authorization || 'Authorization: Bearer {token}'}`;
  }

  _generateErrorGuide(interfaces) {
    if (!interfaces.errorHandling) {
      return 'No error handling configured';
    }

    return `Error Handling:
- Format: ${JSON.stringify(interfaces.errorHandling.standardFormat || {})}
- Status codes: ${Object.values(interfaces.errorHandling.httpStatusMapping || {}).join(', ')}`;
  }

  _generateOpenAPIPaths(interfaces) {
    const paths = {};

    if (interfaces.contracts) {
      for (const contract of interfaces.contracts) {
        if (!paths[contract.endpoint]) {
          paths[contract.endpoint] = {};
        }

        paths[contract.endpoint][contract.method.toLowerCase()] = {
          summary: contract.description,
          responses: {
            '200': { description: 'Success' },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Internal Server Error' }
          }
        };
      }
    }

    return paths;
  }

  _generateOpenAPISchemas(interfaces) {
    const schemas = {};

    if (interfaces.dataTransferObjects) {
      for (const [model, dtos] of Object.entries(interfaces.dataTransferObjects)) {
        if (dtos.response) {
          schemas[`${model}Response`] = {
            type: 'object',
            properties: this._convertFieldsToOpenAPIProperties(dtos.response.fields || {})
          };
        }
      }
    }

    return schemas;
  }

  _generateSecuritySchemes(interfaces) {
    const schemes = {};

    if (interfaces.authentication) {
      schemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
    }

    return schemes;
  }

  _convertFieldsToOpenAPIProperties(fields) {
    const properties = {};

    for (const [key, field] of Object.entries(fields)) {
      properties[key] = {
        type: this._mapTypeToOpenAPI(field.type),
        description: field.description || `${key} field`
      };

      if (field.enum) {
        properties[key].enum = field.enum;
      }
    }

    return properties;
  }

  _mapTypeToOpenAPI(type) {
    const mapping = {
      string: 'string',
      email: 'string',
      number: 'number',
      boolean: 'boolean',
      date: 'string',
      array: 'array',
      object: 'object'
    };

    return mapping[type] || 'string';
  }

  _generateGraphQLSchema(apiDesign) {
    return `
type Query {
  ${(apiDesign.queries || []).map(q => `${q}: String`).join('\n  ')}
}

type Mutation {
  ${(apiDesign.mutations || []).map(m => `${m}: String`).join('\n  ')}
}

${(apiDesign.schema?.types || []).map(t => `type ${t} { id: ID! }`).join('\n\n')}
    `.trim();
  }

  _planGraphQLResolvers(apiDesign) {
    const resolvers = {};

    for (const query of apiDesign.queries || []) {
      resolvers[query] = 'QueryResolver';
    }

    for (const mutation of apiDesign.mutations || []) {
      resolvers[mutation] = 'MutationResolver';
    }

    return resolvers;
  }
}

export { APIInterfacePlanner };