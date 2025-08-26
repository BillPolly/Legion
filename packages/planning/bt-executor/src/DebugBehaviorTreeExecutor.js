/**
 * DebugBehaviorTreeExecutor - Extended executor with debugging capabilities
 * 
 * Key features:
 * - Step-through execution mode
 * - Breakpoint support
 * - Execution state inspection
 * - Pause/resume capability
 * - Detailed execution history
 */

import { EventEmitter } from 'events';
import { NodeStatus } from '@legion/actor-bt';

export class DebugBehaviorTreeExecutor extends EventEmitter {
  constructor(toolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
    this.nodeTypes = new Map();
    this.executionContext = {};
    
    // Debug-specific state
    this.executionMode = 'step'; // 'step', 'run', 'paused'
    this.breakpoints = new Set(); // Node IDs with breakpoints
    this.executionHistory = [];
    this.currentNode = null;
    this.executionStack = []; // Stack of nodes being executed
    this.nodeStates = new Map(); // Node ID -> status
    this.isPaused = false;
    this.stepResolver = null; // Promise resolver for step mode
    this.tree = null;
    this.rootNode = null;
    
    // Register built-in node types
    this.registerBuiltinNodes();
  }

  /**
   * Initialize tree for debug execution
   * @param {Object} treeConfig - Tree configuration object
   * @param {Object} context - Initial execution context
   */
  async initializeTree(treeConfig, context = {}) {
    this.tree = treeConfig;
    this.executionContext = { ...context, artifacts: context.artifacts || {} };
    this.executionHistory = [];
    this.nodeStates.clear();
    this.executionStack = [];
    
    // Create root node from configuration
    this.rootNode = await this.createNode(treeConfig);
    
    // Set current node to root for first step
    this.currentNode = this.rootNode;
    
    // Initialize all node states to pending
    this.initializeNodeStates(this.rootNode);
    
    // Emit initialization event
    this.emit('tree:initialized', {
      treeId: treeConfig.id || 'unknown',
      nodeCount: this.countNodes(treeConfig),
      mode: this.executionMode
    });
    
    return {
      success: true,
      treeId: treeConfig.id,
      nodeCount: this.countNodes(treeConfig)
    };
  }

  /**
   * Start or continue execution based on mode
   */
  async execute() {
    if (!this.rootNode) {
      throw new Error('Tree not initialized. Call initializeTree first.');
    }
    
    if (this.executionMode === 'step') {
      return await this.stepNext();
    } else if (this.executionMode === 'run') {
      return await this.runToCompletion();
    }
  }

  /**
   * Execute next node in step mode
   */
  async stepNext() {
    if (!this.rootNode) {
      throw new Error('Tree not initialized');
    }
    
    // If we're starting fresh
    if (!this.currentNode) {
      this.currentNode = this.rootNode;
      this.executionStack = [this.rootNode];
    }
    
    // Execute current node
    const node = this.currentNode;
    const nodeId = node.config?.id || node.id;
    const nodeType = node.config?.type || 'unknown';
    
    // Emit step event
    this.emit('node:step', {
      nodeId,
      nodeType,
      nodeName: node.config?.name || nodeId,
      depth: this.executionStack.length
    });
    
    // Update node state to running
    this.nodeStates.set(nodeId, 'running');
    this.emit('node:state', { nodeId, state: 'running' });
    
    try {
      // For composite nodes (sequence, selector, retry), don't execute them directly
      // Just navigate to their children
      if (['sequence', 'selector', 'retry'].includes(nodeType)) {
        // Mark composite node as running
        this.nodeStates.set(nodeId, 'running');
        
        // Find first child to execute
        let childToExecute = null;
        
        if (nodeType === 'retry' && node.child) {
          // Retry nodes have a single child
          childToExecute = node.child;
        } else if (node.children && node.children.length > 0) {
          // Find first pending child
          for (const child of node.children) {
            const childId = child.config?.id || child.id;
            if (this.nodeStates.get(childId) === 'pending') {
              childToExecute = child;
              break;
            }
          }
        }
        
        if (childToExecute) {
          this.currentNode = childToExecute;
          this.executionStack.push(childToExecute);
          return {
            complete: false,
            currentNode: childToExecute.config?.id,
            lastResult: { status: NodeStatus.SUCCESS }
          };
        } else {
          // All children processed, determine composite node status
          const compositeStatus = this.determineCompositeStatus(node);
          this.nodeStates.set(nodeId, compositeStatus === NodeStatus.SUCCESS ? 'success' : 'failure');
          
          // Move to next
          this.currentNode = this.getNextNode(node, compositeStatus);
          if (this.currentNode) {
            return {
              complete: false,
              currentNode: this.currentNode.config?.id,
              lastResult: { status: compositeStatus }
            };
          } else {
            return {
              complete: true,
              success: compositeStatus === NodeStatus.SUCCESS,
              history: this.executionHistory
            };
          }
        }
      }
      
      // Execute action or condition nodes
      const result = await this.executeNode(node);
      
      // Update node state based on result
      const finalState = result.status === NodeStatus.SUCCESS ? 'success' : 
                         result.status === NodeStatus.FAILURE ? 'failure' : 'running';
      this.nodeStates.set(nodeId, finalState);
      
      // Add to history
      this.executionHistory.push({
        nodeId,
        nodeType: node.config?.type,
        status: result.status,
        timestamp: Date.now(),
        result: result.data
      });
      
      // Emit completion event
      this.emit('node:complete', {
        nodeId,
        status: result.status,
        data: result.data,
        state: finalState
      });
      
      // Determine next node
      this.currentNode = this.getNextNode(node, result.status);
      
      if (!this.currentNode) {
        // Execution complete
        this.emit('tree:complete', {
          success: result.status === NodeStatus.SUCCESS,
          history: this.executionHistory
        });
        return {
          complete: true,
          success: result.status === NodeStatus.SUCCESS,
          history: this.executionHistory
        };
      }
      
      this.executionStack = this.buildExecutionStack(this.currentNode);
      
      return {
        complete: false,
        currentNode: this.currentNode.config?.id,
        lastResult: result
      };
      
    } catch (error) {
      this.nodeStates.set(nodeId, 'error');
      this.emit('node:error', {
        nodeId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Determine status of composite node based on children
   */
  determineCompositeStatus(node) {
    const nodeType = node.config?.type;
    const children = node.children || [];
    
    if (nodeType === 'sequence') {
      // All must succeed
      for (const child of children) {
        const childId = child.config?.id || child.id;
        const childState = this.nodeStates.get(childId);
        if (childState === 'failure') return NodeStatus.FAILURE;
      }
      return NodeStatus.SUCCESS;
    } else if (nodeType === 'selector') {
      // Any must succeed
      for (const child of children) {
        const childId = child.config?.id || child.id;
        const childState = this.nodeStates.get(childId);
        if (childState === 'success') return NodeStatus.SUCCESS;
      }
      return NodeStatus.FAILURE;
    }
    
    return NodeStatus.SUCCESS;
  }
  
  /**
   * Build execution stack for current node
   */
  buildExecutionStack(node) {
    const stack = [];
    let current = node;
    while (current) {
      stack.unshift(current);
      current = current.parent;
    }
    return stack;
  }

  /**
   * Run execution to completion (with breakpoint support)
   */
  async runToCompletion() {
    this.executionMode = 'run';
    let result;
    
    while (true) {
      // Check for breakpoint
      if (this.currentNode && this.breakpoints.has(this.currentNode.config?.id)) {
        this.executionMode = 'paused';
        this.emit('breakpoint:hit', {
          nodeId: this.currentNode.config?.id,
          nodeName: this.currentNode.config?.name
        });
        
        // Wait for resume
        await this.waitForResume();
      }
      
      // Check if paused
      if (this.isPaused) {
        await this.waitForResume();
      }
      
      // Execute next step
      result = await this.stepNext();
      
      if (result.complete) {
        break;
      }
    }
    
    return result;
  }

  /**
   * Pause execution
   */
  pause() {
    this.isPaused = true;
    this.executionMode = 'paused';
    this.emit('execution:paused');
  }

  /**
   * Resume execution
   */
  resume() {
    this.isPaused = false;
    const previousMode = this.executionMode;
    this.executionMode = 'run';
    
    if (this.stepResolver) {
      this.stepResolver();
      this.stepResolver = null;
    }
    
    this.emit('execution:resumed', { mode: this.executionMode });
  }

  /**
   * Reset execution state
   */
  reset() {
    this.currentNode = null;
    this.executionStack = [];
    this.executionHistory = [];
    this.nodeStates.clear();
    this.isPaused = false;
    
    if (this.rootNode) {
      this.initializeNodeStates(this.rootNode);
    }
    
    this.emit('execution:reset');
  }

  /**
   * Set execution mode
   */
  setMode(mode) {
    if (!['step', 'run'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.executionMode = mode;
    this.emit('mode:changed', { mode });
  }

  /**
   * Add breakpoint to node
   */
  addBreakpoint(nodeId) {
    this.breakpoints.add(nodeId);
    this.emit('breakpoint:added', { nodeId });
  }

  /**
   * Remove breakpoint from node
   */
  removeBreakpoint(nodeId) {
    this.breakpoints.delete(nodeId);
    this.emit('breakpoint:removed', { nodeId });
  }

  /**
   * Get current execution state
   */
  getExecutionState() {
    return {
      mode: this.executionMode,
      isPaused: this.isPaused,
      currentNode: this.currentNode?.config?.id || null,
      executionStack: this.executionStack.map(n => n.config?.id || n.id),
      nodeStates: Object.fromEntries(this.nodeStates),
      breakpoints: Array.from(this.breakpoints),
      history: this.executionHistory,
      context: this.executionContext
    };
  }

  /**
   * Get node state
   */
  getNodeState(nodeId) {
    return this.nodeStates.get(nodeId) || 'pending';
  }

  /**
   * Wait for resume signal
   */
  async waitForResume() {
    return new Promise(resolve => {
      this.stepResolver = resolve;
    });
  }

  /**
   * Initialize node states recursively
   */
  initializeNodeStates(node) {
    if (!node) return;
    
    const nodeId = node.config?.id || node.id;
    this.nodeStates.set(nodeId, 'pending');
    
    // Initialize children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.initializeNodeStates(child);
      }
    }
    
    // Initialize single child (for retry nodes)
    if (node.child) {
      this.initializeNodeStates(node.child);
    }
  }

  /**
   * Get next node to execute based on current node and result
   */
  getNextNode(currentNode, status) {
    const nodeType = currentNode.config?.type;
    const nodeId = currentNode.config?.id || currentNode.id;
    
    // Handle based on node type and status
    switch (nodeType) {
      case 'sequence':
        // Sequence: execute children in order, stop on failure
        if (status === NodeStatus.FAILURE) {
          // Sequence failed, move to parent's next sibling
          return this.getParentNextSibling(currentNode);
        }
        // Find next child to execute
        if (currentNode.children) {
          for (const child of currentNode.children) {
            const childId = child.config?.id || child.id;
            if (this.nodeStates.get(childId) === 'pending') {
              return child;
            }
          }
        }
        // All children complete, move to parent's next sibling
        return this.getParentNextSibling(currentNode);
        
      case 'selector':
        // Selector: try children until one succeeds
        if (status === NodeStatus.SUCCESS) {
          // Selector succeeded, move to parent's next sibling
          return this.getParentNextSibling(currentNode);
        }
        // Find next child to try
        if (currentNode.children) {
          for (const child of currentNode.children) {
            const childId = child.config?.id || child.id;
            if (this.nodeStates.get(childId) === 'pending') {
              return child;
            }
          }
        }
        // All children failed, move to parent's next sibling
        return this.getParentNextSibling(currentNode);
        
      case 'retry':
        // Retry: repeat child on failure up to maxAttempts
        const maxAttempts = currentNode.config?.maxAttempts || 3;
        const attempts = currentNode.attempts || 0;
        
        if (status === NodeStatus.FAILURE && attempts < maxAttempts - 1) {
          // Reset child for retry
          currentNode.attempts = attempts + 1;
          if (currentNode.child) {
            this.resetNodeAndChildren(currentNode.child);
            return currentNode.child;
          } else if (currentNode.children && currentNode.children[0]) {
            this.resetNodeAndChildren(currentNode.children[0]);
            return currentNode.children[0];
          }
        }
        // Success or max attempts reached
        return this.getParentNextSibling(currentNode);
        
      case 'action':
      case 'condition':
        // Leaf nodes - move to parent's next sibling
        return this.getParentNextSibling(currentNode);
        
      default:
        // For any node with children, try to execute them
        if (currentNode.children && currentNode.children.length > 0) {
          for (const child of currentNode.children) {
            const childId = child.config?.id || child.id;
            if (this.nodeStates.get(childId) === 'pending') {
              return child;
            }
          }
        }
        return this.getParentNextSibling(currentNode);
    }
  }
  
  /**
   * Get parent's next sibling for navigation
   */
  getParentNextSibling(node) {
    if (!node.parent) return null;
    
    const parent = node.parent;
    const parentChildren = parent.children || [];
    const nodeIndex = parentChildren.indexOf(node);
    
    // Find next sibling
    for (let i = nodeIndex + 1; i < parentChildren.length; i++) {
      const sibling = parentChildren[i];
      const siblingId = sibling.config?.id || sibling.id;
      if (this.nodeStates.get(siblingId) === 'pending') {
        return sibling;
      }
    }
    
    // No more siblings, recurse to parent
    return this.getParentNextSibling(parent);
  }
  
  /**
   * Reset node and all its children to pending
   */
  resetNodeAndChildren(node) {
    const nodeId = node.config?.id || node.id;
    this.nodeStates.set(nodeId, 'pending');
    
    if (node.children) {
      for (const child of node.children) {
        this.resetNodeAndChildren(child);
      }
    }
    if (node.child) {
      this.resetNodeAndChildren(node.child);
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(node) {
    const nodeType = node.config?.type || 'unknown';
    const nodeId = node.config?.id || node.id;
    
    // Simulate execution delay for debugging
    await new Promise(resolve => setTimeout(resolve, 100));
    
    switch (nodeType) {
      case 'action':
        // Execute action node with tool
        if (node.config?.tool && this.toolRegistry) {
          try {
            const tool = await this.toolRegistry.getTool(node.config.tool);
            if (tool) {
              const params = this.resolveParams(node.config.params || {});
              const result = await tool.execute(params);
              
              // Store output in context if outputVariable specified
              if (node.config.outputVariable && result.success) {
                this.executionContext.artifacts = this.executionContext.artifacts || {};
                this.executionContext.artifacts[node.config.outputVariable] = result.data || {};
                this.executionContext.artifacts[node.config.outputVariable].success = result.success;
              }
              
              return {
                status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
                data: result.data || {},
                error: result.error
              };
            } else {
              return {
                status: NodeStatus.FAILURE,
                data: { error: `Tool '${node.config.tool}' not found` }
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
          data: { message: `Action ${nodeId} completed` }
        };
        
      case 'condition':
        // Evaluate condition expression
        if (node.config?.check) {
          try {
            // Create evaluation context
            const context = this.executionContext;
            // Use Function constructor for safer eval
            const checkFn = new Function('context', `return ${node.config.check}`);
            const result = checkFn(context);
            
            return {
              status: result ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
              data: { checkResult: result, expression: node.config.check }
            };
          } catch (error) {
            return {
              status: NodeStatus.FAILURE,
              data: { error: `Condition evaluation failed: ${error.message}` }
            };
          }
        }
        return {
          status: NodeStatus.SUCCESS,
          data: { message: 'No condition specified' }
        };
        
      case 'sequence':
        // Sequence nodes succeed if all children succeed
        // The actual child execution is handled by stepNext
        return {
          status: NodeStatus.SUCCESS,
          data: { message: `Sequence ${nodeId} processing` }
        };
        
      case 'selector':
        // Selector nodes succeed if any child succeeds
        return {
          status: NodeStatus.SUCCESS,
          data: { message: `Selector ${nodeId} processing` }
        };
        
      case 'retry':
        // Retry nodes manage their child's execution
        return {
          status: NodeStatus.SUCCESS,
          data: { message: `Retry ${nodeId} processing` }
        };
        
      default:
        return {
          status: NodeStatus.SUCCESS,
          data: { message: `Node ${nodeId} executed` }
        };
    }
  }
  
  /**
   * Resolve parameters with context substitution
   */
  resolveParams(params) {
    // Simple parameter resolution - could be enhanced
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Context variable reference
        const varPath = value.slice(2, -1);
        resolved[key] = this.getContextValue(varPath);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
  
  /**
   * Get value from context by path
   */
  getContextValue(path) {
    const parts = path.split('.');
    let value = this.executionContext;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  }

  /**
   * Create node instance from configuration
   */
  async createNode(config, parent = null) {
    const node = {
      id: config.id || `node-${Date.now()}-${Math.random()}`,
      config: config,
      parent: parent,
      children: [],
      child: null,
      attempts: 0
    };
    
    // Create children recursively
    if (config.children && Array.isArray(config.children)) {
      for (const childConfig of config.children) {
        const child = await this.createNode(childConfig, node);
        node.children.push(child);
      }
    }
    
    // Handle single child (for retry nodes)
    if (config.child) {
      node.child = await this.createNode(config.child, node);
      // Also add to children array for uniform handling
      node.children = [node.child];
    }
    
    return node;
  }

  /**
   * Count total nodes in a tree configuration
   */
  countNodes(treeConfig) {
    if (!treeConfig) return 0;
    
    let count = 1;
    if (treeConfig.children && Array.isArray(treeConfig.children)) {
      for (const child of treeConfig.children) {
        count += this.countNodes(child);
      }
    }
    
    return count;
  }

  /**
   * Register built-in node types (simplified)
   */
  registerBuiltinNodes() {
    // Simplified registration for debug executor
    this.nodeTypes.set('action', 'ActionNode');
    this.nodeTypes.set('sequence', 'SequenceNode');
    this.nodeTypes.set('selector', 'SelectorNode');
    this.nodeTypes.set('retry', 'RetryNode');
    this.nodeTypes.set('condition', 'ConditionNode');
  }
}