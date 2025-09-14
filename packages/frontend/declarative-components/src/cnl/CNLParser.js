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
   * @returns {Object} AST representation
   */
  parse(cnlText) {
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
    
    return component;
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