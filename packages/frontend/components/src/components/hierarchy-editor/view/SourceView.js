/**
 * SourceView - Displays formatted source code with syntax highlighting
 * Part of the HierarchyEditor MVVM architecture
 */
import { SyntaxHighlighter } from './SyntaxHighlighter.js';

export class SourceView {
  constructor(dom, config = {}) {
    this.dom = dom;
    
    this.config = {
      content: '',
      format: 'text',
      readOnly: false,
      theme: 'light',
      showLineNumbers: false,
      wordWrap: false,
      fontSize: 12,
      ...config
    };
    
    this.highlighter = null;
    this.editorElement = null;
    this.contentElement = null;
    this.isDestroyed = false;
    
    // Event handlers
    this.eventHandlers = {
      contentChange: [],
      validation: [],
      focus: [],
      blur: []
    };
    
    this.initializeHighlighter();
  }

  /**
   * Initialize syntax highlighter for current format
   * @private
   */
  initializeHighlighter() {
    if (this.config.format && this.config.format !== 'text') {
      this.highlighter = new SyntaxHighlighter(this.config.format, {
        theme: this.config.theme,
        showLineNumbers: this.config.showLineNumbers,
        cssPrefix: 'syntax'
      });
    }
  }

  /**
   * Render the source view
   */
  render() {
    if (this.isDestroyed) {
      return;
    }

    // Clear existing content
    this.dom.innerHTML = '';
    
    // Create main editor container
    this.editorElement = document.createElement('div');
    this.editorElement.className = `source-editor format-${this.config.format} theme-${this.config.theme}`;
    
    if (this.config.wordWrap) {
      this.editorElement.classList.add('word-wrap');
    }
    
    if (this.config.showLineNumbers) {
      this.editorElement.classList.add('line-numbers');
    }
    
    // Set font size
    this.editorElement.style.fontSize = `${this.config.fontSize}px`;
    
    // Create content container
    this.contentElement = document.createElement('div');
    this.contentElement.className = 'source-content';
    
    if (this.config.readOnly) {
      this.contentElement.className += ' readonly';
    } else {
      this.contentElement.contentEditable = true;
      this.contentElement.spellcheck = false;
      
      // Add event listeners for editing
      this.contentElement.addEventListener('input', this.handleContentChange.bind(this));
      this.contentElement.addEventListener('blur', this.handleBlur.bind(this));
      this.contentElement.addEventListener('focus', this.handleFocus.bind(this));
    }
    
    // Render content with highlighting
    this.updateContent();
    
    this.editorElement.appendChild(this.contentElement);
    this.dom.appendChild(this.editorElement);
    
    // Apply additional styling
    this.applyTheme();
  }

  /**
   * Update content with syntax highlighting
   * @private
   */
  updateContent() {
    if (!this.contentElement || this.isDestroyed) {
      return;
    }

    const content = this.config.content || '';
    
    if (this.highlighter && this.highlighter.isSupported(this.config.format)) {
      // Create syntax highlighting container
      const highlightContainer = document.createElement('div');
      highlightContainer.className = 'syntax-highlight';
      
      try {
        const highlighted = this.highlighter.highlight(content);
        highlightContainer.innerHTML = highlighted;
        
        this.contentElement.innerHTML = '';
        this.contentElement.appendChild(highlightContainer);
      } catch (error) {
        console.warn('Syntax highlighting failed:', error);
        // Fall back to plain text
        this.contentElement.textContent = content;
      }
    } else {
      // Plain text content
      this.contentElement.textContent = content;
    }
  }

  /**
   * Apply theme styling
   * @private
   */
  applyTheme() {
    if (!this.editorElement || this.isDestroyed) {
      return;
    }

    // Theme-specific styling
    const themes = {
      light: {
        backgroundColor: '#ffffff',
        color: '#333333',
        borderColor: '#e0e0e0'
      },
      dark: {
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        borderColor: '#404040'
      }
    };
    
    const currentTheme = themes[this.config.theme] || themes.light;
    
    Object.assign(this.editorElement.style, {
      backgroundColor: currentTheme.backgroundColor,
      color: currentTheme.color,
      border: `1px solid ${currentTheme.borderColor}`,
      borderRadius: '4px',
      padding: '12px',
      fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: '1.5',
      overflow: 'auto',
      minHeight: '200px'
    });
  }

  /**
   * Handle content change events
   * @private
   */
  handleContentChange(event) {
    if (this.isDestroyed) {
      return;
    }

    const oldContent = this.config.content;
    const newContent = this.contentElement.textContent || '';
    
    this.config.content = newContent;
    
    // Emit content change event
    this.emit('contentChange', {
      oldContent: oldContent,
      newContent: newContent,
      format: this.config.format
    });
    
    // Validate content
    const validation = this.validateContent();
    this.emit('validation', validation);
    
    // Update highlighting (debounced)
    this.debounceHighlightUpdate();
  }

  /**
   * Handle focus events
   * @private
   */
  handleFocus(event) {
    if (this.isDestroyed) {
      return;
    }
    this.emit('focus', { sourceView: this });
  }

  /**
   * Handle blur events
   * @private
   */
  handleBlur(event) {
    if (this.isDestroyed) {
      return;
    }
    this.emit('blur', { sourceView: this });
  }

  /**
   * Debounced highlight update
   * @private
   */
  debounceHighlightUpdate() {
    if (this.highlightUpdateTimer) {
      clearTimeout(this.highlightUpdateTimer);
    }
    
    this.highlightUpdateTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.updateContent();
      }
    }, 300);
  }

  /**
   * Get current content
   */
  getContent() {
    return this.config.content || '';
  }

  /**
   * Set new content
   */
  setContent(content) {
    if (this.isDestroyed) {
      return;
    }

    const oldContent = this.config.content;
    this.config.content = content || '';
    
    this.updateContent();
    
    // Emit change event
    this.emit('contentChange', {
      oldContent: oldContent,
      newContent: this.config.content,
      format: this.config.format
    });
    
    // Validate content and emit validation event
    const validation = this.validateContent();
    this.emit('validation', validation);
  }

  /**
   * Format content (pretty-print)
   */
  formatContent() {
    if (this.isDestroyed) {
      return;
    }

    try {
      let formatted = this.config.content;
      
      switch (this.config.format) {
        case 'json':
          const jsonData = JSON.parse(this.config.content);
          formatted = JSON.stringify(jsonData, null, 2);
          break;
        case 'xml':
          // Basic XML formatting (would need proper XML formatter)
          formatted = this.formatXml(this.config.content);
          break;
        default:
          // No formatting for other formats
          break;
      }
      
      this.setContent(formatted);
    } catch (error) {
      console.warn('Content formatting failed:', error);
    }
  }

  /**
   * Basic XML formatting
   * @private
   */
  formatXml(xml) {
    let formatted = '';
    let indent = 0;
    const tab = '  ';
    
    xml.split(/>\s*</).forEach((node, index) => {
      if (index > 0) {
        node = '<' + node;
      }
      if (index < xml.split(/>\s*</).length - 1) {
        node = node + '>';
      }
      
      if (node.match(/^<\/\w/)) {
        indent--;
      }
      
      formatted += tab.repeat(indent) + node + '\n';
      
      if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent++;
      }
    });
    
    return formatted.trim();
  }

  /**
   * Validate current content
   */
  validateContent() {
    if (this.isDestroyed) {
      return { valid: true, errors: [] };
    }

    try {
      switch (this.config.format) {
        case 'json':
          JSON.parse(this.config.content);
          return { valid: true, errors: [] };
          
        case 'xml':
          const parser = new DOMParser();
          const doc = parser.parseFromString(this.config.content, 'application/xml');
          const errors = doc.getElementsByTagName('parsererror');
          if (errors.length > 0) {
            return {
              valid: false,
              errors: [errors[0].textContent]
            };
          }
          return { valid: true, errors: [] };
          
        default:
          // Other formats are always valid for now
          return { valid: true, errors: [] };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Check if view is read-only
   */
  isReadOnly() {
    return this.config.readOnly === true;
  }

  /**
   * Focus the editor
   */
  focus() {
    if (this.contentElement && !this.isDestroyed) {
      this.contentElement.focus();
      // Manually trigger focus event for programmatic calls
      this.emit('focus', { sourceView: this });
    }
  }

  /**
   * Blur the editor
   */
  blur() {
    if (this.contentElement && !this.isDestroyed) {
      this.contentElement.blur();
      // Manually trigger blur event for programmatic calls
      this.emit('blur', { sourceView: this });
    }
  }

  /**
   * Add event listener
   */
  on(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].push(handler);
    }
  }

  /**
   * Remove event listener
   */
  off(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      const index = this.eventHandlers[eventName].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[eventName].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @private
   */
  emit(eventName, data) {
    if (this.eventHandlers[eventName] && !this.isDestroyed) {
      this.eventHandlers[eventName].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }

  /**
   * Destroy the source view
   */
  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    
    // Clear timers
    if (this.highlightUpdateTimer) {
      clearTimeout(this.highlightUpdateTimer);
      this.highlightUpdateTimer = null;
    }
    
    // Remove event listeners
    if (this.contentElement) {
      this.contentElement.removeEventListener('input', this.handleContentChange);
      this.contentElement.removeEventListener('blur', this.handleBlur);
      this.contentElement.removeEventListener('focus', this.handleFocus);
    }
    
    // Clear event handlers
    Object.keys(this.eventHandlers).forEach(eventName => {
      this.eventHandlers[eventName] = [];
    });
    
    // Clear DOM
    if (this.dom) {
      this.dom.innerHTML = '';
    }
    
    // Clear references
    this.highlighter = null;
    this.editorElement = null;
    this.contentElement = null;
  }
}