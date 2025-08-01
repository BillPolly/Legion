/**
 * EnhancedRendererRegistry - Enhanced registry with plugin support
 * Extends the basic RendererRegistry with dynamic plugin loading capabilities
 */

import { RendererRegistry } from './RendererRegistry.js';
import { PluginManager } from './plugins/PluginManager.js';

export class EnhancedRendererRegistry extends RendererRegistry {
  constructor() {
    super();
    
    // Override singleton instance
    if (EnhancedRendererRegistry.instance) {
      return EnhancedRendererRegistry.instance;
    }
    
    // Plugin manager for dynamic renderer loading
    this.pluginManager = new PluginManager({
      allowDynamicImport: true,
      validatePlugins: true,
      sandboxPlugins: false // Renderers need DOM access
    });

    // Plugin-specific maps
    this.pluginRenderers = new Map(); // pluginId -> rendererName
    this.pendingLoads = new Map(); // path -> Promise
    
    // Setup plugin lifecycle hooks
    this._setupPluginHooks();
    
    EnhancedRendererRegistry.instance = this;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!EnhancedRendererRegistry.instance) {
      EnhancedRendererRegistry.instance = new EnhancedRendererRegistry();
    }
    return EnhancedRendererRegistry.instance;
  }

  /**
   * Load renderer plugin dynamically
   */
  async loadRendererPlugin(pluginPath, metadata = {}) {
    // Check if already loading
    if (this.pendingLoads.has(pluginPath)) {
      return this.pendingLoads.get(pluginPath);
    }

    // Create loading promise
    const loadPromise = this._loadRendererPluginAsync(pluginPath, metadata);
    this.pendingLoads.set(pluginPath, loadPromise);

    try {
      const result = await loadPromise;
      this.pendingLoads.delete(pluginPath);
      return result;
    } catch (error) {
      this.pendingLoads.delete(pluginPath);
      throw error;
    }
  }

  /**
   * Register renderer plugin
   */
  async registerRendererPlugin(pluginId, rendererClass, metadata = {}) {
    try {
      // Register with plugin manager
      const result = await this.pluginManager.registerPlugin(pluginId, rendererClass, {
        ...metadata,
        type: 'renderer'
      });

      if (!result.success) {
        return result;
      }

      // Create renderer instance
      const renderer = result.instance;
      
      // Register with base registry
      const registered = this.register(renderer);
      
      if (!registered) {
        // Rollback plugin registration
        await this.pluginManager.unregisterPlugin(pluginId);
        return { success: false, error: 'Failed to register renderer' };
      }

      // Track plugin-renderer mapping
      this.pluginRenderers.set(pluginId, renderer.getName());

      return { success: true, renderer };
    } catch (error) {
      console.error('Error registering renderer plugin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unregister renderer plugin
   */
  async unregisterRendererPlugin(pluginId) {
    try {
      // Get renderer name
      const rendererName = this.pluginRenderers.get(pluginId);
      if (!rendererName) {
        return { success: false, error: 'Plugin not found' };
      }

      // Unregister from base registry
      this.unregister(rendererName);

      // Unregister from plugin manager
      const result = await this.pluginManager.unregisterPlugin(pluginId);
      
      if (result.success) {
        this.pluginRenderers.delete(pluginId);
      }

      return result;
    } catch (error) {
      console.error('Error unregistering renderer plugin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get renderer for content type with plugin fallback
   */
  async getRendererAsync(contentType) {
    // Try base registry first
    let renderer = this.getRenderer(contentType);
    if (renderer) {
      return renderer;
    }

    // Try to find and load a plugin for this content type
    const pluginPath = await this._findPluginForContentType(contentType);
    if (pluginPath) {
      try {
        const result = await this.loadRendererPlugin(pluginPath, {
          requestedContentType: contentType
        });
        
        if (result.success) {
          // Try again after loading
          renderer = this.getRenderer(contentType);
        }
      } catch (error) {
        console.warn(`Failed to load plugin for ${contentType}:`, error);
      }
    }

    return renderer || this.fallbackRenderer;
  }

  /**
   * Get plugin-loaded renderers
   */
  getPluginRenderers() {
    return Array.from(this.pluginRenderers.entries()).map(([pluginId, rendererName]) => ({
      pluginId,
      rendererName,
      renderer: this.getRendererByName(rendererName),
      metadata: this.pluginManager.pluginMetadata.get(pluginId)
    }));
  }

  /**
   * Reload renderer plugin
   */
  async reloadRendererPlugin(pluginId) {
    const rendererName = this.pluginRenderers.get(pluginId);
    const metadata = this.pluginManager.pluginMetadata.get(pluginId);
    
    if (!rendererName || !metadata) {
      return { success: false, error: 'Plugin not found' };
    }

    // Unregister first
    await this.unregisterRendererPlugin(pluginId);

    // Reload
    if (metadata.path) {
      return this.loadRendererPlugin(metadata.path, metadata);
    } else {
      return { success: false, error: 'No plugin path available for reload' };
    }
  }

  /**
   * Get enhanced statistics
   */
  getEnhancedStatistics() {
    const baseStats = this.getStatistics();
    
    return {
      ...baseStats,
      pluginRenderers: this.pluginRenderers.size,
      pendingLoads: this.pendingLoads.size,
      pluginManager: this.pluginManager.getInfo()
    };
  }

  /**
   * Setup plugin lifecycle hooks
   * @private
   */
  _setupPluginHooks() {
    // After plugin load hook
    this.pluginManager.addLifecycleHook('afterLoad', async ({ pluginId, instance, metadata }) => {
      if (metadata.type === 'renderer') {
        console.log(`Renderer plugin loaded: ${pluginId}`);
      }
    });

    // Before plugin unload hook
    this.pluginManager.addLifecycleHook('beforeUnload', async ({ pluginId }) => {
      const rendererName = this.pluginRenderers.get(pluginId);
      if (rendererName) {
        console.log(`Unloading renderer plugin: ${pluginId} (${rendererName})`);
      }
    });

    // Error hook
    this.pluginManager.addLifecycleHook('onError', async ({ pluginId, error }) => {
      console.error(`Renderer plugin error (${pluginId}):`, error);
    });
  }

  /**
   * Load renderer plugin asynchronously
   * @private
   */
  async _loadRendererPluginAsync(pluginPath, metadata) {
    try {
      // Generate plugin ID
      const pluginId = metadata.id || this._generatePluginId(pluginPath);
      
      // Load with plugin manager
      const loadResult = await this.pluginManager.loadPlugin(pluginPath, {
        ...metadata,
        id: pluginId,
        path: pluginPath
      });

      if (!loadResult.success) {
        return loadResult;
      }

      // The plugin should self-register as a renderer
      // Check if it did
      const rendererName = this.pluginRenderers.get(pluginId);
      if (!rendererName) {
        // Try to extract and register manually
        const plugin = this.pluginManager.getPlugin(pluginId);
        if (plugin) {
          return this.registerRendererPlugin(pluginId, plugin, metadata);
        }
      }

      return {
        success: true,
        rendererName,
        renderer: this.getRendererByName(rendererName)
      };
    } catch (error) {
      console.error('Error loading renderer plugin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find plugin for content type
   * @private
   */
  async _findPluginForContentType(contentType) {
    // This would typically query a plugin repository or registry
    // For now, return null (no auto-discovery)
    // Could be extended to check a plugins directory or remote registry
    return null;
  }

  /**
   * Generate plugin ID from path
   * @private
   */
  _generatePluginId(pluginPath) {
    const parts = pluginPath.split('/');
    const filename = parts[parts.length - 1];
    return `renderer-${filename.replace(/\.[^/.]+$/, '')}`;
  }

  /**
   * Clear all data including plugins
   */
  async clearAll() {
    // Clear plugins first
    const pluginIds = Array.from(this.pluginRenderers.keys());
    for (const pluginId of pluginIds) {
      await this.unregisterRendererPlugin(pluginId);
    }

    // Clear base registry
    this.clear();

    // Clear pending loads
    this.pendingLoads.clear();
  }

  /**
   * Destroy registry and plugin manager
   */
  async destroy() {
    await this.clearAll();
    await this.pluginManager.destroy();
    
    EnhancedRendererRegistry.instance = null;
  }
}