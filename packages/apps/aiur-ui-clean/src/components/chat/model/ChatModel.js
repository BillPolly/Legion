/**
 * ChatModel - Manages chat data and state
 */
export class ChatModel {
  constructor() {
    // Messages array storing conversation history
    this.messages = [];
    
    // Current state
    this.isLoading = false;
    this.error = null;
    
    // User info
    this.userId = `user-${Date.now()}`;
    
    // Listeners for model changes
    this.listeners = new Set();
  }
  
  /**
   * Add a message to the conversation
   */
  addMessage(content, role = 'user', metadata = {}) {
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      role, // 'user' or 'assistant'
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    this.messages.push(message);
    this.notifyListeners('message_added', message);
    
    return message;
  }
  
  /**
   * Update an existing message
   */
  updateMessage(messageId, updates) {
    const messageIndex = this.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {
        ...this.messages[messageIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      this.notifyListeners('message_updated', this.messages[messageIndex]);
      return this.messages[messageIndex];
    }
    
    return null;
  }
  
  /**
   * Append content to an existing message (for streaming)
   */
  appendToMessage(messageId, content) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (message) {
      message.content += content;
      this.notifyListeners('message_streamed', { messageId, content });
      return message;
    }
    
    return null;
  }
  
  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
    this.error = null;
    this.notifyListeners('messages_cleared');
  }
  
  /**
   * Set loading state
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.notifyListeners('loading_changed', isLoading);
  }
  
  /**
   * Set error state
   */
  setError(error) {
    this.error = error;
    this.notifyListeners('error_changed', error);
  }
  
  /**
   * Clear error
   */
  clearError() {
    this.error = null;
    this.notifyListeners('error_cleared');
  }
  
  /**
   * Get all messages
   */
  getMessages() {
    return [...this.messages];
  }
  
  /**
   * Get last message
   */
  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }
  
  /**
   * Get messages by role
   */
  getMessagesByRole(role) {
    return this.messages.filter(m => m.role === role);
  }
  
  /**
   * Check if there are any messages
   */
  hasMessages() {
    return this.messages.length > 0;
  }
  
  /**
   * Get conversation as formatted text
   */
  getConversationText() {
    return this.messages
      .map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  }
  
  /**
   * Subscribe to model changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of changes
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in model listener:', error);
      }
    });
  }
  
  /**
   * Export conversation history
   */
  exportHistory() {
    return {
      userId: this.userId,
      messages: this.messages,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import conversation history
   */
  importHistory(history) {
    if (history && Array.isArray(history.messages)) {
      this.messages = history.messages;
      this.notifyListeners('history_imported', history);
      return true;
    }
    return false;
  }
  
  /**
   * Validate message content
   */
  validateMessage(content) {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Message content must be a non-empty string' };
    }
    
    if (content.trim().length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }
    
    if (content.length > 10000) {
      return { valid: false, error: 'Message is too long (max 10000 characters)' };
    }
    
    return { valid: true };
  }
}