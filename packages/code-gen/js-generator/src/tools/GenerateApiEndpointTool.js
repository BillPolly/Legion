/**
 * GenerateApiEndpointTool - Generate Express.js API endpoint handlers
 * 
 * Creates Express.js route handlers with validation, error handling,
 * middleware integration, and proper HTTP response patterns.
 */

import { Tool, ToolResult } from '@legion/tools-registry';
import { z } from 'zod';

export class GenerateApiEndpointTool extends Tool {
  constructor() {
    super({
      name: 'generate_api_endpoint',
      description: 'Generate Express.js API endpoint handler with validation and error handling'
    });
    this.inputSchema = z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET').describe('HTTP method'),
        path: z.string().describe('API endpoint path (e.g., "/users/:id")'),
        handlerName: z.string().optional().describe('Custom handler function name'),
        description: z.string().optional().describe('Endpoint description for JSDoc'),
        parameters: z.array(z.object({
          name: z.string(),
          type: z.enum(['path', 'query', 'body']),
          dataType: z.string().optional().default('string'),
          required: z.boolean().optional().default(false),
          description: z.string().optional()
        })).optional().default([]).describe('Request parameters'),
        validation: z.object({
          body: z.string().optional().describe('Request body validation code'),
          params: z.string().optional().describe('Path parameters validation code'),
          query: z.string().optional().describe('Query parameters validation code')
        }).optional(),
        authentication: z.object({
          type: z.enum(['jwt', 'api-key', 'basic', 'oauth', 'none']).default('none'),
          middleware: z.string().optional().describe('Custom authentication middleware function name')
        }).optional(),
        responseFormat: z.object({
          success: z.string().optional().describe('Success response format'),
          error: z.string().optional().describe('Error response format')
        }).optional(),
        middleware: z.array(z.string()).optional().default([]).describe('Additional middleware to apply'),
        errorHandling: z.boolean().optional().default(true).describe('Include error handling'),
        asyncHandler: z.boolean().optional().default(true).describe('Use async/await pattern')
      });
    this.outputSchema = z.object({
        code: z.string().describe('Generated endpoint handler code'),
        functionName: z.string().describe('Generated function name'),
        route: z.string().describe('Complete route definition for Express app'),
        components: z.object({
          hasValidation: z.boolean().describe('Whether validation was included'),
          hasErrorHandling: z.boolean().describe('Whether error handling was included'),
          hasAuthentication: z.boolean().describe('Whether authentication was included'),
          middlewareCount: z.number().describe('Number of middleware functions')
        }).describe('Analysis of generated components')
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
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
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