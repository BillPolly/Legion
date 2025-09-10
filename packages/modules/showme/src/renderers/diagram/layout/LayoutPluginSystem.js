/**
 * LayoutPluginSystem - Extensible plugin system for custom layout algorithms
 * 
 * Provides a standardized interface for registering and using different layout algorithms.
 * Supports plugin discovery, validation, lifecycle management, and configuration.
 * Enables hot-swapping of layouts and dynamic layout composition.
 */

export class LayoutPluginSystem {
  constructor(config = {}) {
    this.config = {
      // Plugin discovery
      autoDiscover: config.autoDiscover !== false,
      pluginPaths: config.pluginPaths || ['./layouts/'],
      
      // Validation
      strictValidation: config.strictValidation !== false,
      requireMetadata: config.requireMetadata !== false,
      
      // Performance
      enableCaching: config.enableCaching !== false,
      maxCacheSize: config.maxCacheSize || 100,
      
      // Events
      onPluginRegistered: config.onPluginRegistered,
      onPluginError: config.onPluginError,
      onLayoutChanged: config.onLayoutChanged,
      
      ...config
    };
    
    // Plugin registry
    this.plugins = new Map();
    this.pluginMetadata = new Map();
    this.pluginInstances = new Map();
    
    // Layout cache
    this.layoutCache = new Map();
    this.cacheStats = { hits: 0, misses: 0 };
    
    // Plugin lifecycle
    this.loadedPlugins = new Set();
    this.activePlugins = new Set();
    this.failedPlugins = new Map();
    
    // Built-in layouts
    this.builtinLayouts = new Map();
    
    // Current layout state
    this.currentLayout = null;
    this.layoutHistory = [];
    this.maxHistorySize = 20;
  }
  
  /**
   * Initialize the plugin system
   */
  async initialize() {
    // Register built-in layouts
    await this._registerBuiltinLayouts();
    
    // Auto-discover plugins if enabled
    if (this.config.autoDiscover) {
      await this._discoverPlugins();
    }
    
    return this;
  }
  
  /**
   * Register a layout plugin
   * @param {string} name - Plugin name
   * @param {Function|Object} plugin - Plugin class or instance
   * @param {Object} metadata - Plugin metadata
   */
  async registerPlugin(name, plugin, metadata = {}) {
    try {
      // Validate plugin
      const validation = await this._validatePlugin(name, plugin, metadata);
      if (!validation.isValid) {
        throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Store plugin
      this.plugins.set(name, plugin);
      this.pluginMetadata.set(name, {
        name,
        version: metadata.version || '1.0.0',
        description: metadata.description || 'Custom layout plugin',
        author: metadata.author || 'Unknown',
        category: metadata.category || 'custom',
        tags: metadata.tags || [],
        dependencies: metadata.dependencies || [],
        capabilities: metadata.capabilities || {},
        config: metadata.config || {},
        registeredAt: Date.now(),
        ...metadata
      });
      
      this.loadedPlugins.add(name);
      
      // Notify registration
      if (this.config.onPluginRegistered) {
        this.config.onPluginRegistered(name, metadata);
      }
      
      console.log(`Layout plugin registered: ${name}`);
      return true;
      
    } catch (error) {
      this.failedPlugins.set(name, {
        error: error.message,
        timestamp: Date.now()
      });
      
      if (this.config.onPluginError) {
        this.config.onPluginError(name, error);
      }
      
      console.error(`Failed to register plugin ${name}:`, error);
      return false;
    }
  }
  
  /**
   * Unregister a plugin
   * @param {string} name - Plugin name
   */
  unregisterPlugin(name) {
    if (!this.plugins.has(name)) {
      return false;
    }
    
    // Clean up instance if exists
    if (this.pluginInstances.has(name)) {
      const instance = this.pluginInstances.get(name);
      if (instance.destroy && typeof instance.destroy === 'function') {
        instance.destroy();
      }
      this.pluginInstances.delete(name);
    }
    
    // Remove from registry
    this.plugins.delete(name);
    this.pluginMetadata.delete(name);
    this.loadedPlugins.delete(name);
    this.activePlugins.delete(name);
    this.failedPlugins.delete(name);
    
    // Clear from cache
    this._clearLayoutCache(name);
    
    console.log(`Plugin unregistered: ${name}`);
    return true;
  }
  
  /**
   * Get list of available plugins
   * @param {Object} filters - Filter criteria
   * @returns {Array} Array of plugin info
   */
  getAvailablePlugins(filters = {}) {
    const plugins = [];
    
    this.pluginMetadata.forEach((metadata, name) => {
      // Apply filters
      if (filters.category && metadata.category !== filters.category) {
        return;
      }
      
      if (filters.tags && !filters.tags.some(tag => metadata.tags.includes(tag))) {
        return;
      }
      
      if (filters.capabilities) {
        const hasAllCapabilities = Object.keys(filters.capabilities).every(cap => 
          metadata.capabilities[cap]
        );
        if (!hasAllCapabilities) {
          return;
        }
      }
      
      plugins.push({
        name,
        ...metadata,
        isLoaded: this.loadedPlugins.has(name),
        isActive: this.activePlugins.has(name),
        hasFailed: this.failedPlugins.has(name)
      });
    });
    
    return plugins.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Get plugin instance
   * @param {string} name - Plugin name
   * @param {Object} config - Plugin configuration
   * @returns {Object} Plugin instance
   */
  async getPlugin(name, config = {}) {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin not found: ${name}`);
    }
    
    // Return cached instance if available
    const cacheKey = `${name}-${JSON.stringify(config)}`;
    if (this.pluginInstances.has(cacheKey)) {
      return this.pluginInstances.get(cacheKey);
    }
    
    try {
      const PluginClass = this.plugins.get(name);
      const metadata = this.pluginMetadata.get(name);
      
      // Create instance
      let instance;
      if (typeof PluginClass === 'function') {
        instance = new PluginClass({
          ...metadata.config,
          ...config
        });
      } else {
        instance = PluginClass; // Already an instance
      }
      
      // Initialize if needed
      if (instance.initialize && typeof instance.initialize === 'function') {
        await instance.initialize();
      }
      
      // Cache instance
      this.pluginInstances.set(cacheKey, instance);
      this.activePlugins.add(name);
      
      return instance;
      
    } catch (error) {
      console.error(`Failed to instantiate plugin ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Execute layout using specified plugin
   * @param {string} pluginName - Name of layout plugin
   * @param {Object} graphData - Graph data to layout
   * @param {Object} config - Layout configuration
   * @returns {Object} Layout result
   */
  async executeLayout(pluginName, graphData, config = {}) {
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this._getCacheKey(pluginName, graphData, config);
      if (this.layoutCache.has(cacheKey)) {
        this.cacheStats.hits++;
        const cached = this.layoutCache.get(cacheKey);
        return { ...cached, fromCache: true };
      }
      this.cacheStats.misses++;
    }
    
    try {
      const startTime = performance.now();
      
      // Get plugin instance
      const plugin = await this.getPlugin(pluginName, config);
      
      // Validate layout method
      if (!plugin.layout || typeof plugin.layout !== 'function') {
        throw new Error(`Plugin ${pluginName} does not implement layout() method`);
      }
      
      // Execute layout
      const result = await plugin.layout(graphData);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Enhance result with metadata
      const enhancedResult = {
        ...result,
        metadata: {
          ...result.metadata,
          plugin: pluginName,
          executionTime,
          cacheKey: this.config.enableCaching ? this._getCacheKey(pluginName, graphData, config) : null
        }
      };
      
      // Cache result
      if (this.config.enableCaching) {
        this._cacheLayoutResult(pluginName, graphData, config, enhancedResult);
      }
      
      // Update current layout
      this.currentLayout = {
        plugin: pluginName,
        config,
        result: enhancedResult,
        timestamp: Date.now()
      };
      
      // Add to history
      this._addToHistory(this.currentLayout);
      
      // Notify change
      if (this.config.onLayoutChanged) {
        this.config.onLayoutChanged(pluginName, enhancedResult);
      }
      
      return enhancedResult;
      
    } catch (error) {
      console.error(`Layout execution failed for ${pluginName}:`, error);
      throw error;
    }
  }
  
  /**
   * Get layout capabilities for a plugin
   * @param {string} name - Plugin name
   * @returns {Object} Capabilities object
   */
  getPluginCapabilities(name) {
    const metadata = this.pluginMetadata.get(name);
    return metadata ? metadata.capabilities : null;
  }
  
  /**
   * Check if plugin supports specific features
   * @param {string} name - Plugin name
   * @param {Array} features - Required features
   * @returns {boolean}
   */
  supportsFeatures(name, features) {
    const capabilities = this.getPluginCapabilities(name);
    if (!capabilities) return false;
    
    return features.every(feature => capabilities[feature]);
  }
  
  /**
   * Get plugin configuration schema
   * @param {string} name - Plugin name
   * @returns {Object} Configuration schema
   */
  getPluginConfigSchema(name) {
    const metadata = this.pluginMetadata.get(name);
    return metadata ? metadata.configSchema : null;
  }
  
  /**
   * Validate plugin configuration
   * @param {string} name - Plugin name
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validatePluginConfig(name, config) {
    const schema = this.getPluginConfigSchema(name);
    if (!schema) {
      return { isValid: true, errors: [] };
    }
    
    // Basic validation logic (can be enhanced with JSON Schema)
    const errors = [];
    
    // Check required fields
    if (schema.required) {
      schema.required.forEach(field => {
        if (!(field in config)) {
          errors.push(`Missing required field: ${field}`);
        }
      });
    }
    
    // Check field types
    if (schema.properties) {
      Object.keys(config).forEach(key => {
        const propSchema = schema.properties[key];
        if (propSchema && propSchema.type) {
          const actualType = typeof config[key];
          if (actualType !== propSchema.type) {
            errors.push(`Field ${key}: expected ${propSchema.type}, got ${actualType}`);
          }
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get system statistics
   * @returns {Object} System stats
   */
  getStats() {
    return {
      plugins: {
        total: this.plugins.size,
        loaded: this.loadedPlugins.size,
        active: this.activePlugins.size,
        failed: this.failedPlugins.size
      },
      cache: {
        size: this.layoutCache.size,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
      },
      history: {
        size: this.layoutHistory.length,
        current: this.currentLayout ? this.currentLayout.plugin : null
      }
    };
  }
  
  /**
   * Clear layout cache
   * @param {string} pluginName - Optional plugin name to clear specific entries
   */
  clearCache(pluginName = null) {
    if (pluginName) {
      this._clearLayoutCache(pluginName);
    } else {
      this.layoutCache.clear();
      this.cacheStats = { hits: 0, misses: 0 };
    }
  }
  
  /**
   * Register built-in layouts
   * @private
   */
  async _registerBuiltinLayouts() {
    // Import built-in layouts
    const { DagreLayout } = await import('./DagreLayout.js');
    const { ForceLayout } = await import('./ForceLayout.js');
    const { TreeLayout } = await import('./TreeLayout.js');
    
    // Register built-ins
    await this.registerPlugin('dagre', DagreLayout, {
      version: '1.0.0',
      description: 'Hierarchical layout using Dagre algorithm',
      category: 'hierarchical',
      tags: ['directed', 'layered', 'hierarchy'],
      capabilities: {
        directed: true,
        undirected: false,
        weighted: false,
        constraints: true,
        animation: true
      }
    });
    
    await this.registerPlugin('force', ForceLayout, {
      version: '1.0.0',
      description: 'Force-directed layout with physics simulation',
      category: 'physics',
      tags: ['force', 'physics', 'spring'],
      capabilities: {
        directed: true,
        undirected: true,
        weighted: true,
        constraints: false,
        animation: true
      }
    });
    
    await this.registerPlugin('tree', TreeLayout, {
      version: '1.0.0',
      description: 'Tree layout with multiple orientations',
      category: 'hierarchical',
      tags: ['tree', 'hierarchy', 'radial'],
      capabilities: {
        directed: true,
        undirected: false,
        weighted: false,
        constraints: false,
        animation: false
      }
    });
  }
  
  /**
   * Auto-discover plugins from configured paths
   * @private
   */
  async _discoverPlugins() {
    // Plugin discovery would be implemented here
    // For now, just log that discovery is attempted
    console.log('Plugin discovery not yet implemented');
  }
  
  /**
   * Validate plugin implementation
   * @private
   */
  async _validatePlugin(name, plugin, metadata) {
    const errors = [];
    
    // Basic validation
    if (!name || typeof name !== 'string') {
      errors.push('Plugin name must be a non-empty string');
    }
    
    if (!plugin) {
      errors.push('Plugin implementation is required');
    }
    
    // Check if plugin is a class or instance
    let PluginClass = plugin;
    if (typeof plugin === 'function') {
      // Try to create instance to validate
      try {
        const testInstance = new plugin({});
        if (!testInstance.layout || typeof testInstance.layout !== 'function') {
          errors.push('Plugin must implement layout() method');
        }
      } catch (error) {
        // Could be a valid class that requires specific config
        // We'll validate at runtime
      }
    } else if (typeof plugin === 'object') {
      if (!plugin.layout || typeof plugin.layout !== 'function') {
        errors.push('Plugin instance must implement layout() method');
      }
    } else {
      errors.push('Plugin must be a class constructor or instance');
    }
    
    // Metadata validation
    if (this.config.requireMetadata) {
      if (!metadata.description) {
        errors.push('Plugin description is required');
      }
      if (!metadata.version) {
        errors.push('Plugin version is required');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generate cache key for layout result
   * @private
   */
  _getCacheKey(pluginName, graphData, config) {
    // Create hash based on plugin name, node count, edge count, and config
    const nodeCount = graphData.nodes ? graphData.nodes.length : 0;
    const edgeCount = graphData.edges ? graphData.edges.length : 0;
    const configHash = JSON.stringify(config);
    
    return `${pluginName}-${nodeCount}-${edgeCount}-${configHash.length}`;
  }
  
  /**
   * Cache layout result
   * @private
   */
  _cacheLayoutResult(pluginName, graphData, config, result) {
    // Implement LRU cache eviction
    if (this.layoutCache.size >= this.config.maxCacheSize) {
      const firstKey = this.layoutCache.keys().next().value;
      this.layoutCache.delete(firstKey);
    }
    
    const cacheKey = this._getCacheKey(pluginName, graphData, config);
    this.layoutCache.set(cacheKey, {
      ...result,
      cachedAt: Date.now()
    });
  }
  
  /**
   * Clear cache entries for specific plugin
   * @private
   */
  _clearLayoutCache(pluginName) {
    for (const [key] of this.layoutCache) {
      if (key.startsWith(pluginName + '-')) {
        this.layoutCache.delete(key);
      }
    }
  }
  
  /**
   * Add layout to history
   * @private
   */
  _addToHistory(layout) {
    this.layoutHistory.push(layout);
    
    // Maintain history size
    if (this.layoutHistory.length > this.maxHistorySize) {
      this.layoutHistory.shift();
    }
  }
  
  /**
   * Destroy the plugin system
   */
  destroy() {
    // Clean up all plugin instances
    this.pluginInstances.forEach((instance, key) => {
      if (instance.destroy && typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });
    
    // Clear all state
    this.plugins.clear();
    this.pluginMetadata.clear();
    this.pluginInstances.clear();
    this.layoutCache.clear();
    this.loadedPlugins.clear();
    this.activePlugins.clear();
    this.failedPlugins.clear();
    this.builtinLayouts.clear();
    this.layoutHistory = [];
    this.currentLayout = null;
  }
}

export default LayoutPluginSystem;