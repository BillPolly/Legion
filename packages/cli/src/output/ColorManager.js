/**
 * ColorManager - Manages colored output with chalk
 */

import chalk from 'chalk';

export class ColorManager {
  constructor(config = {}) {
    this.enabled = config.color !== false;
    this.chalk = chalk;
  }

  /**
   * Enable or disable colors
   * @param {boolean} enabled - Whether colors should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Check if colors are enabled
   * @returns {boolean} True if colors are enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get chalk instance
   * @returns {object} Chalk instance or no-op proxy
   */
  getChalk() {
    if (this.enabled) {
      return this.chalk;
    }
    
    // Return a proxy that returns strings unchanged
    return new Proxy({}, {
      get: () => (str) => str
    });
  }

  /**
   * Apply color if enabled
   * @param {string} color - Color name
   * @param {string} text - Text to color
   * @returns {string} Colored or plain text
   */
  apply(color, text) {
    if (!this.enabled) {
      return text;
    }
    
    if (typeof this.chalk[color] === 'function') {
      return this.chalk[color](text);
    }
    
    return text;
  }

  /**
   * Common color methods
   */
  
  red(text) {
    return this.apply('red', text);
  }

  green(text) {
    return this.apply('green', text);
  }

  blue(text) {
    return this.apply('blue', text);
  }

  yellow(text) {
    return this.apply('yellow', text);
  }

  cyan(text) {
    return this.apply('cyan', text);
  }

  gray(text) {
    return this.apply('gray', text);
  }

  bold(text) {
    return this.enabled ? this.chalk.bold(text) : text;
  }

  dim(text) {
    return this.enabled ? this.chalk.dim(text) : text;
  }

  italic(text) {
    return this.enabled ? this.chalk.italic(text) : text;
  }

  underline(text) {
    return this.enabled ? this.chalk.underline(text) : text;
  }
}

export default ColorManager;