import { ThoughtsDisplay } from '../ThoughtsDisplay.js';
import { VoiceRecorder } from '../voice/VoiceRecorder.js';
import { VoiceController } from '../voice/VoiceController.js';

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
    
    // Create thoughts display
    this.thoughtsDisplay = null;
    this.currentThoughtMessageId = null;
    
    // Initialize voice components
    this.voiceRecorder = new VoiceRecorder();
    this.voiceController = new VoiceController();
    
    // Voice state
    this.voiceEnabled = false;
    
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
    
    // Handle voice input
    this.view.eventHandlers.onVoiceInput = (action) => {
      if (action === 'start') {
        this.startVoiceRecording();
      } else if (action === 'stop') {
        this.stopVoiceRecording();
      }
    };
    
    // Handle voice mode toggle
    this.view.eventHandlers.onVoiceModeToggle = (enabled) => {
      this.setVoiceAutoPlay(enabled);
    };
    
    // Handle play audio
    this.view.eventHandlers.onPlayAudio = (message) => {
      this.playMessageAudio(message);
    };
    
    // Set up voice recorder handlers
    this.setupVoiceRecorderHandlers();
    
    // Set up voice controller handlers
    this.setupVoiceControllerHandlers();
  }
  
  /**
   * Set up actor listeners for server responses
   */
  setupActorListeners() {
    if (!this.chatActor) return;
    
    // Listen for chat responses
    this.chatActor.onResponse = (response) => {
      this.handleChatResponseWithVoice(response);
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
    
    // Listen for thought updates
    this.chatActor.onThought = (thought) => {
      this.handleThought(thought);
    };
    
    // Listen for voice transcription
    this.chatActor.onVoiceTranscription = (result) => {
      this.handleVoiceTranscription(result);
    };
    
    // Listen for voice audio
    this.chatActor.onVoiceAudio = (data) => {
      this.handleVoiceAudio(data);
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
          artifacts: response.artifacts || [],
          isComplete: true
        });
        this.streamingMessageId = null;
      } else {
        // Add new assistant message
        this.model.addMessage(response.content, 'assistant', {
          artifacts: response.artifacts || [],
          isComplete: true
        });
      }
      
      // Hide thoughts display if visible
      if (this.thoughtsDisplay) {
        // Let it fade out naturally after completion
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
   * Handle thought updates from the agent
   */
  handleThought(thought) {
    // Create thoughts display if not exists
    if (!this.thoughtsDisplay) {
      this.thoughtsDisplay = new ThoughtsDisplay();
      
      // Find the messages container to insert thoughts display
      const messagesContainer = this.view.elements.messagesContainer;
      if (messagesContainer) {
        // If we have a current assistant message being built, insert before it
        // Otherwise append to messages
        if (this.streamingMessageId) {
          const messageEl = messagesContainer.querySelector(`[data-message-id="${this.streamingMessageId}"]`);
          if (messageEl) {
            messagesContainer.insertBefore(this.thoughtsDisplay.getElement(), messageEl);
          } else {
            messagesContainer.appendChild(this.thoughtsDisplay.getElement());
          }
        } else {
          messagesContainer.appendChild(this.thoughtsDisplay.getElement());
        }
        
        // Auto-scroll to show thoughts
        this.view.scrollToBottom();
      }
    }
    
    // Add thought to display
    this.thoughtsDisplay.addThought(thought);
    
    // Auto-scroll to keep thoughts visible
    this.view.scrollToBottom();
  }
  
  /**
   * Clear chat history
   */
  clearChat() {
    this.model.clearMessages();
    this.streamingMessageId = null;
    
    // Clear thoughts display
    if (this.thoughtsDisplay) {
      this.thoughtsDisplay.clear();
    }
    
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
   * Set up voice recorder handlers
   */
  setupVoiceRecorderHandlers() {
    this.voiceRecorder.onDataAvailable = (data) => {
      // Send audio data to server
      if (this.chatActor && this.chatActor.isConnected()) {
        this.chatActor.sendVoiceInput(data.audio, data.format);
      }
    };
    
    this.voiceRecorder.onError = (error) => {
      console.error('Voice recording error:', error);
      this.model.setError(error.message);
      this.view.hideVoiceIndicator();
    };
  }
  
  /**
   * Set up voice controller handlers
   */
  setupVoiceControllerHandlers() {
    this.voiceController.onPlaybackStart = (messageId) => {
      this.view.updateSpeakerButton(messageId, true);
    };
    
    this.voiceController.onPlaybackEnd = (messageId) => {
      this.view.updateSpeakerButton(messageId, false);
    };
    
    this.voiceController.onError = (error) => {
      console.error('Voice playback error:', error);
      if (error.messageId) {
        this.view.updateSpeakerButton(error.messageId, false);
      }
    };
  }
  
  /**
   * Start voice recording
   */
  async startVoiceRecording() {
    try {
      await this.voiceRecorder.start();
      this.view.showVoiceIndicator('🎤 Recording...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.model.setError('Failed to start voice recording');
    }
  }
  
  /**
   * Stop voice recording
   */
  stopVoiceRecording() {
    this.voiceRecorder.stop();
    this.view.hideVoiceIndicator();
  }
  
  /**
   * Set voice auto-play mode
   */
  setVoiceAutoPlay(enabled) {
    this.voiceController.setAutoPlay(enabled);
    
    // Update actor preferences
    if (this.chatActor) {
      this.chatActor.setVoicePreferences(enabled, 'nova');
    }
    
    // If enabling auto-play and there are recent assistant messages, offer to play them
    if (enabled) {
      const recentMessages = this.model.getMessages().filter(m => m.role === 'assistant').slice(-1);
      if (recentMessages.length > 0) {
        // Could auto-play the last message here if desired
      }
    }
  }
  
  /**
   * Play audio for a message
   */
  async playMessageAudio(message) {
    if (!message || !message.content) return;
    
    // Request audio generation from server
    if (this.chatActor && this.chatActor.isConnected()) {
      this.chatActor.requestVoiceGeneration(message.content, message.id);
    }
  }
  
  /**
   * Handle voice transcription result
   */
  handleVoiceTranscription(result) {
    // The transcribed text will be automatically processed as a chat message
    // by the server, so we just need to show feedback
    this.view.showVoiceIndicator(`📝 "${result.text}"`);
    
    // Hide indicator after a moment
    setTimeout(() => {
      this.view.hideVoiceIndicator();
    }, 2000);
  }
  
  /**
   * Handle voice audio data
   */
  async handleVoiceAudio(data) {
    // Play the audio
    await this.voiceController.play(
      data.audio,
      data.messageId,
      {
        format: data.format,
        voice: data.voice,
        priority: 'high'  // Manual request has high priority
      }
    );
  }
  
  /**
   * Override handleChatResponse to support auto-play
   */
  handleChatResponseWithVoice(response) {
    // Call original handler
    this.handleChatResponse(response);
    
    // If auto-play is enabled and this is a complete response
    if (this.voiceController.autoPlayEnabled && response.isComplete && response.content) {
      // Check if content should be auto-played
      const shouldPlay = this.voiceController.shouldAutoPlay({
        role: 'assistant',
        content: response.content
      });
      
      if (shouldPlay) {
        // Request voice generation
        const messageId = this.model.getMessages().slice(-1)[0]?.id;
        if (messageId && this.chatActor && this.chatActor.isConnected()) {
          this.chatActor.requestVoiceGeneration(response.content, messageId);
        }
      }
    }
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
      this.chatActor.onThought = null;
      this.chatActor.onVoiceTranscription = null;
      this.chatActor.onVoiceAudio = null;
    }
    
    // Destroy thoughts display
    if (this.thoughtsDisplay) {
      this.thoughtsDisplay.destroy();
      this.thoughtsDisplay = null;
    }
    
    // Destroy voice components
    if (this.voiceRecorder) {
      this.voiceRecorder.destroy();
      this.voiceRecorder = null;
    }
    
    if (this.voiceController) {
      this.voiceController.destroy();
      this.voiceController = null;
    }
    
    // Clear references
    this.model = null;
    this.view = null;
    this.chatActor = null;
  }
}