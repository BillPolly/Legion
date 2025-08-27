/**
 * ModuleSchema - JSON Schema definition for Legion modules
 * 
 * Defines the required structure and metadata for all Legion modules
 * Used for validation and compliance checking
 */

export const ModuleMetadataSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Legion Module Metadata',
  description: 'Standard metadata schema for Legion modules',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Unique module identifier',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-z][a-z0-9-]*$'
    },
    version: {
      type: 'string',
      description: 'Semantic version number',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-z]+\\d*)?$'
    },
    description: {
      type: 'string',
      description: 'Clear description of module purpose',
      minLength: 10,
      maxLength: 500
    },
    author: {
      type: 'string',
      description: 'Module author or team',
      minLength: 1
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
    dependencies: {
      type: 'object',
      description: 'Required dependencies',
      additionalProperties: {
        type: 'string'
      }
    },
    toolCount: {
      type: 'number',
      description: 'Number of tools provided',
      minimum: 0
    },
    status: {
      type: 'string',
      description: 'Module status',
      enum: ['loaded', 'discovered', 'error', 'validating', 'testing']
    },
    lastUpdated: {
      type: 'string',
      description: 'Last modification timestamp',
      format: 'date-time'
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
      },
      required: ['score', 'validated', 'tested', 'issues']
    }
  },
  required: ['name', 'version', 'description'],
  additionalProperties: true
};

export const ModuleInterfaceSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Legion Module Interface',
  description: 'Required interface for Legion modules',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1
    },
    description: {
      type: 'string'
    },
    version: {
      type: 'string'
    },
    getTools: {
      description: 'Method that returns array of tools',
      // Note: Can't validate function existence in JSON Schema
      // This will be checked in code
    },
    constructor: {
      type: 'object',
      properties: {
        create: {
          description: 'Static async factory method'
          // Note: Validated in code
        }
      }
    }
  },
  required: ['name']
};

export const ModuleConfigSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Module Configuration',
  description: 'Configuration options for modules',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true
    },
    timeout: {
      type: 'number',
      description: 'Maximum initialization time in ms',
      minimum: 100,
      maximum: 30000,
      default: 5000
    },
    retries: {
      type: 'number',
      description: 'Number of initialization retries',
      minimum: 0,
      maximum: 5,
      default: 1
    },
    logLevel: {
      type: 'string',
      enum: ['debug', 'info', 'warning', 'error'],
      default: 'info'
    }
  },
  additionalProperties: false
};

export default ModuleMetadataSchema;