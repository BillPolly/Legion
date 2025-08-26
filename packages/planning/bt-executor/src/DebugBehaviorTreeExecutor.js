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
    this.currentNode = null;
    this.executionStack = [];
    
    // Create root node from configuration
    this.rootNode = await this.createNode(treeConfig);
    
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
    
    // Emit step event
    this.emit('node:step', {
      nodeId,
      nodeType: node.config?.type || 'unknown',
      nodeName: node.config?.name || nodeId,
      depth: this.executionStack.length
    });
    
    // Update node state to running
    this.nodeStates.set(nodeId, 'running');
    this.emit('node:state', { nodeId, state: 'running' });
    
    try {
      // Execute the node
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
  }

  /**
   * Get next node to execute based on current node and result
   */
  getNextNode(currentNode, status) {
    // This is a simplified version - in reality would need to handle:
    // - Sequence nodes (next child or parent)
    // - Selector nodes (next child on failure or parent)
    // - Parallel nodes (all children)
    // - Retry nodes (repeat on failure)
    
    // For now, just traverse children in order
    if (currentNode.children && currentNode.children.length > 0) {
      // Find first unexecuted child
      for (const child of currentNode.children) {
        const childId = child.config?.id || child.id;
        const childState = this.nodeStates.get(childId);
        if (childState === 'pending') {
          return child;
        }
      }
    }
    
    // No more children, execution complete for now
    return null;
  }

  /**
   * Execute a single node
   */
  async executeNode(node) {
    // Simplified execution - in real implementation would handle all node types
    const nodeType = node.config?.type || 'unknown';
    
    // Simulate execution delay for debugging
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // For action nodes with tools
    if (nodeType === 'action' && node.config?.tool) {
      if (this.toolRegistry) {
        try {
          const tool = await this.toolRegistry.getTool(node.config.tool);
          if (tool) {
            const params = node.config.params || {};
            const result = await tool.execute(params);
            return {
              status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
              data: result.data || {}
            };
          }
        } catch (error) {
          return {
            status: NodeStatus.FAILURE,
            data: { error: error.message }
          };
        }
      }
    }
    
    // Default success for now
    return {
      status: NodeStatus.SUCCESS,
      data: { message: `Node ${node.config?.id} executed` }
    };
  }

  /**
   * Create node instance from configuration
   * Simplified version for debugging
   */
  async createNode(config) {
    const node = {
      id: config.id || `node-${Date.now()}`,
      config: config,
      children: []
    };
    
    // Create children recursively
    if (config.children && Array.isArray(config.children)) {
      for (const childConfig of config.children) {
        const child = await this.createNode(childConfig);
        node.children.push(child);
      }
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