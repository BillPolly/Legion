import { UmbilicalUtils } from '/Legion/umbilical/index.js';

/**
 * ThoughtsDisplay - Shows the agent's thinking process during tool execution
 * Uses umbilical pattern for MVVM data binding
 */
export class ThoughtsDisplay {
  constructor() {
    this.element = null;
    
    // State with reactive binding
    this.state = {
      thoughts: [],
      isThinking: false,
      currentIteration: 0,
      currentTool: null
    };
    
    this.init();
  }
  
  init() {
    // Create the component element
    this.element = document.createElement('div');
    this.element.className = 'thoughts-display';
    this.element.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      color: white;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      font-size: 13px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(-10px);
    `;
    
    this.render();
  }
  
  /**
   * Add a thought entry
   */
  addThought(thought) {
    // Format the thought based on type
    const formattedThought = this.formatThought(thought);
    this.state.thoughts.push(formattedThought);
    
    // Keep only last 10 thoughts
    if (this.state.thoughts.length > 10) {
      this.state.thoughts.shift();
    }
    
    // Update state based on thought type
    switch (thought.type) {
      case 'thinking':
        this.state.isThinking = true;
        this.state.currentIteration = thought.iteration || 1;
        break;
        
      case 'tool_executing':
        this.state.currentTool = thought.toolName;
        break;
        
      case 'complete':
        this.state.isThinking = false;
        this.state.currentTool = null;
        this.fadeOutAfterDelay();
        break;
    }
    
    // Re-render
    this.render();
    this.updateThinkingState();
    
    // Show the display
    this.show();
  }
  
  /**
   * Format thought for display
   */
  formatThought(thought) {
    const timestamp = new Date(thought.timestamp).toLocaleTimeString();
    
    switch (thought.type) {
      case 'thinking':
        return {
          icon: '🤔',
          text: `Analyzing request... (iteration ${thought.iteration})`,
          timestamp,
          type: 'thinking'
        };
        
      case 'thought':
        return {
          icon: '💭',
          text: thought.content,
          timestamp,
          type: 'thought'
        };
        
      case 'tool_executing':
        return {
          icon: '🔧',
          text: `Executing ${thought.toolName}...`,
          details: this.formatParameters(thought.parameters),
          timestamp,
          type: 'tool'
        };
        
      case 'tool_result':
        return {
          icon: '✅',
          text: 'Tool completed',
          details: this.formatResult(thought.result),
          timestamp,
          type: 'result'
        };
        
      case 'complete':
        return {
          icon: '🎯',
          text: `Completed after ${thought.iterations} iteration${thought.iterations > 1 ? 's' : ''}`,
          timestamp,
          type: 'complete'
        };
        
      default:
        return {
          icon: '📝',
          text: JSON.stringify(thought),
          timestamp,
          type: 'unknown'
        };
    }
  }
  
  /**
   * Format tool parameters for display
   */
  formatParameters(params) {
    if (!params) return null;
    
    try {
      // Truncate long values
      const formatted = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.length > 100) {
          formatted[key] = value.substring(0, 100) + '...';
        } else {
          formatted[key] = value;
        }
      }
      return JSON.stringify(formatted, null, 2);
    } catch {
      return String(params);
    }
  }
  
  /**
   * Format tool result for display
   */
  formatResult(result) {
    if (!result) return null;
    
    try {
      const parsed = JSON.parse(result);
      if (parsed.error) {
        return `Error: ${parsed.error}`;
      }
      // Truncate long results
      const resultStr = JSON.stringify(parsed, null, 2);
      if (resultStr.length > 200) {
        return resultStr.substring(0, 200) + '...';
      }
      return resultStr;
    } catch {
      // Not JSON, just truncate if too long
      if (result.length > 200) {
        return result.substring(0, 200) + '...';
      }
      return result;
    }
  }
  
  /**
   * Update thinking animation state
   */
  updateThinkingState() {
    if (this.state.isThinking) {
      this.element.classList.add('thinking');
    } else {
      this.element.classList.remove('thinking');
    }
  }
  
  /**
   * Render the component
   */
  render() {
    const thoughts = this.state.thoughts;
    const isThinking = this.state.isThinking;
    const currentTool = this.state.currentTool;
    
    // Create header
    let headerHtml = '';
    if (isThinking) {
      headerHtml = `
        <div class="thoughts-header" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <div class="thinking-indicator" style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>
          <span style="font-weight: 600;">Agent Thinking${currentTool ? ` - ${currentTool}` : ''}...</span>
        </div>
      `;
    }
    
    // Create thought items
    const thoughtsHtml = thoughts.map(thought => `
      <div class="thought-item" style="
        margin: 6px 0;
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        border-left: 2px solid ${this.getThoughtColor(thought.type)};
        transition: all 0.2s ease;
      ">
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">${thought.icon}</span>
          <div style="flex: 1;">
            <div style="color: rgba(255, 255, 255, 0.95);">${thought.text}</div>
            ${thought.details ? `
              <pre style="
                margin-top: 4px;
                padding: 4px 8px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.8);
                overflow-x: auto;
                max-width: 100%;
              ">${thought.details}</pre>
            ` : ''}
          </div>
          <span style="
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            white-space: nowrap;
          ">${thought.timestamp}</span>
        </div>
      </div>
    `).join('');
    
    this.element.innerHTML = `
      ${headerHtml}
      <div class="thoughts-list">
        ${thoughtsHtml}
      </div>
      <style>
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .thoughts-display.thinking {
          animation: subtle-glow 2s ease-in-out infinite;
        }
        
        @keyframes subtle-glow {
          0% { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          50% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
          100% { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        }
        
        .thought-item:hover {
          background: rgba(255, 255, 255, 0.15) !important;
        }
      </style>
    `;
  }
  
  /**
   * Get color for thought type
   */
  getThoughtColor(type) {
    const colors = {
      thinking: '#fbbf24',
      thought: '#a78bfa',
      tool: '#60a5fa',
      result: '#34d399',
      complete: '#10b981',
      unknown: '#94a3b8'
    };
    return colors[type] || colors.unknown;
  }
  
  /**
   * Show the display with animation
   */
  show() {
    this.element.style.display = 'block';
    setTimeout(() => {
      this.element.style.opacity = '1';
      this.element.style.transform = 'translateY(0)';
    }, 10);
  }
  
  /**
   * Hide the display with animation
   */
  hide() {
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      this.element.style.display = 'none';
    }, 300);
  }
  
  /**
   * Fade out after delay when complete
   */
  fadeOutAfterDelay() {
    setTimeout(() => {
      if (!this.state.isThinking) {
        this.hide();
        // Clear thoughts after hiding
        setTimeout(() => {
          this.state.thoughts = [];
        }, 500);
      }
    }, 5000); // Keep visible for 5 seconds after completion
  }
  
  /**
   * Clear all thoughts
   */
  clear() {
    this.state.thoughts = [];
    this.state.isThinking = false;
    this.state.currentTool = null;
    this.state.isExpanded = false;
    this.state.hasCompleted = false;
    // Don't hide - let it stay in chat history
    this.render();
  }
  
  /**
   * Get the DOM element
   */
  getElement() {
    return this.element;
  }
  
  /**
   * Destroy the component
   */
  destroy() {
    this.clear();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}