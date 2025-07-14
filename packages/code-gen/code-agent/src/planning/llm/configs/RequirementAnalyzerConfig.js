/**
 * RequirementAnalyzerConfig - Configuration for LLM-based requirement analysis
 * 
 * This configuration defines the prompt template, response schema, and examples
 * for converting natural language requirements into structured analysis objects.
 */

export const RequirementAnalyzerConfig = {
  name: 'RequirementAnalyzer',
  description: 'Analyzes natural language requirements and converts them to structured analysis',
  
  // Template for generating prompts
  promptTemplate: `You are an expert software requirements analyst. Your task is to analyze project requirements and convert them into structured analysis suitable for code generation.

## Task Description
{task}

## Requirements
{requirements}

## Analysis Instructions
1. Determine project type (frontend, backend, fullstack)
2. Extract features from requirements text
3. Identify technology stack needs
4. Analyze security requirements
5. Detect special features (real-time, file handling, etc.)
6. Determine complexity level (low, medium, high)
7. Suggest appropriate architecture pattern

## Feature Keywords Reference
**Frontend Features:**
- form: form, input, submit, field, validation
- list: list, display, show, table, grid
- auth: login, logout, authentication, signin, signup
- navigation: navbar, menu, navigation, sidebar, header
- ui: button, modal, dropdown, accordion, tabs, carousel
- data: chart, graph, visualization, dashboard
- media: gallery, image, video, zoom, slider

**Backend Features:**
- api: api, rest, restful, endpoint, route
- database: database, mongodb, mysql, postgres, storage
- auth: authentication, jwt, token, session, oauth
- crud: crud, create, read, update, delete
- realtime: websocket, realtime, real-time, socket, live
- file: file, upload, download, storage, filesystem

**UI Components:**
- navbar, dropdown, accordion, carousel, tabs, modal, sidebar, table, chart

## Response Format
Respond with a JSON object that exactly matches this structure:

{
  "task": "original task description",
  "projectType": "frontend|backend|fullstack",
  "components": {
    "frontend": {
      "features": ["array of features"],
      "technologies": ["html", "javascript", "css"],
      "uiComponents": ["array of UI components if any"]
    },
    "backend": {
      "features": ["array of features"],
      "technologies": ["nodejs", "express"],
      "storage": "mongodb|mysql|postgresql|file-based",
      "operations": ["create", "read", "update", "delete"]
    }
  },
  "apiInterface": {
    "endpoints": ["array of endpoints"],
    "versioning": true|false,
    "rateLimiting": true|false
  },
  "security": {
    "authentication": true|false,
    "method": "jwt|session|oauth",
    "apiKey": true|false
  },
  "features": {
    "realtime": true|false,
    "fileHandling": true|false,
    "notifications": true|false
  },
  "complexity": "low|medium|high",
  "suggestedArchitecture": {
    "pattern": "simple|modular|layered",
    "structure": {
      "frontend": ["array of files/directories"],
      "backend": ["array of files/directories"]
    }
  },
  "summary": "brief summary of the analysis",
  "timestamp": 1234567890
}

## Complexity Scoring Rules
- Low (0-4 points): Simple projects with basic features
- Medium (5-10 points): Moderate complexity with multiple features
- High (11+ points): Complex projects with advanced features

**Scoring:**
- Each frontend feature: +1 point
- Each backend feature: +1.5 points
- Authentication: +3 points
- Real-time features: +4 points
- More than 3 UI components: +2 points

## Architecture Patterns
- **Simple**: Single files (index.html, style.css, script.js, server.js)
- **Modular**: Organized directories (components/, services/, routes/, models/)
- **Layered**: Full separation (controllers/, services/, repositories/, views/)

## Example Analysis
For a "todo list application with user authentication":
- Project Type: fullstack
- Features: form, list, auth, crud, database
- Complexity: medium (form=1, list=1, auth=3, crud=1.5, database=1.5 = 8 points)
- Architecture: modular

Please analyze the provided requirements and respond with the structured JSON object.`,

  // Schema for response validation
  responseSchema: {
    type: 'object',
    required: ['task', 'projectType', 'components', 'complexity', 'timestamp'],
    properties: {
      task: { type: 'string' },
      projectType: { type: 'string', enum: ['frontend', 'backend', 'fullstack'] },
      components: {
        type: 'object',
        properties: {
          frontend: {
            type: 'object',
            properties: {
              features: { type: 'array', items: { type: 'string' } },
              technologies: { type: 'array', items: { type: 'string' } },
              uiComponents: { type: 'array', items: { type: 'string' } }
            }
          },
          backend: {
            type: 'object',
            properties: {
              features: { type: 'array', items: { type: 'string' } },
              technologies: { type: 'array', items: { type: 'string' } },
              storage: { type: 'string' },
              operations: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      apiInterface: {
        type: 'object',
        properties: {
          endpoints: { type: 'array', items: { type: 'string' } },
          versioning: { type: 'boolean' },
          rateLimiting: { type: 'boolean' }
        }
      },
      security: {
        type: 'object',
        properties: {
          authentication: { type: 'boolean' },
          method: { type: 'string' },
          apiKey: { type: 'boolean' }
        }
      },
      features: {
        type: 'object',
        properties: {
          realtime: { type: 'boolean' },
          fileHandling: { type: 'boolean' },
          notifications: { type: 'boolean' }
        }
      },
      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
      suggestedArchitecture: {
        type: 'object',
        properties: {
          pattern: { type: 'string', enum: ['simple', 'modular', 'layered'] },
          structure: {
            type: 'object',
            properties: {
              frontend: { type: 'array', items: { type: 'string' } },
              backend: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      summary: { type: 'string' },
      timestamp: { type: 'number' }
    }
  },

  // Example inputs and expected outputs for testing
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
        },
        summary: 'Project Type: frontend\nComplexity: low complexity\nFrontend: form, list',
        timestamp: 1234567890
      }
    },
    {
      input: {
        task: 'Create a blog application',
        requirements: {
          frontend: 'Article listing, article view, comment form',
          backend: 'REST API for articles and comments, authentication'
        }
      },
      expectedOutput: {
        task: 'Create a blog application',
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['listing', 'view', 'form'],
            technologies: ['html', 'javascript', 'css']
          },
          backend: {
            features: ['rest-api', 'authentication'],
            technologies: ['nodejs', 'express']
          }
        },
        apiInterface: {
          endpoints: ['/articles', '/comments']
        },
        security: {
          authentication: true
        },
        complexity: 'medium',
        suggestedArchitecture: {
          pattern: 'modular',
          structure: {
            frontend: ['index.html', 'css/', 'js/', 'components/', 'services/'],
            backend: ['server.js', 'routes/', 'models/', 'utils/', 'package.json']
          }
        },
        summary: 'Project Type: fullstack\nComplexity: medium complexity\nFrontend: listing, view, form\nBackend: rest-api, authentication\nSecurity: authentication required',
        timestamp: 1234567890
      }
    }
  ],

  // Mock responses for testing
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
      summary: 'Project Type: frontend\nComplexity: low complexity\nFrontend: form, list',
      timestamp: Date.now()
    },
    'fullstack-blog': {
      task: 'Create a blog application',
      projectType: 'fullstack',
      components: {
        frontend: {
          features: ['listing', 'view', 'form'],
          technologies: ['html', 'javascript', 'css']
        },
        backend: {
          features: ['rest-api', 'authentication'],
          technologies: ['nodejs', 'express']
        }
      },
      apiInterface: {
        endpoints: ['/articles', '/comments']
      },
      security: {
        authentication: true
      },
      complexity: 'medium',
      suggestedArchitecture: {
        pattern: 'modular',
        structure: {
          frontend: ['index.html', 'css/', 'js/', 'components/', 'services/'],
          backend: ['server.js', 'routes/', 'models/', 'utils/', 'package.json']
        }
      },
      summary: 'Project Type: fullstack\nComplexity: medium complexity\nFrontend: listing, view, form\nBackend: rest-api, authentication\nSecurity: authentication required',
      timestamp: Date.now()
    }
  },

  // Settings for LLM generation
  settings: {
    temperature: 0.1, // Low temperature for consistent outputs
    maxTokens: 2000,
    systemPrompt: 'You are a precise software requirements analyst. Always respond with valid JSON matching the exact schema provided.'
  }
};