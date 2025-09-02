/**
 * ChatServerToolAgent - Server actor that integrates ToolUsingChatAgent
 * 
 * Replaces ChatServerSubActor with intelligent tool-using capabilities.
 * Integrates ToolUsingChatAgent into the actor system with proper message handling.
 */

import { ToolUsingChatAgent } from './ToolUsingChatAgent.js';
import { ResourceManager } from '@legion/resource-manager';

export default class ChatServerToolAgent {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.parentActor = null;
    this.actorSpace = null;
    
    // State
    this.state = {
      connected: false,
      messageCount: 0,
      agentInitialized: false
    };
    
    // Tool agent will be initialized when needed
    this.toolAgent = null;
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 Tool chat server sub-actor connected');
    
    // Initialize tool agent
    await this.initializeAgent();
    
    // Send ready signal to client via parent
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'ready', {
        agentReady: this.state.agentInitialized,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Initialize the tool agent with required dependencies
   */
  async initializeAgent() {
    try {
      console.log('[ChatServerToolAgent] Initializing tool agent...');
      
      // Get toolRegistry from services (should be singleton from DecentPlanner)
      let toolRegistry = this.services.toolRegistry;
      
      // If not in services, try to get from sibling planner actor
      if (!toolRegistry && this.parentActor?.plannerSubActor?.toolRegistry) {
        toolRegistry = this.parentActor.plannerSubActor.toolRegistry;
        console.log('[ChatServerToolAgent] Got toolRegistry from planner sub-actor');
      }
      
      if (!toolRegistry) {
        throw new Error('Tool registry not available - planner may not be initialized yet');
      }

      // Get LLM client from ResourceManager
      const resourceManager = await ResourceManager.getInstance();
      const llmClient = await resourceManager.get('llmClient');
      if (!llmClient) {
        throw new Error('LLM client not available from ResourceManager');
      }

      // Create tool agent with event callback for observability
      this.toolAgent = new ToolUsingChatAgent(
        toolRegistry, 
        llmClient,
        (eventType, data) => this.forwardAgentEvent(eventType, data)
      );
      
      this.state.agentInitialized = true;
      console.log('[ChatServerToolAgent] ✅ Tool agent initialized successfully');
      
    } catch (error) {
      console.error('[ChatServerToolAgent] ❌ Failed to initialize tool agent:', error);
      this.state.agentInitialized = false;
    }
  }

  receive(messageType, data) {
    console.log('📨 Tool chat server sub-actor received:', messageType);
    
    switch (messageType) {
      case 'send-message':
        this.handleSendMessage(data);
        break;
        
      case 'get-context-state':
        this.handleGetContextState();
        break;
        
      case 'clear-context':
        this.handleClearContext();
        break;
        
      case 'ping':
        if (this.remoteActor) {
          this.remoteActor.receive('pong', { 
            timestamp: Date.now(),
            agentReady: this.state.agentInitialized
          });
        }
        break;
        
      default:
        console.warn('Unknown message type in tool chat server sub-actor:', messageType);
        break;
    }
  }

  /**
   * Handle user message through tool agent pipeline
   */
  async handleSendMessage(data) {
    const { text, timestamp } = data;
    
    console.log(`[ChatServerToolAgent] Processing message: "${text}"`);
    this.state.messageCount++;
    
    if (!this.state.agentInitialized) {
      // Fallback if agent not initialized
      this.sendError('Tool agent not initialized. Please wait and try again.');
      return;
    }

    try {
      // Process through tool agent pipeline
      const result = await this.toolAgent.processMessage(text);
      
      // Send enriched response to client
      this.sendAgentResponse({
        text: result.userResponse,
        toolsUsed: result.toolsUsed || [],
        contextUpdated: result.contextUpdated || [],
        reasoning: result.reasoning,
        operationCount: result.operationCount || 0,
        complete: result.complete !== false,
        originalMessage: text,
        originalTimestamp: timestamp
      });
      
      // Send context state update
      this.sendContextUpdate();
      
    } catch (error) {
      console.error('[ChatServerToolAgent] Error processing message:', error);
      this.sendError(error.message, text);
    }
  }

  /**
   * Handle context state request
   */
  handleGetContextState() {
    if (!this.toolAgent) {
      this.sendError('Tool agent not initialized');
      return;
    }

    const contextState = this.toolAgent.getContextState();
    
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'context-state-response', {
        contextState,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Handle context clear request  
   */
  handleClearContext() {
    if (!this.toolAgent) {
      this.sendError('Tool agent not initialized');
      return;
    }

    this.toolAgent.clearContext();
    
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'context-cleared', {
        message: '🗑️ Context cleared. All stored variables have been removed.',
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Send successful agent response to client
   */
  sendAgentResponse(responseData) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'agent-response', {
        ...responseData,
        messageNumber: this.state.messageCount,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Send error response to client
   */
  sendError(errorMessage, originalMessage = null) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'agent-error', {
        text: `Sorry, I encountered an error: ${errorMessage}`,
        error: errorMessage,
        originalMessage,
        messageNumber: this.state.messageCount,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Send thinking/progress message to client (for transparency)
   */
  sendThinking(step, message, data = {}) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'agent-thinking', {
        step,
        message,
        ...data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Forward agent events to client for observability
   */
  forwardAgentEvent(eventType, data) {
    console.log(`[ChatServerToolAgent] Forwarding event: ${eventType}`);
    
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', `agent-${eventType}`, {
        ...data,
        serverTimestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send context state update to client
   */
  sendContextUpdate() {
    if (!this.toolAgent || !this.parentActor) return;
    
    const contextState = this.toolAgent.getContextState();
    
    this.parentActor.sendToSubActor('chat', 'context-state-update', {
      contextState: {
        artifacts: this.toolAgent.executionContext.artifacts,
        operationHistory: this.toolAgent.operationHistory,
        statistics: contextState
      },
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Send operation update to client
   */
  sendOperationUpdate(operation) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'tool-operation', {
        operation,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Get agent status for debugging
   */
  getStatus() {
    return {
      connected: this.state.connected,
      agentInitialized: this.state.agentInitialized,
      messageCount: this.state.messageCount,
      contextVariables: this.toolAgent ? Object.keys(this.toolAgent.executionContext.artifacts).length : 0,
      resolvedTools: this.toolAgent ? this.toolAgent.resolvedTools.size : 0,
      llmInteractions: this.toolAgent ? this.toolAgent.llmInteractions.length : 0
    };
  }
}