/**
 * MarkdownModel - Data layer for markdown content and configuration
 * Manages markdown content, theme state, and rendering options
 */

import { BaseModel } from '../../base/BaseModel.js';

export class MarkdownModel extends BaseModel {
  constructor(options = {}) {
    super();
    
    this.content = options.content || '';
    this.theme = options.theme || 'light';
    this.showLineNumbers = options.showLineNumbers || false;
    this.lastRenderTime = null;
    this.parsedContent = null;
    
    // Markdown parsing cache
    this.parseCache = new Map();
    this.maxCacheSize = 50;
  }

  /**
   * Set markdown content
   * @param {string} content - Markdown content
   */
  setContent(content) {
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }
    
    const oldContent = this.content;
    this.content = content;
    this.parsedContent = null; // Clear cache
    
    this.emit('contentChanged', {
      oldContent,
      newContent: content,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set theme
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) {
      throw new Error('Theme must be "light" or "dark"');
    }
    
    const oldTheme = this.theme;
    this.theme = theme;
    
    this.emit('themeChanged', {
      oldTheme,
      newTheme: theme
    });
  }

  /**
   * Set line numbers visibility
   * @param {boolean} show - Show line numbers
   */
  setShowLineNumbers(show) {
    const oldValue = this.showLineNumbers;
    this.showLineNumbers = !!show;
    
    this.emit('lineNumbersChanged', {
      oldValue,
      newValue: this.showLineNumbers
    });
  }

  /**
   * Get cached parsed content or null if needs parsing
   * @returns {Object|null} Parsed content or null
   */
  getCachedParsedContent() {
    const cacheKey = this._getCacheKey();
    return this.parseCache.get(cacheKey) || null;
  }

  /**
   * Cache parsed content
   * @param {Object} parsedContent - Parsed markdown content
   */
  setCachedParsedContent(parsedContent) {
    const cacheKey = this._getCacheKey();
    
    // Implement LRU cache behavior
    if (this.parseCache.size >= this.maxCacheSize) {
      const firstKey = this.parseCache.keys().next().value;
      this.parseCache.delete(firstKey);
    }
    
    this.parseCache.set(cacheKey, parsedContent);
    this.lastRenderTime = Date.now();
  }

  /**
   * Get statistics about the model
   * @returns {Object} Model statistics
   */
  getStats() {
    return {
      contentLength: this.content.length,
      theme: this.theme,
      showLineNumbers: this.showLineNumbers,
      cacheSize: this.parseCache.size,
      lastRenderTime: this.lastRenderTime,
      hasContent: this.content.length > 0
    };
  }

  /**
   * Generate cache key for current state
   * @private
   */
  _getCacheKey() {
    return `${this.theme}-${this.showLineNumbers}-${this.content.length}-${this._hashContent()}`;
  }

  /**
   * Simple hash of content for cache key
   * @private
   */
  _hashContent() {
    let hash = 0;
    for (let i = 0; i < this.content.length; i++) {
      const char = this.content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.parseCache.clear();
    this.parsedContent = null;
    this.emit('cacheCleared');
  }

  /**
   * Destroy model and clean up
   */
  destroy() {
    this.clearCache();
    super.destroy();
  }
}