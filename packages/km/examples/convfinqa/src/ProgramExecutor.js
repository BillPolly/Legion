/**
 * ProgramExecutor - Executes arithmetic reasoning programs for ConvFinQA
 *
 * Handles program syntax like:
 * - "subtract(60.94, 25.14), divide(#0, 25.14)"
 * - "#0" refers to the result of the previous operation
 *
 * Integrates with KG for data lookups when needed.
 */

export class ProgramExecutor {
  constructor(tripleStore = null) {
    this.tripleStore = tripleStore;
    this.results = []; // Store intermediate results for #0, #1, etc.
  }

  /**
   * Execute a single program step
   *
   * @param {string} program - Program string (e.g., "subtract(60.94, 25.14)")
   * @returns {number} Result of the operation
   */
  executeStep(program) {
    const trimmed = program.trim();

    // Handle variable references (#0, #1, etc.)
    if (trimmed.startsWith('#')) {
      const index = parseInt(trimmed.substring(1));
      if (index < 0 || index >= this.results.length) {
        throw new Error(`Invalid result reference: ${trimmed}`);
      }
      return this.results[index];
    }

    // Handle direct numbers
    if (!isNaN(trimmed)) {
      return parseFloat(trimmed);
    }

    // Parse function call: functionName(arg1, arg2)
    const match = trimmed.match(/^(\w+)\((.*)\)$/);
    if (!match) {
      throw new Error(`Invalid program syntax: ${trimmed}`);
    }

    const [, functionName, argsString] = match;
    const args = this._parseArgs(argsString);

    // Execute the function
    switch (functionName) {
      case 'subtract':
      case 'minus':
        return this._subtract(args);
      case 'divide':
        return this._divide(args);
      case 'add':
      case 'sum':
        return this._add(args);
      case 'multiply':
      case 'times':
        return this._multiply(args);
      case 'exp':
        return this._exp(args);
      case 'greater':
        return this._greater(args);
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  /**
   * Execute a multi-step program
   *
   * @param {string} program - Full program (e.g., "subtract(60.94, 25.14), divide(#0, 25.14)")
   * @returns {number} Final result
   */
  execute(program) {
    // Reset results for new execution
    this.results = [];

    // Split program into steps - split on commas NOT inside parentheses
    const steps = this._splitSteps(program);

    let finalResult = null;

    for (const step of steps) {
      const result = this.executeStep(step);
      this.results.push(result);
      finalResult = result;
    }

    return finalResult;
  }

  /**
   * Split program into steps, respecting parentheses
   *
   * @param {string} program - Full program string
   * @returns {Array<string>} Individual steps
   */
  _splitSteps(program) {
    const steps = [];
    let currentStep = '';
    let parenDepth = 0;

    for (let i = 0; i < program.length; i++) {
      const char = program[i];

      if (char === '(') {
        parenDepth++;
        currentStep += char;
      } else if (char === ')') {
        parenDepth--;
        currentStep += char;
      } else if (char === ',' && parenDepth === 0) {
        // This is a step separator
        if (currentStep.trim()) {
          steps.push(currentStep.trim());
        }
        currentStep = '';
      } else {
        currentStep += char;
      }
    }

    // Add the last step
    if (currentStep.trim()) {
      steps.push(currentStep.trim());
    }

    return steps;
  }

  /**
   * Parse function arguments
   *
   * @param {string} argsString - Arguments as string (e.g., "#0, 25.14")
   * @returns {Array<number>} Parsed arguments
   */
  _parseArgs(argsString) {
    return argsString
      .split(',')
      .map(arg => arg.trim())
      .map(arg => {
        // Handle variable references (#0, #1, etc.)
        if (arg.startsWith('#')) {
          const index = parseInt(arg.substring(1));
          if (index < 0 || index >= this.results.length) {
            throw new Error(`Invalid result reference: ${arg}`);
          }
          return this.results[index];
        }

        // Handle constants (const_100, const_1000, etc.)
        if (arg.startsWith('const_')) {
          const constValue = parseInt(arg.substring(6));
          if (isNaN(constValue)) {
            throw new Error(`Invalid constant: ${arg}`);
          }
          return constValue;
        }

        // Handle direct numbers
        const num = parseFloat(arg);
        if (isNaN(num)) {
          throw new Error(`Invalid argument: ${arg}`);
        }
        return num;
      });
  }

  /**
   * Arithmetic operations
   */

  _subtract(args) {
    if (args.length !== 2) {
      throw new Error(`subtract() requires 2 arguments, got ${args.length}`);
    }
    return args[0] - args[1];
  }

  _divide(args) {
    if (args.length !== 2) {
      throw new Error(`divide() requires 2 arguments, got ${args.length}`);
    }
    if (args[1] === 0) {
      throw new Error('Division by zero');
    }
    return args[0] / args[1];
  }

  _add(args) {
    if (args.length < 2) {
      throw new Error(`add() requires at least 2 arguments, got ${args.length}`);
    }
    return args.reduce((sum, val) => sum + val, 0);
  }

  _multiply(args) {
    if (args.length < 2) {
      throw new Error(`multiply() requires at least 2 arguments, got ${args.length}`);
    }
    return args.reduce((product, val) => product * val, 1);
  }

  _exp(args) {
    if (args.length !== 2) {
      throw new Error(`exp() requires 2 arguments, got ${args.length}`);
    }
    return Math.pow(args[0], args[1]);
  }

  _greater(args) {
    if (args.length !== 2) {
      throw new Error(`greater() requires 2 arguments, got ${args.length}`);
    }
    return args[0] > args[1] ? 1 : 0;
  }

  /**
   * Query KG for a value
   *
   * @param {string} instanceUri - Instance URI (e.g., "kg:MRO_StockOption_2007")
   * @param {string} propertyUri - Property URI (e.g., "kg:exercisePrice")
   * @returns {Promise<number>} Property value
   */
  async queryKG(instanceUri, propertyUri) {
    if (!this.tripleStore) {
      throw new Error('TripleStore not configured');
    }

    const results = await this.tripleStore.query(instanceUri, propertyUri, null);
    if (results.length === 0) {
      throw new Error(`No value found for ${instanceUri} ${propertyUri}`);
    }

    // Parse the value (handle xsd:decimal format)
    const value = results[0][2]
      .replace(/["\^]|xsd:\w+/g, '')
      .trim();

    return parseFloat(value);
  }

  /**
   * Reset execution state
   */
  reset() {
    this.results = [];
  }
}
