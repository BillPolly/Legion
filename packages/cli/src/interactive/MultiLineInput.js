/**
 * MultiLineInput - Handles multi-line input in interactive mode
 */

export class MultiLineInput {
  constructor() {
    this.active = false;
    this.mode = null; // 'json' or 'string'
    this.buffer = [];
  }

  /**
   * Check if multi-line mode is active
   * @returns {boolean} True if active
   */
  isActive() {
    return this.active;
  }

  /**
   * Check if command should start multi-line mode
   * @param {string} line - Command line
   * @returns {boolean} True if should start
   */
  shouldStartMultiLine(line) {
    return line.includes('--json {') || 
           line.includes('--json [') || 
           line.includes('"""');
  }

  /**
   * Start multi-line mode
   * @param {string} firstLine - First line of multi-line input
   */
  start(firstLine) {
    this.active = true;
    this.buffer = [firstLine];
    
    if (firstLine.includes('--json')) {
      this.mode = 'json';
    } else if (firstLine.includes('"""')) {
      this.mode = 'string';
    }
  }

  /**
   * Process a line in multi-line mode
   * @param {string} line - Line to process
   * @returns {object} Result object
   */
  processLine(line) {
    const trimmed = line.trim();
    
    // Check for cancel command
    if (trimmed === '.cancel') {
      this.reset();
      return { cancelled: true };
    }
    
    // Check for end of multi-line
    if (this.mode === 'json') {
      this.buffer.push(line); // Keep original line for JSON
      const combined = this.buffer.join('\n');
      
      // Simple bracket/brace counting
      const openBraces = (combined.match(/{/g) || []).length;
      const closeBraces = (combined.match(/}/g) || []).length;
      const openBrackets = (combined.match(/\[/g) || []).length;
      const closeBrackets = (combined.match(/\]/g) || []).length;
      
      if (openBraces === closeBraces && openBrackets === closeBrackets && 
          (openBraces > 0 || openBrackets > 0)) {
        // JSON complete, process it
        const command = this.buildJsonCommand();
        this.reset();
        return { complete: true, command };
      }
    } else if (this.mode === 'string') {
      if (trimmed === '"""') {
        // End of multi-line string
        const command = this.buildStringCommand();
        this.reset();
        return { complete: true, command };
      } else {
        this.buffer.push(line); // Keep original line with formatting
      }
    }
    
    return { complete: false };
  }

  /**
   * Build complete command from JSON buffer
   * @returns {string} Complete command
   */
  buildJsonCommand() {
    // Extract the JSON part and merge it back
    const firstLine = this.buffer[0];
    const jsonStart = firstLine.indexOf('--json ') + 7;
    const beforeJson = firstLine.substring(0, jsonStart);
    const jsonContent = this.buffer.join('\n').substring(jsonStart);
    
    // Create the complete command with properly formatted JSON
    return beforeJson + jsonContent;
  }

  /**
   * Build complete command from string buffer
   * @returns {string} Complete command
   */
  buildStringCommand() {
    const content = this.buffer.slice(1).join('\n');
    return this.buffer[0].replace('"""', `"${content}"`);
  }

  /**
   * Reset multi-line mode
   */
  reset() {
    this.active = false;
    this.mode = null;
    this.buffer = [];
  }

  /**
   * Get current mode
   * @returns {string|null} Current mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Get buffer content
   * @returns {string[]} Buffer lines
   */
  getBuffer() {
    return [...this.buffer];
  }
}

export default MultiLineInput;