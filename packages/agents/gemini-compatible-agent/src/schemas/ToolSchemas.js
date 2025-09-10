/**
 * Tool schemas ported from Gemini CLI to Legion's schema system
 */

// Simple schema validator - replaces missing @legion/schema dependency
class SimpleSchemaValidator {
  constructor(schema) {
    this.schema = schema;
  }

  validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data: must be an object');
    }

    // Check required fields
    if (this.schema.required) {
      for (const field of this.schema.required) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }

    // Basic type checking for properties
    if (this.schema.properties) {
      for (const [key, propSchema] of Object.entries(this.schema.properties)) {
        if (key in data) {
          const value = data[key];
          if (propSchema.type === 'string' && typeof value !== 'string') {
            throw new Error(`Invalid type for ${key}: expected string, got ${typeof value}`);
          }
          if (propSchema.type === 'number' && typeof value !== 'number') {
            throw new Error(`Invalid type for ${key}: expected number, got ${typeof value}`);
          }
        }
      }
    }

    return true;
  }
}

const SchemaValidator = {
  createValidator: (schema) => new SimpleSchemaValidator(schema)
};

// ReadFile tool schema (ported from read-file.ts)
export const ReadFileToolSchema = {
  type: 'object',
  properties: {
    absolute_path: {
      type: 'string',
      description: 'The absolute path to the file to read'
    },
    offset: {
      type: 'number',
      description: 'The line number to start reading from (optional)'
    },
    limit: {
      type: 'number', 
      description: 'The number of lines to read (optional)'
    }
  },
  required: ['absolute_path'],
  additionalProperties: false
};

// WriteFile tool schema (ported from write-file.ts)
export const WriteFileToolSchema = {
  type: 'object',
  properties: {
    absolute_path: {
      type: 'string',
      description: 'The absolute path to the file to write'
    },
    content: {
      type: 'string',
      description: 'The content to write to the file'
    },
    encoding: {
      type: 'string',
      description: 'File encoding (default: utf8)',
      default: 'utf8'
    }
  },
  required: ['absolute_path', 'content'],
  additionalProperties: false
};

// EditFile tool schema (ported from edit.ts)
export const EditFileToolSchema = {
  type: 'object',
  properties: {
    absolute_path: {
      type: 'string',
      description: 'The absolute path to the file to edit'
    },
    old_string: {
      type: 'string',
      description: 'The text to replace'
    },
    new_string: {
      type: 'string',
      description: 'The replacement text'
    },
    replace_all: {
      type: 'boolean',
      description: 'Replace all occurrences (default: false)',
      default: false
    }
  },
  required: ['absolute_path', 'old_string', 'new_string'],
  additionalProperties: false
};

// Shell command schema (ported from shell.ts)
export const ShellToolSchema = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The shell command to execute'
    },
    working_directory: {
      type: 'string',
      description: 'Working directory for command execution (optional)'
    },
    timeout: {
      type: 'number',
      description: 'Command timeout in milliseconds (default: 30000)',
      default: 30000
    }
  },
  required: ['command'],
  additionalProperties: false
};

// Conversation schemas
export const ConversationTurnSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique turn identifier'
    },
    type: {
      type: 'string',
      enum: ['user', 'assistant'],
      description: 'Turn type'
    },
    content: {
      type: 'string',
      description: 'Turn content'
    },
    tools: {
      type: 'array',
      items: { type: 'object' },
      description: 'Tool executions in this turn'
    },
    timestamp: {
      type: 'string',
      description: 'ISO timestamp'
    }
  },
  required: ['id', 'type', 'content', 'timestamp'],
  additionalProperties: false
};

export const AgentConfigSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Agent identifier'
    },
    name: {
      type: 'string',
      description: 'Agent name'
    },
    model: {
      type: 'string',
      description: 'LLM model to use',
      default: 'gemini-2.0-flash-exp'
    },
    maxTokens: {
      type: 'number',
      description: 'Maximum tokens for context',
      default: 100000
    },
    tools: {
      type: 'object',
      properties: {
        autoApprove: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools that auto-approve'
        },
        requireApproval: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools requiring user approval'
        }
      },
      required: ['autoApprove', 'requireApproval']
    }
  },
  required: ['id', 'name', 'tools'],
  additionalProperties: false
};

/**
 * Schema validator instances
 */
export const validateReadFileParams = SchemaValidator.createValidator(ReadFileToolSchema);
export const validateWriteFileParams = SchemaValidator.createValidator(WriteFileToolSchema);
export const validateEditFileParams = SchemaValidator.createValidator(EditFileToolSchema);
export const validateShellParams = SchemaValidator.createValidator(ShellToolSchema);
export const validateConversationTurn = SchemaValidator.createValidator(ConversationTurnSchema);
export const validateAgentConfig = SchemaValidator.createValidator(AgentConfigSchema);