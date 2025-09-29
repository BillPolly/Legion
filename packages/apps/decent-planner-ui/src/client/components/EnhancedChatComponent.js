/**
 * EnhancedChatComponent - Chat interface with context and LLM debugging
 * 
 * Layout:
 * - Left pane: ChatComponent (messages + input)
 * - Draggable vertical divider
 * - Right pane: Tabs with Context Display and LLM Debug
 * 
 * Provides comprehensive observability of tool agent behavior.
 */

// ChatComponent deleted - implementing basic chat directly
import { ContextDisplayComponent } from './ContextDisplayComponent.js';
import { LLMDebugComponent } from './LLMDebugComponent.js';
import { TabsComponent } from './TabsComponent.js';

export class EnhancedChatComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      dividerPosition: options.dividerPosition || 70, // 70% for chat, 30% for debug
      activeDebugTab: 'context',
      messages: options.messages || [],
      connected: options.connected || false
    };
    
    // View elements
    this.elements = {};
    this.components = {};
    
    this.createLayout();
    this.initializeComponents();
    this.attachEventListeners();
  }

  /**
   * Create the split pane layout
   */
  createLayout() {
    this.container.innerHTML = '';
    
    // Main container with flexbox layout
    this.elements.mainContainer = document.createElement('div');
    this.elements.mainContainer.className = 'enhanced-chat-container';
    this.elements.mainContainer.style.display = 'flex';
    this.elements.mainContainer.style.height = 'calc(100vh - 140px)';
    this.elements.mainContainer.style.position = 'relative';
    
    // Left pane for chat
    this.elements.leftPane = document.createElement('div');
    this.elements.leftPane.className = 'chat-left-pane';
    this.elements.leftPane.style.flex = '1';
    this.elements.leftPane.style.minWidth = '300px';
    this.elements.leftPane.style.display = 'flex';
    this.elements.leftPane.style.flexDirection = 'column';
    this.elements.leftPane.style.overflow = 'hidden';
    this.elements.leftPane.style.height = '100%';
    
    // Draggable divider
    this.elements.divider = document.createElement('div');
    this.elements.divider.className = 'chat-divider';
    this.elements.divider.style.width = '4px';
    this.elements.divider.style.backgroundColor = '#d1d5db';
    this.elements.divider.style.cursor = 'col-resize';
    this.elements.divider.style.borderLeft = '1px solid #9ca3af';
    this.elements.divider.style.borderRight = '1px solid #9ca3af';
    this.elements.divider.style.position = 'relative';
    this.elements.divider.style.zIndex = '10';
    
    // Divider hover effect
    this.elements.divider.addEventListener('mouseenter', () => {
      this.elements.divider.style.backgroundColor = '#9ca3af';
    });
    this.elements.divider.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.elements.divider.style.backgroundColor = '#d1d5db';
      }
    });
    
    // Right pane for debug tabs
    this.elements.rightPane = document.createElement('div');
    this.elements.rightPane.className = 'chat-right-pane';
    this.elements.rightPane.style.width = `${100 - this.model.dividerPosition}%`;
    this.elements.rightPane.style.minWidth = '250px';
    this.elements.rightPane.style.maxWidth = '50%';
    this.elements.rightPane.style.borderLeft = '1px solid #ddd';
    this.elements.rightPane.style.overflow = 'hidden';
    this.elements.rightPane.style.height = '100%';
    this.elements.rightPane.style.display = 'flex';
    this.elements.rightPane.style.flexDirection = 'column';
    
    // Set left pane width
    this.elements.leftPane.style.width = `${this.model.dividerPosition}%`;
    
    // Assemble layout
    this.elements.mainContainer.appendChild(this.elements.leftPane);
    this.elements.mainContainer.appendChild(this.elements.divider);
    this.elements.mainContainer.appendChild(this.elements.rightPane);
    
    this.container.appendChild(this.elements.mainContainer);
  }

  /**
   * Initialize child components
   */
  initializeComponents() {
    // Create basic chat interface directly in left pane
    this.createBasicChatInterface();
    
    // Create tabs for right pane
    this.components.tabs = new TabsComponent(this.elements.rightPane, {
      tabs: [
        { 
          id: 'context', 
          label: 'Context', 
          icon: '📝' 
        },
        { 
          id: 'llm-debug', 
          label: 'LLM Debug', 
          icon: '🧠' 
        }
      ],
      activeTab: this.model.activeDebugTab,
      onTabChange: (tabId) => this.handleDebugTabChange(tabId)
    });
    
    // Initialize context display component
    const contextContainer = this.components.tabs.getContentContainer('context');
    if (contextContainer) {
      this.components.context = new ContextDisplayComponent(contextContainer);
      this.components.context.setClearContextCallback(() => {
        if (this.options.onClearContext) {
          this.options.onClearContext();
        }
      });
    }
    
    // Initialize LLM debug component
    const llmContainer = this.components.tabs.getContentContainer('llm-debug');
    if (llmContainer) {
      this.components.llmDebug = new LLMDebugComponent(llmContainer);
    }
  }

  /**
   * Create proper chat interface - restored from deleted ChatComponent
   */
  createBasicChatInterface() {
    // Create main chat container
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.style.height = '100%';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    
    // Connection status
    const connectionStatus = document.createElement('div');
    connectionStatus.className = 'chat-connection-status';
    connectionStatus.style.padding = '5px 10px';
    connectionStatus.style.fontSize = '12px';
    connectionStatus.style.backgroundColor = '#e8f5e8';
    connectionStatus.style.color = '#2e7d2e';
    connectionStatus.textContent = '🟢 Connected to server';
    chatContainer.appendChild(connectionStatus);
    
    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'chat-messages-container';
    messagesContainer.style.flex = '1';
    messagesContainer.style.overflow = 'auto';
    messagesContainer.style.padding = '10px';
    messagesContainer.style.backgroundColor = '#ffffff';
    
    const messagesList = document.createElement('div');
    messagesList.className = 'chat-messages-list';
    messagesContainer.appendChild(messagesList);
    chatContainer.appendChild(messagesContainer);
    
    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input-container';
    inputContainer.style.padding = '10px';
    inputContainer.style.borderTop = '1px solid #ddd';
    inputContainer.style.display = 'flex';
    inputContainer.style.gap = '10px';
    inputContainer.style.backgroundColor = '#f8f9fa';
    
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'chat-input';
    inputField.placeholder = 'Type a message or /help for commands...';
    inputField.style.flex = '1';
    inputField.style.padding = '8px';
    inputField.style.border = '1px solid #ccc';
    inputField.style.borderRadius = '4px';
    inputField.style.fontSize = '14px';
    inputContainer.appendChild(inputField);
    
    const sendButton = document.createElement('button');
    sendButton.className = 'chat-send-button';
    sendButton.textContent = '📤 Send';
    sendButton.style.padding = '8px 16px';
    sendButton.style.border = 'none';
    sendButton.style.borderRadius = '4px';
    sendButton.style.backgroundColor = '#3b82f6';
    sendButton.style.color = 'white';
    sendButton.style.cursor = 'pointer';
    sendButton.style.fontSize = '14px';
    sendButton.style.fontWeight = '500';
    inputContainer.appendChild(sendButton);
    
    chatContainer.appendChild(inputContainer);
    this.elements.leftPane.appendChild(chatContainer);
    
    // Store references
    this.chatElements = {
      container: chatContainer,
      connectionStatus: connectionStatus,
      messages: messagesList,
      input: inputField,
      button: sendButton
    };
    
    // Bind events
    sendButton.addEventListener('click', () => {
      const text = inputField.value.trim();
      if (text && this.options.onSendMessage) {
        this.options.onSendMessage({ text });
        inputField.value = '';
      }
    });
    
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendButton.click();
      }
    });
  }

  /**
   * Add a properly styled message to the chat
   */
  addMessage(text, type = 'user') {
    if (!this.chatElements?.messages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    
    // Better styling based on message type
    const baseStyle = 'margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; max-width: 80%; word-wrap: break-word; font-size: 14px; line-height: 1.4;';
    
    let typeStyle = '';
    switch (type) {
      case 'user':
        typeStyle = 'background: #3b82f6; color: white; margin-left: auto; align-self: flex-end;';
        break;
      case 'agent':
        typeStyle = 'background: #f1f3f4; color: #333; border-left: 3px solid #3b82f6;';
        break;
      case 'error':
      case 'command-error':
        typeStyle = 'background: #ffebee; color: #c62828; border-left: 3px solid #f44336;';
        break;
      case 'thinking':
        typeStyle = 'background: #fff3e0; color: #ef6c00; font-style: italic; border-left: 3px solid #ff9800;';
        break;
      case 'command':
        typeStyle = 'background: #e8f5e8; color: #2e7d2e; font-family: monospace; border-left: 3px solid #4caf50;';
        break;
      default:
        typeStyle = 'background: #f1f3f4; color: #333;';
    }
    
    messageDiv.style.cssText = baseStyle + typeStyle;
    messageDiv.textContent = text;
    
    this.chatElements.messages.appendChild(messageDiv);
    this.chatElements.messages.scrollTop = this.chatElements.messages.scrollHeight;
  }

  /**
   * Methods expected by ChatClientSubActor - compatibility layer
   */
  updateMessages(messages) {
    console.log('💬 EnhancedChatComponent updateMessages called with', messages?.length || 0, 'messages');
    // Clear and redraw all messages
    if (this.chatElements?.messages) {
      this.chatElements.messages.innerHTML = '';
      messages.forEach(msg => {
        this.addMessage(msg.text, msg.sender === 'user' ? 'user' : 'agent');
      });
    }
  }

  updateConnectionStatus(connected) {
    console.log('💬 EnhancedChatComponent updateConnectionStatus called with', connected);
    if (this.chatElements?.connectionStatus) {
      if (connected) {
        this.chatElements.connectionStatus.textContent = '🟢 Connected to server';
        this.chatElements.connectionStatus.style.backgroundColor = '#e8f5e8';
        this.chatElements.connectionStatus.style.color = '#2e7d2e';
      } else {
        this.chatElements.connectionStatus.textContent = '🔴 Disconnected from server';
        this.chatElements.connectionStatus.style.backgroundColor = '#ffebee';
        this.chatElements.connectionStatus.style.color = '#c62828';
      }
    }
  }

  addAgentMessage(messageData) {
    console.log('💬 EnhancedChatComponent addAgentMessage called with:', messageData);
    this.addMessage(messageData.text, 'agent');
  }

  addAgentError(errorData) {
    console.log('💬 EnhancedChatComponent addAgentError called with:', errorData);
    this.addMessage(errorData.text, 'error');
  }

  addAgentThinking(thinkingData) {
    console.log('💬 EnhancedChatComponent addAgentThinking called with:', thinkingData);
    this.addMessage(thinkingData.message, 'thinking');
  }

  addCommandResponse(responseData) {
    console.log('💬 EnhancedChatComponent addCommandResponse called with:', responseData);
    this.addMessage(responseData.text, 'command');
  }

  addCommandError(errorData) {
    console.log('💬 EnhancedChatComponent addCommandError called with:', errorData);
    this.addMessage(errorData.text, 'command-error');
  }

  clearInput() {
    if (this.chatElements?.input) {
      this.chatElements.input.value = '';
    }
  }

  focusInput() {
    if (this.chatElements?.input) {
      this.chatElements.input.focus();
    }
  }

  /**
   * Attach event listeners for divider dragging
   */
  attachEventListeners() {
    this.isDragging = false;
    this.dragStartX = 0;
    this.startLeftWidth = 0;
    
    // Mouse down on divider
    this.elements.divider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      
      const containerRect = this.elements.mainContainer.getBoundingClientRect();
      this.startLeftWidth = this.elements.leftPane.getBoundingClientRect().width;
      this.containerWidth = containerRect.width;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      // Add document listeners for drag
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    });
  }

  /**
   * Handle mouse move during divider drag
   */
  handleMouseMove = (e) => {
    if (!this.isDragging) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - this.dragStartX;
    const newLeftWidth = this.startLeftWidth + deltaX;
    const newPosition = (newLeftWidth / this.containerWidth) * 100;
    
    // Clamp position between 30% and 80%
    const clampedPosition = Math.max(30, Math.min(80, newPosition));
    
    this.updateDividerPosition(clampedPosition);
  }

  /**
   * Handle mouse up to end divider drag
   */
  handleMouseUp = (e) => {
    if (!this.isDragging) return;
    
    e.preventDefault();
    this.isDragging = false;
    
    // Reset cursor and selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.elements.divider.style.backgroundColor = '#d1d5db';
    
    // Remove document listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Callback for position change
    if (this.options.onDividerResize) {
      this.options.onDividerResize(this.model.dividerPosition);
    }
  }

  /**
   * Update divider position
   */
  updateDividerPosition(position) {
    this.model.dividerPosition = position;
    
    this.elements.leftPane.style.width = `${position}%`;
    this.elements.rightPane.style.width = `${100 - position}%`;
  }

  /**
   * Handle debug tab change
   */
  handleDebugTabChange(tabId) {
    this.model.activeDebugTab = tabId;
    
    if (this.options.onDebugTabChange) {
      this.options.onDebugTabChange(tabId);
    }
  }

  /**
   * Update chat messages (delegate to ChatComponent)
   */
  updateMessages(messages) {
    this.model.messages = messages;
    if (this.components.chat) {
      // Simple message update - just store in model
      this.model.messages = messages;
    }
  }

  /**
   * Update connection status (delegate to ChatComponent)
   */
  updateConnectionStatus(connected) {
    this.model.connected = connected;
    if (this.components.chat) {
      // Simple connection status - store in model
      this.model.connected = connected;
    }
  }

  /**
   * Add agent message (delegate to ChatComponent)
   */
  addAgentMessage(messageData) {
    if (this.components.chat) {
      // Add simple message to chat
      this.addMessage(messageData.text, 'agent');
    }
  }

  /**
   * Add agent error (delegate to ChatComponent)
   */
  addAgentError(errorData) {
    if (this.components.chat) {
      // Add simple error message
      this.addMessage(errorData.text, 'error');
    }
  }

  /**
   * Add agent thinking message (delegate to ChatComponent)
   */
  addAgentThinking(thinkingData) {
    if (this.components.chat) {
      // Add simple thinking message
      this.addMessage(thinkingData.message, 'thinking');
    }
  }

  /**
   * Add command response message (delegate to ChatComponent)
   */
  addCommandResponse(responseData) {
    if (this.components.chat) {
      // Add simple command response
      this.addMessage(responseData.text, 'command');
    }
  }

  /**
   * Add command error message (delegate to ChatComponent)
   */
  addCommandError(errorData) {
    if (this.components.chat) {
      // Add simple command error
      this.addMessage(errorData.text, 'command-error');
    }
  }

  /**
   * Update context display
   */
  updateContext(contextState) {
    if (this.components.context) {
      this.components.context.updateContext(contextState);
    }
  }

  /**
   * Add LLM interaction to debug panel
   */
  addLLMInteraction(interaction) {
    if (this.components.llmDebug) {
      this.components.llmDebug.addInteraction(interaction);
    }
  }

  /**
   * Add operation to context history
   */
  addOperation(operation) {
    if (this.components.context) {
      this.components.context.addOperation(operation);
    }
  }

  /**
   * Clear input (delegate to ChatComponent)
   */
  clearInput() {
    if (this.components.chat) {
      // Clear input
      if (this.chatElements?.input) this.chatElements.input.value = '';
    }
  }

  /**
   * Focus input (delegate to ChatComponent)
   */
  focusInput() {
    if (this.components.chat) {
      // Focus input
      if (this.chatElements?.input) this.chatElements.input.focus();
    }
  }

  /**
   * Clear all debug data
   */
  clearDebugData() {
    if (this.components.context) {
      this.components.context.clear();
    }
    if (this.components.llmDebug) {
      this.components.llmDebug.clearHistory();
    }
  }

  /**
   * Switch to specific debug tab
   */
  switchToDebugTab(tabId) {
    if (this.components.tabs) {
      this.components.tabs.switchTab(tabId);
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      dividerPosition: this.model.dividerPosition,
      activeDebugTab: this.model.activeDebugTab,
      messageCount: this.model.messages.length,
      components: {
        chat: !!this.components.chat,
        context: !!this.components.context,
        llmDebug: !!this.components.llmDebug,
        tabs: !!this.components.tabs
      }
    };
  }

  /**
   * Add context state information - compatibility method for ChatClientSubActor
   */
  addContextState(contextData) {
    console.log('💬 EnhancedChatComponent addContextState called with:', contextData);
    // Forward to context display component if it exists
    if (this.components.contextDisplay && typeof this.components.contextDisplay.updateContextState === 'function') {
      this.components.contextDisplay.updateContextState(contextData.contextState);
    } else {
      console.log('💬 No context display component found or no updateContextState method');
    }
  }

  /**
   * Destroy component and cleanup
   */
  /**
   * Add context state (delegate to context display component)
   * @param {Object} contextData - Context state data to display
   */
  addContextState(contextData) {
    if (this.components.context && this.components.context.addContextState) {
      this.components.context.addContextState(contextData);
    } else {
      console.warn('Context display component not available for addContextState');
    }
  }

  destroy() {
    // Remove document event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Reset body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Cleanup child components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    // Clear container
    this.container.innerHTML = '';
  }
}