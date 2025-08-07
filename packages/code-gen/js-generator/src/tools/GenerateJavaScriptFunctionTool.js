/**
 * GenerateJavaScriptFunctionTool - Generate individual JavaScript functions
 */

import { Tool } from '@legion/tool-system';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class GenerateJavaScriptFunctionTool extends Tool {
  constructor() {
    super({
      name: 'generate_javascript_function',
      description: 'Generate a JavaScript function with JSDoc, parameters, and body',
      inputSchema: z.object({
        name: z.string().describe('Function name'),
        params: z.array(z.union([
          z.string(),
          z.object({
            name: z.string(),
            type: z.string().optional(),
            default: z.any().optional(),
            description: z.string().optional()
          })
        ])).optional().describe('Function parameters'),
        body: z.string().describe('Function body code'),
        returnType: z.string().optional().describe('Return type for JSDoc'),
        isAsync: z.boolean().default(false).describe('Whether function is async'),
        isArrow: z.boolean().default(false).describe('Whether to use arrow function syntax'),
        isExport: z.boolean().default(false).describe('Whether to export the function'),
        jsdoc: z.object({
          description: z.string().optional(),
          returns: z.string().optional(),
          example: z.string().optional()
        }).optional().describe('JSDoc documentation'),
        projectPath: z.string().optional().describe('Project root directory (optional, for file writing)'),
        writeToFile: z.boolean().optional().default(false).describe('Whether to write generated code to file'),
        outputPath: z.string().optional().describe('Relative path within project for output file (when writeToFile is true)')
      })
    });
    this.outputSchema = z.object({
        code: z.string().describe('Generated function code'),
        signature: z.string().describe('Function signature'),
        hasJSDoc: z.boolean().describe('Whether JSDoc was generated'),
        filePath: z.string().optional().describe('Full path to written file (when writeToFile is true)'),
        written: z.boolean().describe('Whether the file was written to disk')
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