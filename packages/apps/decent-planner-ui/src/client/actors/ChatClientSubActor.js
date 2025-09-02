/**
 * ChatClientSubActor - Client-side chat functionality
 * Simple echo chat implementation as sub-actor
 */

import { ChatComponent } from '/src/client/components/ChatComponent.js';

export default class ChatClientSubActor {
  constructor() {
    this.actorSpace = null;
    this.remoteActor = null; // Will be set to remote chat server sub-actor
    this.chatComponent = null;
    this.parentActor = null;
    
    // State
    this.state = {
      connected: false,
      messages: [],
      inputText: ''
    };
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Chat client sub-actor connected');
    
    // Update connection state
    this.state.connected = true;
  }

  setupUI(container) {
    this.chatComponent = new ChatComponent(container, {
      messages: this.state.messages,
      inputText: this.state.inputText,
      connected: this.state.connected,
      onSendMessage: (text) => {
        this.handleSendMessage(text);
      },
      onInputChange: (text) => {
        this.state.inputText = text;
      }
    });
  }

  handleSendMessage(text) {
    if (!text.trim()) return;
    
    // Add user message to local state
    const userMessage = {
      id: Date.now() + Math.random(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };
    
    this.state.messages.push(userMessage);
    this.state.inputText = '';
    
    // Update UI
    if (this.chatComponent) {
      this.chatComponent.updateMessages(this.state.messages);
      this.chatComponent.clearInput();
    }
    
    // Send to server via parent actor
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'send-message', {
        text: text.trim(),
        timestamp: userMessage.timestamp
      });
    }
  }

  receive(messageType, data) {
    console.log('📨 Chat client sub-actor received:', messageType);
    
    switch (messageType) {
      case 'ready':
        this.state.connected = true;
        if (this.chatComponent) {
          this.chatComponent.updateConnectionStatus(true);
        }
        break;
        
      case 'message-response':
        // Server echoed back the message
        const serverMessage = {
          id: Date.now() + Math.random(),
          text: data.text,
          sender: 'server',
          timestamp: data.timestamp
        };
        
        this.state.messages.push(serverMessage);
        
        if (this.chatComponent) {
          this.chatComponent.updateMessages(this.state.messages);
        }
        break;
        
      case 'error':
        console.error('Chat error:', data);
        // Could add error display to chat component
        break;
        
      default:
        console.warn('Unknown message type in chat sub-actor:', messageType);
        break;
    }
  }

  onTabActivated() {
    // Called when this tab becomes active
    console.log('Chat tab activated');
    // Could focus input or perform other activation tasks
    if (this.chatComponent) {
      this.chatComponent.focusInput();
    }
  }
}