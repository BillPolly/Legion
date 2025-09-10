/**
 * GeminiRootClientActor - EXACT copy of server framework pattern
 * Following the exact HTML template and actor initialization from Legion server framework
 */

import { ProtocolActor } from '/legion/decent-planner-ui/src/shared/ProtocolActor.js';

export default class GeminiRootClientActor extends ProtocolActor {
  constructor() {
    super();
    this.remoteActor = null;
    
    // Merge state with ProtocolActor
    Object.assign(this.state, {
      connected: false,
      tools: 0
    });
    
    console.log('🎭 GeminiRootClientActor created (server framework pattern)');
    
    // Initialize interface immediately like server framework
    this.initializeInterface();
  }

  getProtocol() {
    return {
      name: "GeminiRootClientActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          tools: { type: 'number', required: true }
        },
        initial: {
          connected: false,
          tools: 0
        }
      },
      
      messages: {
        receives: {
          'ready': {
            schema: {
              timestamp: { type: 'string' },
              tools: { type: 'number' }
            },
            postconditions: ['connected is true']
          },
          'chat_response': {
            schema: {
              content: { type: 'string' }
            }
          }
        },
        sends: {
          'chat_message': {
            schema: {
              content: { type: 'string' }
            }
          }
        }
      }
    };
  }

  /**
   * Set remote actor reference (called by server framework)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 [CLIENT] Remote server actor set - ready to communicate');
    
    // Now that we have the server reference, we can communicate
    // The server should send us a ready message
  }

  /**
   * Set channel reference (needed for Legion actor framework)
   */
  setChannel(channel) {
    this.channel = channel;
    console.log('🔗 [CLIENT] Channel set for communication');
  }

  /**
   * Initialize interface (following server framework pattern)
   */
  initializeInterface() {
    console.log('🎨 [CLIENT] Creating interface...');
    
    // Create app container like server framework
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h1>🎭 Gemini Agent - Legion Actor Framework</h1>
          <div id="status" style="padding: 10px; background: #f0f0f0; margin: 10px 0; border-radius: 5px;">
            🔄 Waiting for server ready signal...
          </div>
          <div id="messages" style="height: 400px; border: 1px solid #ddd; padding: 15px; overflow-y: auto; margin: 10px 0; background: white; border-radius: 5px;">
            <div style="color: #666; font-style: italic;">🎭 Actor interface initialized. Waiting for server connection...</div>
          </div>
          <div style="display: flex; gap: 10px; margin: 10px 0;">
            <input type="text" id="messageInput" placeholder="Waiting for server ready..." disabled style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px;">
            <button id="sendButton" disabled style="padding: 12px 24px; background: #ccc; color: white; border: none; border-radius: 5px; cursor: pointer;">Send</button>
          </div>
        </div>
      `;
      
      // Get element references
      this.statusElement = document.getElementById('status');
      this.messagesElement = document.getElementById('messages');
      this.inputElement = document.getElementById('messageInput');
      this.sendButton = document.getElementById('sendButton');
      
      console.log('✅ [CLIENT] Interface elements created and ready');
    } else {
      console.error('❌ [CLIENT] No #app container found - interface cannot be created');
    }
  }

  /**
   * Receive messages from server actor (Legion actor framework)
   */
  receive(messageType, data) {
    console.log('📨 [CLIENT] GeminiRootClient received:', messageType);
    console.log('📋 [CLIENT] Message data:', typeof data, data);
    
    switch (messageType) {
      case 'ready':
        console.log('🎉 [CLIENT] READY MESSAGE RECEIVED - ACTIVATING INTERFACE!');
        this._handleReady(data);
        break;
        
      case 'chat_response':
        console.log('💬 [CLIENT] Chat response received');
        this._handleChatResponse(data);
        break;
        
      case 'slash_response':
        console.log('⚡ [CLIENT] Slash response received');
        this._handleSlashResponse(data);
        break;
        
      default:
        console.log('⚠️ [CLIENT] Unknown message type:', messageType);
    }
  }

  /**
   * Handle ready signal from server
   */
  _handleReady(data) {
    console.log('🔧 [CLIENT] Processing ready signal and activating interface');
    
    this.state.connected = true;
    this.state.tools = data.tools || 0;
    
    // Activate interface elements
    if (this.statusElement) {
      this.statusElement.textContent = `✅ Connected! ${this.state.tools} tools available`;
      this.statusElement.style.background = '#d4edda';
    }
    
    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.placeholder = 'Ask me anything about your project...';
    }
    
    if (this.sendButton) {
      this.sendButton.disabled = false;
      this.sendButton.style.background = '#007bff';
      this.sendButton.style.cursor = 'pointer';
    }
    
    // Add welcome message
    if (this.messagesElement) {
      this.messagesElement.innerHTML += `
        <div style="background: #e7f3ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
          <strong>🎉 Actor Framework Connected!</strong><br>
          🔧 Tools: ${this.state.tools} available<br>
          🔍 Observability: Active<br>
          🏗️ SD Methodology: Ready<br><br>
          Try: "Create a test file" or "Build a simple app" or "/help"
        </div>
      `;
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
    
    // Bind events
    this._bindEvents();
    
    console.log('🎯 [CLIENT] INTERFACE FULLY ACTIVATED!');
  }

  /**
   * Bind event listeners
   */
  _bindEvents() {
    if (this.sendButton) {
      this.sendButton.onclick = () => this.sendMessage();
    }
    
    if (this.inputElement) {
      this.inputElement.onkeypress = (e) => {
        if (e.key === 'Enter') this.sendMessage();
      };
    }
  }

  /**
   * Send message to server through actor framework
   */
  sendMessage() {
    const message = this.inputElement.value.trim();
    if (!message || !this.remoteActor || !this.state.connected) return;
    
    console.log('📤 [CLIENT] Sending message through actor framework:', message);
    
    // Add to interface
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; text-align: right;"><strong>👤 You:</strong> ${message}</div>`;
    this.inputElement.value = '';
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    
    // Send through actor framework using remoteActor.receive() pattern
    this.remoteActor.receive('chat_message', { content: message });
  }

  /**
   * Handle chat response from server
   */
  _handleChatResponse(data) {
    console.log('💬 [CLIENT] Displaying chat response');
    this.messagesElement.innerHTML += `<div style="margin: 10px 0;"><strong>🤖 Agent:</strong> ${data.content}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle slash response from server
   */
  _handleSlashResponse(data) {
    console.log('⚡ [CLIENT] Displaying slash response');
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>⚡ Command:</strong><br>${data.content}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }
}