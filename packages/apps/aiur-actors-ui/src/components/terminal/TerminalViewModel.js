/**
 * TerminalViewModel - ViewModel for terminal component
 */
import { ExtendedBaseViewModel } from '../base/ExtendedBaseViewModel.js';

export class TerminalViewModel extends ExtendedBaseViewModel {
  constructor(model, view, actorSpace) {
    super(model, view, actorSpace);
    
    this.prompt = '> ';
  }

  /**
   * Initialize the view model
   */
  initialize() {
    super.initialize();
    
    // Don't render here - let the Terminal component handle it
  }

  /**
   * Bind model and view
   */
  bind() {
    super.bind();
    
    // Bind view event handlers
    this.view.onInput = this.handleInput.bind(this);
    this.view.onKeyDown = this.handleKeyDown.bind(this);
    this.view.onPaste = this.handlePaste.bind(this);
  }

  /**
   * Parse command string
   * @param {string} commandString - Raw command string
   * @returns {Object} Parsed command
   */
  parseCommand(commandString) {
    const trimmed = commandString.trim();
    
    if (!trimmed) {
      return {
        type: 'empty',
        command: '',
        args: [],
        raw: ''
      };
    }
    
    // Check for built-in commands
    if (trimmed.startsWith('.')) {
      const parts = trimmed.split(/\s+/);
      return {
        type: 'builtin',
        command: parts[0],
        args: parts.slice(1),
        raw: trimmed
      };
    }
    
    // Simple parser that handles quoted arguments for tool commands
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return {
      type: 'tool',
      command: parts[0] || '',
      args: parts.slice(1),
      raw: commandString
    };
  }

  /**
   * Handle input from view
   * @param {Event} event - Input event
   */
  handleInput(event) {
    const text = event.target.value || '';
    this.model.setCurrentCommand(text);
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.handleEnter();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.navigateHistory('up');
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        this.navigateHistory('down');
        break;
        
      case 'Tab':
        event.preventDefault();
        this.handleTab();
        break;
        
      case 'Escape':
        event.preventDefault();
        this.handleEscape();
        break;
        
      case 'ArrowLeft':
        // Let default behavior handle cursor movement
        break;
        
      case 'ArrowRight':
        // Let default behavior handle cursor movement
        break;
    }
  }

  /**
   * Handle paste event
   * @param {string} text - Pasted text
   */
  handlePaste(text) {
    // Only take first line of multi-line paste
    const firstLine = text.split('\n')[0];
    
    // Insert at cursor position
    this.model.insertAtCursor(firstLine);
  }

  /**
   * Handle Enter key
   */
  handleEnter() {
    const command = this.model.currentCommand.trim();
    
    if (!command) {
      return;
    }
    
    // Add to history
    this.model.addCommand(command);
    
    // Clear current command
    this.model.setCurrentCommand('');
    
    // Clear input element
    if (this.view.inputElement) {
      this.view.inputElement.value = '';
    }
    
    // Clear autocomplete
    this.model.clearAutocomplete();
    
    // Add command to output
    this.model.addOutput(`${this.prompt}${command}`, 'command');
    
    // Execute command
    this.executeCommand(command).catch(error => {
      this.model.addOutput(`Error: ${error.message}`, 'error');
    });
  }

  /**
   * Handle Tab key for autocomplete
   */
  handleTab() {
    if (this.model.autocompleteActive) {
      // Apply selected autocomplete
      this.applyAutocomplete();
    } else {
      // Request autocomplete
      const partial = this.model.currentCommand;
      if (partial) {
        this.requestAutocomplete(partial);
      }
    }
  }

  /**
   * Handle Escape key
   */
  handleEscape() {
    if (this.model.autocompleteActive) {
      this.model.clearAutocomplete();
    } else {
      this.model.setCurrentCommand('');
      // Clear input element
      if (this.view.inputElement) {
        this.view.inputElement.value = '';
      }
    }
  }

  /**
   * Navigate command history
   * @param {string} direction - 'up' or 'down'
   */
  navigateHistory(direction) {
    const command = this.model.navigateHistory(direction);
    this.model.setCurrentCommand(command);
    
    // Update input element directly
    if (this.view.inputElement) {
      this.view.inputElement.value = command;
    }
  }

  /**
   * Apply selected autocomplete suggestion
   */
  applyAutocomplete() {
    const suggestion = this.model.getSelectedSuggestion();
    if (suggestion) {
      this.model.setCurrentCommand(suggestion);
      this.model.clearAutocomplete();
      
      // Update input element
      if (this.view.inputElement) {
        this.view.inputElement.value = suggestion;
      }
    }
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    super.onModelChange(event, data);
    
    switch (event) {
      case 'currentCommandChanged':
        this.view.renderCommand(data.command, data.cursor);
        break;
        
      case 'outputAdded':
        this.view.appendOutput(data);
        break;
        
      case 'outputCleared':
        this.view.clearOutput();
        break;
        
      case 'autocompleteChanged':
        if (data.active) {
          this.view.showAutocomplete(data.suggestions, data.index);
        } else {
          this.view.hideAutocomplete();
        }
        break;
        
      case 'autocompleteIndexChanged':
        this.view.updateAutocompleteSelection(data.index);
        break;
        
      case 'executingChanged':
        this.view.setExecuting(data.executing);
        break;
        
      case 'connectionChanged':
        this.view.updateConnectionStatus(data.connected);
        break;
    }
  }

  /**
   * Handle updates from actors
   * @param {Object} update - Update from actor
   */
  handleActorUpdate(update) {
    super.handleActorUpdate(update);
    
    switch (update.type) {
      case 'autocompleteResponse':
        this.model.setAutocompleteSuggestions(update.suggestions || []);
        break;
    }
  }

  /**
   * Request autocomplete suggestions
   * @param {string} partial - Partial command
   */
  requestAutocomplete(partial) {
    if (this.actors.commandActor) {
      this.actors.commandActor.receive({
        type: 'autocomplete',
        partial
      });
    }
  }

  /**
   * Execute command (override from base)
   * @param {string} command - Command to execute
   * @returns {Promise} Execution promise
   */
  async executeCommand(command) {
    this.model.setExecuting(true);
    
    try {
      const parsed = this.parseCommand(command);
      
      // Handle built-in commands
      if (parsed.type === 'builtin') {
        const result = await this.handleBuiltinCommand(parsed);
        return result;
      }
      
      // Handle tool commands
      const result = await super.executeCommand(command);
      return result;
    } catch (error) {
      this.model.addOutput(`Error: ${error.message}`, 'error');
      throw error;
    } finally {
      this.model.setExecuting(false);
    }
  }

  /**
   * Handle built-in commands
   * @param {Object} parsed - Parsed command
   * @returns {Promise} Result of command execution
   */
  async handleBuiltinCommand(parsed) {
    switch (parsed.command) {
      case '.help':
        return this.showHelp(parsed.args[0]);
        
      case '.commands':
      case '.tools':
        return this.showTools();
        
      case '.clear':
        this.model.clearOutput();
        return 'Terminal cleared';
        
      case '.history':
        return this.showHistory();
        
      case '.session':
        return this.showSession();
        
      case '.vars':
        return this.showVariables();
        
      case '.describe':
        return this.describeTool(parsed.args[0]);
        
      default:
        this.model.addOutput(`Unknown command: ${parsed.command}`, 'error');
        this.model.addOutput('Type .help for available commands', 'info');
        return null;
    }
  }

  /**
   * Show help information
   */
  showHelp(command) {
    if (!command) {
      // General help
      this.model.addOutput('Available commands:', 'info');
      this.model.addOutput('', 'info');
      this.model.addOutput('  Built-in Commands:', 'info');
      this.model.addOutput('    .help [command]  - Show help information', 'info');
      this.model.addOutput('    .commands        - List all available tools', 'info');
      this.model.addOutput('    .tools           - List all available tools', 'info');
      this.model.addOutput('    .clear           - Clear terminal output', 'info');
      this.model.addOutput('    .history         - Show command history', 'info');
      this.model.addOutput('    .session         - Show session information', 'info');
      this.model.addOutput('    .vars            - Show variables', 'info');
      this.model.addOutput('    .describe <tool> - Show tool details', 'info');
      this.model.addOutput('', 'info');
      this.model.addOutput('  Tool Execution:', 'info');
      this.model.addOutput('    <tool_name> [args...]  - Execute a tool', 'info');
      this.model.addOutput('', 'info');
      this.model.addOutput('  Examples:', 'info');
      this.model.addOutput('    module_list            - List all modules', 'info');
      this.model.addOutput('    file_read /path/to/file - Read a file', 'info');
      this.model.addOutput('    .describe module_list  - Get help for module_list', 'info');
    } else {
      // Command-specific help
      this.describeTool(command);
    }
    return 'Help displayed';
  }

  /**
   * Show available tools
   */
  showTools() {
    const tools = this.model.get('availableTools') || [];
    
    if (tools.length === 0) {
      this.model.addOutput('No tools available. Connect to server first.', 'info');
    } else {
      this.model.addOutput(`Available tools (${tools.length}):`, 'info');
      this.model.addOutput('', 'info');
      
      // Group tools by category (based on prefix)
      const categories = {};
      tools.forEach(tool => {
        const category = tool.name.split('_')[0] || 'other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(tool);
      });
      
      // Display by category
      Object.keys(categories).sort().forEach(category => {
        this.model.addOutput(`  ${category}:`, 'info');
        categories[category].forEach(tool => {
          const desc = tool.description ? ` - ${tool.description}` : '';
          this.model.addOutput(`    ${tool.name}${desc}`, 'info');
        });
        this.model.addOutput('', 'info');
      });
    }
    
    return 'Tools listed';
  }

  /**
   * Show command history
   */
  showHistory() {
    const history = this.model.commandHistory;
    
    if (history.length === 0) {
      this.model.addOutput('No command history', 'info');
    } else {
      this.model.addOutput('Command history:', 'info');
      history.forEach((cmd, index) => {
        this.model.addOutput(`  ${index + 1}: ${cmd}`, 'info');
      });
    }
    
    return 'History displayed';
  }

  /**
   * Show session information
   */
  showSession() {
    const sessionId = this.model.get('sessionId');
    const connected = this.model.isConnected();
    
    this.model.addOutput('Session Information:', 'info');
    this.model.addOutput(`  Connected: ${connected ? 'Yes' : 'No'}`, 'info');
    
    if (sessionId) {
      this.model.addOutput(`  Session ID: ${sessionId}`, 'info');
    }
    
    const tools = this.model.get('availableTools') || [];
    this.model.addOutput(`  Available tools: ${tools.length}`, 'info');
    
    return 'Session info displayed';
  }

  /**
   * Show variables
   */
  showVariables() {
    // TODO: Implement variable storage
    this.model.addOutput('Variables feature coming soon', 'info');
    return 'Variables displayed';
  }

  /**
   * Describe a specific tool
   */
  describeTool(toolName) {
    if (!toolName) {
      this.model.addOutput('Usage: .describe <tool_name>', 'error');
      return 'Error: No tool specified';
    }
    
    const tools = this.model.get('availableTools') || [];
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      this.model.addOutput(`Tool not found: ${toolName}`, 'error');
      this.model.addOutput('Use .tools to see available tools', 'info');
      return 'Tool not found';
    }
    
    this.model.addOutput(`Tool: ${tool.name}`, 'info');
    
    if (tool.description) {
      this.model.addOutput(`Description: ${tool.description}`, 'info');
    }
    
    if (tool.inputSchema?.properties) {
      this.model.addOutput('', 'info');
      this.model.addOutput('Parameters:', 'info');
      
      for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
        const required = tool.inputSchema.required?.includes(param) ? ' (required)' : ' (optional)';
        const type = schema.type || 'any';
        this.model.addOutput(`  ${param}: ${type}${required}`, 'info');
        
        if (schema.description) {
          this.model.addOutput(`    ${schema.description}`, 'info');
        }
      }
    }
    
    return 'Tool described';
  }

  /**
   * Set connection state (override to trigger view update)
   * @param {boolean} connected - Whether connected
   */
  setConnectionState(connected) {
    super.setConnectionState(connected);
    // The model will emit connectionChanged event which we handle in onModelChange
  }

  /**
   * Get terminal API
   * @returns {Object} Terminal API
   */
  getTerminalAPI() {
    const baseAPI = super.getTerminalAPI();
    
    return {
      ...baseAPI,
      setPrompt: (prompt) => {
        this.prompt = prompt;
        this.view.setPrompt(prompt);
      },
      focus: () => {
        this.view.focusInput();
      }
    };
  }
}