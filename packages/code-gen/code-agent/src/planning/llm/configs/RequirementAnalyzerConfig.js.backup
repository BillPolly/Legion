/**
 * RequirementAnalyzerConfig - Configuration for requirement analysis planning
 * 
 * Defines the allowable actions and constraints for analyzing project requirements
 * and converting them into structured analysis.
 */

export const RequirementAnalyzerConfig = {
  name: 'RequirementAnalyzer',
  description: 'Analyzes project requirements to create actionable development plans',
  
  allowableActions: [
    {
      type: 'parse_requirements',
      description: 'Parse and structure the raw requirements',
      inputs: ['requirements_text', 'frontend_requirements', 'backend_requirements'],
      outputs: ['parsed_requirements'],
      parameters: {
        hasBackend: {
          type: 'boolean',
          description: 'Whether backend requirements exist'
        },
        hasFrontend: {
          type: 'boolean',
          description: 'Whether frontend requirements exist'
        }
      }
    },
    {
      type: 'determine_project_type',
      description: 'Determine the project type based on requirements',
      inputs: ['requirements_text', 'frontend_requirements', 'backend_requirements'],
      outputs: ['project_type'],
      parameters: {
        projectType: {
          type: 'string',
          enum: ['frontend', 'backend', 'fullstack'],
          description: 'The determined project type'
        }
      }
    },
    {
      type: 'analyze_complexity',
      description: 'Analyze project complexity based on features and requirements',
      inputs: ['frontend_features', 'backend_features'],
      outputs: ['complexity_level'],
      parameters: {
        complexity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'The determined complexity level'
        },
        score: {
          type: 'number',
          description: 'Complexity score used for determination'
        },
        factors: {
          type: 'array',
          description: 'Factors that influenced complexity determination'
        }
      }
    },
    {
      type: 'extract_frontend_features',
      description: 'Extract frontend features from requirements',
      inputs: ['requirements_text', 'frontend_requirements'],
      outputs: ['frontend_features'],
      parameters: {
        features: {
          type: 'array',
          description: 'List of identified frontend features'
        },
        technologies: {
          type: 'array',
          description: 'Required frontend technologies'
        },
        uiComponents: {
          type: 'array',
          description: 'UI components to be created'
        }
      }
    },
    {
      type: 'extract_backend_features',
      description: 'Extract backend features from requirements',
      inputs: ['requirements_text', 'backend_requirements'],
      outputs: ['backend_features'],
      parameters: {
        features: {
          type: 'array',
          description: 'List of identified backend features'
        },
        technologies: {
          type: 'array',
          description: 'Required backend technologies'
        },
        storage: {
          type: 'string',
          description: 'Storage/database type if specified'
        },
        operations: {
          type: 'array',
          description: 'CRUD operations if required'
        }
      }
    },
    {
      type: 'analyze_security_requirements',
      description: 'Analyze security requirements from the project description',
      inputs: ['requirements_text', 'frontend_features', 'backend_features'],
      outputs: ['security_analysis'],
      parameters: {
        authentication: {
          type: 'boolean',
          description: 'Whether authentication is required'
        },
        method: {
          type: 'string',
          enum: ['jwt', 'session', 'oauth'],
          description: 'Authentication method if required'
        },
        apiKey: {
          type: 'boolean',
          description: 'Whether API key authentication is needed'
        }
      }
    },
    {
      type: 'analyze_special_features',
      description: 'Analyze special features like real-time, file handling, etc.',
      inputs: ['requirements_text', 'frontend_features', 'backend_features'],
      outputs: ['special_features'],
      parameters: {
        realtime: {
          type: 'boolean',
          description: 'Whether real-time features are needed'
        },
        fileHandling: {
          type: 'boolean',
          description: 'Whether file upload/download is needed'
        },
        notifications: {
          type: 'boolean',
          description: 'Whether notifications are required'
        }
      }
    },
    {
      type: 'analyze_api_interface',
      description: 'Analyze API interface requirements',
      inputs: ['backend_features', 'frontend_features'],
      outputs: ['api_interface'],
      parameters: {
        endpoints: {
          type: 'array',
          description: 'List of required API endpoints'
        },
        versioning: {
          type: 'boolean',
          description: 'Whether API versioning is needed'
        },
        rateLimiting: {
          type: 'boolean',
          description: 'Whether rate limiting is required'
        }
      }
    },
    {
      type: 'suggest_architecture',
      description: 'Suggest optimal architecture based on analysis',
      inputs: ['project_type', 'complexity_level', 'frontend_features', 'backend_features'],
      outputs: ['architecture_suggestion'],
      parameters: {
        pattern: {
          type: 'string',
          enum: ['simple', 'modular', 'layered'],
          description: 'Recommended architecture pattern'
        },
        structure: {
          type: 'object',
          description: 'Suggested file/directory structure'
        }
      }
    },
    {
      type: 'generate_analysis_summary',
      description: 'Generate a summary of the analysis results',
      inputs: ['project_type', 'complexity_level', 'frontend_features', 'backend_features', 'security_analysis'],
      outputs: ['summary_text'],
      parameters: {
        summary: {
          type: 'string',
          description: 'Human-readable summary of the analysis'
        }
      }
    },
    {
      type: 'validate_analysis',
      description: 'Validate the completeness and consistency of analysis',
      inputs: ['project_type', 'complexity_level', 'architecture_suggestion', 'summary_text'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the analysis is valid'
        },
        errors: {
          type: 'array',
          description: 'List of validation errors if any'
        },
        warnings: {
          type: 'array',
          description: 'List of warnings'
        }
      }
    }
  ],
  
  constraints: [
    'Project type must be one of: frontend, backend, fullstack',
    'Complexity must be one of: low, medium, high',
    'Features must be specific and actionable',
    'Analysis must include at least one component (frontend or backend)',
    'Security requirements should be explicitly stated if authentication is needed',
    'Architecture suggestion must match the project type and complexity'
  ],
  
  examples: [
    {
      input: {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      },
      expectedOutput: {
        task: 'Create a todo list application',
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'list'],
            technologies: ['html', 'javascript', 'css']
          }
        },
        complexity: 'low',
        suggestedArchitecture: {
          pattern: 'simple',
          structure: {
            frontend: ['index.html', 'style.css', 'script.js']
          }
        }
      }
    },
    {
      input: {
        task: 'Build a REST API for user management',
        requirements: {
          backend: 'User registration, login, CRUD operations with JWT authentication'
        }
      },
      expectedOutput: {
        task: 'Build a REST API for user management',
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'crud', 'authentication'],
            technologies: ['nodejs', 'express'],
            storage: 'mongodb'
          }
        },
        complexity: 'medium',
        security: {
          authentication: true,
          method: 'jwt'
        },
        apiInterface: {
          endpoints: ['/auth', '/users']
        }
      }
    }
  ],
  
  mockResponses: {
    'simple-frontend': {
      task: 'Create a todo list application',
      projectType: 'frontend',
      components: {
        frontend: {
          features: ['form', 'list'],
          technologies: ['html', 'javascript', 'css']
        }
      },
      complexity: 'low',
      suggestedArchitecture: {
        pattern: 'simple',
        structure: {
          frontend: ['index.html', 'style.css', 'script.js']
        }
      },
      summary: 'Project Type: frontend\\nComplexity: low complexity\\nFrontend: form, list',
      timestamp: 1234567890,
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: 1234567890,
        mockScenario: 'simple-frontend'
      }
    },
    'backend-api': {
      task: 'Build a REST API for user management',
      projectType: 'backend',
      components: {
        backend: {
          features: ['api', 'crud', 'authentication'],
          technologies: ['nodejs', 'express'],
          storage: 'mongodb'
        }
      },
      complexity: 'medium',
      security: {
        authentication: true,
        method: 'jwt'
      },
      apiInterface: {
        endpoints: ['/auth', '/users']
      },
      summary: 'Project Type: backend\\nComplexity: medium complexity\\nBackend: api, crud, authentication',
      timestamp: 1234567890,
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: 1234567890,
        mockScenario: 'backend-api'
      }
    },
    'fullstack-complex': {
      task: 'Create a full-stack e-commerce application',
      projectType: 'fullstack',
      components: {
        frontend: {
          features: ['product-catalog', 'shopping-cart', 'user-authentication'],
          technologies: ['html', 'javascript', 'css'],
          uiComponents: ['navbar', 'product-card', 'cart-modal']
        },
        backend: {
          features: ['api', 'crud', 'authentication', 'payments'],
          technologies: ['nodejs', 'express'],
          storage: 'mongodb'
        }
      },
      complexity: 'high',
      security: {
        authentication: true,
        method: 'jwt'
      },
      apiInterface: {
        endpoints: ['/auth', '/products', '/cart', '/orders', '/payments']
      },
      summary: 'Project Type: fullstack\\nComplexity: high complexity\\nFrontend: product-catalog, shopping-cart, user-authentication\\nBackend: api, crud, authentication, payments',
      timestamp: 1234567890,
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: 1234567890,
        mockScenario: 'fullstack-complex'
      }
    }
  }
};