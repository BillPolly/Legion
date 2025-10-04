/**
 * OutputHandler - Handle output formatting and display
 * Provides colored output, tables, JSON formatting, and message display
 */

import chalk from 'chalk';
import { formatJSONSafely } from '../utils/logger.js';

export class OutputHandler {
  constructor(options = {}) {
    this.useColors = options.useColors !== false;
    this.showStackTrace = options.showStackTrace !== false;
  }

  /**
   * Output success message
   * @param {string} message - Success message
   */
  success(message) {
    if (this.useColors) {
      console.log(chalk.green(`✓ ${message}`));
    } else {
      console.log(`✓ ${message}`);
    }
  }

  /**
   * Output error message
   * @param {string} message - Error message
   */
  error(message) {
    if (this.useColors) {
      console.error(chalk.red(`✗ ${message}`));
    } else {
      console.error(`✗ ${message}`);
    }
  }

  /**
   * Output info message
   * @param {string} message - Info message
   */
  info(message) {
    if (this.useColors) {
      console.log(chalk.cyan(`ℹ ${message}`));
    } else {
      console.log(`ℹ ${message}`);
    }
  }

  /**
   * Output warning message
   * @param {string} message - Warning message
   */
  warning(message) {
    if (this.useColors) {
      console.log(chalk.yellow(`⚠ ${message}`));
    } else {
      console.log(`⚠ ${message}`);
    }
  }

  /**
   * Output plain message
   * @param {string} message - Plain message
   */
  print(message) {
    console.log(message);
  }

  /**
   * Output blank line
   */
  blank() {
    console.log('');
  }

  /**
   * Format data as table
   * @param {Array<Object>} data - Array of objects to display as table
   * @returns {string} Formatted table
   */
  formatTable(data) {
    if (!data || data.length === 0) {
      return '(no data)';
    }

    // Get all unique keys
    const keys = [...new Set(data.flatMap(Object.keys))];

    // Calculate column widths
    const widths = {};
    keys.forEach(key => {
      widths[key] = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
    });

    // Build table
    const lines = [];

    // Header
    const header = keys.map(key => key.padEnd(widths[key])).join(' │ ');
    lines.push(`┌─${keys.map(key => '─'.repeat(widths[key])).join('─┬─')}─┐`);
    lines.push(`│ ${header} │`);
    lines.push(`├─${keys.map(key => '─'.repeat(widths[key])).join('─┼─')}─┤`);

    // Rows
    data.forEach(row => {
      const rowStr = keys.map(key => String(row[key] || '').padEnd(widths[key])).join(' │ ');
      lines.push(`│ ${rowStr} │`);
    });

    // Footer
    lines.push(`└─${keys.map(key => '─'.repeat(widths[key])).join('─┴─')}─┘`);

    return lines.join('\n');
  }

  /**
   * Format data as JSON (with base64 sanitization)
   * @param {any} data - Data to format
   * @param {number} indent - Indentation spaces
   * @returns {string} Formatted JSON
   */
  formatJSON(data, indent = 2) {
    return formatJSONSafely(data, indent);
  }

  /**
   * Output list of items
   * @param {Array<string>} items - Items to list
   * @param {string} prefix - List item prefix (default: '•')
   */
  list(items, prefix = '•') {
    if (!items || items.length === 0) {
      console.log('(no items)');
      return;
    }

    items.forEach(item => {
      console.log(`${prefix} ${item}`);
    });
  }

  /**
   * Output heading
   * @param {string} text - Heading text
   */
  heading(text) {
    if (this.useColors) {
      console.log(chalk.bold.underline(text));
    } else {
      console.log(`\n${text}\n${'='.repeat(text.length)}`);
    }
  }

  /**
   * Output divider
   * @param {string} char - Divider character (default: '─')
   * @param {number} length - Divider length (default: 80)
   */
  divider(char = '─', length = 80) {
    console.log(char.repeat(length));
  }

  /**
   * Output command result
   * @param {Object} result - Command result object
   */
  commandResult(result) {
    if (result.success) {
      this.success(result.message);
    } else {
      this.error(result.message);
    }

    if (result.data) {
      this.blank();
      console.log(this.formatJSON(result.data));
    }
  }

  /**
   * Format and output error
   * @param {Error|string} error - Error to format
   */
  formatError(error) {
    if (typeof error === 'string') {
      this.error(error);
      return;
    }

    if (error instanceof Error) {
      this.error(error.message);

      if (this.showStackTrace && error.stack) {
        this.blank();
        if (this.useColors) {
          console.error(chalk.gray(error.stack));
        } else {
          console.error(error.stack);
        }
      }
    } else {
      this.error(String(error));
    }
  }

  /**
   * Enable or disable colors
   * @param {boolean} enabled - Whether to use colors
   */
  setColors(enabled) {
    this.useColors = enabled;
  }

  /**
   * Clear screen
   */
  clear() {
    console.clear();
  }
}

export default OutputHandler;
