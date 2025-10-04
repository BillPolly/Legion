/**
 * MarkdownViewModel - Coordination layer between Model and View
 * Manages the interaction between data state and DOM rendering
 */

import { BaseViewModel } from '@legion/components';

export class MarkdownViewModel extends BaseViewModel {
  constructor(options = {}) {
    super();
    
    this.model = options.model;
    this.view = options.view;
    this.onContentChange = options.onContentChange;
    
    if (!this.model || !this.view) {
      throw new Error('MarkdownViewModel requires both model and view');
    }
    
    // Set up event bindings
    this._bindEvents();
    
    // Initial render if content exists
    if (this.model.content) {
      this._renderContent();
    }
  }

  /**
   * Bind model and view events
   * @private
   */
  _bindEvents() {
    // Model events
    this.model.on('contentChanged', (event) => {
      this._renderContent();
      if (this.onContentChange) {
        this.onContentChange(event.newContent, event);
      }
    });

    this.model.on('themeChanged', (event) => {
      this.view.setTheme(event.newTheme);
      this._renderContent(); // Re-render with new theme
    });

    this.model.on('lineNumbersChanged', () => {
      this._renderContent(); // Re-render with line numbers
    });

    // View events
    this.view.on('renderError', (error) => {
      console.error('MarkdownView render error:', error);
      this.emit('error', {
        type: 'render',
        message: error.message,
        error
      });
    });

    this.view.on('rendered', (event) => {
      this.emit('rendered', event);
    });
  }

  /**
   * Render current model content through view
   * @private
   */
  _renderContent() {
    if (!this.model.content) {
      this.view.clear();
      return;
    }

    // Check cache first
    let parsedContent = this.model.getCachedParsedContent();
    
    if (!parsedContent) {
      // Parse and cache content
      try {
        parsedContent = this._parseContent(this.model.content);
        this.model.setCachedParsedContent(parsedContent);
      } catch (error) {
        console.error('Content parsing failed:', error);
        this.emit('error', {
          type: 'parse',
          message: error.message,
          error
        });
        return;
      }
    }

    // Render through view
    this.view.render(this.model.content);
  }

  /**
   * Parse markdown content (can be extended for preprocessing)
   * @private
   */
  _parseContent(content) {
    // Basic validation and preprocessing
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    // Could add preprocessing here:
    // - Custom syntax extensions
    // - Tool result formatting
    // - Link processing
    // - etc.

    return {
      original: content,
      processed: content,
      timestamp: Date.now()
    };
  }

  /**
   * Update content through viewmodel
   * @param {string} content - New markdown content
   */
  setContent(content) {
    this.model.setContent(content);
  }

  /**
   * Update theme through viewmodel
   * @param {string} theme - New theme
   */
  setTheme(theme) {
    this.model.setTheme(theme);
  }

  /**
   * Get current rendering statistics
   * @returns {Object} Rendering statistics
   */
  getStats() {
    return {
      model: this.model.getStats(),
      view: {
        hasDOM: !!this.view.container,
        theme: this.view.theme,
        rendered: !!this.view.contentElement.innerHTML
      },
      coordination: {
        eventsActive: this._eventListeners.size > 0,
        lastRender: this.model.lastRenderTime
      }
    };
  }

  /**
   * Clear all content
   */
  clear() {
    this.model.setContent('');
  }

  /**
   * Append content to existing
   * @param {string} content - Content to append
   */
  append(content) {
    this.model.setContent(this.model.content + '\n\n' + content);
  }

  /**
   * Destroy viewmodel and clean up
   */
  destroy() {
    // Unbind events
    if (this.model) {
      this.model.off('contentChanged');
      this.model.off('themeChanged');
      this.model.off('lineNumbersChanged');
    }

    if (this.view) {
      this.view.off('renderError');
      this.view.off('rendered');
    }

    // Clear references
    this.model = null;
    this.view = null;
    this.onContentChange = null;
    
    super.destroy();
  }
}