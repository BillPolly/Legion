/**
 * ChatServerToolAgent - Server actor that integrates ToolUsingChatAgent
 * 
 * Replaces ChatServerSubActor with intelligent tool-using capabilities.
 * Integrates ToolUsingChatAgent into the actor system with proper message handling.
 */

import { ToolUsingChatAgent } from './ToolUsingChatAgent.js';
import { SlashCommandAgent } from './SlashCommandAgent.js';
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
      agentInitialized: false,
      slashCommandInitialized: false
    };
    
    // Tool agent will be initialized when needed
    this.toolAgent = null;
    this.slashCommandAgent = null;
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 Tool chat server sub-actor connected');
    
    // Initialize agents
    await this.initializeAgent();
    await this.initializeSlashCommandAgent();
    
    // Send ready signal to client via parent
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'ready', {
        agentReady: this.state.agentInitialized,
        slashCommandReady: this.state.slashCommandInitialized,
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
      
      // FAIL FAST: toolRegistry must be in services - no fallbacks
      const toolRegistry = this.services.toolRegistry;
      if (!toolRegistry) {
        throw new Error('Tool registry not available in services - initialization failed');
      }

      // Get LLM client from ResourceManager
      const resourceManager = await ResourceManager.getInstance();
      const llmClient = await resourceManager.get('llmClient');
      if (!llmClient) {
        throw new Error('LLM client not available from ResourceManager');
      }

      // Get resourceActor for AgentTools (same one used by SlashCommandAgent)
      // First try from services (for tests), then from parent actor (for production)
      const resourceActor = this.services.resourceActor || this.parentActor?.resourceSubActor || null;
      console.log('[ChatServerToolAgent] ResourceActor available:', !!resourceActor);
      
      // Create tool agent with event callback for observability and resourceActor for AgentTools
      this.toolAgent = new ToolUsingChatAgent(
        toolRegistry, 
        llmClient,
        (eventType, data) => this.forwardAgentEvent(eventType, data),
        resourceActor
      );
      
      this.state.agentInitialized = true;
      console.log('[ChatServerToolAgent] ✅ Tool agent initialized successfully');
      
    } catch (error) {
      console.error('[ChatServerToolAgent] ❌ Failed to initialize tool agent:', error);
      this.state.agentInitialized = false;
    }
  }

  /**
   * Initialize the slash command agent
   */
  async initializeSlashCommandAgent() {
    try {
      console.log('[ChatServerToolAgent] Initializing slash command agent...');
      
      // Get LLM client from ResourceManager
      const resourceManager = await ResourceManager.getInstance();
      const llmClient = await resourceManager.get('llmClient');
      if (!llmClient) {
        throw new Error('LLM client not available from ResourceManager');
      }

      // FAIL FAST: toolRegistry must be in services - no fallbacks
      const toolRegistry = this.services.toolRegistry;
      if (!toolRegistry) {
        throw new Error('Tool registry not available in services for slash command agent');
      }

      // Create slash command agent with event callback for observability
      this.slashCommandAgent = new SlashCommandAgent(
        toolRegistry,
        llmClient,
        (eventType, data) => this.forwardAgentEvent(eventType, data)
      );
      
      // Set resource actor reference for /show commands (same logic as for ToolUsingChatAgent)
      const resourceActorForSlash = this.services.resourceActor || this.parentActor?.resourceSubActor;
      if (resourceActorForSlash) {
        this.slashCommandAgent.setResourceActor(resourceActorForSlash);
        console.log('[ChatServerToolAgent] Resource actor wired to slash command agent');
      } else {
        console.log('[ChatServerToolAgent] No resource actor available for slash commands');
      }
      
      this.state.slashCommandInitialized = true;
      console.log('[ChatServerToolAgent] ✅ Slash command agent initialized successfully');
      
    } catch (error) {
      console.error('[ChatServerToolAgent] ❌ Failed to initialize slash command agent:', error);
      this.state.slashCommandInitialized = false;
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
            agentReady: this.state.agentInitialized,
            slashCommandReady: this.state.slashCommandInitialized
          });
        }
        break;
        
      default:
        console.warn('Unknown message type in tool chat server sub-actor:', messageType);
        break;
    }
  }

  /**
   * Handle user message - pre-process slash commands, then tool agent pipeline
   */
  async handleSendMessage(data) {
    const { text, timestamp } = data;
    
    console.log(`[ChatServerToolAgent] Processing message: "${text}"`);
    this.state.messageCount++;
    
    // Check if this is a slash command first
    if (this.isSlashCommand(text)) {
      await this.handleSlashCommand(text, timestamp);
      return;
    }
    
    // Regular message processing through tool agent pipeline
    if (!this.state.agentInitialized) {
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
   * Handle slash command processing
   */
  async handleSlashCommand(text, timestamp) {
    console.log(`[ChatServerToolAgent] Processing slash command: "${text}"`);
    
    if (!this.state.slashCommandInitialized || !this.slashCommandAgent) {
      this.sendCommandError('Slash command agent not initialized. Please wait and try again.', text);
      return;
    }

    if (!this.state.agentInitialized || !this.toolAgent) {
      this.sendCommandError('Tool agent context not available. Slash commands require tool agent to be initialized.', text);
      return;
    }

    try {
      // Process slash command with tool agent context access
      const result = await this.slashCommandAgent.processSlashCommand(text, this.toolAgent);
      
      if (result.success) {
        // Send successful command response
        this.sendCommandResponse({
          text: result.text,
          command: result.command,
          originalMessage: text,
          originalTimestamp: timestamp
        });
        
        // Send context update in case command modified context (like /clear or /load)
        this.sendContextUpdate();
      } else {
        // Send command error response
        this.sendCommandError(result.text, text, result.usage);
      }
      
    } catch (error) {
      console.error('[ChatServerToolAgent] Error processing slash command:', error);
      this.sendCommandError(`Error executing slash command: ${error.message}`, text);
    }
  }

  /**
   * Check if message is a slash command
   */
  isSlashCommand(text) {
    return typeof text === 'string' && text.trim().startsWith('/');
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
   * Send command response to client
   */
  sendCommandResponse(responseData) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'command-response', {
        ...responseData,
        messageNumber: this.state.messageCount,
        timestamp: new Date().toLocaleTimeString(),
        isSlashCommand: true
      });
    }
  }

  /**
   * Send command error response to client
   */
  sendCommandError(errorMessage, originalMessage = null, usage = null) {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'command-error', {
        text: errorMessage,
        error: errorMessage,
        originalMessage,
        usage,
        messageNumber: this.state.messageCount,
        timestamp: new Date().toLocaleTimeString(),
        isSlashCommand: true
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
      slashCommandInitialized: this.state.slashCommandInitialized,
      messageCount: this.state.messageCount,
      contextVariables: this.toolAgent ? Object.keys(this.toolAgent.executionContext.artifacts).length : 0,
      resolvedTools: this.toolAgent ? this.toolAgent.resolvedTools.size : 0,
      llmInteractions: this.toolAgent ? this.toolAgent.llmInteractions.length : 0
    };
  }
}