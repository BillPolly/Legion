/**
 * BackendArchitecturePlanner - Plans backend architecture and service design
 * 
 * Creates optimal backend architectures including API design, data layer,
 * middleware stack, security, and service organization patterns.
 */

class BackendArchitecturePlanner {
  constructor(config = {}) {
    this.config = {
      apiStyle: 'REST',
      dataLayer: 'repository',
      enableMiddleware: true,
      authStrategy: 'JWT',
      cachingStrategy: 'redis',
      ...config
    };

    // Architecture patterns by complexity
    this.architecturePatterns = {
      low: 'monolithic',
      medium: 'layered',
      high: 'microservices'
    };

    // Data layer patterns
    this.dataPatterns = {
      low: 'active-record',
      medium: 'repository',
      high: 'dao'
    };

    // Common HTTP methods for REST
    this.httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  }

  /**
   * Plan complete backend architecture
   * 
   * @param {Object} analysis - Project analysis from RequirementAnalyzer
   * @returns {Promise<Object>} Complete backend architecture plan
   */
  async planArchitecture(analysis) {
    if (!analysis) {
      throw new Error('Analysis must be provided');
    }

    const complexity = analysis.complexity || 'medium';
    const features = analysis.components?.backend?.features || ['api'];
    
    const architecture = {
      pattern: this.architecturePatterns[complexity],
      apiDesign: {},
      dataLayer: {},
      services: [],
      middleware: [],
      security: {},
      performance: {},
      metadata: {
        planner: 'BackendArchitecturePlanner',
        plannedAt: Date.now(),
        complexity,
        pattern: this.architecturePatterns[complexity]
      }
    };

    try {
      // Plan API design
      architecture.apiDesign = await this.planApiDesign(features, this.config.apiStyle);
      
      // Plan data layer
      architecture.dataLayer = await this.planDataLayer(analysis);
      
      // Plan services
      architecture.services = await this.planServices(features);
      
      // Plan middleware stack
      architecture.middleware = await this.planMiddleware(features);
      
      // Plan security
      architecture.security = await this.planSecurity(features);
      
      // Plan performance optimizations
      architecture.performance = await this.planPerformance(features);

      // Add layers for layered architecture
      if (architecture.pattern === 'layered') {
        architecture.layers = this._defineLayers(features);
      }

      // Add microservices structure for high complexity
      if (architecture.pattern === 'microservices') {
        architecture.services = this._planMicroservices(features);
        architecture.communication = this._planServiceCommunication();
        architecture.dataConsistency = this._planDataConsistency();
      }

      return architecture;

    } catch (error) {
      throw new Error(`Backend architecture planning failed: ${error.message}`);
    }
  }

  /**
   * Plan API design structure
   * 
   * @param {Array<string>} features - List of features
   * @param {string} apiStyle - API style (REST, GraphQL)
   * @returns {Promise<Object>} API design plan
   */
  async planApiDesign(features, apiStyle = 'REST') {
    const apiDesign = {
      style: apiStyle,
      version: 'v1',
      baseUrl: '/api/v1'
    };

    if (apiStyle === 'REST') {
      apiDesign.endpoints = this._planRestEndpoints(features);
      apiDesign.resourceRoutes = this._planResourceRoutes(features);
      apiDesign.authentication = this._planAuthEndpoints(features);
    } else if (apiStyle === 'GraphQL') {
      apiDesign.schema = this._planGraphQLSchema(features);
      apiDesign.resolvers = this._planGraphQLResolvers(features);
      apiDesign.queries = this._planGraphQLQueries(features);
      apiDesign.mutations = this._planGraphQLMutations(features);
    }

    return apiDesign;
  }

  /**
   * Plan data layer architecture
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Data layer plan
   */
  async planDataLayer(analysis) {
    const complexity = analysis.complexity || 'medium';
    const features = analysis.components?.backend?.features || [];
    const technologies = analysis.components?.backend?.technologies || [];
    
    const pattern = this.dataPatterns[complexity];
    const models = await this.identifyModels(features);
    
    const dataLayer = {
      pattern,
      models,
      connections: this._planDatabaseConnections(technologies),
      schemas: await this.planDatabaseSchemas(models)
    };

    // Add pattern-specific components
    if (pattern === 'repository') {
      dataLayer.repositories = this._planRepositories(models);
    } else if (pattern === 'dao') {
      dataLayer.daos = this._planDAOs(models);
      dataLayer.caching = this._planCaching(features);
      dataLayer.transactions = this._planTransactions(features);
    }

    return dataLayer;
  }

  /**
   * Plan service layer
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Array<Object>>} Service specifications
   */
  async planServices(features) {
    const services = [];
    const serviceMap = this._mapFeaturesToServices(features);
    
    for (const [serviceName, serviceFeatures] of Object.entries(serviceMap)) {
      const service = {
        name: serviceName,
        responsibilities: this._getServiceResponsibilities(serviceName, serviceFeatures),
        methods: this._getServiceMethods(serviceName, serviceFeatures),
        dependencies: this._getServiceDependencies(serviceName, serviceFeatures),
        interfaces: this._getServiceInterfaces(serviceName)
      };
      
      services.push(service);
    }

    // Add fallback service if no specific services identified
    if (services.length === 0) {
      services.push({
        name: 'GenericService',
        responsibilities: ['generic business logic'],
        methods: ['process', 'validate'],
        dependencies: [],
        interfaces: ['IGenericService']
      });
    }

    return services;
  }

  /**
   * Plan middleware stack
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Array<Object>>} Middleware specifications
   */
  async planMiddleware(features) {
    const middleware = [];
    const middlewareOrder = [
      'cors', 'security', 'logging', 'compression', 'parsing', 
      'auth', 'validation', 'rate-limiting', 'error'
    ];

    for (const type of middlewareOrder) {
      if (this._needsMiddleware(type, features)) {
        const spec = this._createMiddlewareSpec(type, features);
        if (Array.isArray(spec)) {
          middleware.push(...spec);
        } else {
          middleware.push(spec);
        }
      }
    }

    // Add specific middleware for certain features
    if (features.some(f => f.includes('auth'))) {
      middleware.push({
        name: 'jwtMiddleware',
        purpose: 'JWT token verification',
        order: 6.1,
        config: { strategy: this.config.authStrategy }
      });
      middleware.push({
        name: 'authMiddleware',
        purpose: 'User authentication',
        order: 6.2,
        config: { required: false }
      });
    }

    if (features.some(f => f.includes('data-sanitization'))) {
      middleware.push({
        name: 'sanitizationMiddleware',
        purpose: 'Input sanitization',
        order: 7.1,
        config: { xss: true, sql: true }
      });
    }

    // Sort by order
    middleware.sort((a, b) => (a.order || 50) - (b.order || 50));

    return middleware;
  }

  /**
   * Plan security architecture
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Object>} Security plan
   */
  async planSecurity(features) {
    const security = {};

    // Authentication
    if (features.some(f => f.includes('auth'))) {
      security.authentication = {
        strategy: this.config.authStrategy,
        endpoints: this._planAuthEndpoints(features),
        tokenExpiry: '24h',
        refreshTokens: true
      };
    }

    // Authorization
    if (features.some(f => f.includes('role') || f.includes('admin'))) {
      security.authorization = {
        roles: ['admin', 'user'],
        permissions: this._planPermissions(features),
        rbac: true
      };
    }

    // Input validation and sanitization
    if (features.some(f => f.includes('validation') || f.includes('form'))) {
      security.validation = {
        inputValidation: true,
        schemaValidation: true,
        dataTypes: ['string', 'number', 'email', 'url']
      };
      
      security.sanitization = {
        htmlSanitization: true,
        sqlInjectionPrevention: true,
        xssProtection: true
      };
    }

    // Set SQL injection prevention default
    security.sqlInjectionPrevention = true;

    return security;
  }

  /**
   * Plan performance optimizations
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Object>} Performance plan
   */
  async planPerformance(features) {
    const performance = {};

    // Caching
    if (features.some(f => f.includes('caching') || f.includes('performance'))) {
      performance.caching = {
        strategy: 'redis',
        layers: ['application', 'database'],
        ttl: 3600,
        invalidation: 'time-based'
      };
    }

    // Database optimization
    if (features.some(f => f.includes('database') || f.includes('optimization'))) {
      performance.database = {
        indexing: {
          primary: true,
          foreign: true,
          composite: true
        },
        queryOptimization: {
          pagination: true,
          lazy: true,
          eager: false
        }
      };
    }

    // Rate limiting
    if (features.some(f => f.includes('rate') || f.includes('ddos'))) {
      performance.rateLimiting = {
        strategy: 'sliding-window',
        limits: {
          global: 1000,
          perUser: 100,
          perIP: 200
        },
        timeWindow: '15m'
      };
    }

    return performance;
  }

  /**
   * Identify database models from features
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Array<string>>} Model names
   */
  async identifyModels(features) {
    const models = new Set();
    
    const modelMappings = {
      'user': 'User',
      'todo': 'Todo',
      'task': 'Task',
      'post': 'Post',
      'comment': 'Comment',
      'category': 'Category',
      'product': 'Product',
      'order': 'Order',
      'payment': 'Payment',
      'article': 'Article',
      'blog': 'Blog'
    };

    for (const feature of features) {
      for (const [key, model] of Object.entries(modelMappings)) {
        if (feature.includes(key)) {
          models.add(model);
        }
      }
    }

    // Add common models for certain feature patterns
    if (features.some(f => f.includes('auth'))) {
      models.add('User');
    }
    
    if (features.some(f => f.includes('crud') && !models.size)) {
      models.add('Item');
    }

    return Array.from(models);
  }

  /**
   * Plan database schemas for models
   * 
   * @param {Array<string>} models - Model names
   * @returns {Promise<Object>} Database schemas
   */
  async planDatabaseSchemas(models) {
    const schemas = {};
    
    for (const model of models) {
      schemas[model] = this._generateModelSchema(model);
    }

    // Add relationships between models
    this._addModelRelationships(schemas, models);

    return schemas;
  }

  /**
   * Validate architecture completeness
   * 
   * @param {Object} architecture - Architecture to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateArchitecture(architecture) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check required components
    if (!architecture.apiDesign) {
      validation.isValid = false;
      validation.errors.push('API design not defined');
    }

    if (!architecture.dataLayer) {
      validation.isValid = false;
      validation.errors.push('Data layer not defined');
    }

    // Check for missing services
    if (!architecture.services || architecture.services.length === 0) {
      validation.warnings.push('No services defined - consider adding business logic services');
    }

    // Check for missing middleware
    if (!architecture.middleware || architecture.middleware.length === 0) {
      validation.warnings.push('No middleware defined - consider adding authentication and validation middleware');
    }

    // Suggestions
    if (architecture.apiDesign && architecture.apiDesign.endpoints && architecture.apiDesign.endpoints.length === 0) {
      validation.suggestions.push('Define API endpoints for better structure');
    }

    if (!architecture.security || !architecture.security.authentication) {
      validation.suggestions.push('Consider adding authentication for security');
    }

    return validation;
  }

  /**
   * Generate architecture documentation
   * 
   * @param {Object} architecture - Architecture to document
   * @returns {Promise<Object>} Architecture documentation
   */
  async generateDocumentation(architecture) {
    const documentation = {
      overview: this._generateOverview(architecture),
      apiDocumentation: this._generateApiDocs(architecture),
      dataLayerDocs: this._generateDataLayerDocs(architecture),
      serviceDocumentation: this._generateServiceDocs(architecture)
    };

    // Add service interactions if services exist
    if (architecture.services && architecture.services.length > 0) {
      documentation.serviceInteractions = this._generateServiceInteractions(architecture.services);
      documentation.dependencyGraph = this._generateDependencyGraph(architecture.services);
    }

    return documentation;
  }

  /**
   * Helper methods
   */

  _planRestEndpoints(features) {
    const endpoints = [];
    const models = ['User', 'Todo', 'Post', 'Comment']; // Common models
    
    // Add CRUD endpoints for detected models
    for (const feature of features) {
      if (feature.includes('crud') || feature.includes('management')) {
        const resourceName = this._extractResourceFromFeature(feature);
        if (resourceName) {
          endpoints.push(...this._createCrudEndpoints(resourceName));
        }
      }
    }

    // Add authentication endpoints
    if (features.some(f => f.includes('auth'))) {
      endpoints.push(...this._createAuthEndpoints());
    }

    return endpoints;
  }

  _planResourceRoutes(features) {
    const routes = {};
    
    for (const feature of features) {
      const resource = this._extractResourceFromFeature(feature);
      if (resource) {
        routes[resource] = {
          basePath: `/${resource.toLowerCase()}s`,
          controller: `${resource}Controller`,
          middleware: ['authMiddleware', 'validationMiddleware']
        };
      }
    }

    return routes;
  }

  _planAuthEndpoints(features) {
    if (!features.some(f => f.includes('auth'))) {
      return [];
    }

    return [
      { path: '/auth/login', method: 'POST', description: 'User login' },
      { path: '/auth/register', method: 'POST', description: 'User registration' },
      { path: '/auth/logout', method: 'POST', description: 'User logout' },
      { path: '/auth/refresh', method: 'POST', description: 'Refresh token' },
      { path: '/auth/verify', method: 'GET', description: 'Verify token' }
    ];
  }

  _planGraphQLSchema(features) {
    const types = [];
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      types.push(`type ${model} { id: ID!, createdAt: String!, updatedAt: String! }`);
    }

    return { types, scalars: ['Date', 'JSON'] };
  }

  _planGraphQLResolvers(features) {
    const resolvers = {};
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      resolvers[model] = {
        queries: [`get${model}`, `list${model}s`],
        mutations: [`create${model}`, `update${model}`, `delete${model}`]
      };
    }

    return resolvers;
  }

  _planGraphQLQueries(features) {
    const queries = [];
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      queries.push(`${model.toLowerCase()}: ${model}`);
      queries.push(`${model.toLowerCase()}s: [${model}]`);
    }

    return queries;
  }

  _planGraphQLMutations(features) {
    const mutations = [];
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      mutations.push(`create${model}(input: ${model}Input!): ${model}`);
      mutations.push(`update${model}(id: ID!, input: ${model}Input!): ${model}`);
      mutations.push(`delete${model}(id: ID!): Boolean`);
    }

    return mutations;
  }

  _defineLayers(features) {
    return {
      controller: {
        purpose: 'Handle HTTP requests and responses',
        components: this._getControllerComponents(features)
      },
      service: {
        purpose: 'Business logic and operations',
        components: this._getServiceComponents(features)
      },
      repository: {
        purpose: 'Data access and persistence',
        components: this._getRepositoryComponents(features)
      },
      model: {
        purpose: 'Data models and entities',
        components: this._getModelComponents(features)
      }
    };
  }

  _planMicroservices(features) {
    const services = [];
    const serviceGroups = this._groupFeaturesIntoServices(features);
    
    for (const [serviceName, serviceFeatures] of Object.entries(serviceGroups)) {
      services.push({
        name: serviceName,
        features: serviceFeatures,
        api: this._planServiceApi(serviceFeatures),
        database: this._planServiceDatabase(serviceFeatures),
        responsibilities: this._getServiceResponsibilities(serviceName, serviceFeatures)
      });
    }

    return services;
  }

  _planServiceCommunication() {
    return {
      synchronous: {
        protocol: 'HTTP',
        format: 'JSON',
        loadBalancing: true
      },
      asynchronous: {
        messageQueue: 'RabbitMQ',
        eventBus: 'EventEmitter',
        pubSub: true
      }
    };
  }

  _planDataConsistency() {
    return {
      pattern: 'eventual-consistency',
      transactions: 'saga-pattern',
      compensation: true,
      eventSourcing: false
    };
  }

  _planDatabaseConnections(technologies) {
    const connections = {
      primary: {
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        pool: true
      }
    };

    if (technologies.includes('postgresql')) {
      connections.primary.type = 'postgresql';
      connections.primary.port = 5432;
    } else if (technologies.includes('mysql')) {
      connections.primary.type = 'mysql';
      connections.primary.port = 3306;
    } else if (technologies.includes('redis')) {
      connections.cache = {
        type: 'redis',
        host: 'localhost',
        port: 6379
      };
    }

    return connections;
  }

  _planRepositories(models) {
    const repositories = {};
    
    for (const model of models) {
      repositories[`${model}Repository`] = {
        model,
        methods: ['findById', 'findAll', 'create', 'update', 'delete'],
        queries: this._getModelQueries(model)
      };
    }

    return repositories;
  }

  _planDAOs(models) {
    const daos = {};
    
    for (const model of models) {
      daos[`${model}DAO`] = {
        model,
        methods: ['save', 'load', 'delete', 'query'],
        caching: true,
        transactions: true
      };
    }

    return daos;
  }

  _planCaching(features) {
    return {
      strategy: this.config.cachingStrategy,
      ttl: 3600,
      keys: this._getCacheKeys(features),
      invalidation: 'time-based'
    };
  }

  _planTransactions(features) {
    return {
      isolation: 'READ_COMMITTED',
      atomicity: true,
      consistency: true,
      durability: true
    };
  }

  _mapFeaturesToServices(features) {
    const serviceMap = {};
    
    for (const feature of features) {
      let serviceName = 'GenericService';
      
      if (feature.includes('user')) serviceName = 'UserService';
      else if (feature.includes('auth')) serviceName = 'AuthService';
      else if (feature.includes('email')) serviceName = 'EmailService';
      else if (feature.includes('payment')) serviceName = 'PaymentService';
      else if (feature.includes('todo')) serviceName = 'TodoService';
      else if (feature.includes('post')) serviceName = 'PostService';
      
      if (!serviceMap[serviceName]) {
        serviceMap[serviceName] = [];
      }
      serviceMap[serviceName].push(feature);
    }

    return serviceMap;
  }

  _getServiceResponsibilities(serviceName, features) {
    const responsibilities = [];
    const serviceType = serviceName.replace('Service', '').toLowerCase();
    
    if (serviceType === 'user') {
      responsibilities.push('user creation', 'user validation', 'user management');
    } else if (serviceType === 'auth') {
      responsibilities.push('authentication', 'authorization', 'token management');
    } else if (serviceType === 'email') {
      responsibilities.push('email sending', 'template rendering', 'delivery tracking');
    } else if (serviceType === 'payment') {
      responsibilities.push('payment processing', 'transaction management', 'billing');
    } else {
      responsibilities.push('business logic', 'data processing');
    }

    return responsibilities;
  }

  _getServiceMethods(serviceName, features) {
    const methods = [];
    const serviceType = serviceName.replace('Service', '').toLowerCase();
    
    if (serviceType === 'user') {
      methods.push('createUser', 'updateUser', 'deleteUser', 'findUser', 'validateUser');
    } else if (serviceType === 'auth') {
      methods.push('login', 'logout', 'register', 'verifyToken', 'refreshToken');
    } else if (serviceType === 'email') {
      methods.push('sendEmail', 'sendWelcomeEmail', 'sendNotification');
    } else if (serviceType === 'payment') {
      methods.push('processPayment', 'refundPayment', 'validateCard');
    } else {
      methods.push('process', 'validate', 'transform');
    }

    return methods;
  }

  _getServiceDependencies(serviceName, features) {
    const dependencies = [];
    const serviceType = serviceName.replace('Service', '').toLowerCase();
    
    // All services depend on their repository
    dependencies.push(`${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}Repository`);
    
    if (serviceType === 'user') {
      dependencies.push('EmailService');
    } else if (serviceType === 'auth') {
      dependencies.push('UserService');
    } else if (serviceType === 'payment') {
      dependencies.push('UserService', 'EmailService');
    }

    return dependencies;
  }

  _getServiceInterfaces(serviceName) {
    return [`I${serviceName}`];
  }

  _needsMiddleware(type, features) {
    const middlewareNeeds = {
      cors: true, // Always needed for web APIs
      security: true, // Always needed for security
      logging: true, // Always needed for debugging
      compression: features.some(f => f.includes('performance')),
      parsing: true, // Always needed for JSON/form parsing
      auth: features.some(f => f.includes('auth')),
      validation: features.some(f => f.includes('validation') || f.includes('form')),
      'rate-limiting': features.some(f => f.includes('rate') || f.includes('ddos')),
      error: true // Always needed for error handling
    };

    return middlewareNeeds[type] || false;
  }

  _createMiddlewareSpec(type, features) {
    const specs = {
      cors: {
        name: 'corsMiddleware',
        purpose: 'Handle CORS headers',
        order: 1,
        config: { origin: '*', credentials: true }
      },
      security: {
        name: 'securityMiddleware',
        purpose: 'Security headers and protection',
        order: 2,
        config: { helmet: true, xss: true }
      },
      logging: {
        name: 'loggingMiddleware',
        purpose: 'Request/response logging',
        order: 3,
        config: { format: 'combined' }
      },
      compression: {
        name: 'compressionMiddleware',
        purpose: 'Response compression',
        order: 4,
        config: { level: 6 }
      },
      parsing: {
        name: 'parsingMiddleware',
        purpose: 'Parse request body',
        order: 5,
        config: { json: true, urlencoded: true }
      },
      auth: {
        name: 'authMiddleware',
        purpose: 'Authentication verification',
        order: 6,
        config: { strategy: this.config.authStrategy }
      },
      validation: {
        name: 'validationMiddleware',
        purpose: 'Input validation and sanitization',
        order: 7,
        config: { schemas: true, sanitize: true }
      },
      'rate-limiting': {
        name: 'rateLimitMiddleware',
        purpose: 'Rate limiting and DDoS protection',
        order: 8,
        config: { windowMs: 900000, max: 100 }
      },
      error: {
        name: 'errorMiddleware',
        purpose: 'Error handling and responses',
        order: 999,
        config: { stackTrace: false }
      }
    };

    return specs[type] || {
      name: `${type}Middleware`,
      purpose: `${type} functionality`,
      order: 50
    };
  }

  _planPermissions(features) {
    const permissions = [];
    
    if (features.some(f => f.includes('admin'))) {
      permissions.push('admin:read', 'admin:write', 'admin:delete');
    }
    
    if (features.some(f => f.includes('user'))) {
      permissions.push('user:read', 'user:write');
    }
    
    if (features.some(f => f.includes('crud'))) {
      permissions.push('resource:create', 'resource:read', 'resource:update', 'resource:delete');
    }

    return permissions;
  }

  _extractResourceFromFeature(feature) {
    const patterns = {
      'user-management': 'User',
      'user-crud': 'User',
      'todo-management': 'Todo',
      'todo-crud': 'Todo',
      'post-management': 'Post',
      'post-crud': 'Post',
      'comment-management': 'Comment',
      'comment-crud': 'Comment'
    };

    return patterns[feature] || null;
  }

  _createCrudEndpoints(resource) {
    const resourceLower = resource.toLowerCase();
    const resourcePlural = `${resourceLower}s`;
    
    return [
      { path: `/${resourcePlural}`, method: 'GET', description: `Get all ${resourcePlural}`, resource: resourcePlural },
      { path: `/${resourcePlural}/:id`, method: 'GET', description: `Get ${resourceLower} by ID`, resource: resourcePlural },
      { path: `/${resourcePlural}`, method: 'POST', description: `Create new ${resourceLower}`, resource: resourcePlural },
      { path: `/${resourcePlural}/:id`, method: 'PUT', description: `Update ${resourceLower}`, resource: resourcePlural },
      { path: `/${resourcePlural}/:id`, method: 'DELETE', description: `Delete ${resourceLower}`, resource: resourcePlural }
    ];
  }

  _createAuthEndpoints() {
    return [
      { path: '/auth/login', method: 'POST', description: 'User login', resource: 'auth' },
      { path: '/auth/register', method: 'POST', description: 'User registration', resource: 'auth' },
      { path: '/auth/logout', method: 'POST', description: 'User logout', resource: 'auth' },
      { path: '/auth/refresh', method: 'POST', description: 'Refresh token', resource: 'auth' },
      { path: '/auth/verify', method: 'GET', description: 'Verify token', resource: 'auth' }
    ];
  }

  _extractModelsFromFeatures(features) {
    const models = new Set();
    
    for (const feature of features) {
      if (feature.includes('user')) models.add('User');
      if (feature.includes('todo')) models.add('Todo');
      if (feature.includes('post')) models.add('Post');
      if (feature.includes('comment')) models.add('Comment');
    }

    return Array.from(models);
  }

  _generateModelSchema(model) {
    const schemas = {
      User: {
        fields: {
          id: { type: 'string', primary: true },
          email: { type: 'string', required: true, unique: true },
          password: { type: 'string', required: true },
          name: { type: 'string', required: true },
          createdAt: { type: 'date', default: 'now' },
          updatedAt: { type: 'date', default: 'now' }
        },
        relationships: {}
      },
      Todo: {
        fields: {
          id: { type: 'string', primary: true },
          title: { type: 'string', required: true },
          description: { type: 'string' },
          completed: { type: 'boolean', default: false },
          userId: { type: 'string', required: true },
          createdAt: { type: 'date', default: 'now' },
          updatedAt: { type: 'date', default: 'now' }
        },
        relationships: {}
      },
      Post: {
        fields: {
          id: { type: 'string', primary: true },
          title: { type: 'string', required: true },
          content: { type: 'text', required: true },
          authorId: { type: 'string', required: true },
          published: { type: 'boolean', default: false },
          createdAt: { type: 'date', default: 'now' },
          updatedAt: { type: 'date', default: 'now' }
        },
        relationships: {}
      },
      Comment: {
        fields: {
          id: { type: 'string', primary: true },
          content: { type: 'text', required: true },
          authorId: { type: 'string', required: true },
          postId: { type: 'string', required: true },
          createdAt: { type: 'date', default: 'now' },
          updatedAt: { type: 'date', default: 'now' }
        },
        relationships: {}
      }
    };

    return schemas[model] || {
      fields: {
        id: { type: 'string', primary: true },
        name: { type: 'string', required: true },
        createdAt: { type: 'date', default: 'now' },
        updatedAt: { type: 'date', default: 'now' }
      },
      relationships: {}
    };
  }

  _addModelRelationships(schemas, models) {
    // User -> Todo relationship
    if (schemas.User && schemas.Todo) {
      schemas.User.relationships.todos = { type: 'hasMany', model: 'Todo', foreignKey: 'userId' };
      schemas.Todo.relationships.user = { type: 'belongsTo', model: 'User', foreignKey: 'userId' };
    }

    // User -> Post relationship
    if (schemas.User && schemas.Post) {
      schemas.User.relationships.posts = { type: 'hasMany', model: 'Post', foreignKey: 'authorId' };
      schemas.Post.relationships.author = { type: 'belongsTo', model: 'User', foreignKey: 'authorId' };
    }

    // Post -> Comment relationship
    if (schemas.Post && schemas.Comment) {
      schemas.Post.relationships.comments = { type: 'hasMany', model: 'Comment', foreignKey: 'postId' };
      schemas.Comment.relationships.post = { type: 'belongsTo', model: 'Post', foreignKey: 'postId' };
    }

    // User -> Comment relationship
    if (schemas.User && schemas.Comment) {
      schemas.User.relationships.comments = { type: 'hasMany', model: 'Comment', foreignKey: 'authorId' };
      schemas.Comment.relationships.author = { type: 'belongsTo', model: 'User', foreignKey: 'authorId' };
    }
  }

  _getControllerComponents(features) {
    const controllers = [];
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      controllers.push(`${model}Controller`);
    }
    
    if (features.some(f => f.includes('auth'))) {
      controllers.push('AuthController');
    }

    return controllers;
  }

  _getServiceComponents(features) {
    const services = [];
    const serviceMap = this._mapFeaturesToServices(features);
    
    return Object.keys(serviceMap);
  }

  _getRepositoryComponents(features) {
    const repositories = [];
    const models = this._extractModelsFromFeatures(features);
    
    for (const model of models) {
      repositories.push(`${model}Repository`);
    }

    return repositories;
  }

  _getModelComponents(features) {
    return this._extractModelsFromFeatures(features);
  }

  _groupFeaturesIntoServices(features) {
    const groups = {};
    
    for (const feature of features) {
      let serviceName = 'CoreService';
      
      if (feature.includes('user') || feature.includes('auth')) {
        serviceName = 'UserService';
      } else if (feature.includes('todo') || feature.includes('task')) {
        serviceName = 'TodoService';
      } else if (feature.includes('post') || feature.includes('blog')) {
        serviceName = 'ContentService';
      } else if (feature.includes('payment') || feature.includes('billing')) {
        serviceName = 'PaymentService';
      } else if (feature.includes('messaging')) {
        serviceName = 'MessagingService';
      } else if (feature.includes('logging')) {
        serviceName = 'LoggingService';
      } else if (feature.includes('caching')) {
        serviceName = 'CacheService';
      }
      
      if (!groups[serviceName]) {
        groups[serviceName] = [];
      }
      groups[serviceName].push(feature);
    }

    // Ensure we have at least 3 services for microservices architecture
    if (Object.keys(groups).length < 3) {
      groups['ConfigService'] = ['configuration'];
      groups['MonitoringService'] = ['monitoring'];
    }

    return groups;
  }

  _planServiceApi(features) {
    return {
      endpoints: this._planRestEndpoints(features),
      baseUrl: '/api/v1',
      version: 'v1'
    };
  }

  _planServiceDatabase(features) {
    const models = this._extractModelsFromFeatures(features);
    return {
      models,
      type: 'mongodb',
      isolation: true
    };
  }

  _getModelQueries(model) {
    const queries = [`findBy${model}Id`, `findBy${model}Email`];
    
    if (model === 'User') {
      queries.push('findByEmail', 'findByUsername');
    } else if (model === 'Todo') {
      queries.push('findByUserId', 'findByCompleted');
    } else if (model === 'Post') {
      queries.push('findByAuthorId', 'findByPublished');
    }

    return queries;
  }

  _getCacheKeys(features) {
    const keys = [];
    
    if (features.some(f => f.includes('user'))) {
      keys.push('user:*', 'users:list');
    }
    
    if (features.some(f => f.includes('todo'))) {
      keys.push('todo:*', 'todos:user:*');
    }

    return keys;
  }

  _generateOverview(architecture) {
    const pattern = architecture.pattern || 'layered';
    const apiStyle = architecture.apiDesign?.style || 'REST';
    const dataPattern = architecture.dataLayer?.pattern || 'repository';
    
    return `Backend Architecture Overview:
- Pattern: ${pattern}
- API Style: ${apiStyle}
- Data Layer: ${dataPattern}
- Services: ${architecture.services?.length || 0}
- Middleware: ${architecture.middleware?.length || 0}`;
  }

  _generateApiDocs(architecture) {
    if (!architecture.apiDesign?.endpoints) return 'No API endpoints defined';
    
    return architecture.apiDesign.endpoints
      .map(endpoint => `${endpoint.method} ${endpoint.path} - ${endpoint.description}`)
      .join('\n');
  }

  _generateDataLayerDocs(architecture) {
    const dataLayer = architecture.dataLayer;
    if (!dataLayer) return 'No data layer defined';
    
    return `Data Layer:
- Pattern: ${dataLayer.pattern}
- Models: ${dataLayer.models?.join(', ') || 'None'}
- Connection: ${dataLayer.connections?.primary?.type || 'Unknown'}`;
  }

  _generateServiceDocs(architecture) {
    if (!architecture.services || architecture.services.length === 0) {
      return 'No services defined';
    }
    
    return architecture.services
      .map(service => `${service.name}: ${service.responsibilities?.join(', ') || 'No responsibilities defined'}`)
      .join('\n');
  }

  _generateServiceInteractions(services) {
    const interactions = [];
    
    for (const service of services) {
      if (service.dependencies && service.dependencies.length > 0) {
        for (const dep of service.dependencies) {
          interactions.push(`${service.name} -> ${dep}`);
        }
      }
    }
    
    return interactions.join('\n');
  }

  _generateDependencyGraph(services) {
    const graph = {};
    
    for (const service of services) {
      graph[service.name] = service.dependencies || [];
    }
    
    return graph;
  }
}

export { BackendArchitecturePlanner };