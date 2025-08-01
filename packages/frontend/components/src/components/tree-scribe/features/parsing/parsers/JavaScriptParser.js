/**
 * JavaScriptParser - JavaScript/TypeScript parser for TreeScribe
 * Extracts code structure using pattern matching
 */

import { BaseParser } from '../BaseParser.js';

export class JavaScriptParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'JavaScriptParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx', 'mjs', 'cjs'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'text/javascript',
      'application/javascript',
      'application/x-javascript',
      'text/typescript',
      'application/typescript'
    ];
  }

  /**
   * Check if content can be parsed as JavaScript
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {number} Confidence score (0-1)
   */
  canParse(content, hints = {}) {
    // Check hints first
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Check content for JavaScript patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // JavaScript/TypeScript indicators
    const jsPatterns = [
      { pattern: /^import\s+.*\s+from\s+['"]/, weight: 0.3 },        // ES6 imports
      { pattern: /^export\s+(default\s+)?/, weight: 0.3 },           // ES6 exports
      { pattern: /^const\s+\w+\s*=/, weight: 0.2 },                  // const declarations
      { pattern: /^let\s+\w+\s*=/, weight: 0.2 },                    // let declarations
      { pattern: /^var\s+\w+\s*=/, weight: 0.15 },                   // var declarations
      { pattern: /^function\s+\w+\s*\(/, weight: 0.2 },              // function declarations
      { pattern: /^class\s+\w+/, weight: 0.25 },                     // class declarations
      { pattern: /^interface\s+\w+/, weight: 0.3 },                  // TypeScript interface
      { pattern: /^type\s+\w+\s*=/, weight: 0.3 },                   // TypeScript type
      { pattern: /^enum\s+\w+/, weight: 0.25 },                      // enum declaration
      { pattern: /^\s*\/\*\*[\s\S]*?\*\//, weight: 0.1 },           // JSDoc comments
      { pattern: /^\s*\/\/.*$/, weight: 0.05 },                     // Single line comments
      { pattern: /\w+\s*:\s*\w+(\[\])?[\s,;)]/m, weight: 0.2 },     // TypeScript type annotations
      { pattern: /=>\s*[{(]/, weight: 0.15 },                       // Arrow functions
      { pattern: /\.(then|catch|finally)\s*\(/, weight: 0.1 },      // Promise chains
      { pattern: /async\s+(function|\w+\s*\()/, weight: 0.2 },      // Async functions
      { pattern: /await\s+\w+/, weight: 0.2 }                       // Await expressions
    ];

    let confidence = 0;
    let matchCount = 0;
    
    for (const { pattern, weight } of jsPatterns) {
      if (pattern.test(content)) {
        confidence += weight;
        matchCount++;
      }
    }

    // Boost confidence for multiple matches
    if (matchCount >= 5) {
      confidence = Math.min(confidence * 1.3, 0.95);
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Validate JavaScript content
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    if (!content || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a non-empty string'] 
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Parse JavaScript content into tree structure
   * @param {string} content - JavaScript content
   * @param {Object} options - Parser options
   * @returns {Object} Normalized tree structure
   */
  parse(content, options = {}) {
    try {
      // Validate content first
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Detect if TypeScript
      const isTypeScript = this._isTypeScript(content, options);
      
      // Extract code structure
      const structure = this._extractCodeStructure(content, {
        ...options,
        isTypeScript
      });
      
      // Create root node
      const root = {
        title: options.filename || (isTypeScript ? 'TypeScript Module' : 'JavaScript Module'),
        content: this._extractModuleDescription(content),
        contentType: 'code',
        children: structure,
        metadata: {
          language: isTypeScript ? 'typescript' : 'javascript',
          lineCount: content.split('\n').length,
          hasExports: /export\s+/.test(content),
          hasImports: /import\s+/.test(content)
        }
      };
      
      const normalized = this._normalizeNode(root);
      normalized.sourceFormat = 'javascript';
      
      return normalized;

    } catch (error) {
      console.error('[JavaScriptParser] Parse error:', error);
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'javascript',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Check if content is TypeScript
   * @private
   */
  _isTypeScript(content, options) {
    if (options.format && ['typescript', 'ts', 'tsx'].includes(options.format)) {
      return true;
    }
    
    // Check for TypeScript-specific syntax
    const tsPatterns = [
      /interface\s+\w+/,
      /type\s+\w+\s*=/,
      /enum\s+\w+/,
      /\w+\s*:\s*\w+(\[\])?[\s,;)]/,  // Type annotations
      /<\w+(\s*,\s*\w+)*>/,            // Generic types
      /implements\s+\w+/,
      /namespace\s+\w+/,
      /declare\s+(const|let|var|function|class)/
    ];
    
    return tsPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract module description from top comments
   * @private
   */
  _extractModuleDescription(content) {
    // Check for top-level JSDoc comment
    const jsdocMatch = content.match(/^\/\*\*\s*\n([^*]|\*(?!\/))*\*\//);
    if (jsdocMatch) {
      return this._parseJSDoc(jsdocMatch[0]).description || '';
    }
    
    // Check for top-level single-line comments
    const lines = content.split('\n');
    const topComments = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('//')) {
        topComments.push(line.trim().substring(2).trim());
      } else if (line.trim() && !line.trim().startsWith('/*')) {
        break;
      }
    }
    
    return topComments.join(' ');
  }

  /**
   * Extract code structure
   * @private
   */
  _extractCodeStructure(content, options) {
    const structure = [];
    
    // Extract imports
    const imports = this._extractImports(content);
    if (imports.length > 0) {
      structure.push({
        title: 'Imports',
        content: `${imports.length} import statements`,
        contentType: 'code',
        children: imports
      });
    }
    
    // Extract exports
    const exports = this._extractExports(content);
    
    // Extract classes
    const classes = this._extractClasses(content, options);
    structure.push(...classes);
    
    // Extract functions
    const functions = this._extractFunctions(content, options);
    structure.push(...functions);
    
    // Extract interfaces (TypeScript)
    if (options.isTypeScript) {
      const interfaces = this._extractInterfaces(content);
      structure.push(...interfaces);
      
      // Extract types
      const types = this._extractTypes(content);
      structure.push(...types);
      
      // Extract enums
      const enums = this._extractEnums(content);
      structure.push(...enums);
    }
    
    // Extract top-level variables
    const variables = this._extractTopLevelVariables(content);
    if (variables.length > 0) {
      structure.push({
        title: 'Variables',
        content: `${variables.length} top-level variables`,
        contentType: 'code',
        children: variables
      });
    }
    
    // Add exports summary if any
    if (exports.length > 0) {
      structure.push({
        title: 'Exports',
        content: `${exports.length} exported items`,
        contentType: 'code',
        children: exports
      });
    }
    
    return structure;
  }

  /**
   * Extract import statements
   * @private
   */
  _extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(.+?)\s+from\s+['"](.+?)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const what = match[1].trim();
      const from = match[2];
      
      imports.push({
        title: from,
        content: `import ${what}`,
        contentType: 'code',
        metadata: { 
          importType: what.startsWith('{') ? 'named' : 'default',
          source: from 
        }
      });
    }
    
    return imports;
  }

  /**
   * Extract classes
   * @private
   */
  _extractClasses(content, options) {
    const classes = [];
    const classRegex = /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*{/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      const implementsClause = match[3];
      
      // Find class body
      const classStart = match.index;
      const classBody = this._extractBlockContent(content, classStart + match[0].length - 1);
      
      // Extract class members
      const methods = this._extractClassMethods(classBody);
      const properties = this._extractClassProperties(classBody);
      
      // Check for JSDoc
      const jsdoc = this._extractPrecedingJSDoc(content, classStart);
      
      classes.push({
        title: `class ${className}`,
        content: jsdoc.description || `Class ${className}${extendsClass ? ` extends ${extendsClass}` : ''}`,
        contentType: 'code',
        metadata: {
          className,
          extends: extendsClass,
          implements: implementsClause ? implementsClause.split(',').map(i => i.trim()) : [],
          exported: /export/.test(match[0]),
          abstract: /abstract/.test(match[0])
        },
        children: [...properties, ...methods]
      });
    }
    
    return classes;
  }

  /**
   * Extract functions
   * @private
   */
  _extractFunctions(content, options) {
    const functions = [];
    
    // Regular function declarations
    const funcRegex = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      const params = match[2];
      
      // Check if this function is inside a class
      if (this._isInsideClass(content, match.index)) {
        continue;
      }
      
      // Get JSDoc
      const jsdoc = this._extractPrecedingJSDoc(content, match.index);
      
      functions.push({
        title: `function ${funcName}`,
        content: jsdoc.description || `${match[0]}`,
        contentType: 'code',
        metadata: {
          functionName: funcName,
          parameters: this._parseParameters(params),
          async: /async/.test(match[0]),
          exported: /export/.test(match[0]),
          jsdoc
        }
      });
    }
    
    // Arrow functions assigned to const/let
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
    
    while ((match = arrowRegex.exec(content)) !== null) {
      const funcName = match[1];
      const params = match[2];
      
      functions.push({
        title: `${funcName} (arrow)`,
        content: `Arrow function ${funcName}`,
        contentType: 'code',
        metadata: {
          functionName: funcName,
          parameters: this._parseParameters(params),
          async: /async/.test(match[0]),
          exported: /export/.test(match[0]),
          arrow: true
        }
      });
    }
    
    return functions;
  }

  /**
   * Extract interfaces (TypeScript)
   * @private
   */
  _extractInterfaces(content) {
    const interfaces = [];
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([\w\s,<>]+))?\s*{/g;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const extendsClause = match[2];
      
      // Find interface body
      const interfaceStart = match.index;
      const interfaceBody = this._extractBlockContent(content, interfaceStart + match[0].length - 1);
      
      // Extract interface members
      const members = this._extractInterfaceMembers(interfaceBody);
      
      interfaces.push({
        title: `interface ${interfaceName}`,
        content: `TypeScript interface`,
        contentType: 'code',
        metadata: {
          interfaceName,
          extends: extendsClause ? extendsClause.split(',').map(e => e.trim()) : [],
          exported: /export/.test(match[0])
        },
        children: members
      });
    }
    
    return interfaces;
  }

  /**
   * Extract type aliases (TypeScript)
   * @private
   */
  _extractTypes(content) {
    const types = [];
    const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/g;
    let match;
    
    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      const typeDefinition = match[2].trim();
      
      types.push({
        title: `type ${typeName}`,
        content: typeDefinition,
        contentType: 'code',
        metadata: {
          typeName,
          exported: /export/.test(match[0])
        }
      });
    }
    
    return types;
  }

  /**
   * Extract enums (TypeScript)
   * @private
   */
  _extractEnums(content) {
    const enums = [];
    const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*{/g;
    let match;
    
    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      
      // Find enum body
      const enumStart = match.index;
      const enumBody = this._extractBlockContent(content, enumStart + match[0].length - 1);
      
      // Extract enum members
      const members = this._extractEnumMembers(enumBody);
      
      enums.push({
        title: `enum ${enumName}`,
        content: `Enumeration with ${members.length} values`,
        contentType: 'code',
        metadata: {
          enumName,
          exported: /export/.test(match[0])
        },
        children: members
      });
    }
    
    return enums;
  }

  /**
   * Extract exports
   * @private
   */
  _extractExports(content) {
    const exports = [];
    
    // Named exports
    const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      const items = match[1].split(',').map(item => item.trim());
      items.forEach(item => {
        const [name, alias] = item.split(/\s+as\s+/).map(s => s.trim());
        exports.push({
          title: alias || name,
          content: `Named export${alias ? ` (as ${alias})` : ''}`,
          contentType: 'code',
          metadata: { exportType: 'named', originalName: name }
        });
      });
    }
    
    // Default export
    if (/export\s+default\s+/.test(content)) {
      exports.push({
        title: 'default',
        content: 'Default export',
        contentType: 'code',
        metadata: { exportType: 'default' }
      });
    }
    
    return exports;
  }

  /**
   * Helper methods
   * @private
   */
  
  _extractBlockContent(content, startPos) {
    let depth = 1;
    let pos = startPos + 1;
    
    while (pos < content.length && depth > 0) {
      if (content[pos] === '{') depth++;
      else if (content[pos] === '}') depth--;
      pos++;
    }
    
    return content.substring(startPos + 1, pos - 1);
  }

  _extractPrecedingJSDoc(content, position) {
    const before = content.substring(0, position);
    const jsdocMatch = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    
    if (jsdocMatch) {
      return this._parseJSDoc(jsdocMatch[0]);
    }
    
    return { description: '' };
  }

  _parseJSDoc(jsdoc) {
    const lines = jsdoc.split('\n').map(line => 
      line.replace(/^\s*\/?\*+\/?/, '').trim()
    );
    
    const description = [];
    const tags = {};
    
    for (const line of lines) {
      if (line.startsWith('@')) {
        const [tag, ...rest] = line.split(/\s+/);
        tags[tag] = rest.join(' ');
      } else if (line) {
        description.push(line);
      }
    }
    
    return {
      description: description.join(' '),
      ...tags
    };
  }

  _isInsideClass(content, position) {
    const before = content.substring(0, position);
    const classStarts = (before.match(/class\s+\w+[^{]*{/g) || []).length;
    const classEnds = (before.match(/^}/gm) || []).length;
    
    return classStarts > classEnds;
  }

  _parseParameters(params) {
    if (!params.trim()) return [];
    
    return params.split(',').map(param => {
      const parts = param.trim().split(/:\s*/);
      return {
        name: parts[0].trim(),
        type: parts[1] ? parts[1].trim() : null
      };
    });
  }

  _extractClassMethods(classBody) {
    const methods = [];
    const methodRegex = /(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?(\w+)\s*\([^)]*\)/g;
    let match;
    
    while ((match = methodRegex.exec(classBody)) !== null) {
      if (match[1] !== 'constructor') {
        methods.push({
          title: match[1],
          content: match[0],
          contentType: 'code',
          metadata: { 
            methodType: /get\s+/.test(match[0]) ? 'getter' : 
                       /set\s+/.test(match[0]) ? 'setter' : 'method',
            static: /static/.test(match[0]),
            async: /async/.test(match[0])
          }
        });
      }
    }
    
    return methods;
  }

  _extractClassProperties(classBody) {
    const properties = [];
    const propRegex = /^\s*(?:static\s+)?(?:readonly\s+)?(\w+)(?:\s*:\s*([^;=]+))?(?:\s*=\s*([^;]+))?;/gm;
    let match;
    
    while ((match = propRegex.exec(classBody)) !== null) {
      properties.push({
        title: match[1],
        content: `Property${match[2] ? `: ${match[2]}` : ''}`,
        contentType: 'code',
        metadata: {
          propertyName: match[1],
          type: match[2],
          initialValue: match[3],
          static: /static/.test(match[0]),
          readonly: /readonly/.test(match[0])
        }
      });
    }
    
    return properties;
  }

  _extractInterfaceMembers(interfaceBody) {
    const members = [];
    const memberRegex = /^\s*(?:readonly\s+)?(\w+)(?:\?)?:\s*([^;]+);/gm;
    let match;
    
    while ((match = memberRegex.exec(interfaceBody)) !== null) {
      members.push({
        title: match[1],
        content: match[2].trim(),
        contentType: 'code',
        metadata: {
          memberName: match[1],
          type: match[2].trim(),
          optional: match[0].includes('?'),
          readonly: /readonly/.test(match[0])
        }
      });
    }
    
    return members;
  }

  _extractEnumMembers(enumBody) {
    const members = [];
    const memberRegex = /^\s*(\w+)(?:\s*=\s*([^,\n]+))?/gm;
    let match;
    
    while ((match = memberRegex.exec(enumBody)) !== null) {
      members.push({
        title: match[1],
        content: match[2] ? `= ${match[2].trim()}` : 'Auto-assigned',
        contentType: 'code',
        metadata: {
          memberName: match[1],
          value: match[2] ? match[2].trim() : null
        }
      });
    }
    
    return members;
  }

  _extractTopLevelVariables(content) {
    const variables = [];
    const varRegex = /^(?:export\s+)?(?:const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/gm;
    let match;
    
    while ((match = varRegex.exec(content)) !== null) {
      // Skip if inside a function or class
      if (!this._isTopLevel(content, match.index)) {
        continue;
      }
      
      variables.push({
        title: match[1],
        content: `${match[0].includes('const') ? 'const' : match[0].includes('let') ? 'let' : 'var'}${match[2] ? `: ${match[2].trim()}` : ''}`,
        contentType: 'code',
        metadata: {
          variableName: match[1],
          type: match[2] ? match[2].trim() : null,
          kind: match[0].includes('const') ? 'const' : match[0].includes('let') ? 'let' : 'var',
          exported: /export/.test(match[0])
        }
      });
    }
    
    return variables;
  }

  _isTopLevel(content, position) {
    const before = content.substring(0, position);
    const openBraces = (before.match(/{/g) || []).length;
    const closeBraces = (before.match(/}/g) || []).length;
    
    return openBraces === closeBraces;
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: true,
      features: [
        'ast-like-extraction',
        'class-hierarchy',
        'function-detection',
        'typescript-support',
        'jsdoc-parsing',
        'import-export-tracking'
      ]
    };
  }
}