/**
 * ArithmeticExecutor - Execute arithmetic programs for ConvFinQA
 *
 * Parses and executes program strings like:
 * - "206588"
 * - "subtract(206588, 181001)"
 * - "subtract(206588, 181001), divide(#0, 181001)"
 *
 * Keeps arithmetic reasoning separate from query-understanding pipeline.
 */

export class ArithmeticExecutor {
  constructor() {
    this.operations = {
      add: (a, b) => a + b,
      subtract: (a, b) => a - b,
      multiply: (a, b) => a * b,
      divide: (a, b) => b !== 0 ? a / b : null,
      percent: (a) => a * 100,
      negate: (a) => -a,
      abs: (a) => Math.abs(a),
      round: (a, decimals = 0) => Number(a.toFixed(decimals))
    };

    this.results = []; // Store intermediate results for references like #0, #1
  }

  /**
   * Parse a program string into executable steps
   *
   * @param {string} program - Program string (e.g., "subtract(206588, 181001), divide(#0, 181001)")
   * @returns {Array} Array of parsed steps
   */
  parseProgram(program) {
    if (!program || typeof program !== 'string') {
      return [];
    }

    // Split by comma, but respect parentheses
    const steps = [];
    let current = '';
    let depth = 0;

    for (const char of program) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        // Top-level comma - split here
        if (current.trim()) {
          steps.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    // Add final step
    if (current.trim()) {
      steps.push(current.trim());
    }

    return steps.map(step => this._parseStep(step));
  }

  /**
   * Parse a single step
   *
   * @param {string} step - Single step (e.g., "subtract(206588, 181001)" or "206588")
   * @returns {Object} Parsed step
   */
  _parseStep(step) {
    // Check if it's a function call
    const funcMatch = step.match(/^(\w+)\((.*)\)$/);

    if (funcMatch) {
      const [, funcName, argsStr] = funcMatch;
      const args = this._parseArgs(argsStr);

      return {
        type: 'function',
        name: funcName,
        args
      };
    }

    // Otherwise, it's a literal value
    const value = this._parseValue(step);
    return {
      type: 'literal',
      value
    };
  }

  /**
   * Parse function arguments
   *
   * @param {string} argsStr - Arguments string (e.g., "206588, 181001" or "#0, 181001")
   * @returns {Array} Parsed arguments
   */
  _parseArgs(argsStr) {
    if (!argsStr.trim()) {
      return [];
    }

    return argsStr.split(',').map(arg => {
      const trimmed = arg.trim();

      // Reference to previous result (#0, #1, etc.)
      if (trimmed.startsWith('#')) {
        const index = parseInt(trimmed.substring(1), 10);
        return {
          type: 'reference',
          index
        };
      }

      // Literal value
      return {
        type: 'value',
        value: this._parseValue(trimmed)
      };
    });
  }

  /**
   * Parse a literal value (number or string)
   *
   * @param {string} str - Value string
   * @returns {number|string} Parsed value
   */
  _parseValue(str) {
    const trimmed = str.trim();

    // Try to parse as number
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return num;
    }

    // Return as string
    return trimmed;
  }

  /**
   * Resolve an argument to its actual value
   *
   * @param {Object} arg - Argument object
   * @returns {number|string} Resolved value
   */
  _resolveArg(arg) {
    if (arg.type === 'reference') {
      const result = this.results[arg.index];
      if (result === undefined) {
        throw new Error(`Invalid reference: #${arg.index} (only ${this.results.length} results available)`);
      }
      return result;
    }

    return arg.value;
  }

  /**
   * Execute a single step
   *
   * @param {Object} step - Parsed step
   * @returns {number|string} Result
   */
  _executeStep(step) {
    if (step.type === 'literal') {
      return step.value;
    }

    if (step.type === 'function') {
      const operation = this.operations[step.name];
      if (!operation) {
        throw new Error(`Unknown operation: ${step.name}`);
      }

      // Resolve arguments
      const resolvedArgs = step.args.map(arg => this._resolveArg(arg));

      // Execute operation
      const result = operation(...resolvedArgs);

      if (result === null || result === undefined) {
        throw new Error(`Operation ${step.name}(${resolvedArgs.join(', ')}) returned null/undefined`);
      }

      return result;
    }

    throw new Error(`Unknown step type: ${step.type}`);
  }

  /**
   * Execute a complete program
   *
   * @param {string} program - Program string
   * @returns {number|string} Final result
   */
  execute(program) {
    // Reset results for new program
    this.results = [];

    // Parse program
    const steps = this.parseProgram(program);

    if (steps.length === 0) {
      return null;
    }

    // Execute each step
    for (const step of steps) {
      const result = this._executeStep(step);
      this.results.push(result);
    }

    // Return final result
    return this.results[this.results.length - 1];
  }

  /**
   * Execute a program and return all intermediate results
   *
   * @param {string} program - Program string
   * @returns {Array} All intermediate results
   */
  executeWithSteps(program) {
    this.execute(program);
    return [...this.results];
  }

  /**
   * Clear results cache
   */
  clear() {
    this.results = [];
  }

  /**
   * Add custom operation
   *
   * @param {string} name - Operation name
   * @param {Function} func - Operation function
   */
  addOperation(name, func) {
    this.operations[name] = func;
  }
}
