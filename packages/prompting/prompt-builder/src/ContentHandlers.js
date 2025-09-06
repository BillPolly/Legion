/**
 * ContentHandlers - Registry and base class for content processing
 * 
 * Provides intelligent content processing for different data types
 */

export class ContentHandler {
  /**
   * Check if this handler can process the given content
   * @param {*} content - Content to check
   * @param {Object} metadata - Content metadata (type hints, etc.)
   * @returns {boolean} True if handler can process content
   */
  canHandle(content, metadata = {}) {
    throw new Error('canHandle() must be implemented by subclasses');
  }

  /**
   * Process content for prompt inclusion
   * @param {*} content - Content to process
   * @param {Object} constraints - Size and formatting constraints
   * @returns {string} Processed content ready for prompt
   */
  process(content, constraints = {}) {
    throw new Error('process() must be implemented by subclasses');
  }

  /**
   * Estimate token count for content
   * @param {*} content - Content to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(content) {
    if (typeof content === 'string') {
      return Math.ceil(content.length / 4); // Basic estimation
    }
    return Math.ceil(JSON.stringify(content).length / 4);
  }

  /**
   * Summarize content to fit constraints
   * @param {*} content - Content to summarize
   * @param {number} maxLength - Maximum length target
   * @returns {string} Summarized content
   */
  summarize(content, maxLength) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    if (text.length <= maxLength) {
      return text;
    }
    
    // Basic truncation with ellipsis
    return text.substring(0, maxLength - 3) + '...';
  }
}

export class ContentHandlerRegistry {
  constructor() {
    this.handlers = new Map();
    this.defaultHandlers = new Map();
    
    // Register built-in handlers (will be implemented in subsequent steps)
    this._registerDefaultHandlers();
  }

  /**
   * Register a content handler
   * @param {string} name - Handler name
   * @param {ContentHandler} handler - Handler instance
   */
  register(name, handler) {
    if (!(handler instanceof ContentHandler)) {
      throw new Error('Handler must extend ContentHandler base class');
    }
    
    this.handlers.set(name, handler);
  }

  /**
   * Get handler for content type
   * @param {string} type - Content type or handler name
   * @returns {ContentHandler|null} Handler instance or null
   */
  get(type) {
    return this.handlers.get(type) || this.defaultHandlers.get(type) || null;
  }

  /**
   * Find appropriate handler for content
   * @param {*} content - Content to process
   * @param {Object} metadata - Content metadata
   * @returns {ContentHandler|null} Best matching handler
   */
  findHandler(content, metadata = {}) {
    // Check explicit type hint first
    if (metadata.type) {
      const handler = this.get(metadata.type);
      if (handler && handler.canHandle(content, metadata)) {
        return handler;
      }
    }

    // Find handler by content analysis
    for (const [name, handler] of this.handlers) {
      if (handler.canHandle(content, metadata)) {
        return handler;
      }
    }

    // Fallback to default handlers
    for (const [name, handler] of this.defaultHandlers) {
      if (handler.canHandle(content, metadata)) {
        return handler;
      }
    }

    return null;
  }

  /**
   * Get all registered handler names
   * @returns {string[]} Array of handler names
   */
  getHandlerNames() {
    return [...this.handlers.keys(), ...this.defaultHandlers.keys()];
  }

  /**
   * Register default built-in handlers
   * @private
   */
  _registerDefaultHandlers() {
    // Default handlers will be added as they're implemented
    this.defaultHandlers.set('text', new TextHandler());
    this.defaultHandlers.set('array', new ArrayHandler());
    this.defaultHandlers.set('object', new ObjectHandler());
  }
}

// Basic built-in handlers for MVP

export class TextHandler extends ContentHandler {
  canHandle(content, metadata = {}) {
    return typeof content === 'string' || metadata.type === 'text';
  }

  process(content, constraints = {}) {
    const text = String(content);
    
    if (constraints.maxLength && text.length > constraints.maxLength) {
      if (constraints.summarize) {
        return this.summarize(text, constraints.maxLength);
      } else {
        return text.substring(0, constraints.maxLength - 3) + '...';
      }
    }
    
    return text;
  }
}

export class ArrayHandler extends ContentHandler {
  canHandle(content, metadata = {}) {
    return Array.isArray(content) || metadata.type === 'array';
  }

  process(content, constraints = {}) {
    if (!Array.isArray(content)) {
      return String(content);
    }

    let items = [...content];
    
    // Apply maxItems constraint
    if (constraints.maxItems && items.length > constraints.maxItems) {
      items = items.slice(0, constraints.maxItems);
    }

    // Format as list
    const listFormat = constraints.format || 'numbered';
    
    if (listFormat === 'numbered') {
      return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
    } else if (listFormat === 'bullet') {
      return items.map(item => `- ${item}`).join('\n');
    } else {
      return items.join(', ');
    }
  }
}

export class ObjectHandler extends ContentHandler {
  canHandle(content, metadata = {}) {
    return typeof content === 'object' && content !== null && !Array.isArray(content);
  }

  process(content, constraints = {}) {
    const pairs = Object.entries(content);
    
    if (constraints.maxProperties && pairs.length > constraints.maxProperties) {
      pairs.splice(constraints.maxProperties);
    }

    return pairs.map(([key, value]) => `${key}: ${value}`).join('\n');
  }
}