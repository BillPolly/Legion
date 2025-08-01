/**
 * BaseRenderer - Abstract base class for content renderers
 */
export class BaseRenderer {
  constructor() {
    if (this.constructor === BaseRenderer) {
      throw new Error('BaseRenderer is an abstract class');
    }
  }

  /**
   * Render content into a container
   * @abstract
   */
  render(content, container) {
    throw new Error('render() method must be implemented by subclass');
  }

  /**
   * Check if this renderer can handle the given content type
   * @abstract
   */
  canRender(contentType) {
    throw new Error('canRender() method must be implemented by subclass');
  }

  /**
   * Get renderer name
   */
  getName() {
    return this.constructor.name;
  }

  /**
   * Get renderer version
   */
  getVersion() {
    return '1.0.0';
  }

  /**
   * Get supported content types
   */
  getSupportedTypes() {
    return [];
  }

  /**
   * Get renderer description
   */
  getDescription() {
    return `${this.getName()} content renderer`;
  }
}

/**
 * PlaintextRenderer - Renders plain text content with proper escaping and formatting
 */
export class PlaintextRenderer extends BaseRenderer {
  constructor() {
    super();
    this.supportedTypes = ['plaintext', 'text', 'plain'];
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
   * Render plaintext content into container
   */
  render(content, container) {
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
      contentDiv.className = 'plaintext-content renderer-content';
      contentDiv.style.whiteSpace = 'pre-wrap'; // Preserve whitespace
      
      // Handle content
      const processedContent = this._processContent(content);
      contentDiv.innerHTML = processedContent;
      
      container.appendChild(contentDiv);
      
      return container;
    } catch (error) {
      throw new Error(`Failed to render plaintext content: ${error.message}`);
    }
  }

  /**
   * Process content for safe HTML rendering
   * @private
   */
  _processContent(content) {
    // Handle null, undefined, or empty content
    if (content === null || content === undefined || content === '') {
      return '<em>No content</em>';
    }
    
    // Convert to string if needed
    const textContent = String(content);
    
    // Escape HTML characters
    const escapedContent = this._escapeHtml(textContent);
    
    // Convert newlines to <br> tags
    return escapedContent.replace(/\n/g, '<br>');
  }

  /**
   * Escape HTML characters in text
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
   * Get supported content types
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * Get renderer description
   */
  getDescription() {
    return 'Renders plaintext content with HTML escaping and line break preservation';
  }
}