import { Actor } from '../../../shared/actors/src/Actor.js';

/**
 * TerminalAgent - Backend agent that handles terminal commands via actor protocol
 * Integrates with Aiur's module system and tool registry
 */
export class TerminalAgent extends Actor {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `terminal-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Reference to the remote actor (frontend TerminalActor)
    this.remoteActor = config.remoteActor || null;
    
    // Aiur system integration
    this.moduleManager = config.moduleManager || null;
    this.toolRegistry = config.toolRegistry || null;
    
    // Terminal state
    this.isProcessing = false;
    
    console.log(`TerminalAgent ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Emit function that sends messages through the remote actor
   * This replaces EventEmitter.emit() with actor protocol communication
   */
  emit(eventName, data) {
    if (this.remoteActor) {
      this.remoteActor.receive({
        ...data,
        eventName: eventName
      });
    } else {
      console.warn(`TerminalAgent: Cannot emit ${eventName} - no remote actor`);
    }
  }
  
  /**
   * Receive messages from frontend TerminalActor
   */
  receive(payload, envelope) {
    console.log('TerminalAgent: Received message:', payload);
    
    // Handle different message types
    switch (payload.type) {
      case 'terminal_command':
        this.handleCommand(payload);
        break;
        
      case 'tool_call':
        this.handleToolCall(payload);
        break;
        
      case 'module_load':
        this.handleModuleLoad(payload);
        break;
        
      case 'module_unload':
        this.handleModuleUnload(payload);
        break;
        
      case 'tools_list':
        this.handleToolsList(payload);
        break;
        
      case 'get_session_info':
        this.handleGetSessionInfo(payload);
        break;
        
      default:
        console.log('TerminalAgent: Unknown message type:', payload.type);
        this.emit('terminal_error', {
          message: `Unknown command type: ${payload.type}`,
          timestamp: new Date().toISOString()
        });
    }
  }
  
  /**
   * Handle terminal command
   */
  async handleCommand(payload) {
    const { command, timestamp } = payload;
    
    if (this.isProcessing) {
      this.emit('terminal_error', {
        message: 'Another command is already processing',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    this.isProcessing = true;
    
    try {
      console.log(`TerminalAgent: Processing command: ${command}`);
      
      // Parse command
      const parts = command.trim().split(' ');
      const toolName = parts[0];
      const args = parts.slice(1);
      
      // Handle special commands
      if (toolName === 'tools') {
        await this.listAvailableTools();
      } else if (toolName === 'module_list') {
        await this.listModules();
      } else if (toolName.startsWith('module_load')) {
        const moduleName = args[0];
        if (moduleName) {
          await this.loadModule(moduleName);
        } else {
          this.emit('terminal_error', {
            message: 'module_load requires a module name',
            timestamp: new Date().toISOString()
          });
        }
      } else if (toolName.startsWith('module_unload')) {
        const moduleName = args[0];
        if (moduleName) {
          await this.unloadModule(moduleName);
        } else {
          this.emit('terminal_error', {
            message: 'module_unload requires a module name',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Try to execute as a tool
        await this.executeTool(toolName, args);
      }
      
    } catch (error) {
      console.error('TerminalAgent: Error processing command:', error);
      this.emit('terminal_error', {
        message: error.message || 'Command failed',
        details: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Handle direct tool call
   */
  async handleToolCall(payload) {
    const { toolName, arguments: toolArgs } = payload;
    
    try {
      await this.executeTool(toolName, [], toolArgs);
    } catch (error) {
      this.emit('terminal_error', {
        message: `Tool execution failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Execute a tool via Aiur's tool registry
   */
  async executeTool(toolName, cmdArgs = [], toolArgs = null) {
    // For now, tools are not available
    this.emit('terminal_error', {
      message: 'Tool execution not available yet. Module system integration pending.',
      timestamp: new Date().toISOString()
    });
    return;
    
    // Get tool from registry
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found. Use 'tools' to list available tools.`);
    }
    
    // Build arguments
    let finalArgs = toolArgs;
    if (!finalArgs && cmdArgs.length > 0) {
      // Parse command line arguments into tool arguments
      finalArgs = this.parseCommandArgs(toolName, cmdArgs, tool);
    }
    
    console.log(`TerminalAgent: Executing tool ${toolName} with args:`, finalArgs);
    
    // Execute tool
    const result = await tool.invoke({
      name: toolName,
      arguments: finalArgs || {}
    });
    
    // Send formatted response
    this.emit('terminal_response', {
      type: 'tool_result',
      toolName,
      result,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Parse command line arguments for a tool
   */
  parseCommandArgs(toolName, args, tool) {
    // Basic argument parsing - can be enhanced later
    const toolArgs = {};
    
    // For now, just handle simple positional arguments
    if (tool.inputSchema && tool.inputSchema.properties) {
      const props = Object.keys(tool.inputSchema.properties);
      
      args.forEach((arg, index) => {
        if (index < props.length) {
          toolArgs[props[index]] = arg;
        }
      });
    }
    
    return toolArgs;
  }
  
  /**
   * List available tools
   */
  async listAvailableTools() {
    // For now, return empty tools list since we don't have proper registry
    this.emit('terminal_response', {
      type: 'tools_list',
      tools: [],
      count: 0,
      timestamp: new Date().toISOString()
    });
    return;
    
    // TODO: Properly integrate with Aiur's tool system
    // const tools = await this.moduleManager.getAllTools();
    // const toolList = tools.map(tool => ({
    //   name: tool.name,
    //   description: tool.description || 'No description',
    //   inputSchema: tool.inputSchema || null
    // }));
    
    this.emit('terminal_response', {
      type: 'tools_list',
      tools: toolList,
      count: toolList.length,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle module load request
   */
  async handleModuleLoad(payload) {
    await this.loadModule(payload.moduleName);
  }
  
  /**
   * Load a module
   */
  async loadModule(moduleName) {
    if (!this.moduleManager) {
      this.emit('terminal_error', {
        message: 'Module loading not available yet',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    try {
      console.log(`TerminalAgent: Loading module: ${moduleName}`);
      
      const result = await this.moduleManager.loadModule(moduleName);
      
      this.emit('terminal_response', {
        type: 'module_loaded',
        moduleName,
        success: true,
        message: `Module '${moduleName}' loaded successfully`,
        toolsLoaded: result.tools || [],
        timestamp: new Date().toISOString()
      });
      
      // Refresh tools list
      await this.listAvailableTools();
      
    } catch (error) {
      this.emit('terminal_error', {
        message: `Failed to load module '${moduleName}': ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle module unload request
   */
  async handleModuleUnload(payload) {
    await this.unloadModule(payload.moduleName);
  }
  
  /**
   * Unload a module
   */
  async unloadModule(moduleName) {
    if (!this.moduleManager) {
      throw new Error('No module manager available');
    }
    
    try {
      console.log(`TerminalAgent: Unloading module: ${moduleName}`);
      
      await this.moduleManager.unloadModule(moduleName);
      
      this.emit('terminal_response', {
        type: 'module_unloaded',
        moduleName,
        success: true,
        message: `Module '${moduleName}' unloaded successfully`,
        timestamp: new Date().toISOString()
      });
      
      // Refresh tools list
      await this.listAvailableTools();
      
    } catch (error) {
      this.emit('terminal_error', {
        message: `Failed to unload module '${moduleName}': ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * List modules
   */
  async listModules() {
    if (!this.moduleManager) {
      this.emit('terminal_response', {
        type: 'modules_list',
        modules: {
          loaded: [],
          available: ['file', 'search', 'github', 'railway', 'web']
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    try {
      const loadedModules = this.moduleManager.getLoadedModules();
      const availableModules = this.moduleManager.getAvailableModules ? 
        this.moduleManager.getAvailableModules() : [];
      
      this.emit('terminal_response', {
        type: 'modules_list',
        modules: {
          loaded: loadedModules,
          available: availableModules
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.emit('terminal_error', {
        message: `Failed to list modules: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle tools list request
   */
  async handleToolsList(payload) {
    await this.listAvailableTools();
  }
  
  /**
   * Handle session info request
   */
  handleGetSessionInfo(payload) {
    const sessionInfo = {
      sessionId: this.sessionId,
      agentId: this.id,
      connected: this.remoteActor !== null,
      hasModuleManager: this.moduleManager !== null,
      hasToolRegistry: this.toolRegistry !== null,
      isProcessing: this.isProcessing,
      timestamp: new Date().toISOString()
    };
    
    this.emit('terminal_response', {
      type: 'session_info',
      info: sessionInfo,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Disconnect from remote actor
   */
  disconnect() {
    this.remoteActor = null;
    console.log('TerminalAgent: Disconnected');
  }
  
  /**
   * Destroy the agent
   */
  destroy() {
    this.disconnect();
    console.log(`TerminalAgent ${this.id} destroyed`);
  }
}