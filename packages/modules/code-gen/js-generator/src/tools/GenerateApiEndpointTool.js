/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateApiEndpointTool - Generate Express.js API endpoint handlers
 * 
 * Creates Express.js route handlers with validation, error handling,
 * middleware integration, and proper HTTP response patterns.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const generateApiEndpointToolInputSchema = {
  type: 'object',
  properties: {
    method: {
      type: 'string',
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET',
      description: 'HTTP method'
    },
    path: {
      type: 'string',
      description: 'API endpoint path (e.g., "/users/:id")'
    },
    handlerName: {
      type: 'string',
      description: 'Custom handler function name'
    },
    description: {
      type: 'string',
      description: 'Endpoint description for JSDoc'
    },
    parameters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['path', 'query', 'body']
          },
          dataType: {
            type: 'string',
            default: 'string'
          },
          required: {
            type: 'boolean',
            default: false
          },
          description: { type: 'string' }
        },
        required: ['name', 'type']
      },
      default: [],
      description: 'Request parameters'
    },
    validation: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'Request body validation code'
        },
        params: {
          type: 'string',
          description: 'Path parameters validation code'
        },
        query: {
          type: 'string',
          description: 'Query parameters validation code'
        }
      }
    },
    authentication: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['jwt', 'api-key', 'basic', 'oauth', 'none'],
          default: 'none'
        },
        middleware: {
          type: 'string',
          description: 'Custom authentication middleware function name'
        }
      }
    },
    responseFormat: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          description: 'Success response format'
        },
        error: {
          type: 'string',
          description: 'Error response format'
        }
      }
    },
    middleware: {
      type: 'array',
      items: { type: 'string' },
      default: [],
      description: 'Additional middleware to apply'
    },
    errorHandling: {
      type: 'boolean',
      default: true,
      description: 'Include error handling'
    },
    asyncHandler: {
      type: 'boolean',
      default: true,
      description: 'Use async/await pattern'
    }
  },
  required: ['path']
};

// Output schema as plain JSON Schema
const generateApiEndpointToolOutputSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Generated endpoint handler code'
    },
    functionName: {
      type: 'string',
      description: 'Generated function name'
    },
    route: {
      type: 'string',
      description: 'Complete route definition for Express app'
    },
    components: {
      type: 'object',
      properties: {
        hasValidation: {
          type: 'boolean',
          description: 'Whether validation was included'
        },
        hasErrorHandling: {
          type: 'boolean',
          description: 'Whether error handling was included'
        },
        hasAuthentication: {
          type: 'boolean',
          description: 'Whether authentication was included'
        },
        middlewareCount: {
          type: 'number',
          description: 'Number of middleware functions'
        }
      },
      required: ['hasValidation', 'hasErrorHandling', 'hasAuthentication', 'middlewareCount'],
      description: 'Analysis of generated components'
    }
  },
  required: ['code', 'functionName', 'route', 'components']
};

export class GenerateApiEndpointTool extends Tool {
  constructor() {
    super({
      name: 'generate_api_endpoint',
      description: 'Generate Express.js API endpoint handler with validation and error handling',
      inputSchema: generateApiEndpointToolInputSchema,
      outputSchema: generateApiEndpointToolOutputSchema
    });
  }

  
  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      throw new Error(error.message || 'Tool execution failed', {
        cause: {
          toolName: this.name,
          error: error.toString(),
          errorType: 'operation_error'
        }}),
        stack: error.stack
      });
    }
    
    // Execute the tool logic
    return this.execute(args);
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 10, status: 'Generating endpoint structure...' });

      const functionName = args.handlerName || this._generateHandlerName(args.method, args.path);
      const parts = [];

      // Generate JSDoc
      parts.push(this._generateJSDoc(args, functionName));

      this.emit('progress', { percentage: 30, status: 'Building function signature...' });

      // Generate function signature - include 'next' if error handling or authentication is enabled
      const needsNext = args.errorHandling || args.authentication;
      const signature = needsNext
        ? `const ${functionName} = async (req, res, next) => {`
        : `const ${functionName} = async (req, res) => {`;
      parts.push(signature);

      const bodyParts = [];

      this.emit('progress', { percentage: 50, status: 'Adding validation and middleware...' });

      // Add authentication check
      if (args.authentication) {
        bodyParts.push('  // Authentication check');
        if (args.authentication === true || !args.authentication.type || args.authentication.type === 'jwt') {
          bodyParts.push('  if (!req.user) {');
          bodyParts.push('    return res.status(401).json({ error: "Authentication required" });');
          bodyParts.push('  }');
        } else if (args.authentication.type === 'api-key') {
          bodyParts.push('  if (!req.headers["x-api-key"]) {');
          bodyParts.push('    return res.status(401).json({ error: "API key required" });');
          bodyParts.push('  }');
        }
        bodyParts.push('');
      }

      // Add validation
      const hasValidation = this._addValidation(bodyParts, args.validation, args.parameters);

      this.emit('progress', { percentage: 70, status: 'Adding endpoint logic...' });

      // Add logging
      bodyParts.push('  // Request logging');
      bodyParts.push(`  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.originalUrl}\`);`);
      bodyParts.push('');

      // Add main handler logic
      bodyParts.push('  try {');
      
      if (args.handler) {
        // Use provided handler code
        const handlerLines = args.handler.split('\n');
        handlerLines.forEach(line => {
          bodyParts.push(`    ${line}`);
        });
      } else {
        // Generate default logic based on method
        bodyParts.push('    // TODO: Implement endpoint logic');
        if (args.method === 'POST') {
          bodyParts.push('    const result = {}; // Process request');
          bodyParts.push('    res.status(201).json(result);');
        } else if (args.method === 'PUT' || args.method === 'PATCH') {
          bodyParts.push('    const result = {}; // Update resource');
          bodyParts.push('    res.json(result);');
        } else if (args.method === 'DELETE') {
          bodyParts.push('    // Delete resource');
          bodyParts.push('    res.status(204).send();');
        } else {
          bodyParts.push('    const result = {}; // Fetch data');
          bodyParts.push('    res.json(result);');
        }
      }

      if (args.errorHandling) {
        bodyParts.push('  } catch (error) {');
        bodyParts.push('    console.error("Endpoint error:", error);');
        bodyParts.push('    next(error);');
        bodyParts.push('  }');
      } else {
        bodyParts.push('  } catch (error) {');
        bodyParts.push('    console.error("Endpoint error:", error);');
        bodyParts.push('    res.status(500).json({ error: "Internal server error" });');
        bodyParts.push('  }');
      }

      parts.push(...bodyParts);
      parts.push('};');

      this.emit('progress', { percentage: 90, status: 'Generating route definition...' });

      // Generate route definition
      parts.push('');
      parts.push(`// Route definition:`);
      parts.push(`// router.${args.method.toLowerCase()}('${args.path}', ${functionName});`);

      const code = parts.join('\n');

      this.emit('progress', { percentage: 100, status: 'API endpoint generation complete' });

      return {
        code,
        functionName,
        route: `router.${args.method.toLowerCase()}('${args.path}', ${functionName})`,
        components: {
          hasValidation,
          hasErrorHandling: args.errorHandling || false,
          hasAuthentication: args.authentication && args.authentication.type !== 'none',
          middlewareCount: (args.middleware || []).length
        }
      };

    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }

  _generateHandlerName(method, path) {
    // Convert path to camelCase function name
    // e.g., "GET /users/:id" -> "getUserById"
    const cleanPath = path
      .replace(/^\//, '') // Remove leading slash
      .replace(/\/:(\w+)/g, 'By$1') // Convert :id to ById
      .replace(/[^a-zA-Z0-9]/g, ' ') // Replace non-alphanumeric with spaces
      .split(' ')
      .filter(word => word.length > 0)
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    const methodPrefix = method.toLowerCase();
    return `${methodPrefix}${cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1)}`;
  }

  _generateJSDoc(args, functionName) {
    const lines = ['/**'];
    
    if (args.description) {
      lines.push(` * ${args.description}`);
    } else {
      lines.push(` * ${args.method} ${args.path} endpoint handler`);
    }
    
    lines.push(' *');

    // Add parameter documentation
    if (args.parameters && args.parameters.length > 0) {
      args.parameters.forEach(param => {
        let paramDoc = ` * @param {${param.dataType}} `;
        
        if (param.type === 'path') {
          paramDoc += `req.params.${param.name}`;
        } else if (param.type === 'query') {
          paramDoc += `req.query.${param.name}`;
        } else if (param.type === 'body') {
          paramDoc += `req.body.${param.name}`;
        }
        
        if (param.description) {
          paramDoc += ` - ${param.description}`;
        }
        
        if (param.required) {
          paramDoc += ' (required)';
        }
        
        lines.push(paramDoc);
      });
      lines.push(' *');
    }

    lines.push(' * @param {Object} req - Express request object');
    lines.push(' * @param {Object} res - Express response object');
    
    if (args.errorHandling) {
      lines.push(' * @param {Function} next - Express next middleware function');
    }
    
    lines.push(` * @returns {Promise<void>} HTTP response`);
    lines.push(' */');
    
    return lines.join('\\n');
  }

  _addValidation(bodyParts, validation, parameters) {
    let hasValidation = false;

    if (validation && (validation.body || validation.params || validation.query)) {
      bodyParts.push('  // Input validation');
      hasValidation = true;

      if (validation.params) {
        bodyParts.push('  // Path parameters validation');
        const paramLines = validation.params.split('\\n');
        paramLines.forEach(line => {
          bodyParts.push(`  ${line}`);
        });
      }

      if (validation.query) {
        bodyParts.push('  // Query parameters validation');
        const queryLines = validation.query.split('\\n');
        queryLines.forEach(line => {
          bodyParts.push(`  ${line}`);
        });
      }

      if (validation.body) {
        bodyParts.push('  // Request body validation');
        const bodyLines = validation.body.split('\\n');
        bodyLines.forEach(line => {
          bodyParts.push(`  ${line}`);
        });
      }

      bodyParts.push('');
    } else if (parameters && parameters.length > 0) {
      // Generate basic validation from parameters
      bodyParts.push('  // Basic parameter validation');
      hasValidation = true;

      const requiredParams = parameters.filter(p => p.required);
      if (requiredParams.length > 0) {
        requiredParams.forEach(param => {
          let checkLocation = '';
          if (param.type === 'path') {
            checkLocation = 'req.params';
          } else if (param.type === 'query') {
            checkLocation = 'req.query';
          } else if (param.type === 'body') {
            checkLocation = 'req.body';
          }

          bodyParts.push(`  if (!${checkLocation}.${param.name}) {`);
          bodyParts.push(`    return res.status(400).json({ error: "Missing required parameter: ${param.name}" });`);
          bodyParts.push('  }');
        });
        bodyParts.push('');
      }
    }

    return hasValidation;
  }
}