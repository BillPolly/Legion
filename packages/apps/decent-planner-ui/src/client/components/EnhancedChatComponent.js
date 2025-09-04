/**
 * EnhancedChatComponent - Chat interface with context and LLM debugging
 * 
 * Layout:
 * - Left pane: ChatComponent (messages + input)
 * - Draggable vertical divider
 * - Right pane: Tabs with Context Display and LLM Debug
 * 
 * Provides comprehensive observability of tool agent behavior.
 */

import { ChatComponent } from './ChatComponent.js';
import { ContextDisplayComponent } from './ContextDisplayComponent.js';
import { LLMDebugComponent } from './LLMDebugComponent.js';
import { TabsComponent } from './TabsComponent.js';

export class EnhancedChatComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      dividerPosition: options.dividerPosition || 70, // 70% for chat, 30% for debug
      activeDebugTab: 'context',
      messages: options.messages || [],
      connected: options.connected || false
    };
    
    // View elements
    this.elements = {};
    this.components = {};
    
    this.createLayout();
    this.initializeComponents();
    this.attachEventListeners();
  }

  /**
   * Create the split pane layout
   */
  createLayout() {
    this.container.innerHTML = '';
    
    // Main container with flexbox layout
    this.elements.mainContainer = document.createElement('div');
    this.elements.mainContainer.className = 'enhanced-chat-container';
    this.elements.mainContainer.style.display = 'flex';
    this.elements.mainContainer.style.height = 'calc(100vh - 140px)';
    this.elements.mainContainer.style.position = 'relative';
    
    // Left pane for chat
    this.elements.leftPane = document.createElement('div');
    this.elements.leftPane.className = 'chat-left-pane';
    this.elements.leftPane.style.flex = '1';
    this.elements.leftPane.style.minWidth = '300px';
    this.elements.leftPane.style.display = 'flex';
    this.elements.leftPane.style.flexDirection = 'column';
    this.elements.leftPane.style.overflow = 'hidden';
    this.elements.leftPane.style.height = '100%';
    
    // Draggable divider
    this.elements.divider = document.createElement('div');
    this.elements.divider.className = 'chat-divider';
    this.elements.divider.style.width = '4px';
    this.elements.divider.style.backgroundColor = '#d1d5db';
    this.elements.divider.style.cursor = 'col-resize';
    this.elements.divider.style.borderLeft = '1px solid #9ca3af';
    this.elements.divider.style.borderRight = '1px solid #9ca3af';
    this.elements.divider.style.position = 'relative';
    this.elements.divider.style.zIndex = '10';
    
    // Divider hover effect
    this.elements.divider.addEventListener('mouseenter', () => {
      this.elements.divider.style.backgroundColor = '#9ca3af';
    });
    this.elements.divider.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.elements.divider.style.backgroundColor = '#d1d5db';
      }
    });
    
    // Right pane for debug tabs
    this.elements.rightPane = document.createElement('div');
    this.elements.rightPane.className = 'chat-right-pane';
    this.elements.rightPane.style.width = `${100 - this.model.dividerPosition}%`;
    this.elements.rightPane.style.minWidth = '250px';
    this.elements.rightPane.style.maxWidth = '50%';
    this.elements.rightPane.style.borderLeft = '1px solid #ddd';
    this.elements.rightPane.style.overflow = 'hidden';
    this.elements.rightPane.style.height = '100%';
    this.elements.rightPane.style.display = 'flex';
    this.elements.rightPane.style.flexDirection = 'column';
    
    // Set left pane width
    this.elements.leftPane.style.width = `${this.model.dividerPosition}%`;
    
    // Assemble layout
    this.elements.mainContainer.appendChild(this.elements.leftPane);
    this.elements.mainContainer.appendChild(this.elements.divider);
    this.elements.mainContainer.appendChild(this.elements.rightPane);
    
    this.container.appendChild(this.elements.mainContainer);
  }

  /**
   * Initialize child components
   */
  initializeComponents() {
    // Initialize chat component in left pane
    this.components.chat = new ChatComponent(this.elements.leftPane, {
      messages: this.model.messages,
      connected: this.model.connected,
      onSendMessage: this.options.onSendMessage || (() => {}),
      onInputChange: this.options.onInputChange || (() => {})
    });
    
    // Create tabs for right pane
    this.components.tabs = new TabsComponent(this.elements.rightPane, {
      tabs: [
        { 
          id: 'context', 
          label: 'Context', 
          icon: '📝' 
        },
        { 
          id: 'llm-debug', 
          label: 'LLM Debug', 
          icon: '🧠' 
        }
      ],
      activeTab: this.model.activeDebugTab,
      onTabChange: (tabId) => this.handleDebugTabChange(tabId)
    });
    
    // Initialize context display component
    const contextContainer = this.components.tabs.getContentContainer('context');
    if (contextContainer) {
      this.components.context = new ContextDisplayComponent(contextContainer);
      this.components.context.setClearContextCallback(() => {
        if (this.options.onClearContext) {
          this.options.onClearContext();
        }
      });
    }
    
    // Initialize LLM debug component
    const llmContainer = this.components.tabs.getContentContainer('llm-debug');
    if (llmContainer) {
      this.components.llmDebug = new LLMDebugComponent(llmContainer);
    }
  }

  /**
   * Attach event listeners for divider dragging
   */
  attachEventListeners() {
    this.isDragging = false;
    this.dragStartX = 0;
    this.startLeftWidth = 0;
    
    // Mouse down on divider
    this.elements.divider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      
      const containerRect = this.elements.mainContainer.getBoundingClientRect();
      this.startLeftWidth = this.elements.leftPane.getBoundingClientRect().width;
      this.containerWidth = containerRect.width;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      // Add document listeners for drag
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    });
  }

  /**
   * Handle mouse move during divider drag
   */
  handleMouseMove = (e) => {
    if (!this.isDragging) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - this.dragStartX;
    const newLeftWidth = this.startLeftWidth + deltaX;
    const newPosition = (newLeftWidth / this.containerWidth) * 100;
    
    // Clamp position between 30% and 80%
    const clampedPosition = Math.max(30, Math.min(80, newPosition));
    
    this.updateDividerPosition(clampedPosition);
  }

  /**
   * Handle mouse up to end divider drag
   */
  handleMouseUp = (e) => {
    if (!this.isDragging) return;
    
    e.preventDefault();
    this.isDragging = false;
    
    // Reset cursor and selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.elements.divider.style.backgroundColor = '#d1d5db';
    
    // Remove document listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Callback for position change
    if (this.options.onDividerResize) {
      this.options.onDividerResize(this.model.dividerPosition);
    }
  }

  /**
   * Update divider position
   */
  updateDividerPosition(position) {
    this.model.dividerPosition = position;
    
    this.elements.leftPane.style.width = `${position}%`;
    this.elements.rightPane.style.width = `${100 - position}%`;
  }

  /**
   * Handle debug tab change
   */
  handleDebugTabChange(tabId) {
    this.model.activeDebugTab = tabId;
    
    if (this.options.onDebugTabChange) {
      this.options.onDebugTabChange(tabId);
    }
  }

  /**
   * Update chat messages (delegate to ChatComponent)
   */
  updateMessages(messages) {
    this.model.messages = messages;
    if (this.components.chat) {
      this.components.chat.updateMessages(messages);
    }
  }

  /**
   * Update connection status (delegate to ChatComponent)
   */
  updateConnectionStatus(connected) {
    this.model.connected = connected;
    if (this.components.chat) {
      this.components.chat.updateConnectionStatus(connected);
    }
  }

  /**
   * Add agent message (delegate to ChatComponent)
   */
  addAgentMessage(messageData) {
    if (this.components.chat) {
      this.components.chat.addAgentMessage(messageData);
    }
  }

  /**
   * Add agent error (delegate to ChatComponent)
   */
  addAgentError(errorData) {
    if (this.components.chat) {
      this.components.chat.addAgentError(errorData);
    }
  }

  /**
   * Add agent thinking message (delegate to ChatComponent)
   */
  addAgentThinking(thinkingData) {
    if (this.components.chat) {
      this.components.chat.addAgentThinking(thinkingData);
    }
  }

  /**
   * Add command response message (delegate to ChatComponent)
   */
  addCommandResponse(responseData) {
    if (this.components.chat) {
      this.components.chat.addCommandResponse(responseData);
    }
  }

  /**
   * Add command error message (delegate to ChatComponent)
   */
  addCommandError(errorData) {
    if (this.components.chat) {
      this.components.chat.addCommandError(errorData);
    }
  }

  /**
   * Update context display
   */
  updateContext(contextState) {
    if (this.components.context) {
      this.components.context.updateContext(contextState);
    }
  }

  /**
   * Add LLM interaction to debug panel
   */
  addLLMInteraction(interaction) {
    console.error('🧠 ENHANCED CHAT: Adding LLM interaction - purpose:', interaction?.purpose);
    console.error('🧠 ENHANCED CHAT: llmDebug component exists:', !!this.components.llmDebug);
    if (this.components.llmDebug) {
      console.error('🧠 ENHANCED CHAT: About to call addInteraction');
      this.components.llmDebug.addInteraction(interaction);
      console.error('🧠 ENHANCED CHAT: addInteraction completed');
    } else {
      console.error('❌ ENHANCED CHAT: No llmDebug component available');
    }
  }

  /**
   * Add operation to context history
   */
  addOperation(operation) {
    if (this.components.context) {
      this.components.context.addOperation(operation);
    }
  }

  /**
   * Clear input (delegate to ChatComponent)
   */
  clearInput() {
    if (this.components.chat) {
      this.components.chat.clearInput();
    }
  }

  /**
   * Focus input (delegate to ChatComponent)
   */
  focusInput() {
    if (this.components.chat) {
      this.components.chat.focusInput();
    }
  }

  /**
   * Clear all debug data
   */
  clearDebugData() {
    if (this.components.context) {
      this.components.context.clear();
    }
    if (this.components.llmDebug) {
      this.components.llmDebug.clearHistory();
    }
  }

  /**
   * Switch to specific debug tab
   */
  switchToDebugTab(tabId) {
    if (this.components.tabs) {
      this.components.tabs.switchTab(tabId);
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      dividerPosition: this.model.dividerPosition,
      activeDebugTab: this.model.activeDebugTab,
      messageCount: this.model.messages.length,
      components: {
        chat: !!this.components.chat,
        context: !!this.components.context,
        llmDebug: !!this.components.llmDebug,
        tabs: !!this.components.tabs
      }
    };
  }

  /**
   * Destroy component and cleanup
   */
  /**
   * Add context state (delegate to context display component)
   * @param {Object} contextData - Context state data to display
   */
  addContextState(contextData) {
    if (this.components.context && this.components.context.addContextState) {
      this.components.context.addContextState(contextData);
    } else {
      console.warn('Context display component not available for addContextState');
    }
  }

  destroy() {
    // Remove document event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Reset body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Cleanup child components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    // Clear container
    this.container.innerHTML = '';
  }
}