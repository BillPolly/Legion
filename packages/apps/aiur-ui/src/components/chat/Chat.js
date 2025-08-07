/**
 * Chat Component - Main umbilical component for LLM chat interface
 * Uses MVVM pattern internally while exposing umbilical protocol externally
 */

import { ChatModel } from './model/ChatModel.js';
import { ChatView } from './view/ChatView.js';
import { ChatViewModel } from './viewmodel/ChatViewModel.js';
import { ArtifactViewer } from './artifacts/ArtifactViewer.js';

export class Chat {
  /**
   * Create a Chat instance following umbilical protocol
   */
  static create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical && umbilical.describe) {
      const requirements = {
        // Required
        dom: { type: 'HTMLElement', description: 'DOM container for the chat interface', required: true },
        chatActor: { type: 'ChatActor', description: 'Actor for WebSocket communication', required: true },
        
        // Optional configuration
        theme: { type: 'string', description: 'Visual theme: "light" or "dark"', default: 'dark' },
        placeholder: { type: 'string', description: 'Input placeholder text', default: 'Type your message...' },
        maxMessageLength: { type: 'number', description: 'Maximum message length', default: 10000 },
        showTimestamps: { type: 'boolean', description: 'Show message timestamps', default: true },
        enableMarkdown: { type: 'boolean', description: 'Enable markdown parsing', default: true },
        
        // Callbacks
        onMessageSent: { type: 'function', description: 'Called when user sends a message' },
        onMessageReceived: { type: 'function', description: 'Called when assistant responds' },
        onError: { type: 'function', description: 'Called on error' },
        onClear: { type: 'function', description: 'Called when chat is cleared' },
        onExport: { type: 'function', description: 'Called when chat is exported' },
        
        // Lifecycle
        onMount: { type: 'function', description: 'Called after component mounts' },
        onDestroy: { type: 'function', description: 'Called before component destroys' }
      };
      
      if (umbilical.describe) {
        umbilical.describe(requirements);
      }
      return;
    }
    
    // Validation mode
    if (umbilical && umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasChatActor: umbilical.chatActor && typeof umbilical.chatActor.sendChatMessage === 'function',
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme)
      });
    }
    
    // Instance creation mode
    if (!umbilical || !umbilical.dom) {
      throw new Error('Chat component requires a DOM element');
    }
    
    if (!umbilical.chatActor) {
      throw new Error('Chat component requires a ChatActor for communication');
    }
    
    // Create instance
    return new Chat(umbilical);
  }
  
  constructor(umbilical) {
    this.umbilical = umbilical;
    this.container = umbilical.dom;
    this.chatActor = umbilical.chatActor;
    
    // Configuration
    this.config = {
      theme: umbilical.theme || 'dark',
      placeholder: umbilical.placeholder || 'Type your message...',
      maxMessageLength: umbilical.maxMessageLength || 10000,
      showTimestamps: umbilical.showTimestamps !== false,
      enableMarkdown: umbilical.enableMarkdown !== false
    };
    
    // Initialize MVVM components
    this.model = new ChatModel();
    this.view = new ChatView(this.container);
    this.viewModel = new ChatViewModel(this.model, this.view, this.chatActor);
    
    // Initialize artifact viewer with the app container for Windows
    // Find the root app container (parent of chat window)
    const appContainer = this.container.closest('#app') || document.getElementById('app') || document.body;
    this.artifactViewer = new ArtifactViewer(appContainer);
    console.log('Chat: ArtifactViewer initialized with container:', appContainer);
    
    // Set up umbilical callbacks
    this.setupCallbacks();
    
    // Set up artifact event handling
    this.setupArtifactHandling();
    
    // Apply configuration
    this.applyConfiguration();
    
    // Lifecycle callback
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this);
    }
  }
  
  /**
   * Set up umbilical callbacks to bridge with MVVM
   */
  setupCallbacks() {
    // Bridge model events to umbilical callbacks
    this.model.subscribe((event, data) => {
      switch (event) {
        case 'message_added':
          if (data.role === 'user' && this.umbilical.onMessageSent) {
            this.umbilical.onMessageSent(data);
          } else if (data.role === 'assistant' && this.umbilical.onMessageReceived) {
            this.umbilical.onMessageReceived(data);
          }
          break;
          
        case 'error_changed':
          if (data && this.umbilical.onError) {
            this.umbilical.onError(data);
          }
          break;
          
        case 'messages_cleared':
          if (this.umbilical.onClear) {
            this.umbilical.onClear();
          }
          break;
      }
    });
  }
  
  /**
   * Set up artifact event handling
   */
  setupArtifactHandling() {
    // Listen for artifact clicks from the chat view
    this.container.addEventListener('artifact-click', (event) => {
      console.log('Chat: Artifact clicked:', event.detail);
      const { artifact, renderer } = event.detail;
      this.artifactViewer.show(artifact, renderer);
    });

    // Handle global artifact events
    document.addEventListener('artifact-view', (event) => {
      const { artifact, renderer } = event.detail;
      this.artifactViewer.show(artifact, renderer);
    });

    document.addEventListener('artifact-download', (event) => {
      const { artifact } = event.detail;
      this.downloadArtifact(artifact);
    });

    // Set up artifact viewer callbacks
    this.artifactViewer.onDownload = (artifact) => {
      this.downloadArtifact(artifact);
    };
  }

  /**
   * Download artifact content
   * @param {Object} artifact - Artifact metadata
   */
  async downloadArtifact(artifact) {
    try {
      // This is a placeholder - in a real implementation you would
      // fetch the content from the server or file system
      let content = artifact.content;
      let filename = artifact.title;

      if (!content && artifact.preview) {
        content = artifact.preview;
        filename = filename + ' (preview)';
      }

      if (!content) {
        throw new Error('No content available for download');
      }

      // Create blob and download
      const mimeType = this.getMimeType(artifact);
      const blob = new Blob([content], { type: mimeType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Downloaded artifact: ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      if (this.umbilical.onError) {
        this.umbilical.onError(new Error(`Download failed: ${error.message}`));
      }
    }
  }

  /**
   * Get MIME type for artifact
   * @param {Object} artifact - Artifact metadata
   * @returns {string} MIME type
   */
  getMimeType(artifact) {
    const mimeMap = {
      js: 'text/javascript',
      jsx: 'text/javascript',
      ts: 'text/typescript',
      tsx: 'text/typescript',
      html: 'text/html',
      css: 'text/css',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
      py: 'text/x-python',
      java: 'text/x-java-source',
      xml: 'application/xml',
      csv: 'text/csv'
    };

    return mimeMap[artifact.subtype] || 'text/plain';
  }
  
  /**
   * Apply configuration to view
   */
  applyConfiguration() {
    // Apply theme
    if (this.config.theme === 'light') {
      this.applyLightTheme();
    }
    
    // Apply placeholder
    if (this.view.elements.inputField) {
      this.view.elements.inputField.placeholder = this.config.placeholder;
    }
    
    // Configure view settings
    if (!this.config.showTimestamps) {
      // Hide timestamps via CSS
      const style = document.createElement('style');
      style.textContent = '.message-timestamp { display: none !important; }';
      this.container.appendChild(style);
    }
  }
  
  /**
   * Apply light theme
   */
  applyLightTheme() {
    const container = this.container.querySelector('.chat-container');
    if (container) {
      container.style.background = '#ffffff';
      container.style.color = '#333333';
    }
    
    const messagesContainer = this.container.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.style.background = '#f5f5f5';
    }
    
    const inputContainer = this.container.querySelector('.input-container');
    if (inputContainer) {
      inputContainer.style.background = '#ffffff';
      inputContainer.style.borderTopColor = '#e0e0e0';
    }
    
    const input = this.view.elements.inputField;
    if (input) {
      input.style.background = '#f5f5f5';
      input.style.borderColor = '#ddd';
      input.style.color = '#333';
    }
  }
  
  // Public API methods
  
  /**
   * Send a message programmatically
   */
  sendMessage(content) {
    return this.viewModel.sendMessage(content);
  }
  
  /**
   * Clear the chat
   */
  clear() {
    this.viewModel.clearChat();
  }
  
  /**
   * Export chat history
   */
  export() {
    const history = this.viewModel.exportChat();
    
    if (this.umbilical.onExport) {
      this.umbilical.onExport(history);
    }
    
    return history;
  }
  
  /**
   * Import chat history
   */
  import(history) {
    return this.viewModel.importChat(history);
  }
  
  /**
   * Get all messages
   */
  getMessages() {
    return this.model.getMessages();
  }
  
  /**
   * Get conversation as text
   */
  getConversationText() {
    return this.model.getConversationText();
  }
  
  /**
   * Focus the input field
   */
  focus() {
    this.view.focus();
  }
  
  /**
   * Enable/disable input
   */
  setEnabled(enabled) {
    this.view.setInputEnabled(enabled);
  }
  
  /**
   * Show an error message
   */
  showError(error) {
    this.model.setError(error);
  }
  
  /**
   * Clear error message
   */
  clearError() {
    this.model.clearError();
  }
  
  /**
   * Update configuration
   */
  updateConfig(config) {
    Object.assign(this.config, config);
    this.applyConfiguration();
  }
  
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Destroy the component
   */
  destroy() {
    // Lifecycle callback
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy(this);
    }
    
    // Destroy MVVM components
    if (this.viewModel) {
      this.viewModel.destroy();
    }
    
    if (this.view) {
      this.view.destroy();
    }
    
    // Destroy artifact viewer
    if (this.artifactViewer) {
      this.artifactViewer.destroy();
    }
    
    // Clear references
    this.model = null;
    this.view = null;
    this.viewModel = null;
    this.chatActor = null;
    this.container = null;
    this.umbilical = null;
    this.artifactViewer = null;
  }
}