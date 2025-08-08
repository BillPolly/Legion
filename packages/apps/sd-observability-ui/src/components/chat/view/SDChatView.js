/**
 * SDChatView - View component for SD observability chat
 * 
 * Renders the chat interface and handles user interactions
 */

export class SDChatView {
  constructor(viewModel, container) {
    this.viewModel = viewModel;
    this.container = container;
    
    // DOM references
    this.elements = {};
    
    // Initialize view
    this.initialize();
    
    // Subscribe to view model changes
    this.unsubscribe = this.viewModel.subscribe((event, data) => {
      this.handleViewModelChange(event, data);
    });
  }

  /**
   * Initialize the view
   */
  initialize() {
    // Create HTML structure
    this.render();
    
    // Cache DOM references
    this.cacheElements();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial render of messages
    this.renderMessages();
    
    // Render quick actions
    this.renderQuickActions();
  }

  /**
   * Render the main HTML structure
   */
  render() {
    this.container.innerHTML = `
      <div class="sd-chat-container">
        <div class="sd-chat-header">
          <div class="sd-chat-title">
            <span class="sd-chat-icon">💬</span>
            <h3>SD System Assistant</h3>
          </div>
          <div class="sd-chat-status">
            <span class="connection-indicator"></span>
            <span class="project-info"></span>
          </div>
          <div class="sd-chat-actions">
            <button class="btn-icon" data-action="toggle-artifacts" title="Show Artifacts">
              📦
            </button>
            <button class="btn-icon" data-action="clear" title="Clear Chat">
              🗑️
            </button>
            <button class="btn-icon" data-action="export" title="Export Chat">
              💾
            </button>
          </div>
        </div>
        
        <div class="sd-chat-messages" id="sd-chat-messages">
          <div class="messages-container"></div>
          <div class="typing-indicator" style="display: none;">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        <div class="sd-chat-quick-actions" id="sd-quick-actions">
          <!-- Quick actions will be rendered here -->
        </div>
        
        <div class="sd-chat-input-container">
          <div class="sd-chat-input-wrapper">
            <textarea 
              class="sd-chat-input" 
              placeholder="Ask about the SD system, agents, or current progress..."
              rows="1"
            ></textarea>
            <button class="sd-chat-send" disabled>
              <span class="send-icon">➤</span>
            </button>
          </div>
          <div class="sd-chat-input-actions">
            <button class="btn-text" data-action="toggle-quick">
              Quick Actions
            </button>
            <span class="char-count">0</span>
          </div>
        </div>
        
        <div class="sd-chat-artifacts-panel" style="display: none;">
          <div class="artifacts-header">
            <h4>Referenced Artifacts</h4>
            <button class="btn-icon" data-action="close-artifacts">✕</button>
          </div>
          <div class="artifacts-list"></div>
        </div>
      </div>
    `;
    
    // Add styles
    this.addStyles();
  }

  /**
   * Add CSS styles
   */
  addStyles() {
    if (document.getElementById('sd-chat-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'sd-chat-styles';
    styles.textContent = `
      .sd-chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .sd-chat-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
      }
      
      .sd-chat-title {
        display: flex;
        align-items: center;
        flex: 1;
      }
      
      .sd-chat-icon {
        font-size: 20px;
        margin-right: 8px;
      }
      
      .sd-chat-title h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
      }
      
      .sd-chat-status {
        display: flex;
        align-items: center;
        margin-right: 16px;
        font-size: 12px;
        color: #969696;
      }
      
      .connection-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ffc107;
        margin-right: 8px;
      }
      
      .connection-indicator.connected {
        background: #4caf50;
      }
      
      .connection-indicator.disconnected {
        background: #f44336;
      }
      
      .sd-chat-actions {
        display: flex;
        gap: 8px;
      }
      
      .btn-icon {
        background: transparent;
        border: none;
        color: #969696;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .btn-icon:hover {
        background: #3e3e42;
        color: #d4d4d4;
      }
      
      .sd-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #1e1e1e;
      }
      
      .messages-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .chat-message {
        display: flex;
        gap: 12px;
        animation: fadeIn 0.3s ease-in;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      
      .message-avatar.user {
        background: #007acc;
      }
      
      .message-avatar.assistant {
        background: #4caf50;
      }
      
      .message-content {
        flex: 1;
      }
      
      .message-header {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
        gap: 8px;
      }
      
      .message-role {
        font-weight: 500;
        font-size: 14px;
      }
      
      .message-time {
        font-size: 12px;
        color: #969696;
      }
      
      .message-text {
        font-size: 14px;
        line-height: 1.6;
      }
      
      .message-text code {
        background: #2d2d30;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', monospace;
      }
      
      .message-text pre {
        background: #2d2d30;
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
      }
      
      .message-artifacts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      
      .artifact-chip {
        background: #2d2d30;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .artifact-chip:hover {
        background: #3e3e42;
      }
      
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 8px;
      }
      
      .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #969696;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }
      
      .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes typing {
        0%, 60%, 100% {
          opacity: 0.3;
        }
        30% {
          opacity: 1;
        }
      }
      
      .sd-chat-quick-actions {
        padding: 12px 16px;
        background: #252526;
        border-top: 1px solid #3e3e42;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .quick-action-btn {
        background: #2d2d30;
        border: 1px solid #3e3e42;
        color: #d4d4d4;
        padding: 8px 12px;
        border-radius: 16px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .quick-action-btn:hover {
        background: #3e3e42;
        border-color: #007acc;
      }
      
      .sd-chat-input-container {
        padding: 12px 16px;
        background: #252526;
        border-top: 1px solid #3e3e42;
      }
      
      .sd-chat-input-wrapper {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      
      .sd-chat-input {
        flex: 1;
        background: #1e1e1e;
        border: 1px solid #3e3e42;
        color: #d4d4d4;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        resize: none;
        min-height: 36px;
        max-height: 120px;
        font-family: inherit;
      }
      
      .sd-chat-input:focus {
        outline: none;
        border-color: #007acc;
      }
      
      .sd-chat-send {
        background: #007acc;
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .sd-chat-send:hover:not(:disabled) {
        background: #0098ff;
      }
      
      .sd-chat-send:disabled {
        background: #3e3e42;
        cursor: not-allowed;
        opacity: 0.5;
      }
      
      .sd-chat-input-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        font-size: 12px;
      }
      
      .btn-text {
        background: transparent;
        border: none;
        color: #007acc;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 12px;
        transition: color 0.2s;
      }
      
      .btn-text:hover {
        color: #0098ff;
      }
      
      .char-count {
        color: #969696;
      }
      
      .sd-chat-artifacts-panel {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 300px;
        background: #252526;
        border-left: 1px solid #3e3e42;
        display: flex;
        flex-direction: column;
      }
      
      .artifacts-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #3e3e42;
      }
      
      .artifacts-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
      }
      
      .artifacts-list {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      
      .artifact-item {
        padding: 8px;
        margin-bottom: 8px;
        background: #1e1e1e;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .artifact-item:hover {
        background: #2d2d30;
      }
      
      .artifact-name {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 4px;
      }
      
      .artifact-type {
        font-size: 11px;
        color: #969696;
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.elements = {
      messagesContainer: this.container.querySelector('.messages-container'),
      messagesScroll: this.container.querySelector('.sd-chat-messages'),
      input: this.container.querySelector('.sd-chat-input'),
      sendButton: this.container.querySelector('.sd-chat-send'),
      quickActions: this.container.querySelector('#sd-quick-actions'),
      typingIndicator: this.container.querySelector('.typing-indicator'),
      connectionIndicator: this.container.querySelector('.connection-indicator'),
      projectInfo: this.container.querySelector('.project-info'),
      artifactsPanel: this.container.querySelector('.sd-chat-artifacts-panel'),
      artifactsList: this.container.querySelector('.artifacts-list'),
      charCount: this.container.querySelector('.char-count')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input events
    this.elements.input.addEventListener('input', (e) => {
      this.handleInputChange(e.target.value);
    });
    
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    // Send button
    this.elements.sendButton.addEventListener('click', () => {
      this.handleSend();
    });
    
    // Action buttons
    this.container.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        this.handleAction(action.dataset.action);
      }
      
      // Quick action buttons
      if (e.target.classList.contains('quick-action-btn')) {
        const index = e.target.dataset.index;
        this.handleQuickAction(index);
      }
    });
  }

  /**
   * Handle input change
   */
  handleInputChange(value) {
    this.viewModel.updateInput(value);
    
    // Update send button state
    this.elements.sendButton.disabled = !value.trim();
    
    // Update character count
    this.elements.charCount.textContent = value.length;
    
    // Auto-resize textarea
    this.elements.input.style.height = 'auto';
    this.elements.input.style.height = Math.min(120, this.elements.input.scrollHeight) + 'px';
  }

  /**
   * Handle send message
   */
  handleSend() {
    const value = this.elements.input.value.trim();
    if (value) {
      this.viewModel.sendMessage(value);
      this.elements.input.value = '';
      this.handleInputChange('');
    }
  }

  /**
   * Handle action buttons
   */
  handleAction(action) {
    switch(action) {
      case 'toggle-artifacts':
        this.viewModel.toggleArtifacts();
        break;
      
      case 'clear':
        if (confirm('Clear all messages?')) {
          this.viewModel.clearConversation();
        }
        break;
      
      case 'export':
        this.viewModel.exportConversation();
        break;
      
      case 'toggle-quick':
        this.viewModel.toggleQuickActions();
        break;
      
      case 'close-artifacts':
        this.viewModel.toggleArtifacts();
        break;
    }
  }

  /**
   * Handle quick action selection
   */
  handleQuickAction(index) {
    const actions = this.viewModel.model.getQuickActions();
    if (actions[index]) {
      this.viewModel.sendQuickAction(actions[index]);
    }
  }

  /**
   * Render messages
   */
  renderMessages() {
    const messages = this.viewModel.getDisplayMessages();
    
    this.elements.messagesContainer.innerHTML = messages.map(msg => `
      <div class="chat-message">
        <div class="message-avatar ${msg.role}">
          ${msg.role === 'user' ? '👤' : '🤖'}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-role">${msg.role === 'user' ? 'You' : 'SD Assistant'}</span>
            <span class="message-time">${msg.displayTime}</span>
          </div>
          <div class="message-text">${msg.displayContent}</div>
          ${msg.hasArtifacts ? this.renderArtifacts(msg.artifacts) : ''}
        </div>
      </div>
    `).join('');
    
    // Scroll to bottom
    this.scrollToBottom();
  }

  /**
   * Render artifacts in message
   */
  renderArtifacts(artifacts) {
    return `
      <div class="message-artifacts">
        ${artifacts.map(a => `
          <div class="artifact-chip" data-artifact-id="${a.id}">
            📄 ${a.name || a.type}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render quick actions
   */
  renderQuickActions() {
    const actions = this.viewModel.model.getQuickActions();
    
    if (!this.viewModel.showQuickActions || actions.length === 0) {
      this.elements.quickActions.style.display = 'none';
      return;
    }
    
    this.elements.quickActions.style.display = 'flex';
    this.elements.quickActions.innerHTML = actions.map((action, index) => `
      <button class="quick-action-btn" data-index="${index}">
        ${action.label}
      </button>
    `).join('');
  }

  /**
   * Handle view model changes
   */
  handleViewModelChange(event, data) {
    switch(event) {
      case 'messages_changed':
        this.renderMessages();
        break;
      
      case 'loading_changed':
        this.updateLoadingState(data);
        break;
      
      case 'connection_changed':
        this.updateConnectionStatus(data);
        break;
      
      case 'project_changed':
        this.updateProjectInfo(data);
        break;
      
      case 'quick_actions_toggled':
        this.renderQuickActions();
        break;
      
      case 'artifacts_toggled':
        this.toggleArtifactsPanel();
        break;
      
      case 'typing_changed':
        this.elements.typingIndicator.style.display = data ? 'flex' : 'none';
        break;
      
      case 'notification':
        this.showNotification(data);
        break;
      
      case 'input_cleared':
        this.elements.input.value = '';
        this.handleInputChange('');
        break;
      
      case 'conversation_cleared':
        this.renderMessages();
        break;
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState(isLoading) {
    this.elements.sendButton.disabled = isLoading || !this.elements.input.value.trim();
    
    if (isLoading) {
      this.elements.typingIndicator.style.display = 'flex';
    } else {
      this.elements.typingIndicator.style.display = 'none';
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(connected) {
    if (connected) {
      this.elements.connectionIndicator.classList.add('connected');
      this.elements.connectionIndicator.classList.remove('disconnected');
    } else {
      this.elements.connectionIndicator.classList.add('disconnected');
      this.elements.connectionIndicator.classList.remove('connected');
    }
  }

  /**
   * Update project info
   */
  updateProjectInfo(data) {
    if (data.projectId) {
      this.elements.projectInfo.textContent = `Project: ${data.projectId}`;
    } else {
      this.elements.projectInfo.textContent = 'No project selected';
    }
  }

  /**
   * Toggle artifacts panel
   */
  toggleArtifactsPanel() {
    const isVisible = this.viewModel.showArtifacts;
    this.elements.artifactsPanel.style.display = isVisible ? 'flex' : 'none';
    
    if (isVisible) {
      this.renderArtifactsList();
    }
  }

  /**
   * Render artifacts list
   */
  renderArtifactsList() {
    const artifacts = this.viewModel.model.getMentionedArtifacts();
    
    if (artifacts.length === 0) {
      this.elements.artifactsList.innerHTML = '<div style="padding: 16px; text-align: center; color: #969696;">No artifacts mentioned</div>';
      return;
    }
    
    this.elements.artifactsList.innerHTML = artifacts.map(a => `
      <div class="artifact-item" data-artifact-id="${a.id}">
        <div class="artifact-name">${a.name || 'Unnamed'}</div>
        <div class="artifact-type">${a.type}</div>
      </div>
    `).join('');
  }

  /**
   * Show notification
   */
  showNotification(notification) {
    // Could implement a toast notification system here
    console.log('[SDChatView] Notification:', notification);
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    this.elements.messagesScroll.scrollTop = this.elements.messagesScroll.scrollHeight;
  }

  /**
   * Dispose of the view
   */
  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    // Remove styles if no other instances
    const styles = document.getElementById('sd-chat-styles');
    if (styles) {
      styles.remove();
    }
    
    // Clear container
    this.container.innerHTML = '';
  }
}