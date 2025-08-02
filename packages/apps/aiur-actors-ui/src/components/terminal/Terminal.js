/**
 * Simple Terminal Component
 * A clean, single-file terminal implementation
 */

export class Terminal {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.prompt = options.prompt || '> ';
    
    // DOM elements - created once, never recreated
    this.elements = {
      terminal: null,
      output: null,
      inputLine: null,
      promptSpan: null,
      input: null
    };
    
    // State
    this.commandHistory = [];
    this.historyIndex = 0;
    this.maxOutputLines = options.maxOutputLines || 1000;
    
    // Callbacks
    this.onCommand = options.onCommand || null;
    
    // Initialize
    this.render();
    this.bindEvents();
  }
  
  /**
   * Create DOM structure - ONLY CALLED ONCE
   */
  render() {
    // Use the container's document
    const doc = this.container.ownerDocument || document;
    
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    // Create terminal container
    this.elements.terminal = doc.createElement('div');
    this.elements.terminal.className = 'simple-terminal';
    
    // Create output area (TOP)
    this.elements.output = doc.createElement('div');
    this.elements.output.className = 'simple-terminal-output';
    
    // Create input line (BOTTOM)
    this.elements.inputLine = doc.createElement('div');
    this.elements.inputLine.className = 'simple-terminal-input-line';
    
    // Create prompt
    this.elements.promptSpan = doc.createElement('span');
    this.elements.promptSpan.className = 'simple-terminal-prompt';
    this.elements.promptSpan.textContent = this.prompt;
    
    // Create input field
    this.elements.input = doc.createElement('input');
    this.elements.input.type = 'text';
    this.elements.input.className = 'simple-terminal-input';
    this.elements.input.setAttribute('autocomplete', 'off');
    this.elements.input.setAttribute('spellcheck', 'false');
    
    // Assemble input line
    this.elements.inputLine.appendChild(this.elements.promptSpan);
    this.elements.inputLine.appendChild(this.elements.input);
    
    // Assemble terminal - OUTPUT FIRST, INPUT SECOND
    this.elements.terminal.appendChild(this.elements.output);
    this.elements.terminal.appendChild(this.elements.inputLine);
    
    // Add to container
    this.container.appendChild(this.elements.terminal);
    
    // Apply inline styles to FORCE correct layout
    this.applyStyles();
    
    // Focus input
    this.elements.input.focus();
  }
  
  /**
   * Apply inline styles to ensure correct layout
   */
  applyStyles() {
    // Terminal container - full height flex column
    Object.assign(this.elements.terminal.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '14px'
    });
    
    // Output area - grows to fill space, scrollable
    Object.assign(this.elements.output.style, {
      flex: '1 1 auto',
      overflowY: 'auto',
      padding: '10px',
      minHeight: '0'
    });
    
    // Input line - fixed at bottom
    Object.assign(this.elements.inputLine.style, {
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      padding: '10px',
      borderTop: '1px solid #444',
      backgroundColor: '#222'
    });
    
    // Prompt
    Object.assign(this.elements.promptSpan.style, {
      marginRight: '5px',
      color: '#4a9eff'
    });
    
    // Input field
    Object.assign(this.elements.input.style, {
      flex: '1',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: '#e0e0e0',
      fontFamily: 'inherit',
      fontSize: 'inherit'
    });
  }
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Handle Enter key
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });
  }
  
  /**
   * Handle command execution
   */
  handleCommand() {
    const command = this.elements.input.value.trim();
    if (!command) return;
    
    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
    
    // Display command in output
    this.addOutput(this.prompt + command, 'command');
    
    // Clear input
    this.elements.input.value = '';
    
    // Process built-in commands
    if (command.startsWith('.')) {
      this.handleBuiltinCommand(command);
    } else if (this.onCommand) {
      // Pass to external handler
      this.onCommand(command);
    }
  }
  
  /**
   * Handle built-in commands
   */
  handleBuiltinCommand(command) {
    switch (command) {
      case '.help':
        this.showHelp();
        break;
      case '.clear':
        this.clearOutput();
        break;
      case '.history':
        this.showHistory();
        break;
      default:
        this.addOutput(`Unknown command: ${command}`, 'error');
        this.addOutput('Type .help for available commands', 'info');
    }
  }
  
  /**
   * Show help
   */
  showHelp() {
    this.addOutput('Available commands:', 'info');
    this.addOutput('  .help     - Show this help', 'info');
    this.addOutput('  .clear    - Clear terminal output', 'info');
    this.addOutput('  .history  - Show command history', 'info');
  }
  
  /**
   * Show command history
   */
  showHistory() {
    if (this.commandHistory.length === 0) {
      this.addOutput('No command history', 'info');
    } else {
      this.addOutput('Command history:', 'info');
      this.commandHistory.forEach((cmd, i) => {
        this.addOutput(`  ${i + 1}: ${cmd}`, 'info');
      });
    }
  }
  
  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return;
    
    this.historyIndex += direction;
    
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      this.elements.input.value = '';
      return;
    }
    
    this.elements.input.value = this.commandHistory[this.historyIndex];
  }
  
  /**
   * Add output line - NO DUPLICATES
   */
  addOutput(text, type = 'info') {
    const doc = this.container.ownerDocument || document;
    
    // Create line element
    const line = doc.createElement('div');
    line.className = `simple-terminal-line simple-terminal-${type}`;
    line.textContent = text;
    
    // Style based on type
    const colors = {
      command: '#4a9eff',
      info: '#e0e0e0',
      error: '#ff6b6b',
      success: '#51cf66',
      warning: '#ffd93d'
    };
    
    line.style.color = colors[type] || colors.info;
    line.style.padding = '2px 0';
    
    // Add to output
    this.elements.output.appendChild(line);
    
    // Limit output lines
    while (this.elements.output.children.length > this.maxOutputLines) {
      this.elements.output.removeChild(this.elements.output.firstChild);
    }
    
    // Scroll to bottom
    this.elements.output.scrollTop = this.elements.output.scrollHeight;
  }
  
  /**
   * Clear output
   */
  clearOutput() {
    while (this.elements.output.firstChild) {
      this.elements.output.removeChild(this.elements.output.firstChild);
    }
  }
  
  /**
   * Focus input
   */
  focus() {
    this.elements.input.focus();
  }
  
  /**
   * Destroy terminal
   */
  destroy() {
    // Remove event listeners
    this.elements.input.removeEventListener('keydown', this.handleCommand);
    
    // Clear DOM
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    // Clear references
    this.elements = {};
  }
}

/**
 * Factory function for creating terminal
 */
export function createTerminal(umbilical) {
  if (!umbilical.dom) {
    throw new Error('Terminal requires a DOM element');
  }
  
  const terminal = new Terminal(umbilical.dom, {
    prompt: umbilical.prompt || '> ',
    maxOutputLines: umbilical.config?.maxOutputLines || 1000,
    onCommand: (command) => {
      // Pass command to actor system if available
      if (umbilical.actorSpace) {
        const commandActor = umbilical.actorSpace.getActor('command-actor');
        if (commandActor) {
          commandActor.receive({
            type: 'execute',
            command,
            requestId: `req-${Date.now()}`
          });
        }
      }
      
      // Also call external handler if provided
      if (umbilical.onCommand) {
        umbilical.onCommand(command);
      }
    }
  });
  
  // Return terminal API
  return {
    addOutput: (text, type) => terminal.addOutput(text, type),
    clearOutput: () => terminal.clearOutput(),
    focus: () => terminal.focus(),
    destroy: () => terminal.destroy(),
    
    // For compatibility
    model: { addOutput: (text, type) => terminal.addOutput(text, type) },
    view: terminal,
    viewModel: { appendOutput: (text, type) => terminal.addOutput(text, type) }
  };
}