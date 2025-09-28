/**
 * BehaviorTreeExecutor - Compatibility wrapper for actor-BT migration
 * 
 * Wraps BTExecutor to provide the same interface as actor-BT's BehaviorTreeExecutor.
 * Extends EventEmitter for compatibility with existing code that uses events.
 */

import { EventEmitter } from 'events';
import { BTExecutor } from '../core/BTExecutor.js';
import { NodeStatus, taskStatusToNodeStatus } from './NodeStatus.js';

// Import node classes for registration
import { ActionNode } from './nodes/ActionNode.js';
import { SequenceNode } from './nodes/SequenceNode.js';
import { SelectorNode } from './nodes/SelectorNode.js';
import { ConditionNode } from './nodes/ConditionNode.js';
import { RetryNode } from './nodes/RetryNode.js';

/**
 * MessageBus compatibility stub
 */
export class MessageBus extends EventEmitter {
  publish(type, data) {
    this.emit(type, data);
  }
  
  subscribe(type, handler) {
    this.on(type, handler);
    return () => this.off(type, handler);
  }
}

/**
 * BehaviorTreeExecutor compatibility wrapper
 */
export class BehaviorTreeExecutor extends EventEmitter {
  constructor(toolRegistry, options = {}) {
    super();
    this.toolRegistry = toolRegistry;
    this.messageBus = new MessageBus();
    this.nodeTypes = new Map();
    this.executionContext = {};
    this.options = options;
    
    // Create internal BTExecutor
    this._btExecutor = new BTExecutor(toolRegistry);
    
    // Register built-in node types
    this.registerBuiltinNodes();
  }

  /**
   * Register built-in node types for compatibility
   */
  registerBuiltinNodes() {
    this.registerNodeType('action', ActionNode);
    this.registerNodeType('sequence', SequenceNode);
    this.registerNodeType('selector', SelectorNode);
    this.registerNodeType('condition', ConditionNode);
    this.registerNodeType('retry', RetryNode);
  }

  /**
   * Register a custom node type
   */
  registerNodeType(type, NodeClass) {
    this.nodeTypes.set(type, NodeClass);
  }

  /**
   * Get available node types
   */
  getAvailableNodeTypes() {
    return Array.from(this.nodeTypes.keys());
  }

  /**
   * Execute a behavior tree from configuration
   * Compatible with actor-BT interface
   */
  async executeTree(treeConfig, context = {}) {
    const startTime = Date.now();
    
    try {
      // Emit start event for compatibility
      this.emit('tree:start', {
        treeId: treeConfig.id || 'unknown',
        treeName: treeConfig.name || 'Behavior Tree',
        nodeCount: this.countNodes(treeConfig),
        startTime
      });
      
      // Execute using BTExecutor
      const result = await this._btExecutor.executeTree(treeConfig, context);
      
      // Convert result to actor-BT format
      const btResult = {
        status: taskStatusToNodeStatus(result.status),
        data: result.context?.artifacts || {},
        nodeResults: result.nodeResults || {},
        executionTime: Date.now() - startTime,
        context: result.context
      };
      
      // Emit completion event
      this.emit('tree:complete', {
        treeId: treeConfig.id || 'unknown',
        status: btResult.status,
        executionTime: btResult.executionTime,
        nodeResults: btResult.nodeResults
      });
      
      return btResult;
      
    } catch (error) {
      // Emit error event
      this.emit('tree:error', {
        treeId: treeConfig.id || 'unknown',
        error: error.message,
        executionTime: Date.now() - startTime
      });
      
      return {
        status: NodeStatus.FAILURE,
        error: error.message,
        data: {},
        nodeResults: {},
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create a node from configuration
   * This method provides compatibility for code that directly creates nodes
   */
  async createNode(nodeConfig) {
    const nodeType = nodeConfig.type || this.inferNodeType(nodeConfig);
    const NodeClass = this.nodeTypes.get(nodeType);
    
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    
    const node = new NodeClass(nodeConfig, this.toolRegistry, this);
    
    // Initialize children if present
    if (nodeConfig.children && nodeConfig.children.length > 0) {
      await node.initializeChildren(nodeConfig.children);
    }
    
    return node;
  }

  /**
   * Infer node type from configuration
   */
  inferNodeType(config) {
    if (config.tool) return 'action';
    if (config.condition) return 'condition';
    if (config.maxAttempts) return 'retry';
    if (config.children) return 'sequence';
    return 'action';
  }

  /**
   * Count total nodes in tree configuration
   */
  countNodes(config) {
    let count = 1;
    if (config.children && Array.isArray(config.children)) {
      for (const child of config.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Attach observability to a node (compatibility method)
   */
  attachObservabilityToNode(node, observabilityContext) {
    // This is a stub for compatibility
    // The actual observability is handled by the BTExecutor
    if (observabilityContext && observabilityContext.onNodeExecution) {
      const originalExecute = node.execute.bind(node);
      node.execute = async (context) => {
        observabilityContext.onNodeExecution({
          nodeId: node.id,
          nodeType: node.constructor.name,
          timestamp: Date.now()
        });
        return originalExecute(context);
      };
    }
  }
}