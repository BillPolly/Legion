/**
 * BehaviorTreeExecutor - Replaces PlanExecutor with tree execution capabilities
 * 
 * Key features:
 * - Pluggable node architecture with dynamic loading
 * - Tree execution with message-passing coordination  
 * - Integration with ToolRegistry for tool access
 * - Built-in coordination patterns (sequence, parallel, selector)
 * - EventEmitter interface for progress tracking and status updates
 */

import { EventEmitter } from 'events';
import { MessageBus } from './MessageBus.js';
import { BehaviorTreeNode, NodeStatus } from './BehaviorTreeNode.js';
import { ActionNode } from '../nodes/ActionNode.js';
import { SequenceNode } from '../nodes/SequenceNode.js';
import { SelectorNode } from '../nodes/SelectorNode.js';
import { RetryNode } from '../nodes/RetryNode.js';
import { ConditionNode } from '../nodes/ConditionNode.js';

export class BehaviorTreeExecutor extends EventEmitter {
  constructor(toolRegistry) {
    super();
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
    const startTime = Date.now();
    
    try {
      // Emit start event
      this.emit('tree:start', {
        treeId: treeConfig.id || 'unknown',
        treeName: treeConfig.name || 'Behavior Tree',
        nodeCount: this.countNodes(treeConfig),
        startTime
      });
      
      // Create root node from configuration
      console.log('[BT] Creating root node from config:', treeConfig.type || 'inferred', 'id:', treeConfig.id);
      const rootNode = await this.createNode(treeConfig);
      console.log('[BT] Root node created successfully:', rootNode.constructor.name);
      
      // DEBUG: Check node structure
      if (rootNode.children && rootNode.children.length > 0) {
        console.log('[BT] Root node children count:', rootNode.children.length);
        console.log('[BT] First child:', {
          type: rootNode.children[0].constructor.name,
          id: rootNode.children[0].id,
          hasChildren: rootNode.children[0].children ? rootNode.children[0].children.length : 0
        });
      } else if (!rootNode.children || rootNode.children.length === 0) {
        // This is fine - leaf nodes don't have children
        console.log('[BT] Root is a leaf node:', rootNode.constructor.name);
      }
      
      // Set up execution context with nodeResults tracking
      const executionContext = {
        ...context,
        startTime,
        treeConfig,
        artifacts: context.artifacts || {},
        nodeResults: {}  // Initialize nodeResults tracking
      };

      // If we have an observability context, add node execution tracking
      if (executionContext.observabilityContext) {
        this.attachObservabilityToNode(rootNode, executionContext.observabilityContext);
      }

      // Execute the tree
      console.log('[BT] Starting tree execution...');
      const result = await rootNode.execute(executionContext);
      
      // Merge nodeResults from context (accumulated during execution)
      const mergedNodeResults = {
        ...executionContext.nodeResults,
        ...(result.nodeResults || {})
      };
      
      console.log('[BT] Tree execution completed. Result:', {
        status: result.status,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        hasNodeResults: !!mergedNodeResults,
        nodeResultsCount: Object.keys(mergedNodeResults).length
      });
      
      const executionTime = Date.now() - startTime;
      
      // Emit completion event
      this.emit('tree:complete', {
        treeId: treeConfig.id || 'unknown',
        success: result.status === NodeStatus.SUCCESS,
        status: result.status,
        executionTime,
        nodeResults: mergedNodeResults
      });
      
      const finalResult = {
        success: result.status === NodeStatus.SUCCESS,
        status: result.status,
        data: result.data,
        artifacts: executionContext.artifacts || {},  // Include artifacts directly in result
        context: executionContext,
        executionTime,
        nodeResults: mergedNodeResults
      };
      
      // Propagate error field if present
      if (result.error) {
        finalResult.error = result.error;
      }
      
      return finalResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Emit error event
      this.emit('tree:error', {
        treeId: treeConfig?.id || 'unknown',
        error: error.message,
        executionTime,
        stackTrace: error.stack
      });
      
      return {
        success: false,
        status: NodeStatus.FAILURE,
        error: error.message,
        data: { errorMessage: error.message, stackTrace: error.stack },
        context: context || {},
        executionTime
      };
    }
  }

  /**
   * Count total nodes in a tree configuration (for progress tracking)
   * @param {Object} treeConfig - Tree configuration
   * @returns {number} Total node count
   */
  countNodes(treeConfig) {
    if (!treeConfig) return 0;
    
    let count = 1; // Count the current node
    
    // Count children recursively
    if (treeConfig.children && Array.isArray(treeConfig.children)) {
      for (const child of treeConfig.children) {
        count += this.countNodes(child);
      }
    }
    
    return count;
  }

  /**
   * Attach observability to a node and its children
   * @param {BehaviorTreeNode} node - Node to instrument
   * @param {ObservabilityContext} obsContext - Observability context
   */
  attachObservabilityToNode(node, obsContext) {
    if (!node || !obsContext) return;

    // Wrap the node's execute method
    const originalExecute = node.execute.bind(node);
    
    node.execute = async (context) => {
      const nodeType = node.config?.type || 'unknown';
      const nodeName = node.config?.name || nodeType;
      
      // Add event for node start
      obsContext.addEvent('bt:node:start', {
        type: nodeType,
        name: nodeName,
        hasChildren: node.children?.length > 0
      });
      
      const startTime = Date.now();
      
      try {
        const result = await originalExecute(context);
        
        // Add event for node completion
        obsContext.addEvent('bt:node:complete', {
          type: nodeType,
          name: nodeName,
          status: result.status,
          duration: Date.now() - startTime
        });
        
        return result;
      } catch (error) {
        // Add event for node error
        obsContext.addEvent('bt:node:error', {
          type: nodeType,
          name: nodeName,
          error: error.message,
          duration: Date.now() - startTime
        });
        
        throw error;
      }
    };

    // Recursively attach to children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.attachObservabilityToNode(child, obsContext);
      }
    }
  }

  /**
   * Create node instance from configuration
   * @param {Object} config - Node configuration
   * @returns {BehaviorTreeNode} Created node instance
   */
  async createNode(config) {
    let nodeType = config.type;
    
    console.log('[BT] createNode called with config:', {
      id: config.id,
      type: config.type,
      hasChildren: !!(config.children && config.children.length > 0),
      hasTool: !!config.tool,
      hasChild: !!config.child
    });
    
    // Apply default node type logic
    if (!nodeType) {
      // If no type specified, infer from structure
      if (config.children && config.children.length > 0) {
        // Has children -> default to sequence
        nodeType = 'sequence';
        console.log('[BT] Inferred node type as sequence (has children)');
      } else if (config.tool) {
        // Has tool -> default to action (leaf node)
        nodeType = 'action';
        console.log('[BT] Inferred node type as action (has tool)');
      } else {
        console.error('[BT] Cannot infer node type for config:', config);
        throw new Error('Node configuration must specify type or have children/tool');
      }
    } else {
      console.log('[BT] Using explicit node type:', nodeType);
    }

    // For action nodes, bind the tool instance immediately
    if (nodeType === 'action' && config.tool) {
      // Look up the tool from registry and attach it to config
      const tool = this.toolRegistry ? await this.toolRegistry.getTool(config.tool) : null;
      if (!tool) {
        throw new Error(`Tool '${config.tool}' not found in registry`);
      }
      config.toolInstance = tool;
    }

    const NodeClass = this.nodeTypes.get(nodeType);
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${nodeType}. Available types: ${Array.from(this.nodeTypes.keys()).join(', ')}`);
    }

    const node = new NodeClass(config, this.toolRegistry, this);
    
    // Initialize children if provided
    if (config.children && config.children.length > 0) {
      console.log(`[BT] Initializing ${config.children.length} children for node ${config.id}`);
      await node.initializeChildren(config.children);
      console.log(`[BT] Children initialized for node ${config.id}, children count: ${node.children.length}`);
    } else if (config.child) {
      // For retry nodes with single child
      console.log(`[BT] Initializing single child for node ${config.id}`);
      const child = await node.createChild(config.child);
      node.addChild(child);
      console.log(`[BT] Single child initialized for node ${config.id}, children count: ${node.children.length}`);
    }

    return node;
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
        // Check if tool exists in registry (skip check for async registry)
        // Tool availability will be checked during execution
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