/**
 * APIInterfacePlannerConfig - Configuration for API interface planning
 * 
 * Defines the allowable actions and constraints for creating comprehensive API
 * interfaces and contracts between frontend and backend components.
 */

export const APIInterfacePlannerConfig = {
  name: 'APIInterfacePlanner',
  description: 'Plans API interfaces and contracts between frontend and backend components',
  
  allowableActions: [
    {
      type: 'analyze_api_requirements',
      description: 'Analyze API requirements from frontend and backend architectures',
      inputs: ['frontend_architecture', 'backend_architecture'],
      outputs: ['api_requirements'],
      parameters: {
        endpoints: {
          type: 'array',
          description: 'List of required API endpoints'
        },
        dataTypes: {
          type: 'array',
          description: 'List of data types to be transferred'
        },
        features: {
          type: 'array',
          description: 'List of features requiring API support'
        }
      }
    },
    {
      type: 'create_contract',
      description: 'Create an API contract specification',
      inputs: ['endpoint_requirements', 'data_requirements'],
      outputs: ['api_contract'],
      parameters: {
        endpoint: {
          type: 'string',
          description: 'API endpoint path'
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method'
        },
        description: {
          type: 'string',
          description: 'Description of the endpoint'
        },
        requestBody: {
          type: 'string',
          description: 'Request body type'
        },
        responseType: {
          type: 'string',
          description: 'Response type'
        },
        statusCodes: {
          type: 'array',
          description: 'Supported HTTP status codes'
        },
        parameters: {
          type: 'array',
          description: 'Request parameters'
        },
        headers: {
          type: 'array',
          description: 'Required headers'
        }
      }
    },
    {
      type: 'define_dto',
      description: 'Define a Data Transfer Object',
      inputs: ['data_model', 'usage_context'],
      outputs: ['dto_definition'],
      parameters: {
        model: {
          type: 'string',
          description: 'Name of the data model'
        },
        definition: {
          type: 'object',
          description: 'DTO definition including request, response, create, and update variants'
        }
      }
    },
    {
      type: 'configure_communication',
      description: 'Configure communication patterns and protocols',
      inputs: ['api_style', 'features'],
      outputs: ['communication_configuration'],
      parameters: {
        protocol: {
          type: 'string',
          enum: ['HTTP', 'WebSocket', 'Server-Sent Events'],
          description: 'Communication protocol'
        },
        format: {
          type: 'string',
          enum: ['JSON', 'XML', 'MessagePack'],
          description: 'Data format'
        },
        methods: {
          type: 'array',
          description: 'Supported HTTP methods'
        },
        headers: {
          type: 'object',
          description: 'Standard headers configuration'
        },
        cors: {
          type: 'object',
          description: 'CORS configuration'
        },
        webSocket: {
          type: 'object',
          description: 'WebSocket configuration if needed'
        }
      }
    },
    {
      type: 'setup_error_handling',
      description: 'Setup standardized error handling',
      inputs: ['error_requirements'],
      outputs: ['error_handling_configuration'],
      parameters: {
        standardFormat: {
          type: 'object',
          description: 'Standard error response format'
        },
        codes: {
          type: 'object',
          description: 'Error codes mapping'
        },
        validation: {
          type: 'object',
          description: 'Validation error format'
        },
        httpStatusMapping: {
          type: 'object',
          description: 'HTTP status codes mapping'
        }
      }
    },
    {
      type: 'configure_authentication',
      description: 'Configure authentication interfaces',
      inputs: ['auth_requirements', 'security_features'],
      outputs: ['authentication_configuration'],
      parameters: {
        endpoints: {
          type: 'object',
          description: 'Authentication endpoints'
        },
        tokenResponse: {
          type: 'object',
          description: 'Token response format'
        },
        headers: {
          type: 'object',
          description: 'Authentication headers'
        },
        userProfile: {
          type: 'object',
          description: 'User profile interface'
        },
        oauth: {
          type: 'object',
          description: 'OAuth configuration if needed'
        }
      }
    },
    {
      type: 'setup_pagination',
      description: 'Setup pagination interfaces for list endpoints',
      inputs: ['list_endpoints', 'pagination_strategy'],
      outputs: ['pagination_configuration'],
      parameters: {
        parameters: {
          type: 'object',
          description: 'Pagination parameters'
        },
        responseFormat: {
          type: 'object',
          description: 'Paginated response format'
        },
        strategies: {
          type: 'object',
          description: 'Pagination strategies'
        }
      }
    },
    {
      type: 'configure_file_handling',
      description: 'Configure file upload and download interfaces',
      inputs: ['file_features', 'security_requirements'],
      outputs: ['file_handling_configuration'],
      parameters: {
        uploadEndpoint: {
          type: 'object',
          description: 'File upload endpoint configuration'
        },
        downloadEndpoint: {
          type: 'object',
          description: 'File download endpoint configuration'
        },
        supportedTypes: {
          type: 'array',
          description: 'Supported file types'
        },
        maxSize: {
          type: 'number',
          description: 'Maximum file size'
        },
        metadata: {
          type: 'object',
          description: 'File metadata structure'
        },
        validation: {
          type: 'object',
          description: 'File validation rules'
        }
      }
    },
    {
      type: 'setup_filtering',
      description: 'Setup filtering and search interfaces',
      inputs: ['search_requirements', 'data_models'],
      outputs: ['filtering_configuration'],
      parameters: {
        filters: {
          type: 'object',
          description: 'Filter parameters and operators'
        },
        sorting: {
          type: 'object',
          description: 'Sorting configuration'
        },
        search: {
          type: 'object',
          description: 'Search configuration'
        }
      }
    },
    {
      type: 'validate_interfaces',
      description: 'Validate API interfaces for completeness and consistency',
      inputs: ['api_interfaces'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the interfaces are valid'
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
    },
    {
      type: 'generate_documentation',
      description: 'Generate API documentation',
      inputs: ['api_interfaces'],
      outputs: ['api_documentation'],
      parameters: {
        apiReference: {
          type: 'string',
          description: 'API reference documentation'
        },
        dataTypes: {
          type: 'string',
          description: 'Data types documentation'
        },
        examples: {
          type: 'object',
          description: 'API usage examples'
        },
        authenticationGuide: {
          type: 'string',
          description: 'Authentication guide'
        },
        errorHandlingGuide: {
          type: 'string',
          description: 'Error handling guide'
        }
      }
    },
    {
      type: 'generate_openapi_spec',
      description: 'Generate OpenAPI specification',
      inputs: ['api_interfaces'],
      outputs: ['openapi_specification'],
      parameters: {
        openapi: {
          type: 'string',
          description: 'OpenAPI version'
        },
        info: {
          type: 'object',
          description: 'API information'
        },
        servers: {
          type: 'array',
          description: 'Server configurations'
        },
        paths: {
          type: 'object',
          description: 'API paths and operations'
        },
        components: {
          type: 'object',
          description: 'Reusable components'
        }
      }
    }
  ],
  
  constraints: [
    'API contracts must follow REST or GraphQL standards',
    'DTOs must be consistent between request and response formats',
    'Communication protocols must be appropriate for the use case',
    'Error handling must be standardized across all endpoints',
    'Authentication must be secure and follow best practices',
    'Pagination must be implemented for list endpoints',
    'File handling must include proper validation and security',
    'API versioning must be consistent across all endpoints',
    'Documentation must be complete and accurate',
    'OpenAPI specification must be valid and comprehensive'
  ],
  
  examples: [
    {
      input: {
        frontendArchitecture: {
          components: [
            { name: 'UserList', type: 'display' },
            { name: 'UserForm', type: 'form' }
          ]
        },
        backendArchitecture: {
          apiDesign: {
            style: 'REST',
            endpoints: ['/users']
          },
          dataLayer: {
            models: ['User']
          }
        }
      },
      expectedOutput: {
        contracts: [
          {
            endpoint: '/api/users',
            method: 'GET',
            description: 'Get list of users',
            responseType: 'PaginatedResponse<UserResponseDTO>'
          },
          {
            endpoint: '/api/users',
            method: 'POST',
            description: 'Create new user',
            requestBody: 'UserCreateDTO',
            responseType: 'UserResponseDTO'
          }
        ],
        dataTransferObjects: {
          User: {
            request: { name: 'UserRequestDTO' },
            response: { name: 'UserResponseDTO' },
            create: { name: 'UserCreateDTO' },
            update: { name: 'UserUpdateDTO' }
          }
        },
        communication: {
          protocol: 'HTTP',
          format: 'JSON',
          methods: ['GET', 'POST', 'PUT', 'DELETE']
        }
      }
    }
  ],
  
  mockResponses: {
    'simple-api': {
      contracts: [
        {
          endpoint: '/api/users',
          method: 'GET',
          description: 'Get list of users',
          responseType: 'Array<UserResponseDTO>',
          statusCodes: [200, 400, 500],
          parameters: [],
          headers: ['Content-Type']
        },
        {
          endpoint: '/api/users',
          method: 'POST',
          description: 'Create new user',
          requestBody: 'UserCreateDTO',
          responseType: 'UserResponseDTO',
          statusCodes: [201, 400, 422, 500],
          parameters: [],
          headers: ['Content-Type']
        }
      ],
      dataTransferObjects: {
        User: {
          request: {
            name: 'UserRequestDTO',
            fields: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: true }
            }
          },
          response: {
            name: 'UserResponseDTO',
            fields: {
              id: { type: 'string', required: true },
              name: { type: 'string', required: true },
              email: { type: 'string', required: true },
              createdAt: { type: 'date', required: true }
            }
          },
          create: {
            name: 'UserCreateDTO',
            fields: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: true }
            },
            validation: {
              name: ['required', 'minLength:2'],
              email: ['required', 'email']
            }
          },
          update: {
            name: 'UserUpdateDTO',
            fields: {
              name: { type: 'string', required: false },
              email: { type: 'string', required: false }
            },
            partial: true
          }
        }
      },
      communication: {
        protocol: 'HTTP',
        format: 'JSON',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        headers: {
          standard: ['Content-Type', 'Accept'],
          custom: ['X-Request-ID']
        },
        cors: {
          origins: ['*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          headers: ['Content-Type', 'Authorization']
        }
      },
      errorHandling: {
        standardFormat: {
          error: true,
          message: 'string',
          code: 'string',
          details: 'object',
          timestamp: 'string'
        },
        codes: {
          validation: 'VALIDATION_ERROR',
          notFound: 'NOT_FOUND',
          serverError: 'INTERNAL_ERROR'
        },
        httpStatusMapping: {
          ok: 200,
          created: 201,
          badRequest: 400,
          notFound: 404,
          validationError: 422,
          serverError: 500
        }
      },
      metadata: {
        planner: 'APIInterfacePlanner',
        plannedAt: 1234567890,
        apiVersion: 'v1',
        mockScenario: 'simple-api'
      }
    },
    'authenticated-api': {
      contracts: [
        {
          endpoint: '/api/auth/login',
          method: 'POST',
          description: 'User login',
          requestBody: 'LoginDTO',
          responseType: 'TokenResponseDTO',
          statusCodes: [200, 400, 401, 500],
          parameters: [],
          headers: ['Content-Type']
        },
        {
          endpoint: '/api/users',
          method: 'GET',
          description: 'Get list of users',
          responseType: 'PaginatedResponse<UserResponseDTO>',
          statusCodes: [200, 401, 500],
          parameters: [
            { name: 'page', type: 'number', in: 'query' },
            { name: 'limit', type: 'number', in: 'query' }
          ],
          headers: ['Content-Type', 'Authorization']
        }
      ],
      dataTransferObjects: {
        User: {
          response: {
            name: 'UserResponseDTO',
            fields: {
              id: { type: 'string', required: true },
              email: { type: 'string', required: true },
              name: { type: 'string', required: true },
              roles: { type: 'array', items: 'string' }
            }
          }
        }
      },
      communication: {
        protocol: 'HTTP',
        format: 'JSON',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        headers: {
          standard: ['Content-Type', 'Accept'],
          authentication: ['Authorization'],
          custom: ['X-Request-ID']
        }
      },
      errorHandling: {
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
          serverError: 'INTERNAL_ERROR'
        }
      },
      authentication: {
        endpoints: {
          login: {
            path: '/api/auth/login',
            method: 'POST',
            requestBody: 'LoginDTO',
            response: 'TokenResponseDTO'
          },
          logout: {
            path: '/api/auth/logout',
            method: 'POST',
            response: 'MessageResponseDTO'
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
      },
      pagination: {
        parameters: {
          page: { type: 'number', default: 1, min: 1 },
          limit: { type: 'number', default: 20, min: 1, max: 100 }
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
        }
      },
      metadata: {
        planner: 'APIInterfacePlanner',
        plannedAt: 1234567890,
        apiVersion: 'v1',
        mockScenario: 'authenticated-api'
      }
    }
  }
};