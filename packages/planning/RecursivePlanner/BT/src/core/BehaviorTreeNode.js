/**
 * BehaviorTreeNode - Base class for all behavior tree nodes
 * 
 * Core features:
 * - Unified interface compatible with tools (execute + getMetadata)
 * - Message-passing communication system
 * - Dynamic child management
 * - Pluggable execution patterns
 */

export const NodeStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE', 
  RUNNING: 'RUNNING'
};

export class BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.executor = executor;
    this.messageBus = executor.messageBus;
    
    // Tree structure
    this.parent = null;
    this.children = [];
    this.id = config.id || this.generateId();
    
    // Node state
    this.status = null;
    this.context = {};
    this.isRunning = false;
    
    // Initialize children if provided
    if (config.children) {
      this.initializeChildren(config.children);
    }
  }

  /**
   * Main execution interface - implements tool-compatible interface
   * @param {Object} input - Execution context and parameters
   * @returns {Promise<Object>} Execution result
   */
  async execute(input) {
    try {
      this.isRunning = true;
      this.context = { ...input };
      
      const result = await this.executeNode(input);
      
      if (result.status !== NodeStatus.RUNNING) {
        this.isRunning = false;
      }
      
      return result;
    } catch (error) {
      this.isRunning = false;
      return {
        status: NodeStatus.FAILURE,
        error: error.message,
        data: { errorMessage: error.message, stackTrace: error.stack }
      };
    }
  }

  /**
   * Node-specific execution logic - override in subclasses
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Node execution result
   */
  async executeNode(context) {
    throw new Error(`${this.constructor.name} must implement executeNode() method`);
  }

  /**
   * Get metadata for tool registry compatibility
   * @returns {Object} Node metadata
   */
  getMetadata() {
    return {
      name: this.config.name || this.constructor.getTypeName(),
      description: this.config.description || `${this.constructor.getTypeName()} coordination node`,
      type: this.constructor.getTypeName(),
      children: this.children.length,
      parameters: this.config.parameters || {},
      domains: this.config.domains || [],
      specialist: false, // BT nodes are coordination tools, not specialists
      nodeId: this.id
    };
  }

  /**
   * Get the type name for this node - must be implemented by subclasses
   * @returns {string} Node type name
   */
  static getTypeName() {
    throw new Error('Subclasses must implement getTypeName() static method');
  }

  /**
   * Message handling system
   */

  /**
   * Send message to another node
   * @param {BehaviorTreeNode} to - Target node
   * @param {Object} message - Message payload
   */
  send(to, message) {
    this.messageBus.sendMessage(this, to, message);
  }

  /**
   * Send message to parent node
   * @param {Object} message - Message payload
   */
  sendToParent(message) {
    if (this.parent) {
      this.send(this.parent, message);
    }
  }

  /**
   * Send message to all children
   * @param {Object} message - Message payload
   */
  sendToChildren(message) {
    for (const child of this.children) {
      this.send(child, message);
    }
  }

  /**
   * Handle incoming messages - relationship-aware
   * @param {BehaviorTreeNode} from - Sender node
   * @param {Object} message - Message payload
   */
  handleMessage(from, message) {
    if (from === this.parent) {
      this.handleParentMessage(message);
    } else if (this.children.includes(from)) {
      this.handleChildMessage(from, message);
    } else {
      this.handlePeerMessage(from, message);
    }
  }

  /**
   * Handle message from parent - override in subclasses
   * @param {Object} message - Message payload
   */
  handleParentMessage(message) {
    // Default implementation - log for debugging
    if (this.config.debugMode) {
      console.log(`[${this.id}] Received parent message:`, message);
    }
  }

  /**
   * Handle message from child - override in subclasses  
   * @param {BehaviorTreeNode} child - Sender child node
   * @param {Object} message - Message payload
   */
  handleChildMessage(child, message) {
    // Default implementation - log for debugging
    if (this.config.debugMode) {
      console.log(`[${this.id}] Received child message from ${child.id}:`, message);
    }
  }

  /**
   * Handle message from peer - override in subclasses
   * @param {BehaviorTreeNode} peer - Sender peer node
   * @param {Object} message - Message payload
   */
  handlePeerMessage(peer, message) {
    // Default implementation - log for debugging
    if (this.config.debugMode) {
      console.log(`[${this.id}] Received peer message from ${peer.id}:`, message);
    }
  }

  /**
   * Child management
   */

  /**
   * Initialize children from configuration
   * @param {Array} childConfigs - Array of child configurations
   */
  initializeChildren(childConfigs) {
    for (const childConfig of childConfigs) {
      const child = this.createChild(childConfig);
      this.addChild(child);
    }
  }

  /**
   * Create child node from configuration
   * @param {Object} config - Child node configuration
   * @returns {BehaviorTreeNode} Created child node
   */
  createChild(config) {
    const child = this.executor.createNode(config);
    child.parent = this;
    return child;
  }

  /**
   * Add child node
   * @param {BehaviorTreeNode} child - Child node to add
   */
  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  /**
   * Remove child node
   * @param {BehaviorTreeNode} child - Child node to remove
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  /**
   * Remove child by index
   * @param {number} index - Child index
   */
  removeChildAt(index) {
    if (index >= 0 && index < this.children.length) {
      const child = this.children[index];
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  /**
   * Clear all children
   */
  clearChildren() {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children = [];
  }

  /**
   * Execute child node
   * @param {number} index - Child index
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Child execution result
   */
  async executeChild(index, context) {
    if (index < 0 || index >= this.children.length) {
      throw new Error(`Child index ${index} out of range`);
    }
    
    return await this.children[index].execute(context);
  }

  /**
   * Execute all children in parallel
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Array of child results
   */
  async executeAllChildren(context) {
    const promises = this.children.map(child => child.execute(context));
    return await Promise.all(promises);
  }

  /**
   * Utility methods
   */

  /**
   * Generate unique node ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `${this.constructor.getTypeName()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if node is a leaf (no children)
   * @returns {boolean} True if leaf node
   */
  isLeaf() {
    return this.children.length === 0;
  }

  /**
   * Get all descendant nodes
   * @returns {Array<BehaviorTreeNode>} All descendant nodes
   */
  getAllDescendants() {
    const descendants = [];
    
    for (const child of this.children) {
      descendants.push(child);
      descendants.push(...child.getAllDescendants());
    }
    
    return descendants;
  }

  /**
   * Get path from root to this node
   * @returns {Array<BehaviorTreeNode>} Path from root
   */
  getPathFromRoot() {
    const path = [];
    let current = this;
    
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Parameter resolution with context substitution
   * @param {Object} params - Parameters with potential placeholders
   * @param {Object} context - Execution context
   * @returns {Object} Resolved parameters
   */
  resolveParams(params, context) {
    if (!params) return {};
    
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // Simple template substitution
        resolved[key] = this.substitutePlaceholders(value, context);
      } else if (Array.isArray(value)) {
        // Handle arrays with potential placeholders
        resolved[key] = value.map(item => 
          typeof item === 'string' && item.includes('{{') 
            ? this.substitutePlaceholders(item, context)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParams(value, context);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Simple placeholder substitution
   * @param {string} template - Template string with {{placeholder}} syntax
   * @param {Object} context - Context for substitution
   * @returns {string} Resolved string
   */
  substitutePlaceholders(template, context) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path.trim());
      return value !== undefined ? value : match;
    });
  }

  /**
   * Get nested value from object by path
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Stop execution if running
    this.isRunning = false;
    
    // Cleanup children
    for (const child of this.children) {
      if (child.cleanup) {
        await child.cleanup();
      }
    }
    
    // Clear references
    this.parent = null;
    this.children = [];
    this.context = {};
  }
}