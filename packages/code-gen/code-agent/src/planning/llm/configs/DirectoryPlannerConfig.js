/**
 * DirectoryPlannerConfig - Configuration for LLM-based directory planning
 * 
 * This configuration defines the prompt template, response schema, and examples
 * for creating optimal directory structures based on project analysis.
 */

export const DirectoryPlannerConfig = {
  name: 'DirectoryPlanner',
  description: 'Plans project directory structures based on analysis and complexity',
  
  // Template for generating prompts
  promptTemplate: `You are an expert software architect specializing in project structure design. Your task is to create optimal directory structures based on project analysis.

## Project Analysis
{analysis}

## Directory Planning Instructions
1. Analyze the project type, complexity, and features
2. Select appropriate architectural pattern (simple, modular, layered)
3. Create directories and files based on best practices
4. Include technology-specific structures
5. Add feature-specific directories
6. Include common project files (.gitignore, README.md, package.json)
7. Generate descriptions for each directory

## Architectural Patterns

**Simple Pattern (Low Complexity):**
- Minimal structure with essential files in root
- Frontend: index.html, style.css, script.js
- Backend: server.js, package.json
- Fullstack: frontend/, backend/, package.json

**Modular Pattern (Medium Complexity):**
- Organized directories by function
- Frontend: css/, js/, components/, services/
- Backend: routes/, models/, utils/
- Fullstack: frontend/, backend/, shared/

**Layered Pattern (High Complexity):**
- Full separation of concerns
- Frontend: assets/, components/, views/, services/, utils/, config/
- Backend: controllers/, services/, models/, repositories/, middleware/, utils/, config/
- Fullstack: frontend/, backend/, shared/, docs/, scripts/

## Technology-Specific Additions

**Frontend Technologies:**
- CSS: Add css/ or styles/ directory
- JavaScript: Add js/ or scripts/ directory
- Components: Add components/ directory

**Backend Technologies:**
- Node.js: Add package.json, server.js
- Express: Add routes/, middleware/ directories
- Database: Add models/, repositories/ directories

**Testing:**
- Add tests/, __tests__/, or test/ directories
- Add test configuration files

## Feature-Specific Directories

**Authentication:** Add auth/ directory
**API:** Add api/ directory  
**Documentation:** Add docs/ directory
**Configuration:** Add config/ directory
**Utilities:** Add utils/ or helpers/ directory

## Common Files
- .gitignore (version control)
- README.md (documentation)
- package.json (Node.js projects)
- LICENSE (open source projects)

## Response Format
Respond with a JSON object that exactly matches this structure:

{
  "directories": ["array of directory names"],
  "files": ["array of file names"],
  "descriptions": {
    "directoryName": "description of purpose"
  },
  "warnings": ["array of warning messages if any"],
  "isValid": true,
  "metadata": {
    "planner": "DirectoryPlanner",
    "plannedAt": 1234567890,
    "projectType": "frontend|backend|fullstack",
    "complexity": "low|medium|high",
    "pattern": "simple|modular|layered"
  }
}

## Example Structures

**Simple Frontend:**
```json
{
  "directories": ["."],
  "files": ["index.html", "style.css", "script.js", ".gitignore", "README.md"],
  "descriptions": {
    ".": "Main project directory containing all files"
  }
}
```

**Modular Backend:**
```json
{
  "directories": ["routes", "models", "utils"],
  "files": ["server.js", "package.json", ".gitignore", "README.md"],
  "descriptions": {
    "routes": "API route definitions and handlers",
    "models": "Data models and database schemas",
    "utils": "Utility functions and helpers"
  }
}
```

**Layered Fullstack:**
```json
{
  "directories": ["frontend", "backend", "shared", "docs", "scripts"],
  "files": ["package.json", ".gitignore", "README.md"],
  "descriptions": {
    "frontend": "Client-side application code",
    "backend": "Server-side application code", 
    "shared": "Code shared between frontend and backend",
    "docs": "Project documentation",
    "scripts": "Build and deployment scripts"
  }
}
```

Please analyze the provided project analysis and create an optimal directory structure following these guidelines.`,

  // Schema for response validation
  responseSchema: {
    type: 'object',
    required: ['directories', 'files', 'isValid', 'metadata'],
    properties: {
      directories: { type: 'array', items: { type: 'string' } },
      files: { type: 'array', items: { type: 'string' } },
      descriptions: {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      warnings: { type: 'array', items: { type: 'string' } },
      isValid: { type: 'boolean' },
      metadata: {
        type: 'object',
        required: ['planner', 'plannedAt', 'projectType', 'complexity'],
        properties: {
          planner: { type: 'string' },
          plannedAt: { type: 'number' },
          projectType: { type: 'string', enum: ['frontend', 'backend', 'fullstack'] },
          complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
          pattern: { type: 'string', enum: ['simple', 'modular', 'layered'] }
        }
      }
    }
  },

  // Example inputs and expected outputs for testing
  examples: [
    {
      input: {
        analysis: {
          projectType: 'frontend',
          complexity: 'low',
          components: {
            frontend: {
              features: ['form', 'list'],
              technologies: ['html', 'css', 'javascript']
            }
          }
        }
      },
      expectedOutput: {
        directories: ['.'],
        files: ['index.html', 'style.css', 'script.js', '.gitignore', 'README.md'],
        descriptions: {
          '.': 'Main project directory containing all files'
        },
        warnings: [],
        isValid: true,
        metadata: {
          planner: 'DirectoryPlanner',
          plannedAt: 1234567890,
          projectType: 'frontend',
          complexity: 'low',
          pattern: 'simple'
        }
      }
    },
    {
      input: {
        analysis: {
          projectType: 'backend',
          complexity: 'medium',
          components: {
            backend: {
              features: ['api', 'database', 'auth'],
              technologies: ['nodejs', 'express']
            }
          }
        }
      },
      expectedOutput: {
        directories: ['routes', 'models', 'utils'],
        files: ['server.js', 'package.json', '.gitignore', 'README.md'],
        descriptions: {
          routes: 'API route definitions and handlers',
          models: 'Data models and database schemas',
          utils: 'Utility functions and helpers'
        },
        warnings: [],
        isValid: true,
        metadata: {
          planner: 'DirectoryPlanner',
          plannedAt: 1234567890,
          projectType: 'backend',
          complexity: 'medium',
          pattern: 'modular'
        }
      }
    }
  ],

  // Mock responses for testing
  mockResponses: {
    'simple-frontend': {
      directories: ['.'],
      files: ['index.html', 'style.css', 'script.js', '.gitignore', 'README.md'],
      descriptions: {
        '.': 'Main project directory containing all files'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: Date.now(),
        projectType: 'frontend',
        complexity: 'low',
        pattern: 'simple'
      }
    },
    'modular-backend': {
      directories: ['routes', 'models', 'utils'],
      files: ['server.js', 'package.json', '.gitignore', 'README.md'],
      descriptions: {
        routes: 'API route definitions and handlers',
        models: 'Data models and database schemas',
        utils: 'Utility functions and helpers'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: Date.now(),
        projectType: 'backend',
        complexity: 'medium',
        pattern: 'modular'
      }
    },
    'layered-fullstack': {
      directories: ['frontend', 'backend', 'shared', 'docs', 'scripts'],
      files: ['package.json', '.gitignore', 'README.md'],
      descriptions: {
        frontend: 'Client-side application code',
        backend: 'Server-side application code',
        shared: 'Code shared between frontend and backend',
        docs: 'Project documentation',
        scripts: 'Build and deployment scripts'
      },
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: Date.now(),
        projectType: 'fullstack',
        complexity: 'high',
        pattern: 'layered'
      }
    }
  },

  // Settings for LLM generation
  settings: {
    temperature: 0.1, // Low temperature for consistent outputs
    maxTokens: 2000,
    systemPrompt: 'You are a precise software architect. Always respond with valid JSON matching the exact schema provided.'
  }
};