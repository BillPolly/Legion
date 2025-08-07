/**
 * BehaviorTreeExecutor - Replaces PlanExecutor with tree execution capabilities
 * 
 * Key features:
 * - Pluggable node architecture with dynamic loading
 * - Tree execution with message-passing coordination  
 * - Integration with ToolRegistry for tool access
 * - Built-in coordination patterns (sequence, parallel, selector)
 */

import { MessageBus } from './MessageBus.js';
import { BehaviorTreeNode, NodeStatus } from './BehaviorTreeNode.js';
import { ActionNode } from '../nodes/ActionNode.js';
import { SequenceNode } from '../nodes/SequenceNode.js';
import { SelectorNode } from '../nodes/SelectorNode.js';
import { RetryNode } from '../nodes/RetryNode.js';
import { ConditionNode } from '../nodes/ConditionNode.js';

export class BehaviorTreeExecutor {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.messageBus = new MessageBus();
    this.nodeTypes = new Map();
    this.executionContext = {};
    
    // Register built-in node types
    this.registerBuiltinNodes();
  }

  /**
   * Execute a behavior tree from configuration
   * @param {Object} treeConfig - Tree configuration object
   * @param {Object} context - Initial execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeTree(treeConfig, context = {}) {
    try {
      // Create root node from configuration
      const rootNode = this.createNode(treeConfig);
      
      // Set up execution context
      const executionContext = {
        ...context,
        startTime: Date.now(),
        treeConfig,
        artifacts: context.artifacts || {}
      };

      // Execute the tree
      const result = await rootNode.execute(executionContext);
      
      return {
        success: result.status === NodeStatus.SUCCESS,
        status: result.status,
        data: result.data,
        context: executionContext,
        executionTime: Date.now() - executionContext.startTime,
        nodeResults: result.nodeResults || {}
      };
    } catch (error) {
      return {
        success: false,
        status: NodeStatus.FAILURE,
        error: error.message,
        data: { errorMessage: error.message, stackTrace: error.stack },
        context,
        executionTime: Date.now() - (context.startTime || Date.now())
      };
    }
  }

  /**
   * Create node instance from configuration
   * @param {Object} config - Node configuration
   * @returns {BehaviorTreeNode} Created node instance
   */
  createNode(config) {
    const nodeType = config.type;
    
    if (!nodeType) {
      throw new Error('Node configuration must specify type');
    }

    const NodeClass = this.nodeTypes.get(nodeType);
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${nodeType}. Available types: ${Array.from(this.nodeTypes.keys()).join(', ')}`);
    }

    return new NodeClass(config, this.toolRegistry, this);
  }

  /**
   * Register a node type
   * @param {string} typeName - Type identifier
   * @param {Class} NodeClass - Node class constructor
   */
  registerNodeType(typeName, NodeClass) {
    // Validate node class
    if (!NodeClass.getTypeName || typeof NodeClass.getTypeName !== 'function') {
      throw new Error(`Node class for ${typeName} must implement static getTypeName() method`);
    }

    if (NodeClass.getTypeName() !== typeName) {
      throw new Error(`[BehaviorTreeExecutor] FATAL: Type name mismatch - registering '${typeName}' but node class returns '${NodeClass.getTypeName()}'. Node types must be consistent!`);
    }

    this.nodeTypes.set(typeName, NodeClass);
    
    if (this.debugMode) {
      console.log(`[BehaviorTreeExecutor] Registered node type: ${typeName}`);
    }
  }

  /**
   * Unregister a node type
   * @param {string} typeName - Type identifier
   */
  unregisterNodeType(typeName) {
    this.nodeTypes.delete(typeName);
  }

  /**
   * Get list of available node types
   * @returns {Array<string>} Available node type names
   */
  getAvailableNodeTypes() {
    return Array.from(this.nodeTypes.keys());
  }

  /**
   * Get node type metadata
   * @param {string} typeName - Node type name
   * @returns {Object|null} Node type metadata
   */
  getNodeTypeMetadata(typeName) {
    const NodeClass = this.nodeTypes.get(typeName);
    if (!NodeClass) return null;

    return {
      typeName,
      className: NodeClass.name,
      description: NodeClass.description || `${typeName} coordination node`
    };
  }

  /**
   * Register built-in node types
   */
  registerBuiltinNodes() {
    // Register actual node implementations
    this.registerNodeType('action', ActionNode);
    this.registerNodeType('sequence', SequenceNode);
    this.registerNodeType('selector', SelectorNode);
    this.registerNodeType('retry', RetryNode);
    this.registerNodeType('condition', ConditionNode);
    
    // Register placeholder classes for nodes not yet implemented
    const placeholderTypes = [
      'parallel',
      'llm-decision'
    ];

    for (const type of placeholderTypes) {
      // Register placeholder for future implementations
      this.nodeTypes.set(type, this.createPlaceholderNodeClass(type));
    }
  }

  /**
   * Create placeholder node class for development
   * @param {string} typeName - Node type name
   * @returns {Class} Placeholder node class
   */
  createPlaceholderNodeClass(typeName) {
    return class extends BehaviorTreeNode {
      static getTypeName() {
        return typeName;
      }

      async executeNode(context) {
        console.log(`[${typeName}] Placeholder execution with context:`, Object.keys(context));
        
        // Simple placeholder behavior based on type
        if (typeName === 'action') {
          // Action nodes execute tools
          const toolName = this.config.tool;
          if (toolName && this.toolRegistry) {
            try {
              const tool = await this.toolRegistry.getTool(toolName);
              if (tool) {
                const params = this.resolveParams(this.config.params || {}, context);
                const result = await tool.execute(params);
                
                return {
                  status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
                  data: result.data,
                  toolResult: result
                };
              }
            } catch (error) {
              return {
                status: NodeStatus.FAILURE,
                data: { error: error.message }
              };
            }
          }
          
          return {
            status: NodeStatus.SUCCESS,
            data: { message: `Placeholder ${typeName} executed` }
          };
        }
        
        if (typeName === 'sequence') {
          // Execute children in sequence
          const results = [];
          for (let i = 0; i < this.children.length; i++) {
            const result = await this.executeChild(i, context);
            results.push(result);
            
            if (result.status === NodeStatus.FAILURE) {
              return {
                status: NodeStatus.FAILURE,
                data: { failedAt: i, results }
              };
            }
          }
          
          return {
            status: NodeStatus.SUCCESS,
            data: { results }
          };
        }

        return {
          status: NodeStatus.SUCCESS,
          data: { message: `Placeholder ${typeName} completed` }
        };
      }
    };
  }

  /**
   * Load custom node types from directory
   * @param {string} directory - Directory path containing node modules
   */
  async loadCustomNodeTypes(directory) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const files = await fs.readdir(directory);
      const nodeFiles = files.filter(f => f.endsWith('.js'));

      for (const file of nodeFiles) {
        try {
          const filePath = path.join(directory, file);
          const module = await import(filePath);
          
          // Look for exported node classes
          for (const [exportName, exportValue] of Object.entries(module)) {
            if (exportValue && 
                typeof exportValue === 'function' && 
                exportValue.getTypeName && 
                exportValue.prototype instanceof BehaviorTreeNode) {
              
              const typeName = exportValue.getTypeName();
              this.registerNodeType(typeName, exportValue);
              
              if (this.debugMode) {
                console.log(`[BehaviorTreeExecutor] Loaded custom node: ${typeName} from ${file}`);
              }
            }
          }
        } catch (error) {
          console.warn(`[BehaviorTreeExecutor] Failed to load node file ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`[BehaviorTreeExecutor] Failed to load custom nodes from ${directory}:`, error.message);
    }
  }

  /**
   * Validate tree configuration
   * @param {Object} treeConfig - Tree configuration to validate
   * @returns {Object} Validation result
   */
  validateTreeConfiguration(treeConfig) {
    const errors = [];
    const warnings = [];

    try {
      this.validateNodeConfiguration(treeConfig, errors, warnings);
    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Recursively validate node configuration
   * @param {Object} nodeConfig - Node configuration
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  validateNodeConfiguration(nodeConfig, errors, warnings) {
    // Check required fields
    if (!nodeConfig.type) {
      errors.push('Node configuration must specify type');
      return;
    }

    // Check if node type exists
    if (!this.nodeTypes.has(nodeConfig.type)) {
      errors.push(`Unknown node type: ${nodeConfig.type}`);
      return;
    }

    // Validate action nodes have tool reference
    if (nodeConfig.type === 'action') {
      if (!nodeConfig.tool) {
        errors.push('Action nodes must specify tool');
      } else {
        // Check if tool exists in registry
        if (this.toolRegistry && !this.toolRegistry.hasTool(nodeConfig.tool)) {
          errors.push(`Tool '${nodeConfig.tool}' not found in registry`);
        }
      }
    }

    // Recursively validate children
    if (nodeConfig.children) {
      if (!Array.isArray(nodeConfig.children)) {
        errors.push('Node children must be an array');
      } else {
        for (const child of nodeConfig.children) {
          this.validateNodeConfiguration(child, errors, warnings);
        }
      }
    }

    // Validate specific node type requirements
    this.validateNodeTypeSpecific(nodeConfig, errors, warnings);
  }

  /**
   * Validate node-type-specific requirements
   * @param {Object} nodeConfig - Node configuration
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  validateNodeTypeSpecific(nodeConfig, errors, warnings) {
    const { type } = nodeConfig;

    switch (type) {
      case 'parallel':
        if (!nodeConfig.successPolicy) {
          warnings.push('Parallel node should specify successPolicy (all/any)');
        }
        break;
        
      case 'retry':
        if (!nodeConfig.maxAttempts || nodeConfig.maxAttempts < 1) {
          errors.push('Retry node must specify maxAttempts > 0');
        }
        break;
        
      case 'condition':
        if (!nodeConfig.check) {
          errors.push('Condition node must specify check expression');
        }
        break;
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} Executor statistics
   */
  getStats() {
    return {
      registeredNodeTypes: this.nodeTypes.size,
      availableNodeTypes: this.getAvailableNodeTypes(),
      messageBusStatus: this.messageBus.getQueueStatus()
    };
  }

  /**
   * Shutdown executor and clean up resources
   */
  async shutdown() {
    await this.messageBus.shutdown();
    this.nodeTypes.clear();
    this.executionContext = {};
  }
}