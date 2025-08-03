import { Terminal } from './components/terminal/Terminal.js';
import { Chat } from './components/chat/Chat.js';
import { Window } from '/Legion/components/window/index.js';
import { FrontendActorSpace } from './actors/FrontendActorSpace.js';
import { TerminalActor } from './actors/TerminalActor.js';
import { ChatActor } from './actors/ChatActor.js';

export class App {
  constructor(container) {
    this.container = container;
    this.terminal = null;
    this.chat = null;
    this.terminalWindow = null;
    this.chatWindow = null;
    this.actorSpace = null;
    this.terminalActor = null;
    this.chatActor = null;
  }
  
  async render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Set container to full viewport
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.position = 'relative';
    this.container.style.background = '#1a1a1a';
    
    // Initialize actor system
    await this.initializeActorSystem();
    
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
      onClose: () => {
        console.log('Terminal window closed');
        this.terminalWindow.show(); // Re-show if closed
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
      onClose: () => {
        console.log('Chat window closed');
        this.chatWindow.show(); // Re-show if closed
      },
      onResize: (width, height) => {
        console.log(`Chat window resized to ${width}x${height}`);
      }
    });
    
    // Create terminal inside its window
    this.terminal = new Terminal(this.terminalWindow.contentElement);
    
    // Connect terminal actor
    if (this.terminalActor) {
      this.terminalActor.terminal = this.terminal;
      this.terminal.terminalActor = this.terminalActor;
    }
    
    // Create chat inside its window
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
      // Create actor space with proper actor protocol
      this.actorSpace = new FrontendActorSpace();
      
      // Create actors
      this.terminalActor = new TerminalActor(null); // Terminal will be set later
      this.chatActor = new ChatActor();
      
      // Connect actors to actor space
      this.terminalActor.connect(this.actorSpace);
      this.chatActor.connect(this.actorSpace);
      
      // Try to connect to server
      console.log('Connecting to server...');
      await this.actorSpace.connect('ws://localhost:8080/ws');
      
      console.log('Connected to server successfully');
      
    } catch (error) {
      console.error('Failed to initialize actor system:', error);
      // Continue anyway - components can work offline
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
  
  destroy() {
    if (this.terminal) {
      this.terminal.destroy();
    }
    if (this.chat) {
      this.chat.destroy();
    }
    if (this.terminalWindow) {
      this.terminalWindow.destroy();
    }
    if (this.chatWindow) {
      this.chatWindow.destroy();
    }
    if (this.terminalActor) {
      this.terminalActor.disconnect();
    }
    if (this.chatActor) {
      this.chatActor.destroy();
    }
    if (this.actorSpace) {
      this.actorSpace.disconnect();
    }
  }
}