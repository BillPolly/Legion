/**
 * CliTerminal - Self-contained CLI terminal component for Aiur Debug UI
 * 
 * Features:
 * - Dynamic HTML/CSS generation
 * - Command parsing with simple syntax
 * - Variable storage via context tools
 * - Command history and auto-completion
 * - Built-in help system
 */

class CliTerminal {
  constructor(containerId, aiurConnection) {
    this.containerId = containerId;
    this.aiur = aiurConnection; // Reference to the main app connection
    this.commandHistory = [];
    this.historyIndex = -1;
    this.variables = new Map();
    this.tools = new Map();
    this.isInitialized = false;
    
    // Inject styles
    this.injectStyles();
    
    // Create HTML structure
    this.render();
    
    // Initialize after render
    this.init();
  }

  /**
   * Inject component-specific CSS
   */
  injectStyles() {
    const styleId = 'cli-terminal-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) return;
    
    const styles = `
      .cli-terminal-container {
        display: flex;
        height: 500px;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 8px;
        overflow: hidden;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      }
      
      .cli-sidebar {
        width: 250px;
        background: #222;
        border-right: 1px solid #444;
        display: none;
        flex-direction: column;
      }
      
      .cli-sidebar.active {
        display: flex;
      }
      
      .cli-sidebar-header {
        padding: 12px;
        background: #2a2a2a;
        border-bottom: 1px solid #444;
        font-weight: bold;
        color: #fff;
      }
      
      .cli-sidebar-search {
        padding: 8px;
        background: #2a2a2a;
        border-bottom: 1px solid #444;
      }
      
      .cli-sidebar-search input {
        width: 100%;
        padding: 6px;
        background: #1a1a1a;
        border: 1px solid #444;
        color: #fff;
        border-radius: 4px;
      }
      
      .cli-sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      
      .cli-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      
      .cli-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #2a2a2a;
        border-bottom: 1px solid #444;
      }
      
      .cli-header h3 {
        margin: 0;
        color: #fff;
        font-size: 14px;
      }
      
      .cli-controls {
        display: flex;
        gap: 8px;
      }
      
      .cli-controls button {
        padding: 4px 12px;
        background: #333;
        border: 1px solid #555;
        color: #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .cli-controls button:hover {
        background: #444;
        color: #fff;
      }
      
      .cli-controls button.active {
        background: #007acc;
        color: #fff;
      }
      
      .cli-output {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        font-size: 13px;
        line-height: 1.4;
      }
      
      .cli-input-container {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: #2a2a2a;
        border-top: 1px solid #444;
      }
      
      .cli-prompt {
        color: #4a7c59;
        margin-right: 8px;
        font-weight: bold;
      }
      
      .cli-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #fff;
        font-family: inherit;
        font-size: 13px;
        outline: none;
      }
      
      .cli-output-line {
        margin: 2px 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      
      .cli-output-line.command {
        color: #ccc;
      }
      
      .cli-output-line.success {
        color: #4a7c59;
      }
      
      .cli-output-line.error {
        color: #cc6666;
      }
      
      .cli-output-line.info {
        color: #6897bb;
      }
      
      .cli-output-line.result {
        color: #fff;
        background: #2a2a2a;
        padding: 8px;
        margin: 4px 0;
        border-radius: 4px;
        font-size: 12px;
      }
      
      /* Command list styles */
      .cli-command-category {
        margin-bottom: 12px;
      }
      
      .cli-command-category-header {
        color: #007acc;
        font-weight: bold;
        margin-bottom: 4px;
        font-size: 12px;
      }
      
      .cli-command-item {
        padding: 4px 8px;
        margin: 2px 0;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .cli-command-item:hover {
        background: #333;
      }
      
      .cli-command-name {
        color: #4ec9b0;
        font-weight: bold;
      }
      
      .cli-command-desc {
        color: #888;
        font-size: 11px;
        margin-left: 8px;
      }
      
      /* Variable list styles */
      .cli-variable-item {
        padding: 6px;
        margin: 4px 0;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .cli-variable-name {
        color: #dcdcaa;
        font-weight: bold;
      }
      
      .cli-variable-value {
        color: #888;
        font-size: 11px;
        margin-top: 2px;
        max-height: 60px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Autocomplete styles */
      .cli-autocomplete {
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        background: #2a2a2a;
        border: 1px solid #444;
        border-bottom: none;
        max-height: 200px;
        overflow-y: auto;
        display: none;
      }
      
      .cli-autocomplete.active {
        display: block;
      }
      
      .cli-autocomplete-item {
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .cli-autocomplete-item:hover,
      .cli-autocomplete-item.selected {
        background: #333;
      }
      
      .cli-autocomplete-item .match {
        color: #4ec9b0;
        font-weight: bold;
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * Render the component HTML
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container ${this.containerId} not found`);
      return;
    }
    
    container.innerHTML = `
      <div class="cli-terminal-container">
        <!-- Variables Sidebar -->
        <div id="cli-variables-sidebar" class="cli-sidebar">
          <div class="cli-sidebar-header">Variables</div>
          <div class="cli-sidebar-content" id="cli-variables-list"></div>
        </div>
        
        <!-- Commands Sidebar -->
        <div id="cli-commands-sidebar" class="cli-sidebar">
          <div class="cli-sidebar-header">Commands</div>
          <div class="cli-sidebar-search">
            <input type="text" id="cli-command-search" placeholder="Search commands...">
          </div>
          <div class="cli-sidebar-content" id="cli-commands-list"></div>
        </div>
        
        <!-- Main Terminal -->
        <div class="cli-main">
          <div class="cli-header">
            <h3>CLI Terminal</h3>
            <div class="cli-controls">
              <button id="cli-clear-btn">Clear</button>
              <button id="cli-vars-btn">Variables</button>
              <button id="cli-commands-btn">Commands</button>
            </div>
          </div>
          
          <div id="cli-output" class="cli-output"></div>
          
          <div class="cli-input-container">
            <div id="cli-autocomplete" class="cli-autocomplete"></div>
            <span class="cli-prompt">aiur&gt;</span>
            <input type="text" id="cli-input" class="cli-input" autocomplete="off">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize the component
   */
  init() {
    // Get DOM elements
    this.elements = {
      output: document.getElementById('cli-output'),
      input: document.getElementById('cli-input'),
      autocomplete: document.getElementById('cli-autocomplete'),
      varsSidebar: document.getElementById('cli-variables-sidebar'),
      commandsSidebar: document.getElementById('cli-commands-sidebar'),
      varsList: document.getElementById('cli-variables-list'),
      commandsList: document.getElementById('cli-commands-list'),
      commandSearch: document.getElementById('cli-command-search'),
      clearBtn: document.getElementById('cli-clear-btn'),
      varsBtn: document.getElementById('cli-vars-btn'),
      commandsBtn: document.getElementById('cli-commands-btn')
    };
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize command parser
    this.parser = new CommandParser();
    
    // Show welcome message
    this.output('Welcome to Aiur CLI Terminal', 'info');
    this.output('Type .help for available commands', 'info');
    
    // Load initial data
    this.refreshTools();
    this.refreshVariables();
    
    this.isInitialized = true;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input handling
    this.elements.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.elements.input.addEventListener('input', (e) => this.handleInput(e));
    
    // Button controls
    this.elements.clearBtn.addEventListener('click', () => this.clear());
    this.elements.varsBtn.addEventListener('click', () => this.toggleSidebar('variables'));
    this.elements.commandsBtn.addEventListener('click', () => this.toggleSidebar('commands'));
    
    // Command search
    this.elements.commandSearch.addEventListener('input', (e) => {
      this.filterCommands(e.target.value);
    });
  }

  /**
   * Handle keyboard input
   */
  handleKeyDown(e) {
    switch(e.key) {
      case 'Enter':
        e.preventDefault();
        this.executeCommand(this.elements.input.value);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.navigateHistory(-1);
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.navigateHistory(1);
        break;
        
      case 'Tab':
        e.preventDefault();
        this.handleAutocomplete();
        break;
        
      case 'Escape':
        this.hideAutocomplete();
        break;
    }
  }

  /**
   * Handle input changes for autocomplete
   */
  handleInput(e) {
    const value = e.target.value;
    if (value.length > 0) {
      this.showAutocomplete(value);
    } else {
      this.hideAutocomplete();
    }
  }

  /**
   * Execute a command
   */
  async executeCommand(command) {
    if (!command.trim()) return;
    
    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    // Clear input
    this.elements.input.value = '';
    
    // Output command
    this.output(`aiur> ${command}`, 'command');
    
    try {
      // Parse command
      const parsed = this.parser.parse(command);
      
      if (parsed.type === 'builtin') {
        // Handle built-in commands
        this.handleBuiltinCommand(parsed);
      } else if (parsed.type === 'assignment') {
        // Handle variable assignment
        await this.handleAssignment(parsed);
      } else if (parsed.type === 'tool') {
        // Handle tool execution
        await this.handleToolExecution(parsed);
      }
    } catch (error) {
      this.output(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Handle built-in commands
   */
  handleBuiltinCommand(parsed) {
    switch(parsed.command) {
      case '.help':
        this.showHelp(parsed.args[0]);
        break;
      case '.commands':
        this.showCommands();
        break;
      case '.vars':
        this.showVariables();
        break;
      case '.clear':
        this.clear();
        break;
      case '.history':
        this.showHistory();
        break;
      case '.search':
        this.searchCommands(parsed.args.join(' '));
        break;
      case '.describe':
        this.describeCommand(parsed.args[0]);
        break;
      default:
        this.output(`Unknown command: ${parsed.command}`, 'error');
    }
  }

  /**
   * Handle variable assignment
   */
  async handleAssignment(parsed) {
    // Execute the tool
    const result = await this.executeTool(parsed.tool, parsed.args);
    
    if (result) {
      // Store the variable
      this.variables.set(parsed.variable, result);
      this.output(`✓ Stored in ${parsed.variable}`, 'success');
      
      // Refresh variables display
      this.refreshVariables();
    }
  }

  /**
   * Handle tool execution
   */
  async handleToolExecution(parsed) {
    await this.executeTool(parsed.tool, parsed.args);
  }

  /**
   * Execute a tool via Aiur connection
   */
  async executeTool(toolName, args) {
    try {
      // Resolve any @variable references
      const resolvedArgs = await this.resolveVariables(args);
      
      // Show execution status
      this.output(`Executing ${toolName}...`, 'info');
      
      // Execute via Aiur connection
      const result = await this.aiur.sendMcpRequest('tools/call', {
        name: toolName,
        arguments: resolvedArgs
      });
      
      // Display result
      if (result) {
        this.output(JSON.stringify(result, null, 2), 'result');
        return result;
      }
    } catch (error) {
      this.output(`Failed to execute ${toolName}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Resolve @variable references in arguments
   */
  async resolveVariables(args) {
    // Deep clone args
    const resolved = JSON.parse(JSON.stringify(args));
    
    // Recursively resolve references
    const resolve = async (obj) => {
      if (typeof obj === 'string' && obj.startsWith('@')) {
        const varName = obj.substring(1);
        
        // Check local variables first
        if (this.variables.has(`$${varName}`)) {
          return this.variables.get(`$${varName}`);
        }
        
        // Otherwise fetch from context
        try {
          const result = await this.aiur.sendMcpRequest('tools/call', {
            name: 'context_get',
            arguments: { name: varName }
          });
          return result?.data || obj;
        } catch {
          return obj;
        }
      } else if (Array.isArray(obj)) {
        return Promise.all(obj.map(item => resolve(item)));
      } else if (obj && typeof obj === 'object') {
        const resolvedObj = {};
        for (const [key, value] of Object.entries(obj)) {
          resolvedObj[key] = await resolve(value);
        }
        return resolvedObj;
      }
      return obj;
    };
    
    return resolve(resolved);
  }

  /**
   * Output text to terminal
   */
  output(text, className = '') {
    const line = document.createElement('div');
    line.className = `cli-output-line ${className}`;
    line.textContent = text;
    this.elements.output.appendChild(line);
    this.elements.output.scrollTop = this.elements.output.scrollHeight;
  }

  /**
   * Clear terminal output
   */
  clear() {
    this.elements.output.innerHTML = '';
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar(type) {
    const sidebar = type === 'variables' ? this.elements.varsSidebar : this.elements.commandsSidebar;
    const button = type === 'variables' ? this.elements.varsBtn : this.elements.commandsBtn;
    
    // Close other sidebar
    const otherSidebar = type === 'variables' ? this.elements.commandsSidebar : this.elements.varsSidebar;
    const otherButton = type === 'variables' ? this.elements.commandsBtn : this.elements.varsBtn;
    otherSidebar.classList.remove('active');
    otherButton.classList.remove('active');
    
    // Toggle current sidebar
    sidebar.classList.toggle('active');
    button.classList.toggle('active');
    
    // Refresh content if opening
    if (sidebar.classList.contains('active')) {
      if (type === 'variables') {
        this.refreshVariables();
      } else {
        this.refreshCommands();
      }
    }
  }

  /**
   * Refresh tools list
   */
  async refreshTools() {
    if (!this.aiur || !this.aiur.toolDefinitions) return;
    
    this.tools.clear();
    for (const [name, def] of this.aiur.toolDefinitions) {
      this.tools.set(name, def);
    }
  }

  /**
   * Refresh variables display
   */
  async refreshVariables() {
    const list = this.elements.varsList;
    list.innerHTML = '';
    
    // Add local variables
    for (const [name, value] of this.variables) {
      const item = document.createElement('div');
      item.className = 'cli-variable-item';
      item.innerHTML = `
        <div class="cli-variable-name">${name}</div>
        <div class="cli-variable-value">${JSON.stringify(value, null, 2)}</div>
      `;
      item.addEventListener('click', () => {
        this.elements.input.value += name;
        this.elements.input.focus();
      });
      list.appendChild(item);
    }
    
    // Add context variables
    try {
      const result = await this.aiur.sendMcpRequest('tools/call', {
        name: 'context_list',
        arguments: {}
      });
      
      if (result?.items) {
        result.items.forEach(item => {
          const varItem = document.createElement('div');
          varItem.className = 'cli-variable-item';
          varItem.innerHTML = `
            <div class="cli-variable-name">@${item.name}</div>
            <div class="cli-variable-value">${JSON.stringify(item.data, null, 2)}</div>
          `;
          varItem.addEventListener('click', () => {
            this.elements.input.value += `@${item.name}`;
            this.elements.input.focus();
          });
          list.appendChild(varItem);
        });
      }
    } catch (error) {
      console.error('Failed to fetch context variables:', error);
    }
  }

  /**
   * Refresh commands display
   */
  refreshCommands() {
    const list = this.elements.commandsList;
    list.innerHTML = '';
    
    // Group tools by category
    const categories = {};
    for (const [name, def] of this.tools) {
      const category = name.split('_')[0] || 'other';
      if (!categories[category]) categories[category] = [];
      categories[category].push({ name, ...def });
    }
    
    // Render categories
    for (const [category, tools] of Object.entries(categories)) {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'cli-command-category';
      
      const header = document.createElement('div');
      header.className = 'cli-command-category-header';
      header.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryDiv.appendChild(header);
      
      tools.forEach(tool => {
        const item = document.createElement('div');
        item.className = 'cli-command-item';
        item.innerHTML = `
          <span class="cli-command-name">${tool.name}</span>
          <span class="cli-command-desc">${tool.description || ''}</span>
        `;
        item.addEventListener('click', () => {
          this.elements.input.value = tool.name + ' ';
          this.elements.input.focus();
        });
        categoryDiv.appendChild(item);
      });
      
      list.appendChild(categoryDiv);
    }
  }

  /**
   * Filter commands based on search
   */
  filterCommands(searchTerm) {
    const items = this.elements.commandsList.querySelectorAll('.cli-command-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.cli-command-name').textContent.toLowerCase();
      const desc = item.querySelector('.cli-command-desc').textContent.toLowerCase();
      
      if (name.includes(term) || desc.includes(term)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Show help information
   */
  showHelp(command) {
    if (!command) {
      // General help
      this.output('Available commands:', 'info');
      this.output('  Built-in Commands:', 'info');
      this.output('    .help [command]  - Show help', 'info');
      this.output('    .commands        - List all tools', 'info');
      this.output('    .vars            - Show variables', 'info');
      this.output('    .clear           - Clear terminal', 'info');
      this.output('    .history         - Show command history', 'info');
      this.output('    .search <term>   - Search commands', 'info');
      this.output('    .describe <tool> - Show tool details', 'info');
      this.output('', 'info');
      this.output('  Syntax:', 'info');
      this.output('    tool_name arg1 arg2 --option=value', 'info');
      this.output('    $var = tool_name args...', 'info');
      this.output('    tool_name @variable', 'info');
    } else {
      // Command-specific help
      const tool = this.tools.get(command);
      if (tool) {
        this.output(`${command} - ${tool.description || 'No description'}`, 'info');
        this.output('', 'info');
        
        if (tool.inputSchema?.properties) {
          this.output('Parameters:', 'info');
          for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
            const required = tool.inputSchema.required?.includes(param) ? ' (required)' : ' (optional)';
            this.output(`  ${param}: ${schema.type}${required}`, 'info');
            if (schema.description) {
              this.output(`    ${schema.description}`, 'info');
            }
          }
        }
      } else {
        this.output(`Unknown command: ${command}`, 'error');
      }
    }
  }

  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    const newIndex = this.historyIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.commandHistory.length) {
      this.historyIndex = newIndex;
      this.elements.input.value = this.commandHistory[newIndex];
    } else if (newIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      this.elements.input.value = '';
    }
  }

  /**
   * Show command history
   */
  showHistory() {
    this.output('Command history:', 'info');
    this.commandHistory.forEach((cmd, index) => {
      this.output(`  ${index + 1}: ${cmd}`, 'info');
    });
  }
}

/**
 * Command Parser - Parses CLI-style commands
 */
class CommandParser {
  parse(input) {
    const trimmed = input.trim();
    
    // Check for built-in commands
    if (trimmed.startsWith('.')) {
      const parts = trimmed.split(/\s+/);
      return {
        type: 'builtin',
        command: parts[0],
        args: parts.slice(1)
      };
    }
    
    // Check for variable assignment
    const assignMatch = trimmed.match(/^\$(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
      const [, variable, command] = assignMatch;
      const parsed = this.parseToolCommand(command.trim());
      return {
        type: 'assignment',
        variable: '$' + variable,
        tool: parsed.tool,
        args: parsed.args
      };
    }
    
    // Parse as tool command
    const parsed = this.parseToolCommand(trimmed);
    return {
      type: 'tool',
      tool: parsed.tool,
      args: parsed.args
    };
  }
  
  /**
   * Parse a tool command with arguments
   */
  parseToolCommand(command) {
    const parts = this.splitCommand(command);
    if (parts.length === 0) {
      throw new Error('Empty command');
    }
    
    const toolName = parts[0];
    const args = {};
    const positional = [];
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Named argument
      if (part.startsWith('--')) {
        const eqIndex = part.indexOf('=');
        if (eqIndex > 0) {
          const key = part.substring(2, eqIndex);
          const value = this.parseValue(part.substring(eqIndex + 1));
          args[key] = value;
        }
      } else {
        // Positional argument
        positional.push(this.parseValue(part));
      }
    }
    
    // Convert positional args based on tool schema
    // For now, we'll use a simple mapping
    if (toolName === 'context_add' && positional.length >= 2) {
      args.name = positional[0];
      args.data = positional[1];
      if (positional[2]) args.description = positional[2];
    } else if (toolName === 'context_get' && positional.length >= 1) {
      args.name = positional[0];
    } else if (toolName === 'file_read' && positional.length >= 1) {
      args.path = positional[0];
    } else if (positional.length > 0) {
      // Generic handling - put positionals in an args array
      args.args = positional;
    }
    
    return { tool: toolName, args };
  }
  
  /**
   * Split command respecting quotes and JSON
   */
  splitCommand(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const nextChar = command[i + 1];
      
      if (!inQuotes) {
        if ((char === '"' || char === "'") && braceDepth === 0 && bracketDepth === 0) {
          inQuotes = true;
          quoteChar = char;
          current += char;
        } else if (char === '{') {
          braceDepth++;
          current += char;
        } else if (char === '}') {
          braceDepth--;
          current += char;
        } else if (char === '[') {
          bracketDepth++;
          current += char;
        } else if (char === ']') {
          bracketDepth--;
          current += char;
        } else if (char === ' ' && braceDepth === 0 && bracketDepth === 0) {
          if (current) {
            parts.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      } else {
        current += char;
        if (char === quoteChar && command[i - 1] !== '\\') {
          inQuotes = false;
          quoteChar = '';
        }
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }
  
  /**
   * Parse a value (handle JSON, strings, numbers, etc.)
   */
  parseValue(value) {
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Try to parse as JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // If JSON parse fails, return as string
        return value;
      }
    }
    
    // Check for boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Check for number
    const num = Number(value);
    if (!isNaN(num) && value !== '') {
      return num;
    }
    
    // Return as string
    return value;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CliTerminal;
}