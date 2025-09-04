/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateJavaScriptModuleTool - Generate complete JavaScript modules
 * 
 * Extracted and adapted from code-agent JSGenerator for Legion framework
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

// Input schema as plain JSON Schema
const generateJavaScriptModuleToolInputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Name of the module'
    },
    description: {
      type: 'string',
      description: 'Module description for header comment'
    },
    imports: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          default: { type: 'string' },
          named: {
            type: 'array',
            items: { type: 'string' }
          },
          namespace: { type: 'string' }
        }
      },
      description: 'Array of import statements'
    },
    constants: {
      type: 'object',
      additionalProperties: true,
      description: 'Object of constant definitions'
    },
    functions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          params: {
            type: 'array',
            items: {}
          },
          body: { type: 'string' },
          isAsync: { type: 'boolean' },
          isExport: { type: 'boolean' },
          jsdoc: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['name']
      },
      description: 'Array of function definitions'
    },
    classes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          extends: { type: 'string' },
          constructor: {
            type: 'object',
            additionalProperties: true
          },
          methods: {
            type: 'array',
            items: {}
          },
          properties: {
            type: 'array',
            items: {}
          },
          isExport: { type: 'boolean' }
        },
        required: ['name']
      },
      description: 'Array of class definitions'
    },
    exports: {
      type: 'object',
      properties: {
        default: { type: 'string' },
        named: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      description: 'Export statements'
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
    },
    includeMain: {
      type: 'boolean',
      default: false,
      description: 'Whether to include a main execution block'
    },
    mainFunction: {
      type: 'string',
      description: 'Code to execute in the main block (when includeMain is true)'
    }
  },
  required: ['name']
};

// Output schema as plain JSON Schema
const generateJavaScriptModuleToolOutputSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Generated JavaScript module code'
    },
    filename: {
      type: 'string',
      description: 'Suggested filename for the module'
    },
    linesOfCode: {
      type: 'number',
      description: 'Number of lines generated'
    },
    components: {
      type: 'object',
      properties: {
        functions: { type: 'number' },
        classes: { type: 'number' },
        imports: { type: 'number' },
        exports: { type: 'number' }
      },
      required: ['functions', 'classes', 'imports', 'exports']
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
  required: ['code', 'filename', 'linesOfCode', 'components', 'written']
};

export class GenerateJavaScriptModuleTool extends Tool {
  constructor() {
    super({
      name: 'generate_javascript_module',
      description: 'Generate a complete JavaScript module with imports, exports, functions, and classes',
      inputSchema: generateJavaScriptModuleToolInputSchema,
      outputSchema: generateJavaScriptModuleToolOutputSchema
    });

    // Configuration options
    this.config = {
      target: 'es2020',
      moduleSystem: 'esm',
      indentation: 2,
      semicolons: true,
      quotes: 'single',
      trailingComma: true,
      includeJSDoc: true,
      strictMode: true
    };
  }

  async _execute(args) {
    try {
      this.emit('progress', { percentage: 10, status: 'Validating module specification...' });
      
      const validation = this._validateSpec(args);
      if (!validation.isValid) {
        throw new Error(`Invalid module spec: ${validation.errors.join(', ')}`);
      }

      this.emit('progress', { percentage: 30, status: 'Generating module code...' });

      const parts = [];
      let components = { functions: 0, classes: 0, imports: 0, exports: 0 };

      // Add file header comment
      if (args.description || this.config.includeJSDoc) {
        parts.push(this._generateHeader(args));
      }

      // Add strict mode if enabled
      if (this.config.strictMode && this.config.moduleSystem !== 'esm') {
        parts.push("'use strict';");
      }

      // Add imports/requires
      if (args.imports && args.imports.length > 0) {
        parts.push(this._generateImports(args.imports));
        components.imports = args.imports.length;
      }

      this.emit('progress', { percentage: 50, status: 'Generating constants and functions...' });

      // Add constants and variables
      if (args.constants) {
        parts.push(this._generateConstants(args.constants));
      }

      // Add functions
      if (args.functions) {
        for (const func of args.functions) {
          parts.push(this._generateFunction(func));
          components.functions++;
        }
      }

      this.emit('progress', { percentage: 70, status: 'Generating classes...' });

      // Add classes
      if (args.classes) {
        for (const cls of args.classes) {
          parts.push(this._generateClass(cls));
          components.classes++;
        }
      }

      // Add exports
      if (args.exports) {
        parts.push(this._generateExports(args.exports));
        components.exports = (args.exports.named?.length || 0) + (args.exports.default ? 1 : 0);
      }

      // Add main execution block if requested
      if (args.includeMain && args.mainFunction) {
        parts.push('// Call the main function');
        parts.push(args.mainFunction);
      }

      this.emit('progress', { percentage: 90, status: 'Finalizing module...' });

      const code = parts.filter(Boolean).join('\n\n');
      const linesOfCode = code.split('\n').length;
      const filename = this._generateFilename(args.name);

      this.emit('progress', { percentage: 95, status: 'Module generation complete' });

      const result = {
        code,
        filename,
        linesOfCode,
        components,
        written: false
      };

      // Handle file writing if requested
      if (args.writeToFile && args.projectPath) {
        this.emit('progress', { percentage: 98, status: 'Writing file to disk...' });
        
        try {
          // Determine output path
          const outputPath = args.outputPath || `src/${filename}`;
          const fullPath = path.join(args.projectPath, outputPath);
          
          // Ensure directory exists
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          
          // Write file
          await fs.writeFile(fullPath, code, 'utf8');
          
          result.filePath = fullPath;
          result.written = true;
          
          this.emit('progress', { percentage: 100, status: `File written to ${fullPath}` });
        } catch (error) {
          this.emit('error', { message: `Failed to write file: ${error.message}` });
          // Don't throw - return the generated code even if file writing fails
          result.written = false;
        }
      } else {
        this.emit('progress', { percentage: 100, status: 'Module generation complete' });
      }

      return result;

    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }

  _validateSpec(spec) {
    const errors = [];

    if (!spec || typeof spec !== 'object') {
      errors.push('Specification must be an object');
      return { isValid: false, errors };
    }

    if (!spec.name) {
      errors.push('Module name is required');
    }

    // Validate imports
    if (spec.imports && !Array.isArray(spec.imports)) {
      errors.push('Imports must be an array');
    }

    // Validate functions
    if (spec.functions) {
      if (!Array.isArray(spec.functions)) {
        errors.push('Functions must be an array');
      } else {
        spec.functions.forEach((func, index) => {
          if (!func.name) errors.push(`Function at index ${index} missing name`);
        });
      }
    }

    // Validate classes
    if (spec.classes) {
      if (!Array.isArray(spec.classes)) {
        errors.push('Classes must be an array');
      } else {
        spec.classes.forEach((cls, index) => {
          if (!cls.name) errors.push(`Class at index ${index} missing name`);
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  _generateHeader(spec) {
    const lines = [];
    lines.push('/**');
    
    if (spec.description) {
      lines.push(` * ${spec.description}`);
    } else if (spec.name) {
      lines.push(` * ${spec.name} - Generated JavaScript module`);
    }
    
    lines.push(` * @generated ${new Date().toISOString()}`);
    lines.push(' */');
    
    return lines.join('\n');
  }

  _generateImports(imports) {
    return imports.map(imp => {
      if (typeof imp === 'string') {
        return `import '${imp}';`;
      } else if (imp.default) {
        return `import ${imp.default} from '${imp.from}';`;
      } else if (imp.named) {
        const namedList = Array.isArray(imp.named) ? imp.named.join(', ') : imp.named;
        return `import { ${namedList} } from '${imp.from}';`;
      } else if (imp.namespace) {
        return `import * as ${imp.namespace} from '${imp.from}';`;
      }
      return '';
    }).filter(Boolean).join('\n');
  }

  _generateConstants(constants) {
    return Object.entries(constants).map(([name, value]) => {
      const formattedValue = typeof value === 'string' 
        ? `'${value}'` 
        : JSON.stringify(value);
      return `const ${name} = ${formattedValue};`;
    }).join('\n');
  }

  _generateFunction(functionSpec) {
    const {
      name,
      params = [],
      body,
      isAsync = false,
      isExport = false,
      jsdoc
    } = functionSpec;

    const parts = [];

    // Add JSDoc if enabled
    if (this.config.includeJSDoc && jsdoc) {
      parts.push(this._generateJSDoc(jsdoc, params));
    }

    // Build function signature
    let signature = '';
    
    if (isExport) signature += 'export ';
    if (isAsync) signature += 'async ';
    signature += `function ${name}(${this._formatParams(params)}) `;

    // Generate function body
    const functionBody = body ? this._generateFunctionBody(body) : '  // TODO: Implement function';
    
    parts.push(`${signature}{`);
    parts.push(this._indentCode(functionBody));
    parts.push('}');

    return parts.join('\n');
  }

  _generateClass(classSpec) {
    const {
      name,
      extends: superClass,
      constructor: constructorSpec,
      properties = [],
      methods = [],
      isExport = false,
      jsdoc
    } = classSpec;

    const parts = [];

    // Add JSDoc if enabled
    if (this.config.includeJSDoc && jsdoc) {
      parts.push(this._generateClassJSDoc(jsdoc));
    }

    // Class declaration
    let declaration = '';
    if (isExport) declaration += 'export ';
    declaration += `class ${name}`;
    if (superClass) declaration += ` extends ${superClass}`;
    declaration += ' {';

    parts.push(declaration);

    const classBody = [];

    // Add constructor
    if (constructorSpec) {
      classBody.push(this._generateConstructor(constructorSpec));
    }

    // Add properties
    for (const prop of properties) {
      classBody.push(this._generateProperty(prop));
    }

    // Add methods
    for (const method of methods) {
      classBody.push(this._generateFunction(method));
    }

    if (classBody.length > 0) {
      parts.push(this._indentCode(classBody.join('\n\n')));
    }

    parts.push('}');

    return parts.join('\n');
  }

  _generateExports(exports) {
    if (typeof exports === 'string') {
      return `export default ${exports};`;
    } else if (Array.isArray(exports)) {
      return `export { ${exports.join(', ')} };`;
    } else if (exports.default) {
      return `export default ${exports.default};`;
    } else if (exports.named) {
      return `export { ${exports.named.join(', ')} };`;
    }
    return '';
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

  _generateJSDoc(jsdoc, params = []) {
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
    
    if (jsdoc.returns) {
      lines.push(` * @returns {any} ${jsdoc.returns}`);
    }
    
    lines.push(' */');
    return lines.join('\n');
  }

  _generateClassJSDoc(jsdoc) {
    const lines = ['/**'];
    lines.push(` * ${jsdoc.description || 'Generated class'}`);
    if (jsdoc.example) {
      lines.push(' * @example');
      lines.push(` * ${jsdoc.example}`);
    }
    lines.push(' */');
    return lines.join('\n');
  }

  _generateConstructor(constructorSpec) {
    const body = this._generateFunctionBody(constructorSpec.body || 'super();');
    return `constructor(${this._formatParams(constructorSpec.params || [])}) {\n${this._indentCode(body)}\n}`;
  }

  _generateProperty(prop) {
    if (typeof prop === 'string') {
      return `${prop};`;
    }
    
    const { name, value, static: isStatic = false } = prop;
    let declaration = '';
    if (isStatic) declaration += 'static ';
    declaration += name;
    if (value !== undefined) {
      const formattedValue = typeof value === 'string' ? `'${value}'` : JSON.stringify(value);
      declaration += ` = ${formattedValue}`;
    }
    declaration += ';';
    
    return declaration;
  }

  _indentCode(code, level = 1) {
    const indent = ' '.repeat(this.config.indentation * level);
    return code.split('\n').map(line => line.trim() ? `${indent}${line}` : line).join('\n');
  }

  _generateFilename(name) {
    // Convert camelCase or PascalCase to kebab-case
    const kebabName = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return `${kebabName}.js`;
  }
}