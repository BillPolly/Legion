/**
 * ToolSchema - JSON Schema definition for Legion tools
 * 
 * Defines the required structure and metadata for all Legion tools
 * Used for validation and compliance checking
 */

export const ToolMetadataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Legion Tool Metadata',
  description: 'Standard metadata schema for Legion tools',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Unique tool identifier',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-z][a-z0-9_-]*$'
    },
    description: {
      type: 'string',
      description: 'Clear tool purpose',
      minLength: 10,
      maxLength: 500
    },
    version: {
      type: 'string',
      description: 'Tool version',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-z]+\\d*)?$',
      default: '1.0.0'
    },
    category: {
      type: 'string',
      description: 'Tool category',
      enum: [
        'file-operations',
        'system-operations',
        'web-tools',
        'ai-generation',
        'data-processing',
        'communication',
        'mathematics',
        'search-navigation',
        'task-management',
        'development',
        'testing',
        'other'
      ]
    },
    keywords: {
      type: 'array',
      description: 'Searchable keywords',
      items: {
        type: 'string',
        minLength: 1
      },
      minItems: 1,
      maxItems: 20,
      uniqueItems: true
    },
    author: {
      type: 'string',
      description: 'Tool author',
      minLength: 1
    },
    inputSchema: {
      type: 'object',
      description: 'JSON Schema for input validation',
      properties: {
        type: {
          type: 'string',
          const: 'object'
        },
        properties: {
          type: 'object'
        },
        required: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      required: ['type', 'properties']
    },
    outputSchema: {
      type: 'object',
      description: 'JSON Schema for output validation',
      properties: {
        type: {
          type: 'string',
          const: 'object'
        },
        properties: {
          type: 'object'
        },
        required: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      required: ['type', 'properties']
    },
    examples: {
      type: 'array',
      description: 'Usage examples',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          },
          description: {
            type: 'string'
          },
          input: {
            type: 'object'
          },
          output: {
            type: 'object'
          }
        },
        required: ['input', 'output']
      }
    },
    testCases: {
      type: 'array',
      description: 'Test cases for validation',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Test case name'
          },
          description: {
            type: 'string',
            description: 'Test case description'
          },
          input: {
            type: 'object',
            description: 'Input parameters'
          },
          expectedOutput: {
            type: 'object',
            description: 'Expected output'
          },
          shouldFail: {
            type: 'boolean',
            description: 'Whether test should fail',
            default: false
          },
          errorMessage: {
            type: 'string',
            description: 'Expected error message if shouldFail'
          }
        },
        required: ['name', 'input']
      }
    },
    performance: {
      type: 'object',
      description: 'Performance constraints',
      properties: {
        timeout: {
          type: 'number',
          description: 'Maximum execution time in ms',
          minimum: 100,
          maximum: 600000,
          default: 30000
        },
        memory: {
          type: 'number',
          description: 'Maximum memory usage in MB',
          minimum: 1,
          maximum: 4096,
          default: 256
        },
        cpu: {
          type: 'number',
          description: 'CPU usage percentage limit',
          minimum: 1,
          maximum: 100,
          default: 80
        }
      }
    },
    compliance: {
      type: 'object',
      description: 'Compliance information',
      properties: {
        score: {
          type: 'number',
          description: 'Compliance score 0-100',
          minimum: 0,
          maximum: 100
        },
        validated: {
          type: 'boolean',
          description: 'Has been validated'
        },
        tested: {
          type: 'boolean',
          description: 'Has been tested'
        },
        issues: {
          type: 'array',
          description: 'List of compliance issues',
          items: {
            type: 'string'
          }
        }
      }
    }
  },
  required: ['name', 'description', 'inputSchema', 'outputSchema'],
  additionalProperties: true
};

export const ToolInterfaceSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Legion Tool Interface',
  description: 'Required interface for Legion tools',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1
    },
    description: {
      type: 'string'
    },
    inputSchema: {
      type: 'object'
    },
    outputSchema: {
      type: 'object'
    },
    execute: {
      description: 'Async method that executes the tool'
      // Note: Function existence validated in code
    }
  },
  required: ['name', 'execute']
};

export const ToolExecutionResultSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Tool Execution Result',
  description: 'Standard format for tool execution results',
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether execution succeeded'
    },
    data: {
      description: 'Output data from tool'
    },
    error: {
      type: 'object',
      description: 'Error information if failed',
      properties: {
        code: {
          type: 'string'
        },
        message: {
          type: 'string'
        },
        details: {}
      },
      required: ['message']
    },
    performance: {
      type: 'object',
      description: 'Performance metrics',
      properties: {
        executionTime: {
          type: 'number',
          description: 'Execution time in ms'
        },
        memoryUsed: {
          type: 'number',
          description: 'Memory used in MB'
        }
      }
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata'
    }
  },
  required: ['success'],
  if: {
    properties: { success: { const: true } }
  },
  then: {
    required: ['data']
  },
  else: {
    required: ['error']
  }
};

export default ToolMetadataSchema;