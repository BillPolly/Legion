/**
 * Debug Commands for Cerebrate
 * Handles debug command processing and validation
 */
export class DebugCommands {

  constructor(options = {}) {
    this.agent = options.agent;
    
    if (!this.agent) {
      throw new Error('Agent is required for DebugCommands');
    }

    // Command metadata registry
    this.commandRegistry = new Map([
      ['inspect_element', {
        name: 'inspect_element',
        description: 'Inspect DOM element with detailed analysis',
        parameters: {
          selector: { type: 'string', required: true, description: 'CSS selector or XPath' },
          selectorType: { type: 'string', required: false, description: 'Selector type: css or xpath' },
          includeStyles: { type: 'boolean', required: false, description: 'Include computed styles' },
          includeChildren: { type: 'boolean', required: false, description: 'Include child elements' },
          maxDepth: { type: 'number', required: false, description: 'Maximum depth for children' }
        },
        returns: {
          element: { type: 'object', description: 'Element information' },
          styles: { type: 'object', description: 'Style information' },
          position: { type: 'object', description: 'Element position and dimensions' }
        }
      }],
      ['analyze_javascript', {
        name: 'analyze_javascript',
        description: 'Analyze JavaScript code, errors, or performance',
        parameters: {
          type: { type: 'string', required: true, description: 'Analysis type: error, performance, code' },
          error: { type: 'object', required: false, description: 'Error information for error analysis' },
          data: { type: 'object', required: false, description: 'Data for performance analysis' },
          code: { type: 'string', required: false, description: 'Code for static analysis' }
        },
        returns: {
          analysis: { type: 'object', description: 'Analysis results' },
          suggestions: { type: 'array', description: 'Improvement suggestions' }
        }
      }],
      ['debug_error', {
        name: 'debug_error',
        description: 'Debug various types of errors',
        parameters: {
          type: { type: 'string', required: true, description: 'Error type: console, network, runtime' },
          error: { type: 'object', required: true, description: 'Error details' }
        },
        returns: {
          error_analysis: { type: 'object', description: 'Error analysis results' },
          fix_suggestions: { type: 'array', description: 'Suggested fixes' }
        }
      }]
    ]);
  }

  /**
   * Inspect DOM element
   * @param {Object} parameters - Inspection parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Inspection result
   */
  async inspectElement(parameters, context) {
    this.validateParameters(parameters, 'inspect_element');

    const { selector, selectorType = 'css', includeStyles = true, includeChildren = false, maxDepth = 1 } = parameters;

    if (selector === undefined || selector === null) {
      throw new Error('selector is required');
    }

    if (typeof selector !== 'string') {
      throw new Error('selector must be a string');
    }

    if (selector.trim() === '') {
      throw new Error('selector cannot be empty');
    }

    const agentParameters = {
      action: 'inspect',
      selector,
      includeStyles,
      includePosition: true,
      includeAttributes: true,
      ...(selectorType !== 'css' && { selectorType }),
      ...(includeChildren && { includeChildren, maxDepth })
    };

    return await this.agent.execute({
      command: 'dom_inspector',
      parameters: agentParameters,
      context
    });
  }

  /**
   * Analyze JavaScript code, errors, or performance
   * @param {Object} parameters - Analysis parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeJavaScript(parameters, context) {
    this.validateParameters(parameters, 'analyze_javascript');

    const { type, error, data, code } = parameters;

    if (!type) {
      throw new Error('type is required');
    }

    const validTypes = ['error', 'performance', 'code'];
    if (!validTypes.includes(type)) {
      throw new Error('Invalid analysis type');
    }

    let agentParameters = {};

    switch (type) {
      case 'error':
        if (!error) {
          throw new Error('error is required for error analysis');
        }
        if (typeof error !== 'object') {
          throw new Error('error must be an object');
        }
        agentParameters = {
          action: 'analyze_error',
          error,
          includeSourceContext: true,
          provideSuggestions: true
        };
        break;

      case 'performance':
        if (!data) {
          throw new Error('data is required for performance analysis');
        }
        agentParameters = {
          action: 'analyze_performance',
          data,
          includeOptimizations: true,
          generateReport: true
        };
        break;

      case 'code':
        if (!code) {
          throw new Error('code is required for code analysis');
        }
        agentParameters = {
          action: 'analyze_code',
          code,
          includeMetrics: true,
          provideSuggestions: true
        };
        break;
    }

    return await this.agent.execute({
      command: 'js_analyzer',
      parameters: agentParameters,
      context
    });
  }

  /**
   * Debug various types of errors
   * @param {Object} parameters - Debug parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Debug result
   */
  async debugError(parameters, context) {
    // Basic parameter validation first
    if (parameters === null || parameters === undefined) {
      throw new Error('parameters are required');
    }

    if (typeof parameters !== 'object') {
      throw new Error('parameters must be an object');
    }

    const { type, error } = parameters;

    if (!type) {
      throw new Error('type is required');
    }

    const validTypes = ['console', 'network', 'runtime'];
    if (!validTypes.includes(type)) {
      throw new Error('Invalid error type');
    }

    if (!error) {
      throw new Error('error is required');
    }

    // Now validate all parameters through the registry
    this.validateParameters(parameters, 'debug_error');

    let agentParameters = {};

    switch (type) {
      case 'console':
        agentParameters = {
          action: 'debug_console_error',
          error,
          includeScope: true,
          provideFixes: true
        };
        break;

      case 'network':
        agentParameters = {
          action: 'debug_network_error',
          error,
          checkEndpoint: true,
          analyzeCors: true
        };
        break;

      case 'runtime':
        agentParameters = {
          action: 'debug_runtime_error',
          error,
          analyzeStack: true,
          includeSourceMap: true
        };
        break;
    }

    return await this.agent.execute({
      command: 'error_debugger',
      parameters: agentParameters,
      context
    });
  }

  /**
   * Get list of supported commands
   * @returns {Array<string>} - Supported command names
   */
  getSupportedCommands() {
    return Array.from(this.commandRegistry.keys());
  }

  /**
   * Get command metadata
   * @param {string} commandName - Command name
   * @returns {Object|null} - Command metadata or null if not found
   */
  getCommandMetadata(commandName) {
    return this.commandRegistry.get(commandName) || null;
  }

  /**
   * Validate parameters for a command
   * @param {*} parameters - Parameters to validate
   * @param {string} commandName - Command name for validation
   * @private
   */
  validateParameters(parameters, commandName) {
    if (parameters === null || parameters === undefined) {
      throw new Error('parameters are required');
    }

    if (typeof parameters !== 'object') {
      throw new Error('parameters must be an object');
    }

    const metadata = this.commandRegistry.get(commandName);
    if (!metadata) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    // Validate required parameters
    for (const [paramName, paramConfig] of Object.entries(metadata.parameters)) {
      if (paramConfig.required && !(paramName in parameters)) {
        throw new Error(`${paramName} is required`);
      }

      // Type validation for existing parameters
      if (paramName in parameters && parameters[paramName] !== null) {
        const expectedType = paramConfig.type;
        const actualType = Array.isArray(parameters[paramName]) ? 'array' : typeof parameters[paramName];

        if (actualType !== expectedType) {
          // Handle proper article usage
          const article = ['a', 'e', 'i', 'o', 'u'].includes(expectedType[0]) ? 'an' : 'a';
          throw new Error(`${paramName} must be ${article} ${expectedType}`);
        }
      }
    }
  }

  /**
   * Execute any supported command by name
   * @param {string} commandName - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(commandName, parameters, context) {
    switch (commandName) {
      case 'inspect_element':
        return await this.inspectElement(parameters, context);
      
      case 'analyze_javascript':
        return await this.analyzeJavaScript(parameters, context);
      
      case 'debug_error':
        return await this.debugError(parameters, context);
      
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  }
}