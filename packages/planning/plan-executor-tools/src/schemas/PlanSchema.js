/**
 * PlanSchema.js - Comprehensive JSON Schema for plan validation
 * 
 * This schema defines the complete structure of a valid plan,
 * supporting both the new inputs/outputs format and legacy parameters format.
 */

export const PlanSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Legion Plan Schema',
  description: 'Schema for Legion plan executor plans',
  type: 'object',
  
  properties: {
    // Required core fields
    id: {
      type: 'string',
      pattern: '^[a-zA-Z0-9][a-zA-Z0-9-_]*$',
      description: 'Unique identifier for the plan',
      minLength: 1,
      maxLength: 100
    },
    
    name: {
      type: 'string',
      description: 'Human-readable name for the plan',
      minLength: 1,
      maxLength: 200
    },
    
    steps: {
      type: 'array',
      description: 'Array of plan steps to execute',
      items: { $ref: '#/definitions/step' },
      minItems: 0
    },
    
    // Strongly recommended fields
    description: {
      type: 'string',
      description: 'Detailed description of what the plan does'
    },
    
    status: {
      type: 'string',
      description: 'Current status of the plan',
      enum: ['draft', 'ready', 'validated', 'executing', 'completed', 'failed', 'cancelled'],
      default: 'draft'
    },
    
    version: {
      type: 'string',
      description: 'Semantic version of the plan',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?$',
      default: '1.0.0'
    },
    
    // Metadata
    metadata: {
      type: 'object',
      description: 'Additional metadata about the plan',
      properties: {
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 timestamp when plan was created'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 timestamp when plan was last updated'
        },
        createdBy: {
          type: 'string',
          description: 'User or system that created the plan'
        },
        complexity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Estimated complexity of the plan'
        },
        profile: {
          type: 'string',
          description: 'Profile used to generate the plan (if applicable)'
        },
        estimatedDuration: {
          type: 'number',
          minimum: 0,
          description: 'Estimated duration in minutes'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorizing the plan'
        }
      },
      additionalProperties: true
    },
    
    // Context for variable initialization
    context: {
      type: 'object',
      description: 'Initial context variables',
      additionalProperties: true
    },
    
    // Plan-level inputs (for parameterized plans)
    inputs: {
      type: 'array',
      description: 'Input parameters required by the plan',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            pattern: '^[A-Z_][A-Z0-9_]*$',
            description: 'Input variable name (uppercase with underscores)'
          },
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'object', 'array'],
            description: 'Data type of the input'
          },
          description: {
            type: 'string',
            description: 'Description of the input parameter'
          },
          required: {
            type: 'boolean',
            description: 'Whether this input is required',
            default: true
          },
          default: {
            description: 'Default value if not provided'
          }
        },
        required: ['name'],
        additionalProperties: false
      }
    },
    
    // Expected outputs
    requiredOutputs: {
      type: 'array',
      description: 'Variables that must be defined by plan execution',
      items: { type: 'string' }
    },
    
    // Execution order (if different from step order)
    executionOrder: {
      type: 'array',
      description: 'Explicit execution order of step IDs',
      items: { type: 'string' }
    },
    
    // Success criteria
    successCriteria: {
      type: 'array',
      description: 'Conditions that must be met for plan success',
      items: { type: 'string' }
    }
  },
  
  required: ['id', 'name', 'steps'],
  additionalProperties: false,
  
  definitions: {
    step: {
      type: 'object',
      description: 'A step in the plan execution',
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9-_]*$',
          description: 'Unique identifier for the step',
          minLength: 1
        },
        
        name: {
          type: 'string',
          description: 'Human-readable name for the step'
        },
        
        description: {
          type: 'string',
          description: 'Detailed description of what the step does'
        },
        
        type: {
          type: 'string',
          description: 'Type of step (e.g., setup, implementation, validation)',
          enum: ['setup', 'implementation', 'validation', 'cleanup', 'action', 'group', 'parallel', 'conditional']
        },
        
        status: {
          type: 'string',
          description: 'Current status of the step',
          enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
          default: 'pending'
        },
        
        dependencies: {
          type: 'array',
          description: 'Step IDs that must complete before this step',
          items: { type: 'string' }
        },
        
        // Step inputs/outputs (for tracking)
        inputs: {
          type: 'array',
          description: 'Variables required by this step',
          items: { type: 'string' }
        },
        
        outputs: {
          type: 'array',
          description: 'Variables produced by this step',
          items: { type: 'string' }
        },
        
        // Actions to execute
        actions: {
          type: 'array',
          description: 'Actions to execute in this step',
          items: { $ref: '#/definitions/action' }
        },
        
        // Sub-steps for hierarchical plans
        steps: {
          type: 'array',
          description: 'Sub-steps for hierarchical organization',
          items: { $ref: '#/definitions/step' }
        },
        
        // Execution metadata
        estimatedDuration: {
          type: 'number',
          minimum: 0,
          description: 'Estimated duration in minutes'
        },
        
        retries: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Number of retries on failure'
        },
        
        timeout: {
          type: 'number',
          minimum: 0,
          description: 'Timeout in seconds'
        },
        
        // Runtime result (populated during execution)
        result: {
          type: ['object', 'null'],
          description: 'Result of step execution'
        }
      },
      
      required: ['id'],
      additionalProperties: false,
      
      // Validate that a step has either actions OR sub-steps, not both
      oneOf: [
        {
          properties: {
            actions: { minItems: 1 },
            steps: { maxItems: 0 }
          }
        },
        {
          properties: {
            actions: { maxItems: 0 },
            steps: { minItems: 1 }
          }
        },
        {
          properties: {
            actions: { maxItems: 0 },
            steps: { maxItems: 0 }
          }
        }
      ]
    },
    
    action: {
      type: 'object',
      description: 'An action to execute within a step',
      
      // Support both new and legacy formats
      oneOf: [
        {
          // New format with inputs/outputs
          properties: {
            id: {
              type: 'string',
              pattern: '^[a-zA-Z0-9][a-zA-Z0-9-_]*$',
              description: 'Unique identifier for the action'
            },
            type: {
              type: 'string',
              description: 'Tool/action type to execute',
              minLength: 1
            },
            inputs: {
              type: 'object',
              description: 'Input parameters mapped to values or @variables',
              additionalProperties: true
            },
            outputs: {
              type: 'object',
              description: 'Output fields mapped to variable names',
              additionalProperties: {
                type: 'string',
                pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
              }
            },
            description: {
              type: 'string',
              description: 'Description of what the action does'
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
              default: 'pending'
            },
            estimatedDuration: {
              type: 'number',
              minimum: 0
            },
            result: {
              type: ['object', 'null'],
              description: 'Result of action execution'
            }
          },
          required: ['type', 'inputs'],
          additionalProperties: false
        },
        {
          // Legacy format with parameters
          properties: {
            id: {
              type: 'string',
              pattern: '^[a-zA-Z0-9][a-zA-Z0-9-_]*$',
              description: 'Unique identifier for the action'
            },
            type: {
              type: 'string',
              description: 'Tool/action type to execute',
              minLength: 1
            },
            parameters: {
              type: 'object',
              description: 'Parameters for the action',
              additionalProperties: true
            },
            description: {
              type: 'string',
              description: 'Description of what the action does'
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
              default: 'pending'
            },
            estimatedDuration: {
              type: 'number',
              minimum: 0
            },
            result: {
              type: ['object', 'null'],
              description: 'Result of action execution'
            }
          },
          required: ['type', 'parameters'],
          additionalProperties: false
        }
      ]
    }
  }
};

export default PlanSchema;