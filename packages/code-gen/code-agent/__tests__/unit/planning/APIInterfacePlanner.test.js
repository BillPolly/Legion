/**
 * Tests for APIInterfacePlanner class
 * 
 * APIInterfacePlanner is responsible for planning API interfaces and contracts
 * between frontend and backend, including data transfer objects and communication patterns.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { APIInterfacePlanner } from '../../../src/planning/APIInterfacePlanner.js';

describe('APIInterfacePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new APIInterfacePlanner();
  });

  describe('Constructor', () => {
    test('should create APIInterfacePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.apiVersion).toBe('v1');
      expect(planner.config.responseFormat).toBe('JSON');
    });

    test('should accept custom configuration', () => {
      const customPlanner = new APIInterfacePlanner({
        apiVersion: 'v2',
        responseFormat: 'XML',
        enableWebSocket: true,
        enableGraphQL: true
      });

      expect(customPlanner.config.apiVersion).toBe('v2');
      expect(customPlanner.config.responseFormat).toBe('XML');
      expect(customPlanner.config.enableWebSocket).toBe(true);
      expect(customPlanner.config.enableGraphQL).toBe(true);
    });
  });

  describe('Interface Planning', () => {
    test('should plan API interfaces for fullstack project', async () => {
      const frontendArchitecture = {
        components: [
          { name: 'UserList', type: 'display' },
          { name: 'UserForm', type: 'form' },
          { name: 'AuthComponent', type: 'auth' }
        ],
        stateManagement: { pattern: 'centralized' }
      };

      const backendArchitecture = {
        apiDesign: {
          style: 'REST',
          endpoints: [
            { path: '/users', method: 'GET', resource: 'users' },
            { path: '/users', method: 'POST', resource: 'users' },
            { path: '/auth/login', method: 'POST', resource: 'auth' }
          ]
        },
        dataLayer: { models: ['User'] }
      };

      const interfaces = await planner.planInterfaces(frontendArchitecture, backendArchitecture);

      expect(interfaces.contracts).toBeDefined();
      expect(interfaces.dataTransferObjects).toBeDefined();
      expect(interfaces.communication).toBeDefined();
      expect(interfaces.errorHandling).toBeDefined();
    });

    test('should plan REST API contracts', async () => {
      const backendApi = {
        style: 'REST',
        endpoints: [
          { path: '/users', method: 'GET', resource: 'users' },
          { path: '/users/:id', method: 'GET', resource: 'users' },
          { path: '/users', method: 'POST', resource: 'users' }
        ]
      };

      const contracts = await planner.planApiContracts(backendApi);

      expect(contracts.length).toBeGreaterThan(0);
      expect(contracts.some(c => c.endpoint === '/users' && c.method === 'GET')).toBe(true);
      expect(contracts.some(c => c.endpoint === '/users/:id' && c.method === 'GET')).toBe(true);
      expect(contracts.some(c => c.endpoint === '/users' && c.method === 'POST')).toBe(true);
    });

    test('should plan GraphQL schema interfaces', async () => {
      const backendApi = {
        style: 'GraphQL',
        schema: { types: ['User', 'Post'] },
        queries: ['user', 'users', 'post', 'posts'],
        mutations: ['createUser', 'updateUser', 'createPost']
      };

      const contracts = await planner.planApiContracts(backendApi);

      expect(contracts.queries).toBeDefined();
      expect(contracts.mutations).toBeDefined();
      expect(contracts.types).toBeDefined();
      expect(contracts.schema).toBeDefined();
    });
  });

  describe('Data Transfer Objects', () => {
    test('should generate DTOs for data models', async () => {
      const models = ['User', 'Todo', 'Category'];
      
      const dtos = await planner.generateDTOs(models);

      expect(dtos.User).toBeDefined();
      expect(dtos.Todo).toBeDefined();
      expect(dtos.Category).toBeDefined();
    });

    test('should create request and response DTOs', async () => {
      const models = ['User'];
      
      const dtos = await planner.generateDTOs(models);
      const userDtos = dtos.User;

      expect(userDtos.request).toBeDefined();
      expect(userDtos.response).toBeDefined();
      expect(userDtos.create).toBeDefined();
      expect(userDtos.update).toBeDefined();
    });

    test('should define DTO field types and validation', async () => {
      const models = ['User'];
      
      const dtos = await planner.generateDTOs(models);
      const userCreateDto = dtos.User.create;

      expect(userCreateDto.fields.email).toBeDefined();
      expect(userCreateDto.fields.email.type).toBe('string');
      expect(userCreateDto.fields.email.required).toBe(true);
      expect(userCreateDto.fields.email.validation).toContain('email');
    });

    test('should handle nested DTOs and relationships', async () => {
      const models = ['User', 'Todo'];
      
      const dtos = await planner.generateDTOs(models);

      expect(dtos.User.response.fields.todos).toBeDefined();
      expect(dtos.User.response.fields.todos.type).toBe('array');
      expect(dtos.Todo.response.fields.user).toBeDefined();
      expect(dtos.Todo.response.fields.user.type).toBe('object');
    });
  });

  describe('API Communication Patterns', () => {
    test('should plan HTTP communication for REST APIs', async () => {
      const apiStyle = 'REST';
      const features = ['crud', 'auth', 'real-time'];
      
      const communication = await planner.planCommunication(apiStyle, features);

      expect(communication.protocol).toBe('HTTP');
      expect(communication.format).toBe('JSON');
      expect(communication.methods).toContain('GET');
      expect(communication.methods).toContain('POST');
      expect(communication.methods).toContain('PUT');
      expect(communication.methods).toContain('DELETE');
    });

    test('should plan WebSocket communication for real-time features', async () => {
      const apiStyle = 'REST';
      const features = ['real-time', 'notifications', 'live-updates'];
      
      const communication = await planner.planCommunication(apiStyle, features);

      expect(communication.webSocket).toBeDefined();
      expect(communication.webSocket.enabled).toBe(true);
      expect(communication.webSocket.events).toContain('notification');
      expect(communication.webSocket.events).toContain('update');
    });

    test('should plan server-sent events for one-way updates', async () => {
      const apiStyle = 'REST';
      const features = ['live-feed', 'notifications'];
      
      const communication = await planner.planCommunication(apiStyle, features);

      expect(communication.serverSentEvents).toBeDefined();
      expect(communication.serverSentEvents.enabled).toBe(true);
      expect(communication.serverSentEvents.endpoints).toContain('/events');
    });

    test('should plan GraphQL subscriptions', async () => {
      const apiStyle = 'GraphQL';
      const features = ['real-time', 'subscriptions'];
      
      const communication = await planner.planCommunication(apiStyle, features);

      expect(communication.subscriptions).toBeDefined();
      expect(communication.subscriptions.enabled).toBe(true);
      expect(communication.subscriptions.types).toBeDefined();
    });
  });

  describe('Error Handling Interfaces', () => {
    test('should define standard error response format', async () => {
      const errorHandling = await planner.planErrorHandling();

      expect(errorHandling.standardFormat).toBeDefined();
      expect(errorHandling.standardFormat.error).toBeDefined();
      expect(errorHandling.standardFormat.message).toBeDefined();
      expect(errorHandling.standardFormat.code).toBeDefined();
    });

    test('should plan error codes and categories', async () => {
      const errorHandling = await planner.planErrorHandling();

      expect(errorHandling.codes).toBeDefined();
      expect(errorHandling.codes.validation).toBeDefined();
      expect(errorHandling.codes.authentication).toBeDefined();
      expect(errorHandling.codes.authorization).toBeDefined();
      expect(errorHandling.codes.notFound).toBeDefined();
      expect(errorHandling.codes.serverError).toBeDefined();
    });

    test('should plan field-level validation errors', async () => {
      const errorHandling = await planner.planErrorHandling();

      expect(errorHandling.validation).toBeDefined();
      expect(errorHandling.validation.fieldErrors).toBeDefined();
      expect(errorHandling.validation.format).toBeDefined();
    });
  });

  describe('Authentication and Authorization Interfaces', () => {
    test('should plan authentication endpoints and flows', async () => {
      const features = ['auth', 'jwt', 'oauth'];
      
      const authInterfaces = await planner.planAuthInterfaces(features);

      expect(authInterfaces.endpoints).toBeDefined();
      expect(authInterfaces.endpoints.login).toBeDefined();
      expect(authInterfaces.endpoints.logout).toBeDefined();
      expect(authInterfaces.endpoints.refresh).toBeDefined();
    });

    test('should define token response formats', async () => {
      const features = ['jwt'];
      
      const authInterfaces = await planner.planAuthInterfaces(features);

      expect(authInterfaces.tokenResponse).toBeDefined();
      expect(authInterfaces.tokenResponse.accessToken).toBeDefined();
      expect(authInterfaces.tokenResponse.refreshToken).toBeDefined();
      expect(authInterfaces.tokenResponse.expiresIn).toBeDefined();
    });

    test('should plan user profile interfaces', async () => {
      const features = ['user-profile', 'auth'];
      
      const authInterfaces = await planner.planAuthInterfaces(features);

      expect(authInterfaces.userProfile).toBeDefined();
      expect(authInterfaces.userProfile.fields).toBeDefined();
      expect(authInterfaces.userProfile.permissions).toBeDefined();
    });
  });

  describe('Pagination and Filtering Interfaces', () => {
    test('should plan pagination parameters', async () => {
      const endpoints = [
        { path: '/users', method: 'GET', resource: 'users' },
        { path: '/posts', method: 'GET', resource: 'posts' }
      ];
      
      const pagination = await planner.planPaginationInterfaces(endpoints);

      expect(pagination.parameters).toBeDefined();
      expect(pagination.parameters.page).toBeDefined();
      expect(pagination.parameters.limit).toBeDefined();
      expect(pagination.parameters.offset).toBeDefined();
    });

    test('should define pagination response format', async () => {
      const endpoints = [{ path: '/users', method: 'GET', resource: 'users' }];
      
      const pagination = await planner.planPaginationInterfaces(endpoints);

      expect(pagination.responseFormat).toBeDefined();
      expect(pagination.responseFormat.data).toBeDefined();
      expect(pagination.responseFormat.pagination).toBeDefined();
      expect(pagination.responseFormat.pagination.total).toBeDefined();
      expect(pagination.responseFormat.pagination.page).toBeDefined();
    });

    test('should plan filtering and sorting interfaces', async () => {
      const endpoints = [{ path: '/users', method: 'GET', resource: 'users' }];
      
      const filtering = await planner.planFilteringInterfaces(endpoints);

      expect(filtering.filters).toBeDefined();
      expect(filtering.sorting).toBeDefined();
      expect(filtering.search).toBeDefined();
    });
  });

  describe('File Upload Interfaces', () => {
    test('should plan file upload endpoints', async () => {
      const features = ['file-upload', 'image-upload'];
      
      const fileInterfaces = await planner.planFileInterfaces(features);

      expect(fileInterfaces.uploadEndpoint).toBeDefined();
      expect(fileInterfaces.downloadEndpoint).toBeDefined();
      expect(fileInterfaces.supportedTypes).toBeDefined();
    });

    test('should define file metadata format', async () => {
      const features = ['file-upload'];
      
      const fileInterfaces = await planner.planFileInterfaces(features);

      expect(fileInterfaces.metadata).toBeDefined();
      expect(fileInterfaces.metadata.filename).toBeDefined();
      expect(fileInterfaces.metadata.size).toBeDefined();
      expect(fileInterfaces.metadata.mimeType).toBeDefined();
    });

    test('should plan multipart form data handling', async () => {
      const features = ['file-upload'];
      
      const fileInterfaces = await planner.planFileInterfaces(features);

      expect(fileInterfaces.encoding).toBe('multipart/form-data');
      expect(fileInterfaces.maxSize).toBeDefined();
      expect(fileInterfaces.validation).toBeDefined();
    });
  });

  describe('Interface Validation', () => {
    test('should validate interface completeness', async () => {
      const interfaces = {
        contracts: [{ endpoint: '/users', method: 'GET' }],
        dataTransferObjects: { User: { response: {} } },
        communication: { protocol: 'HTTP' },
        errorHandling: { standardFormat: {} }
      };

      const validation = await planner.validateInterfaces(interfaces);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.suggestions).toBeDefined();
    });

    test('should identify missing interface components', async () => {
      const interfaces = {
        contracts: []
      };

      const validation = await planner.validateInterfaces(interfaces);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('No API contracts defined');
    });

    test('should suggest improvements', async () => {
      const interfaces = {
        contracts: [{ endpoint: '/users', method: 'GET' }],
        dataTransferObjects: {},
        communication: { protocol: 'HTTP' },
        errorHandling: {}
      };

      const validation = await planner.validateInterfaces(interfaces);

      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Interface Documentation', () => {
    test('should generate API documentation', async () => {
      const interfaces = {
        contracts: [
          { endpoint: '/users', method: 'GET', description: 'Get all users' },
          { endpoint: '/users/:id', method: 'GET', description: 'Get user by ID' }
        ],
        dataTransferObjects: {
          User: {
            response: {
              fields: {
                id: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      };

      const documentation = await planner.generateDocumentation(interfaces);

      expect(documentation.apiReference).toBeDefined();
      expect(documentation.dataTypes).toBeDefined();
      expect(documentation.examples).toBeDefined();
    });

    test('should include request/response examples', async () => {
      const interfaces = {
        contracts: [{ endpoint: '/users', method: 'POST', requestBody: 'UserCreateDTO' }],
        dataTransferObjects: {
          User: {
            create: {
              fields: {
                email: { type: 'string', example: 'user@example.com' },
                name: { type: 'string', example: 'John Doe' }
              }
            }
          }
        }
      };

      const documentation = await planner.generateDocumentation(interfaces);

      expect(documentation.examples.requests).toBeDefined();
      expect(documentation.examples.responses).toBeDefined();
    });

    test('should generate OpenAPI specification', async () => {
      const interfaces = {
        contracts: [{ endpoint: '/users', method: 'GET' }],
        dataTransferObjects: { User: { response: {} } }
      };

      const openApiSpec = await planner.generateOpenAPISpec(interfaces);

      expect(openApiSpec.openapi).toBeDefined();
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing architectures gracefully', async () => {
      await expect(planner.planInterfaces(null, null))
        .rejects.toThrow('Frontend and backend architectures must be provided');
    });

    test('should handle invalid API styles', async () => {
      const invalidApi = { style: 'INVALID', endpoints: [] };
      
      const contracts = await planner.planApiContracts(invalidApi);
      
      expect(contracts).toBeDefined();
      expect(Array.isArray(contracts)).toBe(true);
    });

    test('should provide fallback for empty models', async () => {
      const dtos = await planner.generateDTOs([]);
      
      expect(dtos).toBeDefined();
      expect(typeof dtos).toBe('object');
    });
  });

  describe('Integration with Architecture Components', () => {
    test('should map frontend components to API contracts', async () => {
      const frontendComponents = [
        { name: 'UserList', type: 'display' },
        { name: 'UserForm', type: 'form' }
      ];
      
      const mapping = await planner.mapComponentsToContracts(frontendComponents);

      expect(mapping.UserList).toBeDefined();
      expect(mapping.UserList.contracts).toContain('GET /users');
      expect(mapping.UserForm).toBeDefined();
      expect(mapping.UserForm.contracts).toContain('POST /users');
    });

    test('should align DTOs with backend data models', async () => {
      const backendModels = ['User', 'Todo'];
      const frontendState = ['userState', 'todoState'];
      
      const alignment = await planner.alignDTOsWithModels(backendModels, frontendState);

      expect(alignment.User).toBeDefined();
      expect(alignment.Todo).toBeDefined();
      expect(alignment.User.frontendState).toBe('userState');
      expect(alignment.Todo.frontendState).toBe('todoState');
    });
  });
});