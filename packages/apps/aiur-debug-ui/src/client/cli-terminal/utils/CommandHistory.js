/**
 * CommandHistory - Manages command history with persistence
 */

export class CommandHistory {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.history = [];
    this.currentIndex = -1;
    this.tempCommand = '';
    this.storageKey = 'aiur-cli-history';
    
    // Load from localStorage
    this.load();
  }

  /**
   * Add a command to history
   */
  add(command) {
    if (!command.trim()) return;
    
    // Remove duplicates
    this.history = this.history.filter(cmd => cmd !== command);
    
    // Add to end
    this.history.push(command);
    
    // Trim if exceeds max size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }
    
    // Reset index
    this.currentIndex = this.history.length;
    this.tempCommand = '';
    
    // Save to storage
    this.save();
  }

  /**
   * Navigate history
   * @param {number} direction - -1 for previous, 1 for next
   * @param {string} currentInput - Current input to save
   * @returns {string} Command at new position
   */
  navigate(direction, currentInput = '') {
    // Save current input if at end of history
    if (this.currentIndex === this.history.length) {
      this.tempCommand = currentInput;
    }
    
    const newIndex = this.currentIndex + direction;
    
    if (newIndex < 0) {
      return this.history[this.currentIndex] || '';
    }
    
    if (newIndex >= this.history.length) {
      this.currentIndex = this.history.length;
      return this.tempCommand;
    }
    
    this.currentIndex = newIndex;
    return this.history[this.currentIndex];
  }

  /**
   * Get previous command
   */
  previous(currentInput) {
    return this.navigate(-1, currentInput);
  }

  /**
   * Get next command
   */
  next(currentInput) {
    return this.navigate(1, currentInput);
  }

  /**
   * Get all history
   */
  getAll() {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.tempCommand = '';
    this.save();
  }

  /**
   * Search history
   */
  search(term) {
    const lowerTerm = term.toLowerCase();
    return this.history.filter(cmd => 
      cmd.toLowerCase().includes(lowerTerm)
    );
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        history: this.history,
        version: 1
      }));
    } catch (error) {
      console.warn('Failed to save command history:', error);
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === 1 && Array.isArray(data.history)) {
          this.history = data.history.slice(-this.maxSize);
          this.currentIndex = this.history.length;
        }
      }
    } catch (error) {
      console.warn('Failed to load command history:', error);
    }
  }
}