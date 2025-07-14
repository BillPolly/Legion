/**
 * DependencyPlannerConfig - Configuration for LLM-based dependency planning
 * 
 * This configuration defines the prompt template, response schema, and examples
 * for determining optimal file creation order based on dependencies.
 */

export const DependencyPlannerConfig = {
  name: 'DependencyPlanner',
  description: 'Plans file dependencies and creation order based on project structure and analysis',
  
  // Template for generating prompts
  promptTemplate: `You are an expert software architect specializing in dependency analysis and build optimization. Your task is to analyze file dependencies and determine the optimal creation order for project files.

## Project Structure
{structure}

## Project Analysis
{analysis}

## Dependency Planning Instructions

1. **Analyze File Types and Dependencies**
   - Configuration files (package.json, .env, tsconfig.json) - highest priority
   - Type definitions and interfaces - early creation
   - Utilities and helpers - foundation components
   - Models and schemas - data structures
   - Services and repositories - business logic
   - Middleware and guards - request processing
   - Controllers and routes - API endpoints
   - Components and views - UI elements
   - Main application files - entry points
   - Tests - lowest priority (depend on everything)

2. **Dependency Rules**
   - Configuration files have no dependencies
   - All other files depend on configuration files
   - Main application files depend on almost everything
   - Test files depend on the files they test
   - Utilities are used by many other files
   - Models are used by services and controllers
   - Services are used by controllers and components

3. **Creation Order Optimization**
   - Files with no dependencies first
   - Files with fewer dependencies before those with more
   - Group files that can be created in parallel
   - Detect and avoid circular dependencies

4. **Parallel Execution Groups**
   - Group files that have the same dependencies
   - Files in the same group can be created simultaneously
   - Each group depends on completion of previous groups

## File Type Classification Patterns

**Configuration:** package.json, .env*, tsconfig.json, .eslintrc*, jest.config*, docker*
**Types:** *.d.ts, types/*, interfaces/*, *types.js
**Utilities:** utils/*, helpers/*, lib/*, common/*
**Models:** models/*, schemas/*, entities/*
**Services:** services/*, repositories/*, dao/*
**Middleware:** middleware/*, guards/*, interceptors/*
**Controllers:** controllers/*, routes/*, handlers/*
**Components:** components/*, views/*, pages/*
**Application:** server.js, app.js, index.js, main.js, index.html
**Tests:** *.test.js, *.spec.js, __tests__/*, tests/*

## Response Format
Respond with a JSON object that exactly matches this structure:

{
  "files": {
    "filename.ext": {
      "dependencies": ["array of files this file depends on"],
      "dependencyTypes": {
        "dependency.ext": "configuration|utility|model|service|component"
      },
      "fileType": "configuration|types|utilities|models|services|middleware|controllers|components|application|tests",
      "priority": 1-9,
      "canRunInParallel": true|false
    }
  },
  "creationOrder": ["ordered array of all files"],
  "parallelGroups": [
    {
      "group": 1,
      "files": ["files that can be created in parallel"],
      "dependencies": ["groups this group depends on"]
    }
  ],
  "metadata": {
    "planner": "DependencyPlanner",
    "plannedAt": 1234567890,
    "totalFiles": 5,
    "projectType": "frontend|backend|fullstack"
  }
}

## Example Dependency Plans

**Simple Frontend:**
```json
{
  "files": {
    "index.html": {
      "dependencies": [],
      "dependencyTypes": {},
      "fileType": "application",
      "priority": 8,
      "canRunInParallel": false
    },
    "style.css": {
      "dependencies": [],
      "dependencyTypes": {},
      "fileType": "utilities",
      "priority": 3,
      "canRunInParallel": true
    },
    "script.js": {
      "dependencies": ["index.html", "style.css"],
      "dependencyTypes": {
        "index.html": "application",
        "style.css": "utility"
      },
      "fileType": "application",
      "priority": 8,
      "canRunInParallel": false
    }
  },
  "creationOrder": ["style.css", "index.html", "script.js"],
  "parallelGroups": [
    {
      "group": 1,
      "files": ["style.css", "index.html"],
      "dependencies": []
    },
    {
      "group": 2,
      "files": ["script.js"],
      "dependencies": [1]
    }
  ]
}
```

**Backend with Configuration:**
```json
{
  "files": {
    "package.json": {
      "dependencies": [],
      "dependencyTypes": {},
      "fileType": "configuration",
      "priority": 1,
      "canRunInParallel": false
    },
    "utils/helpers.js": {
      "dependencies": ["package.json"],
      "dependencyTypes": {
        "package.json": "configuration"
      },
      "fileType": "utilities",
      "priority": 3,
      "canRunInParallel": true
    },
    "models/User.js": {
      "dependencies": ["package.json", "utils/helpers.js"],
      "dependencyTypes": {
        "package.json": "configuration",
        "utils/helpers.js": "utility"
      },
      "fileType": "models",
      "priority": 4,
      "canRunInParallel": true
    },
    "server.js": {
      "dependencies": ["package.json", "utils/helpers.js", "models/User.js"],
      "dependencyTypes": {
        "package.json": "configuration",
        "utils/helpers.js": "utility",
        "models/User.js": "model"
      },
      "fileType": "application",
      "priority": 8,
      "canRunInParallel": false
    }
  },
  "creationOrder": ["package.json", "utils/helpers.js", "models/User.js", "server.js"]
}
```

Please analyze the provided structure and create an optimal dependency plan with creation order and parallel execution groups.`,

  // Schema for response validation
  responseSchema: {
    type: 'object',
    required: ['files', 'creationOrder', 'metadata'],
    properties: {
      files: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['dependencies', 'fileType', 'priority'],
          properties: {
            dependencies: { type: 'array', items: { type: 'string' } },
            dependencyTypes: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            fileType: { 
              type: 'string',
              enum: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware', 'controllers', 'components', 'application', 'tests']
            },
            priority: { type: 'number', minimum: 1, maximum: 9 },
            canRunInParallel: { type: 'boolean' }
          }
        }
      },
      creationOrder: { type: 'array', items: { type: 'string' } },
      parallelGroups: {
        type: 'array',
        items: {
          type: 'object',
          required: ['group', 'files'],
          properties: {
            group: { type: 'number' },
            files: { type: 'array', items: { type: 'string' } },
            dependencies: { type: 'array', items: { type: 'number' } }
          }
        }
      },
      metadata: {
        type: 'object',
        required: ['planner', 'plannedAt', 'totalFiles', 'projectType'],
        properties: {
          planner: { type: 'string' },
          plannedAt: { type: 'number' },
          totalFiles: { type: 'number' },
          projectType: { type: 'string', enum: ['frontend', 'backend', 'fullstack'] }
        }
      }
    }
  },

  // Example inputs and expected outputs for testing
  examples: [
    {
      input: {
        structure: {
          files: ['index.html', 'style.css', 'script.js'],
          directories: ['.']
        },
        analysis: {
          projectType: 'frontend',
          components: {
            frontend: {
              features: ['form'],
              technologies: ['html', 'css', 'javascript']
            }
          }
        }
      },
      expectedOutput: {
        files: {
          'index.html': {
            dependencies: [],
            dependencyTypes: {},
            fileType: 'application',
            priority: 8,
            canRunInParallel: false
          },
          'style.css': {
            dependencies: [],
            dependencyTypes: {},
            fileType: 'utilities',
            priority: 3,
            canRunInParallel: true
          },
          'script.js': {
            dependencies: ['index.html', 'style.css'],
            dependencyTypes: {
              'index.html': 'application',
              'style.css': 'utility'
            },
            fileType: 'application',
            priority: 8,
            canRunInParallel: false
          }
        },
        creationOrder: ['style.css', 'index.html', 'script.js'],
        metadata: {
          planner: 'DependencyPlanner',
          plannedAt: 1234567890,
          totalFiles: 3,
          projectType: 'frontend'
        }
      }
    }
  ],

  // Mock responses for testing
  mockResponses: {
    'simple-frontend': {
      files: {
        'index.html': {
          dependencies: [],
          dependencyTypes: {},
          fileType: 'application',
          priority: 8,
          canRunInParallel: false
        },
        'style.css': {
          dependencies: [],
          dependencyTypes: {},
          fileType: 'utilities',
          priority: 3,
          canRunInParallel: true
        },
        'script.js': {
          dependencies: ['index.html', 'style.css'],
          dependencyTypes: {
            'index.html': 'application',
            'style.css': 'utility'
          },
          fileType: 'application',
          priority: 8,
          canRunInParallel: false
        }
      },
      creationOrder: ['style.css', 'index.html', 'script.js'],
      parallelGroups: [
        {
          group: 1,
          files: ['style.css', 'index.html'],
          dependencies: []
        },
        {
          group: 2,
          files: ['script.js'],
          dependencies: [1]
        }
      ],
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: Date.now(),
        totalFiles: 3,
        projectType: 'frontend'
      }
    },
    'backend-with-config': {
      files: {
        'package.json': {
          dependencies: [],
          dependencyTypes: {},
          fileType: 'configuration',
          priority: 1,
          canRunInParallel: false
        },
        'utils/helpers.js': {
          dependencies: ['package.json'],
          dependencyTypes: {
            'package.json': 'configuration'
          },
          fileType: 'utilities',
          priority: 3,
          canRunInParallel: true
        },
        'server.js': {
          dependencies: ['package.json', 'utils/helpers.js'],
          dependencyTypes: {
            'package.json': 'configuration',
            'utils/helpers.js': 'utility'
          },
          fileType: 'application',
          priority: 8,
          canRunInParallel: false
        }
      },
      creationOrder: ['package.json', 'utils/helpers.js', 'server.js'],
      parallelGroups: [
        {
          group: 1,
          files: ['package.json'],
          dependencies: []
        },
        {
          group: 2,
          files: ['utils/helpers.js'],
          dependencies: [1]
        },
        {
          group: 3,
          files: ['server.js'],
          dependencies: [2]
        }
      ],
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: Date.now(),
        totalFiles: 3,
        projectType: 'backend'
      }
    }
  },

  // Settings for LLM generation
  settings: {
    temperature: 0.1, // Low temperature for consistent outputs
    maxTokens: 3000, // Higher token limit for complex dependency analysis
    systemPrompt: 'You are a precise dependency analyzer. Always respond with valid JSON matching the exact schema provided.'
  }
};