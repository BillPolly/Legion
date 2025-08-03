/**
 * Terminal Component - Main CLI interface
 * Manages its own DOM and creates subcomponents for input and output
 */
import { OutputView } from './OutputView.js';
import { InputView } from './InputView.js';

export class Terminal {
  constructor(container) {
    this.container = container;
    
    // Component state - maintains 2-way mapping with DOM
    this.state = {
      outputs: [], // Array of {id, text, type, timestamp}
      currentInput: '',
      commandHistory: [],
      historyIndex: 0,
      connected: false // Will be updated when TerminalActor connects
    };
    
    // DOM elements - created once, updated incrementally
    this.elements = {
      terminal: null,
      outputContainer: null,
      inputContainer: null
    };
    
    // Child components
    this.outputView = null;
    this.inputView = null;
    
    // Terminal is now purely local - no actor system
    
    // Initialize
    this.createDOM();
    this.createSubcomponents();
    this.bindEvents();
  }
  
  /**
   * Create DOM structure - called once
   */
  createDOM() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create terminal container
    this.elements.terminal = document.createElement('div');
    this.elements.terminal.className = 'terminal';
    
    // Create output container (TOP)
    this.elements.outputContainer = document.createElement('div');
    this.elements.outputContainer.className = 'terminal-output-container';
    
    // Create input container (BOTTOM)
    this.elements.inputContainer = document.createElement('div');
    this.elements.inputContainer.className = 'terminal-input-container';
    
    // Assemble structure - OUTPUT FIRST, INPUT SECOND
    this.elements.terminal.appendChild(this.elements.outputContainer);
    this.elements.terminal.appendChild(this.elements.inputContainer);
    
    // Apply styles to ensure correct layout
    this.applyStyles();
    
    // Add to container
    this.container.appendChild(this.elements.terminal);
  }
  
  /**
   * Apply styles to force correct layout
   */
  applyStyles() {
    // Terminal - full height flex column (100% instead of 100vh for window container)
    Object.assign(this.elements.terminal.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '14px'
    });
    
    // Output container - grows to fill space
    Object.assign(this.elements.outputContainer.style, {
      flex: '1 1 auto',
      overflowY: 'auto',
      padding: '10px',
      minHeight: '0'
    });
    
    // Input container - fixed at bottom
    Object.assign(this.elements.inputContainer.style, {
      flex: '0 0 auto',
      borderTop: '1px solid #444',
      backgroundColor: '#222'
    });
  }
  
  /**
   * Create subcomponents - each manages its own DOM
   */
  createSubcomponents() {
    // Create output view - manages all output display
    this.outputView = new OutputView(this.elements.outputContainer);
    this.outputView.setState(this.state.outputs);
    
    // Create input view - manages input field and prompt
    this.inputView = new InputView(this.elements.inputContainer);
    this.inputView.setState({
      value: this.state.currentInput,
      prompt: '> '
    });
    
    // Set available local commands for completion (only local dot commands)
    this.inputView.setAvailableCommands([
      '.help', '.clear', '.about', '.history', '.time'
    ]);
  }
  
  /**
   * Update tool definitions - no longer needed (terminal is local only)
   */
  updateToolDefinitions(tools) {
    // No-op - terminal is now local only
  }
  
  /**
   * Bind events from subcomponents
   */
  bindEvents() {
    // Listen to input events
    this.inputView.onInput = (value) => {
      this.updateCurrentInput(value);
    };
    
    this.inputView.onCommand = (command) => {
      this.executeCommand(command);
    };
    
    this.inputView.onHistoryRequest = (direction) => {
      this.navigateHistory(direction);
    };
  }
  
  /**
   * Update current input - maintains 2-way mapping
   */
  updateCurrentInput(value) {
    this.state.currentInput = value;
    // State is already reflected in InputView, no need to update DOM
  }
  
  /**
   * Execute a command
   */
  executeCommand(command) {
    if (!command.trim()) return;
    
    // Add to history
    this.state.commandHistory.push(command);
    this.state.historyIndex = this.state.commandHistory.length;
    
    // Add command to output
    this.addOutput(`> ${command}`, 'command');
    
    // Clear input
    this.state.currentInput = '';
    this.inputView.setState({ value: '', prompt: '> ' });
    
    // Process command
    this.processCommand(command);
  }
  
  /**
   * Initialize terminal
   */
  initialize() {
    this.addOutput('Terminal ready', 'success');
    this.addOutput('Type .help for available commands', 'info');
  }
  
  /**
   * Set the terminal actor for server communication
   */
  setTerminalActor(terminalActor) {
    this.terminalActor = terminalActor;
    if (terminalActor && terminalActor.isConnected()) {
      this.state.connected = true;
      this.addOutput('Connected to server', 'success');
    }
  }
  
  /**
   * Process different commands
   */
  processCommand(command) {
    const cmd = command.trim();
    const cmdLower = cmd.toLowerCase();
    
    // Local terminal commands (start with dot)
    if (cmdLower.startsWith('.')) {
      switch (cmdLower) {
        case '.help':
        this.addOutput('Terminal Commands:', 'info');
        this.addOutput('  .help       - Show this help', 'info');
        this.addOutput('  .clear      - Clear output', 'info');
        this.addOutput('  .history    - Show command history', 'info');
        this.addOutput('  .time       - Show current time', 'info');
        this.addOutput('  .about      - About this terminal', 'info');
        if (this.state.connected) {
          this.addOutput('', 'info');
          this.addOutput('Server Commands (when connected):', 'info');
          this.addOutput('  tools         - List available tools', 'info');
          this.addOutput('  module_list   - List modules', 'info');
          this.addOutput('  module_load   - Load a module', 'info');
        } else {
          this.addOutput('', 'info');
          this.addOutput('Not connected to server', 'warning');
        }
        break;
        
      case '.clear':
        this.clearOutput();
        break;
        
      case '.history':
        this.showHistory();
        break;
        
      case '.time':
        this.addOutput(new Date().toLocaleString(), 'success');
        break;
        
      case '.about':
        this.addOutput('Aiur Local Terminal v1.0', 'info');
        this.addOutput('Local command processor with basic utilities', 'info');
        this.addOutput('Part of the Legion framework', 'info');
        break;
        
        default:
          // Unknown dot command
          this.addOutput(`Unknown command: ${cmdLower}`, 'error');
          this.addOutput('Type .help for available commands', 'info');
          break;
      }
    } else {
      // Not a dot command - try to send to server if connected
      if (this.state.connected && this.terminalActor) {
        this.terminalActor.sendCommand(command);
      } else {
        this.addOutput(`Unknown command: ${command}`, 'error');
        this.addOutput('Not connected to server.', 'warning');
        this.addOutput('Type .help for available commands.', 'info');
      }
    }
  }
  
  
  /**
   * Add output line - updates state and view
   */
  addOutput(text, type = 'info') {
    const output = {
      id: `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      type,
      timestamp: Date.now()
    };
    
    // Update state
    this.state.outputs.push(output);
    
    // Update view - maintains 2-way mapping
    this.outputView.setState(this.state.outputs);
  }
  
  /**
   * Clear output - public method for TerminalActor
   */
  clear() {
    this.clearOutput();
  }
  
  /**
   * Clear output
   */
  clearOutput() {
    this.state.outputs = [];
    this.outputView.setState(this.state.outputs);
  }
  
  /**
   * Show command history
   */
  showHistory() {
    if (this.state.commandHistory.length === 0) {
      this.addOutput('No command history', 'info');
    } else {
      this.addOutput('Command history:', 'info');
      this.state.commandHistory.forEach((cmd, i) => {
        this.addOutput(`  ${i + 1}: ${cmd}`, 'info');
      });
    }
  }
  
  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    if (this.state.commandHistory.length === 0) return;
    
    this.state.historyIndex += direction;
    
    if (this.state.historyIndex < 0) {
      this.state.historyIndex = 0;
    } else if (this.state.historyIndex >= this.state.commandHistory.length) {
      this.state.historyIndex = this.state.commandHistory.length;
      this.state.currentInput = '';
    } else {
      this.state.currentInput = this.state.commandHistory[this.state.historyIndex];
    }
    
    // Update input view to reflect state
    this.inputView.setState({
      value: this.state.currentInput,
      prompt: '> '
    });
  }
  
  /**
   * Focus the input
   */
  focus() {
    this.inputView.focus();
  }
  
  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Destroy component
   */
  destroy() {
    if (this.outputView) this.outputView.destroy();
    if (this.inputView) this.inputView.destroy();
    this.container.innerHTML = '';
  }
}