/**
 * JSON to DSL Converter for Declarative Components
 * Converts unified JSON component definition back to DSL syntax
 */

export class JsonToDSLConverter {
  constructor(options = {}) {
    this.indentSize = options.indentSize || 2;
    this.currentIndent = 0;
  }

  /**
   * Convert JSON component definition to DSL string
   * @param {Object} json - The JSON component definition
   * @returns {string} DSL text
   */
  convert(json) {
    if (!json.name || !json.entity) {
      throw new Error('JSON must have name and entity properties');
    }
    
    const lines = [];
    
    // Component header
    lines.push(`${json.name} :: ${json.entity} =>`);
    
    // Build element tree from structure
    if (json.structure && json.structure.root) {
      this.currentIndent++;
      const rootDSL = this.convertElement('root', json.structure, json.bindings, json.events);
      lines.push(...rootDSL);
      this.currentIndent--;
    }
    
    return lines.join('\n');
  }

  /**
   * Convert element from structure to DSL
   */
  convertElement(elementKey, structure, bindings = [], events = []) {
    const element = structure[elementKey];
    if (!element) return [];
    
    const lines = [];
    let line = this.getIndent();
    
    // Build element signature
    line += element.element || 'div';
    
    // Add classes
    if (element.class) {
      const classes = element.class.split(' ').map(c => `.${c}`).join('');
      line += classes;
    }
    
    // Add ID
    if (element.id) {
      line += `#${element.id}`;
    }
    
    // Check for bindings to this element
    const elementBindings = bindings.filter(b => b.target.startsWith(`${elementKey}.`));
    const textBinding = elementBindings.find(b => b.target === `${elementKey}.textContent`);
    
    // Check for events on this element
    const elementEvents = events.filter(e => e.element === elementKey);
    
    // Add attributes/events
    const attrs = [];
    for (const event of elementEvents) {
      let eventStr = `@${event.event}="${event.action}"`;
      if (event.modifiers && event.modifiers.length > 0) {
        eventStr = `@${event.event}.${event.modifiers.join('.')}="${event.action}"`;
      }
      attrs.push(eventStr);
    }
    
    // Add other attributes
    if (element.attributes) {
      for (const [key, value] of Object.entries(element.attributes)) {
        attrs.push(`${key}="${value}"`);
      }
    }
    
    if (attrs.length > 0) {
      line += ' ' + attrs.join(' ');
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
    
    // Determine content/children format
    if (textBinding) {
      // Has dynamic text content
      line += ' { ' + this.formatBinding(textBinding.source) + ' }';
      lines.push(line);
    } else if (element.textContent) {
      // Has static text content
      line += ' { "' + element.textContent + '" }';
      lines.push(line);
    } else if (children.length > 0) {
      // Has children
      line += ' [';
      lines.push(line);
      
      this.currentIndent++;
      for (const childKey of children) {
        const childLines = this.convertElement(childKey, structure, bindings, events);
        lines.push(...childLines);
      }
      this.currentIndent--;
      
      lines.push(this.getIndent() + ']');
    } else {
      // Empty element
      lines.push(line);
    }
    
    return lines;
  }

  /**
   * Format a binding source for DSL
   */
  formatBinding(source) {
    // Remove entity prefix if it matches the component entity
    // e.g., "data.count" becomes just "data.count" (keep as is)
    return source;
  }

  /**
   * Get indentation string
   */
  getIndent() {
    return ' '.repeat(this.currentIndent * this.indentSize);
  }
}

/**
 * Convert JSON component definition directly to DSL
 * @param {Object} json - The JSON component definition
 * @returns {string} DSL text
 */
export function jsonToDSL(json) {
  const converter = new JsonToDSLConverter();
  return converter.convert(json);
}