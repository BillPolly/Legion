/**
 * BehaviorTreeNode - Compatibility wrapper for actor-BT migration
 * 
 * Provides a class-based interface that wraps bt-task's strategy-based approach.
 * This allows existing code that extends BehaviorTreeNode to work with bt-task.
 */

import { createBTTask } from '../factory/createBTTask.js';
import { NodeStatus, taskStatusToNodeStatus } from './NodeStatus.js';

/**
 * Base class for behavior tree nodes - compatibility layer
 * Wraps bt-task strategies in a class interface
 */
export class BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    this.config = config || {};
    this.toolRegistry = toolRegistry;
    this.executor = executor;
    this.messageBus = executor?.messageBus || null;
    
    // Tree structure
    this.parent = null;
    this.children = [];
    this.id = config?.id || this.generateId();
    
    // Node state
    this.status = null;
    this.context = {};
    this.isRunning = false;
    
    // Internal task reference will be created on demand
    this._btTask = null;
  }

  /**
   * Generate a unique ID for the node
   */
  generateId() {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Main execution interface - compatible with actor-BT
   * @param {Object} input - Execution context and parameters
   * @returns {Promise<Object>} Execution result
   */
  async execute(input) {
    try {
      this.isRunning = true;
      this.context = { ...input };
      
      // Execute the node implementation
      const result = await this.executeNode(this.context);
      
      // Convert result to actor-BT format
      this.status = result.status || NodeStatus.SUCCESS;
      this.isRunning = false;
      
      // Store result in context's nodeResults if tracking
      if (this.context.nodeResults) {
        this.context.nodeResults[this.id] = {
          status: this.status,
          data: result.data,
          error: result.error
        };
      }
      
      return {
        status: this.status,
        data: result.data || {},
        error: result.error,
        nodeResults: this.context.nodeResults
      };
      
    } catch (error) {
      this.status = NodeStatus.FAILURE;
      this.isRunning = false;
      
      if (this.context.nodeResults) {
        this.context.nodeResults[this.id] = {
          status: NodeStatus.FAILURE,
          error: error.message
        };
      }
      
      return {
        status: NodeStatus.FAILURE,
        error: error.message,
        nodeResults: this.context.nodeResults
      };
    }
  }

  /**
   * Execute the node logic - to be overridden by subclasses
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeNode(context) {
    // Default implementation - should be overridden
    return {
      status: NodeStatus.SUCCESS,
      data: {}
    };
  }

  /**
   * Get metadata for the node (tool-compatible interface)
   */
  getMetadata() {
    return {
      name: this.config.name || this.constructor.name,
      description: this.config.description || 'Behavior tree node',
      type: this.config.type || 'node'
    };
  }

  /**
   * Initialize children from configuration
   */
  async initializeChildren(childConfigs = []) {
    if (!childConfigs || childConfigs.length === 0) {
      return;
    }
    
    for (const childConfig of childConfigs) {
      const childNode = await this.executor.createNode(childConfig);
      this.addChild(childNode);
    }
  }

  /**
   * Add a child node
   */
  addChild(node) {
    if (node) {
      node.parent = this;
      this.children.push(node);
    }
  }

  /**
   * Remove a child node
   */
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index > -1) {
      this.children.splice(index, 1);
      node.parent = null;
    }
  }

  /**
   * Reset node state
   */
  reset() {
    this.status = null;
    this.isRunning = false;
    this.context = {};
    
    // Reset all children
    for (const child of this.children) {
      if (child.reset) {
        child.reset();
      }
    }
  }

  /**
   * Resolve parameters with artifact references (@ syntax)
   */
  resolveParams(params, context) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // Resolve artifact reference
        const path = value.substring(1).split('.');
        let current = context.artifacts || {};
        
        for (const segment of path) {
          if (current && typeof current === 'object') {
            current = current[segment];
            // Handle artifact wrapper structure
            if (current && current.value !== undefined) {
              current = current.value;
            }
          } else {
            break;
          }
        }
        
        resolved[key] = current;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveParams(value, context);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Send a message through the message bus (if available)
   */
  sendMessage(type, data) {
    if (this.messageBus) {
      this.messageBus.publish(type, {
        nodeId: this.id,
        ...data
      });
    }
  }

  /**
   * Subscribe to messages on the message bus
   */
  subscribeToMessages(type, handler) {
    if (this.messageBus) {
      return this.messageBus.subscribe(type, handler);
    }
    return null;
  }
}