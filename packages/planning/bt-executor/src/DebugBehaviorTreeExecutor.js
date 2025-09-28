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
import { NodeStatus } from '@legion/bt-task';

export class DebugBehaviorTreeExecutor extends EventEmitter {
  constructor(toolRegistry) {
    super();
    this.toolRegistry = toolRegistry;
    this.nodeTypes = new Map();
    this.executionContext = {};
    this.resolvedTools = new Map(); // toolName -> tool instance
    
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
    
    // Resolve and cache all tools needed by the tree - fail fast if any are missing
    await this.resolveAllTreeTools(treeConfig);
    
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
   * Recursively find all tools needed by the tree and resolve them
   * Fail fast if any tools are missing
   */
  async resolveAllTreeTools(node) {
    const toolsNeeded = new Set();
    this.findAllToolIds(node, toolsNeeded);
    
    console.log(`[BT-EXECUTOR] Found ${toolsNeeded.size} unique tools needed:`, Array.from(toolsNeeded));
    
    // Check if tools are already attached to nodes (as tool objects in node.tool)
    const attachedTools = new Map();
    const toolObjectsFound = this.findAttachedToolObjects(node, attachedTools);
    
    console.log(`[BT-EXECUTOR] Checking for attached tool objects in tree...`);
    
    if (toolObjectsFound > 0) {
      console.log(`[BT-EXECUTOR] ✅ Found ${toolObjectsFound} tool objects in behavior tree`);
      
      // Resolve tool objects to executable tools from registry
      const missingTools = [];
      for (const [toolName, toolObject] of attachedTools.entries()) {
        try {
          // Look up the actual executable tool by name
          const executableTool = await this.toolRegistry.getTool(toolName);
          if (executableTool && executableTool.execute) {
            this.resolvedTools.set(toolName, executableTool);
            console.log(`[BT-EXECUTOR] ✅ Resolved tool object ${toolName} to executable tool`);
          } else {
            console.log(`[BT-EXECUTOR] ❌ Could not find executable tool for ${toolName}`);
            missingTools.push(toolName);
          }
        } catch (error) {
          console.log(`[BT-EXECUTOR] ❌ Error resolving tool ${toolName}:`, error.message);
          missingTools.push(toolName);
        }
      }
      
      if (missingTools.length > 0) {
        throw new Error(`Could not resolve tool objects to executable tools: ${missingTools.join(', ')}`);
      }
      
      return;
    } else {
      console.log(`[BT-EXECUTOR] No tool objects found, checking for traditional toolInstance attachments...`);
      this.findAttachedTools(node, attachedTools);
      
      if (attachedTools.size > 0) {
        console.log(`[BT-EXECUTOR] ✅ Found ${attachedTools.size} tools in config.toolInstance format`);
        this.resolvedTools = attachedTools;
        return;
      } else {
        console.log(`[BT-EXECUTOR] ❌ No tools found attached to behavior tree, falling back to registry`);
      }
    }
    
    // Fallback to tool registry resolution
    if (!this.toolRegistry) {
      throw new Error('No tool registry provided to executor and no tools attached to behavior tree');
    }
    
    // Resolve all tools upfront
    const missingTools = [];
    
    for (const toolId of toolsNeeded) {
      try {
        // Convert ObjectId to string if needed
        const toolIdString = toolId.toString();
        
        // Get the actual executable tool from registry using name
        const tool = await this.toolRegistry.getTool(toolIdString);
        
        if (tool && tool.execute) {
          this.resolvedTools.set(toolIdString, tool);
          console.log(`[BT-EXECUTOR] ✅ Resolved executable tool: ${toolIdString} (${tool.name})`);
        } else if (tool) {
          // Tool exists but doesn't have execute method - this is the problem
          console.log(`[BT-EXECUTOR] ❌ Tool ${toolIdString} exists but has no execute method. Available methods:`, Object.keys(tool));
          missingTools.push(toolIdString);
        } else {
          missingTools.push(toolIdString);
          console.log(`[BT-EXECUTOR] ❌ Missing tool: ${toolIdString}`);
        }
      } catch (error) {
        const toolIdString = toolId.toString();
        missingTools.push(toolIdString);
        console.log(`[BT-EXECUTOR] ❌ Error resolving tool ${toolIdString}:`, error.message);
      }
    }
    
    // Fail fast if any tools are missing
    if (missingTools.length > 0) {
      throw new Error(`Missing required tools: ${missingTools.join(', ')}`);
    }
    
    console.log(`[BT-EXECUTOR] ✅ All ${toolsNeeded.size} tools resolved successfully`);
  }
  
  /**
   * Recursively find all tool IDs used in the tree
   */
  findAllToolIds(node, toolsSet) {
    if (!node) return;
    
    // If this is an action node with a tool_id or tool, validate and add to set
    if (node.type === 'action') {
      // Check both node.tool_id and node.config.tool_id
      const toolId = node.tool_id || node.config?.tool_id || node.tool || node.config?.tool;
      if (toolId) {
        if (typeof toolId === 'string') {
          // Handle both clean tool names and full descriptions
          let cleanToolName = toolId;
          if (toolId.startsWith('Tool: ')) {
            // Extract clean name from "Tool: name - description" format
            cleanToolName = toolId.split('Tool: ')[1].split(' - ')[0].trim();
          }
          toolsSet.add(cleanToolName);
        } else if (typeof toolId === 'object') {
          // Tool objects will be validated in findAttachedToolObjects
          toolsSet.add(`[Tool Object: ${toolId.name || 'unnamed'}]`);
        } else {
          throw new Error(`Invalid tool type in node '${node.id}'. Tool must be string (modulename.toolname) or Tool instance object`);
        }
      }
    }
    
    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        this.findAllToolIds(child, toolsSet);
      }
    }
    
    // Check single child (for retry nodes)
    if (node.child) {
      this.findAllToolIds(node.child, toolsSet);
    }
  }

  /**
   * Recursively find tool objects directly in node.tool property
   * Returns the count of tool objects found
   */
  findAttachedToolObjects(node, toolsMap) {
    if (!node) return 0;
    
    let count = 0;
    
    // If this is an action node with a tool object in node.tool, validate it strictly
    if (node.type === 'action' && node.tool && typeof node.tool === 'object' && node.tool.name) {
      const toolName = node.tool.name;
      
      // CRITICAL: Tool object MUST have execute method - NO FALLBACKS
      if (typeof node.tool.execute !== 'function') {
        throw new Error(`Tool '${toolName}' in node '${node.id}' is not a proper Tool instance. Tool objects must have execute method.`);
      }
      
      console.log(`[BT-EXECUTOR] ✅ Validated executable Tool instance: ${toolName}`);
      toolsMap.set(toolName, node.tool); // Use the validated Tool instance directly
      count++;
    }
    
    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        count += this.findAttachedToolObjects(child, toolsMap);
      }
    }
    
    // Check single child (for retry nodes)
    if (node.child) {
      count += this.findAttachedToolObjects(node.child, toolsMap);
    }
    
    return count;
  }

  /**
   * Recursively find all attached tool instances in the tree (traditional format)
   */
  findAttachedTools(node, toolsMap) {
    if (!node) return;
    
    // If this is an action node with a toolInstance, add it to the map
    if (node.type === 'action' && node.config?.toolInstance) {
      const toolKey = node.tool || node.config?.tool || node.id; // Use tool name or node ID as key
      toolsMap.set(toolKey, node.config.toolInstance);
      console.log(`[BT-EXECUTOR] Found attached tool: ${toolKey} -> ${node.config.toolInstance.name}`);
    }
    
    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        this.findAttachedTools(child, toolsMap);
      }
    }
    
    // Check single child (for retry nodes)
    if (node.child) {
      this.findAttachedTools(node.child, toolsMap);
    }
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
    
    // Start at root if no current node
    if (!this.currentNode) {
      this.currentNode = this.rootNode;
    }
    
    const node = this.currentNode;
    const nodeId = node.config?.id || node.id;
    const nodeType = node.config?.type || 'unknown';
    
    // Emit step event
    this.emit('node:step', {
      nodeId,
      nodeType,
      nodeName: node.config?.name || nodeId
    });
    
    try {
      // Composite nodes - navigate to first pending child
      if (['sequence', 'selector', 'retry'].includes(nodeType)) {
        this.nodeStates.set(nodeId, 'running');
        
        // Find first pending child
        const children = nodeType === 'retry' && node.child ? [node.child] : node.children || [];
        for (const child of children) {
          const childId = child.config?.id || child.id;
          if (this.nodeStates.get(childId) === 'pending') {
            this.currentNode = child;
            return { complete: false, currentNode: childId };
          }
        }
        
        // No pending children - composite is done, move to next
        const status = this.determineCompositeStatus(node);
        this.nodeStates.set(nodeId, status === NodeStatus.SUCCESS ? 'success' : 'failure');
        this.currentNode = this.findNextNode();
        
        if (!this.currentNode) {
          return { complete: true, success: status === NodeStatus.SUCCESS };
        }
        return { complete: false, currentNode: this.currentNode.config?.id };
      }
      
      // Leaf nodes - execute them
      const result = await this.executeNode(node);
      const finalState = result.status === NodeStatus.SUCCESS ? 'success' : 'failure';
      this.nodeStates.set(nodeId, finalState);
      
      // Enhanced history entry with inputs and outputs
      const historyEntry = {
        nodeId, 
        nodeType, 
        status: result.status, 
        timestamp: Date.now(),
        result: result.data ? JSON.parse(JSON.stringify(result.data)) : null,  // Fix circular refs in result too
        // Add tool information if available
        tool: node.tool?.name || node.config?.tool || 'unknown',
        // FIXED: Store actual inputs and outputs from execution (avoid circular references)
        inputs: result.inputs || node.config?.inputs || null,
        outputs: result.data ? JSON.parse(JSON.stringify(result.data)) : null  // Serialize to avoid circular refs
      };
      
      this.executionHistory.push(historyEntry);
      
      this.emit('node:complete', { nodeId, status: result.status, data: result.data });
      
      // Move to next node
      this.currentNode = this.findNextNode();
      
      if (!this.currentNode) {
        this.emit('tree:complete', { success: result.status === NodeStatus.SUCCESS });
        return { complete: true, success: result.status === NodeStatus.SUCCESS };
      }
      
      return { complete: false, currentNode: this.currentNode.config?.id, lastResult: result };
      
    } catch (error) {
      this.nodeStates.set(nodeId, 'error');
      this.emit('node:error', { nodeId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Find next node to execute from current position
   */
  findNextNode() {
    let node = this.currentNode;
    
    while (node) {
      // Try next sibling
      if (node.parent) {
        const siblings = node.parent.children || [];
        const myIndex = siblings.indexOf(node);
        
        for (let i = myIndex + 1; i < siblings.length; i++) {
          const siblingId = siblings[i].config?.id || siblings[i].id;
          if (this.nodeStates.get(siblingId) === 'pending') {
            return siblings[i];
          }
        }
        
        // No more siblings - check if parent needs finalization
        const parent = node.parent;
        const parentId = parent.config?.id || parent.id;
        const parentType = parent.config?.type;
        const parentState = this.nodeStates.get(parentId);
        
        if (['sequence', 'selector', 'retry'].includes(parentType) && parentState === 'running') {
          // Parent composite needs to be finalized
          return parent;
        }
        
        // Move up to parent
        node = parent;
      } else {
        // At root with no more work
        return null;
      }
    }
    
    return null;
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
        // Execute action node - prefer direct tool object
        console.log(`[BT-EXECUTOR] Executing action node: ${node.id}`);
        console.log(`[BT-EXECUTOR] - node.config.tool type: ${typeof node.config?.tool}`);
        console.log(`[BT-EXECUTOR] - node.config.tool:`, node.config?.tool);
        
        let tool = null;
        let toolId = null;
        
        // FIXED: Check node.config.tool (where tools are actually stored)
        if (node.config?.tool && typeof node.config.tool === 'object' && node.config.tool.name) {
          // FIXED: Use node.config.tool instead of node.tool
          const toolName = node.config.tool.name;
          tool = this.resolvedTools.get(toolName);
          if (tool) {
            console.log(`[BT-EXECUTOR] ✅ Using resolved executable tool for: ${toolName}`);
          } else {
            console.log(`[BT-EXECUTOR] ❌ Tool object ${toolName} not found in resolved tools`);
            return {
              status: NodeStatus.FAILURE,
              data: { error: `Tool object '${toolName}' not resolved to executable tool` }
            };
          }
        } else if (node.config?.tool && typeof node.config.tool === 'object' && node.config.tool.execute) {
          // FIXED: This is already an executable tool object in config
          tool = node.config.tool;
          console.log(`[BT-EXECUTOR] ✅ Using directly attached executable tool: ${tool.name}`);
        } else if (node.config?.tool && typeof node.config.tool === 'string' && node.config.tool !== '[Circular]') {
          // Fallback to legacy lookup methods
          const attachedTool = node.config?.toolInstance;
          toolId = node.config?.tool_id || node.config?.config?.tool_id || node.tool;
          console.log(`[BT-EXECUTOR] - toolId: ${toolId}`);
          console.log(`[BT-EXECUTOR] - attachedTool: ${!!attachedTool}`);
          
          tool = attachedTool;
        }
        
        // If we have a tool from the resolved tools, execute it directly
        if (tool && !toolId) {
          try {
            // Check multiple locations for inputs
            const rawInputs = node.inputs || node.config?.inputs || node.config?.config?.inputs || {};
            const inputs = this.resolveParams(rawInputs);
            console.log(`[BT-EXECUTOR] Raw inputs:`, rawInputs);
            console.log(`[BT-EXECUTOR] Resolved inputs:`, inputs);
            const result = await tool.execute(inputs);
            
            console.log(`[BT-EXECUTOR] Tool result for ${tool.name}:`, result);
            
            // Handle outputs format OR outputVariable (legacy support)  
            const outputs = node.outputs || node.config?.outputs || node.config?.config?.outputs;
            const outputVariable = node.outputVariable || node.config?.outputVariable;
            
            this.executionContext.artifacts = this.executionContext.artifacts || {};
            
            if (outputs && typeof outputs === 'object') {
              // Map specific tool data outputs to variable names
              console.log(`[BT-EXECUTOR] Mapping outputs:`, outputs);
              console.log(`[BT-EXECUTOR] Tool result.data:`, result.data);
              
              for (const [outputField, variableName] of Object.entries(outputs)) {
                if (result.data && result.data.hasOwnProperty(outputField)) {
                  this.executionContext.artifacts[variableName] = result.data[outputField];
                  console.log(`[BT-EXECUTOR] Mapped data.${outputField} -> ${variableName}:`, result.data[outputField]);
                }
              }
            } else if (outputVariable) {
              // Legacy support: store entire tool result in outputVariable
              this.executionContext.artifacts[outputVariable] = result;
              console.log(`[BT-EXECUTOR] Stored entire result in ${outputVariable}:`, result);
            } else {
              // Store entire tool result as fallback if no specific outputs mapping
              const nodeId = node.config?.id || node.id;
              this.executionContext.artifacts[`${nodeId}_result`] = result;
              console.log(`[BT-EXECUTOR] No specific outputs mapping - stored entire result as ${nodeId}_result:`, result);
            }
            
            return {
              status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
              data: result.data || {},
              error: result.error,
              // Include inputs and outputs for history
              inputs: inputs,
              outputs: result.data
            };
          } catch (error) {
            return {
              status: NodeStatus.FAILURE,
              data: { error: error.message }
            };
          }
        }
        
        if (!tool && toolId) {
          try {
            // Fallback to resolved tools lookup
            const toolIdString = toolId.toString();
            tool = this.resolvedTools.get(toolIdString);
            if (!tool) {
              // This should never happen if resolveAllTreeTools worked correctly
              console.log(`[BT-EXECUTOR] ERROR: Tool not found in resolved tools`);
              return {
                status: NodeStatus.FAILURE,
                data: { error: `Tool '${node.tool || node.config?.tool}' (ID: ${toolIdString}) not found in resolved tools` }
              };
            }
            
            console.log(`[BT-EXECUTOR] Found tool: ${tool.name}`);
            // Check multiple locations for inputs
            const rawInputs = node.inputs || node.config?.inputs || node.config?.config?.inputs || {};
            const inputs = this.resolveParams(rawInputs);
            console.log(`[BT-EXECUTOR] Raw inputs:`, rawInputs);
            console.log(`[BT-EXECUTOR] Resolved inputs:`, inputs);
            const result = await tool.execute(inputs);
            
            console.log(`[BT-EXECUTOR] Tool result for ${node.tool || node.config?.tool}:`, result);
            
            // Handle outputs format OR outputVariable (legacy support)
            const outputs = node.config?.config?.outputs || node.config?.outputs;
            const outputVariable = node.outputVariable || node.config?.outputVariable;
            
            this.executionContext.artifacts = this.executionContext.artifacts || {};
            
            if (outputs && typeof outputs === 'object') {
              // Map specific tool data outputs to variable names
              console.log(`[BT-EXECUTOR] Mapping outputs:`, outputs);
              console.log(`[BT-EXECUTOR] Tool result.data:`, result.data);
              
              for (const [outputField, variableName] of Object.entries(outputs)) {
                if (result.data && result.data.hasOwnProperty(outputField)) {
                  this.executionContext.artifacts[variableName] = result.data[outputField];
                  console.log(`[BT-EXECUTOR] Mapped data.${outputField} -> ${variableName}:`, result.data[outputField]);
                }
              }
            } else if (outputVariable) {
              // Legacy support: store entire tool result in outputVariable
              this.executionContext.artifacts[outputVariable] = result;
              console.log(`[BT-EXECUTOR] Stored entire result in ${outputVariable}:`, result);
            } else {
              // Store entire tool result as fallback if no specific outputs mapping
              const nodeId = node.config?.id || node.id;
              this.executionContext.artifacts[`${nodeId}_result`] = result;
              console.log(`[BT-EXECUTOR] No specific outputs mapping - stored entire result as ${nodeId}_result:`, result);
            }
            
            return {
              status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
              data: result.data || {},
              error: result.error,
              // Include inputs and outputs for history
              inputs: inputs,
              outputs: result.data
            };
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
    const resolved = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // FIXED: @varName syntax - resolve to artifacts
        const varName = value.substring(1); // Remove @ prefix
        resolved[key] = this.executionContext.artifacts ? this.executionContext.artifacts[varName] : undefined;
        console.log(`[BT-EXECUTOR] Resolved @${varName} -> ${resolved[key]}`);
      } else if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Legacy ${varName} syntax
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
    
    // Count children (for sequence, selector, etc.)
    if (treeConfig.children && Array.isArray(treeConfig.children)) {
      for (const child of treeConfig.children) {
        count += this.countNodes(child);
      }
    }
    
    // Count single child (for retry nodes)
    if (treeConfig.child) {
      count += this.countNodes(treeConfig.child);
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