/**
 * Parser for the Declarative Components DSL
 * Converts tokens into an Abstract Syntax Tree (AST)
 */

import { Tokenizer } from './Tokenizer.js';

export class Parser {
  constructor(input) {
    this.tokenizer = new Tokenizer(input);
    this.tokens = this.tokenizer.tokenize();
    this.current = 0;
  }

  /**
   * Parse the DSL into an AST
   * @returns {Object} AST root node
   */
  parse() {
    return this.parseComponent();
  }

  /**
   * Parse a component declaration
   * @returns {Object} Component AST node
   */
  parseComponent() {
    // ComponentName :: entityParam => body
    const name = this.consume('IDENTIFIER', 'Expected component name');
    this.consume('DOUBLE_COLON', 'Expected :: after component name');
    const entityParam = this.consume('IDENTIFIER', 'Expected entity parameter');
    this.consume('ARROW', 'Expected => after entity parameter');
    const body = this.parseElement();
    
    return {
      type: 'Component',
      name: name.value,
      entityParam: entityParam.value,
      body
    };
  }

  /**
   * Parse an element
   * @returns {Object} Element AST node
   */
  parseElement() {
    // Check for control flow structures
    if (this.check('IF')) {
      return this.parseIf();
    }
    
    if (this.check('FOR')) {
      return this.parseFor();
    }
    
    // Check for children blocks (hierarchical components)
    if (this.check('CHILDREN')) {
      return this.parseChildrenBlock();
    }
    
    // Regular element
    const element = this.parseElementTag();
    
    // Parse content, children, or hierarchical children blocks
    if (this.check('LBRACE')) {
      const content = this.parseContent();
      
      // Handle content with children blocks
      if (content && content.type === 'ContentWithChildren') {
        element.children = content.children;
        element.content = content.expressions;
      } else {
        element.content = content;
      }
    } else if (this.check('LBRACKET')) {
      element.children = this.parseChildren();
    }
    
    return element;
  }

  /**
   * Parse element tag with classes, id, and attributes
   * @returns {Object} Element node with tag info
   */
  parseElementTag() {
    const tagName = this.consume('IDENTIFIER', 'Expected element tag name');
    const element = {
      type: 'Element',
      tagName: tagName.value,
      classes: [],
      id: null,
      attributes: {},
      events: []
    };
    
    // Parse classes and ID
    while (this.match('DOT') || this.match('HASH')) {
      const prev = this.previous();
      if (prev.type === 'DOT') {
        const className = this.consume('IDENTIFIER', 'Expected class name after .');
        element.classes.push(className.value);
      } else {
        const id = this.consume('IDENTIFIER', 'Expected ID after #');
        element.id = id.value;
      }
    }
    
    // Parse @ directives and attributes
    // Keep parsing while we have @ directives or identifier-like tokens that could be attributes
    while (!this.isAtEnd() && !this.check('LBRACE') && !this.check('LBRACKET') && !this.check('RBRACKET')) {
      if (this.match('AT')) {
        // @ directive (@click, @bind, etc.)
        const directive = this.consume('IDENTIFIER', 'Expected directive name after @');
        
        // Check for modifiers (e.g., @keyup.enter)
        const modifiers = [];
        while (this.match('DOT')) {
          const modifier = this.consume('IDENTIFIER', 'Expected modifier after .');
          modifiers.push(modifier.value);
        }
        
        this.consume('EQUALS', 'Expected = after @ directive');
        const value = this.consume('STRING', 'Expected string value for @ directive');
        
        if (directive.value === 'bind') {
          element.attributes['data-bind'] = value.value;
        } else {
          element.events.push({
            event: directive.value,
            action: value.value,
            modifiers: modifiers.length > 0 ? modifiers : undefined
          });
        }
      } else if (this.check('IDENTIFIER') || this.check('TYPE') || this.check('VALUE') || 
                 this.check('CHECKED') || this.check('REQUIRED') || this.check('ROWS') || this.check('CLASS')) {
        // Look ahead to see if this is an attribute or a new element
        // Check next token - if it's not '=' and the current identifier could be an element name,
        // then we should stop parsing attributes
        const nextToken = this.tokens[this.current + 1];
        
        // If next token suggests this is an element (has . or # or [ or {), stop
        if (nextToken && (nextToken.type === 'DOT' || nextToken.type === 'HASH' || 
                         nextToken.type === 'LBRACKET' || nextToken.type === 'LBRACE')) {
          break;
        }
        
        // If we're looking at a regular identifier (not a keyword attribute like 'type' or 'checked')
        // and it's not followed by '=', it's probably a new element, not a boolean attribute
        if (this.check('IDENTIFIER') && nextToken && nextToken.type !== 'EQUALS') {
          // Boolean attributes are usually specific keywords, not arbitrary identifiers
          break;
        }
        
        // Regular attribute or keyword that can be used as attribute
        const attrName = this.advance();
        
        // Check for attribute value
        if (this.match('EQUALS')) {
          if (this.check('LBRACE')) {
            // Dynamic attribute value (e.g., class={ expression })
            this.consume('LBRACE', 'Expected {');
            const expr = this.parseExpression();
            this.consume('RBRACE', 'Expected }');
            element.attributes[attrName.value] = { type: 'DynamicAttribute', expression: expr };
          } else if (this.check('STRING')) {
            // String literal value
            const value = this.advance();
            element.attributes[attrName.value] = value.value;
          } else {
            throw new Error(`Unexpected attribute value at line ${this.peek().line}`);
          }
        } else {
          element.attributes[attrName.value] = true;
        }
      } else {
        break;
      }
    }
    
    return element;
  }

  /**
   * Parse element content (text or expressions)
   * @returns {Object} Content node or children array
   */
  parseContent() {
    this.consume('LBRACE', 'Expected {');
    const expressions = [];
    const children = [];
    
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('CHILDREN')) {
        // Parse children block within element content
        children.push(this.parseChildrenBlock());
      } else if (this.check('STRING')) {
        expressions.push({
          type: 'Literal',
          value: this.advance().value
        });
      } else if (this.check('IDENTIFIER')) {
        // Could be a variable reference or start of member expression
        const expr = this.parseExpression();
        expressions.push(expr);
      } else if (this.match('PLUS')) {
        // Continue expression
        continue;
      } else if (this.match('LPAREN')) {
        // Parenthesized expression
        const expr = this.parseExpression();
        this.consume('RPAREN', 'Expected )');
        expressions.push(expr);
      } else {
        this.advance(); // Skip unknown token
      }
    }
    
    this.consume('RBRACE', 'Expected }');
    
    // If we found children blocks, return them as a special structure
    if (children.length > 0) {
      return {
        type: 'ContentWithChildren',
        expressions: expressions.length > 0 ? expressions : null,
        children: children
      };
    }
    
    if (expressions.length === 0) {
      return null;
    } else if (expressions.length === 1) {
      return expressions[0];
    } else {
      return {
        type: 'ConcatenationExpression',
        parts: expressions
      };
    }
  }

  /**
   * Parse an expression
   * @returns {Object} Expression node
   */
  parseExpression() {
    // Parse ternary conditional
    const expr = this.parseComparison();
    
    if (this.match('QUESTION')) {
      const trueBranch = this.parseExpression();
      this.consume('COLON', 'Expected : in ternary expression');
      const falseBranch = this.parseExpression();
      
      return {
        type: 'TernaryExpression',
        condition: expr,
        trueBranch,
        falseBranch
      };
    }
    
    return expr;
  }

  /**
   * Parse comparison expression
   * @returns {Object} Expression node
   */
  parseComparison() {
    let left = this.parseAdditive();
    
    while (this.check('TRIPLE_EQUALS') || this.check('NOT_TRIPLE_EQUALS') ||
           this.check('DOUBLE_EQUALS') || this.check('NOT_EQUALS') ||
           this.check('LESS') || this.check('GREATER') ||
           this.check('LESS_EQUALS') || this.check('GREATER_EQUALS')) {
      const operator = this.advance();
      const right = this.parseAdditive();
      left = {
        type: 'BinaryExpression',
        operator: operator.value,
        left,
        right
      };
    }
    
    return left;
  }

  /**
   * Parse additive expression (+ operator)
   * @returns {Object} Expression node
   */
  parseAdditive() {
    let left = this.parsePrimary();
    
    while (this.match('PLUS')) {
      const right = this.parsePrimary();
      left = {
        type: 'BinaryExpression',
        operator: '+',
        left,
        right
      };
    }
    
    return left;
  }

  /**
   * Parse primary expression
   * @returns {Object} Expression node
   */
  parsePrimary() {
    // Handle unary NOT operator
    if (this.match('NOT')) {
      const expr = this.parsePrimary();
      return {
        type: 'UnaryExpression',
        operator: '!',
        argument: expr
      };
    }
    
    if (this.check('STRING')) {
      return {
        type: 'Literal',
        value: this.advance().value
      };
    }
    
    if (this.check('NUMBER')) {
      return {
        type: 'Literal',
        value: this.advance().value
      };
    }
    
    if (this.check('IDENTIFIER')) {
      return this.parseMemberExpression();
    }
    
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', 'Expected )');
      return expr;
    }
    
    throw new Error(`Unexpected token: ${this.peek().type} at line ${this.peek().line}`);
  }

  /**
   * Parse member expression (e.g., data.name, data.items.length)
   * @returns {Object} Member expression node
   */
  parseMemberExpression() {
    let object = {
      type: 'Identifier',
      name: this.consume('IDENTIFIER', 'Expected identifier').value
    };
    
    while (this.match('DOT')) {
      // Property name can be identifier or a keyword that's being used as property name
      let property;
      if (this.check('IDENTIFIER') || this.check('VALUE') || this.check('TYPE') || 
          this.check('CLASS') || this.check('CHECKED') || this.check('REQUIRED') || this.check('ROWS')) {
        property = this.advance();
      } else {
        throw new Error(`Expected property name after . at line ${this.peek().line}, column ${this.peek().column}. Got ${this.peek().type} instead.`);
      }
      object = {
        type: 'MemberExpression',
        object,
        property: property.value
      };
    }
    
    // Check for method call
    if (this.match('LPAREN')) {
      const args = [];
      
      if (!this.check('RPAREN')) {
        do {
          args.push(this.parseExpression());
        } while (this.match('COMMA'));
      }
      
      this.consume('RPAREN', 'Expected )');
      
      return {
        type: 'CallExpression',
        callee: object,
        arguments: args
      };
    }
    
    return object;
  }

  /**
   * Parse children elements
   * @returns {Array} Array of child element nodes
   */
  parseChildren() {
    this.consume('LBRACKET', 'Expected [');
    const children = [];
    
    while (!this.check('RBRACKET') && !this.isAtEnd()) {
      // Check if it's a string literal (text node)
      if (this.check('STRING')) {
        children.push({
          type: 'Literal',
          value: this.advance().value
        });
      } else {
        // Parse as element
        children.push(this.parseElement());
      }
    }
    
    this.consume('RBRACKET', 'Expected ]');
    return children;
  }

  /**
   * Parse if conditional
   * @returns {Object} If node
   */
  parseIf() {
    this.consume('IF', 'Expected if');
    this.consume('LPAREN', 'Expected ( after if');
    const condition = this.parseExpression();
    this.consume('RPAREN', 'Expected ) after condition');
    const children = this.parseChildren();
    
    return {
      type: 'IfStatement',
      condition,
      children
    };
  }

  /**
   * Parse for loop
   * @returns {Object} For node
   */
  parseFor() {
    this.consume('FOR', 'Expected for');
    const variable = this.consume('IDENTIFIER', 'Expected loop variable');
    this.consume('IN', 'Expected in');
    const iterable = this.parseMemberExpression();
    const children = this.parseChildren();
    
    return {
      type: 'ForStatement',
      variable: variable.value,
      iterable,
      children
    };
  }

  /**
   * Parse children block for hierarchical components
   * @returns {Object} ChildrenBlock AST node
   */
  parseChildrenBlock() {
    this.consume('CHILDREN', 'Expected children');
    this.consume('LBRACE', 'Expected { after children');
    
    const childrenBlock = {
      type: 'ChildrenBlock',
      children: [],
      stateProjection: null,
      mountPoint: null,
      repeat: null
    };
    
    // Parse child components and directives
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('STATE_PROJECTION')) {
        childrenBlock.stateProjection = this.parseStateProjection();
      } else if (this.check('MOUNT_POINT')) {
        childrenBlock.mountPoint = this.parseMountPoint();
      } else if (this.check('REPEAT')) {
        childrenBlock.repeat = this.parseRepeat();
      } else if (this.check('IDENTIFIER')) {
        // Look ahead to check if this is a valid child component syntax
        const nextToken = this.tokens[this.current + 1];
        
        if (nextToken && nextToken.type === 'ARROW') {
          // Component without :: (missing entity parameter)
          throw new Error('Child component must have entity parameter');
        }
        
        // Parse child component
        const childComponent = this.parseComponent();
        
        // Validate child component has entity parameter
        if (!childComponent.entityParam) {
          throw new Error('Child component must have entity parameter');
        }
        
        // Check for nested children blocks (not allowed)
        if (childComponent.body && childComponent.body.children) {
          const hasNestedChildren = childComponent.body.children.some(child => 
            child.type === 'ChildrenBlock'
          );
          if (hasNestedChildren) {
            throw new Error('Nested children blocks are not supported');
          }
        }
        
        childrenBlock.children.push(childComponent);
      } else {
        // Skip unknown tokens or advance to avoid infinite loop
        this.advance();
      }
    }
    
    this.consume('RBRACE', 'Expected } after children block');
    
    // Validate required stateProjection
    if (!childrenBlock.stateProjection) {
      throw new Error('Children block must include stateProjection');
    }
    
    return childrenBlock;
  }

  /**
   * Parse stateProjection directive
   * @returns {Object} State projection object
   */
  parseStateProjection() {
    this.consume('STATE_PROJECTION', 'Expected stateProjection');
    this.consume('COLON', 'Expected : after stateProjection');
    
    if (!this.check('LBRACE')) {
      throw new Error('StateProjection must be an object with string key-value pairs');
    }
    
    this.consume('LBRACE', 'Expected { for stateProjection object');
    const projection = {};
    
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      // Parse key
      const key = this.consume('STRING', 'Expected string key in stateProjection');
      this.consume('COLON', 'Expected : after key in stateProjection');
      
      // Parse value
      const value = this.consume('STRING', 'Expected string value in stateProjection');
      projection[key.value] = value.value;
      
      // Optional comma
      if (this.check('COMMA')) {
        this.advance();
      }
    }
    
    this.consume('RBRACE', 'Expected } after stateProjection object');
    return projection;
  }

  /**
   * Parse mountPoint directive
   * @returns {string} Mount point selector
   */
  parseMountPoint() {
    this.consume('MOUNT_POINT', 'Expected mountPoint');
    this.consume('COLON', 'Expected : after mountPoint');
    const mountPoint = this.consume('STRING', 'Expected string value for mountPoint');
    return mountPoint.value;
  }

  /**
   * Parse repeat directive
   * @returns {string} Repeat array path
   */
  parseRepeat() {
    this.consume('REPEAT', 'Expected repeat');
    this.consume('COLON', 'Expected : after repeat');
    const repeat = this.consume('STRING', 'Expected string value for repeat');
    
    // Validate repeat directive has valid array path
    if (!repeat.value || repeat.value.trim() === '') {
      throw new Error('Repeat directive must specify valid array path');
    }
    
    return repeat.value;
  }

  // Helper methods for token management

  /**
   * Check if current token matches type
   * @param {string} type - Token type
   * @returns {boolean}
   */
  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Consume token if it matches, otherwise stay
   * @param {string} type - Token type
   * @returns {boolean}
   */
  match(type) {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Consume token and error if wrong type
   * @param {string} type - Expected token type
   * @param {string} message - Error message
   * @returns {Object} Token
   */
  consume(type, message) {
    if (this.check(type)) return this.advance();
    
    const token = this.peek();
    throw new Error(`${message} at line ${token.line}, column ${token.column}. Got ${token.type} instead.`);
  }

  /**
   * Advance to next token
   * @returns {Object} Current token
   */
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  /**
   * Check if at end of tokens
   * @returns {boolean}
   */
  isAtEnd() {
    return this.peek().type === 'EOF';
  }

  /**
   * Peek at current token
   * @returns {Object}
   */
  peek() {
    return this.tokens[this.current];
  }

  /**
   * Get previous token
   * @returns {Object}
   */
  previous() {
    return this.tokens[this.current - 1];
  }
}