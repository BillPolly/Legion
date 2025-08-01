/**
 * TerminalModel - Model for terminal component
 */
import { ExtendedBaseModel } from '../base/ExtendedBaseModel.js';

export class TerminalModel extends ExtendedBaseModel {
  constructor() {
    super();
    
    // Command history (inherited from ExtendedBaseModel)
    // Already has: commandHistory, maxHistorySize, historyIndex
    
    // Output buffer (inherited from ExtendedBaseModel)
    // Already has: outputBuffer, maxOutputLines
    this.maxOutputLines = 10000;
    
    // Autocomplete state
    this.autocompleteActive = false;
    this.autocompleteSuggestions = [];
    this.autocompleteIndex = -1;
    
    // Current command state
    this.currentCommand = '';
    this.cursorPosition = 0;
    
    // Execution state
    this.isExecuting = false;
  }

  /**
   * Add command to history with deduplication
   * @param {string} command - Command to add
   */
  addCommand(command) {
    // Trim whitespace
    command = command.trim();
    
    // Don't add empty commands
    if (!command) {
      return;
    }
    
    // Don't add duplicate consecutive commands
    const lastCommand = this.commandHistory[this.commandHistory.length - 1];
    if (lastCommand && lastCommand.command === command) {
      return;
    }
    
    // Use parent method which handles max size and notifications
    this.addToHistory(command);
  }

  /**
   * Navigate command history
   * @param {string} direction - 'up' or 'down'
   * @returns {string} Command from history
   */
  navigateHistory(direction) {
    if (direction === 'up') {
      return super.navigateHistory(-1);
    } else if (direction === 'down') {
      return super.navigateHistory(1);
    }
    return this.currentCommand;
  }

  /**
   * Add output with multi-line support
   * @param {string} content - Content to add
   * @param {string} type - Output type
   */
  addOutput(content, type = 'info') {
    // Handle multi-line content
    const lines = content.split('\n');
    
    lines.forEach(line => {
      super.addOutput(line, type);
      
      // Enforce circular buffer
      if (this.outputBuffer.length > this.maxOutputLines) {
        this.outputBuffer.shift();
      }
    });
  }

  /**
   * Set autocomplete suggestions
   * @param {Array} suggestions - Array of suggestions
   */
  setAutocompleteSuggestions(suggestions) {
    this.autocompleteSuggestions = suggestions;
    this.autocompleteActive = suggestions.length > 0;
    this.autocompleteIndex = suggestions.length > 0 ? 0 : -1;
    
    this.notify('autocompleteChanged', {
      active: this.autocompleteActive,
      suggestions: this.autocompleteSuggestions,
      index: this.autocompleteIndex
    });
  }

  /**
   * Navigate autocomplete suggestions
   * @param {string} direction - 'up' or 'down'
   */
  navigateAutocomplete(direction) {
    if (!this.autocompleteActive || this.autocompleteSuggestions.length === 0) {
      return;
    }
    
    const count = this.autocompleteSuggestions.length;
    
    if (direction === 'down') {
      this.autocompleteIndex = (this.autocompleteIndex + 1) % count;
    } else if (direction === 'up') {
      this.autocompleteIndex = (this.autocompleteIndex - 1 + count) % count;
    }
    
    this.notify('autocompleteIndexChanged', { index: this.autocompleteIndex });
  }

  /**
   * Get currently selected suggestion
   * @returns {string|null} Selected suggestion
   */
  getSelectedSuggestion() {
    if (!this.autocompleteActive || this.autocompleteIndex < 0) {
      return null;
    }
    return this.autocompleteSuggestions[this.autocompleteIndex];
  }

  /**
   * Clear autocomplete state
   */
  clearAutocomplete() {
    this.autocompleteActive = false;
    this.autocompleteSuggestions = [];
    this.autocompleteIndex = -1;
    
    this.notify('autocompleteCleared', {});
  }

  /**
   * Set current command
   * @param {string} command - Command text
   */
  setCurrentCommand(command) {
    this.currentCommand = command;
    this.cursorPosition = command.length;
    
    this.notify('currentCommandChanged', {
      command: this.currentCommand,
      cursor: this.cursorPosition
    });
  }

  /**
   * Move cursor
   * @param {string} direction - 'left', 'right', 'home', 'end'
   */
  moveCursor(direction) {
    switch (direction) {
      case 'left':
        this.cursorPosition = Math.max(0, this.cursorPosition - 1);
        break;
      case 'right':
        this.cursorPosition = Math.min(this.currentCommand.length, this.cursorPosition + 1);
        break;
      case 'home':
        this.cursorPosition = 0;
        break;
      case 'end':
        this.cursorPosition = this.currentCommand.length;
        break;
    }
    
    this.notify('cursorMoved', { cursor: this.cursorPosition });
  }

  /**
   * Insert text at cursor position
   * @param {string} text - Text to insert
   */
  insertAtCursor(text) {
    const before = this.currentCommand.slice(0, this.cursorPosition);
    const after = this.currentCommand.slice(this.cursorPosition);
    
    this.currentCommand = before + text + after;
    this.cursorPosition += text.length;
    
    this.notify('currentCommandChanged', {
      command: this.currentCommand,
      cursor: this.cursorPosition
    });
  }

  /**
   * Delete at cursor position
   * @param {string} type - 'backspace' or 'delete'
   */
  deleteAtCursor(type) {
    if (type === 'backspace' && this.cursorPosition > 0) {
      const before = this.currentCommand.slice(0, this.cursorPosition - 1);
      const after = this.currentCommand.slice(this.cursorPosition);
      
      this.currentCommand = before + after;
      this.cursorPosition--;
    } else if (type === 'delete' && this.cursorPosition < this.currentCommand.length) {
      const before = this.currentCommand.slice(0, this.cursorPosition);
      const after = this.currentCommand.slice(this.cursorPosition + 1);
      
      this.currentCommand = before + after;
    }
    
    this.notify('currentCommandChanged', {
      command: this.currentCommand,
      cursor: this.cursorPosition
    });
  }

  /**
   * Set execution state
   * @param {boolean} executing - Whether executing
   */
  setExecuting(executing) {
    this.isExecuting = executing;
    this.notify('executingChanged', { executing });
  }

  /**
   * Export model state
   * @returns {Object} Exported state
   */
  exportState() {
    const baseState = super.exportState();
    
    return {
      ...baseState,
      autocompleteActive: this.autocompleteActive,
      autocompleteSuggestions: this.autocompleteSuggestions,
      autocompleteIndex: this.autocompleteIndex,
      currentCommand: this.currentCommand,
      cursorPosition: this.cursorPosition,
      isExecuting: this.isExecuting,
      maxOutputLines: this.maxOutputLines
    };
  }

  /**
   * Import model state
   * @param {Object} state - State to import
   */
  importState(state) {
    super.importState(state);
    
    if ('autocompleteActive' in state) {
      this.autocompleteActive = state.autocompleteActive;
    }
    if ('autocompleteSuggestions' in state) {
      this.autocompleteSuggestions = state.autocompleteSuggestions;
    }
    if ('autocompleteIndex' in state) {
      this.autocompleteIndex = state.autocompleteIndex;
    }
    if ('currentCommand' in state) {
      this.currentCommand = state.currentCommand;
    }
    if ('cursorPosition' in state) {
      this.cursorPosition = state.cursorPosition;
    }
    if ('isExecuting' in state) {
      this.isExecuting = state.isExecuting;
    }
    if ('maxOutputLines' in state) {
      this.maxOutputLines = state.maxOutputLines;
    }
  }
}