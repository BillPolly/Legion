/**
 * CommandHistory - Manages command history for undo/redo operations
 * 
 * Maintains a list of executed commands and tracks the current position
 * in the history. Supports undo/redo navigation and command merging.
 */

export class CommandHistory {
  /**
   * Create a new command history
   * @param {Object} config - Configuration options
   * @param {number} [config.maxSize=100] - Maximum number of commands to keep
   * @param {boolean} [config.mergeEnabled=true] - Whether to merge compatible commands
   */
  constructor(config = {}) {
    this.maxSize = config.maxSize || 100;
    this.mergeEnabled = config.mergeEnabled !== false;
    
    // History array and current position
    this.commands = [];
    this.currentIndex = -1;
    
    // Listeners for history changes
    this.listeners = {
      change: [],
      execute: [],
      undo: [],
      redo: []
    };
  }

  /**
   * Execute a command and add it to history
   * @param {Command} command - The command to execute
   * @param {GraphEditorModel} model - The model to execute on
   * @returns {boolean} True if successful
   */
  execute(command, model) {
    try {
      // Validate command before execution
      if (!command.validate(model)) {
        throw new Error(`Command ${command.getType()} validation failed`);
      }

      // Check if we can merge with the last command
      if (this.mergeEnabled && this.currentIndex >= 0) {
        const lastCommand = this.commands[this.currentIndex];
        if (lastCommand.canMergeWith(command)) {
          // Merge commands
          const mergedCommand = lastCommand.mergeWith(command);
          
          // Replace last command with merged version
          this.commands[this.currentIndex] = mergedCommand;
          
          // Execute the merged command
          mergedCommand.execute(model);
          
          this._notifyListeners('execute', mergedCommand);
          this._notifyListeners('change');
          return true;
        }
      }

      // Remove any commands after current position
      if (this.currentIndex < this.commands.length - 1) {
        this.commands = this.commands.slice(0, this.currentIndex + 1);
      }

      // Execute the command
      command.execute(model);

      // Add to history
      this.commands.push(command);
      this.currentIndex++;

      // Enforce max size limit
      if (this.commands.length > this.maxSize) {
        const overflow = this.commands.length - this.maxSize;
        this.commands = this.commands.slice(overflow);
        this.currentIndex -= overflow;
      }

      this._notifyListeners('execute', command);
      this._notifyListeners('change');
      return true;

    } catch (error) {
      console.error('Failed to execute command:', error);
      return false;
    }
  }

  /**
   * Undo the last command
   * @param {GraphEditorModel} model - The model to undo on
   * @returns {boolean} True if successful
   */
  undo(model) {
    if (!this.canUndo()) {
      return false;
    }

    try {
      const command = this.commands[this.currentIndex];
      command.undo(model);
      this.currentIndex--;

      this._notifyListeners('undo', command);
      this._notifyListeners('change');
      return true;

    } catch (error) {
      console.error('Failed to undo command:', error);
      return false;
    }
  }

  /**
   * Redo the next command
   * @param {GraphEditorModel} model - The model to redo on
   * @returns {boolean} True if successful
   */
  redo(model) {
    if (!this.canRedo()) {
      return false;
    }

    try {
      this.currentIndex++;
      const command = this.commands[this.currentIndex];
      command.execute(model);

      this._notifyListeners('redo', command);
      this._notifyListeners('change');
      return true;

    } catch (error) {
      console.error('Failed to redo command:', error);
      this.currentIndex--; // Restore index on failure
      return false;
    }
  }

  /**
   * Check if undo is available
   * @returns {boolean} True if can undo
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean} True if can redo
   */
  canRedo() {
    return this.currentIndex < this.commands.length - 1;
  }

  /**
   * Get the command that would be undone
   * @returns {Command|null} The command or null
   */
  getUndoCommand() {
    if (!this.canUndo()) {
      return null;
    }
    return this.commands[this.currentIndex];
  }

  /**
   * Get the command that would be redone
   * @returns {Command|null} The command or null
   */
  getRedoCommand() {
    if (!this.canRedo()) {
      return null;
    }
    return this.commands[this.currentIndex + 1];
  }

  /**
   * Clear all history
   */
  clear() {
    this.commands = [];
    this.currentIndex = -1;
    this._notifyListeners('change');
  }

  /**
   * Get the size of the history
   * @returns {number} Number of commands in history
   */
  getSize() {
    return this.commands.length;
  }

  /**
   * Get the current position in history
   * @returns {number} Current index (-1 if empty)
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get all commands in history
   * @returns {Command[]} Copy of command array
   */
  getCommands() {
    return [...this.commands];
  }

  /**
   * Get commands that can be undone
   * @returns {Command[]} Commands from start to current index
   */
  getUndoStack() {
    if (this.currentIndex < 0) {
      return [];
    }
    return this.commands.slice(0, this.currentIndex + 1);
  }

  /**
   * Get commands that can be redone
   * @returns {Command[]} Commands after current index
   */
  getRedoStack() {
    if (this.currentIndex >= this.commands.length - 1) {
      return [];
    }
    return this.commands.slice(this.currentIndex + 1);
  }

  /**
   * Add a listener for history events
   * @param {string} event - Event type: 'change', 'execute', 'undo', 'redo'
   * @param {Function} listener - Listener function
   */
  on(event, listener) {
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
    }
  }

  /**
   * Remove a listener
   * @param {string} event - Event type
   * @param {Function} listener - Listener to remove
   */
  off(event, listener) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners of an event
   * @private
   */
  _notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(data, this);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get a summary of the history state
   * @returns {Object} History state summary
   */
  getState() {
    return {
      size: this.commands.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCommand: this.getUndoCommand()?.getDescription(),
      redoCommand: this.getRedoCommand()?.getDescription()
    };
  }

  /**
   * Serialize history to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      commands: this.commands.map(cmd => cmd.toJSON()),
      currentIndex: this.currentIndex,
      maxSize: this.maxSize,
      mergeEnabled: this.mergeEnabled
    };
  }

  /**
   * Create CommandHistory from JSON
   * @param {Object} json - JSON representation
   * @param {Function} commandFactory - Factory to create commands from JSON
   * @returns {CommandHistory} Restored history
   */
  static fromJSON(json, commandFactory) {
    const history = new CommandHistory({
      maxSize: json.maxSize,
      mergeEnabled: json.mergeEnabled
    });

    // Restore commands
    history.commands = json.commands.map(cmdJson => commandFactory(cmdJson));
    history.currentIndex = json.currentIndex;

    return history;
  }
}