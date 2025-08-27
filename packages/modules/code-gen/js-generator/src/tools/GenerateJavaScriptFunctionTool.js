/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateJavaScriptFunctionTool - Generate individual JavaScript functions
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

export class GenerateJavaScriptFunctionTool extends Tool {
  constructor() {
    super({
      name: 'generate_javascript_function',
      description: 'Generate a JavaScript function with JSDoc, parameters, and body',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Function name'
          },
          params: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    default: {},
                    description: { type: 'string' }
                  },
                  required: ['name']
                }
              ]
            },
            description: 'Function parameters'
          },
          body: {
            type: 'string',
            description: 'Function body code'
          },
          returnType: {
            type: 'string',
            description: 'Return type for JSDoc'
          },
          isAsync: {
            type: 'boolean',
            default: false,
            description: 'Whether function is async'
          },
          isArrow: {
            type: 'boolean',
            default: false,
            description: 'Whether to use arrow function syntax'
          },
          isExport: {
            type: 'boolean',
            default: false,
            description: 'Whether to export the function'
          },
          jsdoc: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              returns: { type: 'string' },
              example: { type: 'string' }
            },
            description: 'JSDoc documentation'
          },
          projectPath: {
            type: 'string',
            description: 'Project root directory (optional, for file writing)'
          },
          writeToFile: {
            type: 'boolean',
            default: false,
            description: 'Whether to write generated code to file'
          },
          outputPath: {
            type: 'string',
            description: 'Relative path within project for output file (when writeToFile is true)'
          }
        },
        required: ['name', 'body']
      },
      outputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Generated function code'
          },
          signature: {
            type: 'string',
            description: 'Function signature'
          },
          hasJSDoc: {
            type: 'boolean',
            description: 'Whether JSDoc was generated'
          },
          filePath: {
            type: 'string',
            description: 'Full path to written file (when writeToFile is true)'
          },
          written: {
            type: 'boolean',
            description: 'Whether the file was written to disk'
          }
        },
        required: ['code', 'signature', 'hasJSDoc', 'written']
      }
    });

    this.config = {
      indentation: 2,
      includeJSDoc: true
    };
  }

  async execute(args) {
    try {
      this.progress('Generating function...', 20);

      const {
        name,
        params = [],
        body,
        returnType,
        isAsync = false,
        isArrow = false,
        isExport = false,
        jsdoc
      } = args;

      const parts = [];
      let hasJSDoc = false;

      // Add JSDoc if enabled and jsdoc provided, or if returnType is specified
      if (this.config.includeJSDoc && (jsdoc || returnType)) {
        const jsdocObj = jsdoc || {};
        parts.push(this._generateJSDoc(jsdocObj, params, returnType));
        hasJSDoc = true;
      }

      this.progress('Building function signature...', 60);

      // Build function signature
      let signature = '';
      
      if (isExport) signature += 'export ';
      if (isAsync && !isArrow) signature += 'async ';

      if (isArrow) {
        signature += `const ${name} = `;
        if (isAsync) signature += 'async ';
        signature += `(${this._formatParams(params)}) => `;
      } else {
        signature += `function ${name}(${this._formatParams(params)}) `;
      }

      // Generate function body
      const functionBody = body ? this._generateFunctionBody(body) : '  // TODO: Implement function';
      
      this.progress('Assembling function code...', 90);

      if (isArrow && functionBody.split('\n').length === 1 && !functionBody.includes('return')) {
        // Single expression arrow function
        parts.push(`${signature}${functionBody.trim()};`);
      } else {
        // Block function
        parts.push(`${signature}{`);
        parts.push(this._indentCode(functionBody));
        parts.push('}');
      }

      const code = parts.join('\n');

      this.progress('Function generation complete', 100);

      return {
        code,
        signature: signature.trim(),
        hasJSDoc
      };

    } catch (error) {
      this.error(error.message);
      throw error;
    }
  }

  _formatParams(params) {
    return params.map(param => {
      if (typeof param === 'string') return param;
      if (param.name && param.default !== undefined) {
        return `${param.name} = ${param.default}`;
      }
      return param.name || param;
    }).join(', ');
  }

  _generateFunctionBody(body) {
    if (typeof body === 'string') return body;
    if (Array.isArray(body)) return body.join('\n');
    
    // Handle structured body
    const lines = [];
    if (body.validation) lines.push(body.validation);
    if (body.logic) lines.push(body.logic);
    if (body.return) lines.push(`return ${body.return};`);
    
    return lines.join('\n');
  }

  _generateJSDoc(jsdoc, params = [], returnType) {
    const lines = ['/**'];
    
    if (jsdoc.description) {
      lines.push(` * ${jsdoc.description}`);
      lines.push(' *');
    }
    
    params.forEach(param => {
      const paramName = typeof param === 'string' ? param : param.name;
      const paramType = param.type || 'any';
      const paramDesc = param.description || '';
      lines.push(` * @param {${paramType}} ${paramName} ${paramDesc}`);
    });
    
    if (returnType || jsdoc.returns) {
      lines.push(` * @returns {${returnType || 'any'}} ${jsdoc.returns || ''}`);
    }

    if (jsdoc.example) {
      lines.push(' * @example');
      lines.push(` * ${jsdoc.example}`);
    }
    
    lines.push(' */');
    return lines.join('\n');
  }

  _indentCode(code, level = 1) {
    const indent = ' '.repeat(this.config.indentation * level);
    return code.split('\n').map(line => line.trim() ? `${indent}${line}` : line).join('\n');
  }
}