/**
 * SDChatViewModel - ViewModel for SD observability chat
 * 
 * Manages business logic and state transformation between
 * the SDChatModel and SDChatView components
 */

import { SDChatModel } from '../model/SDChatModel.js';

export class SDChatViewModel {
  constructor(actor) {
    this.actor = actor;
    this.model = new SDChatModel();
    
    // View state
    this.inputValue = '';
    this.isTyping = false;
    this.showQuickActions = true;
    this.showArtifacts = false;
    
    // Current streaming message
    this.streamingMessageId = null;
    
    // View update listeners
    this.viewListeners = new Set();
    
    // Subscribe to model changes
    this.model.subscribe((event, data) => this.handleModelChange(event, data));
    
    // Subscribe to actor events
    this.setupActorListeners();
    
    // Initialize quick actions
    this.initializeQuickActions();
  }

  /**
   * Setup listeners for actor events
   */
  setupActorListeners() {
    if (!this.actor) return;
    
    // Listen for chat responses
    this.actor.on('chat_response_received', (data) => {
      this.handleChatResponse(data);
    });
    
    // Listen for connection status
    this.actor.on('connection_changed', (connected) => {
      this.model.setConnected(connected);
    });
    
    // Listen for project changes
    this.actor.on('project_changed', (data) => {
      this.model.setCurrentProject(data.projectId, data.projectStatus);
    });
    
    // Listen for artifacts mentioned
    this.actor.on('artifacts_mentioned', (artifacts) => {
      for (const artifact of artifacts) {
        this.model.addMentionedArtifact(artifact);
      }
    });
    
    // Listen for notifications
    this.actor.on('notification', (notification) => {
      this.showNotification(notification);
    });
  }

  /**
   * Initialize quick actions
   */
  initializeQuickActions() {
    const quickActions = this.actor ? this.actor.getQuickActions() : [
      { label: "What's happening?", message: "What agents are currently working?" },
      { label: "Show deliverables", message: "Where are the generated deliverables?" },
      { label: "Explain DDD", message: "How does Domain-Driven Design work in SD?" },
      { label: "Show errors", message: "Are there any validation failures?" }
    ];
    
    this.model.setQuickActions(quickActions);
  }

  /**
   * Send a message
   */
  async sendMessage(content) {
    if (!content.trim()) return;
    
    // Add user message to model
    const userMessage = this.model.addMessage(content, 'user');
    
    // Clear input
    this.inputValue = '';
    this.notifyViewListeners('input_cleared');
    
    // Set loading state
    this.model.setLoading(true);
    
    // Create streaming assistant message
    const assistantMessage = this.model.addMessage('', 'assistant', {
      isStreaming: true
    });
    this.streamingMessageId = assistantMessage.id;
    
    try {
      // Send through actor
      if (this.actor) {
        await this.actor.sendChatMessage({
          content,
          sessionId: this.model.sessionId
        });
      } else {
        // Fallback for testing without actor
        setTimeout(() => {
          this.handleChatResponse({
            content: 'This is a test response. Connect to the SD backend for real responses.',
            artifacts: [],
            commands: []
          });
        }, 1000);
      }
    } catch (error) {
      console.error('[SDChatViewModel] Error sending message:', error);
      
      // Update streaming message with error
      this.model.updateMessage(this.streamingMessageId, {
        content: `Error: ${error.message}`,
        isStreaming: false
      });
      
      this.model.setError(error.message);
    } finally {
      this.model.setLoading(false);
    }
  }

  /**
   * Handle chat response from actor
   */
  handleChatResponse(data) {
    if (!this.streamingMessageId) {
      // Create new message if no streaming message exists
      const message = this.model.addMessage(data.content, 'assistant', {
        artifacts: data.artifacts,
        commands: data.commands
      });
    } else {
      // Update streaming message
      this.model.updateMessage(this.streamingMessageId, {
        content: data.content,
        isStreaming: false,
        artifacts: data.artifacts,
        commands: data.commands
      });
      
      this.streamingMessageId = null;
    }
    
    // Execute any commands
    if (data.commands && data.commands.length > 0) {
      this.executeCommands(data.commands);
    }
  }

  /**
   * Handle streaming content
   */
  handleStreamingContent(messageId, content) {
    if (messageId === this.streamingMessageId) {
      this.model.appendToMessage(messageId, content);
    }
  }

  /**
   * Execute commands from chat response
   */
  executeCommands(commands) {
    for (const command of commands) {
      switch(command.type) {
        case 'show_artifacts':
          this.showArtifacts = true;
          this.notifyViewListeners('show_artifacts_panel');
          break;
        
        case 'show_diagram':
          this.notifyViewListeners('show_diagram', command);
          break;
        
        case 'navigate_to':
          this.notifyViewListeners('navigate', command);
          break;
        
        default:
          console.log('[SDChatViewModel] Unknown command:', command);
      }
    }
  }

  /**
   * Send quick action
   */
  sendQuickAction(action) {
    this.sendMessage(action.message);
    this.showQuickActions = false;
    this.notifyViewListeners('quick_actions_hidden');
  }

  /**
   * Handle model changes
   */
  handleModelChange(event, data) {
    switch(event) {
      case 'message_added':
      case 'message_updated':
      case 'message_streamed':
        this.notifyViewListeners('messages_changed');
        break;
      
      case 'loading_changed':
        this.notifyViewListeners('loading_changed', data);
        break;
      
      case 'connection_changed':
        this.notifyViewListeners('connection_changed', data);
        break;
      
      case 'project_changed':
        this.notifyViewListeners('project_changed', data);
        break;
      
      case 'error_changed':
        if (data) {
          this.showNotification({
            type: 'error',
            message: data
          });
        }
        break;
    }
  }

  /**
   * Show notification
   */
  showNotification(notification) {
    this.notifyViewListeners('notification', notification);
  }

  /**
   * Get formatted messages for display
   */
  getDisplayMessages() {
    const messages = this.model.getMessages();
    
    return messages.map(msg => ({
      ...msg,
      displayContent: this.formatMessageContent(msg.content),
      displayTime: this.formatTimestamp(msg.timestamp),
      hasArtifacts: msg.artifacts && msg.artifacts.length > 0,
      hasCommands: msg.commands && msg.commands.length > 0
    }));
  }

  /**
   * Format message content for display
   */
  formatMessageContent(content) {
    if (!content) return '';
    
    // Convert markdown-style formatting
    let formatted = content;
    
    // Bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    
    // Otherwise show date and time
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Update input value
   */
  updateInput(value) {
    this.inputValue = value;
    this.notifyViewListeners('input_changed', value);
  }

  /**
   * Handle typing indicator
   */
  setTyping(isTyping) {
    this.isTyping = isTyping;
    this.notifyViewListeners('typing_changed', isTyping);
  }

  /**
   * Toggle quick actions visibility
   */
  toggleQuickActions() {
    this.showQuickActions = !this.showQuickActions;
    this.notifyViewListeners('quick_actions_toggled', this.showQuickActions);
  }

  /**
   * Toggle artifacts panel
   */
  toggleArtifacts() {
    this.showArtifacts = !this.showArtifacts;
    this.notifyViewListeners('artifacts_toggled', this.showArtifacts);
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.model.isConnected,
      project: this.model.currentProject,
      projectStatus: this.model.projectStatus
    };
  }

  /**
   * Get chat statistics
   */
  getStatistics() {
    return this.model.getStatistics();
  }

  /**
   * Clear conversation
   */
  clearConversation() {
    this.model.clearMessages();
    this.streamingMessageId = null;
    this.notifyViewListeners('conversation_cleared');
  }

  /**
   * Export conversation
   */
  exportConversation() {
    const data = this.model.exportConversation();
    
    // Create download link
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sd-chat-${data.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showNotification({
      type: 'success',
      message: 'Conversation exported successfully'
    });
  }

  /**
   * Import conversation
   */
  importConversation(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.model.importConversation(data);
        
        this.showNotification({
          type: 'success',
          message: 'Conversation imported successfully'
        });
      } catch (error) {
        console.error('[SDChatViewModel] Import error:', error);
        
        this.showNotification({
          type: 'error',
          message: 'Failed to import conversation'
        });
      }
    };
    
    reader.readAsText(file);
  }

  /**
   * Subscribe to view updates
   */
  subscribe(listener) {
    this.viewListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.viewListeners.delete(listener);
    };
  }

  /**
   * Notify view listeners
   */
  notifyViewListeners(event, data) {
    for (const listener of this.viewListeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[SDChatViewModel] Error notifying listener:', error);
      }
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    this.viewListeners.clear();
    
    // Remove actor listeners if needed
    if (this.actor) {
      // Actor cleanup would go here
    }
  }
}