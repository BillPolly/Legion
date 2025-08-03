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
    
    // Message queue for when not connected
    this.messageQueue = [];
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
        
      case 'chat_history':
        this.handleChatHistory(payload);
        break;
        
      case 'chat_history_cleared':
        console.log('ChatActor: History cleared on server');
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
      'history_cleared': 'chat_history_cleared'
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
   * Handle chat response from server
   */
  handleChatResponse(payload) {
    if (this.onResponse) {
      this.onResponse({
        content: payload.content,
        isComplete: payload.isComplete || false,
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
   * Destroy the actor
   */
  destroy() {
    this.disconnect();
    
    // Clear handlers
    this.onResponse = null;
    this.onStream = null;
    this.onError = null;
    this.onConnectionChange = null;
    
    // Clear queue
    this.messageQueue = [];
  }
}