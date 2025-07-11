/**
 * OutputFormatter - Main output formatting logic
 */

export class OutputFormatter {
  constructor(tableFormatter, colorManager) {
    this.tableFormatter = tableFormatter;
    this.colorManager = colorManager;
  }

  /**
   * Format output based on type and options
   * @param {any} result - Result to format
   * @param {object} options - Formatting options
   */
  format(result, options = {}) {
    if (options.output === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    
    // Handle different types of output
    if (result === null) {
      console.log('null');
    } else if (result === undefined) {
      console.log('undefined');
    } else if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
      console.log(result.toString());
    } else if (Array.isArray(result)) {
      this.formatArray(result);
    } else if (typeof result === 'object') {
      this.formatObject(result);
    } else {
      console.log(result);
    }
  }

  /**
   * Format array output
   * @param {array} arr - Array to format
   */
  formatArray(arr) {
    if (arr.length === 0) {
      console.log('[]');
      return;
    }
    
    // Check if it's an array of objects with consistent structure
    if (arr.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      this.tableFormatter.format(arr);
    } else {
      // Simple array - format as a list
      const formatted = arr.map(item => {
        if (typeof item === 'string') return item;
        return JSON.stringify(item);
      }).join('\n');
      console.log(formatted);
    }
  }

  /**
   * Format object output
   * @param {object} obj - Object to format
   */
  formatObject(obj) {
    const formatted = this.prettyPrint(obj);
    console.log(formatted);
  }

  /**
   * Pretty print an object
   * @param {object} obj - Object to print
   * @param {number} indent - Indentation level
   * @returns {string} Formatted string
   */
  prettyPrint(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const entries = Object.entries(obj);
    
    if (entries.length === 0) {
      return '{}';
    }
    
    let result = '{\n';
    entries.forEach(([key, value], index) => {
      result += `${spaces}  ${key}: `;
      
      if (value === null) {
        result += 'null';
      } else if (value === undefined) {
        result += 'undefined';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        result += this.prettyPrint(value, indent + 1);
      } else if (Array.isArray(value)) {
        result += JSON.stringify(value);
      } else if (typeof value === 'string') {
        result += `"${value}"`;
      } else {
        result += value;
      }
      
      if (index < entries.length - 1) {
        result += ',';
      }
      result += '\n';
    });
    result += spaces + '}';
    
    return result;
  }

  /**
   * Format table data
   * @param {array} data - Array of objects to format as table
   */
  formatTable(data) {
    this.tableFormatter.format(data);
  }

  /**
   * Format list
   * @param {array} items - Items to format as list
   */
  formatList(items) {
    if (!items || items.length === 0) {
      console.log('  (empty)');
      return;
    }
    
    items.forEach(item => {
      console.log(`  • ${item}`);
    });
  }

  /**
   * Format tool result
   * @param {string} toolName - Tool name
   * @param {object} result - Tool result
   * @param {object} config - Configuration
   */
  formatToolResult(toolName, result, config) {
    const useColor = config?.color !== false;
    const chalk = this.colorManager.getChalk();
    
    console.log(useColor ? chalk.bold(`\nTool: ${toolName}`) : `\nTool: ${toolName}`);
    console.log('-'.repeat(40));
    
    if (result.error) {
      this.formatError(result.error, config);
      if (result.code) {
        console.log(`Error code: ${result.code}`);
      }
    } else {
      console.log(useColor ? chalk.bold('Result:') : 'Result:');
      this.format(result);
    }
  }

  /**
   * Format error
   * @param {Error|string} error - Error to format
   * @param {object} config - Configuration
   */
  formatError(error, config) {
    const useColor = config?.color !== false;
    const chalk = this.colorManager.getChalk();
    const errorPrefix = useColor ? chalk.red('Error:') : 'Error:';
    
    if (error instanceof Error) {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.message) : error.message);
      
      if (config?.verbose && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.toString()) : error.toString());
    }
  }

  /**
   * Format success message
   * @param {string} message - Success message
   * @param {object} config - Configuration
   */
  formatSuccess(message, config) {
    const useColor = config?.color !== false;
    const chalk = this.colorManager.getChalk();
    const prefix = useColor ? chalk.green('✓') : '✓';
    console.log(`${prefix} ${message}`);
  }
}

export default OutputFormatter;