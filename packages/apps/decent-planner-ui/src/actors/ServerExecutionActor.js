/**
 * ServerExecutionActor - Server-side actor for behavior tree execution
 * Manages DebugBehaviorTreeExecutor and handles execution commands
 */

import { DebugBehaviorTreeExecutor } from '@legion/bt-executor';

export class ServerExecutionActor {
  constructor(services) {
    this.services = services;
    this.executor = null;
    this.currentTree = null;
    this.toolRegistry = services.toolRegistry || null;
    
    console.log('[ServerExecutionActor] Constructor - toolRegistry exists:', !!this.toolRegistry);
    console.log('[ServerExecutionActor] Services keys:', Object.keys(services || {}));
    
    // Bind message handlers
    this.handlers = {
      'load-tree': this.handleLoadTree.bind(this),
      'step': this.handleStep.bind(this),
      'run': this.handleRun.bind(this),
      'pause': this.handlePause.bind(this),
      'reset': this.handleReset.bind(this),
      'set-breakpoint': this.handleSetBreakpoint.bind(this),
      'remove-breakpoint': this.handleRemoveBreakpoint.bind(this),
      'get-state': this.handleGetState.bind(this)
    };
  }
  
  async receive(type, payload, sender) {
    console.log('[ServerExecutionActor] Received:', type);
    
    const handler = this.handlers[type];
    if (handler) {
      try {
        const result = await handler(payload);
        
        // Send response back
        if (sender && sender.receive) {
          sender.receive(`${type}-response`, {
            success: true,
            data: result
          });
        }
        
        return result;
      } catch (error) {
        console.error('[ServerExecutionActor] Error:', error);
        
        if (sender && sender.receive) {
          sender.receive(`${type}-response`, {
            success: false,
            error: error.message
          });
        }
        
        throw error;
      }
    } else {
      console.warn('[ServerExecutionActor] Unknown message type:', type);
    }
  }
  
  async handleLoadTree(payload) {
    const { tree } = payload;
    
    if (!tree) {
      throw new Error('No tree provided');
    }
    
    try {
      // Create new executor
      this.executor = new DebugBehaviorTreeExecutor(this.toolRegistry);
      
      // Set up event listeners
      this.setupExecutorListeners();
      
      // Initialize tree
      this.currentTree = tree;
      const result = await this.executor.initializeTree(tree);
      
      return {
        loaded: true,
        treeId: result.treeId,
        nodeCount: result.nodeCount,
        state: this.executor.getExecutionState()
      };
    } catch (error) {
      console.error('[ServerExecutionActor] Error loading tree:', error.message);
      // Return error response instead of crashing
      return {
        loaded: false,
        error: error.message
      };
    }
  }
  
  async handleStep() {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    this.executor.setMode('step');
    const result = await this.executor.stepNext();
    
    return {
      ...result,
      state: this.executor.getExecutionState()
    };
  }
  
  async handleRun() {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    this.executor.setMode('run');
    
    // Run in background and send updates
    this.runExecution();
    
    return {
      started: true,
      state: this.executor.getExecutionState()
    };
  }
  
  async handlePause() {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    this.executor.pause();
    
    return {
      paused: true,
      state: this.executor.getExecutionState()
    };
  }
  
  async handleReset() {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    this.executor.reset();
    
    return {
      reset: true,
      state: this.executor.getExecutionState()
    };
  }
  
  async handleSetBreakpoint(payload) {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    const { nodeId } = payload;
    this.executor.addBreakpoint(nodeId);
    
    return {
      breakpointSet: true,
      nodeId,
      state: this.executor.getExecutionState()
    };
  }
  
  async handleRemoveBreakpoint(payload) {
    if (!this.executor) {
      throw new Error('No tree loaded');
    }
    
    const { nodeId } = payload;
    this.executor.removeBreakpoint(nodeId);
    
    return {
      breakpointRemoved: true,
      nodeId,
      state: this.executor.getExecutionState()
    };
  }
  
  async handleGetState() {
    if (!this.executor) {
      return {
        loaded: false,
        state: null
      };
    }
    
    return {
      loaded: true,
      tree: this.currentTree,
      state: this.executor.getExecutionState()
    };
  }
  
  setupExecutorListeners() {
    if (!this.executor) return;
    
    // Forward executor events to client
    this.executor.on('node:step', (data) => {
      this.broadcast('execution-event', {
        type: 'node:step',
        data
      });
    });
    
    this.executor.on('node:complete', (data) => {
      this.broadcast('execution-event', {
        type: 'node:complete',
        data,
        state: this.executor.getExecutionState()
      });
    });
    
    this.executor.on('node:error', (data) => {
      this.broadcast('execution-event', {
        type: 'node:error',
        data,
        state: this.executor.getExecutionState()
      });
    });
    
    this.executor.on('tree:complete', (data) => {
      this.broadcast('execution-event', {
        type: 'tree:complete',
        data,
        state: this.executor.getExecutionState()
      });
    });
    
    this.executor.on('breakpoint:hit', (data) => {
      this.broadcast('execution-event', {
        type: 'breakpoint:hit',
        data,
        state: this.executor.getExecutionState()
      });
    });
    
    this.executor.on('execution:paused', () => {
      this.broadcast('execution-event', {
        type: 'execution:paused',
        state: this.executor.getExecutionState()
      });
    });
    
    this.executor.on('execution:resumed', (data) => {
      this.broadcast('execution-event', {
        type: 'execution:resumed',
        data,
        state: this.executor.getExecutionState()
      });
    });
  }
  
  async runExecution() {
    try {
      const result = await this.executor.runToCompletion();
      
      this.broadcast('execution-event', {
        type: 'execution:complete',
        data: result,
        state: this.executor.getExecutionState()
      });
    } catch (error) {
      this.broadcast('execution-event', {
        type: 'execution:error',
        error: error.message,
        state: this.executor.getExecutionState()
      });
    }
  }
  
  broadcast(type, payload) {
    // Broadcast to all connected clients
    if (this.remoteActor) {
      this.remoteActor.receive(type, payload);
    }
  }
  
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }
  
  setToolRegistry(toolRegistry) {
    this.toolRegistry = toolRegistry;
    console.log('[ServerExecutionActor] Tool registry updated - exists:', !!this.toolRegistry);
  }
}