/**
 * HistoryManager - Command history management with persistence
 * Manages command history with navigation, search, and storage capabilities
 */
export class HistoryManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxAge = options.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.sessionId = options.sessionId || 'default';
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.deduplicate = options.deduplicate !== false;
    this.ignorePatterns = options.ignorePatterns || [/^$/];
    
    this.history = [];
    this.currentIndex = -1;
    this.searchResults = [];
    this.searchIndex = -1;
    this._timestampCounter = 0; // Ensure unique timestamps in tests
    
    // Load history on initialization
    this.loadHistory();
  }
  
  /**
   * Add a command to history
   * @param {string} command - Command to add
   * @returns {boolean} Whether command was added
   */
  add(command) {
    // Validate command
    if (!command || typeof command !== 'string') {
      return false;
    }
    
    // Trim whitespace
    command = command.trim();
    
    // Check ignore patterns
    for (const pattern of this.ignorePatterns) {
      if (pattern.test(command)) {
        return false;
      }
    }
    
    // Deduplicate if enabled
    if (this.deduplicate) {
      const lastIndex = this.history.findIndex(entry => entry.command === command);
      if (lastIndex !== -1) {
        this.history.splice(lastIndex, 1);
      }
    }
    
    // Create history entry
    // Add small counter to timestamp to ensure unique values in tests
    const entry = {
      command,
      timestamp: Date.now() + (this._timestampCounter++),
      sessionId: this.sessionId,
      id: this.generateId()
    };
    
    // Add to history
    this.history.push(entry);
    
    // Enforce max size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }
    
    // Reset navigation
    this.currentIndex = this.history.length;
    
    // Save to storage
    this.saveHistory();
    
    return true;
  }
  
  /**
   * Get entry at specific index
   * @param {number} index - Index to get
   * @returns {Object|null} History entry or null
   */
  get(index) {
    if (index < 0 || index >= this.history.length) {
      return null;
    }
    return this.history[index];
  }
  
  /**
   * Get last entry
   * @returns {Object|null} Last entry or null
   */
  getLast() {
    return this.history[this.history.length - 1] || null;
  }
  
  /**
   * Get all commands
   * @returns {Array<string>} Array of commands
   */
  getAll() {
    return this.history.map(entry => entry.command);
  }
  
  /**
   * Get history (alias for getAll)
   * @returns {Array<string>} Array of commands
   */
  getHistory() {
    return this.getAll();
  }
  
  /**
   * Get full history with metadata
   * @returns {Array<Object>} Array of history entries
   */
  getFullHistory() {
    return [...this.history];
  }
  
  /**
   * Navigate up in history
   * @returns {string|null} Previous command or null
   */
  navigateUp() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex]?.command || null;
    }
    return null;
  }
  
  /**
   * Navigate down in history
   * @returns {string|null} Next command or empty string or null
   */
  navigateDown() {
    // If history is empty, return null
    if (this.history.length === 0) {
      return null;
    }
    
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex]?.command || null;
    } else if (this.currentIndex === this.history.length - 1) {
      this.currentIndex = this.history.length;
      return '';
    }
    return null;
  }
  
  /**
   * Search history
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array<string>} Matching commands
   */
  search(query, options = {}) {
    const { 
      caseSensitive = false,
      regex = false,
      maxResults = 50,
      sortByRecent = true
    } = options;
    
    if (!query) {
      this.searchResults = [];
      this.searchIndex = -1;
      return [];
    }
    
    let matcher;
    if (regex) {
      try {
        matcher = new RegExp(query, caseSensitive ? '' : 'i');
      } catch (e) {
        return [];
      }
    } else {
      const searchStr = caseSensitive ? query : query.toLowerCase();
      matcher = (cmd) => {
        const cmdStr = caseSensitive ? cmd : cmd.toLowerCase();
        return cmdStr.includes(searchStr);
      };
    }
    
    // Search through history
    const results = this.history.filter(entry => {
      if (regex) {
        return matcher.test(entry.command);
      } else {
        return matcher(entry.command);
      }
    });
    
    // Sort by recency if requested (most recent first)
    if (sortByRecent) {
      results.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Limit results
    this.searchResults = results.slice(0, maxResults);
    this.searchIndex = -1; // Start at -1 so first searchNext() returns index 0
    
    return this.searchResults.map(entry => entry.command);
  }
  
  /**
   * Get next search result
   * @returns {string|null} Next result or null
   */
  searchNext() {
    if (this.searchResults.length === 0) {
      return null;
    }
    
    // First call returns first result (index 0)
    // Subsequent calls cycle through results
    if (this.searchIndex === -1) {
      this.searchIndex = 0;
    } else {
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
    }
    return this.searchResults[this.searchIndex]?.command || null;
  }
  
  /**
   * Get previous search result
   * @returns {string|null} Previous result or null
   */
  searchPrevious() {
    if (this.searchResults.length === 0) {
      return null;
    }
    
    // If we haven't started navigating, go to last result
    if (this.searchIndex === -1 || this.searchIndex === 0) {
      this.searchIndex = this.searchResults.length - 1;
    } else {
      this.searchIndex = this.searchIndex - 1;
    }
    
    return this.searchResults[this.searchIndex]?.command || null;
  }
  
  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.searchResults = [];
    this.searchIndex = -1;
    this.saveHistory();
  }
  
  /**
   * Delete specific command from history
   * @param {string} command - Command to delete
   * @returns {boolean} Whether command was deleted
   */
  delete(command) {
    const initialLength = this.history.length;
    this.history = this.history.filter(entry => entry.command !== command);
    
    if (this.history.length < initialLength) {
      this.currentIndex = this.history.length;
      this.saveHistory();
      return true;
    }
    
    return false;
  }
  
  /**
   * Delete entry by ID
   * @param {string} id - Entry ID
   * @returns {boolean} Whether entry was deleted
   */
  deleteById(id) {
    const initialLength = this.history.length;
    this.history = this.history.filter(entry => entry.id !== id);
    
    if (this.history.length < initialLength) {
      this.currentIndex = this.history.length;
      this.saveHistory();
      return true;
    }
    
    return false;
  }
  
  /**
   * Prune old entries
   * @returns {number} Number of entries pruned
   */
  prune() {
    const cutoff = Date.now() - this.maxAge;
    const initialLength = this.history.length;
    
    this.history = this.history.filter(entry => entry.timestamp > cutoff);
    
    const pruned = initialLength - this.history.length;
    if (pruned > 0) {
      this.currentIndex = this.history.length;
      this.saveHistory();
    }
    
    return pruned;
  }
  
  /**
   * Save history to storage
   */
  saveHistory() {
    if (!this.storage) return;
    
    const key = `history:${this.sessionId}`;
    const data = JSON.stringify({
      version: '1.0',
      history: this.history,
      saved: Date.now()
    });
    
    try {
      this.storage.setItem(key, data);
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }
  
  /**
   * Load history from storage
   */
  loadHistory() {
    if (!this.storage) return;
    
    const key = `history:${this.sessionId}`;
    
    try {
      const data = this.storage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.history && Array.isArray(parsed.history)) {
          this.history = parsed.history;
          this.currentIndex = this.history.length;
          
          // Prune old entries on load
          this.prune();
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }
  
  /**
   * Export history
   * @returns {Object} Exported history data
   */
  exportHistory() {
    return {
      version: '1.0',
      sessionId: this.sessionId,
      exported: Date.now(),
      history: this.history
    };
  }
  
  /**
   * Import history
   * @param {Object} data - History data to import
   * @param {Object} options - Import options
   * @returns {number} Number of entries imported
   */
  importHistory(data, options = {}) {
    const { merge = false, deduplicate = true } = options;
    
    if (!data || !data.history || !Array.isArray(data.history)) {
      throw new Error('Invalid history data');
    }
    
    if (merge) {
      // Merge with existing history
      const existingCommands = new Set(this.history.map(e => e.command));
      
      for (const entry of data.history) {
        if (!deduplicate || !existingCommands.has(entry.command)) {
          this.history.push({
            ...entry,
            imported: true,
            importedAt: Date.now()
          });
        }
      }
      
      // Sort by timestamp
      this.history.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      // Replace history
      this.history = data.history.map(entry => ({
        ...entry,
        imported: true,
        importedAt: Date.now()
      }));
    }
    
    // Enforce max size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }
    
    this.currentIndex = this.history.length;
    this.saveHistory();
    
    return this.history.length;
  }
  
  /**
   * Get history statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const commands = {};
    const sessions = {};
    let totalCommands = this.history.length;
    let oldestEntry = null;
    let newestEntry = null;
    
    for (const entry of this.history) {
      // Count command frequency
      const baseCommand = entry.command.split(' ')[0];
      commands[baseCommand] = (commands[baseCommand] || 0) + 1;
      
      // Count by session
      sessions[entry.sessionId] = (sessions[entry.sessionId] || 0) + 1;
      
      // Track oldest/newest
      if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
        oldestEntry = entry;
      }
      if (!newestEntry || entry.timestamp > newestEntry.timestamp) {
        newestEntry = entry;
      }
    }
    
    // Get top commands
    const topCommands = Object.entries(commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ command: cmd, count }));
    
    return {
      totalCommands,
      uniqueCommands: Object.keys(commands).length,
      topCommands,
      sessions: Object.keys(sessions).length,
      oldestEntry: oldestEntry?.timestamp,
      newestEntry: newestEntry?.timestamp,
      averageCommandLength: totalCommands > 0 
        ? Math.round(this.history.reduce((sum, e) => sum + e.command.length, 0) / totalCommands)
        : 0
    };
  }
  
  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}