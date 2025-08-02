/**
 * Terminal Component - Main CLI interface
 * Manages its own DOM and creates subcomponents for input and output
 */
import { OutputView } from './OutputView.js';
import { InputView } from './InputView.js';
import { ClientActorSpace } from '../../actors/ClientActorSpace.js';
import { TerminalActor } from '../../actors/TerminalActor.js';

export class Terminal {
  constructor(container) {
    this.container = container;
    
    // Component state - maintains 2-way mapping with DOM
    this.state = {
      outputs: [], // Array of {id, text, type, timestamp}
      currentInput: '',
      commandHistory: [],
      historyIndex: 0,
      connected: false
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
    
    // Actor system
    this.actorSpace = null;
    this.terminalActor = null;
    
    // Initialize
    this.createDOM();
    this.createSubcomponents();
    this.bindEvents();
    this.initializeActorSystem();
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
    // Terminal - full height flex column
    Object.assign(this.elements.terminal.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
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
    
    // Set available local commands for completion
    this.inputView.setAvailableCommands([
      '.help', '.clear', '.exit', '.about', '.history', '.time',
      '.connect', '.disconnect', '.status',
      'tools', 'module_list', 'module_load', 'module_unload'
    ]);
  }
  
  /**
   * Update tool definitions in input view for completion
   */
  updateToolDefinitions(tools) {
    if (this.inputView) {
      this.inputView.setToolDefinitions(tools);
    }
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
   * Initialize actor system and connect to server
   */
  async initializeActorSystem() {
    try {
      // Create actor space
      this.actorSpace = new ClientActorSpace();
      
      // Create terminal actor
      this.terminalActor = new TerminalActor(this);
      
      // Connect terminal actor to actor space
      this.terminalActor.connect(this.actorSpace);
      
      // Try to connect to server
      this.addOutput('Connecting to server...', 'info');
      await this.actorSpace.connect('ws://localhost:8080/ws');
      
      this.state.connected = true;
      
    } catch (error) {
      console.error('Failed to initialize actor system:', error);
      this.addOutput('Failed to connect to server. Running in local mode.', 'warning');
      this.addOutput('Some commands may not be available.', 'warning');
      this.state.connected = false;
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
        this.addOutput('Available commands:', 'info');
        this.addOutput('  .help       - Show this help', 'info');
        this.addOutput('  .clear      - Clear output', 'info');
        this.addOutput('  .history    - Show command history', 'info');
        this.addOutput('  .time       - Show current time', 'info');
        this.addOutput('  .connect    - Connect to server', 'info');
        this.addOutput('  .disconnect - Disconnect from server', 'info');
        this.addOutput('  .status     - Show connection status', 'info');
        if (this.state.connected) {
          this.addOutput('', 'info');
          this.addOutput('Tool usage (type tool name directly):', 'info');
          this.addOutput('  tools                     - List all available tools', 'info');
          this.addOutput('  module_list               - List all modules', 'info');
          this.addOutput('  module_load <name>        - Load a module', 'info');
          this.addOutput('', 'info');
          this.addOutput('Examples:', 'info');
          this.addOutput('  module_load file          - Load the file module', 'info');
          this.addOutput('  directory_list            - List current directory', 'info');
          this.addOutput('  file_read package.json    - Read a file', 'info');
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
        
      case '.connect':
        this.reconnectToServer();
        break;
        
      case '.disconnect':
        this.disconnectFromServer();
        break;
        
      case '.status':
        this.showConnectionStatus();
        break;
        
        default:
          // Unknown dot command
          this.addOutput(`Unknown command: ${cmdLower}`, 'error');
          this.addOutput('Type .help for available commands', 'info');
          break;
      }
    } else {
      // Not a dot command - send to server as potential tool
      if (this.state.connected && this.terminalActor) {
        this.terminalActor.sendCommand(command);
      } else {
        this.addOutput('Not connected to server. Use .connect to connect.', 'warning');
      }
    }
  }
  
  /**
   * Reconnect to server
   */
  async reconnectToServer() {
    if (this.state.connected) {
      this.addOutput('Already connected', 'info');
      return;
    }
    
    try {
      this.addOutput('Reconnecting to server...', 'info');
      await this.actorSpace.connect('ws://localhost:8080/ws');
      this.state.connected = true;
    } catch (error) {
      this.addOutput('Failed to reconnect', 'error');
      this.state.connected = false;
    }
  }
  
  /**
   * Disconnect from server
   */
  disconnectFromServer() {
    if (!this.state.connected) {
      this.addOutput('Not connected', 'info');
      return;
    }
    
    if (this.actorSpace) {
      this.actorSpace.disconnect();
    }
    this.state.connected = false;
    this.addOutput('Disconnected from server', 'info');
  }
  
  /**
   * Show connection status
   */
  showConnectionStatus() {
    if (this.state.connected) {
      this.addOutput('Connected to server', 'success');
      if (this.actorSpace) {
        this.addOutput(`Actor Space ID: ${this.actorSpace.spaceId}`, 'info');
      }
    } else {
      this.addOutput('Not connected to server', 'warning');
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
    if (this.actorSpace) {
      this.actorSpace.disconnect();
    }
    if (this.outputView) this.outputView.destroy();
    if (this.inputView) this.inputView.destroy();
    this.container.innerHTML = '';
  }
}