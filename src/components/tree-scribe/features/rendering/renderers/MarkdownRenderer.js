/**
 * MarkdownRenderer - Renders markdown content with syntax highlighting and interactive features
 */

import MarkdownIt from '/lib/markdown-it';
import hljs from '/lib/highlight.js';
import { BaseRenderer } from './PlaintextRenderer.js';

export class MarkdownRenderer extends BaseRenderer {
  constructor(options = {}) {
    super();
    
    this.options = {
      html: true,
      linkify: true,
      typographer: true,
      showLineNumbers: false,
      theme: 'light',
      ...options
    };
    
    this.supportedTypes = ['markdown', 'md', 'text/markdown'];
    
    // Initialize markdown-it with options
    this.md = new MarkdownIt({
      html: this.options.html,
      linkify: this.options.linkify,
      typographer: this.options.typographer,
      highlight: this._highlightCode.bind(this)
    });
    
    // Enable additional plugins
    this._configurePlugins();
  }

  /**
   * Configure markdown-it plugins
   * @private
   */
  _configurePlugins() {
    // Enable tables, strikethrough, etc.
    this.md.enable(['table', 'strikethrough']);
    
    // Custom link renderer for internal/external link handling
    const defaultLinkRenderer = this.md.renderer.rules.link_open || 
      ((tokens, idx, options, env, renderer) => renderer.renderToken(tokens, idx, options));
    
    this.md.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
      const token = tokens[idx];
      const href = token.attrGet('href');
      
      if (href) {
        if (href.startsWith('#')) {
          // Internal link
          token.attrSet('class', 'internal-link');
        } else if (href.startsWith('http') || href.startsWith('//')) {
          // External link
          token.attrSet('class', 'external-link');
          token.attrSet('target', '_blank');
          token.attrSet('rel', 'noopener noreferrer');
        }
      }
      
      return defaultLinkRenderer(tokens, idx, options, env, renderer);
    };
    
    // Custom code fence renderer for copy buttons and line numbers
    this.md.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
      const token = tokens[idx];
      const info = token.info ? token.info.trim() : '';
      const langName = info ? info.split(/\s+/g)[0] : '';
      const code = token.content;
      
      let result = '<div class="code-container">';
      
      if (this.options.showLineNumbers) {
        result += '<div class="line-numbers">';
        const lines = code.split('\n').filter(line => line.trim() !== ''); // Remove empty lines
        for (let i = 1; i <= lines.length; i++) {
          result += `<span class="line-number">${i}</span>`;
        }
        result += '</div>';
      }
      
      result += '<div class="code-wrapper">';
      
      // Generate highlighted code
      let highlightedCode;
      if (langName && this.options.highlight) {
        highlightedCode = this.options.highlight(code, langName) || this._escapeHtml(code);
      } else {
        highlightedCode = this._highlightCode(code, langName);
      }
      
      result += `<pre><code class="language-${langName}">${highlightedCode}</code></pre>`;
      result += `<button class="copy-button" data-clipboard-text="${this._escapeAttribute(code)}">Copy</button>`;
      result += '</div>';
      result += '</div>';
      
      return result;
    };
  }

  /**
   * Highlight code using highlight.js
   * @private
   */
  _highlightCode(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang });
        return highlighted.value;
      } catch (err) {
        console.warn('Syntax highlighting failed:', err);
      }
    }
    
    // Auto-detect language if not specified
    try {
      const highlighted = hljs.highlightAuto(str);
      return highlighted.value;
    } catch (err) {
      console.warn('Auto syntax highlighting failed:', err);
      return this._escapeHtml(str);
    }
  }

  /**
   * Check if this renderer can handle the given content type
   */
  canRender(contentType) {
    if (!contentType || typeof contentType !== 'string') {
      return false;
    }
    
    return this.supportedTypes.includes(contentType.toLowerCase());
  }

  /**
   * Render markdown content into container
   */
  render(content, container) {
    console.log('[MarkdownRenderer] render() called with:', {
      contentLength: content ? content.length : 0,
      contentPreview: content ? content.substring(0, 100) + '...' : 'no content',
      containerTagName: container ? container.tagName : 'no container'
    });
    
    // Validate container
    if (!container) {
      throw new Error('Container is required for rendering');
    }
    
    if (!container.nodeType || container.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('Container must be a DOM element');
    }

    try {
      // Clear existing content
      container.innerHTML = '';

      // Create content wrapper
      const contentDiv = document.createElement('div');
      contentDiv.className = 'markdown-content renderer-content';
      
      // Apply theme
      if (this.options.theme) {
        contentDiv.classList.add(`theme-${this.options.theme}`);
      }
      
      // Handle content
      const processedContent = this._processContent(content);
      console.log('[MarkdownRenderer] Processed content:', {
        length: processedContent.length,
        preview: processedContent.substring(0, 200) + '...',
        hasHTMLTags: processedContent.includes('<')
      });
      contentDiv.innerHTML = processedContent;
      
      // Add interactive features
      this._addInteractiveFeatures(contentDiv);
      
      container.appendChild(contentDiv);
      
      console.log('[MarkdownRenderer] DOM update complete:', {
        containerChildren: container.children.length,
        containerHTML: container.innerHTML.substring(0, 200) + '...',
        containerInDOM: document.body.contains(container)
      });
      return container;
    } catch (error) {
      console.error('[MarkdownRenderer] Render failed:', error);
      throw new Error(`Failed to render markdown content: ${error.message}`);
    }
  }

  /**
   * Process content for markdown rendering
   * @private
   */
  _processContent(content) {
    // Handle null, undefined, or empty content
    if (content === null || content === undefined || content === '') {
      return '<p><em>No content</em></p>';
    }
    
    // Convert to string if needed
    const markdownContent = String(content);
    console.log('[MarkdownRenderer] Processing markdown:', {
      contentLength: markdownContent.length,
      contentPreview: markdownContent.substring(0, 100) + '...'
    });
    
    // Render markdown to HTML
    const html = this.md.render(markdownContent);
    console.log('[MarkdownRenderer] markdown-it output:', {
      htmlLength: html.length,
      htmlPreview: html.substring(0, 200) + '...'
    });
    
    // Sanitize HTML for security
    return this._sanitizeHtml(html);
  }

  /**
   * Sanitize HTML content for security
   * @private
   */
  _sanitizeHtml(html) {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove dangerous elements (but keep our copy buttons)
    const dangerousElements = temp.querySelectorAll('script, iframe, object, embed, form, input, textarea, select');
    dangerousElements.forEach(el => el.remove());
    
    // Remove dangerous button elements but keep copy buttons
    const buttons = temp.querySelectorAll('button');
    buttons.forEach(button => {
      if (!button.classList.contains('copy-button')) {
        button.remove();
      }
    });
    
    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (this._isDangerousAttribute(attr.name, attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return temp.innerHTML;
  }

  /**
   * Check if an attribute is dangerous
   * @private
   */
  _isDangerousAttribute(name, value) {
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
    const dangerousValues = ['javascript:', 'data:', 'vbscript:'];
    
    // Check for event handlers
    if (dangerousAttrs.includes(name.toLowerCase())) {
      return true;
    }
    
    // Check for dangerous protocols
    if (name.toLowerCase() === 'href' || name.toLowerCase() === 'src') {
      const lowerValue = value.toLowerCase().trim();
      return dangerousValues.some(dangerous => lowerValue.startsWith(dangerous));
    }
    
    // Check for dangerous CSS
    if (name.toLowerCase() === 'style') {
      const lowerValue = value.toLowerCase();
      return lowerValue.includes('javascript:') || 
             lowerValue.includes('expression(') || 
             lowerValue.includes('url(') ||
             lowerValue.includes('import');
    }
    
    return false;
  }

  /**
   * Add interactive features to rendered content
   * @private
   */
  _addInteractiveFeatures(contentDiv) {
    // Add copy functionality to code blocks
    const copyButtons = contentDiv.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const code = button.getAttribute('data-clipboard-text');
        this._copyToClipboard(code);
        this._showCopyFeedback(button);
      });
    });
    
    // Add line numbers styling if enabled
    if (this.options.showLineNumbers) {
      const codeContainers = contentDiv.querySelectorAll('.code-container');
      codeContainers.forEach(container => {
        container.classList.add('line-numbers');
      });
    }
  }

  /**
   * Copy text to clipboard
   * @private
   */
  _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(err => {
        console.warn('Failed to copy to clipboard:', err);
        this._fallbackCopyToClipboard(text);
      });
    } else {
      this._fallbackCopyToClipboard(text);
    }
  }

  /**
   * Fallback copy method for older browsers
   * @private
   */
  _fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Fallback copy failed:', err);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show visual feedback for copy operation
   * @private
   */
  _showCopyFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = '#4CAF50';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
    }, 2000);
  }

  /**
   * Escape HTML characters
   * @private
   */
  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Escape attribute values
   * @private
   */
  _escapeAttribute(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Get supported content types
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * Get renderer description
   */
  getDescription() {
    return 'Renders markdown content with syntax highlighting, interactive features, and security sanitization';
  }
}