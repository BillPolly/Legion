/**
 * PlanningStrategy - Base class for BT generation strategies
 * 
 * All strategies generate Behavior Tree structures instead of linear plans.
 * This ensures consistency and eliminates the need for conversion.
 */

/**
 * Base planning strategy interface
 */
export class PlanningStrategy {
  constructor(options = {}) {
    this.name = options.name || this.constructor.name;
    this.debugMode = options.debugMode || false;
    
    if (new.target === PlanningStrategy) {
      throw new Error('PlanningStrategy is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Generate a BT structure for achieving the goal
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context (retry info, etc.)
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBT(request, context = {}) {
    throw new Error('generateBT method must be implemented by subclass');
  }

  /**
   * Optional: Generate BT with retry-specific logic
   * @param {PlanningRequest} request - Planning request
   * @param {Object} retryContext - Retry context with previous failures
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBTWithRetry(request, retryContext) {
    // Default implementation just calls generateBT
    return this.generateBT(request, retryContext);
  }

  /**
   * Validate strategy can handle the request
   * @param {PlanningRequest} request - Planning request
   * @returns {boolean} True if strategy can handle request
   */
  canHandle(request) {
    return true; // Base implementation accepts all requests
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: 'base',
      description: 'Base planning strategy',
      capabilities: ['bt-generation'],
      version: '1.0.0'
    };
  }

  /**
   * Apply BT structure defaults
   * @param {Object} bt - BT structure
   * @returns {Object} BT with defaults applied
   */
  applyBTDefaults(bt) {
    if (!bt) return bt;

    // Ensure root node has required fields
    if (!bt.id) {
      bt.id = this.generateNodeId(bt);
    }

    if (!bt.type) {
      if (bt.children && Array.isArray(bt.children)) {
        bt.type = 'sequence';
      } else if (bt.tool) {
        bt.type = 'action';
      } else {
        bt.type = 'sequence'; // Safe default
      }
    }

    // Recursively apply defaults to children
    if (bt.children && Array.isArray(bt.children)) {
      bt.children = bt.children.map((child, index) => {
        if (!child.id) {
          child.id = this.generateNodeId(child, index);
        }
        if (!child.type) {
          if (child.tool) {
            child.type = 'action';
          } else if (child.children) {
            child.type = 'sequence';
          } else {
            child.type = 'action';
          }
        }
        return this.applyBTDefaults(child);
      });
    }

    if (bt.child) {
      bt.child = this.applyBTDefaults(bt.child);
    }

    return bt;
  }

  /**
   * Generate node ID
   * @param {Object} node - Node data
   * @param {number} index - Optional index
   * @returns {string} Generated ID
   */
  generateNodeId(node, index = '') {
    const type = node.type || (node.tool ? 'action' : 'sequence');
    const suffix = node.tool ? `_${node.tool}` : '';
    const indexSuffix = index !== '' ? `_${index}` : '';
    const randomSuffix = Math.random().toString(36).substr(2, 4);
    return `${type}${indexSuffix}${suffix}_${randomSuffix}`;
  }

  /**
   * Convert allowable actions to BT-compatible format
   * @param {Array} allowableActions - Actions from planning request
   * @returns {Array} BT-compatible action definitions
   */
  convertAllowableActions(allowableActions) {
    return allowableActions.map(action => ({
      type: 'action',
      tool: action.type || action.toolName || action.name,
      description: action.description,
      inputSchema: action.inputSchema,
      outputSchema: action.outputSchema,
      examples: action.examples,
      inputs: action.inputs,
      outputs: action.outputs
    }));
  }

  /**
   * Create simple sequential BT from action list
   * @param {Array} actions - List of actions
   * @param {Object} options - BT options
   * @returns {Object} Sequential BT structure
   */
  createSequentialBT(actions, options = {}) {
    const children = actions.map((action, index) => ({
      type: 'action',
      id: action.id || this.generateNodeId(action, index),
      tool: action.tool || action.type || action.name,
      description: action.description,
      params: action.params || action.parameters || {}
    }));

    return this.applyBTDefaults({
      type: 'sequence',
      id: options.id || 'root',
      description: options.description || 'Sequential execution plan',
      children,
      ...options
    });
  }

  /**
   * Create selector BT (fallback strategy)
   * @param {Array} alternatives - Alternative action paths
   * @param {Object} options - BT options
   * @returns {Object} Selector BT structure
   */
  createSelectorBT(alternatives, options = {}) {
    const children = alternatives.map((alt, index) => {
      if (Array.isArray(alt)) {
        // Multiple actions -> sequence
        return this.createSequentialBT(alt, {
          id: `alternative_${index}`,
          description: `Alternative ${index + 1}`
        });
      } else {
        // Single action
        return {
          type: 'action',
          id: alt.id || this.generateNodeId(alt, index),
          tool: alt.tool || alt.type,
          description: alt.description,
          params: alt.params || {}
        };
      }
    });

    return this.applyBTDefaults({
      type: 'selector',
      id: options.id || 'selector_root',
      description: options.description || 'Fallback execution strategy',
      children,
      ...options
    });
  }

  /**
   * Create parallel BT for concurrent execution
   * @param {Array} actions - Actions to execute in parallel
   * @param {Object} options - BT options
   * @returns {Object} Parallel BT structure
   */
  createParallelBT(actions, options = {}) {
    const children = actions.map((action, index) => ({
      type: 'action',
      id: action.id || this.generateNodeId(action, index),
      tool: action.tool || action.type,
      description: action.description,
      params: action.params || {}
    }));

    return this.applyBTDefaults({
      type: 'parallel',
      id: options.id || 'parallel_root',
      description: options.description || 'Parallel execution plan',
      children,
      ...options
    });
  }

  /**
   * Create retry wrapper for unreliable actions
   * @param {Object} action - Action to wrap with retry
   * @param {Object} options - Retry options
   * @returns {Object} Retry BT structure
   */
  createRetryBT(action, options = {}) {
    const child = {
      type: 'action',
      id: action.id || this.generateNodeId(action),
      tool: action.tool || action.type,
      description: action.description,
      params: action.params || {}
    };

    return this.applyBTDefaults({
      type: 'retry',
      id: options.id || `retry_${child.id}`,
      description: options.description || `Retry: ${child.description}`,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      child,
      ...options
    });
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    if (this.debugMode) {
      console.log(`[${this.name}] ${message}`, ...args);
    }
  }
}