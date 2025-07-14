/**
 * Tests for BackendArchitecturePlanner class
 * 
 * BackendArchitecturePlanner is responsible for planning backend architecture
 * including API design, data layer, middleware, and service organization.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BackendArchitecturePlanner } from '../../../src/planning/BackendArchitecturePlanner.js';

describe('BackendArchitecturePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new BackendArchitecturePlanner();
  });

  describe('Constructor', () => {
    test('should create BackendArchitecturePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.apiStyle).toBe('REST');
      expect(planner.config.dataLayer).toBe('repository');
    });

    test('should accept custom configuration', () => {
      const customPlanner = new BackendArchitecturePlanner({
        apiStyle: 'GraphQL',
        dataLayer: 'active-record',
        enableMiddleware: true,
        authStrategy: 'JWT'
      });

      expect(customPlanner.config.apiStyle).toBe('GraphQL');
      expect(customPlanner.config.dataLayer).toBe('active-record');
      expect(customPlanner.config.enableMiddleware).toBe(true);
      expect(customPlanner.config.authStrategy).toBe('JWT');
    });
  });

  describe('Architecture Planning', () => {
    test('should plan simple backend architecture', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            features: ['api', 'crud'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.apiDesign).toBeDefined();
      expect(architecture.dataLayer).toBeDefined();
      expect(architecture.middleware).toBeDefined();
      expect(architecture.services).toBeDefined();
    });

    test('should plan layered architecture for medium complexity', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'auth', 'database', 'validation'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.layers).toBeDefined();
      expect(architecture.layers.controller).toBeDefined();
      expect(architecture.layers.service).toBeDefined();
      expect(architecture.layers.repository).toBeDefined();
      expect(architecture.layers.model).toBeDefined();
    });

    test('should plan microservices architecture for high complexity', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'auth', 'database', 'caching', 'messaging', 'logging'],
            technologies: ['nodejs', 'express', 'mongodb', 'redis']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.pattern).toBe('microservices');
      expect(architecture.services.length).toBeGreaterThan(2);
      expect(architecture.communication).toBeDefined();
      expect(architecture.dataConsistency).toBeDefined();
    });
  });

  describe('API Design Planning', () => {
    test('should plan REST API structure', async () => {
      const features = ['user-management', 'todo-management', 'auth'];
      
      const apiDesign = await planner.planApiDesign(features, 'REST');

      expect(apiDesign.style).toBe('REST');
      expect(apiDesign.endpoints).toBeDefined();
      expect(apiDesign.endpoints.length).toBeGreaterThan(0);
      expect(apiDesign.resourceRoutes).toBeDefined();
      expect(apiDesign.authentication).toBeDefined();
    });

    test('should plan GraphQL API structure', async () => {
      const features = ['user-management', 'todo-management'];
      
      const apiDesign = await planner.planApiDesign(features, 'GraphQL');

      expect(apiDesign.style).toBe('GraphQL');
      expect(apiDesign.schema).toBeDefined();
      expect(apiDesign.resolvers).toBeDefined();
      expect(apiDesign.mutations).toBeDefined();
      expect(apiDesign.queries).toBeDefined();
    });

    test('should identify resource endpoints for CRUD operations', async () => {
      const features = ['user-crud', 'post-crud', 'comment-crud'];
      
      const apiDesign = await planner.planApiDesign(features, 'REST');

      const userEndpoints = apiDesign.endpoints.filter(e => e.resource === 'users');
      expect(userEndpoints.length).toBeGreaterThanOrEqual(4); // GET, POST, PUT, DELETE
      
      const postEndpoints = apiDesign.endpoints.filter(e => e.resource === 'posts');
      expect(postEndpoints.length).toBeGreaterThanOrEqual(4);
    });

    test('should plan authentication endpoints', async () => {
      const features = ['auth', 'login', 'register'];
      
      const apiDesign = await planner.planApiDesign(features, 'REST');

      const authEndpoints = apiDesign.endpoints.filter(e => e.resource === 'auth');
      expect(authEndpoints.some(e => e.path.includes('login'))).toBe(true);
      expect(authEndpoints.some(e => e.path.includes('register'))).toBe(true);
      expect(authEndpoints.some(e => e.path.includes('logout'))).toBe(true);
    });
  });

  describe('Data Layer Planning', () => {
    test('should plan repository pattern for medium complexity', async () => {
      const analysis = {
        complexity: 'medium',
        components: {
          backend: {
            features: ['crud', 'database'],
            technologies: ['nodejs', 'mongodb']
          }
        }
      };

      const dataLayer = await planner.planDataLayer(analysis);

      expect(dataLayer.pattern).toBe('repository');
      expect(dataLayer.models).toBeDefined();
      expect(dataLayer.repositories).toBeDefined();
      expect(dataLayer.connections).toBeDefined();
    });

    test('should plan active record pattern for simple projects', async () => {
      const analysis = {
        complexity: 'low',
        components: {
          backend: {
            features: ['crud'],
            technologies: ['nodejs', 'sqlite']
          }
        }
      };

      const dataLayer = await planner.planDataLayer(analysis);

      expect(dataLayer.pattern).toBe('active-record');
      expect(dataLayer.models).toBeDefined();
      expect(dataLayer.connections).toBeDefined();
    });

    test('should plan data access objects for high complexity', async () => {
      const analysis = {
        complexity: 'high',
        components: {
          backend: {
            features: ['crud', 'caching', 'transactions'],
            technologies: ['nodejs', 'postgresql', 'redis']
          }
        }
      };

      const dataLayer = await planner.planDataLayer(analysis);

      expect(dataLayer.pattern).toBe('dao');
      expect(dataLayer.daos).toBeDefined();
      expect(dataLayer.caching).toBeDefined();
      expect(dataLayer.transactions).toBeDefined();
    });

    test('should identify database models from features', async () => {
      const features = ['user-management', 'todo-management', 'category-management'];
      
      const models = await planner.identifyModels(features);

      expect(models).toContain('User');
      expect(models).toContain('Todo');
      expect(models).toContain('Category');
    });
  });

  describe('Service Layer Planning', () => {
    test('should plan business logic services', async () => {
      const features = ['user-management', 'email-sending', 'payment-processing'];
      
      const services = await planner.planServices(features);

      expect(services.some(s => s.name === 'UserService')).toBe(true);
      expect(services.some(s => s.name === 'EmailService')).toBe(true);
      expect(services.some(s => s.name === 'PaymentService')).toBe(true);
    });

    test('should define service responsibilities', async () => {
      const features = ['user-management'];
      
      const services = await planner.planServices(features);
      const userService = services.find(s => s.name === 'UserService');

      expect(userService.responsibilities).toContain('user creation');
      expect(userService.responsibilities).toContain('user validation');
      expect(userService.methods).toContain('createUser');
      expect(userService.methods).toContain('updateUser');
    });

    test('should plan service dependencies', async () => {
      const features = ['user-management', 'email-verification'];
      
      const services = await planner.planServices(features);
      const userService = services.find(s => s.name === 'UserService');

      expect(userService.dependencies).toContain('EmailService');
      expect(userService.dependencies).toContain('UserRepository');
    });
  });

  describe('Middleware Planning', () => {
    test('should plan authentication middleware', async () => {
      const features = ['auth', 'protected-routes'];
      
      const middleware = await planner.planMiddleware(features);

      expect(middleware.some(m => m.name === 'authMiddleware')).toBe(true);
      expect(middleware.some(m => m.name === 'jwtMiddleware')).toBe(true);
    });

    test('should plan validation middleware', async () => {
      const features = ['input-validation', 'data-sanitization'];
      
      const middleware = await planner.planMiddleware(features);

      expect(middleware.some(m => m.name === 'validationMiddleware')).toBe(true);
      expect(middleware.some(m => m.name === 'sanitizationMiddleware')).toBe(true);
    });

    test('should plan error handling middleware', async () => {
      const features = ['error-handling', 'logging'];
      
      const middleware = await planner.planMiddleware(features);

      expect(middleware.some(m => m.name === 'errorMiddleware')).toBe(true);
      expect(middleware.some(m => m.name === 'loggingMiddleware')).toBe(true);
    });

    test('should order middleware correctly', async () => {
      const features = ['cors', 'auth', 'validation', 'error-handling'];
      
      const middleware = await planner.planMiddleware(features);
      const orderedNames = middleware.map(m => m.name);

      expect(orderedNames.indexOf('corsMiddleware')).toBeLessThan(orderedNames.indexOf('authMiddleware'));
      expect(orderedNames.indexOf('authMiddleware')).toBeLessThan(orderedNames.indexOf('validationMiddleware'));
      expect(orderedNames.indexOf('errorMiddleware')).toBe(orderedNames.length - 1);
    });
  });

  describe('Database Schema Planning', () => {
    test('should plan database schemas for identified models', async () => {
      const models = ['User', 'Todo', 'Category'];
      
      const schemas = await planner.planDatabaseSchemas(models);

      expect(schemas.User).toBeDefined();
      expect(schemas.Todo).toBeDefined();
      expect(schemas.Category).toBeDefined();
    });

    test('should define field types and constraints', async () => {
      const models = ['User'];
      
      const schemas = await planner.planDatabaseSchemas(models);
      const userSchema = schemas.User;

      expect(userSchema.fields.email).toBeDefined();
      expect(userSchema.fields.email.type).toBe('string');
      expect(userSchema.fields.email.required).toBe(true);
      expect(userSchema.fields.email.unique).toBe(true);
    });

    test('should identify relationships between models', async () => {
      const models = ['User', 'Todo'];
      
      const schemas = await planner.planDatabaseSchemas(models);

      expect(schemas.Todo.relationships.user).toBeDefined();
      expect(schemas.Todo.relationships.user.type).toBe('belongsTo');
      expect(schemas.User.relationships.todos).toBeDefined();
      expect(schemas.User.relationships.todos.type).toBe('hasMany');
    });
  });

  describe('Security Planning', () => {
    test('should plan authentication strategy', async () => {
      const features = ['auth', 'user-sessions'];
      
      const security = await planner.planSecurity(features);

      expect(security.authentication).toBeDefined();
      expect(security.authentication.strategy).toBe('JWT');
      expect(security.authentication.endpoints).toBeDefined();
    });

    test('should plan authorization rules', async () => {
      const features = ['role-based-access', 'admin-panel'];
      
      const security = await planner.planSecurity(features);

      expect(security.authorization).toBeDefined();
      expect(security.authorization.roles).toContain('admin');
      expect(security.authorization.roles).toContain('user');
      expect(security.authorization.permissions).toBeDefined();
    });

    test('should plan input validation and sanitization', async () => {
      const features = ['form-validation', 'sql-injection-prevention'];
      
      const security = await planner.planSecurity(features);

      expect(security.validation).toBeDefined();
      expect(security.sanitization).toBeDefined();
      expect(security.sqlInjectionPrevention).toBe(true);
    });
  });

  describe('Performance Planning', () => {
    test('should plan caching strategy', async () => {
      const features = ['caching', 'performance-optimization'];
      
      const performance = await planner.planPerformance(features);

      expect(performance.caching).toBeDefined();
      expect(performance.caching.strategy).toBeDefined();
      expect(performance.caching.layers).toBeDefined();
    });

    test('should plan database optimization', async () => {
      const features = ['database-optimization', 'indexing'];
      
      const performance = await planner.planPerformance(features);

      expect(performance.database).toBeDefined();
      expect(performance.database.indexing).toBeDefined();
      expect(performance.database.queryOptimization).toBeDefined();
    });

    test('should plan API rate limiting', async () => {
      const features = ['rate-limiting', 'ddos-protection'];
      
      const performance = await planner.planPerformance(features);

      expect(performance.rateLimiting).toBeDefined();
      expect(performance.rateLimiting.strategy).toBeDefined();
      expect(performance.rateLimiting.limits).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid analysis gracefully', async () => {
      const invalidAnalysis = null;

      await expect(planner.planArchitecture(invalidAnalysis))
        .rejects.toThrow('Analysis must be provided');
    });

    test('should handle missing backend components', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low'
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture).toBeDefined();
      expect(architecture.apiDesign).toBeDefined();
    });

    test('should provide fallback for unknown features', async () => {
      const features = ['unknown-feature', 'mysterious-service'];
      
      const services = await planner.planServices(features);

      expect(services.length).toBeGreaterThan(0);
      expect(services.some(s => s.name === 'GenericService')).toBe(true);
    });
  });

  describe('Architecture Validation', () => {
    test('should validate architecture completeness', async () => {
      const architecture = {
        apiDesign: { style: 'REST', endpoints: [] },
        dataLayer: { pattern: 'repository', models: [] },
        services: [],
        middleware: []
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.suggestions).toBeDefined();
    });

    test('should identify missing components', async () => {
      const architecture = {
        apiDesign: { style: 'REST', endpoints: [] }
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Data layer not defined');
    });

    test('should suggest improvements', async () => {
      const architecture = {
        apiDesign: { style: 'REST', endpoints: [] },
        dataLayer: { pattern: 'repository', models: [] },
        services: [],
        middleware: []
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Architecture Documentation', () => {
    test('should generate architecture documentation', async () => {
      const architecture = {
        apiDesign: { style: 'REST', endpoints: [{ path: '/users', method: 'GET' }] },
        dataLayer: { pattern: 'repository', models: ['User'] },
        services: [{ name: 'UserService', responsibilities: ['user management'] }],
        middleware: [{ name: 'authMiddleware', purpose: 'authentication' }]
      };

      const documentation = await planner.generateDocumentation(architecture);

      expect(documentation.overview).toBeDefined();
      expect(documentation.apiDocumentation).toBeDefined();
      expect(documentation.dataLayerDocs).toBeDefined();
      expect(documentation.serviceDocumentation).toBeDefined();
    });

    test('should include API endpoint documentation', async () => {
      const architecture = {
        apiDesign: {
          style: 'REST',
          endpoints: [
            { path: '/users', method: 'GET', description: 'Get all users' },
            { path: '/users/:id', method: 'GET', description: 'Get user by ID' }
          ]
        }
      };

      const documentation = await planner.generateDocumentation(architecture);

      expect(documentation.apiDocumentation).toContain('GET /users');
      expect(documentation.apiDocumentation).toContain('GET /users/:id');
    });

    test('should include service interaction diagrams', async () => {
      const architecture = {
        services: [
          { name: 'UserService', dependencies: ['UserRepository', 'EmailService'] },
          { name: 'EmailService', dependencies: [] }
        ]
      };

      const documentation = await planner.generateDocumentation(architecture);

      expect(documentation.serviceInteractions).toBeDefined();
      expect(documentation.dependencyGraph).toBeDefined();
    });
  });
});