/**
 * SDChatModel - Model for SD observability chat
 * 
 * Manages chat data and state for SD system observability
 */

export class SDChatModel {
  constructor() {
    // Chat messages
    this.messages = [];
    
    // Current state
    this.isLoading = false;
    this.error = null;
    this.isConnected = false;
    
    // Project context
    this.currentProject = null;
    this.projectStatus = null;
    
    // Artifacts mentioned in chat
    this.mentionedArtifacts = new Map();
    
    // Quick actions
    this.quickActions = [];
    
    // Listeners for model changes
    this.listeners = new Set();
    
    // Session info
    this.sessionId = `sd-chat-${Date.now()}`;
  }

  /**
   * Add a message to the conversation
   */
  addMessage(content, role = 'user', metadata = {}) {
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      role, // 'user', 'assistant', or 'system'
      timestamp: new Date().toISOString(),
      artifacts: metadata.artifacts || [],
      commands: metadata.commands || [],
      isStreaming: metadata.isStreaming || false,
      ...metadata
    };
    
    this.messages.push(message);
    this.notifyListeners('message_added', message);
    
    // Track mentioned artifacts
    if (message.artifacts && message.artifacts.length > 0) {
      for (const artifact of message.artifacts) {
        this.mentionedArtifacts.set(artifact.id, artifact);
      }
      this.notifyListeners('artifacts_mentioned', message.artifacts);
    }
    
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
   * Append content to a streaming message
   */
  appendToMessage(messageId, content) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (message && message.isStreaming) {
      message.content += content;
      message.updatedAt = new Date().toISOString();
      
      this.notifyListeners('message_streamed', { messageId, content });
      return message;
    }
    
    return null;
  }

  /**
   * Finish streaming a message
   */
  finishStreaming(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (message) {
      message.isStreaming = false;
      message.completedAt = new Date().toISOString();
      
      this.notifyListeners('streaming_finished', messageId);
      return message;
    }
    
    return null;
  }

  /**
   * Get all messages
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    return this.messages.find(m => m.id === messageId);
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
    this.mentionedArtifacts.clear();
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
   * Set connection state
   */
  setConnected(isConnected) {
    this.isConnected = isConnected;
    this.notifyListeners('connection_changed', isConnected);
  }

  /**
   * Set current project
   */
  setCurrentProject(projectId, projectStatus = null) {
    this.currentProject = projectId;
    this.projectStatus = projectStatus;
    this.notifyListeners('project_changed', { projectId, projectStatus });
  }

  /**
   * Update project status
   */
  updateProjectStatus(status) {
    this.projectStatus = status;
    this.notifyListeners('project_status_updated', status);
  }

  /**
   * Set quick actions
   */
  setQuickActions(actions) {
    this.quickActions = actions;
    this.notifyListeners('quick_actions_updated', actions);
  }

  /**
   * Get quick actions
   */
  getQuickActions() {
    return this.quickActions;
  }

  /**
   * Get mentioned artifacts
   */
  getMentionedArtifacts() {
    return Array.from(this.mentionedArtifacts.values());
  }

  /**
   * Add artifact to mentioned list
   */
  addMentionedArtifact(artifact) {
    this.mentionedArtifacts.set(artifact.id, artifact);
    this.notifyListeners('artifact_mentioned', artifact);
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
   * Notify all listeners of a change
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[SDChatModel] Error notifying listener:', error);
      }
    }
  }

  /**
   * Get conversation context for LLM
   */
  getConversationContext(limit = 10) {
    const recentMessages = this.messages.slice(-limit);
    
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const userMessages = this.messages.filter(m => m.role === 'user').length;
    const assistantMessages = this.messages.filter(m => m.role === 'assistant').length;
    const totalArtifacts = this.mentionedArtifacts.size;
    
    return {
      totalMessages: this.messages.length,
      userMessages,
      assistantMessages,
      totalArtifacts,
      sessionDuration: this.messages.length > 0 ? 
        new Date() - new Date(this.messages[0].timestamp) : 0
    };
  }

  /**
   * Export conversation
   */
  exportConversation() {
    return {
      sessionId: this.sessionId,
      project: this.currentProject,
      messages: this.messages,
      artifacts: Array.from(this.mentionedArtifacts.values()),
      exported: new Date().toISOString()
    };
  }

  /**
   * Import conversation
   */
  importConversation(data) {
    if (data.messages) {
      this.messages = data.messages;
    }
    
    if (data.artifacts) {
      this.mentionedArtifacts.clear();
      for (const artifact of data.artifacts) {
        this.mentionedArtifacts.set(artifact.id, artifact);
      }
    }
    
    if (data.project) {
      this.currentProject = data.project;
    }
    
    this.notifyListeners('conversation_imported', data);
  }
}