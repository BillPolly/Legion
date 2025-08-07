/**
 * MockToolFactory - Standardized mock tool creation for BT tests
 * Provides consistent mock tools with configurable behavior and schemas
 */

export class MockToolFactory {
  /**
   * Create a basic mock tool
   * @param {string} name - Tool name
   * @param {Object} options - Configuration options
   * @returns {Object} Mock tool
   */
  static createMockTool(name, options = {}) {
    const {
      behavior = 'success',
      schema = null,
      delay = 0,
      executeCallback = null,
      metadata = {}
    } = options;

    return {
      name,
      async execute(params) {
        if (executeCallback) {
          executeCallback(name, params);
        }

        // Simulate async delay if specified
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        switch (behavior) {
          case 'success':
            return {
              success: true,
              data: {
                result: `${name} completed successfully`,
                params,
                toolName: name,
                timestamp: Date.now()
              }
            };

          case 'failure':
            return {
              success: false,
              data: {
                error: `${name} failed`,
                toolName: name,
                timestamp: Date.now()
              }
            };

          case 'timeout':
            await new Promise(resolve => setTimeout(resolve, 10000)); // Long delay
            return {
              success: false,
              data: { error: 'Operation timed out' }
            };

          case 'error':
            throw new Error(`${name} threw an error`);

          default:
            if (typeof behavior === 'function') {
              return behavior(params);
            }
            return {
              success: true,
              data: { result: behavior }
            };
        }
      },

      getMetadata() {
        return {
          name,
          description: metadata.description || `Mock tool ${name}`,
          input: schema?.input || { data: { type: 'object' } },
          output: schema?.output || { result: { type: 'string' } },
          ...metadata
        };
      }
    };
  }

  /**
   * Create a tool with schema validation
   * @param {string} name - Tool name
   * @param {Object} inputSchema - Input schema
   * @param {Object} outputSchema - Output schema
   * @returns {Object} Schema-aware mock tool
   */
  static createSchemaAwareTool(name, inputSchema, outputSchema) {
    return this.createMockTool(name, {
      schema: { input: inputSchema, output: outputSchema },
      behavior: (params) => {
        // Validate input against schema
        const validation = this.validateInput(params, inputSchema);
        if (!validation.valid) {
          return {
            success: false,
            data: {
              error: 'Input validation failed',
              validationErrors: validation.errors
            }
          };
        }

        // Return mock output matching schema
        const mockOutput = this.generateMockOutput(outputSchema);
        return {
          success: true,
          data: mockOutput
        };
      }
    });
  }

  /**
   * Create a file system mock tool
   * @param {string} operation - Operation type (read, write, etc.)
   * @returns {Object} File system mock tool
   */
  static createFileSystemTool(operation) {
    const schemas = {
      read: {
        input: { path: { type: 'string', required: true } },
        output: { content: { type: 'string' }, path: { type: 'string' } }
      },
      write: {
        input: { 
          path: { type: 'string', required: true },
          content: { type: 'string', required: true }
        },
        output: { path: { type: 'string' } }
      }
    };

    return this.createSchemaAwareTool(
      `FileSystemModule.${operation}`,
      schemas[operation]?.input || {},
      schemas[operation]?.output || {}
    );
  }

  /**
   * Validate input against schema
   * @param {Object} input - Input to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} Validation result
   */
  static validateInput(input, schema) {
    const errors = [];

    for (const [key, spec] of Object.entries(schema)) {
      if (spec.required && input[key] === undefined) {
        errors.push(`Missing required input: ${key}`);
      }

      if (input[key] !== undefined && spec.type) {
        const actualType = Array.isArray(input[key]) ? 'array' : typeof input[key];
        if (actualType !== spec.type) {
          errors.push(`Input ${key} expected ${spec.type}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate mock output matching schema
   * @param {Object} schema - Output schema
   * @returns {Object} Mock output
   */
  static generateMockOutput(schema) {
    const output = {};

    for (const [key, spec] of Object.entries(schema)) {
      switch (spec.type) {
        case 'string':
          output[key] = `mock_${key}_value`;
          break;
        case 'number':
          output[key] = 42;
          break;
        case 'boolean':
          output[key] = true;
          break;
        case 'array':
          output[key] = ['mock_item'];
          break;
        case 'object':
          output[key] = { mock: 'value' };
          break;
        default:
          output[key] = 'mock_value';
      }
    }

    return output;
  }
}

/**
 * MockToolRegistry - Simple registry for test tools
 */
export class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }

  hasProvider(name) {
    return this.providers.has(name);
  }

  hasTool(name) {
    return this.tools.has(name);
  }

  clear() {
    this.tools.clear();
    this.providers.clear();
  }

  // Helper method to register common tools
  registerCommonTools() {
    this.registerTool('codeGenerator', MockToolFactory.createMockTool('codeGenerator'));
    this.registerTool('testRunner', MockToolFactory.createMockTool('testRunner'));
    this.registerTool('FileSystemModule.writeFile', MockToolFactory.createFileSystemTool('write'));
    this.registerTool('FileSystemModule.readFile', MockToolFactory.createFileSystemTool('read'));
  }
}