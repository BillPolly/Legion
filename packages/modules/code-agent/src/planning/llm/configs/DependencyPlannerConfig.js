/**
 * DependencyPlannerConfig - Configuration for dependency analysis and file ordering
 * 
 * Defines the allowable actions and constraints for determining optimal file creation
 * order based on dependencies and avoiding circular dependencies.
 */

export const DependencyPlannerConfig = {
  name: 'DependencyPlanner',
  description: 'Plans file dependencies and creation order for optimal build process',
  
  allowableActions: [
    {
      type: 'analyze_file_type',
      description: 'Analyze file type and its typical dependencies',
      inputs: ['file_name', 'file_path'],
      outputs: ['file_type_analysis'],
      parameters: {
        fileName: {
          type: 'string',
          description: 'Name of the file being analyzed'
        },
        fileType: {
          type: 'string',
          enum: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware', 'controllers', 'components', 'application', 'tests'],
          description: 'Categorized file type'
        },
        priority: {
          type: 'number',
          description: 'Priority level (1-9, lower is higher priority)'
        },
        dependencies: {
          type: 'array',
          description: 'List of file types this file typically depends on'
        }
      }
    },
    {
      type: 'detect_dependency',
      description: 'Detect a dependency relationship between files',
      inputs: ['source_file', 'target_file', 'dependency_analysis'],
      outputs: ['dependency_relationship'],
      parameters: {
        from: {
          type: 'string',
          description: 'Source file that depends on target'
        },
        to: {
          type: 'string',
          description: 'Target file that is depended upon'
        },
        type: {
          type: 'string',
          enum: ['import', 'require', 'reference', 'inheritance', 'composition'],
          description: 'Type of dependency relationship'
        },
        strength: {
          type: 'string',
          enum: ['hard', 'soft', 'optional'],
          description: 'Strength of the dependency'
        }
      }
    },
    {
      type: 'order_files',
      description: 'Order files based on their dependencies',
      inputs: ['file_list', 'dependency_relationships'],
      outputs: ['ordered_file_list'],
      parameters: {
        order: {
          type: 'array',
          description: 'List of files in dependency order'
        },
        layers: {
          type: 'array',
          description: 'Files grouped by dependency layers'
        }
      }
    },
    {
      type: 'detect_circular_dependency',
      description: 'Detect circular dependencies in the file structure',
      inputs: ['dependency_relationships'],
      outputs: ['circular_dependency_analysis'],
      parameters: {
        hasCircularDependency: {
          type: 'boolean',
          description: 'Whether circular dependencies were detected'
        },
        cycles: {
          type: 'array',
          description: 'List of circular dependency cycles'
        },
        affectedFiles: {
          type: 'array',
          description: 'Files involved in circular dependencies'
        }
      }
    },
    {
      type: 'resolve_dependency',
      description: 'Resolve or record a dependency relationship',
      inputs: ['dependency_conflict', 'resolution_strategy'],
      outputs: ['resolved_dependency'],
      parameters: {
        from: {
          type: 'string',
          description: 'Source file in dependency'
        },
        to: {
          type: 'string',
          description: 'Target file in dependency'
        },
        resolutionStrategy: {
          type: 'string',
          enum: ['reorder', 'split', 'merge', 'abstract'],
          description: 'Strategy used to resolve dependency'
        }
      }
    },
    {
      type: 'optimize_creation_order',
      description: 'Optimize file creation order for parallel processing',
      inputs: ['dependency_order', 'parallelization_requirements'],
      outputs: ['optimized_order'],
      parameters: {
        parallelGroups: {
          type: 'array',
          description: 'Groups of files that can be created in parallel'
        },
        criticalPath: {
          type: 'array',
          description: 'Critical path files that must be created first'
        }
      }
    },
    {
      type: 'validate_dependencies',
      description: 'Validate the dependency structure for consistency',
      inputs: ['dependency_structure', 'project_requirements'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the dependency structure is valid'
        },
        errors: {
          type: 'array',
          description: 'List of dependency errors'
        },
        warnings: {
          type: 'array',
          description: 'List of dependency warnings'
        }
      }
    },
    {
      type: 'generate_dependency_graph',
      description: 'Generate a visual representation of dependencies',
      inputs: ['dependency_relationships'],
      outputs: ['dependency_graph'],
      parameters: {
        nodes: {
          type: 'array',
          description: 'List of file nodes in the graph'
        },
        edges: {
          type: 'array',
          description: 'List of dependency edges'
        },
        clusters: {
          type: 'array',
          description: 'Logical groupings of related files'
        }
      }
    },
    {
      type: 'detect_conflict',
      description: 'Detect conflicts in the dependency structure',
      inputs: ['dependency_relationships', 'file_constraints'],
      outputs: ['conflict_analysis'],
      parameters: {
        conflictType: {
          type: 'string',
          enum: ['circular', 'missing', 'version', 'compatibility'],
          description: 'Type of conflict detected'
        },
        description: {
          type: 'string',
          description: 'Description of the conflict'
        },
        files: {
          type: 'array',
          description: 'Files involved in the conflict'
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity of the conflict'
        }
      }
    },
    {
      type: 'suggest_resolution',
      description: 'Suggest resolution strategies for dependency conflicts',
      inputs: ['conflict_analysis', 'project_constraints'],
      outputs: ['resolution_suggestions'],
      parameters: {
        strategy: {
          type: 'string',
          enum: ['refactor', 'abstract', 'merge', 'split', 'reorder'],
          description: 'Suggested resolution strategy'
        },
        steps: {
          type: 'array',
          description: 'Steps to implement the resolution'
        },
        impact: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Impact of the resolution on the project'
        }
      }
    }
  ],
  
  constraints: [
    'Configuration files must be created before all other files',
    'Type definitions must be created before files that use them',
    'Utilities and helpers must be created before files that import them',
    'Models must be created before services that use them',
    'Services must be created before controllers that use them',
    'Main application files must be created after all dependencies',
    'Test files must be created after the files they test',
    'No circular dependencies are allowed',
    'Maximum dependency depth of 20 levels',
    'Files in the same layer can be created in parallel'
  ],
  
  fileTypePatterns: {
    configuration: {
      patterns: ['package.json', '.env*', 'tsconfig.json', '.eslintrc*', 'jest.config*', 'docker*'],
      priority: 1,
      dependencies: []
    },
    types: {
      patterns: ['*.d.ts', 'types/*', 'interfaces/*', '*types.js'],
      priority: 2,
      dependencies: ['configuration']
    },
    utilities: {
      patterns: ['utils/*', 'helpers/*', 'lib/*', 'common/*'],
      priority: 3,
      dependencies: ['configuration', 'types']
    },
    models: {
      patterns: ['models/*', 'schemas/*', 'entities/*'],
      priority: 4,
      dependencies: ['configuration', 'types', 'utilities']
    },
    services: {
      patterns: ['services/*', 'repositories/*', 'dao/*'],
      priority: 5,
      dependencies: ['configuration', 'types', 'utilities', 'models']
    },
    middleware: {
      patterns: ['middleware/*', 'guards/*', 'interceptors/*'],
      priority: 6,
      dependencies: ['configuration', 'types', 'utilities', 'services']
    },
    controllers: {
      patterns: ['controllers/*', 'routes/*', 'handlers/*'],
      priority: 7,
      dependencies: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware']
    },
    components: {
      patterns: ['components/*', 'views/*', 'pages/*'],
      priority: 7,
      dependencies: ['configuration', 'types', 'utilities', 'services']
    },
    application: {
      patterns: ['server.js', 'app.js', 'index.js', 'main.js', 'index.html'],
      priority: 8,
      dependencies: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware', 'controllers', 'components']
    },
    tests: {
      patterns: ['*.test.js', '*.spec.js', '__tests__/*', 'tests/*'],
      priority: 9,
      dependencies: ['application']
    }
  },
  
  examples: [
    {
      input: {
        structure: {
          files: ['package.json', 'server.js', 'models/User.js', 'routes/users.js', 'utils/validation.js']
        },
        analysis: {
          projectType: 'backend',
          complexity: 'medium'
        }
      },
      expectedOutput: {
        creationOrder: ['package.json', 'utils/validation.js', 'models/User.js', 'routes/users.js', 'server.js'],
        dependencies: {
          'server.js': ['routes/users.js'],
          'routes/users.js': ['models/User.js', 'utils/validation.js'],
          'models/User.js': ['utils/validation.js']
        },
        conflicts: [],
        isValid: true
      }
    }
  ],
  
  mockResponses: {
    'simple-backend': {
      creationOrder: ['package.json', 'server.js'],
      dependencies: {},
      conflicts: [],
      isValid: true,
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: 1234567890,
        totalFiles: 2,
        mockScenario: 'simple-backend'
      }
    },
    'modular-backend': {
      creationOrder: [
        'package.json',
        '.env.example',
        'utils/validation.js',
        'models/User.js',
        'routes/users.js',
        'middleware/auth.js',
        'server.js'
      ],
      dependencies: {
        'server.js': ['routes/users.js', 'middleware/auth.js'],
        'routes/users.js': ['models/User.js', 'middleware/auth.js'],
        'models/User.js': ['utils/validation.js'],
        'middleware/auth.js': ['utils/validation.js']
      },
      conflicts: [],
      isValid: true,
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: 1234567890,
        totalFiles: 7,
        mockScenario: 'modular-backend'
      }
    },
    'complex-fullstack': {
      creationOrder: [
        'package.json',
        'tsconfig.json',
        '.env.example',
        'shared/types.ts',
        'shared/utils.ts',
        'backend/models/User.ts',
        'backend/services/UserService.ts',
        'backend/middleware/auth.ts',
        'backend/controllers/UserController.ts',
        'backend/routes/users.ts',
        'backend/server.ts',
        'frontend/services/api.ts',
        'frontend/components/UserList.tsx',
        'frontend/pages/Users.tsx',
        'frontend/index.html'
      ],
      dependencies: {
        'backend/server.ts': ['backend/routes/users.ts'],
        'backend/routes/users.ts': ['backend/controllers/UserController.ts'],
        'backend/controllers/UserController.ts': ['backend/services/UserService.ts', 'backend/middleware/auth.ts'],
        'backend/services/UserService.ts': ['backend/models/User.ts'],
        'backend/models/User.ts': ['shared/types.ts', 'shared/utils.ts'],
        'frontend/pages/Users.tsx': ['frontend/components/UserList.tsx'],
        'frontend/components/UserList.tsx': ['frontend/services/api.ts'],
        'frontend/services/api.ts': ['shared/types.ts']
      },
      conflicts: [],
      isValid: true,
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: 1234567890,
        totalFiles: 15,
        mockScenario: 'complex-fullstack'
      }
    }
  }
};