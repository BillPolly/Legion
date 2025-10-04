/**
 * MarkdownView - DOM manipulation layer for markdown rendering
 * Handles actual HTML generation, syntax highlighting, and user interactions
 */

import { BaseView } from '@legion/components';

export class MarkdownView extends BaseView {
  constructor(options = {}) {
    super();
    
    this.dom = options.dom;
    this.theme = options.theme || 'light';
    this.onCopy = options.onCopy;
    
    // DOM elements
    this.container = null;
    this.contentElement = null;
    
    // Markdown-it instance (loaded from /lib/)
    this.markdownIt = null;
    this.hljs = null;
    
    // Initialize DOM structure
    this._createDOMStructure();
    
    // Load libraries
    this._loadLibraries();
  }

  /**
   * Create basic DOM structure
   * @private
   */
  _createDOMStructure() {
    this.container = document.createElement('div');
    this.container.className = `markdown-renderer theme-${this.theme}`;
    
    this.contentElement = document.createElement('div');
    this.contentElement.className = 'markdown-content';
    
    this.container.appendChild(this.contentElement);
    this.dom.appendChild(this.container);
  }

  /**
   * Load markdown-it and highlight.js libraries
   * @private
   */
  async _loadLibraries() {
    try {
      // Load markdown-it from /lib/ endpoint
      if (typeof window !== 'undefined' && !window.markdownit) {
        const script = document.createElement('script');
        script.src = '/lib/markdown-it/markdown-it.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }
      
      // Load highlight.js from /lib/ endpoint
      if (typeof window !== 'undefined' && !window.hljs) {
        const script = document.createElement('script');
        script.src = '/lib/highlight.js/highlight.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }
      
      // Initialize markdown-it with highlight.js
      this.markdownIt = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight: this._highlightCode.bind(this)
      });
      
      this.hljs = window.hljs;
      
      this.emit('librariesLoaded');
      
    } catch (error) {
      console.error('Failed to load markdown libraries:', error);
      this.emit('librariesError', error);
    }
  }

  /**
   * Render markdown content to DOM
   * @param {string} content - Markdown content
   */
  render(content) {
    if (!this.markdownIt) {
      // Queue render for when libraries are loaded
      this.once('librariesLoaded', () => this.render(content));
      return;
    }

    try {
      // Parse markdown to HTML
      const html = this.markdownIt.render(content);
      
      // Set HTML content
      this.contentElement.innerHTML = html;
      
      // Add copy buttons to code blocks
      this._addCopyButtons();
      
      // Apply theme-specific styling
      this._applyTheme();
      
      this.emit('rendered', { content, html });
      
    } catch (error) {
      console.error('Markdown rendering failed:', error);
      this.contentElement.innerHTML = `<div class="error">Failed to render markdown: ${error.message}</div>`;
      this.emit('renderError', error);
    }
  }

  /**
   * Update theme
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    this.theme = theme;
    this.container.className = `markdown-renderer theme-${theme}`;
    this._applyTheme();
    this.emit('themeChanged', theme);
  }

  /**
   * Syntax highlighting function for markdown-it
   * @private
   */
  _highlightCode(str, lang) {
    if (!this.hljs) {
      return `<pre><code>${this._escapeHtml(str)}</code></pre>`;
    }

    // Auto-detect language if not specified
    if (!lang) {
      const result = this.hljs.highlightAuto(str);
      return `<pre class="hljs language-${result.language}"><code>${result.value}</code></pre>`;
    }

    // Use specified language
    if (this.hljs.getLanguage(lang)) {
      try {
        const result = this.hljs.highlight(str, { language: lang });
        return `<pre class="hljs language-${lang}"><code>${result.value}</code></pre>`;
      } catch (error) {
        console.warn('Syntax highlighting failed for language:', lang, error);
      }
    }

    // Fallback to plain text
    return `<pre class="hljs"><code>${this._escapeHtml(str)}</code></pre>`;
  }

  /**
   * Add copy buttons to code blocks
   * @private
   */
  _addCopyButtons() {
    const codeBlocks = this.contentElement.querySelectorAll('pre');
    
    codeBlocks.forEach((pre) => {
      // Skip if already has copy button
      if (pre.querySelector('.copy-button')) {
        return;
      }

      const code = pre.querySelector('code');
      if (!code) return;

      // Create copy button
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.innerHTML = `
        <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span class="copy-text">Copy</span>
      `;

      // Add click handler
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          copyButton.innerHTML = `
            <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="copy-text">Copied!</span>
          `;
          
          setTimeout(() => {
            copyButton.innerHTML = `
              <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span class="copy-text">Copy</span>
            `;
          }, 2000);
          
          if (this.onCopy) {
            this.onCopy(code.textContent);
          }
          
        } catch (error) {
          console.error('Failed to copy code:', error);
        }
      });

      // Position button
      pre.style.position = 'relative';
      copyButton.style.position = 'absolute';
      copyButton.style.top = '8px';
      copyButton.style.right = '8px';
      
      pre.appendChild(copyButton);
    });
  }

  /**
   * Apply theme-specific styling
   * @private
   */
  _applyTheme() {
    // Basic theme CSS will be handled by external stylesheet
    // This method can be extended for dynamic theme changes
    const isLight = this.theme === 'light';
    
    this.contentElement.style.color = isLight ? '#1f2937' : '#f9fafb';
    this.contentElement.style.backgroundColor = isLight ? '#ffffff' : '#1f2937';
  }

  /**
   * Escape HTML characters
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Clear rendered content
   */
  clear() {
    if (this.contentElement) {
      this.contentElement.innerHTML = '';
    }
    this.emit('cleared');
  }

  /**
   * Get rendered HTML
   * @returns {string} Current HTML content
   */
  getHTML() {
    return this.contentElement ? this.contentElement.innerHTML : '';
  }

  /**
   * Destroy view and clean up
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = null;
    this.contentElement = null;
    this.markdownIt = null;
    this.hljs = null;
    
    super.destroy();
  }
}