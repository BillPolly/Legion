/**
 * JSON to CNL Converter for Declarative Components
 * Converts unified JSON component definition to Controlled Natural Language
 */

export class JsonToCNLConverter {
  constructor(options = {}) {
    this.indentSize = options.indentSize || 2;
    this.currentIndent = 0;
  }

  /**
   * Convert JSON component definition to CNL string
   * @param {Object} json - The JSON component definition
   * @returns {string} CNL text
   */
  convert(json) {
    if (!json.name || !json.entity) {
      throw new Error('JSON must have name and entity properties');
    }
    
    const lines = [];
    
    // Component definition
    lines.push(`Define ${json.name} with ${json.entity}:`);
    
    // Convert structure starting from root
    if (json.structure && json.structure.root) {
      this.currentIndent++;
      const rootCNL = this.convertElement('root', json.structure, json.bindings, json.events, json.entity);
      lines.push(...rootCNL);
      this.currentIndent--;
    }
    
    return lines.join('\n');
  }

  /**
   * Convert element from structure to CNL
   */
  convertElement(elementKey, structure, bindings = [], events = [], entity = 'data') {
    const element = structure[elementKey];
    if (!element) return [];
    
    const lines = [];
    let line = this.getIndent();
    
    // Determine element article and name
    const article = this.getArticle(element.element);
    const elementName = this.getElementName(element.element);
    
    // Build element description
    line += `${article} ${elementName}`;
    
    // Add class if present
    if (element.class) {
      line += ` with class "${element.class}"`;
    }
    
    // Add ID if present
    if (element.id) {
      line += ` with id "${element.id}"`;
    }
    
    // Check for bindings to this element
    const elementBindings = bindings.filter(b => b.target.startsWith(`${elementKey}.`));
    const textBinding = elementBindings.find(b => b.target === `${elementKey}.textContent`);
    const valueBinding = elementBindings.find(b => b.target === `${elementKey}.value`);
    
    // Check for events on this element
    const elementEvents = events.filter(e => e.element === elementKey);
    
    // Handle content/binding
    if (textBinding) {
      const bindingText = this.formatBinding(textBinding.source, entity);
      if (element.element === 'button' && elementEvents.length > 0) {
        // Button with binding and event
        line += ` showing ${bindingText}`;
      } else {
        line += ` showing ${bindingText}`;
      }
    } else if (valueBinding) {
      const bindingText = this.formatBinding(valueBinding.source, entity);
      line += ` bound to ${bindingText}`;
    } else if (element.textContent) {
      // Static content
      if (element.element === 'button' && elementEvents.length > 0) {
        line += ` labeled "${element.textContent}"`;
      } else {
        line += ` showing "${element.textContent}"`;
      }
    }
    
    // Add event handlers
    for (const event of elementEvents) {
      const actionText = this.formatAction(event.action, entity);
      
      if (event.modifiers && event.modifiers.includes('enter')) {
        line += ` that ${actionText} on Enter key`;
      } else if (event.event === 'click') {
        line += ` that ${actionText} on click`;
      } else {
        line += ` that ${actionText} on ${event.event}`;
      }
    }
    
    // Find children
    const children = Object.keys(structure)
      .filter(key => structure[key].parent === elementKey)
      .sort((a, b) => {
        // Sort by the numeric part of the key to maintain order
        const aNum = parseInt(a.match(/_(\d+)$/)?.[1] || '0');
        const bNum = parseInt(b.match(/_(\d+)$/)?.[1] || '0');
        return aNum - bNum;
      });
    
    // Handle children
    if (children.length > 0) {
      line += ' containing:';
      lines.push(line);
      
      this.currentIndent++;
      for (const childKey of children) {
        const childLines = this.convertElement(childKey, structure, bindings, events, entity);
        lines.push(...childLines);
      }
      this.currentIndent--;
    } else {
      lines.push(line);
    }
    
    return lines;
  }

  /**
   * Format a binding source for CNL
   */
  formatBinding(source, entity) {
    // Remove entity prefix for cleaner language
    if (source.startsWith(`${entity}.`)) {
      const property = source.slice(entity.length + 1);
      
      // Handle nested properties
      if (property.includes('.')) {
        const parts = property.split('.');
        return `the ${parts.join("'s ")}`;
      }
      
      return `the ${property}`;
    }
    
    // Handle other patterns
    if (source.includes('.')) {
      const parts = source.split('.');
      if (parts[0] === 'state' || parts[0] === 'data') {
        return `the ${parts.slice(1).join("'s ")}`;
      }
      return `the ${parts.join("'s ")}`;
    }
    
    return `the ${source}`;
  }

  /**
   * Format an action expression for CNL
   */
  formatAction(action, entity) {
    // Handle increment/decrement
    if (action.includes('++')) {
      const variable = action.replace('++', '').trim();
      const cleanVar = this.cleanVariable(variable, entity);
      return `increments ${cleanVar}`;
    }
    
    if (action.includes('--')) {
      const variable = action.replace('--', '').trim();
      const cleanVar = this.cleanVariable(variable, entity);
      return `decrements ${cleanVar}`;
    }
    
    // Handle assignment
    if (action.includes('=')) {
      const parts = action.split('=').map(p => p.trim());
      const variable = parts[0];
      const value = parts[1];
      const cleanVar = this.cleanVariable(variable, entity);
      
      if (value === '0') {
        return `resets ${cleanVar} to 0`;
      } else if (value === 'true') {
        return `sets ${cleanVar} to true`;
      } else if (value === 'false') {
        return `sets ${cleanVar} to false`;
      } else if (value === '!'+variable) {
        return `toggles ${cleanVar}`;
      } else if (value.startsWith('"') && value.endsWith('"')) {
        return `sets ${cleanVar} to ${value}`;
      } else {
        return `sets ${cleanVar} to ${value}`;
      }
    }
    
    // Handle function calls
    if (action.includes('(') && action.includes(')')) {
      const match = action.match(/(\w+)\((.*)\)/);
      if (match) {
        const [, funcName, args] = match;
        if (args) {
          return `calls ${funcName} with ${args}`;
        } else {
          return `calls ${funcName}`;
        }
      }
    }
    
    // Default
    return action;
  }

  /**
   * Clean variable name for natural language
   */
  cleanVariable(variable, entity) {
    if (variable.startsWith(`${entity}.`)) {
      return `the ${variable.slice(entity.length + 1)}`;
    }
    if (variable.startsWith('state.')) {
      return `the ${variable.slice(6)}`;
    }
    if (variable.startsWith('data.')) {
      return `the ${variable.slice(5)}`;
    }
    return `the ${variable}`;
  }

  /**
   * Get appropriate article for element
   */
  getArticle(tag) {
    const vowelTags = ['input', 'img', 'image', 'article', 'aside', 'ul', 'ol'];
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
      'h4': 'subtitle',
      'span': 'span',
      'button': 'button',
      'input': 'input',
      'textarea': 'text area',
      'select': 'dropdown',
      'ul': 'unordered list',
      'ol': 'ordered list',
      'li': 'list item',
      'a': 'link',
      'img': 'image',
      'table': 'table',
      'tr': 'row',
      'td': 'cell',
      'th': 'header cell',
      'form': 'form',
      'label': 'label',
      'section': 'section',
      'article': 'article',
      'header': 'header',
      'footer': 'footer',
      'nav': 'navigation'
    };
    
    return elementNames[tag] || tag;
  }

  /**
   * Get indentation string
   */
  getIndent() {
    return ' '.repeat(this.currentIndent * this.indentSize);
  }
}

/**
 * Convert JSON component definition directly to CNL
 * @param {Object} json - The JSON component definition
 * @returns {string} CNL text
 */
export function jsonToCNL(json) {
  const converter = new JsonToCNLConverter();
  return converter.convert(json);
}