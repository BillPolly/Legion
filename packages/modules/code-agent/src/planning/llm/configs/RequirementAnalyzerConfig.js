/**
 * RequirementAnalyzerConfig - SIMPLIFIED Configuration for requirement analysis planning
 * 
 * This is a simplified version with only essential actions to prevent LLM overload.
 * Original complex version backed up as RequirementAnalyzerConfig.js.backup
 */

export const RequirementAnalyzerConfig = {
  name: 'RequirementAnalyzer',
  description: 'Analyzes project requirements to create actionable development plans - SIMPLIFIED VERSION',
  
  allowableActions: [
    {
      type: 'parse_requirements',
      description: 'Parse and structure the raw requirements',
      inputs: ['requirements_text', 'frontend_requirements', 'backend_requirements'],
      outputs: ['parsed_requirements'],
      parameters: {
        projectName: {
          type: 'string',
          description: 'The project name'
        },
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
      inputs: ['parsed_requirements'],
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
      description: 'Analyze project complexity level',
      inputs: ['parsed_requirements', 'project_type'],
      outputs: ['complexity_analysis'],
      parameters: {
        complexity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'The determined complexity level'
        }
      }
    },
    {
      type: 'extract_frontend_features',
      description: 'Extract frontend-specific features',
      inputs: ['parsed_requirements'],
      outputs: ['frontend_features'],
      parameters: {
        features: {
          type: 'array',
          description: 'Frontend feature list'
        }
      }
    },
    {
      type: 'extract_backend_features', 
      description: 'Extract backend-specific features',
      inputs: ['parsed_requirements'],
      outputs: ['backend_features'],
      parameters: {
        features: {
          type: 'array',
          description: 'Backend feature list'
        }
      }
    },
    {
      type: 'generate_summary',
      description: 'Generate final analysis summary',
      inputs: ['parsed_requirements', 'project_type', 'complexity_analysis'],
      outputs: ['final_analysis'],
      parameters: {
        summary: {
          type: 'string',
          description: 'Analysis summary'
        }
      }
    }
  ],
  
  constraints: [
    'Keep requirements analysis focused and actionable',
    'Identify clear dependencies and sequence',
    'Classify requirements by complexity'
  ],
  
  examples: [
    {
      input: {
        requirements: 'Build a todo app with user authentication',
        projectType: 'fullstack'
      },
      expectedOutput: {
        type: 'final_analysis',
        analysis: 'Frontend: React app with todo CRUD, Backend: Auth + API, Database: User + Todo tables'
      }
    }
  ],
  
  mockResponses: {
    'simple-frontend': {
      task: 'Frontend-only app',
      projectType: 'frontend',
      components: ['UI components', 'State management'],
      complexity: 'low',
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: Date.now(),
        mockScenario: 'simple-frontend'
      }
    },
    'backend-api': {
      task: 'API backend service',
      projectType: 'backend',
      components: ['REST endpoints', 'Database models'],
      complexity: 'medium',
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: Date.now(),
        mockScenario: 'backend-api'
      }
    },
    parse_requirements: {
      parsed_requirements: {
        frontend: ['Todo list UI', 'User authentication'],
        backend: ['REST API', 'User management', 'Todo CRUD'],
        database: ['Users table', 'Todos table']
      },
      metadata: {
        planner: 'RequirementAnalyzer',
        plannedAt: Date.now(),
        mockScenario: 'parse_requirements'
      }
    }
  },
  
  requiredOutputs: ['final_analysis'],
  maxSteps: 5
};