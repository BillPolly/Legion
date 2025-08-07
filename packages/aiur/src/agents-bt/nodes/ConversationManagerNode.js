/**
 * ConversationManagerNode - Manages conversation history and context
 * 
 * Handles adding, retrieving, and managing conversation messages
 * within agent workflows.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ConversationManagerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'conversation_manager';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'add_user_message';
    this.maxHistoryLength = config.maxHistoryLength || 50;
  }

  async executeNode(context) {
    try {
      switch (this.action) {
        case 'add_user_message':
          return await this.addUserMessage(context);
        case 'add_assistant_message':
          return await this.addAssistantMessage(context);
        case 'clear_history':
          return await this.clearHistory(context);
        case 'get_history':
          return await this.getHistory(context);
        case 'trim_history':
          return await this.trimHistory(context);
        default:
          return {
            status: NodeStatus.FAILURE,
            data: { error: `Unknown action: ${this.action}` }
          };
      }
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }
  
  /**
   * Add user message to conversation history
   */
  async addUserMessage(context) {
    const message = context.message;
    if (!message || !message.content) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No message content to add' }
      };
    }
    
    // Initialize conversation history if not exists
    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }
    
    // Add user message
    const userMessage = {
      role: 'user',
      content: message.content,
      timestamp: new Date().toISOString()
    };
    
    context.conversationHistory.push(userMessage);
    
    // Trim if needed
    this.trimHistoryIfNeeded(context);
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        messageAdded: true,
        historyLength: context.conversationHistory.length,
        message: userMessage
      }
    };
  }
  
  /**
   * Add assistant message to conversation history
   */
  async addAssistantMessage(context) {
    const response = context.assistantResponse || context.response;
    if (!response) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No assistant response to add' }
      };
    }
    
    // Initialize conversation history if not exists
    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }
    
    const assistantMessage = {
      role: 'assistant',
      content: typeof response === 'string' ? response : response.content,
      timestamp: new Date().toISOString()
    };
    
    // Add tool calls if present
    if (response.tool_calls) {
      assistantMessage.tool_calls = response.tool_calls;
    }
    
    context.conversationHistory.push(assistantMessage);
    
    // Trim if needed
    this.trimHistoryIfNeeded(context);
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        messageAdded: true,
        historyLength: context.conversationHistory.length,
        message: assistantMessage
      }
    };
  }
  
  /**
   * Clear conversation history
   */
  async clearHistory(context) {
    const previousLength = context.conversationHistory ? context.conversationHistory.length : 0;
    context.conversationHistory = [];
    
    // Send history cleared event to remote actor
    if (context.remoteActor) {
      context.remoteActor.receive({
        type: 'history_cleared',
        sessionId: context.sessionId
      });
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        historyCleared: true,
        previousLength: previousLength,
        currentLength: 0
      }
    };
  }
  
  /**
   * Get conversation history
   */
  async getHistory(context) {
    const history = context.conversationHistory || [];
    
    // Send history to remote actor if requested
    if (context.remoteActor && this.config.sendToRemote) {
      context.remoteActor.receive({
        type: 'history',
        history: history,
        sessionId: context.sessionId
      });
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        history: history,
        historyLength: history.length
      }
    };
  }
  
  /**
   * Trim conversation history to max length
   */
  async trimHistory(context) {
    if (!context.conversationHistory) {
      return {
        status: NodeStatus.SUCCESS,
        data: { historyLength: 0, trimmed: false }
      };
    }
    
    const originalLength = context.conversationHistory.length;
    const maxLength = this.config.trimToLength || this.maxHistoryLength;
    
    if (originalLength > maxLength) {
      // Keep recent messages, but preserve system messages at the beginning
      const systemMessages = context.conversationHistory
        .slice(0, 3)
        .filter(msg => msg.role === 'system');
      
      const recentMessages = context.conversationHistory
        .slice(-(maxLength - systemMessages.length));
      
      context.conversationHistory = [...systemMessages, ...recentMessages];
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        historyLength: context.conversationHistory.length,
        originalLength: originalLength,
        trimmed: originalLength !== context.conversationHistory.length,
        trimmedCount: originalLength - context.conversationHistory.length
      }
    };
  }
  
  /**
   * Automatically trim history if it exceeds max length
   */
  trimHistoryIfNeeded(context) {
    if (context.conversationHistory && context.conversationHistory.length > this.maxHistoryLength) {
      // Keep system messages and recent conversation
      const systemMessages = context.conversationHistory
        .slice(0, 3)
        .filter(msg => msg.role === 'system');
      
      const recentMessages = context.conversationHistory
        .slice(-(this.maxHistoryLength - systemMessages.length));
      
      const removedCount = context.conversationHistory.length - systemMessages.length - recentMessages.length;
      context.conversationHistory = [...systemMessages, ...recentMessages];
      
      if (this.config.debugMode) {
        console.log(`ConversationManagerNode: Trimmed ${removedCount} messages from history`);
      }
    }
  }
  
  /**
   * Get conversation statistics
   */
  getConversationStats(context) {
    const history = context.conversationHistory || [];
    
    const stats = {
      totalMessages: history.length,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      toolCalls: 0
    };
    
    for (const msg of history) {
      switch (msg.role) {
        case 'user':
          stats.userMessages++;
          break;
        case 'assistant':
          stats.assistantMessages++;
          if (msg.tool_calls) {
            stats.toolCalls += msg.tool_calls.length;
          }
          break;
        case 'system':
          stats.systemMessages++;
          break;
      }
    }
    
    return stats;
  }
  
  /**
   * Add system prompt if not already present
   */
  ensureSystemPrompt(context, systemPrompt) {
    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }
    
    // Check if system prompt already exists
    const hasSystemPrompt = context.conversationHistory.some(msg => 
      msg.role === 'system' && msg.content.includes(systemPrompt)
    );
    
    if (!hasSystemPrompt) {
      context.conversationHistory.unshift({
        role: 'system',
        content: systemPrompt,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'conversation_management',
      action: this.action,
      maxHistoryLength: this.maxHistoryLength,
      supportsActions: [
        'add_user_message',
        'add_assistant_message', 
        'clear_history',
        'get_history',
        'trim_history'
      ]
    };
  }
}