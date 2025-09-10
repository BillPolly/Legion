/**
 * Command Base Class
 * 
 * Abstract base class for implementing the Command pattern
 * All diagram operations should extend this class
 */

export class Command {
  constructor() {
    if (new.target === Command) {
      throw new Error('Command is an abstract class and cannot be instantiated directly');
    }
    
    this.timestamp = Date.now();
    this.id = this.generateId();
  }

  /**
   * Execute the command
   * @param {Object} context - The context to execute the command on
   * @returns {Object} Result of execution with success flag
   * @abstract
   */
  execute(context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Undo the command
   * @param {Object} context - The context to undo the command on
   * @returns {Object} Result of undo with success flag
   * @abstract
   */
  undo(context) {
    throw new Error('undo() must be implemented by subclass');
  }

  /**
   * Get human-readable description of the command
   * @returns {string} Description of what this command does
   */
  getDescription() {
    return 'Unknown command';
  }

  /**
   * Check if this command can be merged with another
   * @param {Command} other - Another command to potentially merge with
   * @returns {boolean} True if commands can be merged
   */
  canMergeWith(other) {
    return false;
  }

  /**
   * Merge this command with another
   * @param {Command} other - Another command to merge with
   * @returns {Command} Merged command or null if cannot merge
   */
  mergeWith(other) {
    return null;
  }

  /**
   * Generate unique ID for command
   * @private
   * @returns {string} Unique identifier
   */
  generateId() {
    return `cmd_${this.timestamp}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get command ID
   * @returns {string} Command identifier
   */
  getId() {
    return this.id;
  }

  /**
   * Get command timestamp
   * @returns {number} Unix timestamp of command creation
   */
  getTimestamp() {
    return this.timestamp;
  }
}