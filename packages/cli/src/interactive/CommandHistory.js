/**
 * CommandHistory - Manages command history for interactive mode
 */

export class CommandHistory {
  constructor(maxSize = 100) {
    this.history = [];
    this.maxSize = maxSize;
  }

  /**
   * Add command to history
   * @param {string} command - Command to add
   */
  add(command) {
    if (!command || !command.trim()) {
      return;
    }
    
    this.history.push(command);
    
    // Keep only the last maxSize commands
    while (this.history.length > this.maxSize) {
      this.history.shift(); // Remove oldest
    }
  }

  /**
   * Get all history
   * @returns {string[]} Command history
   */
  getAll() {
    return [...this.history];
  }

  /**
   * Get recent commands
   * @param {number} count - Number of recent commands to get
   * @returns {string[]} Recent commands
   */
  getRecent(count = 10) {
    return this.history.slice(-count);
  }

  /**
   * Clear history
   */
  clear() {
    this.history = [];
  }

  /**
   * Get history size
   * @returns {number} Number of commands in history
   */
  size() {
    return this.history.length;
  }

  /**
   * Search history
   * @param {string} query - Search query
   * @returns {string[]} Matching commands
   */
  search(query) {
    if (!query) {
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    return this.history.filter(cmd => 
      cmd.toLowerCase().includes(lowerQuery)
    );
  }
}

export default CommandHistory;