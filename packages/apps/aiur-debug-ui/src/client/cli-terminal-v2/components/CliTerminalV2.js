/**
 * CliTerminalV2 - Clean implementation based on working example
 */

import { ResponseFormatter } from './ResponseFormatter.js';

export class CliTerminalV2 {
  constructor(containerOrId, apiInterface, toolManager = null) {
    // Accept either a DOM node or an ID string
    if (typeof containerOrId === 'string') {
      this.container = document.getElementById(containerOrId);
      if (!this.container) {
        throw new Error(`Container with ID '${containerOrId}' not found`);
      }
    } else if (containerOrId instanceof HTMLElement) {
      this.container = containerOrId;
    } else {
      throw new Error('Container must be a DOM element or an ID string');
    }
    
    this.interface = apiInterface;
    this.toolManager = toolManager;
    
    // Tool definitions with structure
    this.commands = {};
    this.setupCommands();
    
    // State
    this.history = [];
    this.historyIndex = -1;
    this.currentSuggestion = '';
    this.tabCompletions = [];
    this.tabIndex = -1;
    this.tabPrefix = '';
    this.originalTabInput = '';
    
    // Response formatter
    this.responseFormatter = new ResponseFormatter();
    
    // Initialize
    this.init();
  }

  async init() {
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
    
    // Subscribe to tool updates from ToolManager
    if (this.toolManager) {
      // Listen for tool changes
      this.toolManager.addEventListener('toolsChanged', (event) => {
        console.log('[CLI] Tools changed, updating commands...');
        this.updateToolCommands();
      });
      
      // Listen for initial ready state
      this.toolManager.addEventListener('ready', (event) => {
        console.log('[CLI] Tools ready, updating commands...');
        this.updateToolCommands();
      });
      
      // If tools are already ready, update immediately
      if (this.toolManager.isToolsReady()) {
        console.log('[CLI] Tools already ready, updating commands immediately...');
        this.updateToolCommands();
      }
    } else {
      // Fallback to legacy interface
      if (this.interface.onToolsUpdated) {
        this.interface.onToolsUpdated(() => {
          this.updateToolCommands();
        });
      }
      
      // Load initial tools
      await this.refreshTools();
    }
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
    let toolDefinitions;
    
    if (this.toolManager) {
      // Use ToolManager as primary source
      toolDefinitions = this.toolManager.getTools();
      console.log(`[CLI] Updating commands from ToolManager: ${toolDefinitions.size} tools`);
    } else if (this.interface && this.interface.getTools) {
      // Fallback to legacy interface
      toolDefinitions = this.interface.getTools();
      console.log(`[CLI] Updating commands from legacy interface: ${toolDefinitions?.size || 0} tools`);
    } else {
      console.warn('[CLI] No tool source available');
      return;
    }
    
    if (!toolDefinitions || toolDefinitions.size === 0) {
      console.warn('[CLI] No tools available to update');
      return;
    }
    
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
      'alert_list': 'alert_list [status]',
      'module_list': 'module_list [filter] [format]',
      'module_load': 'module_load <module>',
      'module_unload': 'module_unload <module>',
      'module_info': 'module_info <module>',
      'module_discover': 'module_discover [directories]',
      'module_tools': 'module_tools <module> [format]'
    };
    
    for (const [name, def] of toolDefinitions) {
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
        height: 600px;
        display: flex;
        flex-direction: column;
        background: #1a1a1a;
        color: #00ff00;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 13px;
        border-radius: 8px;
        overflow: hidden;
      }

      .cli-terminal-v2 .terminal-header {
        color: #888;
        padding: 20px 20px 10px 20px;
        border-bottom: 1px solid #333;
        flex-shrink: 0;
      }

      .cli-terminal-v2 #cli-v2-output {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        min-height: 0;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        cursor: text;
      }

      .cli-terminal-v2 .output-line {
        margin-bottom: 5px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        cursor: text;
      }
      
      .cli-terminal-v2 .output-line * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }

      .cli-terminal-v2 .input-container {
        position: relative;
        display: flex;
        align-items: center;
        padding: 10px 20px 20px 20px;
        border-top: 1px solid #333;
        flex-shrink: 0;
      }

      .cli-terminal-v2 .prompt {
        color: #00ffff;
        margin-right: 10px;
        user-select: none;
      }

      .cli-terminal-v2 .output-line {
        user-select: text;
        cursor: text;
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
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        cursor: text;
      }
      
      .cli-terminal-v2 .result pre {
        color: #d4d4d4;
        background: transparent;
        line-height: 1.5;
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        cursor: text;
        margin: 0;
        font-family: inherit;
      }

      /* Scrollbar styling */
      .cli-terminal-v2 #cli-v2-output::-webkit-scrollbar {
        width: 8px;
      }

      .cli-terminal-v2 #cli-v2-output::-webkit-scrollbar-track {
        background: #1a1a1a;
      }

      .cli-terminal-v2 #cli-v2-output::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }

      .cli-terminal-v2 #cli-v2-output::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    this.container.innerHTML = `
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
          </div>
        </div>
      </div>
    `;
  }

  initializeElements() {
    this.output = document.getElementById('cli-v2-output');
    this.input = document.getElementById('cli-v2-input');
    this.suggestion = document.getElementById('cli-v2-suggestion');
  }

  bindEvents() {
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('focus', () => this.updateSuggestions());
    
    // Keep focus on input when clicking in terminal, but allow text selection
    const terminal = this.output.parentElement;
    terminal.addEventListener('click', (e) => {
      // Don't focus input if user is selecting text
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }
      
      // Don't focus if clicking on output area (allow selection)
      if (this.output.contains(e.target)) {
        return;
      }
      
      // Only focus input for other clicks
      if (e.target !== this.input) {
        this.focusInput();
      }
    });
  }

  focusInput() {
    setTimeout(() => this.input.focus(), 0);
  }

  handleInput(e) {
    console.log('[Input] handleInput:', {
      value: this.input.value,
      inputType: e.inputType,
      data: e.data,
      isComposing: e.isComposing
    });
    
    // Only reset tab completion when user is actually typing
    // inputType will be undefined for programmatic changes
    if (e.inputType) {
      this.tabCompletions = [];
      this.tabIndex = -1;
      this.tabPrefix = '';
    }
    
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
        this.navigateHistory(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.navigateHistory(1);
        break;
      case 'Escape':
        // Clear input
        this.input.value = '';
        this.updateSuggestions();
        break;
    }
  }

  updateSuggestions() {
    const value = this.input.value.trim();
    const parts = value.split(' ');
    const command = parts[0];
    
    this.suggestion.textContent = '';

    // If we have a recognized command, show its argument structure
    if (this.commands[command]) {
      this.showCommandStructure(value, command);
    } else if (value && !value.includes(' ')) {
      // Show single best match for partial command
      this.showBestCommandMatch(value);
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

  showBestCommandMatch(partial) {
    const matches = Object.keys(this.commands).filter(cmd => 
      cmd.startsWith(partial) && cmd !== partial
    );

    if (matches.length > 0) {
      // Show the first match as ghost text
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
    }
  }


  acceptSuggestion() {
    const value = this.input.value.trim();
    const parts = value.split(' ');
    
    console.log('[Tab] acceptSuggestion called:', {
      value,
      parts,
      partsLength: parts.length,
      endsWithSpace: value.endsWith(' '),
      currentSuggestion: this.currentSuggestion,
      suggestionText: this.suggestion.textContent,
      tabState: {
        tabPrefix: this.tabPrefix,
        tabIndex: this.tabIndex,
        tabCompletions: this.tabCompletions
      }
    });
    
    // Check if we're completing a command or arguments
    if (parts.length === 1 && !value.endsWith(' ')) {
      // For command completion, check if we're already in a tab cycle
      if (this.tabCompletions.length > 0 && this.tabPrefix) {
        // Continue cycling with the original prefix
        console.log('[Tab] Continuing cycle with prefix:', this.tabPrefix);
        this.cycleCommandCompletions(this.tabPrefix);
      } else {
        // Start new cycle
        console.log('[Tab] Starting new cycle');
        this.cycleCommandCompletions(value);
      }
    } else if (this.currentSuggestion && this.suggestion.textContent) {
      // Accept next parameter from ghost text
      console.log('[Tab] Accepting parameter from ghost text');
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
      
      console.log('[Tab] Setting input value to:', suggestion.substring(0, nextWordEnd));
      this.input.value = suggestion.substring(0, nextWordEnd);
      this.updateSuggestions();
    } else {
      console.log('[Tab] No action taken - no completion available');
    }
  }
  
  cycleCommandCompletions(partial) {
    console.log('[Tab Cycle] Start:', {
      partial,
      tabPrefix: this.tabPrefix,
      tabIndex: this.tabIndex,
      tabCompletions: this.tabCompletions
    });
    
    // If this is a new partial (not continuing a cycle), reset
    if (partial !== this.tabPrefix) {
      this.tabPrefix = partial;
      this.tabCompletions = Object.keys(this.commands).filter(cmd => 
        cmd.startsWith(partial) && cmd !== partial
      );
      this.tabIndex = -1;
      
      // Store the original input
      this.originalTabInput = partial;  // Store the prefix, not the full value
      
      console.log('[Tab Cycle] Reset completions:', {
        tabCompletions: this.tabCompletions,
        originalInput: this.originalTabInput
      });
    }
    
    if (this.tabCompletions.length === 0) {
      console.log('[Tab Cycle] No completions found');
      return;
    }
    
    // If only one match, complete it
    if (this.tabCompletions.length === 1) {
      console.log('[Tab Cycle] Single match, completing:', this.tabCompletions[0]);
      this.input.value = this.tabCompletions[0] + ' ';
      this.updateSuggestions();
      // Reset tab state
      this.tabCompletions = [];
      this.tabIndex = -1;
      this.tabPrefix = '';
      return;
    }
    
    // Multiple matches - cycle through them
    this.tabIndex = (this.tabIndex + 1) % (this.tabCompletions.length + 1);
    
    console.log('[Tab Cycle] New index:', this.tabIndex, 'of', this.tabCompletions.length);
    
    if (this.tabIndex === this.tabCompletions.length) {
      // Restore original input and beep (visual feedback)
      console.log('[Tab Cycle] End of cycle, restoring:', this.originalTabInput);
      this.input.value = this.originalTabInput;
      // Flash the input to indicate end of cycle
      this.input.style.backgroundColor = '#333';
      setTimeout(() => {
        this.input.style.backgroundColor = 'transparent';
      }, 100);
    } else {
      // Show current completion
      const completion = this.tabCompletions[this.tabIndex];
      console.log('[Tab Cycle] Showing completion:', completion);
      this.input.value = completion;
    }
    
    // Update suggestions to show the ghost text for current completion
    this.updateSuggestions();
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

  addFormattedOutput(text, className = '') {
    const div = document.createElement('div');
    div.className = `output-line ${className}`;
    
    // For formatted output, preserve whitespace and newlines
    if (text.includes('\n')) {
      // Create pre element to preserve formatting
      const pre = document.createElement('pre');
      pre.style.margin = '0';
      pre.style.fontFamily = 'inherit';
      pre.style.whiteSpace = 'pre-wrap';
      pre.textContent = text;
      div.appendChild(pre);
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
      await this.executeTool('context_list', []);
      // Result will be displayed by executeTool with formatting
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
    if (!this.interface || !this.interface.executeTool) {
      throw new Error('No interface provided for tool execution');
    }

    // Parse arguments into proper format for the tool
    const params = this.parseToolArguments(toolName, args);
    
    this.addOutput(`Executing ${toolName}...`, 'info');
    
    try {
      const response = await this.interface.executeTool(toolName, params);
      
      // Format the response using the formatter
      const formatted = this.responseFormatter.format(toolName, response);
      
      if (formatted) {
        this.addFormattedOutput(formatted, 'result');
      }
      
      // Extract raw result for return value
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
      
      // Check if this was a successful module_load command
      if (toolName === 'module_load' && result && !result.error) {
        console.log('[CLI] module_load successful, refreshing tools...');
        try {
          await this.refreshTools();
          this.addOutput('✓ Tools refreshed after module loading', 'info');
        } catch (error) {
          console.error('[CLI] Failed to refresh tools after module_load:', error);
          this.addOutput('⚠ Warning: Failed to refresh tools list', 'error');
        }
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }
  
  // Refresh tools from the interface
  async refreshTools() {
    if (this.toolManager) {
      console.log('[CLI] Refreshing tools via ToolManager...');
      await this.toolManager.refresh();
      // updateToolCommands will be called automatically via event listener
    } else if (this.interface && this.interface.getTools) {
      console.log('[CLI] Refreshing tools via legacy interface...');
      this.updateToolCommands();
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
      'plan_execute': (args) => ({ planHandle: args[0] }),
      'module_list': (args) => {
        const params = {};
        if (args[0]) params.filter = args[0];
        if (args[1]) params.format = args[1];
        return params;
      },
      'module_load': (args) => ({ name: args[0] }),
      'module_unload': (args) => ({ name: args[0] }),
      'module_info': (args) => ({ name: args[0] }),
      'module_tools': (args) => {
        const params = { name: args[0] };
        if (args[1]) params.format = args[1];
        return params;
      },
      'module_discover': (args) => {
        const params = {};
        if (args.length > 0) params.directories = args;
        return params;
      }
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

}