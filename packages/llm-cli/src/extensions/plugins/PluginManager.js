export class PluginManager {
  constructor(framework) {
    this.framework = framework;
    this.plugins = new Map();
    this.hooks = new Map();
  }

  async loadPlugin(plugin, config) {
    if (typeof plugin.initialize === 'function') {
      await plugin.initialize(this.framework, config);
    }
    
    this.plugins.set(plugin.name, plugin);
    
    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        if (!this.hooks.has(hookName)) {
          this.hooks.set(hookName, []);
        }
        this.hooks.get(hookName).push(handler);
      }
    }
  }

  async loadPluginFromPath(path, config) {
    const plugin = await import(path);
    await this.loadPlugin(plugin.default || plugin, config);
  }

  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return;
    
    if (typeof plugin.destroy === 'function') {
      await plugin.destroy();
    }
    
    this.plugins.delete(name);
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  listPlugins() {
    return Array.from(this.plugins.values());
  }

  async executeHook(hookName, ...args) {
    const handlers = this.hooks.get(hookName) || [];
    
    for (const handler of handlers) {
      try {
        await handler(...args);
      } catch (error) {
        console.error(`Error executing hook ${hookName}:`, error);
      }
    }
  }
}