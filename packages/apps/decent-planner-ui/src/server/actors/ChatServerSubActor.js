/**
 * ChatServerSubActor - Server-side chat functionality
 * Simple echo server implementation as sub-actor
 */

export default class ChatServerSubActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null; // Will be set to remote chat client sub-actor
    this.parentActor = null;
    this.actorSpace = null;
    
    // State
    this.state = {
      connected: false,
      messageCount: 0
    };
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 Chat server sub-actor connected');
    
    // Send ready signal to client via parent
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'ready', {
        timestamp: new Date().toISOString()
      });
    }
  }

  receive(messageType, data) {
    console.log('📨 Chat server sub-actor received:', messageType);
    
    switch (messageType) {
      case 'send-message':
        this.handleSendMessage(data);
        break;
        
      case 'ping':
        if (this.remoteActor) {
          this.remoteActor.receive('pong', { timestamp: Date.now() });
        }
        break;
        
      default:
        console.warn('Unknown message type in chat server sub-actor:', messageType);
        break;
    }
  }

  handleSendMessage(data) {
    const { text, timestamp } = data;
    
    console.log(`Chat server echoing message: "${text}"`);
    
    this.state.messageCount++;
    
    // Simple echo implementation - respond with the same text plus a note
    const echoText = `Echo: ${text} (message #${this.state.messageCount})`;
    
    // Send response back to client via parent
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'message-response', {
        text: echoText,
        timestamp: new Date().toLocaleTimeString(),
        originalText: text,
        originalTimestamp: timestamp
      });
    }
  }
}