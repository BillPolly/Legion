import { Plugin, PluginContext, PluginFrameworkAPI, PluginMetadata, PluginManager as IPluginManager } from './types';
import { LLMCLIFramework } from '../../core/framework/LLMCLIFramework';
import * as path from 'path';

interface LoadedPlugin {
  plugin: Plugin;
  config: Record<string, any>;
  context: PluginContext;
}

export class PluginManager implements IPluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private framework: LLMCLIFramework;

  constructor(framework: LLMCLIFramework) {
    this.framework = framework;
  }

  async loadPlugin(plugin: Plugin, config?: Record<string, any>): Promise<void> {
    const { name } = plugin.metadata;

    // Check if already loaded
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is already loaded`);
    }

    // Validate dependencies
    await this.validateDependencies(plugin.metadata);

    // Create plugin context
    const context = this.createPluginContext(plugin, config);

    try {
      // Initialize plugin
      await plugin.initialize(context);

      // Store plugin
      this.plugins.set(name, {
        plugin,
        config: config || {},
        context
      });
    } catch (error) {
      // Clean up on failure
      throw error;
    }
  }

  async loadPluginFromPath(pluginPath: string, config?: Record<string, any>): Promise<void> {
    try {
      // Load plugin module
      const module = require(pluginPath);
      
      // Get plugin from module (support both default and named exports)
      const plugin: Plugin = module.default || module.plugin || module;

      // Validate plugin structure
      if (!plugin || !plugin.metadata || !plugin.initialize) {
        throw new Error('Invalid plugin');
      }

      await this.loadPlugin(plugin, config);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid plugin') {
        throw error;
      }
      throw new Error(`Failed to load plugin from ${pluginPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const loaded = this.plugins.get(name);
    if (!loaded) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    // Check for dependents
    const dependents = this.findDependents(name);
    if (dependents.length > 0) {
      throw new Error(`Cannot unload plugin with dependents: ${dependents.join(', ')}`);
    }

    // Call cleanup if available
    if (loaded.plugin.cleanup) {
      await loaded.plugin.cleanup(loaded.context);
    }

    // Remove plugin
    this.plugins.delete(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  listPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(loaded => loaded.plugin.metadata);
  }

  isLoaded(name: string): boolean {
    return this.plugins.has(name);
  }

  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    const promises = Array.from(this.plugins.values()).map(async ({ plugin, context }) => {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        try {
          await hook.call(plugin, ...args, context);
        } catch (error) {
          console.error(`Error in plugin ${plugin.metadata.name} hook ${hookName}:`, error);
          // Continue with other plugins
        }
      }
    });

    await Promise.all(promises);
  }

  getPluginConfig(name: string): Record<string, any> | undefined {
    return this.plugins.get(name)?.config;
  }

  setPluginConfig(name: string, config: Record<string, any>): void {
    const loaded = this.plugins.get(name);
    if (!loaded) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    loaded.config = config;
    loaded.context.pluginConfig = config;
  }

  private createPluginContext(plugin: Plugin, config?: Record<string, any>): PluginContext {
    const frameworkAPI: PluginFrameworkAPI = {
      getConfig: () => this.framework.getConfig(),
      getSession: () => this.framework.getSession(),
      registerCommand: (name, command) => this.framework.registerCommand(name, command),
      unregisterCommand: (name) => this.framework.unregisterCommand(name),
      addContextProvider: (provider) => this.framework.addContextProvider(provider),
      removeContextProvider: (name) => this.framework.removeContextProvider(name),
      getPlugin: (name) => this.getPlugin(name),
      callPlugin: async (name, method, ...args) => {
        const targetPlugin = this.getPlugin(name);
        if (!targetPlugin) {
          throw new Error(`Plugin ${name} not found`);
        }
        
        const targetMethod = targetPlugin[method];
        if (typeof targetMethod !== 'function') {
          throw new Error(`Method ${method} not found in plugin ${name}`);
        }

        return await targetMethod.call(targetPlugin, ...args);
      }
    };

    return {
      framework: frameworkAPI,
      pluginConfig: config,
      logger: {
        debug: (message, ...args) => console.debug(`[${plugin.metadata.name}]`, message, ...args),
        info: (message, ...args) => console.log(`[${plugin.metadata.name}]`, message, ...args),
        warn: (message, ...args) => console.warn(`[${plugin.metadata.name}]`, message, ...args),
        error: (message, ...args) => console.error(`[${plugin.metadata.name}]`, message, ...args)
      }
    };
  }

  private async validateDependencies(metadata: PluginMetadata): Promise<void> {
    if (!metadata.dependencies || metadata.dependencies.length === 0) {
      return;
    }

    for (const dep of metadata.dependencies) {
      const [depName, versionSpec] = this.parseDependency(dep);
      
      if (!this.isLoaded(depName)) {
        throw new Error(`Missing dependency: ${depName}`);
      }

      // TODO: Implement version checking
      // For now, just check if the plugin is loaded
    }
  }

  private parseDependency(dep: string): [string, string] {
    const match = dep.match(/^(.+?)@(.+)$/);
    if (match) {
      return [match[1], match[2]];
    }
    return [dep, '*'];
  }

  private findDependents(pluginName: string): string[] {
    const dependents: string[] = [];

    for (const [name, loaded] of this.plugins) {
      const deps = loaded.plugin.metadata.dependencies || [];
      
      for (const dep of deps) {
        const [depName] = this.parseDependency(dep);
        if (depName === pluginName) {
          dependents.push(name);
          break;
        }
      }
    }

    return dependents;
  }
}