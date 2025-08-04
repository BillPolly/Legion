import { Actor } from '../../../shared/actors/src/Actor.js';

/**
 * TerminalAgent - Simple actor wrapper for existing Aiur functionality
 * Handles the same protocol messages as WebSocketHandler but via actor protocol
 */
export class TerminalAgent extends Actor {
  constructor(config = {}) {
    super();
    
    // Existing Aiur components
    this.sessionManager = config.sessionManager;
    this.moduleLoader = config.moduleLoader;
    
    // Remote actor reference (set after handshake)
    this.remoteActor = null;
    
    // Session state
    this.sessionId = null;
    this.session = null;
    
    console.log(`TerminalAgent initialized`);
  }
  
  /**
   * Receive messages from frontend TerminalActor
   * Handle the SAME protocol as WebSocketHandler
   */
  async receive(message) {
    console.log('TerminalAgent: Received message:', message.type);
    
    try {
      switch (message.type) {
        case 'session_create':
          await this.handleSessionCreate(message);
          break;
          
        case 'session_attach':
          await this.handleSessionAttach(message);
          break;
          
        case 'tool_request':
          await this.handleToolRequest(message);
          break;
          
        case 'tools_list':
          await this.handleToolsList(message);
          break;
          
        case 'module_list':
          await this.handleModuleList(message);
          break;
          
        case 'module_load':
          await this.handleModuleLoad(message);
          break;
          
        case 'module_unload':
          await this.handleModuleUnload(message);
          break;
          
        case 'ping':
          this.remoteActor.receive({ 
            type: 'pong', 
            timestamp: Date.now() 
          });
          break;
          
        default:
          this.remoteActor.receive({
            type: 'error',
            error: `Unknown message type: ${message.type}`,
            requestId: message.requestId
          });
      }
    } catch (error) {
      console.error('TerminalAgent: Error handling message:', error);
      this.remoteActor.receive({
        type: 'error',
        error: error.message,
        requestId: message.requestId
      });
    }
  }
  
  /**
   * Handle session creation
   */
  async handleSessionCreate(message) {
    try {
      // Create new session
      const sessionInfo = await this.sessionManager.createSession();
      this.sessionId = sessionInfo.sessionId;
      
      this.session = this.sessionManager.getSession(this.sessionId);
      if (!this.session) {
        throw new Error('Failed to get created session');
      }
      
      // Send response
      this.remoteActor.receive({
        type: 'session_created',
        requestId: message.requestId,
        sessionId: sessionInfo.sessionId,
        success: true,
        created: sessionInfo.created,
        capabilities: sessionInfo.capabilities || []
      });
      
      // Send initial tools list
      await this.sendInitialTools();
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'session_error',
        requestId: message.requestId,
        error: error.message
      });
    }
  }
  
  /**
   * Handle session attachment
   */
  async handleSessionAttach(message) {
    try {
      const session = this.sessionManager.getSession(message.sessionId);
      if (session) {
        this.sessionId = message.sessionId;
        this.session = session;
        
        this.remoteActor.receive({
          type: 'session_attached',
          requestId: message.requestId,
          sessionId: message.sessionId,
          success: true
        });
        
        // Send current tools list
        await this.sendInitialTools();
      } else {
        throw new Error(`Session ${message.sessionId} not found`);
      }
    } catch (error) {
      this.remoteActor.receive({
        type: 'session_error',
        requestId: message.requestId,
        error: error.message
      });
    }
  }
  
  /**
   * Handle tool request
   */
  async handleToolRequest(message) {
    try {
      // First check if it's a context tool and we have a session
      if (this.session && this.session.context) {
        const contextToolNames = ['context_add', 'context_get', 'context_list'];
        if (contextToolNames.includes(message.tool)) {
          const result = await this.session.context.executeContextTool(
            message.tool,
            message.arguments || {}
          );
          this.remoteActor.receive({
            type: 'tool_response',
            requestId: message.requestId,
            tool: message.tool,
            result: { success: true, result: result }
          });
          return;
        }
      }
      
      // Execute tool directly from moduleLoader
      const result = await this.moduleLoader.executeTool(
        message.tool,
        message.arguments || {}
      );
      
      this.remoteActor.receive({
        type: 'tool_response',
        requestId: message.requestId,
        tool: message.tool,
        result: result
      });
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'tool_error',
        requestId: message.requestId,
        tool: message.tool,
        error: error.message
      });
    }
  }
  
  /**
   * Handle tools list request
   */
  async handleToolsList(message) {
    try {
      const tools = await this.getAvailableTools();
      
      this.remoteActor.receive({
        type: 'tools_list_response',
        requestId: message.requestId,
        tools: tools
      });
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'error',
        requestId: message.requestId,
        error: error.message
      });
    }
  }
  
  /**
   * Handle module list request
   */
  async handleModuleList(message) {
    try {
      // Execute module_list directly from moduleLoader
      const result = await this.moduleLoader.executeTool('module_list', {});
      
      this.remoteActor.receive({
        type: 'module_list_response',
        requestId: message.requestId,
        modules: result.modules || { loaded: [], available: [] }
      });
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'error',
        requestId: message.requestId,
        error: error.message
      });
    }
  }
  
  /**
   * Handle module load request
   */
  async handleModuleLoad(message) {
    try {
      // Execute module_load directly from moduleLoader
      const result = await this.moduleLoader.executeTool('module_load', {
        name: message.moduleName
      });
      
      this.remoteActor.receive({
        type: 'module_loaded',
        requestId: message.requestId,
        moduleName: message.moduleName,
        success: result.success,
        message: result.message || `Module ${message.moduleName} loaded`,
        toolsLoaded: result.toolsLoaded || []
      });
      
      // Send updated tools list
      await this.sendToolsList();
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'module_error',
        requestId: message.requestId,
        moduleName: message.moduleName,
        error: error.message
      });
    }
  }
  
  /**
   * Handle module unload request
   */
  async handleModuleUnload(message) {
    try {
      // Execute module_unload directly from moduleLoader
      const result = await this.moduleLoader.executeTool('module_unload', {
        name: message.moduleName
      });
      
      this.remoteActor.receive({
        type: 'module_unloaded',
        requestId: message.requestId,
        moduleName: message.moduleName,
        success: result.success,
        message: result.message || `Module ${message.moduleName} unloaded`
      });
      
      // Send updated tools list
      await this.sendToolsList();
      
    } catch (error) {
      this.remoteActor.receive({
        type: 'module_error',
        requestId: message.requestId,
        moduleName: message.moduleName,
        error: error.message
      });
    }
  }
  
  /**
   * Get available tools from session
   */
  async getAvailableTools() {
    if (!this.session) {
      return [];
    }
    
    try {
 
      if (this.moduleLoader) {
        const tools = await this.moduleLoader.getAllTools();
        return tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }));
      }
      
      return [];
    } catch (error) {
      console.error('TerminalAgent: Error getting tools:', error);
      return [];
    }
  }
  
  /**
   * Send initial tools list after connection
   */
  async sendInitialTools() {
    if (!this.remoteActor) return;
    
    try {
      const tools = await this.getAvailableTools();
      
      // Always include system tools
      const systemTools = [
        { name: 'module_list', description: 'List available and loaded modules' },
        { name: 'module_load', description: 'Load a module to make its tools available' },
        { name: 'module_unload', description: 'Unload a module and remove its tools' }
      ];
      
      const allTools = [...systemTools, ...tools];
      
      this.remoteActor.receive({
        type: 'initial_tools',
        tools: allTools
      });
      
      console.log(`TerminalAgent: Sent ${allTools.length} initial tools`);
      
    } catch (error) {
      console.error('TerminalAgent: Error sending initial tools:', error);
    }
  }
  
  /**
   * Send updated tools list
   */
  async sendToolsList() {
    if (!this.remoteActor) return;
    
    try {
      const tools = await this.getAvailableTools();
      
      this.remoteActor.receive({
        type: 'tools_updated',
        tools: tools
      });
      
    } catch (error) {
      console.error('TerminalAgent: Error sending tools list:', error);
    }
  }
  
  /**
   * Clean up
   */
  destroy() {
    this.remoteActor = null;
    this.sessionId = null;
    this.session = null;
    console.log('TerminalAgent destroyed');
  }
}