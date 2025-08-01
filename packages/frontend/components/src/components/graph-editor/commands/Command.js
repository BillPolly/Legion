/**
 * Command - Base class for graph editor commands implementing the Command pattern
 * 
 * Commands encapsulate graph operations and support undo/redo functionality.
 * Each command must implement execute() and undo() methods.
 */

export class Command {
  /**
   * Create a new command
   * @param {string} type - Command type identifier
   * @param {Object} data - Command-specific data
   */
  constructor(type, data = {}) {
    this.type = type;
    this.data = { ...data };
    this.timestamp = Date.now();
    this.executed = false;
    this._undoData = null;
  }

  /**
   * Get command type
   */
  getType() {
    return this.type;
  }

  /**
   * Get command data
   */
  getData() {
    return { ...this.data };
  }

  /**
   * Get timestamp when command was created
   */
  getTimestamp() {
    return this.timestamp;
  }

  /**
   * Check if command has been executed
   */
  isExecuted() {
    return this.executed;
  }

  /**
   * Execute the command
   * @param {GraphEditorModel} model - The graph model to operate on
   * @throws {Error} If command execution fails
   */
  execute(model) {
    if (this.executed) {
      throw new Error(`Command ${this.type} has already been executed`);
    }

    try {
      this._undoData = this._doExecute(model);
      this.executed = true;
    } catch (error) {
      throw new Error(`Failed to execute command ${this.type}: ${error.message}`);
    }
  }

  /**
   * Undo the command
   * @param {GraphEditorModel} model - The graph model to operate on
   * @throws {Error} If command undo fails
   */
  undo(model) {
    if (!this.executed) {
      throw new Error(`Command ${this.type} has not been executed yet`);
    }

    try {
      this._doUndo(model, this._undoData);
      this.executed = false;
      this._undoData = null;
    } catch (error) {
      throw new Error(`Failed to undo command ${this.type}: ${error.message}`);
    }
  }

  /**
   * Check if command can be merged with another command
   * @param {Command} otherCommand - The command to potentially merge with
   * @returns {boolean} True if commands can be merged
   */
  canMergeWith(otherCommand) {
    return false; // Default: no merging
  }

  /**
   * Merge this command with another command
   * @param {Command} otherCommand - The command to merge with
   * @returns {Command} The merged command
   * @throws {Error} If commands cannot be merged
   */
  mergeWith(otherCommand) {
    throw new Error(`Command ${this.type} does not support merging`);
  }

  /**
   * Get a description of this command for UI display
   * @returns {string} Human-readable description
   */
  getDescription() {
    return `${this.type} command`;
  }

  /**
   * Perform the actual command execution
   * Subclasses must implement this method
   * @param {GraphEditorModel} model - The graph model to operate on
   * @returns {*} Undo data needed to reverse this command
   * @protected
   */
  _doExecute(model) {
    throw new Error(`Command ${this.type} must implement _doExecute method`);
  }

  /**
   * Perform the actual command undo
   * Subclasses must implement this method
   * @param {GraphEditorModel} model - The graph model to operate on
   * @param {*} undoData - Data needed to reverse the command
   * @protected
   */
  _doUndo(model, undoData) {
    throw new Error(`Command ${this.type} must implement _doUndo method`);
  }

  /**
   * Validate command data before execution
   * @param {GraphEditorModel} model - The graph model to validate against
   * @returns {boolean} True if command is valid
   */
  validate(model) {
    return true; // Default: assume valid
  }

  /**
   * Create a deep copy of this command
   * @returns {Command} A copy of this command
   */
  clone() {
    const cloned = new this.constructor(this.type, this.data);
    cloned.timestamp = this.timestamp;
    return cloned;
  }

  /**
   * Serialize command to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      executed: this.executed
    };
  }

  /**
   * Create command from JSON
   * @param {Object} json - JSON representation
   * @returns {Command} Reconstructed command
   */
  static fromJSON(json) {
    const command = new Command(json.type, json.data);
    command.timestamp = json.timestamp;
    command.executed = json.executed;
    return command;
  }
}