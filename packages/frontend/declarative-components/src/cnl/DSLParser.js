/**
 * DSL Parser for Declarative Components
 * Parses DSL syntax into AST for conversion to CNL
 */

export class DSLParser {
  constructor() {
    this.tokens = [];
    this.position = 0;
  }

  /**
   * Parse DSL text into AST
   * @param {string} dslText - The DSL source text
   * @returns {Object} AST representation
   */
  parse(dslText) {
    this.tokens = this.tokenize(dslText);
    this.position = 0;
    
    return this.parseComponent();
  }

  /**
   * Tokenize DSL text
   */
  tokenize(text) {
    const tokens = [];
    const patterns = [
      { type: 'COMPONENT_DEF', regex: /^(\w+)\s*::\s*(\w+)\s*=>/ },
      { type: 'IF', regex: /^if\s*\(/ },
      { type: 'ELSE', regex: /^else/ },
      { type: 'FOR', regex: /^for\s+(\w+)\s+in\s+(\S+)/ },
      { type: 'ELEMENT', regex: /^(\w+)(?:\.([.\w-]+))?/ },
      { type: 'EVENT', regex: /^@(\w+)="([^"]*)"/ },
      { type: 'ATTRIBUTE', regex: /^\[([^\]]+)\]/ },
      { type: 'CONTENT', regex: /^\{([^}]*)\}/ },
      { type: 'STRING', regex: /^"([^"]*)"/ },
      { type: 'OPEN_BRACKET', regex: /^\[/ },
      { type: 'CLOSE_BRACKET', regex: /^\]/ },
      { type: 'OPEN_PAREN', regex: /^\(/ },
      { type: 'CLOSE_PAREN', regex: /^\)/ },
      { type: 'OPERATOR', regex: /^[+\-*/=!<>?:]+/ },
      { type: 'IDENTIFIER', regex: /^[\w.]+/ },
      { type: 'WHITESPACE', regex: /^\s+/ },
      { type: 'NEWLINE', regex: /^\n/ }
    ];

    let remaining = text;
    let line = 1;
    let column = 1;

    while (remaining.length > 0) {
      let matched = false;

      for (const pattern of patterns) {
        const match = remaining.match(pattern.regex);
        if (match) {
          if (pattern.type !== 'WHITESPACE') {
            tokens.push({
              type: pattern.type,
              value: match[0],
              captures: match.slice(1),
              line,
              column
            });
          }

          const consumed = match[0];
          remaining = remaining.slice(consumed.length);
          
          if (pattern.type === 'NEWLINE') {
            line++;
            column = 1;
          } else {
            column += consumed.length;
          }
          
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Skip single character if no pattern matches
        remaining = remaining.slice(1);
        column++;
      }
    }

    return tokens;
  }

  /**
   * Parse component definition
   */
  parseComponent() {
    const token = this.expect('COMPONENT_DEF');
    const [name, parameter] = token.captures;

    const body = this.parseBody();

    return {
      type: 'Component',
      name,
      parameter,
      body
    };
  }

  /**
   * Parse component body
   */
  parseBody() {
    const statements = [];

    // Skip newlines
    this.skipNewlines();

    // Check if body is a block or single statement
    if (this.peek()?.type === 'OPEN_BRACKET') {
      this.consume('OPEN_BRACKET');
      this.skipNewlines();

      while (this.peek()?.type !== 'CLOSE_BRACKET' && !this.isAtEnd()) {
        const stmt = this.parseStatement();
        if (stmt) {
          statements.push(stmt);
        }
        this.skipNewlines();
      }

      this.expect('CLOSE_BRACKET');
    } else {
      // Single statement body
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    return statements;
  }

  /**
   * Parse a statement
   */
  parseStatement() {
    const token = this.peek();
    if (!token) return null;

    switch (token.type) {
      case 'IF':
        return this.parseConditional();
      
      case 'FOR':
        return this.parseIteration();
      
      case 'ELEMENT':
        return this.parseElement();
      
      case 'STRING':
        this.consume();
        return {
          type: 'text',
          content: token.captures[0]
        };
      
      default:
        // Try to parse as element
        if (token.type === 'IDENTIFIER') {
          return this.parseElement();
        }
        this.consume(); // Skip unknown token
        return null;
    }
  }

  /**
   * Parse element
   */
  parseElement() {
    const elementToken = this.expect('ELEMENT');
    const [tag, classNames] = elementToken.captures;

    const node = {
      type: 'element',
      tag
    };

    // Parse class names
    if (classNames) {
      const classes = classNames.split('.').filter(c => c);
      if (classes.length > 0) {
        node.className = classes.join(' ');
      }
    }

    // Parse attributes and events
    while (true) {
      const next = this.peek();
      if (!next) break;

      if (next.type === 'EVENT') {
        this.consume();
        const [eventType, action] = next.captures;
        node.event = {
          type: eventType,
          action: this.parseAction(action)
        };
      } else if (next.type === 'ATTRIBUTE') {
        this.consume();
        const attrContent = next.captures[0];
        // Parse attribute content
        if (attrContent.includes('=')) {
          const [key, value] = attrContent.split('=').map(s => s.trim());
          if (key === 'placeholder') {
            node.placeholder = value.replace(/['"]/g, '');
          } else if (key === 'type' && value === 'checkbox') {
            node.tag = 'input';
            node.inputType = 'checkbox';
          }
        }
      } else if (next.type === 'CONTENT') {
        this.consume();
        const content = next.captures[0].trim();
        
        // Check if it's a binding or literal
        if (content.startsWith('"') && content.endsWith('"')) {
          node.content = content.slice(1, -1);
        } else {
          node.binding = this.parseBinding(content);
        }
        break;
      } else if (next.type === 'OPEN_BRACKET') {
        // Has children
        node.children = this.parseChildren();
        break;
      } else {
        break;
      }
    }

    return node;
  }

  /**
   * Parse children elements
   */
  parseChildren() {
    const children = [];
    
    this.expect('OPEN_BRACKET');
    this.skipNewlines();

    while (this.peek()?.type !== 'CLOSE_BRACKET' && !this.isAtEnd()) {
      const child = this.parseStatement();
      if (child) {
        children.push(child);
      }
      this.skipNewlines();
    }

    this.expect('CLOSE_BRACKET');
    
    return children;
  }

  /**
   * Parse conditional statement
   */
  parseConditional() {
    this.expect('IF');
    this.expect('OPEN_PAREN');
    
    const condition = this.parseCondition();
    
    this.expect('CLOSE_PAREN');
    
    const node = {
      type: 'conditional',
      condition,
      children: []
    };

    // Parse then block
    if (this.peek()?.type === 'OPEN_BRACKET') {
      node.children = this.parseChildren();
    } else {
      const stmt = this.parseStatement();
      if (stmt) {
        node.children = [stmt];
      }
    }

    // Check for else
    if (this.peek()?.type === 'ELSE') {
      this.consume('ELSE');
      
      if (this.peek()?.type === 'OPEN_BRACKET') {
        node.else = this.parseChildren();
      } else {
        const stmt = this.parseStatement();
        if (stmt) {
          node.else = [stmt];
        }
      }
    }

    return node;
  }

  /**
   * Parse iteration statement
   */
  parseIteration() {
    const forToken = this.expect('FOR');
    const [variable, collection] = forToken.captures;

    const node = {
      type: 'iteration',
      variable,
      collection,
      children: []
    };

    // Parse iteration body
    if (this.peek()?.type === 'OPEN_BRACKET') {
      node.children = this.parseChildren();
    } else {
      const stmt = this.parseStatement();
      if (stmt) {
        node.children = [stmt];
      }
    }

    return node;
  }

  /**
   * Parse condition expression
   */
  parseCondition() {
    let condition = '';
    let depth = 0;

    while (!this.isAtEnd()) {
      const token = this.peek();
      
      if (token.type === 'OPEN_PAREN') {
        depth++;
        condition += token.value;
        this.consume();
      } else if (token.type === 'CLOSE_PAREN') {
        if (depth === 0) {
          break;
        }
        depth--;
        condition += token.value;
        this.consume();
      } else {
        condition += token.value;
        this.consume();
      }
    }

    return condition.trim();
  }

  /**
   * Parse binding expression
   */
  parseBinding(expr) {
    // Clean up binding expression
    expr = expr.trim();
    
    // Handle concatenation
    if (expr.includes('+')) {
      return expr;
    }
    
    // Handle ternary
    if (expr.includes('?')) {
      return expr;
    }
    
    // Handle property access
    if (expr.includes('.')) {
      const parts = expr.split('.');
      if (parts[0] === 'state' || parts[0] === 'data') {
        return parts.slice(1).join('.');
      }
      return expr;
    }
    
    return expr;
  }

  /**
   * Parse action expression
   */
  parseAction(action) {
    action = action.trim();
    
    // Handle increment/decrement
    if (action.endsWith('++')) {
      const variable = action.slice(0, -2).trim();
      return `increments the ${this.cleanVariable(variable)}`;
    }
    
    if (action.endsWith('--')) {
      const variable = action.slice(0, -2).trim();
      return `decrements the ${this.cleanVariable(variable)}`;
    }
    
    // Handle toggle
    if (action.includes('= !')) {
      const parts = action.split('=');
      const variable = parts[0].trim();
      return `toggles ${this.cleanVariable(variable)}`;
    }
    
    // Handle assignment
    if (action.includes('=')) {
      const parts = action.split('=');
      const variable = parts[0].trim();
      const value = parts[1].trim();
      return `sets the ${this.cleanVariable(variable)} to ${value}`;
    }
    
    // Handle function call
    if (action.includes('(')) {
      const funcName = action.split('(')[0].trim();
      return `calls ${funcName}`;
    }
    
    return action;
  }

  /**
   * Clean variable name for natural language
   */
  cleanVariable(variable) {
    if (variable.startsWith('state.')) {
      return variable.slice(6);
    }
    if (variable.startsWith('data.')) {
      return variable.slice(5);
    }
    return variable;
  }

  /**
   * Helper methods
   */
  peek() {
    return this.tokens[this.position];
  }

  consume(expectedType = null) {
    const token = this.tokens[this.position];
    if (expectedType && token?.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${token?.type}`);
    }
    this.position++;
    return token;
  }

  expect(type) {
    const token = this.consume();
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type} but got ${token?.type || 'EOF'}`);
    }
    return token;
  }

  skipNewlines() {
    while (this.peek()?.type === 'NEWLINE') {
      this.consume();
    }
  }

  isAtEnd() {
    return this.position >= this.tokens.length;
  }
}

/**
 * Parse DSL text directly to AST
 * @param {string} dslText - The DSL source text
 * @returns {Object} AST
 */
export function parseDSL(dslText) {
  const parser = new DSLParser();
  return parser.parse(dslText);
}

/**
 * Validate DSL syntax
 * @param {string} dslText - The DSL source text
 * @returns {Object} Validation result
 */
export function validateDSL(dslText) {
  try {
    const parser = new DSLParser();
    parser.parse(dslText);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}