/**
 * BackendArchitecturePlannerConfig - Configuration for backend architecture planning
 * 
 * Defines the allowable actions and constraints for creating comprehensive backend
 * architectures including API design, data layer, services, and middleware.
 */

export const BackendArchitecturePlannerConfig = {
  name: 'BackendArchitecturePlanner',
  description: 'Plans backend architecture and service design for scalable server applications',
  
  allowableActions: [
    {
      type: 'analyze_architecture_pattern',
      description: 'Analyze and determine the optimal architecture pattern',
      inputs: ['complexity_level', 'feature_requirements'],
      outputs: ['architecture_pattern'],
      parameters: {
        pattern: {
          type: 'string',
          enum: ['monolithic', 'layered', 'microservices'],
          description: 'Recommended architecture pattern'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning behind the pattern selection'
        }
      }
    },
    {
      type: 'design_api',
      description: 'Design API structure and endpoints',
      inputs: ['feature_requirements', 'api_style'],
      outputs: ['api_design'],
      parameters: {
        style: {
          type: 'string',
          enum: ['REST', 'GraphQL', 'RPC'],
          description: 'API design style'
        },
        endpoints: {
          type: 'array',
          description: 'List of API endpoints'
        },
        versioning: {
          type: 'object',
          description: 'API versioning strategy'
        }
      }
    },
    {
      type: 'plan_data_layer',
      description: 'Plan data layer architecture and patterns',
      inputs: ['data_requirements', 'architecture_pattern'],
      outputs: ['data_layer_design'],
      parameters: {
        pattern: {
          type: 'string',
          enum: ['active-record', 'repository', 'dao', 'data-mapper'],
          description: 'Data access pattern'
        },
        models: {
          type: 'array',
          description: 'List of data models'
        },
        relationships: {
          type: 'object',
          description: 'Model relationships'
        },
        storage: {
          type: 'string',
          enum: ['mongodb', 'mysql', 'postgresql', 'redis', 'file-based'],
          description: 'Storage technology'
        }
      }
    },
    {
      type: 'create_service',
      description: 'Create a service specification',
      inputs: ['service_requirements', 'data_layer'],
      outputs: ['service_specification'],
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the service'
        },
        type: {
          type: 'string',
          enum: ['business', 'data', 'integration', 'utility'],
          description: 'Type of service'
        },
        responsibilities: {
          type: 'array',
          description: 'Service responsibilities'
        },
        dependencies: {
          type: 'array',
          description: 'Service dependencies'
        }
      }
    },
    {
      type: 'add_middleware',
      description: 'Add middleware to the architecture',
      inputs: ['middleware_requirements', 'security_requirements'],
      outputs: ['middleware_specification'],
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the middleware'
        },
        type: {
          type: 'string',
          enum: ['authentication', 'authorization', 'validation', 'logging', 'rate-limiting', 'cors'],
          description: 'Type of middleware'
        },
        order: {
          type: 'number',
          description: 'Execution order of middleware'
        },
        configuration: {
          type: 'object',
          description: 'Middleware configuration'
        }
      }
    },
    {
      type: 'configure_security',
      description: 'Configure security measures and authentication',
      inputs: ['security_requirements', 'authentication_method'],
      outputs: ['security_configuration'],
      parameters: {
        authentication: {
          type: 'object',
          description: 'Authentication configuration'
        },
        authorization: {
          type: 'object',
          description: 'Authorization configuration'
        },
        encryption: {
          type: 'object',
          description: 'Encryption settings'
        },
        rateLimiting: {
          type: 'object',
          description: 'Rate limiting configuration'
        }
      }
    },
    {
      type: 'optimize_performance',
      description: 'Plan performance optimization strategies',
      inputs: ['performance_requirements', 'architecture_pattern'],
      outputs: ['performance_plan'],
      parameters: {
        caching: {
          type: 'object',
          description: 'Caching strategy'
        },
        database: {
          type: 'object',
          description: 'Database optimization'
        },
        scaling: {
          type: 'object',
          description: 'Scaling strategy'
        }
      }
    },
    {
      type: 'plan_error_handling',
      description: 'Plan error handling and monitoring',
      inputs: ['error_requirements', 'monitoring_requirements'],
      outputs: ['error_handling_plan'],
      parameters: {
        errorHandling: {
          type: 'object',
          description: 'Error handling strategy'
        },
        logging: {
          type: 'object',
          description: 'Logging configuration'
        },
        monitoring: {
          type: 'object',
          description: 'Monitoring and alerting'
        }
      }
    },
    {
      type: 'configure_deployment',
      description: 'Configure deployment and infrastructure',
      inputs: ['deployment_requirements', 'infrastructure_requirements'],
      outputs: ['deployment_configuration'],
      parameters: {
        strategy: {
          type: 'string',
          enum: ['single-server', 'load-balanced', 'containerized', 'serverless'],
          description: 'Deployment strategy'
        },
        infrastructure: {
          type: 'object',
          description: 'Infrastructure configuration'
        },
        environment: {
          type: 'object',
          description: 'Environment configuration'
        }
      }
    },
    {
      type: 'validate_architecture',
      description: 'Validate the backend architecture for consistency and scalability',
      inputs: ['architecture_specification'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the architecture is valid'
        },
        errors: {
          type: 'array',
          description: 'List of validation errors'
        },
        warnings: {
          type: 'array',
          description: 'List of warnings'
        },
        suggestions: {
          type: 'array',
          description: 'List of improvement suggestions'
        }
      }
    }
  ],
  
  constraints: [
    'Architecture pattern must match project complexity and requirements',
    'API design must be consistent and follow REST or GraphQL standards',
    'Data layer must provide appropriate abstraction and encapsulation',
    'Services must have clear responsibilities and minimal coupling',
    'Middleware must be ordered correctly for proper execution',
    'Security must be implemented at multiple layers',
    'Performance optimizations must not compromise maintainability',
    'Error handling must be comprehensive and consistent',
    'Deployment strategy must match infrastructure requirements',
    'All components must be properly documented and tested'
  ],
  
  architecturePatterns: {
    monolithic: {
      description: 'Single deployable unit with all components',
      complexity: 'low',
      scalability: 'limited',
      maintenance: 'simple',
      suitability: ['small teams', 'simple applications', 'rapid prototyping']
    },
    layered: {
      description: 'Organized into logical layers (presentation, business, data)',
      complexity: 'medium',
      scalability: 'moderate',
      maintenance: 'moderate',
      suitability: ['medium applications', 'clear separation of concerns', 'traditional enterprise']
    },
    microservices: {
      description: 'Decomposed into independent, loosely coupled services',
      complexity: 'high',
      scalability: 'high',
      maintenance: 'complex',
      suitability: ['large teams', 'complex domains', 'independent scaling']
    }
  },
  
  examples: [
    {
      input: {
        projectType: 'backend',
        complexity: 'medium',
        features: ['api', 'crud', 'authentication'],
        technologies: ['nodejs', 'express']
      },
      expectedOutput: {
        pattern: 'layered',
        apiDesign: {
          style: 'REST',
          endpoints: [
            { path: '/api/auth/login', method: 'POST' },
            { path: '/api/users', method: 'GET' },
            { path: '/api/users/:id', method: 'GET' }
          ]
        },
        dataLayer: {
          pattern: 'repository',
          models: ['User'],
          storage: 'mongodb'
        },
        services: [
          { name: 'UserService', type: 'business' },
          { name: 'AuthService', type: 'business' }
        ],
        middleware: [
          { name: 'cors', type: 'cors', order: 1 },
          { name: 'auth', type: 'authentication', order: 2 }
        ],
        security: {
          authentication: { method: 'jwt' },
          authorization: { enabled: true }
        }
      }
    }
  ],
  
  mockResponses: {
    'simple-backend': {
      pattern: 'monolithic',
      apiDesign: {
        style: 'REST',
        endpoints: [
          { path: '/api/health', method: 'GET' },
          { path: '/api/data', method: 'GET' }
        ],
        versioning: { strategy: 'none' }
      },
      dataLayer: {
        pattern: 'active-record',
        models: ['Data'],
        relationships: {},
        storage: 'file-based'
      },
      services: [
        { name: 'DataService', type: 'business', responsibilities: ['data management'] }
      ],
      middleware: [
        { name: 'cors', type: 'cors', order: 1 },
        { name: 'logging', type: 'logging', order: 2 }
      ],
      security: {
        authentication: { enabled: false },
        authorization: { enabled: false }
      },
      performance: {
        caching: { enabled: false },
        database: { indexing: 'basic' }
      },
      metadata: {
        planner: 'BackendArchitecturePlanner',
        plannedAt: 1234567890,
        complexity: 'low',
        mockScenario: 'simple-backend'
      }
    },
    'layered-backend': {
      pattern: 'layered',
      apiDesign: {
        style: 'REST',
        endpoints: [
          { path: '/api/v1/auth/login', method: 'POST' },
          { path: '/api/v1/auth/logout', method: 'POST' },
          { path: '/api/v1/users', method: 'GET' },
          { path: '/api/v1/users/:id', method: 'GET' },
          { path: '/api/v1/users', method: 'POST' },
          { path: '/api/v1/users/:id', method: 'PUT' },
          { path: '/api/v1/users/:id', method: 'DELETE' }
        ],
        versioning: { strategy: 'url', version: 'v1' }
      },
      dataLayer: {
        pattern: 'repository',
        models: ['User', 'Session'],
        relationships: {
          'User': { sessions: { type: 'hasMany', model: 'Session' } },
          'Session': { user: { type: 'belongsTo', model: 'User' } }
        },
        storage: 'mongodb'
      },
      services: [
        { name: 'UserService', type: 'business', responsibilities: ['user management', 'validation'] },
        { name: 'AuthService', type: 'business', responsibilities: ['authentication', 'authorization'] },
        { name: 'SessionService', type: 'business', responsibilities: ['session management'] }
      ],
      middleware: [
        { name: 'cors', type: 'cors', order: 1 },
        { name: 'helmet', type: 'security', order: 2 },
        { name: 'rateLimit', type: 'rate-limiting', order: 3 },
        { name: 'auth', type: 'authentication', order: 4 },
        { name: 'validation', type: 'validation', order: 5 },
        { name: 'logging', type: 'logging', order: 6 }
      ],
      security: {
        authentication: {
          method: 'jwt',
          secret: 'env.JWT_SECRET',
          expiresIn: '24h'
        },
        authorization: {
          enabled: true,
          roles: ['user', 'admin'],
          permissions: ['read', 'write', 'delete']
        },
        encryption: {
          passwords: 'bcrypt',
          data: 'aes-256-gcm'
        },
        rateLimiting: {
          windowMs: 900000,
          max: 100
        }
      },
      performance: {
        caching: {
          enabled: true,
          strategy: 'redis',
          ttl: 3600
        },
        database: {
          indexing: 'optimized',
          connectionPooling: true
        },
        scaling: {
          horizontal: 'load-balancer',
          vertical: 'auto-scaling'
        }
      },
      metadata: {
        planner: 'BackendArchitecturePlanner',
        plannedAt: 1234567890,
        complexity: 'medium',
        mockScenario: 'layered-backend'
      }
    },
    'microservices-backend': {
      pattern: 'microservices',
      apiDesign: {
        style: 'REST',
        endpoints: [
          { path: '/api/auth/v1/login', method: 'POST', service: 'auth-service' },
          { path: '/api/users/v1/users', method: 'GET', service: 'user-service' },
          { path: '/api/orders/v1/orders', method: 'GET', service: 'order-service' }
        ],
        versioning: { strategy: 'url', version: 'v1' }
      },
      dataLayer: {
        pattern: 'dao',
        models: ['User', 'Order', 'Session'],
        relationships: {
          'User': { orders: { type: 'hasMany', model: 'Order' } },
          'Order': { user: { type: 'belongsTo', model: 'User' } }
        },
        storage: 'postgresql'
      },
      services: [
        { name: 'AuthService', type: 'business', responsibilities: ['authentication', 'authorization'] },
        { name: 'UserService', type: 'business', responsibilities: ['user management'] },
        { name: 'OrderService', type: 'business', responsibilities: ['order processing'] },
        { name: 'NotificationService', type: 'integration', responsibilities: ['notifications'] },
        { name: 'ApiGateway', type: 'integration', responsibilities: ['request routing', 'load balancing'] }
      ],
      middleware: [
        { name: 'cors', type: 'cors', order: 1 },
        { name: 'helmet', type: 'security', order: 2 },
        { name: 'rateLimit', type: 'rate-limiting', order: 3 },
        { name: 'auth', type: 'authentication', order: 4 },
        { name: 'validation', type: 'validation', order: 5 },
        { name: 'logging', type: 'logging', order: 6 }
      ],
      security: {
        authentication: {
          method: 'jwt',
          secret: 'env.JWT_SECRET',
          expiresIn: '1h'
        },
        authorization: {
          enabled: true,
          roles: ['user', 'admin', 'service'],
          permissions: ['read', 'write', 'delete', 'admin']
        },
        encryption: {
          passwords: 'bcrypt',
          data: 'aes-256-gcm',
          communication: 'tls'
        },
        rateLimiting: {
          windowMs: 900000,
          max: 1000
        }
      },
      performance: {
        caching: {
          enabled: true,
          strategy: 'redis-cluster',
          ttl: 1800
        },
        database: {
          indexing: 'advanced',
          connectionPooling: true,
          readReplicas: true
        },
        scaling: {
          horizontal: 'kubernetes',
          vertical: 'auto-scaling',
          loadBalancing: 'nginx'
        }
      },
      communication: {
        synchronous: 'rest-api',
        asynchronous: 'message-queue',
        eventBus: 'rabbitmq'
      },
      dataConsistency: {
        strategy: 'eventual-consistency',
        patterns: ['saga', 'event-sourcing']
      },
      metadata: {
        planner: 'BackendArchitecturePlanner',
        plannedAt: 1234567890,
        complexity: 'high',
        mockScenario: 'microservices-backend'
      }
    }
  }
};