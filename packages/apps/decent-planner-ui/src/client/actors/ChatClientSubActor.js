/**
 * ChatClientSubActor - Client-side chat functionality
 * Simple echo chat implementation as sub-actor
 */

import { EnhancedChatComponent } from '/src/client/components/EnhancedChatComponent.js';

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
    this.chatComponent = new EnhancedChatComponent(container, {
      messages: this.state.messages,
      inputText: this.state.inputText,
      connected: this.state.connected,
      onSendMessage: (text) => {
        this.handleSendMessage(text);
      },
      onInputChange: (text) => {
        this.state.inputText = text;
      },
      onClearContext: () => {
        this.requestClearContext();
      },
      onDebugTabChange: (tabId) => {
        console.log(`Debug tab changed to: ${tabId}`);
      }
    });
  }

  handleSendMessage(data) {
    const text = typeof data === 'string' ? data : data.text;
    console.log('💬 ChatClientSubActor: handleSendMessage called with:', data, 'text:', text);
    if (!text || !text.trim()) return;
    
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
    console.log('💬 ChatClientSubActor: updating UI, chatComponent exists:', !!this.chatComponent);
    if (this.chatComponent) {
      console.log('💬 ChatClientSubActor: calling updateMessages with', this.state.messages.length, 'messages');
      this.chatComponent.updateMessages(this.state.messages);
      this.chatComponent.clearInput();
    } else {
      console.error('💬 ChatClientSubActor: chatComponent is null in handleSendMessage!');
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
    console.log('🧠 CHAT CLIENT RECEIVE:', messageType, 'data keys:', Object.keys(data || {}));
    
    switch (messageType) {
      case 'ready':
        this.state.connected = true;
        if (this.chatComponent) {
          this.chatComponent.updateConnectionStatus(true);
        }
        break;
        
      case 'message-response':
        // Server echoed back the message (legacy)
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

      case 'agent-response':
        // Tool agent response (enhanced format)
        console.log('💬 ChatClientSubActor: got agent-response, chatComponent exists:', !!this.chatComponent);
        if (this.chatComponent) {
          console.log('💬 ChatClientSubActor: calling addAgentMessage with:', data);
          this.chatComponent.addAgentMessage(data);
        } else {
          console.error('💬 ChatClientSubActor: chatComponent is null!');
        }
        break;

      case 'agent-error':
        // Tool agent error
        if (this.chatComponent) {
          this.chatComponent.addAgentError(data);
        }
        break;

      case 'agent-thinking':
        // Tool agent thinking/progress
        if (this.chatComponent) {
          this.chatComponent.addAgentThinking(data);
        }
        break;

      case 'context-state-response':
        // Context state information
        if (this.chatComponent) {
          this.chatComponent.addContextState(data);
        }
        break;

      case 'context-cleared':
        // Context cleared confirmation
        if (this.chatComponent) {
          this.chatComponent.addContextCleared(data);
        }
        break;

      case 'agent-llm-interaction':
        // LLM interaction event from tool agent
        if (this.chatComponent && this.chatComponent.addLLMInteraction) {
          this.chatComponent.addLLMInteraction(data);
        } else {
          console.error('❌ CHAT SUB ACTOR: Cannot forward LLM interaction');
        }
        break;

      case 'context-state-update':
        // Context state update from tool agent
        if (this.chatComponent && this.chatComponent.updateContext) {
          this.chatComponent.updateContext(data.contextState);
        }
        break;

      case 'tool-operation':
        // Tool operation executed
        if (this.chatComponent && this.chatComponent.addOperation) {
          this.chatComponent.addOperation(data.operation);
        }
        break;

      case 'command-response':
        // Slash command successful response
        if (this.chatComponent) {
          this.chatComponent.addCommandResponse(data);
        }
        break;

      case 'command-error':
        // Slash command error response
        if (this.chatComponent) {
          this.chatComponent.addCommandError(data);
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

  /**
   * Request context clearing from server
   */
  requestClearContext() {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'clear-context', {
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Request current context state from server
   */
  requestContextState() {
    if (this.parentActor) {
      this.parentActor.sendToSubActor('chat', 'get-context-state', {
        timestamp: new Date().toISOString()
      });
    }
  }

  onTabActivated() {
    // Called when this tab becomes active
    console.log('Chat tab activated');
    
    // Request latest context state when tab activates
    this.requestContextState();
    
    // Focus input
    if (this.chatComponent) {
      this.chatComponent.focusInput();
    }
  }
}