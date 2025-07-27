/**
 * CliTerminalV2 - Clean implementation based on working example
 */

export class CliTerminalV2 {
  constructor(containerId, aiurConnection) {
    this.containerId = containerId;
    this.aiur = aiurConnection;
    
    // Tool definitions with structure
    this.commands = {};
    this.setupCommands();
    
    // State
    this.history = [];
    this.historyIndex = -1;
    this.currentSuggestion = '';
    this.selectedAutocomplete = -1;
    
    // Initialize
    this.init();
  }

  init() {
    // Inject styles
    this.injectStyles();
    
    // Render HTML
    this.render();
    
    // Initialize elements
    this.initializeElements();
    
    // Bind events
    this.bindEvents();
    
    // Focus input
    this.focusInput();
    
    // Show welcome message
    this.addOutput('Welcome to Aiur CLI Terminal v2', 'info');
    this.addOutput('Type a command or press Tab for suggestions', 'info');
    this.addOutput('');
  }

  setupCommands() {
    // Built-in commands
    this.commands['.help'] = {
      description: 'Show help information',
      structure: '.help [command]',
      params: [],
      execute: (args) => this.showHelp(args[0])
    };
    
    this.commands['.commands'] = {
      description: 'List all available commands',
      structure: '.commands',
      params: [],
      execute: () => this.showCommands()
    };
    
    this.commands['.vars'] = {
      description: 'Show all variables',
      structure: '.vars',
      params: [],
      execute: () => this.showVariables()
    };
    
    this.commands['.clear'] = {
      description: 'Clear terminal output',
      structure: '.clear',
      params: [],
      execute: () => this.clearScreen()
    };
    
    this.commands['.history'] = {
      description: 'Show command history',
      structure: '.history',
      params: [],
      execute: () => this.showHistory()
    };
    
    // Tool commands will be added dynamically from aiur connection
    this.updateToolCommands();
  }

  updateToolCommands() {
    if (!this.aiur || !this.aiur.toolDefinitions) return;
    
    // Define structures for known tools
    const toolStructures = {
      'context_add': 'context_add <name> <data> [description]',
      'context_get': 'context_get <name>',
      'context_list': 'context_list [filter]',
      'context_remove': 'context_remove <name>',
      'context_clear': 'context_clear',
      'file_read': 'file_read <filepath>',
      'file_write': 'file_write <filepath> <content>',
      'file_edit': 'file_edit <filepath> <old_text> <new_text>',
      'file_search': 'file_search <pattern> [directory]',
      'directory_create': 'directory_create <dirpath>',
      'directory_list': 'directory_list [dirpath]',
      'directory_remove': 'directory_remove <dirpath>',
      'directory_change': 'directory_change <dirpath>',
      'plan_create': 'plan_create <title> [description]',
      'plan_execute': 'plan_execute <planHandle>',
      'plan_status': 'plan_status <planHandle>',
      'plan_validate': 'plan_validate <planHandle>',
      'plan_list': 'plan_list [filter]',
      'metric_record': 'metric_record <metric> <value>',
      'metric_query': 'metric_query <metric> [options]',
      'log_write': 'log_write <level> <message>',
      'log_query': 'log_query [options]',
      'alert_trigger': 'alert_trigger <alertType> <message>',
      'alert_list': 'alert_list [status]'
    };
    
    for (const [name, def] of this.aiur.toolDefinitions) {
      this.commands[name] = {
        description: def.description || '',
        structure: toolStructures[name] || name,
        params: this.extractParams(def.inputSchema),
        execute: (args) => this.executeTool(name, args)
      };
    }
  }

  extractParams(schema) {
    if (!schema || !schema.properties) return [];
    return Object.keys(schema.properties);
  }

  injectStyles() {
    const styleId = 'cli-terminal-v2-styles';
    
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cli-terminal-v2 {
        height: 100%;
        padding: 20px;
        overflow-y: auto;
        background: #1a1a1a;
        color: #00ff00;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 13px;
        border-radius: 8px;
      }

      .cli-terminal-v2 .terminal-header {
        color: #888;
        margin-bottom: 20px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
      }

      .cli-terminal-v2 .output-line {
        margin-bottom: 5px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .cli-terminal-v2 .input-container {
        position: relative;
        display: flex;
        align-items: center;
        margin-top: 10px;
      }

      .cli-terminal-v2 .prompt {
        color: #00ffff;
        margin-right: 10px;
        user-select: none;
      }

      .cli-terminal-v2 .input-wrapper {
        position: relative;
        flex: 1;
      }

      .cli-terminal-v2 .command-input {
        background: transparent;
        border: none;
        outline: none;
        color: #00ff00;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.4;
        width: 100%;
        position: relative;
        z-index: 2;
        padding: 0;
        margin: 0;
      }

      .cli-terminal-v2 .suggestion-text {
        position: absolute;
        top: 0;
        left: 0;
        color: #444;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.4;
        pointer-events: none;
        z-index: 1;
        white-space: pre;
        padding: 0;
        margin: 0;
      }

      .cli-terminal-v2 .autocomplete-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 10;
        display: none;
        margin-top: 4px;
      }

      .cli-terminal-v2 .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #333;
      }

      .cli-terminal-v2 .autocomplete-item:hover,
      .cli-terminal-v2 .autocomplete-item.selected {
        background: #3a3a3a;
      }

      .cli-terminal-v2 .autocomplete-item:last-child {
        border-bottom: none;
      }

      .cli-terminal-v2 .command-name {
        color: #00ffff;
        font-weight: bold;
      }

      .cli-terminal-v2 .command-description {
        color: #888;
        font-size: 12px;
        margin-left: 10px;
      }

      .cli-terminal-v2 .error {
        color: #ff6b6b;
      }

      .cli-terminal-v2 .success {
        color: #51cf66;
      }

      .cli-terminal-v2 .info {
        color: #74c0fc;
      }

      .cli-terminal-v2 .command {
        color: #ccc;
      }

      .cli-terminal-v2 .result {
        color: #d4d4d4;
        background: #252526;
        padding: 12px;
        margin: 8px 0;
        border-radius: 4px;
        border-left: 3px solid #007acc;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container ${this.containerId} not found`);
      return;
    }
    
    container.innerHTML = `
      <div class="cli-terminal-v2">
        <div class="terminal-header">
          <div>Aiur CLI Terminal v2</div>
          <div>Tab for autocomplete • ↑↓ for history • .help for commands</div>
        </div>
        
        <div id="cli-v2-output"></div>
        
        <div class="input-container">
          <span class="prompt">aiur&gt;</span>
          <div class="input-wrapper">
            <div class="suggestion-text" id="cli-v2-suggestion"></div>
            <input type="text" class="command-input" id="cli-v2-input" autocomplete="off" spellcheck="false">
            <div class="autocomplete-dropdown" id="cli-v2-autocomplete"></div>
          </div>
        </div>
      </div>
    `;
  }

  initializeElements() {
    this.output = document.getElementById('cli-v2-output');
    this.input = document.getElementById('cli-v2-input');
    this.suggestion = document.getElementById('cli-v2-suggestion');
    this.autocomplete = document.getElementById('cli-v2-autocomplete');
  }

  bindEvents() {
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.hideAutocomplete(), 200);
    });
    this.input.addEventListener('focus', () => this.updateSuggestions());
    
    // Keep focus on input when clicking in terminal
    const terminal = this.output.parentElement;
    terminal.addEventListener('click', (e) => {
      if (e.target !== this.input && !e.target.closest('.autocomplete-dropdown')) {
        this.focusInput();
      }
    });
  }

  focusInput() {
    setTimeout(() => this.input.focus(), 0);
  }

  handleInput(e) {
    this.updateSuggestions();
  }

  handleKeyDown(e) {
    switch(e.key) {
      case 'Enter':
        e.preventDefault();
        this.executeCommand();
        break;
      case 'Tab':
        e.preventDefault();
        this.acceptSuggestion();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.autocomplete.style.display === 'block') {
          this.navigateAutocomplete(-1);
        } else {
          this.navigateHistory(-1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (this.autocomplete.style.display === 'block') {
          this.navigateAutocomplete(1);
        } else {
          this.navigateHistory(1);
        }
        break;
      case 'Escape':
        this.hideAutocomplete();
        break;
    }
  }

  updateSuggestions() {
    const value = this.input.value.trim();
    const parts = value.split(' ');
    const command = parts[0];
    
    this.suggestion.textContent = '';
    this.selectedAutocomplete = -1;
    this.hideAutocomplete();

    // If we have a recognized command, show its argument structure
    if (this.commands[command]) {
      this.showCommandStructure(value, command);
    } else if (value && !value.includes(' ')) {
      // Show command completions if typing a partial command
      this.showCommandCompletions(value);
    }
  }

  showCommandStructure(currentInput, command) {
    const cmdDef = this.commands[command];
    if (!cmdDef || !cmdDef.structure) {
      return;
    }

    // Show the full command structure with current input
    const structure = cmdDef.structure;
    const suggestion = currentInput + structure.substring(currentInput.length);
    this.suggestion.textContent = suggestion;
    this.currentSuggestion = suggestion;
  }

  showCommandCompletions(partial) {
    const matches = Object.keys(this.commands).filter(cmd => 
      cmd.startsWith(partial) && cmd !== partial
    );

    if (matches.length === 1) {
      const command = matches[0];
      const cmdDef = this.commands[command];
      
      // Show command + its structure
      if (cmdDef.structure) {
        this.suggestion.textContent = command + cmdDef.structure.substring(command.length);
        this.currentSuggestion = command + cmdDef.structure.substring(command.length);
      } else {
        this.suggestion.textContent = command;
        this.currentSuggestion = command;
      }
      
      this.hideAutocomplete();
    } else if (matches.length > 1) {
      this.showAutocompleteDropdown(matches.map(cmd => ({
        text: cmd,
        description: this.commands[cmd].description
      })));
      this.suggestion.textContent = '';
    } else {
      this.hideAutocomplete();
    }
  }

  showAutocompleteDropdown(items) {
    this.autocomplete.innerHTML = '';
    this.autocomplete.style.display = 'block';

    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerHTML = `
        <span class="command-name">${item.text}</span>
        <span class="command-description">${item.description}</span>
      `;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selectAutocompleteItem(item.text);
      });
      this.autocomplete.appendChild(div);
    });
  }

  hideAutocomplete() {
    this.autocomplete.style.display = 'none';
    this.selectedAutocomplete = -1;
  }

  navigateAutocomplete(direction) {
    const items = this.autocomplete.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (this.selectedAutocomplete >= 0) {
      items[this.selectedAutocomplete].classList.remove('selected');
    }

    this.selectedAutocomplete += direction;
    if (this.selectedAutocomplete < 0) this.selectedAutocomplete = items.length - 1;
    if (this.selectedAutocomplete >= items.length) this.selectedAutocomplete = 0;

    items[this.selectedAutocomplete].classList.add('selected');
    items[this.selectedAutocomplete].scrollIntoView({ block: 'nearest' });
  }

  selectAutocompleteItem(text) {
    const value = this.input.value;
    const parts = value.split(' ');
    
    if (parts.length === 1) {
      this.input.value = text + ' ';
    } else {
      parts[parts.length - 1] = text;
      this.input.value = parts.join(' ') + ' ';
    }
    
    this.hideAutocomplete();
    this.suggestion.textContent = '';
    this.focusInput();
    this.updateSuggestions();
  }

  acceptSuggestion() {
    if (this.selectedAutocomplete >= 0) {
      const selected = this.autocomplete.querySelector('.autocomplete-item.selected');
      if (selected) {
        const text = selected.querySelector('.command-name').textContent;
        this.selectAutocompleteItem(text);
        return;
      }
    }

    if (this.currentSuggestion && this.suggestion.textContent) {
      // Only accept the next word/parameter, not the whole suggestion
      const currentLen = this.input.value.length;
      const suggestion = this.suggestion.textContent;
      
      // Find next word boundary after current position
      let nextSpace = suggestion.indexOf(' ', currentLen);
      if (nextSpace === -1) nextSpace = suggestion.length;
      
      // If we're at a space, find the next non-space
      let nextWordEnd = currentLen;
      if (suggestion[currentLen] === ' ') {
        // Skip spaces
        while (nextWordEnd < suggestion.length && suggestion[nextWordEnd] === ' ') {
          nextWordEnd++;
        }
        // Find end of next word
        let end = suggestion.indexOf(' ', nextWordEnd);
        nextWordEnd = end === -1 ? suggestion.length : end;
      } else {
        nextWordEnd = nextSpace;
      }
      
      this.input.value = suggestion.substring(0, nextWordEnd);
      this.updateSuggestions();
    }
  }

  navigateHistory(direction) {
    if (this.history.length === 0) return;

    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex >= this.history.length) this.historyIndex = this.history.length - 1;

    this.input.value = this.history[this.history.length - 1 - this.historyIndex];
    this.updateSuggestions();
  }

  async executeCommand() {
    const command = this.input.value.trim();
    if (!command) return;

    this.addOutput(`aiur> ${command}`, 'command');
    this.history.push(command);
    this.historyIndex = -1;

    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    if (this.commands[cmd]) {
      try {
        await this.commands[cmd].execute(args);
      } catch (error) {
        this.addOutput(`Error: ${error.message}`, 'error');
      }
    } else {
      this.addOutput(`Command not found: ${cmd}`, 'error');
      this.addOutput(`Type .commands to see available commands`, 'info');
    }

    this.input.value = '';
    this.suggestion.textContent = '';
    this.hideAutocomplete();
    this.scrollToBottom();
  }

  addOutput(text, className = '') {
    const div = document.createElement('div');
    div.className = `output-line ${className}`;
    
    // Support basic formatting for result display
    if (className === 'result' && typeof text === 'string' && (text.startsWith('{') || text.startsWith('['))) {
      try {
        const parsed = JSON.parse(text);
        div.textContent = JSON.stringify(parsed, null, 2);
      } catch {
        div.textContent = text;
      }
    } else {
      div.textContent = text;
    }
    
    this.output.appendChild(div);
  }

  scrollToBottom() {
    this.output.scrollTop = this.output.scrollHeight;
  }

  // Command implementations
  showHelp(commandName) {
    if (commandName) {
      const cmd = this.commands[commandName];
      if (cmd) {
        this.addOutput(`Command: ${commandName}`, 'info');
        this.addOutput(`Description: ${cmd.description}`);
        this.addOutput(`Usage: ${cmd.structure}`);
      } else {
        this.addOutput(`Unknown command: ${commandName}`, 'error');
      }
    } else {
      this.addOutput('Available commands:', 'info');
      this.addOutput('');
      this.addOutput('Built-in commands:', 'info');
      ['.help', '.commands', '.vars', '.clear', '.history'].forEach(name => {
        const cmd = this.commands[name];
        this.addOutput(`  ${name.padEnd(15)} - ${cmd.description}`);
      });
      this.addOutput('');
      this.addOutput('Type .commands to see all available tools', 'info');
    }
  }

  showCommands() {
    const builtins = ['.help', '.commands', '.vars', '.clear', '.history'];
    const tools = Object.keys(this.commands).filter(cmd => !builtins.includes(cmd));
    
    this.addOutput('Built-in Commands:', 'info');
    builtins.forEach(name => {
      const cmd = this.commands[name];
      this.addOutput(`  ${name.padEnd(20)} - ${cmd.description}`);
    });
    
    this.addOutput('');
    this.addOutput('Available Tools:', 'info');
    tools.sort().forEach(name => {
      const cmd = this.commands[name];
      this.addOutput(`  ${name.padEnd(20)} - ${cmd.description}`);
    });
  }

  async showVariables() {
    // This would show variables stored in context
    try {
      const result = await this.executeTool('context_list', []);
      // Result will be displayed by executeTool
    } catch (error) {
      this.addOutput('No variables stored yet', 'info');
    }
  }

  showHistory() {
    if (this.history.length === 0) {
      this.addOutput('No command history', 'info');
      return;
    }
    
    this.addOutput('Command History:', 'info');
    this.history.forEach((cmd, index) => {
      this.addOutput(`  ${(this.history.length - index).toString().padStart(3)} │ ${cmd}`);
    });
  }

  clearScreen() {
    this.output.innerHTML = '';
  }

  // Tool execution
  async executeTool(toolName, args) {
    if (!this.aiur) {
      throw new Error('Not connected to Aiur server');
    }

    // Parse arguments into proper format for the tool
    const params = this.parseToolArguments(toolName, args);
    
    this.addOutput(`Executing ${toolName}...`, 'info');
    
    try {
      const response = await this.sendToolRequest(toolName, params);
      
      // Extract and display result
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
      
      if (result !== undefined) {
        this.addOutput(JSON.stringify(result, null, 2), 'result');
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  parseToolArguments(toolName, args) {
    // Tool-specific argument parsing
    const parsers = {
      'context_add': (args) => {
        const params = {};
        if (args[0]) params.name = args[0];
        if (args[1]) {
          try {
            params.data = JSON.parse(args[1]);
          } catch {
            params.data = args[1];
          }
        }
        if (args[2]) params.description = args.slice(2).join(' ');
        return params;
      },
      'context_get': (args) => ({ name: args[0] }),
      'context_list': (args) => args[0] ? { filter: args[0] } : {},
      'file_read': (args) => ({ path: args[0] }),
      'file_write': (args) => ({ path: args[0], content: args.slice(1).join(' ') }),
      'plan_create': (args) => ({ title: args[0], description: args.slice(1).join(' ') }),
      'plan_execute': (args) => ({ planHandle: args[0] })
    };
    
    const parser = parsers[toolName];
    if (parser) {
      return parser(args);
    }
    
    // Default: convert positional args to object
    const tool = this.commands[toolName];
    if (tool && tool.params) {
      const params = {};
      tool.params.forEach((param, index) => {
        if (index < args.length) {
          params[param] = args[index];
        }
      });
      return params;
    }
    
    return {};
  }

  async sendToolRequest(toolName, args) {
    return new Promise((resolve, reject) => {
      const requestId = `cli_v2_req_${++this.aiur.requestId}`;
      
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
}