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
        command: '',
        args: [],
        raw: ''
      };
    }
    
    // Simple parser that handles quoted arguments
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
    const text = event.target.textContent || '';
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
    }
  }

  /**
   * Navigate command history
   * @param {string} direction - 'up' or 'down'
   */
  navigateHistory(direction) {
    const command = this.model.navigateHistory(direction);
    this.model.setCurrentCommand(command);
  }

  /**
   * Apply selected autocomplete suggestion
   */
  applyAutocomplete() {
    const suggestion = this.model.getSelectedSuggestion();
    if (suggestion) {
      this.model.setCurrentCommand(suggestion);
      this.model.clearAutocomplete();
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
      const result = await super.executeCommand(command);
      return result;
    } finally {
      this.model.setExecuting(false);
    }
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