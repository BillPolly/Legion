/**
 * JSGenerator - Generates JavaScript code files and modules
 * 
 * Creates JavaScript files, functions, classes, modules, and API endpoints
 * based on architectural specifications and component definitions.
 */

class JSGenerator {
  constructor(config = {}) {
    this.config = {
      target: 'es2020', // ES version target
      moduleSystem: 'esm', // 'esm', 'cjs', 'umd'
      indentation: 2,
      semicolons: true,
      quotes: 'single',
      trailingComma: true,
      minify: false,
      includeJSDoc: true,
      strictMode: true,
      framework: null, // 'vanilla', 'react', 'vue', etc.
      ...config
    };

    // JavaScript patterns and templates
    this.patterns = {
      function: this._getFunctionPattern(),
      class: this._getClassPattern(),
      module: this._getModulePattern(),
      apiEndpoint: this._getAPIEndpointPattern(),
      eventHandler: this._getEventHandlerPattern()
    };

    // Built-in JavaScript types and utilities
    this.builtInTypes = new Set([
      'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 
      'RegExp', 'Function', 'Promise', 'Set', 'Map', 'WeakSet', 'WeakMap'
    ]);

    // Code cache for performance
    this.codeCache = new Map();
  }

  /**
   * Generate complete JavaScript module
   * 
   * @param {Object} spec - JavaScript module specification
   * @returns {Promise<string>} Generated JavaScript code
   */
  async generateModule(spec) {
    // Validate spec is not null or undefined
    if (!spec) {
      throw new Error('Invalid JS spec');
    }
    
    // If spec has a content field, return it directly with a header
    if (spec.content) {
      const parts = [];
      
      // Add file header comment
      if (spec.header || this.config.includeJSDoc) {
        parts.push(this._generateHeader(spec));
      }
      
      parts.push(spec.content);
      return parts.join('\n\n');
    }
    
    const validation = await this.validateSpec(spec);
    if (!validation.isValid) {
      throw new Error(`Invalid JS spec: ${validation.errors.join(', ')}`);
    }

    const parts = [];

    // Add file header comment
    if (spec.header || this.config.includeJSDoc) {
      parts.push(this._generateHeader(spec));
    }

    // Add strict mode if enabled
    if (this.config.strictMode && this.config.moduleSystem !== 'esm') {
      parts.push("'use strict';");
    }

    // Add imports/requires
    if (spec.imports && spec.imports.length > 0) {
      parts.push(this._generateImports(spec.imports));
    }

    // Add constants and variables
    if (spec.constants) {
      parts.push(this._generateConstants(spec.constants));
    }

    // Add functions
    if (spec.functions) {
      for (const func of spec.functions) {
        parts.push(await this.generateFunction(func));
      }
    }

    // Add classes
    if (spec.classes) {
      for (const cls of spec.classes) {
        parts.push(await this.generateClass(cls));
      }
    }

    // Add main code block
    if (spec.main) {
      parts.push(this._generateMainBlock(spec.main));
    }

    // Add exports
    if (spec.exports) {
      parts.push(this._generateExports(spec.exports));
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate JavaScript function
   * 
   * @param {Object} functionSpec - Function specification
   * @returns {Promise<string>} Generated function code
   */
  async generateFunction(functionSpec) {
    const {
      name,
      params = [],
      returnType,
      body,
      isAsync = false,
      isArrow = false,
      isExport = false,
      isStatic = false,
      jsdoc
    } = functionSpec;

    const parts = [];

    // Add JSDoc if enabled
    if (this.config.includeJSDoc && jsdoc) {
      parts.push(this._generateJSDoc(jsdoc, params, returnType));
    }

    // Build function signature
    let signature = '';
    
    if (isExport) signature += 'export ';
    if (isStatic) signature += 'static ';
    if (isAsync) signature += 'async ';

    if (isArrow) {
      signature += `const ${name} = `;
      if (isAsync) signature += 'async ';
      signature += `(${this._formatParams(params)}) => `;
    } else {
      signature += `function ${name}(${this._formatParams(params)}) `;
    }

    // Generate function body
    const functionBody = body ? this._generateFunctionBody(body) : '  // TODO: Implement function';
    
    if (isArrow && functionBody.split('\n').length === 1) {
      // Single expression arrow function
      parts.push(`${signature}${functionBody.trim()};`);
    } else {
      // Block function
      parts.push(`${signature}{`);
      parts.push(this._indentCode(functionBody));
      parts.push('}');
    }

    return parts.join('\n');
  }

  /**
   * Generate JavaScript class
   * 
   * @param {Object} classSpec - Class specification
   * @returns {Promise<string>} Generated class code
   */
  async generateClass(classSpec) {
    const {
      name,
      extends: superClass,
      constructor: constructorSpec,
      properties = [],
      methods = [],
      staticMethods = [],
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
      classBody.push(await this._generateConstructor(constructorSpec));
    }

    // Add properties
    for (const prop of properties) {
      classBody.push(this._generateProperty(prop));
    }

    // Add static methods
    for (const method of staticMethods) {
      method.isStatic = true;
      classBody.push(await this.generateFunction(method));
    }

    // Add instance methods
    for (const method of methods) {
      classBody.push(await this.generateFunction(method));
    }

    if (classBody.length > 0) {
      parts.push(this._indentCode(classBody.join('\n\n')));
    }

    parts.push('}');

    return parts.join('\n');
  }

  /**
   * Generate API endpoint handler
   * 
   * @param {Object} endpointSpec - API endpoint specification
   * @returns {Promise<string>} Generated endpoint code
   */
  async generateAPIEndpoint(endpointSpec) {
    const {
      method = 'GET',
      path,
      handler,
      middleware = [],
      validation,
      response
    } = endpointSpec;

    const functionName = this._getEndpointFunctionName(method, path);
    
    const functionSpec = {
      name: functionName,
      params: ['req', 'res'],
      isAsync: true,
      jsdoc: {
        description: `Handle ${method} ${path}`,
        params: [
          { name: 'req', type: 'Request', description: 'Express request object' },
          { name: 'res', type: 'Response', description: 'Express response object' }
        ]
      },
      body: this._generateEndpointBody(endpointSpec)
    };

    return this.generateFunction(functionSpec);
  }

  /**
   * Generate event handler code
   * 
   * @param {Object} handlerSpec - Event handler specification
   * @returns {Promise<string>} Generated handler code
   */
  async generateEventHandler(handlerSpec) {
    const {
      element,
      event,
      action,
      preventDefault = false,
      stopPropagation = false
    } = handlerSpec;

    const handlerBody = [];
    
    if (preventDefault) handlerBody.push('event.preventDefault();');
    if (stopPropagation) handlerBody.push('event.stopPropagation();');
    
    handlerBody.push('', action);

    const functionSpec = {
      name: `handle${this._capitalize(event)}`,
      params: ['event'],
      body: handlerBody.join('\n')
    };

    return this.generateFunction(functionSpec);
  }

  /**
   * Validate JavaScript specification
   * 
   * @param {Object} spec - Specification to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSpec(spec) {
    const errors = [];

    if (!spec || typeof spec !== 'object') {
      errors.push('Specification must be an object');
      return { isValid: false, errors };
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

  // Private helper methods

  _generateHeader(spec) {
    const lines = [];
    lines.push('/**');
    
    if (spec.description) {
      lines.push(` * ${spec.description}`);
    } else if (spec.name) {
      lines.push(` * ${spec.name} - Generated JavaScript module`);
    }
    
    if (spec.author) lines.push(` * @author ${spec.author}`);
    if (spec.version) lines.push(` * @version ${spec.version}`);
    
    lines.push(` * @generated ${new Date().toISOString()}`);
    lines.push(' */');
    
    return lines.join('\n');
  }

  _generateImports(imports) {
    return imports.map(imp => {
      if (typeof imp === 'string') {
        // Simple import: "moduleName"
        return `import '${imp}';`;
      } else if (imp.default) {
        // Default import: { default: "name", from: "module" }
        return `import ${imp.default} from '${imp.from}';`;
      } else if (imp.named) {
        // Named imports: { named: ["a", "b"], from: "module" }
        const namedList = Array.isArray(imp.named) ? imp.named.join(', ') : imp.named;
        return `import { ${namedList} } from '${imp.from}';`;
      } else if (imp.namespace) {
        // Namespace import: { namespace: "name", from: "module" }
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
    
    if (returnType) {
      lines.push(` * @returns {${returnType}} ${jsdoc.returns || ''}`);
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

  _generateMainBlock(main) {
    if (typeof main === 'string') return main;
    
    const lines = [];
    lines.push('// Main execution');
    lines.push(main);
    return lines.join('\n');
  }

  _generateEndpointBody(endpointSpec) {
    const lines = ['try {'];
    
    if (endpointSpec.validation) {
      lines.push('  // Request validation');
      lines.push(`  ${endpointSpec.validation}`);
      lines.push('');
    }
    
    lines.push('  // Handler logic');
    if (endpointSpec.handler) {
      lines.push(`  ${endpointSpec.handler}`);
    } else {
      lines.push('  // TODO: Implement endpoint logic');
    }
    
    lines.push('');
    lines.push('  // Send response');
    if (endpointSpec.response) {
      lines.push(`  res.json(${endpointSpec.response});`);
    } else {
      lines.push('  res.json({ success: true });');
    }
    
    lines.push('} catch (error) {');
    lines.push('  console.error(error);');
    lines.push('  res.status(500).json({ error: error.message });');
    lines.push('}');
    
    return lines.join('\n');
  }

  _getEndpointFunctionName(method, path) {
    const cleanPath = path.replace(/[^\w]/g, '');
    return `handle${method.toUpperCase()}${this._capitalize(cleanPath)}`;
  }

  _indentCode(code, level = 1) {
    const indent = ' '.repeat(this.config.indentation * level);
    return code.split('\n').map(line => line.trim() ? `${indent}${line}` : line).join('\n');
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Pattern generators
  _getFunctionPattern() {
    return {
      basic: 'function {name}({params}) {\n  {body}\n}',
      arrow: 'const {name} = ({params}) => {\n  {body}\n}',
      async: 'async function {name}({params}) {\n  {body}\n}',
      asyncArrow: 'const {name} = async ({params}) => {\n  {body}\n}'
    };
  }

  _getClassPattern() {
    return {
      basic: 'class {name} {\n  {body}\n}',
      extends: 'class {name} extends {parent} {\n  {body}\n}'
    };
  }

  _getModulePattern() {
    return {
      esm: 'export { {exports} };\nexport default {default};',
      cjs: 'module.exports = { {exports} };'
    };
  }

  _getAPIEndpointPattern() {
    return {
      express: 'app.{method}(\'{path}\', async (req, res) => {\n  {body}\n});'
    };
  }

  _getEventHandlerPattern() {
    return {
      basic: 'element.addEventListener(\'{event}\', function(event) {\n  {body}\n});',
      arrow: 'element.addEventListener(\'{event}\', (event) => {\n  {body}\n});'
    };
  }
}

export { JSGenerator };