/**
 * DirectoryPlannerConfig - Configuration for directory structure planning
 * 
 * Defines the allowable actions and constraints for creating optimal directory
 * structures based on project requirements and complexity.
 */

export const DirectoryPlannerConfig = {
  name: 'DirectoryPlanner',
  description: 'Plans project directory structures based on requirements and complexity',
  
  allowableActions: [
    {
      type: 'create_directory',
      description: 'Create a directory in the project structure',
      inputs: ['project_structure', 'directory_requirements'],
      outputs: ['updated_structure'],
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the directory to create'
        },
        path: {
          type: 'string',
          description: 'Path where the directory should be created'
        },
        description: {
          type: 'string',
          description: 'Description of the directory purpose'
        },
        required: {
          type: 'boolean',
          description: 'Whether this directory is required'
        }
      }
    },
    {
      type: 'create_file',
      description: 'Create a file in the project structure',
      inputs: ['project_structure', 'file_requirements'],
      outputs: ['updated_structure'],
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the file to create'
        },
        path: {
          type: 'string',
          description: 'Path where the file should be created'
        },
        type: {
          type: 'string',
          enum: ['configuration', 'source', 'test', 'documentation'],
          description: 'Type of file being created'
        },
        required: {
          type: 'boolean',
          description: 'Whether this file is required'
        }
      }
    },
    {
      type: 'apply_template',
      description: 'Apply a predefined template structure',
      inputs: ['project_type', 'complexity_level'],
      outputs: ['template_structure'],
      parameters: {
        template: {
          type: 'object',
          description: 'Template structure to apply',
          properties: {
            directories: {
              type: 'array',
              description: 'List of directories in the template'
            },
            files: {
              type: 'array',
              description: 'List of files in the template'
            }
          }
        },
        templateType: {
          type: 'string',
          enum: ['simple', 'modular', 'layered'],
          description: 'Type of template being applied'
        }
      }
    },
    {
      type: 'add_feature_directories',
      description: 'Add directories specific to detected features',
      inputs: ['features_list', 'project_type'],
      outputs: ['feature_directories'],
      parameters: {
        feature: {
          type: 'string',
          description: 'Feature requiring directories'
        },
        directories: {
          type: 'array',
          description: 'List of directories to add for this feature'
        }
      }
    },
    {
      type: 'add_technology_structure',
      description: 'Add structure specific to technologies used',
      inputs: ['technologies_list', 'project_type'],
      outputs: ['technology_structure'],
      parameters: {
        technology: {
          type: 'string',
          description: 'Technology requiring specific structure'
        },
        directories: {
          type: 'array',
          description: 'Directories needed for this technology'
        },
        files: {
          type: 'array',
          description: 'Files needed for this technology'
        }
      }
    },
    {
      type: 'add_configuration_files',
      description: 'Add configuration files based on project needs',
      inputs: ['project_type', 'technologies_list', 'features_list'],
      outputs: ['configuration_files'],
      parameters: {
        configType: {
          type: 'string',
          enum: ['package', 'environment', 'eslint', 'jest', 'docker'],
          description: 'Type of configuration file'
        },
        fileName: {
          type: 'string',
          description: 'Name of the configuration file'
        },
        required: {
          type: 'boolean',
          description: 'Whether this configuration is required'
        }
      }
    },
    {
      type: 'add_common_files',
      description: 'Add common files like README, gitignore, etc.',
      inputs: ['project_type', 'complexity_level'],
      outputs: ['common_files'],
      parameters: {
        fileType: {
          type: 'string',
          enum: ['readme', 'gitignore', 'license', 'changelog'],
          description: 'Type of common file'
        },
        fileName: {
          type: 'string',
          description: 'Name of the common file'
        }
      }
    },
    {
      type: 'validate_structure',
      description: 'Validate the directory structure for completeness and consistency',
      inputs: ['directory_structure', 'project_requirements'],
      outputs: ['validation_result'],
      parameters: {
        isValid: {
          type: 'boolean',
          description: 'Whether the structure is valid'
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
          description: 'List of suggestions for improvement'
        }
      }
    },
    {
      type: 'optimize_structure',
      description: 'Optimize the directory structure for maintainability',
      inputs: ['directory_structure', 'project_type'],
      outputs: ['optimized_structure'],
      parameters: {
        optimization: {
          type: 'string',
          enum: ['reduce_depth', 'group_related', 'separate_concerns'],
          description: 'Type of optimization applied'
        },
        changes: {
          type: 'array',
          description: 'List of changes made during optimization'
        }
      }
    },
    {
      type: 'generate_descriptions',
      description: 'Generate descriptions for directories and their purposes',
      inputs: ['directory_structure', 'project_type'],
      outputs: ['directory_descriptions'],
      parameters: {
        directoryName: {
          type: 'string',
          description: 'Name of the directory'
        },
        description: {
          type: 'string',
          description: 'Description of the directory purpose'
        }
      }
    }
  ],
  
  constraints: [
    'Directory names must be valid filesystem names',
    'Structure must be appropriate for the project type (frontend, backend, fullstack)',
    'Required files must be present (index.html for frontend, package.json for Node.js)',
    'No duplicate directories or files',
    'Directory depth should be reasonable (max 5 levels)',
    'Configuration files must match the technologies used',
    'Test directories should be included for medium and high complexity projects'
  ],
  
  examples: [
    {
      input: {
        projectType: 'frontend',
        complexity: 'low',
        features: ['form', 'list'],
        technologies: ['html', 'javascript', 'css']
      },
      expectedOutput: {
        directories: ['.'],
        files: ['index.html', 'style.css', 'script.js', 'README.md', '.gitignore'],
        descriptions: {
          '.': 'Root directory for simple frontend project'
        }
      }
    },
    {
      input: {
        projectType: 'backend',
        complexity: 'medium',
        features: ['api', 'crud', 'authentication'],
        technologies: ['nodejs', 'express']
      },
      expectedOutput: {
        directories: ['routes', 'models', 'utils', 'middleware'],
        files: ['server.js', 'package.json', '.env.example', 'README.md', '.gitignore'],
        descriptions: {
          'routes': 'API route definitions',
          'models': 'Data models and schemas',
          'utils': 'Utility functions and helpers',
          'middleware': 'Express middleware functions'
        }
      }
    }
  ],
  
  templates: {
    frontend: {
      simple: {
        directories: ['.'],
        files: ['index.html', 'style.css', 'script.js']
      },
      modular: {
        directories: ['css', 'js', 'components', 'services'],
        files: ['index.html']
      },
      layered: {
        directories: ['assets', 'components', 'views', 'services', 'utils', 'config'],
        files: ['index.html']
      }
    },
    backend: {
      simple: {
        directories: ['.'],
        files: ['server.js', 'package.json']
      },
      modular: {
        directories: ['routes', 'models', 'utils'],
        files: ['server.js', 'package.json']
      },
      layered: {
        directories: ['controllers', 'services', 'models', 'repositories', 'middleware', 'utils', 'config'],
        files: ['server.js', 'package.json']
      }
    },
    fullstack: {
      simple: {
        directories: ['frontend', 'backend'],
        files: ['package.json']
      },
      modular: {
        directories: ['frontend', 'backend', 'shared'],
        files: ['package.json']
      },
      layered: {
        directories: ['frontend', 'backend', 'shared', 'docs', 'scripts'],
        files: ['package.json']
      }
    }
  },
  
  mockResponses: {
    'simple-frontend': {
      directories: ['.'],
      files: ['index.html', 'style.css', 'script.js', 'README.md', '.gitignore'],
      descriptions: {
        '.': 'Root directory for simple frontend project'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: 1234567890,
        projectType: 'frontend',
        complexity: 'low',
        mockScenario: 'simple-frontend'
      }
    },
    'modular-backend': {
      directories: ['routes', 'models', 'utils', 'middleware'],
      files: ['server.js', 'package.json', '.env.example', '.eslintrc.js', 'README.md', '.gitignore'],
      descriptions: {
        'routes': 'API route definitions',
        'models': 'Data models and schemas',
        'utils': 'Utility functions and helpers',
        'middleware': 'Express middleware functions'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: 1234567890,
        projectType: 'backend',
        complexity: 'medium',
        mockScenario: 'modular-backend'
      }
    },
    'layered-fullstack': {
      directories: ['frontend', 'backend', 'shared', 'docs', 'scripts', 'tests'],
      files: ['package.json', 'README.md', '.gitignore', 'docker-compose.yml'],
      descriptions: {
        'frontend': 'Frontend application code',
        'backend': 'Backend server code',
        'shared': 'Shared utilities and types',
        'docs': 'Project documentation',
        'scripts': 'Build and deployment scripts',
        'tests': 'Test files and test utilities'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: 1234567890,
        projectType: 'fullstack',
        complexity: 'high',
        mockScenario: 'layered-fullstack'
      }
    }
  }
};