/**
 * Configuration schema for configurable agents
 * Uses @legion/schema for validation (which uses Zod internally)
 */

import { createValidator } from '@legion/schema';

// Define the JSON schema for agent configuration
export const AgentConfigSchema = {
  type: 'object',
  properties: {
    agent: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        type: { 
          type: 'string', 
          enum: ['conversational', 'task', 'analytical', 'creative'] 
        },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        
        llm: {
          type: 'object',
          properties: {
            provider: { 
              type: 'string', 
              enum: ['anthropic', 'openai'] 
            },
            model: { type: 'string', minLength: 1 },
            temperature: { 
              type: 'number', 
              minimum: 0, 
              maximum: 1 
            },
            maxTokens: { 
              type: 'integer', 
              minimum: 1 
            },
            systemPrompt: { type: 'string' },
            retryStrategy: {
              type: 'object',
              properties: {
                maxRetries: { 
                  type: 'integer', 
                  minimum: 0, 
                  maximum: 10 
                },
                backoffMs: { 
                  type: 'integer', 
                  minimum: 100 
                }
              },
              additionalProperties: false
            }
          },
          required: ['provider', 'model'],
          additionalProperties: false
        },
        
        capabilities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              module: { type: 'string', minLength: 1 },
              tools: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1
              },
              permissions: {
                type: 'object',
                properties: {
                  basePath: { type: 'string' },
                  maxFileSize: { 
                    type: 'integer', 
                    minimum: 0 
                  },
                  allowedExtensions: {
                    type: 'array',
                    items: { 
                      type: 'string', 
                      pattern: '^\\.[a-zA-Z0-9]+$' 
                    }
                  }
                },
                additionalProperties: true
              }
            },
            required: ['module', 'tools'],
            additionalProperties: false
          }
        },
        
        behaviorTree: {
          type: 'object',
          properties: {
            type: { 
              type: 'string',
              enum: ['sequence', 'selector', 'parallel', 'action', 'condition']
            },
            id: { type: 'string' },
            name: { type: 'string' },
            children: {
              type: 'array',
              items: { 
                type: 'object'
                // Recursive schema validation handled at runtime
              }
            },
            tool: { type: 'string' },
            params: { type: 'object' },
            condition: { type: 'object' }
          },
          required: ['type'],
          additionalProperties: true
        },
        
        knowledge: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            persistence: { 
              type: 'string', 
              enum: ['session', 'persistent'] 
            },
            storage: { 
              type: 'string', 
              enum: ['memory', 'file', 'mongodb'] 
            },
            schemas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1 },
                  properties: { type: 'object' }
                },
                required: ['name', 'properties'],
                additionalProperties: false
              }
            },
            relationships: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', minLength: 1 },
                  from: { type: 'string', minLength: 1 },
                  to: { type: 'string', minLength: 1 }
                },
                required: ['type', 'from', 'to'],
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        },
        
        prompts: {
          type: 'object',
          properties: {
            templates: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            responseFormats: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['json', 'markdown', 'text'] 
                  },
                  includeMetadata: { type: 'boolean' },
                  schema: { type: 'object' }
                },
                required: ['type'],
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        },
        
        state: {
          type: 'object',
          properties: {
            conversationHistory: {
              type: 'object',
              properties: {
                maxMessages: { 
                  type: 'integer', 
                  minimum: 1 
                },
                pruningStrategy: { 
                  type: 'string', 
                  enum: ['sliding-window', 'importance-based'] 
                }
              },
              additionalProperties: false
            },
            contextVariables: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['string', 'number', 'boolean', 'object', 'array'] 
                  },
                  persistent: { type: 'boolean' },
                  extractionPattern: { type: 'string' }
                },
                required: ['type'],
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        }
      },
      required: ['id', 'name', 'type', 'version', 'llm'],
      additionalProperties: false
    }
  },
  required: ['agent'],
  additionalProperties: false
};

// Create validator function
let validator = null;

/**
 * Validate an agent configuration
 * @param {Object} config - The configuration to validate
 * @returns {Object} Validation result with {valid: boolean, errors: string[]}
 */
export function validateAgentConfig(config) {
  try {
    // Create validator lazily
    if (!validator) {
      validator = createValidator(AgentConfigSchema);
    }
    
    // Validate the configuration using the safeParse method
    const result = validator.safeParse(config);
    
    if (result.valid) {
      return {
        valid: true,
        errors: []
      };
    } else {
      // The errors are already formatted by the validator
      return {
        valid: false,
        errors: result.errors.map(err => {
          const path = err.path || '';
          return path ? `${path}: ${err.message}` : err.message;
        })
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`]
    };
  }
}

/**
 * Validate a behavior tree node recursively
 * @param {Object} node - The behavior tree node to validate
 * @returns {boolean} True if valid
 */
export function validateBehaviorTreeNode(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  
  // Check required type field
  if (!node.type) {
    return false;
  }
  
  // Validate type
  const validTypes = ['sequence', 'selector', 'parallel', 'action', 'condition', 'retry'];
  if (!validTypes.includes(node.type)) {
    return false;
  }
  
  // Action nodes must have a tool
  if (node.type === 'action' && !node.tool) {
    return false;
  }
  
  // Condition nodes must have a condition
  if (node.type === 'condition' && !node.condition) {
    return false;
  }
  
  // Validate children recursively
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (!validateBehaviorTreeNode(child)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get default configuration for a given agent type
 * @param {string} type - The agent type
 * @returns {Object} Default configuration
 */
export function getDefaultConfig(type = 'conversational') {
  return {
    agent: {
      id: `agent-${Date.now()}`,
      name: 'New Agent',
      type,
      version: '1.0.0',
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096
      }
    }
  };
}