/**
 * CommandsList - Renders the commands sidebar content
 */

export class CommandsList {
  constructor(tools) {
    this.tools = tools;
  }

  /**
   * Render the commands list HTML
   */
  render() {
    // Group tools by category
    const categories = this.categorizeTools();
    
    let html = '';
    
    // Built-in commands category
    html += this.renderCategory('Built-in', this.getBuiltinCommands());
    
    // Tool categories
    Object.entries(categories).forEach(([category, tools]) => {
      html += this.renderCategory(category, tools);
    });
    
    return html;
  }

  /**
   * Categorize tools by prefix
   */
  categorizeTools() {
    const categories = {};
    
    for (const [name, tool] of this.tools) {
      const category = this.getCategory(name);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ name, ...tool });
    }
    
    // Sort categories
    const sorted = {};
    Object.keys(categories).sort().forEach(key => {
      sorted[key] = categories[key];
    });
    
    return sorted;
  }

  /**
   * Get category from tool name
   */
  getCategory(name) {
    const prefix = name.split('_')[0];
    
    const categoryMap = {
      'context': 'Context',
      'file': 'File',
      'plan': 'Planning',
      'handle': 'Handles',
      'debug': 'Debug',
      'meta': 'Meta'
    };
    
    return categoryMap[prefix] || 'Other';
  }

  /**
   * Get built-in commands
   */
  getBuiltinCommands() {
    return [
      { name: '.help', description: 'Show help information' },
      { name: '.commands', description: 'List all commands' },
      { name: '.vars', description: 'Show variables' },
      { name: '.clear', description: 'Clear terminal' },
      { name: '.history', description: 'Show command history' },
      { name: '.search', description: 'Search commands' },
      { name: '.describe', description: 'Describe a command' }
    ];
  }

  /**
   * Render a category
   */
  renderCategory(name, commands) {
    if (commands.length === 0) return '';
    
    let html = `
      <div class="cli-command-category">
        <div class="cli-command-category-header">${name}</div>
    `;
    
    commands.forEach(cmd => {
      html += this.renderCommand(cmd);
    });
    
    html += '</div>';
    
    return html;
  }

  /**
   * Render a single command
   */
  renderCommand(command) {
    const escapedName = this.escapeHtml(command.name);
    const escapedDesc = this.escapeHtml(command.description || 'No description');
    
    return `
      <div class="cli-command-item" data-command="${escapedName}">
        <span class="cli-command-name">${escapedName}</span>
        <span class="cli-command-desc">${escapedDesc}</span>
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}