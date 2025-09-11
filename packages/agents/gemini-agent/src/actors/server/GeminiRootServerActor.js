/**
 * GeminiRootServerActor - Top-level server actor wrapping existing functionality
 * Minimal wrapper around ConversationManager with actor framework integration
 */

import ConversationManager from '../../conversation/ConversationManager.js';
import { handleSlashCommand } from '../../services/SlashCommandService.js';

/**
 * Root server actor for Gemini agent (wraps existing functionality)
 */
export default class GeminiRootServerActor {
  constructor(services = {}) {
    this.services = services;
    this.remoteActor = null;
    this.conversationManager = null;
    this.isReady = false;
    
    // Initialize ResourceManager from services or create one
    this.resourceManager = services.resourceManager || this._createResourceManager();
    
    console.log('🎭 GeminiRootServerActor created with services:', Object.keys(services));
  }

  /**
   * Create ResourceManager if not provided in services
   */
  async _createResourceManager() {
    const { ResourceManager } = await import('@legion/resource-manager');
    return await ResourceManager.getInstance();
  }


  /**
   * Set remote actor connection (Legion actor framework pattern)
   * @param {Object} remoteActor - Remote actor reference
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Gemini server actor connected to client');
    
    try {
      // Ensure ResourceManager is ready
      if (!this.resourceManager.getInstance) {
        this.resourceManager = await this._createResourceManager();
      }
      
      console.log('🎭 Creating ConversationManager with ResourceManager...');
      
      // Initialize existing conversation manager (no changes to it)
      this.conversationManager = new ConversationManager(this.resourceManager);
      
      // Wait for conversation manager to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Existing conversation manager and project management wrapped in actor');
      
      // Wait for client to be fully ready before sending ready signal
      setTimeout(() => {
        console.log('📤 [SERVER] Sending ready signal to client...');
        this.remoteActor.receive('ready', {
          timestamp: new Date().toISOString(),
          tools: this.conversationManager.toolsModule?.getStatistics()?.toolCount || 0
        });
        console.log('✅ [SERVER] Ready signal sent!');
      }, 1000); // Wait 1 second for client to fully initialize
      
      this.isReady = true;
      
    } catch (error) {
      console.error('❌ Gemini actor initialization failed:', error.message);
      console.error('❌ Full error stack:', error.stack);
      
      this.remoteActor.receive('error', {
        message: error.message,
        component: 'GeminiRootServerActor'
      });
    }
  }

  /**
   * Receive messages from client actor (Legion actor framework pattern)
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   */
  async receive(messageType, data) {
    if (!this.isReady) {
      console.warn('⚠️ Actor not ready, ignoring message:', messageType);
      return;
    }

    try {
      switch (messageType) {
        case 'chat_message':
          await this._handleChatMessage(data);
          break;
          
        case 'slash_command':
          await this._handleSlashCommand(data);
          break;
          
          
        default:
          console.warn('⚠️ Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('❌ Actor message handling failed:', error.message);
      
      this.remoteActor.receive('error', {
        message: error.message,
        messageType,
        component: 'message_handling'
      });
    }
  }

  /**
   * Handle chat messages (wraps existing functionality)
   * @param {Object} data - Chat message data
   */
  async _handleChatMessage(data) {
    const message = data.content.trim();
    
    // Check if this is a slash command
    if (message.startsWith('/')) {
      console.log('⚡ [ACTOR] Processing slash command directly');
      const parts = message.substring(1).split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      
      // Handle slash command directly (not through LLM)
      const response = await handleSlashCommand(message, this.conversationManager);
      
      // Send response through actor framework
      this.remoteActor.receive('slash_response', {
        type: 'response',
        content: response,
        isSlashCommand: true
      });
      
      return;
    }
    
    console.log('💬 [ACTOR] Processing chat message through existing conversation manager');
    
    // Use existing working conversation manager (no changes needed)
    const response = await this.conversationManager.processMessage(data.content);
    
    console.log('📤 [ACTOR] Sending response through actor framework');
    
    // Send response back through actor framework (not WebSocket)
    this.remoteActor.receive('chat_response', {
      type: 'response',
      content: response.content,
      tools: response.tools || [],
      timestamp: response.timestamp
    });
  }

  /**
   * Handle slash commands (wraps existing functionality) 
   * @param {Object} data - Slash command data
   */
  async _handleSlashCommand(data) {
    console.log('⚡ [ACTOR] Processing slash command');
    
    // Use centralized slash command handling
    const commandInput = `/${data.command}${data.args.length > 0 ? ' ' + data.args.join(' ') : ''}`;
    const response = await handleSlashCommand(commandInput, this.conversationManager);
    
    // Send response through actor framework
    this.remoteActor.receive('slash_response', {
      type: 'response',
      content: response,
      isSlashCommand: true
    });
  }



  /**
   * Get actor status
   * @returns {Object} Actor status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      conversationManagerReady: !!this.conversationManager,
      toolsAvailable: this.conversationManager?.toolsModule?.getStatistics()?.toolCount || 0
    };
  }
}