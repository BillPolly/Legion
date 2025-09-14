/**
 * DSL to CNL Converter for Declarative Components
 * Converts DSL AST to Controlled Natural Language
 */

export class DSLToCNLConverter {
  constructor(options = {}) {
    this.indentSize = options.indentSize || 2;
    this.currentIndent = 0;
  }

  /**
   * Convert DSL AST to CNL string
   * @param {Object} ast - The DSL AST
   * @returns {string} CNL text
   */
  convert(ast) {
    if (ast.type !== 'Component') {
      throw new Error('Root node must be a Component');
    }
    
    return this.convertComponent(ast);
  }

  /**
   * Convert component node to CNL
   */
  convertComponent(node) {
    const lines = [];
    
    // Component definition
    lines.push(`Define ${node.name} with ${node.parameter}:`);
    
    // Component body
    this.currentIndent++;
    const bodyLines = this.convertStatements(node.body);
    lines.push(...bodyLines);
    this.currentIndent--;
    
    return lines.join('\n');
  }

  /**
   * Convert a list of statements to CNL
   */
  convertStatements(statements) {
    const lines = [];
    
    for (const statement of statements) {
      const cnlLines = this.convertStatement(statement);
      if (cnlLines) {
        lines.push(...cnlLines);
      }
    }
    
    return lines;
  }

  /**
   * Convert a single statement to CNL
   */
  convertStatement(node) {
    switch (node.type) {
      case 'element':
        return this.convertElement(node);
      
      case 'conditional':
        return this.convertConditional(node);
      
      case 'iteration':
        return this.convertIteration(node);
      
      case 'text':
        return [this.getIndent() + `"${node.content}"`];
      
      default:
        return [];
    }
  }

  /**
   * Convert element node to CNL
   */
  convertElement(node) {
    const lines = [];
    let line = this.getIndent();
    
    // Determine element article and name
    const article = this.getArticle(node.tag);
    const elementName = this.getElementName(node.tag);
    
    // Build element description
    if (node.tag === 'input' && node.inputType === 'checkbox') {
      line += `${article} checkbox`;
    } else if (node.tag === 'h3') {
      line += `${article} subtitle`;
    } else {
      line += `${article} ${elementName}`;
    }
    
    // Add class if present
    if (node.className) {
      line += ` with class "${node.className}"`;
    }
    
    // Add placeholder for inputs
    if (node.placeholder) {
      line += ` with placeholder "${node.placeholder}"`;
    }
    
    // Handle content/binding/event
    if (node.content) {
      // Static content
      if (node.tag === 'button' && node.event) {
        line += ` labeled "${node.content}"`;
      } else {
        line += ` showing "${node.content}"`;
      }
    } else if (node.binding) {
      // Dynamic binding
      const bindingText = this.convertBinding(node.binding);
      
      if (node.tag === 'input' && node.inputType === 'checkbox') {
        line += ` bound to ${bindingText}`;
      } else if (node.tag === 'button' && node.binding.includes('?')) {
        // Ternary in button
        line += `:`;
        lines.push(line);
        line = this.getIndent(1) + bindingText;
      } else {
        line += ` showing ${bindingText}`;
      }
    }
    
    // Add event handler
    if (node.event) {
      const actionText = this.convertAction(node.event.action);
      line += ` that ${actionText} on ${node.event.type}`;
    }
    
    // Handle children
    if (node.children && node.children.length > 0) {
      if (!line.endsWith(':')) {
        line += ' containing:';
      }
      lines.push(line);
      
      this.currentIndent++;
      for (const child of node.children) {
        const childLines = this.convertStatement(child);
        lines.push(...childLines);
      }
      this.currentIndent--;
    } else {
      if (!line.endsWith(':')) {
        lines.push(line);
      }
    }
    
    return lines;
  }

  /**
   * Convert conditional node to CNL
   */
  convertConditional(node) {
    const lines = [];
    
    // Convert condition
    const conditionText = this.convertCondition(node.condition);
    lines.push(this.getIndent() + conditionText + ':');
    
    // Convert then block
    if (node.children && node.children.length > 0) {
      this.currentIndent++;
      for (const child of node.children) {
        const childLines = this.convertStatement(child);
        lines.push(...childLines);
      }
      this.currentIndent--;
    }
    
    // Convert else block if present
    if (node.else && node.else.length > 0) {
      lines.push(this.getIndent() + 'Otherwise:');
      
      this.currentIndent++;
      for (const child of node.else) {
        const childLines = this.convertStatement(child);
        lines.push(...childLines);
      }
      this.currentIndent--;
    }
    
    return lines;
  }

  /**
   * Convert iteration node to CNL
   */
  convertIteration(node) {
    const lines = [];
    
    // Convert iteration header
    const collectionText = this.convertBinding(node.collection);
    lines.push(this.getIndent() + `For each ${node.variable} in ${collectionText}:`);
    
    // Convert iteration body
    if (node.children && node.children.length > 0) {
      this.currentIndent++;
      for (const child of node.children) {
        const childLines = this.convertStatement(child);
        lines.push(...childLines);
      }
      this.currentIndent--;
    }
    
    return lines;
  }

  /**
   * Convert condition expression to CNL
   */
  convertCondition(condition) {
    // Clean up condition
    condition = condition.trim();
    
    // Handle simple boolean checks
    if (!condition.includes('==') && !condition.includes('!=') && 
        !condition.includes('>') && !condition.includes('<')) {
      return `When ${this.cleanVariable(condition)} is true`;
    }
    
    // Handle equality checks
    if (condition.includes('==')) {
      const parts = condition.split('==').map(p => p.trim());
      const variable = this.cleanVariable(parts[0]);
      const value = parts[1];
      
      if (value === 'true') {
        return `When ${variable} is true`;
      } else if (value === 'false') {
        return `When ${variable} is false`;
      } else {
        return `If ${variable} equals ${value}`;
      }
    }
    
    // Handle inequality
    if (condition.includes('!=')) {
      const parts = condition.split('!=').map(p => p.trim());
      const variable = this.cleanVariable(parts[0]);
      const value = parts[1];
      return `If ${variable} is not ${value}`;
    }
    
    // Handle greater than
    if (condition.includes('>')) {
      const parts = condition.split('>').map(p => p.trim());
      const variable = this.cleanVariable(parts[0]);
      const value = parts[1];
      return `If ${variable} is greater than ${value}`;
    }
    
    return `If ${condition}`;
  }

  /**
   * Convert binding expression to CNL
   */
  convertBinding(binding) {
    // Handle concatenation
    if (binding.includes('+')) {
      const parts = binding.split('+').map(p => p.trim());
      const convertedParts = parts.map(part => {
        if (part.startsWith('"') && part.endsWith('"')) {
          return part;
        } else if (part.includes('?')) {
          // Ternary expression
          return this.convertTernary(part);
        } else {
          return `the ${this.cleanVariable(part)}`;
        }
      });
      return convertedParts.join(' + ');
    }
    
    // Handle ternary
    if (binding.includes('?')) {
      return this.convertTernary(binding);
    }
    
    // Handle property access
    if (binding.includes('.')) {
      const parts = binding.split('.');
      if (parts.length === 2) {
        const object = parts[0];
        const property = parts[1];
        
        if (object === 'state' || object === 'data') {
          return `the ${property}`;
        } else {
          return `the ${object}'s ${property}`;
        }
      }
    }
    
    return `the ${binding}`;
  }

  /**
   * Convert ternary expression to CNL
   */
  convertTernary(expr) {
    const match = expr.match(/(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);
    if (match) {
      const [, condition, trueValue, falseValue] = match;
      const conditionText = this.cleanVariable(condition.trim());
      const trueText = trueValue.trim().replace(/['"]/g, '');
      const falseText = falseValue.trim().replace(/['"]/g, '');
      
      return `(if ${conditionText} then "${trueText}" else "${falseText}")`;
    }
    return expr;
  }

  /**
   * Convert action expression to CNL
   */
  convertAction(action) {
    // Action is already in natural language format from DSLParser
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
   * Get appropriate article for element
   */
  getArticle(tag) {
    const vowelTags = ['input', 'img', 'image', 'article', 'aside'];
    return vowelTags.includes(tag) ? 'An' : 'A';
  }

  /**
   * Get natural language name for element
   */
  getElementName(tag) {
    const elementNames = {
      'div': 'container',
      'p': 'paragraph',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'subtitle',
      'span': 'span',
      'button': 'button',
      'input': 'input',
      'ul': 'list',
      'ol': 'ordered list',
      'li': 'list item',
      'a': 'link',
      'img': 'image',
      'table': 'table',
      'tr': 'row',
      'td': 'cell',
      'th': 'header cell'
    };
    
    return elementNames[tag] || tag;
  }

  /**
   * Get indentation string
   */
  getIndent(adjustment = 0) {
    const level = this.currentIndent + adjustment;
    return ' '.repeat(level * this.indentSize);
  }
}

/**
 * Convert DSL text directly to CNL
 * @param {string} dslText - The DSL source text
 * @returns {Promise<string>} CNL text
 */
export async function dslToCNL(dslText) {
  const { DSLParser } = await import('./DSLParser.js');
  const parser = new DSLParser();
  const ast = parser.parse(dslText);
  
  const converter = new DSLToCNLConverter();
  return converter.convert(ast);
}