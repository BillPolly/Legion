/**
 * CNL Parser for Declarative Components
 * Parses Controlled Natural Language into AST nodes
 */

import { CNLGrammar } from './CNLGrammar.js';

export class CNLParser {
  constructor() {
    this.grammar = new CNLGrammar();
    this.lines = [];
    this.currentLine = 0;
    this.currentIndent = 0;
  }

  /**
   * Parse CNL text into AST
   * @param {string} cnlText - The CNL source text
   * @param {Object} options - Parse options
   * @param {boolean} options.toJSON - Convert to JSON format (default: false)
   * @returns {Object} AST representation or JSON component definition
   */
  parse(cnlText, options = {}) {
    // Split into lines and filter empty ones
    this.lines = cnlText
      .split('\n')
      .map(line => ({
        text: line.trimEnd(),
        indent: this.grammar.getIndentLevel(line)
      }))
      .filter(line => line.text.trim().length > 0);

    this.currentLine = 0;

    // Parse the component definition
    const component = this.parseComponent();
    if (!component) {
      throw new Error('CNL must start with a component definition (e.g., "Define ComponentName with data:")');
    }

    // Convert to JSON if requested
    if (options.toJSON) {
      return this.astToJSON(component);
    }

    return component;
  }

  /**
   * Convert AST to JSON component definition format
   * @param {Object} ast - The AST component node
   * @returns {Object} JSON component definition
   */
  astToJSON(ast) {
    const json = {
      name: ast.name,
      entity: ast.parameter || 'data',
      structure: {},
      bindings: [],
      events: [],
      methods: {}
    };

    // Process the body to extract structure, bindings, and events
    let elementCounter = 0;
    let isFirstElement = true;

    const processNode = (node, parentKey = null, depth = 0) => {
      if (!node) return;

      if (node.type === 'element') {
        let key;

        if (isFirstElement && depth === 0) {
          // First top-level element is always 'root'
          key = 'root';
          isFirstElement = false;
        } else if (parentKey) {
          // Child elements use parent_child_N pattern
          key = `${parentKey}_child_${elementCounter++}`;
        } else {
          // Other top-level elements (shouldn't normally happen)
          key = `element_${elementCounter++}`;
        }

        // Build structure entry
        const structEntry = {
          element: node.tag || node.element || 'div'
        };

        if (node.className || node.class) {
          structEntry.class = node.className || node.class;
        }

        if (node.id) {
          structEntry.id = node.id;
        }

        if (node.label || node.text) {
          structEntry.text = node.label || node.text;
        }

        if (node.content) {
          structEntry.text = node.content;
        }

        if (node.binding) {
          structEntry.text = `{${node.binding}}`;
          // Add to bindings array
          json.bindings.push({
            element: key,
            property: 'textContent',
            source: node.binding
          });
        }

        json.structure[key] = structEntry;

        // Process event
        if (node.event) {
          json.events.push({
            element: key,
            type: node.event.type,
            action: node.event.action
          });
        }

        // Process children
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(child => processNode(child, key, depth + 1));
        }
      }
    };

    // Process all body nodes
    if (ast.body && Array.isArray(ast.body)) {
      ast.body.forEach(node => {
        // Handle methods node
        if (node.type === 'methods') {
          // Convert methods array to methods object with correct format
          node.methods.forEach(method => {
            const methodBody = method.body.map(stmt => stmt.code).join('\n');
            json.methods[method.name] = {
              params: method.params || [],
              body: methodBody
            };
          });
        } else {
          // Process other nodes (elements, etc.)
          processNode(node, null, 0);
        }
      });
    }

    return json;
  }

  /**
   * Parse a component definition
   */
  parseComponent() {
    if (this.currentLine >= this.lines.length) {
      return null;
    }
    
    const line = this.lines[this.currentLine];
    const componentDef = this.grammar.parseComponentDefinition(line.text);
    
    if (!componentDef) {
      return null;
    }
    
    this.currentLine++;
    this.currentIndent = this.getNextIndentLevel();
    
    // Parse the component body
    const body = this.parseBlock(this.currentIndent);
    
    return {
      type: 'Component',
      name: componentDef.name,
      parameter: componentDef.parameter,
      body: body
    };
  }

  /**
   * Parse a block of statements at a given indent level
   */
  parseBlock(expectedIndent, allowSameIndent = false) {
    const statements = [];
    
    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];
      
      // Stop if we've dedented
      if (line.indent < expectedIndent) {
        break;
      }
      
      // Skip if we're at a deeper indent (handled by nested blocks)
      // Unless allowSameIndent is true (for "containing:" pattern)
      if (!allowSameIndent && line.indent > expectedIndent) {
        this.currentLine++;
        continue;
      }
      
      // Parse the statement
      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      }
    }
    
    return statements;
  }

  /**
   * Parse a single statement
   */
  parseStatement(inContainingBlock = false) {
    const line = this.lines[this.currentLine];
    const text = line.text.trim();
    
    // Try to parse as different statement types
    let node = null;
    
    // Check for conditional
    node = this.grammar.parseConditional(text);
    if (node) {
      this.currentLine++;
      if (!inContainingBlock && this.isBlockStart()) {
        node.children = this.parseBlock(this.getNextIndentLevel());
      }
      
      // Check for else clause
      if (this.currentLine < this.lines.length) {
        const nextLine = this.lines[this.currentLine];
        if (this.grammar.conditionalPatterns.otherwise.test(nextLine.text.trim())) {
          this.currentLine++;
          node.else = this.parseBlock(this.getNextIndentLevel());
        }
      }
      
      return node;
    }
    
    // Check for iteration
    node = this.grammar.parseIteration(text);
    if (node) {
      this.currentLine++;
      if (!inContainingBlock && this.isBlockStart()) {
        node.children = this.parseBlock(this.getNextIndentLevel());
      }
      return node;
    }

    // Check for methods block
    if (this.grammar.isMethodBlock(text)) {
      this.currentLine++;
      const methodsNode = {
        type: 'methods',
        methods: this.parseMethodsBlock(this.getNextIndentLevel())
      };
      return methodsNode;
    }

    // Check for element with event
    const eventMatch = text.match(/^(.+?)\s+that\s+(.+?)\s+on\s+(\w+)$/);
    if (eventMatch) {
      node = this.grammar.parseElement(eventMatch[1]);
      if (node) {
        node.event = {
          type: this.grammar.normalizeEvent(eventMatch[3]),
          action: this.grammar.parseAction(eventMatch[2])
        };
        this.currentLine++;
        
        if (!inContainingBlock && this.isBlockStart()) {
          node.children = this.parseBlock(this.getNextIndentLevel());
        }
        
        return node;
      }
    }
    
    // Check for element
    node = this.grammar.parseElement(text);
    if (node) {
      this.currentLine++;
      
      // Special handling for "containing:" pattern
      // If element ends with "containing:", following lines at any indent level >= current are children
      // But only apply this if we're not already in a containing block (to prevent recursion)
      if (!inContainingBlock && text.includes('containing:')) {
        node.children = node.children || [];
        
        // Get the minimum expected indent for children
        // They should be at least at the same level as the containing element
        const minChildIndent = line.indent;
        
        // Parse all following lines at same or greater indent as children
        // This handles the case where buttons are not indented extra after "containing:"
        const tempBlock = this.parseContainingBlock(minChildIndent);
        node.children = tempBlock;
      } else if (!inContainingBlock && this.isBlockStart()) {
        // Regular block parsing for indented children
        // But skip this if we're in a containing block (all are siblings there)
        node.children = this.parseBlock(this.getNextIndentLevel());
      }
      
      return node;
    }
    
    // Check for standalone event
    node = this.grammar.parseEvent(text);
    if (node) {
      this.currentLine++;
      return node;
    }
    
    // If nothing matches, treat as text content
    this.currentLine++;
    return {
      type: 'text',
      content: text
    };
  }

  /**
   * Parse a block for "containing:" pattern
   * Accepts children at same or greater indent level
   */
  parseContainingBlock(minIndent) {
    const statements = [];
    
    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];
      
      // Stop if we've dedented below the minimum
      if (line.indent < minIndent) {
        break;
      }
      
      // Parse any line at or above the minimum indent
      // Pass true to indicate we're in a containing block
      const statement = this.parseStatement(true);
      if (statement) {
        statements.push(statement);
      }
    }
    
    return statements;
  }

  /**
   * Check if the current position starts a block
   */
  isBlockStart() {
    if (this.currentLine >= this.lines.length) {
      return false;
    }
    
    const currentIndent = this.lines[this.currentLine - 1]?.indent || 0;
    const nextIndent = this.lines[this.currentLine]?.indent || 0;
    
    return nextIndent > currentIndent;
  }

  /**
   * Get the indent level of the next line
   */
  getNextIndentLevel() {
    if (this.currentLine >= this.lines.length) {
      return 0;
    }
    return this.lines[this.currentLine].indent;
  }

  /**
   * Parse CNL and return both AST and any errors
   */
  parseWithErrors(cnlText) {
    const errors = [];
    let ast = null;
    
    try {
      ast = this.parse(cnlText);
    } catch (error) {
      errors.push({
        line: this.currentLine + 1,
        message: error.message
      });
    }
    
    return { ast, errors };
  }

  /**
   * Parse a methods block
   */
  parseMethodsBlock(expectedIndent) {
    const methods = [];

    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];

      // Stop if we've dedented
      if (line.indent < expectedIndent) {
        break;
      }

      // Parse method definition
      const text = line.text.trim();
      const methodDef = this.grammar.parseMethodDefinition(text);

      if (methodDef) {
        this.currentLine++;

        // Parse method body
        const bodyIndent = this.getNextIndentLevel();
        const body = [];

        while (this.currentLine < this.lines.length) {
          const bodyLine = this.lines[this.currentLine];

          // Stop if we've dedented back to method level or less
          if (bodyLine.indent < bodyIndent) {
            break;
          }

          // Parse method statement
          const bodyText = bodyLine.text.trim();
          const statement = this.grammar.parseMethodStatement(bodyText);

          if (statement) {
            body.push(statement);
          }

          this.currentLine++;
        }

        methodDef.body = body;
        methods.push(methodDef);
      } else {
        // Skip unknown lines
        this.currentLine++;
      }
    }

    return methods;
  }

  /**
   * Validate CNL syntax without full parsing
   */
  validate(cnlText) {
    const { ast, errors } = this.parseWithErrors(cnlText);
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

/**
 * Helper function to parse CNL text
 */
export function parseCNL(cnlText) {
  const parser = new CNLParser();
  return parser.parse(cnlText);
}

/**
 * Helper function to validate CNL text
 */
export function validateCNL(cnlText) {
  const parser = new CNLParser();
  return parser.validate(cnlText);
}