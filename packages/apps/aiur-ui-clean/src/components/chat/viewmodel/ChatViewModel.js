/**
 * ChatViewModel - Coordinates between Model and View, handles business logic
 */
export class ChatViewModel {
  constructor(model, view, chatActor) {
    this.model = model;
    this.view = view;
    this.chatActor = chatActor;
    
    // Track streaming messages
    this.streamingMessageId = null;
    
    // Set up model listeners
    this.setupModelListeners();
    
    // Set up view event handlers
    this.setupViewHandlers();
    
    // Set up actor listeners
    this.setupActorListeners();
    
    // Initialize view with any existing messages
    this.initializeView();
  }
  
  /**
   * Set up listeners for model changes
   */
  setupModelListeners() {
    this.model.subscribe((event, data) => {
      switch (event) {
        case 'message_added':
          this.view.addMessage(data);
          break;
          
        case 'message_updated':
          this.view.updateMessage(data.id, data.content);
          break;
          
        case 'message_streamed':
          this.view.updateMessage(data.messageId, 
            this.model.messages.find(m => m.id === data.messageId)?.content || '');
          break;
          
        case 'messages_cleared':
          this.view.clearMessages();
          break;
          
        case 'loading_changed':
          if (data) {
            this.view.showLoading();
            this.view.setInputEnabled(false);
          } else {
            this.view.hideLoading();
            this.view.setInputEnabled(true);
          }
          break;
          
        case 'error_changed':
          if (data) {
            this.view.showError(data);
          } else {
            this.view.hideError();
          }
          break;
      }
    });
  }
  
  /**
   * Set up view event handlers
   */
  setupViewHandlers() {
    // Handle send message
    this.view.eventHandlers.onSend = async (message) => {
      await this.sendMessage(message);
    };
    
    // Handle input change (for future features like typing indicators)
    this.view.eventHandlers.onInputChange = (value) => {
      // Could implement typing indicators here
    };
    
    // Handle clear chat
    this.view.eventHandlers.onClear = () => {
      this.clearChat();
    };
  }
  
  /**
   * Set up actor listeners for server responses
   */
  setupActorListeners() {
    if (!this.chatActor) return;
    
    // Listen for chat responses
    this.chatActor.onResponse = (response) => {
      this.handleChatResponse(response);
    };
    
    // Listen for streaming chunks
    this.chatActor.onStream = (chunk) => {
      this.handleStreamChunk(chunk);
    };
    
    // Listen for errors
    this.chatActor.onError = (error) => {
      this.handleError(error);
    };
    
    // Listen for connection status
    this.chatActor.onConnectionChange = (connected) => {
      this.handleConnectionChange(connected);
    };
  }
  
  /**
   * Initialize view with existing messages
   */
  initializeView() {
    const messages = this.model.getMessages();
    messages.forEach(message => {
      this.view.addMessage(message);
    });
    
    // Set initial loading state
    if (this.model.isLoading) {
      this.view.showLoading();
      this.view.setInputEnabled(false);
    }
    
    // Show any existing error
    if (this.model.error) {
      this.view.showError(this.model.error);
    }
  }
  
  /**
   * Send a message
   */
  async sendMessage(content) {
    // Validate message
    const validation = this.model.validateMessage(content);
    if (!validation.valid) {
      this.model.setError(validation.error);
      return;
    }
    
    // Clear any previous error
    this.model.clearError();
    
    // Add user message to model
    const userMessage = this.model.addMessage(content, 'user');
    
    // Set loading state
    this.model.setLoading(true);
    
    try {
      // Send message via actor
      if (this.chatActor && this.chatActor.isConnected()) {
        await this.chatActor.sendChatMessage(content);
      } else {
        throw new Error('Not connected to chat server');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.model.setError(`Failed to send message: ${error.message}`);
      this.model.setLoading(false);
    }
  }
  
  /**
   * Handle chat response from server
   */
  handleChatResponse(response) {
    // Stop loading
    this.model.setLoading(false);
    
    // If this is a complete response, add or update the assistant message
    if (response.isComplete) {
      if (this.streamingMessageId) {
        // Update the streaming message to complete
        this.model.updateMessage(this.streamingMessageId, {
          content: response.content,
          isComplete: true
        });
        this.streamingMessageId = null;
      } else {
        // Add new assistant message
        this.model.addMessage(response.content, 'assistant', {
          isComplete: true
        });
      }
    }
  }
  
  /**
   * Handle streaming chunk from server
   */
  handleStreamChunk(chunk) {
    // If no streaming message exists, create one
    if (!this.streamingMessageId) {
      const message = this.model.addMessage('', 'assistant', {
        isStreaming: true,
        isComplete: false
      });
      this.streamingMessageId = message.id;
    }
    
    // Append chunk to streaming message
    this.model.appendToMessage(this.streamingMessageId, chunk.content);
  }
  
  /**
   * Handle errors from server
   */
  handleError(error) {
    console.error('Chat error:', error);
    
    // Stop loading
    this.model.setLoading(false);
    
    // Clear streaming message if exists
    if (this.streamingMessageId) {
      this.model.updateMessage(this.streamingMessageId, {
        content: '[Message failed to complete]',
        isComplete: true,
        hasError: true
      });
      this.streamingMessageId = null;
    }
    
    // Show error
    this.model.setError(error.message || 'An error occurred');
  }
  
  /**
   * Handle connection status changes
   */
  handleConnectionChange(connected) {
    if (!connected) {
      this.model.setError('Disconnected from chat server');
      this.view.setInputEnabled(false);
    } else {
      this.model.clearError();
      this.view.setInputEnabled(true);
      
      // Add system message
      this.model.addMessage('Connected to chat server', 'system', {
        isSystem: true
      });
    }
  }
  
  /**
   * Clear chat history
   */
  clearChat() {
    this.model.clearMessages();
    this.streamingMessageId = null;
    
    // Send clear command to server if connected
    if (this.chatActor && this.chatActor.isConnected()) {
      this.chatActor.clearHistory();
    }
  }
  
  /**
   * Export chat history
   */
  exportChat() {
    return this.model.exportHistory();
  }
  
  /**
   * Import chat history
   */
  importChat(history) {
    const success = this.model.importHistory(history);
    
    if (success) {
      // Re-render all messages
      this.view.clearMessages();
      this.initializeView();
    }
    
    return success;
  }
  
  /**
   * Get current conversation text
   */
  getConversationText() {
    return this.model.getConversationText();
  }
  
  /**
   * Destroy the view model
   */
  destroy() {
    // Clear model listeners
    this.model.listeners.clear();
    
    // Clear view handlers
    this.view.eventHandlers = {};
    
    // Clear actor listeners
    if (this.chatActor) {
      this.chatActor.onResponse = null;
      this.chatActor.onStream = null;
      this.chatActor.onError = null;
      this.chatActor.onConnectionChange = null;
    }
    
    // Clear references
    this.model = null;
    this.view = null;
    this.chatActor = null;
  }
}