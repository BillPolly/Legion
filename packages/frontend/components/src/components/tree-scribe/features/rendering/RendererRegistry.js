/**
 * RendererRegistry - Singleton registry for managing content renderers
 * Provides renderer registration, selection, and content type detection
 */

export class RendererRegistry {
  static instance = null;

  constructor() {
    if (RendererRegistry.instance) {
      return RendererRegistry.instance;
    }

    this.renderers = new Map(); // name -> renderer instance
    this.contentTypeMap = new Map(); // contentType -> renderer name
    this.fallbackRenderer = null;
    this.cache = new Map(); // contentType -> renderer instance (for performance)
    
    RendererRegistry.instance = this;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!RendererRegistry.instance) {
      RendererRegistry.instance = new RendererRegistry();
    }
    return RendererRegistry.instance;
  }

  /**
   * Register a renderer
   */
  register(renderer) {
    try {
      // Validate renderer interface
      if (!this._validateRenderer(renderer)) {
        console.warn('Renderer validation failed:', renderer);
        return false;
      }

      const name = renderer.getName();
      
      // Check for duplicate registration
      if (this.renderers.has(name)) {
        console.warn(`Renderer ${name} is already registered`);
        return false;
      }

      // Register renderer
      this.renderers.set(name, renderer);

      // Register content types
      const supportedTypes = renderer.getSupportedTypes();
      supportedTypes.forEach(contentType => {
        const normalizedType = contentType.toLowerCase();
        if (!this.contentTypeMap.has(normalizedType)) {
          this.contentTypeMap.set(normalizedType, name);
        }
      });

      // Clear cache to force re-evaluation
      this.cache.clear();

      return true;
    } catch (error) {
      console.error('Error registering renderer:', error);
      return false;
    }
  }

  /**
   * Unregister a renderer by name
   */
  unregister(rendererName) {
    if (!this.renderers.has(rendererName)) {
      return false;
    }

    const renderer = this.renderers.get(rendererName);
    
    try {
      // Remove content type mappings
      const supportedTypes = renderer.getSupportedTypes();
      supportedTypes.forEach(contentType => {
        const normalizedType = contentType.toLowerCase();
        if (this.contentTypeMap.get(normalizedType) === rendererName) {
          this.contentTypeMap.delete(normalizedType);
        }
      });
    } catch (error) {
      console.warn('Error removing content type mappings:', error);
    }

    // Remove renderer
    this.renderers.delete(rendererName);

    // Clear fallback if it was this renderer
    if (this.fallbackRenderer === renderer) {
      this.fallbackRenderer = null;
    }

    // Clear cache
    this.cache.clear();

    return true;
  }

  /**
   * Get renderer for content type
   */
  getRenderer(contentType) {
    if (!contentType || typeof contentType !== 'string') {
      return this.fallbackRenderer;
    }

    const normalizedType = contentType.toLowerCase();

    // Check cache first
    if (this.cache.has(normalizedType)) {
      return this.cache.get(normalizedType);
    }

    // Find renderer
    let renderer = null;
    const rendererName = this.contentTypeMap.get(normalizedType);
    
    if (rendererName && this.renderers.has(rendererName)) {
      renderer = this.renderers.get(rendererName);
    } else {
      // Fallback to checking all renderers (in case of dynamic changes)
      for (const [name, r] of this.renderers) {
        try {
          if (r.canRender && r.canRender(contentType)) {
            renderer = r;
            // Update content type mapping for future lookups
            this.contentTypeMap.set(normalizedType, name);
            break;
          }
        } catch (error) {
          console.warn(`Error checking canRender for ${name}:`, error);
        }
      }
    }

    // Use fallback if no specific renderer found
    if (!renderer) {
      renderer = this.fallbackRenderer;
    }

    // Cache result
    this.cache.set(normalizedType, renderer);

    return renderer;
  }

  /**
   * Get renderer by name
   */
  getRendererByName(rendererName) {
    return this.renderers.get(rendererName) || null;
  }

  /**
   * Check if content type can be rendered
   */
  canRender(contentType) {
    if (!contentType || typeof contentType !== 'string') {
      return false;
    }

    const normalizedType = contentType.toLowerCase();

    // Check content type map first
    if (this.contentTypeMap.has(normalizedType)) {
      return true;
    }

    // Check all renderers
    for (const renderer of this.renderers.values()) {
      try {
        if (renderer.canRender && renderer.canRender(contentType)) {
          return true;
        }
      } catch (error) {
        console.warn('Error checking canRender:', error);
      }
    }

    return false;
  }

  /**
   * Get all supported content types
   */
  getSupportedContentTypes() {
    const types = new Set();

    // Add from content type map
    for (const contentType of this.contentTypeMap.keys()) {
      types.add(contentType);
    }

    // Add from renderer supported types (in case of updates)
    for (const renderer of this.renderers.values()) {
      try {
        const supportedTypes = renderer.getSupportedTypes();
        if (Array.isArray(supportedTypes)) {
          supportedTypes.forEach(type => {
            types.add(type.toLowerCase());
          });
        }
      } catch (error) {
        console.warn('Error getting supported types:', error);
      }
    }

    return Array.from(types).sort();
  }

  /**
   * Set fallback renderer for unknown content types
   */
  setFallbackRenderer(renderer) {
    this.fallbackRenderer = renderer;
    this.cache.clear(); // Clear cache as fallback changed
  }

  /**
   * Check if renderer is registered
   */
  isRegistered(rendererName) {
    return this.renderers.has(rendererName);
  }

  /**
   * Get list of registered renderer names
   */
  getRegisteredRenderers() {
    return Array.from(this.renderers.keys());
  }

  /**
   * Clear all renderers
   */
  clear() {
    this.renderers.clear();
    this.contentTypeMap.clear();
    this.fallbackRenderer = null;
    this.cache.clear();
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const rendererStats = Array.from(this.renderers.entries()).map(([name, renderer]) => {
      try {
        return {
          name,
          version: renderer.getVersion(),
          supportedTypes: renderer.getSupportedTypes(),
          description: renderer.getDescription()
        };
      } catch (error) {
        return {
          name,
          version: 'unknown',
          supportedTypes: [],
          description: 'Error retrieving info',
          error: error.message
        };
      }
    });

    return {
      totalRenderers: this.renderers.size,
      totalContentTypes: this.contentTypeMap.size,
      hasFallbackRenderer: !!this.fallbackRenderer,
      cacheSize: this.cache.size,
      renderers: rendererStats
    };
  }

  /**
   * Validate renderer interface
   * @private
   */
  _validateRenderer(renderer) {
    if (!renderer || typeof renderer !== 'object') {
      return false;
    }

    // Check required methods exist
    const requiredMethods = ['getName', 'getVersion', 'getSupportedTypes', 'getDescription', 'canRender', 'render'];
    for (const method of requiredMethods) {
      if (typeof renderer[method] !== 'function') {
        console.warn(`Renderer missing required method: ${method}`);
        return false;
      }
    }

    try {
      // Validate method return types
      const name = renderer.getName();
      if (typeof name !== 'string' || !name.trim()) {
        console.warn('getName() must return non-empty string');
        return false;
      }

      const version = renderer.getVersion();
      if (typeof version !== 'string') {
        console.warn('getVersion() must return string');
        return false;
      }

      const supportedTypes = renderer.getSupportedTypes();
      if (!Array.isArray(supportedTypes)) {
        console.warn('getSupportedTypes() must return array');
        return false;
      }

      const description = renderer.getDescription();
      if (typeof description !== 'string') {
        console.warn('getDescription() must return string');
        return false;
      }

      // Test canRender with a sample value
      const canRenderResult = renderer.canRender('test');
      if (typeof canRenderResult !== 'boolean') {
        console.warn('canRender() must return boolean');
        return false;
      }

    } catch (error) {
      console.warn('Error validating renderer methods:', error);
      return false;
    }

    return true;
  }
}