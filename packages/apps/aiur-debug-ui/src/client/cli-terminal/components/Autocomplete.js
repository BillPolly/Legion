/**
 * Autocomplete - Handles command and argument autocompletion
 */

export class Autocomplete {
  constructor(tools, variables) {
    this.tools = tools;
    this.variables = variables;
    this.suggestions = [];
    this.selectedIndex = -1;
    this.element = null;
  }

  /**
   * Initialize autocomplete with DOM element
   */
  init(element) {
    this.element = element;
  }

  /**
   * Update available tools
   */
  updateTools(tools) {
    this.tools = tools;
  }

  /**
   * Update available variables
   */
  updateVariables(variables) {
    this.variables = variables;
  }

  /**
   * Get suggestions for input
   */
  getSuggestions(input) {
    const parts = input.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    // Don't show command suggestions if we've already typed a complete command + space
    if (input.endsWith(' ') && parts.length >= 2) {
      const command = parts[0];
      // If it's a known tool or builtin, don't show command suggestions
      if (this.tools.has(command) || this.isBuiltinCommand(command)) {
        return []; // No autocomplete suggestions - let ghost text show instead
      }
    }
    
    // If typing a command (first word only)
    if (parts.length === 1 && !input.endsWith(' ')) {
      return this.getCommandSuggestions(lastPart);
    }
    
    // If typing a variable reference
    if (lastPart.startsWith('@')) {
      return this.getVariableSuggestions(lastPart);
    }
    
    // If typing after a tool name, suggest arguments (but only for partial words)
    const toolName = parts[0];
    if (this.tools.has(toolName) && !input.endsWith(' ')) {
      return this.getArgumentSuggestions(toolName, parts);
    }
    
    return [];
  }
  
  /**
   * Check if command is a built-in
   */
  isBuiltinCommand(command) {
    const builtins = ['.help', '.commands', '.vars', '.clear', '.history', '.search', '.describe'];
    return builtins.includes(command);
  }

  /**
   * Get command suggestions
   */
  getCommandSuggestions(partial) {
    const suggestions = [];
    const lower = partial.toLowerCase();
    
    // Built-in commands
    const builtins = ['.help', '.commands', '.vars', '.clear', '.history', '.search', '.describe'];
    builtins.forEach(cmd => {
      if (cmd.startsWith(lower)) {
        suggestions.push({
          type: 'builtin',
          text: cmd,
          display: cmd,
          description: this.getBuiltinDescription(cmd)
        });
      }
    });
    
    // Tool commands
    for (const [name, tool] of this.tools) {
      if (name.toLowerCase().startsWith(lower)) {
        suggestions.push({
          type: 'tool',
          text: name,
          display: name,
          description: tool.description || ''
        });
      }
    }
    
    return suggestions.slice(0, 10);
  }

  /**
   * Get variable suggestions
   */
  getVariableSuggestions(partial) {
    const suggestions = [];
    const search = partial.substring(1).toLowerCase();
    
    // Local variables
    for (const [name, value] of this.variables.local) {
      if (name.toLowerCase().startsWith(search)) {
        suggestions.push({
          type: 'variable',
          text: name,
          display: '@' + name,
          description: this.formatValue(value)
        });
      }
    }
    
    // Context variables
    for (const variable of this.variables.context) {
      const name = variable.name;
      if (name.toLowerCase().startsWith(search)) {
        suggestions.push({
          type: 'variable',
          text: name,
          display: '@' + name,
          description: variable.description || this.formatValue(variable.value)
        });
      }
    }
    
    return suggestions.slice(0, 10);
  }

  /**
   * Get argument suggestions for a tool
   */
  getArgumentSuggestions(toolName, parts) {
    const tool = this.tools.get(toolName);
    if (!tool || !tool.inputSchema?.properties) return [];
    
    const suggestions = [];
    const existingArgs = new Set();
    
    // Parse existing arguments
    parts.slice(1).forEach(part => {
      if (part.startsWith('--')) {
        const arg = part.split('=')[0].substring(2);
        existingArgs.add(arg);
      }
    });
    
    // Suggest missing arguments
    for (const [prop, schema] of Object.entries(tool.inputSchema.properties)) {
      if (!existingArgs.has(prop)) {
        const required = tool.inputSchema.required?.includes(prop);
        suggestions.push({
          type: 'argument',
          text: `--${prop}=`,
          display: `--${prop}`,
          description: `${schema.description || ''} (${schema.type}${required ? ', required' : ''})`
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Show autocomplete suggestions
   */
  show(suggestions, input) {
    if (!this.element || suggestions.length === 0) {
      this.hide();
      return;
    }
    
    this.suggestions = suggestions;
    this.selectedIndex = -1;
    
    // Build HTML
    const html = suggestions.map((suggestion, index) => `
      <div class="cli-autocomplete-item" data-index="${index}">
        <span class="suggestion-text">${this.highlightMatch(suggestion.display, input)}</span>
        <span class="suggestion-desc">${suggestion.description}</span>
      </div>
    `).join('');
    
    this.element.innerHTML = html;
    this.element.classList.add('active');
    
    // Add click handlers
    this.element.querySelectorAll('.cli-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.select(index);
      });
    });
  }

  /**
   * Hide autocomplete
   */
  hide() {
    if (this.element) {
      this.element.classList.remove('active');
      this.element.innerHTML = '';
    }
    this.suggestions = [];
    this.selectedIndex = -1;
  }

  /**
   * Navigate suggestions with wrap-around
   */
  navigate(direction) {
    if (this.suggestions.length === 0) return;
    
    let newIndex = this.selectedIndex + direction;
    
    // Wrap around logic
    if (newIndex >= this.suggestions.length) {
      // Wrap to beginning (no selection)
      newIndex = -1;
    } else if (newIndex < -1) {
      // Wrap to end
      newIndex = this.suggestions.length - 1;
    }
    
    this.selectedIndex = newIndex;
    this.updateSelection();
  }

  /**
   * Update visual selection
   */
  updateSelection() {
    const items = this.element.querySelectorAll('.cli-autocomplete-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Get selected suggestion
   */
  getSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
      return this.suggestions[this.selectedIndex];
    }
    return null;
  }

  /**
   * Select a suggestion
   */
  select(index) {
    if (index >= 0 && index < this.suggestions.length) {
      const suggestion = this.suggestions[index];
      this.hide();
      return suggestion;
    }
    return null;
  }

  /**
   * Highlight matching part of text
   */
  highlightMatch(text, input) {
    const parts = input.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    if (!lastPart) return text;
    
    const regex = new RegExp(`(${this.escapeRegex(lastPart)})`, 'gi');
    return text.replace(regex, '<span class="match">$1</span>');
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const str = JSON.stringify(value);
    if (str.length > 50) {
      return str.substring(0, 47) + '...';
    }
    return str;
  }

  /**
   * Get builtin command description
   */
  getBuiltinDescription(cmd) {
    const descriptions = {
      '.help': 'Show help information',
      '.commands': 'List all available commands',
      '.vars': 'Show all variables',
      '.clear': 'Clear terminal output',
      '.history': 'Show command history',
      '.search': 'Search for commands',
      '.describe': 'Describe a command in detail'
    };
    return descriptions[cmd] || '';
  }
}