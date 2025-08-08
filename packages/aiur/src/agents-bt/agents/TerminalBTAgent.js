/**
 * TerminalBTAgent - Behavior Tree-based Terminal Agent
 * 
 * A next-generation terminal agent built on the BT framework, providing
 * configurable tool execution and session management workflows.
 */

import { BTAgentBase } from '../core/BTAgentBase.js';

export class TerminalBTAgent extends BTAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'terminal',
      configPath: config.configPath || 'terminal-agent.json',
      debugMode: true  // Enable debug to see what's happening
    });
    
    // Terminal-specific state
    this.sessionId = null;
    this.session = null;
    
    console.log(`TerminalBTAgent ${this.agentId} initialized`);
  }
  
  /**
   * Agent-specific initialization
   */
  async initializeAgent() {
    // Terminal agent is simpler, just ensure module loader is ready
    if (this.moduleLoader) {
      console.log(`TerminalBTAgent: Module loader available with ${this.moduleLoader.tools?.size || 0} tools`);
    }
    
    console.log(`TerminalBTAgent ${this.agentId} initialized`);
  }
  
  /**
   * Override receive to handle ping/pong directly
   */
  async receive(payload, envelope) {
    console.log(`TerminalBTAgent: Received message type: ${payload?.type}`);
    
    // Handle ping/pong directly for testing
    if (payload?.type === 'ping') {
      console.log('TerminalBTAgent: Handling ping, returning pong');
      const pongResponse = {
        type: 'pong',
        content: 'pong',
        agentId: this.agentId,
        timestamp: Date.now()
      };
      
      // Send to remote actor if available
      if (this.remoteActor) {
        console.log('TerminalBTAgent: Sending pong to remote actor');
        this.remoteActor.receive(pongResponse);
      }
      
      return pongResponse;
    }
    
    // Otherwise use parent implementation - let BT handle all other messages
    return super.receive(payload, envelope);
  }
  
  /**
   * Get agent-specific context for BT execution
   */
  getAgentSpecificContext(payload) {
    return {
      // Session information
      sessionId: this.sessionId,
      session: this.session,
      
      // Tool execution helpers
      executeTool: this.executeTool.bind(this),
      getAvailableTools: this.getAvailableTools.bind(this),
      
      // Session management helpers  
      createSession: this.createSession.bind(this),
      attachSession: this.attachSession.bind(this),
      
      // Agent metadata
      agentType: 'terminal'
    };
  }
  
  /**
   * Execute tool through module loader
   */
  async executeTool(toolName, args) {
    // Check for context tools first
    if (this.session && this.session.context) {
      const contextToolNames = ['context_add', 'context_get', 'context_list'];
      if (contextToolNames.includes(toolName)) {
        return await this.session.context.executeContextTool(toolName, args);
      }
    }
    
    // Execute through module loader
    if (this.moduleLoader && this.moduleLoader.executeTool) {
      return await this.moduleLoader.executeTool(toolName, args);
    }
    
    throw new Error(`Tool '${toolName}' not found`);
  }
  
  /**
   * Get available tools
   */
  async getAvailableTools() {
    const tools = [];
    
    // Add system tools
    const systemTools = [
      { name: 'module_list', description: 'List available and loaded modules' },
      { name: 'module_load', description: 'Load a module to make its tools available' },
      { name: 'module_unload', description: 'Unload a module and remove its tools' }
    ];
    
    tools.push(...systemTools);
    
    // Add tools from module loader
    if (this.moduleLoader && this.moduleLoader.toolRegistry) {
      for (const tool of this.moduleLoader.toolRegistry.values()) {
        if (tool.toJSON) {
          const toolDef = tool.toJSON();
          tools.push({
            name: toolDef.name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema
          });
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Send initial tools list to the frontend
   */
  async sendInitialTools() {
    if (this.remoteActor) {
      const tools = await this.getAvailableTools();
      this.remoteActor.receive({
        type: 'tools_list',
        tools: tools,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
      console.log(`TerminalBTAgent: Sent initial tools list (${tools.length} tools)`);
    }
  }
  
  /**
   * Create new session
   */
  async createSession() {
    if (!this.sessionManager) {
      throw new Error('Session manager not available');
    }
    
    const sessionInfo = await this.sessionManager.createSession();
    this.sessionId = sessionInfo.sessionId;
    this.session = this.sessionManager.getSession(this.sessionId);
    
    return sessionInfo;
  }
  
  /**
   * Attach to existing session
   */
  async attachSession(sessionId) {
    if (!this.sessionManager) {
      throw new Error('Session manager not available');
    }
    
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    this.sessionId = sessionId;
    this.session = session;
    
    return session;
  }
  
  /**
   * Get default configuration for terminal agent
   */
  getDefaultConfiguration() {
    return {
      type: 'message_handler',
      name: 'TerminalBTAgent_Workflow',
      debugMode: this.debugMode,
      routes: {
        // Session management
        'session_create': {
          type: 'sequence',
          name: 'create_session_workflow',
          children: [
            {
              type: 'session_manager',
              action: 'create_session'
            },
            {
              type: 'tools_list',
              action: 'send_initial_tools'
            }
          ]
        },
        
        'session_attach': {
          type: 'sequence',
          name: 'attach_session_workflow',
          children: [
            {
              type: 'session_manager',
              action: 'attach_session'
            },
            {
              type: 'tools_list',
              action: 'send_initial_tools'
            }
          ]
        },
        
        // Tool execution
        'tool_request': {
          type: 'sequence',
          name: 'execute_tool_workflow',
          children: [
            {
              type: 'tool_execution',
              allowParameterResolution: true,
              validateInput: true,
              processOutput: true
            },
            {
              type: 'response_sender',
              type: 'tool_response'
            }
          ]
        },
        
        // Tools and modules management
        'tools_list': {
          type: 'sequence',
          name: 'list_tools_workflow',
          children: [
            {
              type: 'tools_list',
              action: 'get_all_tools'
            },
            {
              type: 'response_sender',
              type: 'tools_list_response'
            }
          ]
        },
        
        'module_list': {
          type: 'sequence',
          name: 'list_modules_workflow',
          children: [
            {
              type: 'module_manager',
              action: 'list_modules'
            },
            {
              type: 'response_sender',
              type: 'module_list_response'
            }
          ]
        },
        
        'module_load': {
          type: 'sequence',
          name: 'load_module_workflow',
          children: [
            {
              type: 'module_manager',
              action: 'load_module',
              moduleName: '{{message.moduleName}}'
            },
            {
              type: 'tools_list',
              action: 'send_updated_tools'
            },
            {
              type: 'response_sender',
              type: 'module_loaded'
            }
          ]
        },
        
        'module_unload': {
          type: 'sequence',
          name: 'unload_module_workflow',
          children: [
            {
              type: 'module_manager',
              action: 'unload_module',
              moduleName: '{{message.moduleName}}'
            },
            {
              type: 'tools_list',
              action: 'send_updated_tools'
            },
            {
              type: 'response_sender',
              type: 'module_unloaded'
            }
          ]
        },
        
        // Health check
        'ping': {
          type: 'response_sender',
          type: 'pong',
          content: 'pong',
          timestamp: '{{Date.now()}}'
        }
      },
      
      // Default route for unrecognized messages
      defaultRoute: {
        type: 'sequence',
        children: [
          {
            type: 'error_handler',
            strategy: 'report'
          },
          {
            type: 'response_sender',
            type: 'error',
            content: 'Unknown message type: {{messageType}}'
          }
        ]
      },
      
      // Configuration
      fallbackBehavior: 'error',
      logUnroutedMessages: true
    };
  }
  
  /**
   * Get current agent status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      sessionId: this.sessionId,
      hasActiveSession: !!this.session,
      availableToolsCount: this.moduleLoader?.toolRegistry?.size || 0
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    this.sessionId = null;
    this.session = null;
    
    await super.destroy();
    
    console.log(`TerminalBTAgent ${this.agentId} destroyed`);
  }
}