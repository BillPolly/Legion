/**
 * APIInterfacePlannerConfig - SIMPLIFIED Configuration for API interface planning
 * 
 * This is a simplified version with only essential actions to prevent LLM overload.
 * Original complex version backed up as APIInterfacePlannerConfig.js.backup
 */

export const APIInterfacePlannerConfig = {
  name: 'APIInterfacePlanner',
  description: 'Plans API interfaces between frontend and backend - SIMPLIFIED VERSION',
  
  allowableActions: [
    {
      type: 'create_basic_api_contract',
      description: 'Create a basic API contract with essential endpoints',
      inputs: ['frontend_architecture', 'backend_architecture'],
      outputs: ['api_contract'],
      parameters: {
        endpoints: {
          type: 'array',
          description: 'List of API endpoints'
        },
        methods: {
          type: 'array',
          description: 'HTTP methods used'
        }
      }
    },
    {
      type: 'define_data_transfer_format',
      description: 'Define the data transfer format and structure',
      inputs: ['api_contract'],
      outputs: ['data_format'],
      parameters: {
        format: {
          type: 'string',
          enum: ['JSON', 'XML'],
          description: 'Data transfer format'
        }
      }
    },
    {
      type: 'setup_error_handling',
      description: 'Setup basic error handling for the API',
      inputs: ['api_contract', 'data_format'],
      outputs: ['error_handling'],
      parameters: {
        statusCodes: {
          type: 'array',
          description: 'HTTP status codes to handle'
        }
      }
    },
    {
      type: 'update_api_contract',
      description: 'Update the API contract with additional information',
      inputs: ['api_contract'],
      outputs: ['api_contract'],
      parameters: {
        updates: {
          type: 'object',
          description: 'Updates to apply to the contract'
        }
      }
    },
    {
      type: 'review_and_finalize_api_contract',
      description: 'Review and finalize the API contract',
      inputs: ['api_contract', 'data_format', 'error_handling'],
      outputs: ['api_contract', 'data_format', 'error_handling'],
      parameters: {
        final: {
          type: 'boolean',
          description: 'Whether this is the final version'
        }
      }
    }
  ],
  
  constraints: [
    'Keep API design RESTful and consistent',
    'Ensure proper error handling for all endpoints',
    'Define clear data transfer formats'
  ],
  
  examples: [
    {
      input: {
        frontend: 'React app with user dashboard',
        backend: 'Node.js API with authentication'
      },
      expectedOutput: {
        type: 'api_contract',
        endpoints: ['/api/auth/login', '/api/users/profile', '/api/users/dashboard']
      }
    }
  ],
  
  mockResponses: {
    'simple-api': {
      task: 'Basic REST API',
      endpoints: ['/api/users', '/api/posts'],
      methods: ['GET', 'POST'],
      complexity: 'low',
      contracts: [
        { endpoint: '/api/users', method: 'GET', response: 'User[]' },
        { endpoint: '/api/posts', method: 'GET', response: 'Post[]' }
      ],
      dataTransferObjects: ['User', 'Post'],
      communication: 'REST',
      errorHandling: ['400 Bad Request', '500 Internal Server Error'],
      metadata: {
        planner: 'APIInterfacePlanner',
        plannedAt: Date.now(),
        mockScenario: 'simple-api'
      }
    },
    'authenticated-api': {
      task: 'API with authentication',
      endpoints: ['/api/auth', '/api/users', '/api/admin'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      complexity: 'high',
      contracts: [
        { endpoint: '/api/auth/login', method: 'POST', response: 'AuthToken' },
        { endpoint: '/api/users', method: 'GET', response: 'User[]' }
      ],
      dataTransferObjects: ['User', 'AuthToken', 'AdminUser'],
      communication: 'REST with JWT',
      errorHandling: ['401 Unauthorized', '403 Forbidden', '500 Internal Server Error'],
      metadata: {
        planner: 'APIInterfacePlanner',
        plannedAt: Date.now(),
        mockScenario: 'authenticated-api'
      }
    }
  },
  
  requiredOutputs: ['api_contract', 'data_format', 'error_handling'],
  maxSteps: 4
};