/**
 * ChatComponent - MVVM Component for chat functionality
 * Properly maintains element references and avoids innerHTML usage
 */

export class ChatComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      messages: options.messages || [],
      inputText: options.inputText || '',
      connected: options.connected || false,
      onSendMessage: options.onSendMessage || (() => {}),
      onInputChange: options.onInputChange || (() => {})
    };
    
    // View elements - maintain references for proper 2-way mapping
    this.elements = {
      root: null,
      messagesContainer: null,
      messagesList: null,
      inputContainer: null,
      inputField: null,
      sendButton: null,
      connectionStatus: null
    };
    
    // Message element tracking for incremental updates
    this.messageElements = new Map(); // messageId -> element
    
    this.createView();
    this.bindEvents();
    this.updateView();
  }
  
  // CREATE VIEW ONCE - no innerHTML usage
  createView() {
    this.elements.root = document.createElement('div');
    this.elements.root.className = 'chat-container';
    
    // Connection status
    this.elements.connectionStatus = document.createElement('div');
    this.elements.connectionStatus.className = 'chat-connection-status';
    this.elements.root.appendChild(this.elements.connectionStatus);
    
    // Messages container
    this.elements.messagesContainer = document.createElement('div');
    this.elements.messagesContainer.className = 'chat-messages-container';
    
    this.elements.messagesList = document.createElement('div');
    this.elements.messagesList.className = 'chat-messages-list';
    this.elements.messagesContainer.appendChild(this.elements.messagesList);
    
    this.elements.root.appendChild(this.elements.messagesContainer);
    
    // Input container
    this.elements.inputContainer = document.createElement('div');
    this.elements.inputContainer.className = 'chat-input-container';
    
    this.elements.inputField = document.createElement('input');
    this.elements.inputField.type = 'text';
    this.elements.inputField.className = 'chat-input';
    this.elements.inputField.placeholder = 'Type a message...';
    this.elements.inputContainer.appendChild(this.elements.inputField);
    
    this.elements.sendButton = document.createElement('button');
    this.elements.sendButton.className = 'chat-send-button';
    this.elements.sendButton.textContent = '📤 Send';
    this.elements.inputContainer.appendChild(this.elements.sendButton);
    
    this.elements.root.appendChild(this.elements.inputContainer);
    
    // Add to container
    this.container.appendChild(this.elements.root);
  }
  
  // BIND EVENTS ONCE
  bindEvents() {
    // Input field events
    this.elements.inputField.addEventListener('input', (e) => {
      this.model.inputText = e.target.value;
      this.model.onInputChange(this.model.inputText);
      this.updateSendButtonState();
    });
    
    this.elements.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
    
    // Send button
    this.elements.sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });
  }
  
  handleSendMessage() {
    if (!this.model.inputText.trim() || !this.model.connected) return;
    
    this.model.onSendMessage(this.model.inputText);
    // Input will be cleared by parent actor calling clearInput()
  }
  
  // UPDATE VIEW INCREMENTALLY - proper 2-way mapping
  updateView() {
    this.updateConnectionStatus(this.model.connected);
    this.updateMessages(this.model.messages);
    this.updateInputField();
    this.updateSendButtonState();
  }
  
  updateConnectionStatus(connected) {
    this.model.connected = connected;
    this.elements.connectionStatus.textContent = connected 
      ? '🟢 Chat Connected' 
      : '🔴 Chat Disconnected';
    this.elements.connectionStatus.className = `chat-connection-status ${connected ? 'connected' : 'disconnected'}`;
    this.updateSendButtonState();
  }
  
  updateMessages(messages) {
    this.model.messages = messages;
    
    // Get current message IDs
    const currentMessageIds = new Set(messages.map(msg => msg.id));
    
    // Remove messages that are no longer in the list
    for (const [messageId, element] of this.messageElements) {
      if (!currentMessageIds.has(messageId)) {
        element.remove();
        this.messageElements.delete(messageId);
      }
    }
    
    // Add or update messages
    messages.forEach((message, index) => {
      let messageElement = this.messageElements.get(message.id);
      
      if (!messageElement) {
        // Create new message element
        messageElement = this.createMessageElement(message);
        this.messageElements.set(message.id, messageElement);
        this.elements.messagesList.appendChild(messageElement);
      } else {
        // Update existing message element if needed
        this.updateMessageElement(messageElement, message);
      }
    });
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${message.sender}`;
    messageElement.setAttribute('data-message-id', message.id);
    
    const timestampElement = document.createElement('span');
    timestampElement.className = 'chat-message-timestamp';
    timestampElement.textContent = message.timestamp;
    
    const senderElement = document.createElement('span');
    senderElement.className = 'chat-message-sender';
    senderElement.textContent = message.sender === 'user' ? 'You' : (message.sender === 'agent' ? 'Tool Agent' : 'Server');
    
    const textElement = document.createElement('div');
    textElement.className = 'chat-message-text';
    textElement.textContent = message.text;
    
    messageElement.appendChild(timestampElement);
    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);
    
    // Add enhanced elements for agent messages
    if (message.sender === 'agent') {
      this.addAgentMessageEnhancements(messageElement, message);
    }
    
    return messageElement;
  }

  /**
   * Add enhancements for agent messages (tools used, context updates, etc.)
   */
  addAgentMessageEnhancements(messageElement, message) {
    // Add tools used indicator
    if (message.toolsUsed && message.toolsUsed.length > 0) {
      const toolsDiv = document.createElement('div');
      toolsDiv.className = 'chat-tools-used';
      toolsDiv.innerHTML = `🛠️ Tools used: ${message.toolsUsed.join(', ')}`;
      messageElement.appendChild(toolsDiv);
    }
    
    // Add context updates indicator
    if (message.contextUpdated && message.contextUpdated.length > 0) {
      const contextDiv = document.createElement('div');
      contextDiv.className = 'chat-context-updated';
      contextDiv.innerHTML = `📝 Stored: ${message.contextUpdated.join(', ')}`;
      messageElement.appendChild(contextDiv);
    }
    
    // Add reasoning (collapsible)
    if (message.reasoning) {
      const reasoningDiv = document.createElement('div');
      reasoningDiv.className = 'chat-reasoning';
      
      const reasoningToggle = document.createElement('button');
      reasoningToggle.className = 'reasoning-toggle';
      reasoningToggle.textContent = '🤔 Show reasoning';
      reasoningToggle.onclick = () => this.toggleReasoning(reasoningDiv, reasoningToggle);
      
      const reasoningContent = document.createElement('div');
      reasoningContent.className = 'reasoning-content';
      reasoningContent.style.display = 'none';
      reasoningContent.textContent = message.reasoning;
      
      reasoningDiv.appendChild(reasoningToggle);
      reasoningDiv.appendChild(reasoningContent);
      messageElement.appendChild(reasoningDiv);
    }
    
    // Add operation count
    if (message.operationCount !== undefined) {
      const opsDiv = document.createElement('div');
      opsDiv.className = 'chat-operations';
      opsDiv.innerHTML = `⚙️ Operations: ${message.operationCount}`;
      messageElement.appendChild(opsDiv);
    }
  }

  /**
   * Toggle reasoning visibility
   */
  toggleReasoning(reasoningDiv, toggleButton) {
    const content = reasoningDiv.querySelector('.reasoning-content');
    const isVisible = content.style.display !== 'none';
    
    content.style.display = isVisible ? 'none' : 'block';
    toggleButton.textContent = isVisible ? '🤔 Show reasoning' : '🤔 Hide reasoning';
  }
  
  updateMessageElement(element, message) {
    // Update text content if changed (for message editing scenarios)
    const textElement = element.querySelector('.chat-message-text');
    if (textElement && textElement.textContent !== message.text) {
      textElement.textContent = message.text;
    }
  }
  
  updateInputField() {
    if (this.elements.inputField.value !== this.model.inputText) {
      this.elements.inputField.value = this.model.inputText;
    }
  }
  
  updateSendButtonState() {
    const canSend = this.model.connected && this.model.inputText.trim().length > 0;
    this.elements.sendButton.disabled = !canSend;
    this.elements.inputField.disabled = !this.model.connected;
  }
  
  scrollToBottom() {
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }
  
  // PUBLIC METHODS for parent actor to call
  clearInput() {
    this.model.inputText = '';
    this.updateInputField();
    this.updateSendButtonState();
  }
  
  focusInput() {
    if (this.elements.inputField && !this.elements.inputField.disabled) {
      this.elements.inputField.focus();
    }
  }
  
  addMessage(message) {
    this.model.messages.push(message);
    this.updateMessages(this.model.messages);
  }

  /**
   * Handle agent response message (enhanced format)
   */
  addAgentMessage(responseData) {
    const agentMessage = {
      id: `agent-${Date.now()}-${Math.random()}`,
      sender: 'agent',
      text: responseData.text,
      timestamp: responseData.timestamp,
      toolsUsed: responseData.toolsUsed || [],
      contextUpdated: responseData.contextUpdated || [],
      reasoning: responseData.reasoning,
      operationCount: responseData.operationCount || 0
    };

    this.addMessage(agentMessage);
  }

  /**
   * Handle agent error message
   */
  addAgentError(errorData) {
    const errorMessage = {
      id: `error-${Date.now()}-${Math.random()}`,
      sender: 'agent',
      text: errorData.text || `Error: ${errorData.error}`,
      timestamp: errorData.timestamp,
      isError: true,
      error: errorData.error,
      originalMessage: errorData.originalMessage
    };

    this.addMessage(errorMessage);
  }

  /**
   * Handle agent thinking message (progress indicator)
   */
  addAgentThinking(thinkingData) {
    const thinkingMessage = {
      id: `thinking-${Date.now()}-${Math.random()}`,
      sender: 'agent',
      text: thinkingData.message || 'Thinking...',
      timestamp: thinkingData.timestamp,
      isThinking: true,
      step: thinkingData.step
    };

    this.addMessage(thinkingMessage);
  }

  /**
   * Add context state display message
   */
  addContextState(contextData) {
    const contextMessage = {
      id: `context-${Date.now()}-${Math.random()}`,
      sender: 'system',
      text: 'Current context state:',
      timestamp: contextData.timestamp,
      contextState: contextData.contextState
    };

    this.addMessage(contextMessage);
  }

  /**
   * Add context cleared confirmation
   */
  addContextCleared(data) {
    const clearedMessage = {
      id: `cleared-${Date.now()}-${Math.random()}`,
      sender: 'system', 
      text: data.message || 'Context cleared',
      timestamp: data.timestamp,
      isSystemMessage: true
    };

    this.addMessage(clearedMessage);
  }
}