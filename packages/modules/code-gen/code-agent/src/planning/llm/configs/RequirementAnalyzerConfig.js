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
  
  requiredOutputs: ['final_analysis'],
  maxSteps: 5
};