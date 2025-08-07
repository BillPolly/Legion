import { Terminal } from './components/terminal/Terminal.js';
import { Chat } from './components/chat/Chat.js';
import { Window } from '/Legion/components/window/index.js';
import { FrontendActorSpace } from './actors/FrontendActorSpace.js';
import { ChatActor } from './actors/ChatActor.js';
import { ArtifactDebugView } from './components/debug/ArtifactDebugView.js';

export class App {
  constructor(container) {
    this.container = container;
    this.terminal = null;
    this.chat = null;
    this.terminalWindow = null;
    this.chatWindow = null;
    this.actorSpace = null;
    this.chatActor = null;
    this.terminalActor = null;
    this.artifactDebugActor = null;
    this.artifactDebugView = null;
  }
  
  async render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Set container to full viewport
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.position = 'relative';
    this.container.style.background = '#1a1a1a';
    
    // Set up right-click context menu
    this.setupContextMenu();
    
    // Create terminal window
    this.terminalWindow = Window.create({
      dom: this.container,
      title: 'Aiur Terminal',
      width: 700,
      height: 500,
      position: { x: 50, y: 50 },
      theme: 'dark',
      resizable: true,
      draggable: true,
      hideOnClose: true,
      onClose: () => {
        console.log('Terminal window closed');
      },
      onResize: (width, height) => {
        console.log(`Terminal window resized to ${width}x${height}`);
      }
    });
    
    // Create chat window
    this.chatWindow = Window.create({
      dom: this.container,
      title: 'AI Chat Assistant',
      width: 500,
      height: 600,
      position: { x: 780, y: 50 },
      theme: 'dark',
      resizable: true,
      draggable: true,
      hideOnClose: true,
      onClose: () => {
        console.log('Chat window closed');
      },
      onResize: (width, height) => {
        console.log(`Chat window resized to ${width}x${height}`);
      }
    });
    
    // Create terminal inside its window
    this.terminal = new Terminal(this.terminalWindow.contentElement);
    this.terminal.initialize();
    
    // Initialize actor system BEFORE creating chat
    await this.initializeActorSystem();
    
    // Now create chat with the initialized chatActor
    this.chat = Chat.create({
      dom: this.chatWindow.contentElement,
      chatActor: this.chatActor,
      theme: 'dark',
      placeholder: 'Ask me anything...',
      onMessageSent: (message) => {
        console.log('User sent:', message);
      },
      onMessageReceived: (message) => {
        console.log('Assistant replied:', message);
      },
      onError: (error) => {
        console.error('Chat error:', error);
      }
    });
    
    // Focus the terminal initially
    this.terminal.focus();
    
    // Add help text to chat
    this.showChatWelcome();
  }
  
  async initializeActorSystem() {
    try {
      // Create actor space with proper actor protocol for both chat and terminal
      this.actorSpace = new FrontendActorSpace();
      
      // Try to connect to server - pass terminal for TerminalActor
      console.log('Connecting to server...');
      await this.actorSpace.connect('ws://localhost:8080/ws', this.terminal);
      
      // Get the actors that were created during handshake
      this.chatActor = this.actorSpace.chatActor;
      this.terminalActor = this.actorSpace.terminalActor;
      this.artifactDebugActor = this.actorSpace.getActor('artifactDebug');
      
      console.log('Chat and Terminal actors connected successfully');
      
      // Initialize artifact debug view if actor is available
      if (this.artifactDebugActor) {
        this.initializeArtifactDebug();
      }
      
    } catch (error) {
      console.error('Failed to initialize actor system:', error);
      console.log('Actors will not be available');
    }
  }
  
  showChatWelcome() {
    if (this.chat) {
      // Add a welcome message
      setTimeout(() => {
        if (this.chat && this.chat.model) {
          this.chat.model.addMessage(
            'Hello! I\'m your AI assistant. I can help you with coding, answer questions, and assist with various tasks. How can I help you today?',
            'assistant'
          );
        }
      }, 1000);
    }
  }
  
  /**
   * Initialize artifact debug system
   */
  initializeArtifactDebug() {
    console.log('Initializing artifact debug system...');
    
    // Create artifact debug view with its own ArtifactViewer
    this.artifactDebugView = new ArtifactDebugView(this.container);
    
    // Connect artifact debug actor to view
    if (this.artifactDebugActor) {
      // Set up event handlers
      this.artifactDebugActor.onArtifactCreated = (artifacts) => {
        console.log('ArtifactDebugView: New artifacts detected:', artifacts.length);
        this.artifactDebugView.addArtifacts(artifacts);
      };
      
      this.artifactDebugActor.onArtifactUpdated = (artifact) => {
        console.log('ArtifactDebugView: Artifact updated:', artifact.id);
        this.artifactDebugView.updateArtifact(artifact);
      };
      
      this.artifactDebugActor.onArtifactsCleared = () => {
        console.log('ArtifactDebugView: Artifacts cleared');
        this.artifactDebugView.clearArtifacts();
      };
      
      // Request initial artifacts
      this.artifactDebugActor.requestArtifacts();
      
      // Show the debug view
      this.artifactDebugView.show();
    }
  }
  
  /**
   * Set up right-click context menu for window management
   */
  setupContextMenu() {
    // Create context menu element
    const contextMenu = document.createElement('div');
    contextMenu.id = 'window-context-menu';
    contextMenu.style.cssText = `
      position: absolute;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      padding: 8px;
      display: none;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #e0e0e0;
    `;
    
    this.container.appendChild(contextMenu);
    
    // Set up right-click handler
    this.container.addEventListener('contextmenu', (e) => {
      // Only show menu on background, not on windows
      if (e.target === this.container) {
        e.preventDefault();
        
        // Build menu items
        contextMenu.innerHTML = '';
        
        const menuItems = [
          { label: 'Show Terminal', action: () => this.terminalWindow?.show() },
          { label: 'Show Chat', action: () => this.chatWindow?.show() },
          { label: 'Show Artifact Debug', action: () => this.artifactDebugView?.show() }
        ];
        
        menuItems.forEach(item => {
          const menuItem = document.createElement('div');
          menuItem.textContent = item.label;
          menuItem.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.2s;
          `;
          
          menuItem.addEventListener('mouseover', () => {
            menuItem.style.background = '#1f6feb';
          });
          
          menuItem.addEventListener('mouseout', () => {
            menuItem.style.background = 'transparent';
          });
          
          menuItem.addEventListener('click', () => {
            item.action();
            contextMenu.style.display = 'none';
          });
          
          contextMenu.appendChild(menuItem);
        });
        
        // Position and show menu
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'block';
      }
    });
    
    // Hide menu on click elsewhere
    document.addEventListener('click', () => {
      contextMenu.style.display = 'none';
    });
  }
  
  destroy() {
    if (this.terminal) {
      this.terminal.destroy();
    }
    if (this.chat) {
      this.chat.destroy();
    }
    if (this.artifactDebugView) {
      this.artifactDebugView.destroy();
    }
    if (this.terminalWindow) {
      this.terminalWindow.destroy();
    }
    if (this.chatWindow) {
      this.chatWindow.destroy();
    }
    if (this.chatActor) {
      this.chatActor.destroy();
    }
    if (this.actorSpace) {
      this.actorSpace.disconnect();
    }
  }
}