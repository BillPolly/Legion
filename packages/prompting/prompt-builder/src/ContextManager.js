/**
 * ContextManager - Context variable management
 */

export class ContextManager {
  constructor(configuration = {}) {
    this.config = {
      enabled: true,
      maxVariables: 10,
      namingStrategy: 'descriptive',
      ...configuration
    };
    
    this.variables = new Map();
  }

  declareVariable(name, value) {
    if (!this.config.enabled) {
      return;
    }
    
    if (this.variables.size >= this.config.maxVariables) {
      throw new Error(`Maximum context variables exceeded (${this.config.maxVariables})`);
    }
    
    this.variables.set(name, value);
  }

  formatVariables() {
    if (!this.config.enabled || this.variables.size === 0) {
      return '';
    }
    
    const formatted = Array.from(this.variables.entries())
      .map(([name, value]) => `@${name}: ${value}`)
      .join('\n');
    
    return `Context Variables:\n${formatted}\n\n`;
  }

  clear() {
    this.variables.clear();
  }
}