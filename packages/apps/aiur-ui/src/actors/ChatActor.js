import { Actor } from '/Legion/shared/actors/src/Actor.js';

/**
 * ChatActor - Handles chat communication with the backend via WebSocket
 */
export class ChatActor extends Actor {
  constructor() {
    super();
    this.remoteAgent = null; // Reference to server ChatAgent
    
    // Connection state
    this.connected = false;
    
    // Event handlers
    this.onResponse = null;
    this.onStream = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onVoiceTranscription = null;
    this.onVoiceAudio = null;
    
    // Message queue for when not connected
    this.messageQueue = [];
    
    // Voice state
    this.voiceEnabled = false;
    this.preferredVoice = 'nova';
  }
  
  /**
   * Set the remote agent reference for sending messages
   */
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
    this.connected = true;
    console.log('ChatActor: Set remote agent reference');
    
    // Notify connection change
    if (this.onConnectionChange) {
      this.onConnectionChange(true);
    }
    
    // Process any queued messages
    this.processMessageQueue();
  }
  
  /**
   * Disconnect from remote agent
   */
  disconnect() {
    this.remoteAgent = null;
    this.connected = false;
    
    console.log('ChatActor: Disconnected');
    
    // Notify connection change
    if (this.onConnectionChange) {
      this.onConnectionChange(false);
    }
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.remoteAgent;
  }
  
  /**
   * Receive messages from the server via actor protocol
   */
  receive(payload, envelope) {
    console.log('ChatActor: Received message:', payload);
    
    // Handle messages with eventName (from ChatAgent's emit)
    if (payload.eventName) {
      // Map eventName to message type for compatibility
      const messageType = this.mapEventToMessageType(payload.eventName);
      if (messageType) {
        payload.type = messageType;
      }
    }
    
    // Handle different message types
    switch (payload.type) {
      case 'chat_response':
        this.handleChatResponse(payload);
        break;
        
      case 'llm_raw_response':
        // Log the raw LLM response
        console.log('[LLM Raw Response]:', payload.rawResponse);
        break;
        
      case 'llm_complete_response':
        // Log the complete LLM response including tool calls
        console.log('[LLM Complete Response]:', payload.response);
        break;
        
      case 'tool_execution_debug':
        // Log tool execution details
        console.log('[Tool Execution]:', {
          tool: payload.toolName,
          id: payload.toolId,
          parameters: payload.parameters,
          timestamp: payload.timestamp
        });
        break;
        
      case 'chat_stream':
        this.handleChatStream(payload);
        break;
        
      case 'chat_error':
        this.handleChatError(payload);
        break;
        
      case 'chat_processing':
        // Server acknowledged and is processing
        console.log('ChatActor: Server is processing message');
        break;
        
      case 'chat_complete':
        // Server finished processing
        console.log('ChatActor: Server completed processing');
        break;
        
      case 'chat_response':
        // Handle the assistant's response
        this.handleChatResponse(payload);
        break;
        
      case 'chat_history':
        this.handleChatHistory(payload);
        break;
        
      case 'chat_history_cleared':
        console.log('ChatActor: History cleared on server');
        break;
        
      case 'agent_thinking':
        this.handleAgentThinking(payload);
        break;
        
      case 'agent_thought':
        this.handleAgentThought(payload);
        break;
        
      case 'tool_executing':
        this.handleToolExecuting(payload);
        break;
        
      case 'tool_result':
        this.handleToolResult(payload);
        break;
        
      case 'agent_complete':
        this.handleAgentComplete(payload);
        break;
        
      case 'voice_transcription':
        this.handleVoiceTranscription(payload);
        break;
        
      case 'voice_audio':
        this.handleVoiceAudio(payload);
        break;
        
      case 'voice_error':
        this.handleVoiceError(payload);
        break;
        
      default:
        console.log('ChatActor: Unknown message type:', payload.type);
    }
  }
  
  /**
   * Map event names from ChatAgent to message types
   */
  mapEventToMessageType(eventName) {
    const mapping = {
      'message': 'chat_response',
      'stream': 'chat_stream',
      'error': 'chat_error',
      'processing_started': 'chat_processing',
      'processing_complete': 'chat_complete',
      'history': 'chat_history',
      'history_cleared': 'chat_history_cleared',
      'agent_thinking': 'agent_thinking',
      'agent_thought': 'agent_thought',
      'tool_executing': 'tool_executing',
      'tool_result': 'tool_result',
      'agent_complete': 'agent_complete'
    };
    return mapping[eventName] || null;
  }
  
  /**
   * Send a chat message to the server
   */
  async sendChatMessage(content) {
    if (!this.isConnected()) {
      // Queue the message
      this.messageQueue.push({
        type: 'chat_message',
        content,
        timestamp: new Date().toISOString()
      });
      
      throw new Error('Not connected to chat server');
    }
    
    if (!this.remoteAgent) {
      throw new Error('No remote agent connection established');
    }
    
    const message = {
      type: 'chat_message',
      content,
      timestamp: new Date().toISOString()
    };
    
    console.log('ChatActor: Sending message via actor protocol:', message);
    
    // Send via remote agent using actor protocol
    this.remoteAgent.receive(message);
  }
  
  /**
   * Clear chat history on server
   */
  clearHistory() {
    if (!this.isConnected()) {
      console.warn('ChatActor: Cannot clear history - not connected');
      return;
    }
    
    if (!this.remoteAgent) {
      console.warn('ChatActor: No remote agent connection');
      return;
    }
    
    const message = {
      type: 'clear_history'
    };
    
    this.remoteAgent.receive(message);
  }
  
  /**
   * Request chat history from server
   */
  requestHistory() {
    if (!this.isConnected()) {
      console.warn('ChatActor: Cannot request history - not connected');
      return;
    }
    
    if (!this.remoteAgent) {
      console.warn('ChatActor: No remote agent connection');
      return;
    }
    
    const message = {
      type: 'get_history'
    };
    
    this.remoteAgent.receive(message);
  }
  
  /**
   * Send voice input for transcription
   */
  async sendVoiceInput(audioData, format = 'webm') {
    if (!this.isConnected()) {
      throw new Error('Not connected to chat server');
    }
    
    if (!this.remoteAgent) {
      throw new Error('No remote agent connection established');
    }
    
    const message = {
      type: 'voice_input',
      audio: audioData,
      format: format,
      timestamp: new Date().toISOString()
    };
    
    console.log('ChatActor: Sending voice input for transcription');
    
    // Send via remote agent
    this.remoteAgent.receive(message);
  }
  
  /**
   * Request voice generation for text
   */
  requestVoiceGeneration(text, messageId) {
    if (!this.isConnected()) {
      console.warn('ChatActor: Cannot generate voice - not connected');
      return;
    }
    
    if (!this.remoteAgent) {
      console.warn('ChatActor: No remote agent connection');
      return;
    }
    
    const message = {
      type: 'generate_speech',
      text: text,
      voice: this.preferredVoice,
      messageId: messageId,
      timestamp: new Date().toISOString()
    };
    
    console.log('ChatActor: Requesting voice generation');
    
    this.remoteAgent.receive(message);
  }
  
  /**
   * Set voice preferences
   */
  setVoicePreferences(enabled, voice = 'nova') {
    this.voiceEnabled = enabled;
    this.preferredVoice = voice;
    
    // Notify server of voice preference
    if (this.isConnected() && this.remoteAgent) {
      this.remoteAgent.receive({
        type: 'voice_preferences',
        enabled: enabled,
        voice: voice
      });
    }
  }
  
  /**
   * Handle chat response from server
   */
  handleChatResponse(payload) {
    if (this.onResponse) {
      this.onResponse({
        content: payload.content,
        isComplete: payload.isComplete || false,
        artifacts: payload.artifacts || [],
        voiceData: payload.voiceData || null,  // Include voice data if present
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle streaming chunk from server
   */
  handleChatStream(payload) {
    if (this.onStream) {
      this.onStream({
        content: payload.content,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle error from server
   */
  handleChatError(payload) {
    const error = {
      message: payload.message || 'An error occurred',
      type: payload.errorType || 'unknown',
      timestamp: payload.timestamp || new Date().toISOString()
    };
    
    console.error('ChatActor: Error from server:', error);
    
    if (this.onError) {
      this.onError(error);
    }
  }
  
  /**
   * Handle chat history from server
   */
  handleChatHistory(payload) {
    console.log('ChatActor: Received history:', payload.history);
    
    // Could emit an event or callback here if needed
    // For now, just log it
  }
  
  /**
   * Process queued messages after connection
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`ChatActor: Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      
      if (message.type === 'chat_message') {
        this.sendChatMessage(message.content).catch(err => {
          console.error('ChatActor: Failed to send queued message:', err);
        });
      }
    }
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      queuedMessages: this.messageQueue.length
    };
  }
  
  /**
   * Handle agent thinking status
   */
  handleAgentThinking(payload) {
    if (this.onThought) {
      this.onThought({
        type: 'thinking',
        iteration: payload.iteration,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle agent thought/reasoning
   */
  handleAgentThought(payload) {
    if (this.onThought) {
      this.onThought({
        type: 'thought',
        content: payload.thought,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle tool execution start
   */
  handleToolExecuting(payload) {
    if (this.onThought) {
      this.onThought({
        type: 'tool_executing',
        toolName: payload.toolName,
        toolId: payload.toolId,
        parameters: payload.parameters,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle tool execution result
   */
  handleToolResult(payload) {
    if (this.onThought) {
      this.onThought({
        type: 'tool_result',
        toolId: payload.toolId,
        result: payload.result,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle agent completion
   */
  handleAgentComplete(payload) {
    if (this.onThought) {
      this.onThought({
        type: 'complete',
        iterations: payload.iterations,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle voice transcription result
   */
  handleVoiceTranscription(payload) {
    console.log('ChatActor: Received voice transcription:', payload.text);
    
    if (this.onVoiceTranscription) {
      this.onVoiceTranscription({
        text: payload.text,
        language: payload.language,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle voice audio data
   */
  handleVoiceAudio(payload) {
    console.log('ChatActor: Received voice audio for message:', payload.messageId);
    
    if (this.onVoiceAudio) {
      this.onVoiceAudio({
        audio: payload.audio,
        format: payload.format,
        messageId: payload.messageId,
        voice: payload.voice,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle voice error
   */
  handleVoiceError(payload) {
    console.error('ChatActor: Voice error:', payload.message);
    
    if (this.onError) {
      this.onError({
        message: payload.message,
        type: 'voice_error',
        details: payload.details,
        timestamp: payload.timestamp || new Date().toISOString()
      });
    }
  }
  
  /**
   * Destroy the actor
   */
  destroy() {
    this.disconnect();
    
    // Clear handlers
    this.onResponse = null;
    this.onStream = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onThought = null;
    this.onVoiceTranscription = null;
    this.onVoiceAudio = null;
    
    // Clear queue
    this.messageQueue = [];
  }
}