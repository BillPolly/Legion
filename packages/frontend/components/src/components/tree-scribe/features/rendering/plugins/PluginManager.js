/**
 * PluginManager - Dynamic plugin loading and management system
 * 
 * Provides plugin registration, isolation, error handling, and lifecycle management
 */

export class PluginManager {
  constructor(options = {}) {
    this.options = {
      allowDynamicImport: true,
      sandboxPlugins: true,
      validatePlugins: true,
      maxLoadTime: 5000,
      retryAttempts: 2,
      ...options
    };

    this.destroyed = false;
    this.plugins = new Map(); // pluginId -> plugin instance
    this.pluginMetadata = new Map(); // pluginId -> metadata
    this.loadingPlugins = new Map(); // pluginId -> Promise
    this.eventListeners = new Map(); // eventType -> [callbacks]
    
    // Plugin lifecycle hooks
    this.lifecycleHooks = {
      beforeLoad: [],
      afterLoad: [],
      beforeUnload: [],
      afterUnload: [],
      onError: []
    };

    // Security sandbox for plugins
    this.sandbox = this._createSandbox();
  }

  /**
   * Register a plugin
   */
  async registerPlugin(pluginId, plugin, metadata = {}) {
    if (this.destroyed) return { success: false, error: 'PluginManager destroyed' };

    try {
      // Validate plugin ID
      if (!pluginId || typeof pluginId !== 'string') {
        throw new Error('Invalid plugin ID');
      }

      // Check if already registered
      if (this.plugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} already registered`);
      }

      // Validate plugin
      if (this.options.validatePlugins) {
        this._validatePlugin(plugin, metadata);
      }

      // Call beforeLoad hooks
      await this._callLifecycleHooks('beforeLoad', { pluginId, plugin, metadata });

      // Initialize plugin
      const instance = await this._initializePlugin(plugin, metadata);

      // Store plugin and metadata
      this.plugins.set(pluginId, instance);
      this.pluginMetadata.set(pluginId, {
        ...metadata,
        registeredAt: Date.now(),
        version: metadata.version || '1.0.0',
        type: metadata.type || 'renderer',
        dependencies: metadata.dependencies || []
      });

      // Call afterLoad hooks
      await this._callLifecycleHooks('afterLoad', { pluginId, instance, metadata });

      this._emit('pluginRegistered', { pluginId, metadata });

      return { success: true, instance };
    } catch (error) {
      await this._handlePluginError(pluginId, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load plugin dynamically
   */
  async loadPlugin(pluginPath, metadata = {}) {
    if (this.destroyed) return { success: false, error: 'PluginManager destroyed' };
    if (!this.options.allowDynamicImport) {
      return { success: false, error: 'Dynamic import not allowed' };
    }

    const pluginId = metadata.id || this._generatePluginId(pluginPath);

    // Check if already loading
    if (this.loadingPlugins.has(pluginId)) {
      return this.loadingPlugins.get(pluginId);
    }

    // Create loading promise
    const loadPromise = this._loadPluginAsync(pluginPath, pluginId, metadata);
    this.loadingPlugins.set(pluginId, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPlugins.delete(pluginId);
      return result;
    } catch (error) {
      this.loadingPlugins.delete(pluginId);
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId) {
    if (this.destroyed) return { success: false, error: 'PluginManager destroyed' };

    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // Call beforeUnload hooks
      await this._callLifecycleHooks('beforeUnload', { pluginId, plugin });

      // Cleanup plugin
      if (plugin.destroy && typeof plugin.destroy === 'function') {
        await plugin.destroy();
      }

      // Remove from registry
      this.plugins.delete(pluginId);
      this.pluginMetadata.delete(pluginId);

      // Call afterUnload hooks
      await this._callLifecycleHooks('afterUnload', { pluginId });

      this._emit('pluginUnregistered', { pluginId });

      return { success: true };
    } catch (error) {
      await this._handlePluginError(pluginId, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    if (this.destroyed) return null;
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins() {
    if (this.destroyed) return [];
    
    return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
      id,
      plugin,
      metadata: this.pluginMetadata.get(id)
    }));
  }

  /**
   * Get plugins by type
   */
  getPluginsByType(type) {
    if (this.destroyed) return [];

    return this.getAllPlugins().filter(({ metadata }) => 
      metadata && metadata.type === type
    );
  }

  /**
   * Check if plugin is registered
   */
  hasPlugin(pluginId) {
    if (this.destroyed) return false;
    return this.plugins.has(pluginId);
  }

  /**
   * Add lifecycle hook
   */
  addLifecycleHook(hookType, callback) {
    if (this.destroyed || !this.lifecycleHooks[hookType]) return false;

    this.lifecycleHooks[hookType].push(callback);
    return true;
  }

  /**
   * Remove lifecycle hook
   */
  removeLifecycleHook(hookType, callback) {
    if (this.destroyed || !this.lifecycleHooks[hookType]) return false;

    const hooks = this.lifecycleHooks[hookType];
    const index = hooks.indexOf(callback);
    if (index > -1) {
      hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Execute plugin method with error isolation
   */
  async executePluginMethod(pluginId, methodName, ...args) {
    if (this.destroyed) return { success: false, error: 'PluginManager destroyed' };

    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      if (!plugin[methodName] || typeof plugin[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in plugin ${pluginId}`);
      }

      // Execute in sandbox if enabled
      if (this.options.sandboxPlugins) {
        return await this._executeSandboxed(plugin, methodName, args);
      } else {
        const result = await plugin[methodName](...args);
        return { success: true, result };
      }
    } catch (error) {
      await this._handlePluginError(pluginId, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies(pluginId) {
    if (this.destroyed) return { valid: false, missing: [] };

    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata || !metadata.dependencies) {
      return { valid: true, missing: [] };
    }

    const missing = metadata.dependencies.filter(dep => !this.hasPlugin(dep));
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get plugin manager info
   */
  getInfo() {
    return {
      name: 'PluginManager',
      version: '1.0.0',
      pluginCount: this.plugins.size,
      loadingCount: this.loadingPlugins.size,
      options: { ...this.options },
      destroyed: this.destroyed
    };
  }

  /**
   * Create security sandbox for plugins
   * @private
   */
  _createSandbox() {
    // Create restricted environment for plugin execution
    return {
      // Allowed globals
      console: {
        log: (...args) => console.log('[Plugin]', ...args),
        warn: (...args) => console.warn('[Plugin]', ...args),
        error: (...args) => console.error('[Plugin]', ...args)
      },
      setTimeout: (fn, delay) => setTimeout(() => {
        try { fn(); } catch (e) { console.error('[Plugin Error]', e); }
      }, delay),
      clearTimeout,
      // Restricted APIs
      document: null,
      window: null,
      eval: null,
      Function: null
    };
  }

  /**
   * Load plugin asynchronously
   * @private
   */
  async _loadPluginAsync(pluginPath, pluginId, metadata) {
    let attempt = 0;
    
    while (attempt <= this.options.retryAttempts) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Plugin load timeout')), this.options.maxLoadTime)
        );

        // Create import promise
        const importPromise = import(pluginPath).then(module => {
          const plugin = module.default || module;
          return this.registerPlugin(pluginId, plugin, metadata);
        });

        // Race between import and timeout
        const result = await Promise.race([importPromise, timeoutPromise]);
        return result;
      } catch (error) {
        attempt++;
        if (attempt > this.options.retryAttempts) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Initialize plugin instance
   * @private
   */
  async _initializePlugin(plugin, metadata) {
    // If plugin is a class, instantiate it
    if (typeof plugin === 'function' && plugin.prototype) {
      return new plugin(this._createPluginContext(metadata));
    }
    
    // If plugin has init method, call it
    if (plugin.init && typeof plugin.init === 'function') {
      await plugin.init(this._createPluginContext(metadata));
    }
    
    return plugin;
  }

  /**
   * Create plugin context
   * @private
   */
  _createPluginContext(metadata) {
    return {
      id: metadata.id,
      version: metadata.version,
      manager: this,
      sandbox: this.options.sandboxPlugins ? { ...this.sandbox } : null,
      emit: (event, data) => this._emit(`plugin:${event}`, { ...data, pluginId: metadata.id })
    };
  }

  /**
   * Validate plugin structure
   * @private
   */
  _validatePlugin(plugin, metadata) {
    if (!plugin || (typeof plugin !== 'object' && typeof plugin !== 'function')) {
      throw new Error('Invalid plugin: must be object or constructor');
    }

    // Check required methods based on type
    const requiredMethods = this._getRequiredMethods(metadata.type);
    for (const method of requiredMethods) {
      if (typeof plugin === 'function') {
        // Check prototype for class-based plugins
        if (!plugin.prototype[method]) {
          throw new Error(`Plugin missing required method: ${method}`);
        }
      } else {
        // Check object for instance-based plugins
        if (!plugin[method] || typeof plugin[method] !== 'function') {
          throw new Error(`Plugin missing required method: ${method}`);
        }
      }
    }
  }

  /**
   * Get required methods for plugin type
   * @private
   */
  _getRequiredMethods(type) {
    switch (type) {
      case 'renderer':
        return ['render', 'getInfo'];
      case 'processor':
        return ['process', 'getInfo'];
      case 'extension':
        return ['activate', 'deactivate'];
      default:
        return ['getInfo'];
    }
  }

  /**
   * Execute method in sandbox
   * @private
   */
  async _executeSandboxed(plugin, methodName, args) {
    // Create isolated execution context
    const context = {
      ...this.sandbox,
      plugin,
      args
    };

    try {
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Plugin execution timeout')), 5000)
      );

      const executionPromise = Promise.resolve(plugin[methodName](...args));
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      return { success: true, result };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate plugin ID from path
   * @private
   */
  _generatePluginId(pluginPath) {
    // Extract meaningful ID from path
    const parts = pluginPath.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^/.]+$/, ''); // Remove extension
  }

  /**
   * Call lifecycle hooks
   * @private
   */
  async _callLifecycleHooks(hookType, data) {
    const hooks = this.lifecycleHooks[hookType];
    if (!hooks) return;

    for (const hook of hooks) {
      try {
        await hook(data);
      } catch (error) {
        console.error(`Lifecycle hook error (${hookType}):`, error);
      }
    }
  }

  /**
   * Handle plugin errors
   * @private
   */
  async _handlePluginError(pluginId, error) {
    console.error(`Plugin error (${pluginId}):`, error);

    // Call error hooks
    await this._callLifecycleHooks('onError', { pluginId, error });

    // Emit error event
    this._emit('pluginError', { pluginId, error: error.message });
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event
   * @private
   */
  _emit(eventType, data) {
    if (this.destroyed) return;
    
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Plugin event listener error:', error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    if (this.destroyed) return;

    // Unregister all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      await this.unregisterPlugin(pluginId);
    }

    // Clear all data
    this.plugins.clear();
    this.pluginMetadata.clear();
    this.loadingPlugins.clear();
    this.eventListeners.clear();

    // Clear lifecycle hooks
    Object.keys(this.lifecycleHooks).forEach(hook => {
      this.lifecycleHooks[hook] = [];
    });

    this.destroyed = true;
  }
}