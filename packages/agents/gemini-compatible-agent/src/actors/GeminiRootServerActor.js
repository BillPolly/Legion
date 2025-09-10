/**
 * GeminiRootServerActor - Top-level server actor wrapping existing functionality
 * Minimal wrapper around ToolCallingConversationManager with actor framework integration
 */

import ToolCallingConversationManager from '../conversation/ToolCallingConversationManager.js';

/**
 * Root server actor for Gemini agent (wraps existing functionality)
 */
export default class GeminiRootServerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.conversationManager = null;
    this.isReady = false;
    
    console.log('🎭 GeminiRootServerActor created');
  }

  /**
   * Set remote actor connection (Legion actor framework pattern)
   * @param {Object} remoteActor - Remote actor reference
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Gemini server actor connected to client');
    
    try {
      // Initialize existing conversation manager (no changes to it)
      this.conversationManager = new ToolCallingConversationManager(this.services.resourceManager);
      
      // Wait for conversation manager to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Existing conversation manager wrapped in actor');
      
      // Wait for client to be fully ready before sending ready signal
      setTimeout(() => {
        console.log('📤 [SERVER] Sending ready signal to client...');
        this.remoteActor.receive('ready', {
          timestamp: new Date().toISOString(),
          tools: this.conversationManager.toolsModule?.getStatistics()?.toolCount || 0,
          observability: !!this.conversationManager.observabilityService,
          sdMethodology: !!this.conversationManager.sdMethodologyService
        });
        console.log('✅ [SERVER] Ready signal sent!');
      }, 1000); // Wait 1 second for client to fully initialize
      
      this.isReady = true;
      
    } catch (error) {
      console.error('❌ Gemini actor initialization failed:', error.message);
      
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
          
        case 'observability_request':
          await this._handleObservabilityRequest(data);
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
    console.log('💬 [ACTOR] Processing chat message through existing conversation manager');
    
    // Use existing working conversation manager (no changes needed)
    const response = await this.conversationManager.processMessage(data.content);
    
    console.log('📤 [ACTOR] Sending response through actor framework');
    
    // Send response back through actor framework (not WebSocket)
    this.remoteActor.receive('chat_response', {
      type: 'response',
      content: response.content,
      tools: response.tools || [],
      timestamp: response.timestamp,
      sdMethodologyApplied: response.sdMethodologyApplied || false
    });
  }

  /**
   * Handle slash commands (wraps existing functionality) 
   * @param {Object} data - Slash command data
   */
  async _handleSlashCommand(data) {
    console.log('⚡ [ACTOR] Processing slash command');
    
    // Use existing slash command handling (from server.js)
    const response = await this._handleSlashCommandLegacy(data.command, data.args);
    
    // Send response through actor framework
    this.remoteActor.receive('slash_response', {
      type: 'response',
      content: response,
      isSlashCommand: true
    });
  }

  /**
   * Handle observability requests
   * @param {Object} data - Observability request data
   */
  async _handleObservabilityRequest(data) {
    const observabilityData = this.conversationManager.observabilityService?.getSystemStatus() || {};
    
    this.remoteActor.receive('observability_data', observabilityData);
  }

  /**
   * Legacy slash command handling (preserve existing functionality)
   * @param {string} command - Slash command
   * @param {Array} args - Command arguments
   * @returns {string} Command response
   */
  async _handleSlashCommandLegacy(command, args = []) {
    // Copy existing slash command logic from server.js
    switch (command) {
      case 'help':
        return `**Available Slash Commands:**

⚡ **/help** - Show this help message
📊 **/show <param>** - Show agent state (tools, context, files, errors, debug, all)
🧹 **/clear** - Clear conversation history

Regular chat messages work as before for tool calling!`;

      case 'show':
        const param = args[0];
        if (!param) {
          return `**Show Command Usage:**

Use \`/show <parameter>\` where parameter is:
• tools, context, debug, all`;
        }
        
        switch (param.toLowerCase()) {
          case 'tools':
            const toolsStats = this.conversationManager.toolsModule?.getStatistics();
            return toolsStats ? `**🔧 Tools (${toolsStats.toolCount}):** ${toolsStats.tools.join(', ')}` : 'Tools not available';
            
          case 'all':
            const allStats = this.conversationManager.toolsModule?.getStatistics() || {};
            const obsStats = this.conversationManager.observabilityService?.getSystemStatus() || {};
            return `**🎯 Complete State:**
🔧 Tools: ${allStats.toolCount || 0}
💬 Messages: ${this.conversationManager.getConversationHistory().length}
📊 Active Executions: ${obsStats.activeExecutions || 0}
💾 Memory: ${obsStats.memoryUsage || 'unknown'}
🔍 Observability: ${obsStats.totalEvents || 0} events tracked`;
            
          default:
            return `Unknown parameter: ${param}`;
        }

      case 'clear':
        this.conversationManager.clearHistory();
        return '🧹 **Everything Cleared!**';

      default:
        return `❌ **Unknown Command:** /${command}`;
    }
  }

  /**
   * Get actor status
   * @returns {Object} Actor status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      conversationManagerReady: !!this.conversationManager,
      toolsAvailable: this.conversationManager?.toolsModule?.getStatistics()?.toolCount || 0,
      observabilityActive: !!this.conversationManager?.observabilityService,
      sdMethodologyReady: !!this.conversationManager?.sdMethodologyService
    };
  }
}