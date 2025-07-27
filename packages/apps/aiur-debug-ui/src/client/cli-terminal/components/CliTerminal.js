/**
 * CliTerminal - Main terminal component
 */

import { CommandParser } from '../parsers/CommandParser.js';
import { CommandHistory } from '../utils/CommandHistory.js';
import { VariableResolver } from '../utils/VariableResolver.js';
import { Autocomplete } from './Autocomplete.js';
import { CommandHelp } from './CommandHelp.js';
import { VariablesList } from './VariablesList.js';
import { CommandsList } from './CommandsList.js';

export class CliTerminal {
  constructor(containerId, aiurConnection) {
    this.containerId = containerId;
    this.aiur = aiurConnection;
    this.isInitialized = false;
    
    // Components
    this.parser = new CommandParser();
    this.history = new CommandHistory();
    this.variableResolver = new VariableResolver(aiurConnection);
    this.autocomplete = null;
    this.commandHelp = new CommandHelp();
    
    // State
    this.tools = new Map();
    this.currentInput = '';
    
    // DOM elements
    this.elements = {};
    
    // Initialize
    this.init();
  }

  /**
   * Initialize the terminal
   */
  async init() {
    console.log('CLI Terminal init() called'); // Debug log
    
    // Inject styles
    this.injectStyles();
    
    // Render HTML
    this.render();
    
    // Get DOM references
    this.getDOMElements();
    
    console.log('CLI elements:', this.elements); // Debug log
    
    // Initialize components
    this.autocomplete = new Autocomplete(this.tools, {
      local: this.variableResolver.localVariables,
      context: []
    });
    this.autocomplete.init(this.elements.autocomplete);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Show welcome message
    this.output('Welcome to Aiur CLI Terminal', 'info');
    this.output('Type .help for available commands or .commands to see all tools', 'info');
    this.output('', '');
    
    // Load initial data
    await this.refreshTools();
    await this.refreshVariables();
    
    this.isInitialized = true;
    console.log('CLI Terminal initialization complete'); // Debug log
  }

  /**
   * Inject component styles
   */
  injectStyles() {
    const styleId = 'cli-terminal-styles';
    
    if (document.getElementById(styleId)) return;
    
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = 'cli-terminal/styles/terminal.css';
    document.head.appendChild(link);
  }

  /**
   * Render the terminal HTML
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
            <h3>🖥️ CLI Terminal</h3>
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
            <div class="cli-input-wrapper">
              <div id="cli-ghost-text" class="cli-ghost-text"></div>
              <input type="text" id="cli-input" class="cli-input" 
                     placeholder="Type a command or .help for assistance" 
                     autocomplete="off" spellcheck="false">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get DOM element references
   */
  getDOMElements() {
    this.elements = {
      output: document.getElementById('cli-output'),
      input: document.getElementById('cli-input'),
      ghostText: document.getElementById('cli-ghost-text'),
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
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input handling
    this.elements.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.elements.input.addEventListener('input', (e) => this.handleInput(e));
    this.elements.input.addEventListener('blur', () => {
      // Hide autocomplete after a delay to allow clicks
      setTimeout(() => this.autocomplete.hide(), 200);
    });
    
    // Button controls
    this.elements.clearBtn.addEventListener('click', () => this.clear());
    this.elements.varsBtn.addEventListener('click', () => this.toggleSidebar('variables'));
    this.elements.commandsBtn.addEventListener('click', () => this.toggleSidebar('commands'));
    
    // Command search
    this.elements.commandSearch.addEventListener('input', (e) => {
      this.filterCommands(e.target.value);
    });
    
    // Focus input on click
    this.elements.output.addEventListener('click', () => {
      this.elements.input.focus();
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
        
      case 'Tab':
        e.preventDefault();
        this.handleTabCompletion();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (this.autocomplete.suggestions.length > 0) {
          this.autocomplete.navigate(-1);
        } else {
          this.navigateHistory(-1);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (this.autocomplete.suggestions.length > 0) {
          this.autocomplete.navigate(1);
        } else {
          this.navigateHistory(1);
        }
        break;
        
      case 'Escape':
        this.autocomplete.hide();
        this.hideGhostText();
        break;
    }
  }

  /**
   * Handle input changes
   */
  handleInput(e) {
    const value = e.target.value;
    this.currentInput = value;
    
    console.log('CLI handleInput:', value); // Debug log
    
    if (value.length > 0) {
      const suggestions = this.autocomplete.getSuggestions(value);
      console.log('Autocomplete suggestions:', suggestions.length); // Debug log
      
      if (suggestions.length > 0) {
        this.autocomplete.show(suggestions, value);
      } else {
        this.autocomplete.hide();
      }
      
      // Always try to update ghost text regardless of autocomplete
      this.updateGhostText(value);
    } else {
      this.autocomplete.hide();
      this.hideGhostText(); // Hide ghost text when input is empty
    }
  }

  /**
   * Handle tab completion
   */
  handleTabCompletion() {
    const selected = this.autocomplete.getSelected();
    if (selected) {
      // Apply the currently selected suggestion
      this.applyCompletion(selected);
    } else {
      // No selection - get suggestions for current input
      const suggestions = this.autocomplete.getSuggestions(this.currentInput);
      
      if (suggestions.length === 1) {
        // Single match - complete it immediately
        this.applyCompletion(suggestions[0]);
      } else if (suggestions.length > 1) {
        // Multiple matches - show them and select the first
        this.autocomplete.show(suggestions, this.currentInput);
        this.autocomplete.selectedIndex = 0;
        this.autocomplete.updateSelection();
      } else if (this.autocomplete.suggestions.length > 0) {
        // Move to next suggestion in visible list
        this.autocomplete.navigate(1);
      }
    }
  }

  /**
   * Apply autocomplete suggestion
   */
  applyCompletion(suggestion) {
    const parts = this.currentInput.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    // Handle different completion types
    if (suggestion.type === 'tool' || suggestion.type === 'builtin') {
      // For commands, replace the last part and add a space
      parts[parts.length - 1] = suggestion.text;
      this.elements.input.value = parts.join(' ') + ' ';
    } else if (suggestion.type === 'argument') {
      // For arguments, replace the last part (already includes =)
      parts[parts.length - 1] = suggestion.text;
      this.elements.input.value = parts.join(' ');
    } else if (suggestion.type === 'variable') {
      // For variables, replace the last part
      parts[parts.length - 1] = '@' + suggestion.text;
      this.elements.input.value = parts.join(' ');
    } else {
      // Default behavior
      parts[parts.length - 1] = suggestion.text;
      this.elements.input.value = parts.join(' ');
    }
    
    this.currentInput = this.elements.input.value;
    this.autocomplete.hide();
    
    // Position cursor at end
    const input = this.elements.input;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  /**
   * Update ghost text parameter hints
   */
  updateGhostText(input) {
    // Don't show ghost text if autocomplete is visible or input is empty
    if (!input.trim() || this.autocomplete.suggestions.length > 0) {
      this.hideGhostText();
      return;
    }
    
    const parsed = this.parseInputForHints(input);
    console.log('Ghost text debug:', { input, parsed }); // Debug log
    
    if (parsed) {
      const ghostText = this.generateParameterHint(parsed);
      console.log('Generated ghost text:', ghostText); // Debug log
      
      // If we're showing hints for a similar command (typo), use the actual typed command
      const displayInput = parsed.actualCommand ? 
        input.replace(parsed.actualCommand, parsed.actualCommand) : 
        input;
      
      this.showGhostText(ghostText, displayInput);
    } else {
      this.hideGhostText();
    }
  }
  
  /**
   * Show ghost text with proper positioning
   */
  showGhostText(ghostText, currentInput) {
    if (!ghostText || !this.elements.ghostText) {
      this.hideGhostText();
      return;
    }
    
    console.log('Showing ghost text:', { ghostText, currentInput }); // Debug log
    
    // Get the actual input element's font properties
    const inputStyle = window.getComputedStyle(this.elements.input);
    
    // Create a canvas to measure text accurately
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = inputStyle.font;
    
    // Measure the current input text width
    const textWidth = context.measureText(currentInput).width;
    
    // Position ghost text after the current input with a small gap
    this.elements.ghostText.style.paddingLeft = (textWidth + 2) + 'px';
    this.elements.ghostText.textContent = ghostText;
    this.elements.ghostText.style.display = 'flex';
    this.elements.ghostText.style.visibility = 'visible';
    this.elements.ghostText.style.color = '#888';  // Changed from red to gray
    
    console.log('Ghost text positioning:', {
      currentInput: currentInput,
      textWidth: textWidth,
      ghostText: ghostText,
      paddingLeft: (textWidth + 2) + 'px'
    });
  }
  
  /**
   * Hide ghost text
   */
  hideGhostText() {
    if (this.elements.ghostText) {
      this.elements.ghostText.textContent = '';
      this.elements.ghostText.style.visibility = 'hidden';
      this.elements.ghostText.style.paddingLeft = '0';
    }
  }
  
  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Parse input for parameter hints
   */
  parseInputForHints(input) {
    const parts = input.trim().split(/\s+/);
    
    // Need at least one word
    if (parts.length < 1) {
      return null;
    }
    
    const command = parts[0];
    
    // Only show hints if we have a command + space or multiple parts
    if (!input.endsWith(' ') && parts.length === 1) {
      return null;
    }
    
    const currentArgs = input.endsWith(' ') ? parts.slice(1) : parts.slice(1, -1);
    
    // Check if it's a known tool
    if (this.tools.has(command)) {
      return {
        type: 'tool',
        command: command,
        currentArgs: currentArgs,
        tool: this.tools.get(command)
      };
    }
    
    // Check if it's a built-in command
    const builtins = ['.help', '.commands', '.vars', '.clear', '.history', '.search', '.describe'];
    if (builtins.includes(command)) {
      return {
        type: 'builtin',
        command: command,
        currentArgs: currentArgs
      };
    }
    
    // Try to find similar commands (for typos/autocomplete)
    const similarTool = this.findSimilarTool(command);
    if (similarTool) {
      console.log(`Found similar tool '${similarTool}' for '${command}'`);
      return {
        type: 'tool',
        command: similarTool,
        currentArgs: currentArgs,
        tool: this.tools.get(similarTool),
        actualCommand: command // Keep track of what was actually typed
      };
    }
    
    return null;
  }
  
  /**
   * Generate parameter hint text
   */
  generateParameterHint(parsed) {
    if (parsed.type === 'tool') {
      return this.generateToolParameterHint(parsed);
    } else if (parsed.type === 'builtin') {
      return this.generateBuiltinParameterHint(parsed);
    }
    return '';
  }
  
  /**
   * Generate tool parameter hint
   */
  generateToolParameterHint(parsed) {
    const { tool, currentArgs, command } = parsed;
    const schema = tool.inputSchema;
    
    if (!schema || !schema.properties) {
      return '';
    }
    
    // Get tool-specific hint patterns
    const customHints = this.getCustomToolHints(command);
    if (customHints) {
      return this.generateCustomHint(customHints, currentArgs);
    }
    
    const hints = [];
    const required = schema.required || [];
    const properties = Object.entries(schema.properties);
    
    // Simple approach: show required parameters first, then optional ones
    let paramIndex = currentArgs.length;
    
    // Skip already provided positional arguments
    for (const [propName, propSchema] of properties) {
      const isRequired = required.includes(propName);
      
      if (paramIndex === 0) {
        // First parameter to show
        if (isRequired) {
          hints.push(`<${propName}>`);
        } else {
          hints.push(`[${propName}]`);
        }
        break;
      } else if (isRequired) {
        paramIndex--;
      }
    }
    
    // If no specific parameter, show general pattern
    if (hints.length === 0 && required.length > currentArgs.length) {
      const nextRequired = required[currentArgs.length];
      if (nextRequired) {
        hints.push(`<${nextRequired}>`);
      }
    }
    
    return hints.join(' ');
  }
  
  /**
   * Get custom tool hint patterns
   */
  getCustomToolHints(toolName) {
    const customHints = {
      'context_add': ['<name>', '<data>', '[description]'],
      'context_get': ['<name>'],
      'context_list': ['[filter]'],
      'file_read': ['<filepath>'],
      'file_write': ['<filepath>', '<content>'],
      'directory_create': ['<dirpath>'],
      'directory_list': ['[dirpath]'],
      'directory_change': ['<dirpath>'],
      'plan_create': ['<description>', '[options]'],
      'plan_execute': ['<plan>', '[options]']
    };
    
    return customHints[toolName];
  }
  
  /**
   * Generate custom hint based on current arguments
   */
  generateCustomHint(hintPattern, currentArgs) {
    const remaining = hintPattern.slice(currentArgs.length);
    return remaining.length > 0 ? remaining[0] : '';
  }
  
  /**
   * Generate builtin parameter hint
   */
  generateBuiltinParameterHint(parsed) {
    const { command, currentArgs } = parsed;
    
    const builtinHints = {
      '.help': currentArgs.length === 0 ? '[command]' : '',
      '.search': currentArgs.length === 0 ? '<term>' : '',
      '.describe': currentArgs.length === 0 ? '<command>' : '',
      '.commands': '',
      '.vars': '',
      '.clear': '',
      '.history': ''
    };
    
    return builtinHints[command] || '';
  }

  /**
   * Execute a command
   */
  async executeCommand(command) {
    if (!command.trim()) return;
    
    // Add to history
    this.history.add(command);
    
    // Clear input
    this.elements.input.value = '';
    this.currentInput = '';
    this.autocomplete.hide();
    this.hideGhostText();
    
    // Output command
    this.output(`aiur> ${command}`, 'command');
    
    try {
      // Parse command
      const parsed = this.parser.parse(command);
      
      switch (parsed.type) {
        case 'builtin':
          await this.handleBuiltinCommand(parsed);
          break;
          
        case 'assignment':
          await this.handleAssignment(parsed);
          break;
          
        case 'tool':
          await this.handleToolExecution(parsed);
          break;
          
        default:
          this.output(`Unknown command type: ${parsed.type}`, 'error');
      }
    } catch (error) {
      this.output(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Handle built-in commands
   */
  async handleBuiltinCommand(parsed) {
    const { command, args } = parsed;
    
    switch (command) {
      case '.help':
        this.showHelp(args[0]);
        break;
        
      case '.commands':
        this.showCommands();
        break;
        
      case '.vars':
        await this.showVariables();
        break;
        
      case '.clear':
        this.clear();
        break;
        
      case '.history':
        this.showHistory();
        break;
        
      case '.search':
        this.searchCommands(args.join(' '));
        break;
        
      case '.describe':
        this.describeCommand(args[0]);
        break;
        
      default:
        this.output(`Unknown command: ${command}`, 'error');
    }
  }

  /**
   * Handle variable assignment
   */
  async handleAssignment(parsed) {
    const { variable, tool, args } = parsed;
    
    try {
      // Execute the tool
      const result = await this.executeTool(tool, args);
      
      if (result !== undefined) {
        // Store the variable
        this.variableResolver.setVariable(variable, result);
        this.output(`✓ Stored result in ${variable}`, 'success');
        
        // Also store in context if it's a context operation
        if (tool === 'context_add' && result.success) {
          this.output(`✓ Also saved to context as @${args.name}`, 'success');
        }
        
        // Refresh variables display
        await this.refreshVariables();
      }
    } catch (error) {
      this.output(`Failed to execute assignment: ${error.message}`, 'error');
    }
  }

  /**
   * Handle tool execution
   */
  async handleToolExecution(parsed) {
    const { tool, args } = parsed;
    await this.executeTool(tool, args);
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args) {
    // Check if tool exists
    if (!this.tools.has(toolName)) {
      this.output(`Unknown tool: ${toolName}`, 'error');
      this.output(`Use .commands to see available tools`, 'info');
      return undefined;
    }
    
    try {
      // Resolve any @variable references
      const resolvedArgs = await this.variableResolver.resolve(args);
      
      // Show execution status
      this.output(`Executing ${toolName}...`, 'info');
      
      // Execute via Aiur connection with proper promise handling
      const response = await this.sendToolRequest(toolName, resolvedArgs);
      
      // Extract result
      let result = response;
      if (response && response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          try {
            result = JSON.parse(textContent.text);
          } catch {
            result = textContent.text;
          }
        }
      }
      
      // Display result
      if (result !== undefined) {
        this.output(JSON.stringify(result, null, 2), 'result');
      }
      
      return result;
      
    } catch (error) {
      this.output(`Execution failed: ${error.message}`, 'error');
      return undefined;
    }
  }

  /**
   * Send tool request and wait for response
   */
  async sendToolRequest(toolName, args) {
    return new Promise((resolve, reject) => {
      const requestId = `cli_req_${++this.aiur.requestId}`;
      
      // Store the promise resolver
      this.aiur.pendingRequests.set(requestId, {
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        timestamp: Date.now(),
        resolve: resolve,
        reject: reject
      });
      
      // Send the request
      const success = this.aiur.sendMessage({
        type: 'mcp_request',
        requestId: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });
      
      if (!success) {
        this.aiur.pendingRequests.delete(requestId);
        reject(new Error('Failed to send request'));
      }
      
      // Set a timeout
      setTimeout(() => {
        if (this.aiur.pendingRequests.has(requestId)) {
          this.aiur.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Output text to terminal
   */
  output(text, className = '') {
    const line = document.createElement('div');
    line.className = `cli-output-line ${className}`;
    
    // Support basic markdown-like formatting
    if (className !== 'result') {
      text = text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      line.innerHTML = text;
    } else {
      line.textContent = text;
    }
    
    this.elements.output.appendChild(line);
    this.elements.output.scrollTop = this.elements.output.scrollHeight;
  }

  /**
   * Clear terminal output
   */
  clear() {
    this.elements.output.innerHTML = '';
    this.hideGhostText();
  }

  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    let command;
    
    if (direction === -1) {
      command = this.history.previous(this.currentInput);
    } else {
      command = this.history.next(this.currentInput);
    }
    
    this.elements.input.value = command;
    this.currentInput = command;
    
    // Move cursor to end
    this.elements.input.setSelectionRange(command.length, command.length);
  }

  /**
   * Toggle sidebar
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
   * Refresh tools from Aiur connection
   */
  async refreshTools() {
    if (!this.aiur || !this.aiur.toolDefinitions) return;
    
    this.tools.clear();
    for (const [name, def] of this.aiur.toolDefinitions) {
      this.tools.set(name, def);
    }
    
    // Update autocomplete
    this.autocomplete.updateTools(this.tools);
  }

  /**
   * Refresh variables display
   */
  async refreshVariables() {
    const variables = await this.variableResolver.getAllVariables();
    
    // Update autocomplete
    this.autocomplete.updateVariables(variables);
    
    // Update sidebar
    const list = new VariablesList(variables);
    this.elements.varsList.innerHTML = list.render();
    
    // Add click handlers
    this.elements.varsList.querySelectorAll('.cli-variable-item').forEach(item => {
      item.addEventListener('click', () => {
        const varName = item.dataset.variable;
        this.elements.input.value += varName;
        this.elements.input.focus();
      });
    });
  }

  /**
   * Refresh commands display
   */
  refreshCommands() {
    const commands = new CommandsList(this.tools);
    this.elements.commandsList.innerHTML = commands.render();
    
    // Add click handlers
    this.elements.commandsList.querySelectorAll('.cli-command-item').forEach(item => {
      item.addEventListener('click', () => {
        const command = item.dataset.command;
        this.elements.input.value = command + ' ';
        this.elements.input.focus();
      });
    });
  }

  /**
   * Filter commands
   */
  filterCommands(searchTerm) {
    const items = this.elements.commandsList.querySelectorAll('.cli-command-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const command = item.dataset.command.toLowerCase();
      const desc = item.querySelector('.cli-command-desc').textContent.toLowerCase();
      
      if (command.includes(term) || desc.includes(term)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Show help
   */
  showHelp(command) {
    const help = this.commandHelp.getHelp(command, this.tools);
    this.output(help, 'info');
  }

  /**
   * Show all commands
   */
  showCommands() {
    const commands = this.commandHelp.getAllCommands(this.tools);
    this.output(commands, 'info');
  }

  /**
   * Show variables
   */
  async showVariables() {
    const variables = await this.variableResolver.getAllVariables();
    const output = this.commandHelp.formatVariables(variables);
    this.output(output, 'info');
  }

  /**
   * Show command history
   */
  showHistory() {
    const history = this.history.getAll();
    this.output('Command History:', 'info');
    history.forEach((cmd, index) => {
      this.output(`  ${index + 1}: ${cmd}`, 'info');
    });
  }

  /**
   * Search commands
   */
  searchCommands(term) {
    if (!term) {
      this.output('Usage: .search <term>', 'error');
      return;
    }
    
    const results = this.commandHelp.searchCommands(term, this.tools);
    this.output(results, 'info');
  }

  /**
   * Describe a command
   */
  describeCommand(command) {
    if (!command) {
      this.output('Usage: .describe <command>', 'error');
      return;
    }
    
    const description = this.commandHelp.describeCommand(command, this.tools);
    this.output(description, 'info');
  }
  
  /**
   * Find a similar tool name (for handling typos)
   */
  findSimilarTool(input) {
    if (!input || input.length < 3) return null;
    
    const lowerInput = input.toLowerCase();
    
    // First, try exact match (case insensitive)
    for (const [name] of this.tools) {
      if (name.toLowerCase() === lowerInput) {
        return name;
      }
    }
    
    // Then try prefix match
    for (const [name] of this.tools) {
      if (name.toLowerCase().startsWith(lowerInput)) {
        return name;
      }
    }
    
    // Try to find tools that contain the input
    for (const [name] of this.tools) {
      if (name.toLowerCase().includes(lowerInput)) {
        return name;
      }
    }
    
    // Try Levenshtein distance for close matches
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const [name] of this.tools) {
      const distance = this.levenshteinDistance(lowerInput, name.toLowerCase());
      // Allow up to 2 character differences for typos
      if (distance <= 2 && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = name;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
}