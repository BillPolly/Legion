/**
 * RootClientActor - Top-level client actor managing main tabs and sub-actors
 * Follows MVVM pattern and manages PlannerClientSubActor and ChatClientSubActor
 */

import { ProtocolActor } from '/src/shared/ProtocolActor.js';
import { TabsComponent } from '/src/client/components/TabsComponent.js';
import PlannerClientSubActor from '/src/client/actors/PlannerClientSubActor.js';
import ChatClientSubActor from '/src/client/actors/ChatClientSubActor.js';

export default class RootClientActor extends ProtocolActor {
  constructor() {
    super();
    this.remoteActor = null;
    this.actorSpace = null;
    
    // Sub-actors
    this.plannerSubActor = null;
    this.chatSubActor = null;
    
    // Main tabs component
    this.tabsComponent = null;
    
    // Merge additional state properties with the protocol-initialized state
    Object.assign(this.state, {
      activeMainTab: 'planner', // 'planner' or 'chat'
      connected: false
    });
  }

  getProtocol() {
    return {
      name: "RootClientActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          activeMainTab: { type: 'string', required: true }
        },
        initial: {
          connected: false,
          activeMainTab: 'planner'
        }
      },
      
      messages: {
        receives: {
          'ready': {
            schema: {
              timestamp: { type: 'string' }
            },
            postconditions: ['connected is true']
          },
          'error': {
            schema: {
              message: { type: 'string' },
              name: { type: 'string' },
              stack: { type: 'string' }
            }
          }
        },
        sends: {
          'ping': {
            schema: {
              timestamp: { type: 'number' }
            },
            preconditions: ['connected is true']
          }
        }
      }
    };
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Root client actor connected');
    
    // Add CSS styles FIRST, before any UI setup
    this.addStyles();
    
    // Update connection status immediately
    this.state.connected = true;
    
    // Get ActorSpace reference from framework
    this.actorSpace = this.__actorSpace;
    
    // Initialize sub-actors
    this.plannerSubActor = new PlannerClientSubActor();
    this.chatSubActor = new ChatClientSubActor();
    
    // Register sub-actors in the ActorSpace for direct communication
    if (this.actorSpace) {
      this.actorSpace.register(this.plannerSubActor, 'planner-client-sub');
      this.actorSpace.register(this.chatSubActor, 'chat-client-sub');
      
      // Create remote references for sub-actors to communicate directly
      const remotePlannerServer = this.actorSpace.makeRemote('planner-server-sub');
      const remoteChatServer = this.actorSpace.makeRemote('chat-server-sub');
      
      // Set remote actors on sub-actors for direct communication
      await this.plannerSubActor.setRemoteActor(remotePlannerServer);
      await this.chatSubActor.setRemoteActor(remoteChatServer);
    }
    
    // Set parent references
    this.plannerSubActor.setParentActor(this);
    this.chatSubActor.setParentActor(this);
    
    // Set up the UI
    this.setupUI();
  }

  addStyles() {
    // Remove any existing custom styles first
    const existingStyle = document.getElementById('decent-planner-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'decent-planner-styles';
    style.textContent = `
      /* Reset and base styles */
      body {
        margin: 0 !important;
        padding: 0 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        background: #f5f5f5 !important;
        min-height: 100vh !important;
      }
      
      /* Root container styles */
      .root-container {
        margin: 0 !important;
        padding: 20px !important;
        min-height: 100vh !important;
      }
      
      /* Connection status */
      .connection-status {
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        background: #4caf50 !important;
        color: white !important;
        z-index: 1000 !important;
      }
      
      /* Main tabs styles */
      .tabs-container {
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        overflow: hidden !important;
        margin-bottom: 0 !important;
      }
      
      .tabs-nav {
        display: flex !important;
        background: #f8f9fa !important;
        border-bottom: 1px solid #e9ecef !important;
        margin: 0 !important;
      }
      
      .tab-btn {
        flex: 1;
        padding: 16px 24px;
        border: none;
        background: transparent;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 3px solid transparent;
      }
      
      .tab-btn:hover {
        background: #e9ecef;
      }
      
      .tab-btn.active {
        background: white;
        border-bottom-color: #007bff;
        color: #007bff;
      }
      
      .tab-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .tab-panel {
        padding: 24px;
      }
      
      .tab-panel.hidden {
        display: none;
      }
      
      /* Planner specific styles */
      .planner-container {
        max-width: none;
      }
      
      /* Planner sub-tabs */
      .planner-tab-nav {
        display: flex;
        background: #f8f9fa;
        border-radius: 4px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      
      .planner-tab-btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: background 0.2s ease;
        font-size: 14px;
      }
      
      .planner-tab-btn:hover:not(:disabled) {
        background: #e9ecef;
      }
      
      .planner-tab-btn.active {
        background: #28a745;
        color: white;
      }
      
      .planner-tab-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .tab-content, .planner-tab-content {
        background: white;
        border-radius: 4px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      .planner-tab-content.hidden {
        display: none;
      }
      
      /* Chat styles */
      .chat-container {
        display: flex;
        flex-direction: column;
        height: 400px;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .chat-connection-status {
        padding: 8px 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
        font-size: 12px;
        font-weight: 500;
      }
      
      .chat-connection-status.connected {
        background: #d4edda;
        color: #155724;
      }
      
      .chat-connection-status.disconnected {
        background: #f8d7da;
        color: #721c24;
      }
      
      .chat-messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: white;
      }
      
      .chat-message {
        margin-bottom: 12px;
        padding: 8px 12px;
        border-radius: 4px;
        max-width: 70%;
      }
      
      .chat-message.user {
        background: #007bff;
        color: white;
        margin-left: auto;
      }
      
      .chat-message.server {
        background: #e9ecef;
        color: #333;
      }
      
      .chat-message-timestamp {
        font-size: 10px;
        opacity: 0.7;
        margin-right: 8px;
      }
      
      .chat-message-sender {
        font-weight: bold;
        font-size: 12px;
        margin-right: 8px;
      }
      
      .chat-message-text {
        margin-top: 4px;
      }
      
      .chat-input-container {
        display: flex;
        padding: 16px;
        border-top: 1px solid #e9ecef;
        background: #f8f9fa;
      }
      
      .chat-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        margin-right: 8px;
        outline: none;
      }
      
      .chat-input:focus {
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
      }
      
      .chat-send-button {
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      
      .chat-send-button:hover:not(:disabled) {
        background: #0056b3;
      }
      
      .chat-send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  setupUI() {
    const container = document.querySelector('body') || document.createElement('div');
    
    // Create main container
    container.innerHTML = `
      <div class="root-container">
        <div class="connection-status" id="connection-status">
          ${this.state.connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div id="main-tabs-container"></div>
      </div>
    `;
    
    // Initialize main tabs
    const tabsContainer = document.getElementById('main-tabs-container');
    this.tabsComponent = new TabsComponent(tabsContainer, {
      tabs: [
        {
          id: 'planner',
          label: '🧠 Decent Planner',
          icon: ''
        },
        {
          id: 'chat',
          label: '💬 Chat',
          icon: ''
        }
      ],
      activeTab: this.state.activeMainTab,
      onTabChange: (tabId) => {
        this.handleMainTabChange(tabId);
      }
    });
    
    // Initialize sub-actor UIs
    this.initializeSubActorUIs();
  }

  initializeSubActorUIs() {
    // Get content containers for each tab
    const plannerContainer = this.tabsComponent.getContentContainer('planner');
    const chatContainer = this.tabsComponent.getContentContainer('chat');
    
    // Initialize planner sub-actor UI
    if (this.plannerSubActor && plannerContainer) {
      this.plannerSubActor.setupUI(plannerContainer);
    }
    
    // Initialize chat sub-actor UI  
    if (this.chatSubActor && chatContainer) {
      this.chatSubActor.setupUI(chatContainer);
    }
  }

  handleMainTabChange(tabId) {
    this.state.activeMainTab = tabId;
    
    // Notify the active sub-actor that it's now visible
    if (tabId === 'planner' && this.plannerSubActor) {
      this.plannerSubActor.onTabActivated();
    } else if (tabId === 'chat' && this.chatSubActor) {
      this.chatSubActor.onTabActivated();
    }
  }

  receive(messageType, data) {
    console.log('📨 Root client received:', messageType);
    
    switch (messageType) {
      case 'ready':
        this.state.connected = true;
        this.updateConnectionStatus();
        // Forward to sub-actors
        if (this.plannerSubActor) {
          this.plannerSubActor.receive(messageType, data);
        }
        if (this.chatSubActor) {
          this.chatSubActor.receive(messageType, data);
        }
        break;
        
      case 'error':
        console.error('Root client received error:', data);
        this.updateConnectionStatus();
        break;
        
      default:
        // Forward to appropriate sub-actor based on message prefix or current active tab
        if (messageType.startsWith('planner-') && this.plannerSubActor) {
          this.plannerSubActor.receive(messageType.replace('planner-', ''), data);
        } else if (messageType.startsWith('chat-') && this.chatSubActor) {
          this.chatSubActor.receive(messageType.replace('chat-', ''), data);
        } else {
          // Default to active tab
          const activeSubActor = this.state.activeMainTab === 'planner' ? this.plannerSubActor : this.chatSubActor;
          if (activeSubActor) {
            activeSubActor.receive(messageType, data);
          }
        }
        break;
    }
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.textContent = this.state.connected ? '🟢 Connected' : '🔴 Disconnected';
    }
  }

  // Method for sub-actors to send messages to their server counterparts
  sendToSubActor(subActorType, messageType, data) {
    if (this.remoteActor) {
      const prefixedMessageType = `${subActorType}-${messageType}`;
      this.remoteActor.receive(prefixedMessageType, data);
    }
  }
}