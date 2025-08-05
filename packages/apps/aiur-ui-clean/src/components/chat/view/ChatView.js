import { artifactRegistry } from '../artifacts/index.js';

/**
 * ChatView - Handles chat UI rendering and DOM manipulation
 */
export class ChatView {
  constructor(container) {
    this.container = container;
    
    // DOM elements
    this.elements = {
      messagesContainer: null,
      messagesList: null,
      inputContainer: null,
      inputField: null,
      sendButton: null,
      voiceButton: null,
      voiceModeToggle: null,
      loadingIndicator: null,
      errorContainer: null,
      voiceIndicator: null
    };
    
    // Event handlers storage
    this.eventHandlers = {
      onSend: null,
      onInputChange: null,
      onKeyPress: null,
      onClear: null,
      onVoiceInput: null,
      onVoiceModeToggle: null,
      onPlayAudio: null
    };
    
    // Voice state
    this.voiceState = {
      isRecording: false,
      autoPlayEnabled: false
    };
    
    // Create the UI
    this.createDOM();
    this.bindEvents();
  }
  
  /**
   * Create the DOM structure
   */
  createDOM() {
    // Clear container
    this.container.innerHTML = '';
    
    // Main chat container
    const chatContainer = document.createElement('div');
    chatContainer.className = 'chat-container';
    chatContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Header with voice mode toggle
    const header = document.createElement('div');
    header.className = 'chat-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #222;
      border-bottom: 1px solid #444;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Chat';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    `;
    
    // Voice mode toggle
    this.elements.voiceModeToggle = document.createElement('button');
    this.elements.voiceModeToggle.className = 'voice-mode-toggle';
    this.elements.voiceModeToggle.title = 'Toggle auto-play voice';
    this.elements.voiceModeToggle.innerHTML = '🔇';
    this.elements.voiceModeToggle.style.cssText = `
      background: none;
      border: 1px solid #444;
      border-radius: 20px;
      padding: 6px 12px;
      color: #999;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    `;
    
    header.appendChild(title);
    header.appendChild(this.elements.voiceModeToggle);
    
    // Messages container
    this.elements.messagesContainer = document.createElement('div');
    this.elements.messagesContainer.className = 'messages-container';
    this.elements.messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;
    
    // Messages list
    this.elements.messagesList = document.createElement('div');
    this.elements.messagesList.className = 'messages-list';
    this.elements.messagesContainer.appendChild(this.elements.messagesList);
    
    // Loading indicator
    this.elements.loadingIndicator = document.createElement('div');
    this.elements.loadingIndicator.className = 'loading-indicator';
    this.elements.loadingIndicator.style.cssText = `
      display: none;
      padding: 12px;
      color: #999;
      font-style: italic;
    `;
    this.elements.loadingIndicator.innerHTML = `
      <span class="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span> Assistant is typing...
    `;
    this.elements.messagesContainer.appendChild(this.elements.loadingIndicator);
    
    // Error container
    this.elements.errorContainer = document.createElement('div');
    this.elements.errorContainer.className = 'error-container';
    this.elements.errorContainer.style.cssText = `
      display: none;
      padding: 12px;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 4px;
      color: #ff6b6b;
      margin: 10px 20px;
    `;
    
    // Voice indicator (shows when recording or playing)
    this.elements.voiceIndicator = document.createElement('div');
    this.elements.voiceIndicator.className = 'voice-indicator';
    this.elements.voiceIndicator.style.cssText = `
      display: none;
      padding: 8px 16px;
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 20px;
      color: #ff6b6b;
      margin: 10px 20px;
      text-align: center;
      font-size: 14px;
    `;
    
    // Input container
    this.elements.inputContainer = document.createElement('div');
    this.elements.inputContainer.className = 'input-container';
    this.elements.inputContainer.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 20px;
      background: #222;
      border-top: 1px solid #444;
    `;
    
    // Input field
    this.elements.inputField = document.createElement('textarea');
    this.elements.inputField.className = 'chat-input';
    this.elements.inputField.placeholder = 'Type your message...';
    this.elements.inputField.rows = 1;
    this.elements.inputField.style.cssText = `
      flex: 1;
      padding: 12px;
      background: #333;
      border: 1px solid #555;
      border-radius: 24px;
      color: #e0e0e0;
      font-size: 14px;
      resize: none;
      outline: none;
      font-family: inherit;
      max-height: 120px;
    `;
    
    // Voice button
    this.elements.voiceButton = document.createElement('button');
    this.elements.voiceButton.className = 'voice-button';
    this.elements.voiceButton.innerHTML = '🎤';
    this.elements.voiceButton.title = 'Hold to record voice';
    this.elements.voiceButton.style.cssText = `
      padding: 12px 16px;
      background: #444;
      border: none;
      border-radius: 24px;
      color: white;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 50px;
    `;
    
    // Send button
    this.elements.sendButton = document.createElement('button');
    this.elements.sendButton.className = 'send-button';
    this.elements.sendButton.innerHTML = '➤';
    this.elements.sendButton.style.cssText = `
      padding: 12px 20px;
      background: #007bff;
      border: none;
      border-radius: 24px;
      color: white;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.2s;
      min-width: 50px;
    `;
    
    // Assemble the structure
    this.elements.inputContainer.appendChild(this.elements.inputField);
    this.elements.inputContainer.appendChild(this.elements.voiceButton);
    this.elements.inputContainer.appendChild(this.elements.sendButton);
    
    chatContainer.appendChild(header);
    chatContainer.appendChild(this.elements.messagesContainer);
    chatContainer.appendChild(this.elements.errorContainer);
    chatContainer.appendChild(this.elements.voiceIndicator);
    chatContainer.appendChild(this.elements.inputContainer);
    
    this.container.appendChild(chatContainer);
    
    // Add typing animation styles
    this.injectStyles();
  }
  
  /**
   * Inject CSS styles for animations
   */
  injectStyles() {
    if (document.getElementById('chat-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chat-styles';
    style.textContent = `
      .typing-dots span {
        animation: typing 1.4s infinite;
        opacity: 0;
      }
      .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
      }
      .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
      }
      @keyframes typing {
        0%, 60%, 100% { opacity: 0; }
        30% { opacity: 1; }
      }
      
      .message-appear {
        animation: messageAppear 0.3s ease-out;
      }
      @keyframes messageAppear {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .send-button:hover {
        background: #0056b3 !important;
      }
      
      .send-button:active {
        transform: scale(0.95);
      }
      
      .chat-input:focus {
        border-color: #007bff !important;
      }
      
      /* Scrollbar styling */
      .messages-container::-webkit-scrollbar {
        width: 8px;
      }
      .messages-container::-webkit-scrollbar-track {
        background: #222;
      }
      .messages-container::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      .messages-container::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      
      /* Voice button states */
      .voice-button.recording {
        background: #ff4444 !important;
        animation: pulse 1.5s infinite;
      }
      
      .voice-button:hover {
        background: #555 !important;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      /* Voice mode toggle */
      .voice-mode-toggle.active {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      /* Speaker button in messages */
      .message-speaker-button {
        background: #444;
        border: none;
        border-radius: 16px;
        padding: 6px 12px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
        transition: all 0.2s;
      }
      
      .message-speaker-button:hover {
        background: #555;
      }
      
      .message-speaker-button.playing {
        background: #007bff;
        animation: pulse 1.5s infinite;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Bind DOM events
   */
  bindEvents() {
    // Send button click
    this.elements.sendButton.addEventListener('click', () => {
      this.handleSend();
    });
    
    // Enter key in input (shift+enter for new line)
    this.elements.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    // Auto-resize textarea
    this.elements.inputField.addEventListener('input', () => {
      this.autoResizeInput();
      if (this.eventHandlers.onInputChange) {
        this.eventHandlers.onInputChange(this.elements.inputField.value);
      }
    });
    
    // Voice button - hold to record
    this.elements.voiceButton.addEventListener('mousedown', () => {
      this.startRecording();
    });
    
    this.elements.voiceButton.addEventListener('mouseup', () => {
      this.stopRecording();
    });
    
    this.elements.voiceButton.addEventListener('mouseleave', () => {
      if (this.voiceState.isRecording) {
        this.stopRecording();
      }
    });
    
    // Touch events for mobile
    this.elements.voiceButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startRecording();
    });
    
    this.elements.voiceButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopRecording();
    });
    
    // Voice mode toggle
    this.elements.voiceModeToggle.addEventListener('click', () => {
      this.toggleVoiceMode();
    });
  }
  
  /**
   * Handle send action
   */
  handleSend() {
    const message = this.elements.inputField.value.trim();
    
    if (message && this.eventHandlers.onSend) {
      this.eventHandlers.onSend(message);
      this.elements.inputField.value = '';
      this.autoResizeInput();
    }
  }
  
  /**
   * Auto-resize input field based on content
   */
  autoResizeInput() {
    const input = this.elements.inputField;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  
  /**
   * Render a message
   */
  renderMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${message.role} message-appear`;
    messageElement.dataset.messageId = message.id;
    
    const isUser = message.role === 'user';
    
    messageElement.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${isUser ? 'flex-end' : 'flex-start'};
      gap: 4px;
    `;
    
    // Message bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.style.cssText = `
      max-width: 70%;
      padding: 12px 16px;
      background: ${isUser ? '#007bff' : '#333'};
      color: ${isUser ? 'white' : '#e0e0e0'};
      border-radius: 18px;
      border-bottom-${isUser ? 'right' : 'left'}-radius: 4px;
      word-wrap: break-word;
      white-space: pre-wrap;
      line-height: 1.4;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // Message content container
    const contentContainer = document.createElement('span');
    contentContainer.style.flex = '1';
    
    // Parse markdown if assistant message
    if (!isUser && (message.content.includes('```') || message.content.includes('**'))) {
      contentContainer.innerHTML = this.parseMarkdown(message.content);
    } else {
      contentContainer.textContent = message.content;
    }
    
    bubble.appendChild(contentContainer);
    
    // Add speaker button for assistant messages (if not in auto-play mode)
    if (!isUser && !this.voiceState.autoPlayEnabled) {
      const speakerButton = document.createElement('button');
      speakerButton.className = 'message-speaker-button';
      speakerButton.innerHTML = '🔊';
      speakerButton.title = 'Play audio';
      speakerButton.dataset.messageId = message.id;
      
      speakerButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlePlayAudio(message);
      });
      
      bubble.appendChild(speakerButton);
    }
    
    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.style.cssText = `
      font-size: 11px;
      color: #666;
      padding: 0 8px;
    `;
    timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
    
    messageElement.appendChild(bubble);
    
    // Add artifacts if present
    if (message.artifacts && message.artifacts.length > 0) {
      const artifactsContainer = this.renderArtifacts(message.artifacts);
      messageElement.appendChild(artifactsContainer);
    }
    
    messageElement.appendChild(timestamp);
    
    return messageElement;
  }
  
  /**
   * Render artifacts container for a message
   * @param {Array} artifacts - Array of artifact objects
   * @returns {HTMLElement} Artifacts container element
   */
  renderArtifacts(artifacts) {
    const container = document.createElement('div');
    container.className = 'message-artifacts';
    container.style.cssText = `
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 100%;
    `;

    artifacts.forEach(artifact => {
      try {
        const renderer = artifactRegistry.getRenderer(artifact);
        const artifactElement = renderer.renderPreview(artifact);
        
        // Add click handler for viewing
        artifactElement.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.handleArtifactClick(artifact, renderer);
        });
        
        container.appendChild(artifactElement);
      } catch (error) {
        console.warn('Error rendering artifact:', artifact, error);
        
        // Fallback rendering
        const fallback = this.renderArtifactFallback(artifact);
        container.appendChild(fallback);
      }
    });

    return container;
  }
  
  /**
   * Render fallback artifact card when renderer fails
   * @param {Object} artifact - Artifact metadata
   * @returns {HTMLElement} Fallback artifact element
   */
  renderArtifactFallback(artifact) {
    const card = document.createElement('div');
    card.className = 'artifact-card artifact-fallback';
    card.style.cssText = `
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 12px;
      margin: 4px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0.7;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    `;
    icon.textContent = '📎';

    const content = document.createElement('div');
    content.style.cssText = 'flex: 1;';

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 500;
      color: #e0e0e0;
      font-size: 14px;
      margin-bottom: 4px;
    `;
    title.textContent = artifact.title || 'Unknown Artifact';

    const details = document.createElement('div');
    details.style.cssText = `
      font-size: 12px;
      color: #999;
    `;
    details.textContent = `${artifact.type || 'unknown'} • Rendering failed`;

    content.appendChild(title);
    content.appendChild(details);
    
    card.appendChild(icon);
    card.appendChild(content);

    return card;
  }
  
  /**
   * Handle artifact click event
   * @param {Object} artifact - Artifact metadata
   * @param {ArtifactRenderer} renderer - Renderer instance
   */
  handleArtifactClick(artifact, renderer) {
    console.log('ChatView: Handling artifact click:', artifact.title);
    
    // Emit event for parent components to handle
    const event = new CustomEvent('artifact-click', {
      detail: { artifact, renderer },
      bubbles: true
    });
    this.container.dispatchEvent(event);
    
    console.log('ChatView: Dispatched artifact-click event');
  }
  
  /**
   * Simple markdown parser for code blocks and bold text
   */
  parseMarkdown(text) {
    // Escape HTML
    text = text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    
    // Code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background: #1a1a1a; padding: 10px; border-radius: 4px; overflow-x: auto;"><code>${code}</code></pre>`;
    });
    
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code style="background: #444; padding: 2px 4px; border-radius: 2px;">$1</code>');
    
    // Bold
    text = text.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }
  
  /**
   * Add a message to the view
   */
  addMessage(message) {
    const messageElement = this.renderMessage(message);
    this.elements.messagesList.appendChild(messageElement);
    this.scrollToBottom();
  }
  
  /**
   * Update an existing message
   */
  updateMessage(messageId, content) {
    const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const bubble = messageElement.querySelector('.message-bubble');
      if (bubble) {
        // Find the content container span within the bubble
        const contentContainer = bubble.querySelector('span') || bubble;
        
        // Only update the content container, preserving speaker button and structure
        if (content.includes('```') || content.includes('**')) {
          contentContainer.innerHTML = this.parseMarkdown(content);
        } else {
          contentContainer.textContent = content;
        }
      }
    }
  }
  
  /**
   * Clear all messages
   */
  clearMessages() {
    this.elements.messagesList.innerHTML = '';
  }
  
  /**
   * Show loading indicator
   */
  showLoading() {
    this.elements.loadingIndicator.style.display = 'block';
    this.scrollToBottom();
  }
  
  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.elements.loadingIndicator.style.display = 'none';
  }
  
  /**
   * Show error message
   */
  showError(error) {
    this.elements.errorContainer.textContent = error;
    this.elements.errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideError();
    }, 5000);
  }
  
  /**
   * Hide error message
   */
  hideError() {
    this.elements.errorContainer.style.display = 'none';
  }
  
  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    setTimeout(() => {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }, 50);
  }
  
  /**
   * Enable/disable input
   */
  setInputEnabled(enabled) {
    this.elements.inputField.disabled = !enabled;
    this.elements.sendButton.disabled = !enabled;
    
    if (!enabled) {
      this.elements.sendButton.style.opacity = '0.5';
      this.elements.sendButton.style.cursor = 'not-allowed';
    } else {
      this.elements.sendButton.style.opacity = '1';
      this.elements.sendButton.style.cursor = 'pointer';
    }
  }
  
  /**
   * Focus input field
   */
  focus() {
    this.elements.inputField.focus();
  }
  
  /**
   * Start voice recording
   */
  startRecording() {
    if (this.voiceState.isRecording) return;
    
    this.voiceState.isRecording = true;
    this.elements.voiceButton.classList.add('recording');
    this.showVoiceIndicator('🔴 Recording...');
    
    if (this.eventHandlers.onVoiceInput) {
      this.eventHandlers.onVoiceInput('start');
    }
  }
  
  /**
   * Stop voice recording
   */
  stopRecording() {
    if (!this.voiceState.isRecording) return;
    
    this.voiceState.isRecording = false;
    this.elements.voiceButton.classList.remove('recording');
    this.hideVoiceIndicator();
    
    if (this.eventHandlers.onVoiceInput) {
      this.eventHandlers.onVoiceInput('stop');
    }
  }
  
  /**
   * Toggle voice auto-play mode
   */
  toggleVoiceMode() {
    this.voiceState.autoPlayEnabled = !this.voiceState.autoPlayEnabled;
    
    if (this.voiceState.autoPlayEnabled) {
      this.elements.voiceModeToggle.classList.add('active');
      this.elements.voiceModeToggle.innerHTML = '🔊';
      this.elements.voiceModeToggle.title = 'Auto-play is ON';
    } else {
      this.elements.voiceModeToggle.classList.remove('active');
      this.elements.voiceModeToggle.innerHTML = '🔇';
      this.elements.voiceModeToggle.title = 'Auto-play is OFF';
    }
    
    if (this.eventHandlers.onVoiceModeToggle) {
      this.eventHandlers.onVoiceModeToggle(this.voiceState.autoPlayEnabled);
    }
  }
  
  /**
   * Handle play audio for a message
   */
  handlePlayAudio(message) {
    if (this.eventHandlers.onPlayAudio) {
      this.eventHandlers.onPlayAudio(message);
    }
  }
  
  /**
   * Show voice indicator
   */
  showVoiceIndicator(text) {
    this.elements.voiceIndicator.textContent = text;
    this.elements.voiceIndicator.style.display = 'block';
  }
  
  /**
   * Hide voice indicator
   */
  hideVoiceIndicator() {
    this.elements.voiceIndicator.style.display = 'none';
  }
  
  /**
   * Update speaker button state
   */
  updateSpeakerButton(messageId, isPlaying) {
    const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const button = messageElement.querySelector('.message-speaker-button');
      if (button) {
        if (isPlaying) {
          button.classList.add('playing');
          button.innerHTML = '⏸️';
        } else {
          button.classList.remove('playing');
          button.innerHTML = '🔊';
        }
      }
    }
  }
  
  /**
   * Get voice auto-play state
   */
  isAutoPlayEnabled() {
    return this.voiceState.autoPlayEnabled;
  }
  
  /**
   * Destroy the view
   */
  destroy() {
    // Remove injected styles
    const styles = document.getElementById('chat-styles');
    if (styles) {
      styles.remove();
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Clear references
    this.elements = {};
    this.eventHandlers = {};
  }
}