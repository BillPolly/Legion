/**
 * InputHandler - Handle user input and command history
 * Provides readline-based interactive prompt with history management
 */

import readline from 'readline';

export class InputHandler {
  constructor(options = {}) {
    this.prompt = options.prompt || '> ';
    this.historySize = options.historySize || 1000;
    this.history = [];
    this.isActive = false;
    this.callback = null;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt
    });
  }

  /**
   * Start the interactive prompt
   * @param {Function} callback - Called with user input
   * @returns {boolean} True if started, false if already active
   */
  start(callback) {
    if (this.isActive) {
      return false;
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.callback = callback;
    this.isActive = true;

    // Set up line event handler
    this.rl.on('line', async (input) => {
      const trimmed = this.trimInput(input);

      if (this.validateInput(trimmed)) {
        this.addToHistory(trimmed);

        try {
          await this.callback(trimmed);
        } catch (error) {
          // Error handling delegated to callback
        }
      }

      if (this.isActive) {
        this.rl.prompt();
      }
    });

    // Set up close event handler
    this.rl.on('close', () => {
      this.isActive = false;
    });

    // Show initial prompt
    this.rl.prompt();

    return true;
  }

  /**
   * Stop the interactive prompt
   */
  stop() {
    this.isActive = false;
  }

  /**
   * Close the readline interface
   */
  close() {
    if (this.rl) {
      this.rl.close();
    }
  }

  /**
   * Add command to history
   * @param {string} command - Command to add
   */
  addToHistory(command) {
    if (!command || command.trim().length === 0) {
      return;
    }

    const trimmed = command.trim();

    // Don't add duplicate consecutive commands
    if (this.history.length > 0 && this.history[this.history.length - 1] === trimmed) {
      return;
    }

    this.history.push(trimmed);

    // Enforce history size limit
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
  }

  /**
   * Get command history
   * @returns {Array<string>} Command history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear command history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Validate input
   * @param {string} input - Input to validate
   * @returns {boolean} True if valid
   */
  validateInput(input) {
    if (!input || typeof input !== 'string') {
      return false;
    }

    return input.trim().length > 0;
  }

  /**
   * Trim input
   * @param {string} input - Input to trim
   * @returns {string} Trimmed input
   */
  trimInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input.trim();
  }

  /**
   * Set prompt string
   * @param {string} prompt - New prompt string
   */
  setPrompt(prompt) {
    if (typeof prompt !== 'string') {
      throw new Error('Prompt must be a string');
    }

    this.prompt = prompt;

    if (this.rl) {
      this.rl.setPrompt(prompt);
    }
  }
}

export default InputHandler;
