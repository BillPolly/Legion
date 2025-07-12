/**
 * ErrorFormatter - Formats error messages
 */

export class ErrorFormatter {
  constructor(colorManager) {
    this.colorManager = colorManager;
  }

  /**
   * Format an error
   * @param {Error|string} error - Error to format
   * @param {object} options - Formatting options
   */
  format(error, options = {}) {
    const useColor = options.color !== false;
    const chalk = this.colorManager.getChalk();
    const errorPrefix = useColor ? chalk.red('Error:') : 'Error:';
    
    if (error instanceof Error) {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.message) : error.message);
      
      if (options.verbose && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.toString()) : error.toString());
    }
  }

  /**
   * Format a warning
   * @param {string} message - Warning message
   * @param {object} options - Formatting options
   */
  formatWarning(message, options = {}) {
    const useColor = options.color !== false;
    const chalk = this.colorManager.getChalk();
    const warningPrefix = useColor ? chalk.yellow('Warning:') : 'Warning:';
    console.warn(`${warningPrefix} ${message}`);
  }

  /**
   * Format an info message
   * @param {string} message - Info message
   * @param {object} options - Formatting options
   */
  formatInfo(message, options = {}) {
    const useColor = options.color !== false;
    const chalk = this.colorManager.getChalk();
    const infoPrefix = useColor ? chalk.blue('Info:') : 'Info:';
    console.log(`${infoPrefix} ${message}`);
  }

  /**
   * Format a success message
   * @param {string} message - Success message
   * @param {object} options - Formatting options
   */
  formatSuccess(message, options = {}) {
    const useColor = options.color !== false;
    const chalk = this.colorManager.getChalk();
    const prefix = useColor ? chalk.green('✓') : '✓';
    console.log(`${prefix} ${message}`);
  }

  /**
   * Format a hint or suggestion
   * @param {string} message - Hint message
   * @param {object} options - Formatting options
   */
  formatHint(message, options = {}) {
    const useColor = options.color !== false;
    const chalk = this.colorManager.getChalk();
    const hintPrefix = useColor ? chalk.gray('Hint:') : 'Hint:';
    console.log(`${hintPrefix} ${message}`);
  }
}

export default ErrorFormatter;