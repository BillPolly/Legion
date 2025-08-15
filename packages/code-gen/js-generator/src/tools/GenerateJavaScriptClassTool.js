/**
 * GenerateJavaScriptClassTool - Generate ES6 classes with methods and properties
 * 
 * Creates JavaScript classes with constructor, methods, properties, inheritance,
 * and JSDoc documentation following modern ES6+ patterns.
 */

import { Tool, ToolResult } from '@legion/tools-registry';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class GenerateJavaScriptClassTool extends Tool {
  constructor() {
    super({
      name: 'generate_javascript_class',
      description: 'Generate a JavaScript class with constructor, methods, and properties',
      inputSchema: z.object({
        name: z.string().describe('Class name'),
        extends: z.string().optional().describe('Parent class to extend'),
        constructor: z.object({
          params: z.array(z.union([
            z.string(),
            z.object({
              name: z.string(),
              type: z.string().optional(),
              default: z.any().optional(),
              description: z.string().optional()
            })
          ])).optional().default([]),
          body: z.string().optional().default('')
        }).optional(),
        properties: z.array(z.object({
          name: z.string(),
          type: z.string().optional(),
          visibility: z.enum(['public', 'private', 'protected']).optional().default('public'),
          static: z.boolean().optional().default(false),
          defaultValue: z.any().optional(),
          description: z.string().optional()
        })).optional().default([]),
        methods: z.array(z.object({
          name: z.string(),
          params: z.array(z.union([
            z.string(),
            z.object({
              name: z.string(),
              type: z.string().optional(),
              default: z.any().optional(),
              description: z.string().optional()
            })
          ])).optional().default([]),
          returnType: z.string().optional(),
          body: z.string().default('// TODO: Implement method'),
          static: z.boolean().optional().default(false),
          async: z.boolean().optional().default(false),
          description: z.string().optional()
        })).optional().default([]),
        isExport: z.boolean().optional().default(true),
        jsdoc: z.object({
          description: z.string().optional(),
          since: z.string().optional(),
          author: z.string().optional(),
          example: z.string().optional(),
          deprecated: z.string().optional()
        }).optional()
      })
    });
    this.outputSchema = z.object({
        code: z.string().describe('Generated class code'),
        components: z.object({
          methods: z.number().describe('Number of methods generated'),
          properties: z.number().describe('Number of properties generated'),
          hasConstructor: z.boolean().describe('Whether constructor was generated'),
          hasJSDoc: z.boolean().describe('Whether JSDoc was generated'),
          isExported: z.boolean().describe('Whether class is exported'),
          hasInheritance: z.boolean().describe('Whether class extends another class')
        }).describe('Analysis of generated components')
      });
  }


  async execute(args) {
    try {
      this.progress('Generating class structure...', 10);

      const parts = [];
      let hasJSDoc = false;

      // Generate JSDoc if provided
      if (args.jsdoc) {
        hasJSDoc = true;
        parts.push(this._generateClassJSDoc(args.jsdoc, args.name));
        parts.push('');
      }

      this.progress('Creating class declaration...', 30);

      // Generate class declaration
      let classDeclaration = `${args.isExport ? 'export ' : ''}class ${args.name}`;
      if (args.extends) {
        classDeclaration += ` extends ${args.extends}`;
      }
      classDeclaration += ' {';
      parts.push(classDeclaration);

      this.progress('Adding constructor and properties...', 50);

      // Generate constructor if provided
      let hasConstructor = false;
      if (args.constructor && (args.constructor.params.length > 0 || args.constructor.body)) {
        hasConstructor = true;
        parts.push(this._generateConstructor(args.constructor));
        parts.push('');
      }

      // Generate properties
      if (args.properties && args.properties.length > 0) {
        const propLines = this._generateProperties(args.properties);
        parts.push(...propLines);
        parts.push('');
      }

      this.progress('Generating methods...', 70);

      // Generate methods
      if (args.methods && args.methods.length > 0) {
        args.methods.forEach((method, index) => {
          parts.push(this._generateMethod(method));
          if (index < args.methods.length - 1) {
            parts.push('');
          }
        });
      }

      parts.push('}');

      const code = parts.join('\n');

      this.progress('Class generation complete', 100);

      return {
        code,
        components: {
          methods: args.methods?.length || 0,
          properties: args.properties?.length || 0,
          hasConstructor,
          hasJSDoc,
          isExported: args.isExport || true,
          hasInheritance: !!args.extends
        }
      };

    } catch (error) {
      this.error(error.message);
      throw error;
    }
  }

  _generateClassJSDoc(jsdoc, className) {
    const lines = ['/**'];
    
    if (jsdoc.description) {
      lines.push(` * ${jsdoc.description}`);
    } else {
      lines.push(` * ${className} class`);
    }
    
    lines.push(' *');

    if (jsdoc.author) {
      lines.push(` * @author ${jsdoc.author}`);
    }

    if (jsdoc.version) {
      lines.push(` * @version ${jsdoc.version}`);
    }

    if (jsdoc.example) {
      lines.push(' * @example');
      const exampleLines = jsdoc.example.split('\\n');
      exampleLines.forEach(line => {
        lines.push(` * ${line}`);
      });
    }

    lines.push(' */');
    return lines.join('\\n');
  }

  _generateConstructor(constructorSpec) {
    const parts = [];
    
    // Generate constructor JSDoc if parameters exist
    if (constructorSpec.params && constructorSpec.params.length > 0) {
      parts.push('  /**');
      parts.push('   * Create a new instance');
      
      constructorSpec.params.forEach(param => {
        const paramName = typeof param === 'string' ? param : param.name;
        const paramType = typeof param === 'object' && param.type ? param.type : 'any';
        const paramDesc = typeof param === 'object' && param.description ? param.description : '';
        parts.push(`   * @param {${paramType}} ${paramName} ${paramDesc}`);
      });
      
      parts.push('   */');
    }

    // Generate constructor signature
    const paramsList = constructorSpec.params.map(param => {
      if (typeof param === 'string') {
        return param;
      }
      
      let paramStr = param.name;
      if (param.default !== undefined) {
        const defaultValue = typeof param.default === 'string' ? `'${param.default}'` : param.default;
        paramStr += ` = ${defaultValue}`;
      }
      return paramStr;
    }).join(', ');

    parts.push(`  constructor(${paramsList}) {`);

    // Add constructor body
    if (constructorSpec.body) {
      const bodyLines = constructorSpec.body.split('\\n');
      bodyLines.forEach(line => {
        parts.push(`    ${line}`);
      });
    }

    parts.push('  }');
    
    return parts.join('\\n');
  }

  _generateProperties(properties) {
    const parts = [];
    
    properties.forEach(prop => {
      if (typeof prop === 'string') {
        parts.push(`  ${prop};`);
      } else {
        let propLine = '  ';
        
        if (prop.static) {
          propLine += 'static ';
        }
        
        if (prop.visibility === 'private') {
          propLine += '#';
        }
        
        propLine += prop.name;
        
        if (prop.value !== undefined) {
          const value = typeof prop.value === 'string' ? `'${prop.value}'` : prop.value;
          propLine += ` = ${value}`;
        }
        
        propLine += ';';
        parts.push(propLine);
      }
    });
    
    return parts;
  }

  _generateMethod(methodSpec) {
    const parts = [];
    
    // Generate method JSDoc
    if (methodSpec.jsdoc || methodSpec.params.length > 0 || methodSpec.returnType) {
      parts.push('  /**');
      
      if (methodSpec.jsdoc && methodSpec.jsdoc.description) {
        parts.push(`   * ${methodSpec.jsdoc.description}`);
      } else {
        parts.push(`   * ${methodSpec.name} method`);
      }
      
      if (methodSpec.params && methodSpec.params.length > 0) {
        methodSpec.params.forEach(param => {
          const paramName = typeof param === 'string' ? param : param.name;
          const paramType = typeof param === 'object' && param.type ? param.type : 'any';
          const paramDesc = typeof param === 'object' && param.description ? param.description : '';
          parts.push(`   * @param {${paramType}} ${paramName} ${paramDesc}`);
        });
      }
      
      if (methodSpec.returnType) {
        parts.push(`   * @returns {${methodSpec.returnType}} ${methodSpec.jsdoc?.returns || ''}`);
      }
      
      if (methodSpec.jsdoc && methodSpec.jsdoc.example) {
        parts.push('   * @example');
        const exampleLines = methodSpec.jsdoc.example.split('\\n');
        exampleLines.forEach(line => {
          parts.push(`   * ${line}`);
        });
      }
      
      parts.push('   */');
    }

    // Generate method signature
    let methodLine = '  ';
    
    if (methodSpec.isStatic) {
      methodLine += 'static ';
    }
    
    if (methodSpec.isAsync) {
      methodLine += 'async ';
    }
    
    if (methodSpec.visibility === 'private') {
      methodLine += '#';
    }
    
    methodLine += methodSpec.name;
    
    // Generate parameters
    const paramsList = (methodSpec.params || []).map(param => {
      if (typeof param === 'string') {
        return param;
      }
      
      let paramStr = param.name;
      if (param.default !== undefined) {
        const defaultValue = typeof param.default === 'string' ? `'${param.default}'` : param.default;
        paramStr += ` = ${defaultValue}`;
      }
      return paramStr;
    }).join(', ');
    
    methodLine += `(${paramsList}) {`;
    parts.push(methodLine);
    
    // Add method body
    const bodyLines = methodSpec.body.split('\\n');
    bodyLines.forEach(line => {
      parts.push(`    ${line}`);
    });
    
    parts.push('  }');
    
    return parts.join('\\n');
  }
}