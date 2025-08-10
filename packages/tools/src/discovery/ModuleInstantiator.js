/**
 * Module Instantiator
 * 
 * Handles instantiation of all module types in the Legion framework.
 * Supports factory patterns, ResourceManager injection, and multiple fallback strategies.
 */

import path from 'path';
import { pathToFileURL } from 'url';

export class ModuleInstantiator {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.verbose = options.verbose || false;
    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 2;
    this.fallbackStrategies = options.fallbackStrategies || true;
    
    // Cache for instantiated modules
    this.moduleCache = new Map();
    this.failedModules = new Map();
    
    // Track instantiation statistics
    this.stats = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      cached: 0,
      retried: 0
    };
  }

  /**
   * Instantiate a module based on its metadata
   */
  async instantiate(moduleData, options = {}) {
    const cacheKey = this.getCacheKey(moduleData);
    
    // Check cache first
    if (this.moduleCache.has(cacheKey) && !options.forceNew) {
      this.stats.cached++;
      return this.moduleCache.get(cacheKey);
    }
    
    // Check if module previously failed
    if (this.failedModules.has(cacheKey) && !options.retry) {
      const failureInfo = this.failedModules.get(cacheKey);
      if (Date.now() - failureInfo.timestamp < 60000) { // 1 minute cooldown
        throw new Error(`Module previously failed: ${failureInfo.error}`);
      }
    }
    
    this.stats.attempted++;
    
    try {
      let instance = null;
      
      // Try instantiation based on module type
      switch (moduleData.type) {
        case 'class':
          instance = await this.instantiateClassModule(moduleData, options);
          break;
        
        case 'json':
          instance = await this.instantiateJsonModule(moduleData, options);
          break;
        
        case 'definition':
          instance = await this.instantiateDefinitionModule(moduleData, options);
          break;
        
        default:
          // Try to detect type and instantiate
          instance = await this.instantiateAutoDetect(moduleData, options);
      }
      
      if (instance) {
        this.stats.succeeded++;
        this.moduleCache.set(cacheKey, instance);
        this.failedModules.delete(cacheKey);
        return instance;
      }
      
      throw new Error(`Failed to instantiate module: ${moduleData.name}`);
      
    } catch (error) {
      this.stats.failed++;
      
      // Record failure
      this.failedModules.set(cacheKey, {
        error: error.message,
        timestamp: Date.now(),
        attempts: (this.failedModules.get(cacheKey)?.attempts || 0) + 1
      });
      
      // Try fallback strategies if enabled
      if (this.fallbackStrategies && !options.noFallback) {
        return await this.tryFallbackStrategies(moduleData, error);
      }
      
      throw error;
    }
  }

  /**
   * Instantiate a class-based module
   */
  async instantiateClassModule(moduleData, options = {}) {
    const modulePath = this.resolveModulePath(moduleData.path);
    
    if (this.verbose) {
      console.log(`  📦 Instantiating class module: ${moduleData.name}`);
    }
    
    try {
      // Dynamic import
      const moduleExports = await import(modulePath);
      const ModuleClass = moduleExports.default || moduleExports[moduleData.className];
      
      if (!ModuleClass) {
        throw new Error(`Module class not found: ${moduleData.className}`);
      }
      
      // Check if it has a factory method
      if (moduleData.hasFactory || (ModuleClass.create && typeof ModuleClass.create === 'function')) {
        // Use factory method - ALWAYS pass ResourceManager if available
        if (this.resourceManager) {
          return await ModuleClass.create(this.resourceManager, options.config || {});
        } else {
          return await ModuleClass.create(options.config || {});
        }
      }
      
      // Direct instantiation - ALWAYS pass ResourceManager if available
      if (this.resourceManager) {
        return new ModuleClass({ resourceManager: this.resourceManager, ...options.config });
      } else {
        return new ModuleClass(options.config || {});
      }
      
    } catch (error) {
      if (this.verbose) {
        console.log(`    ❌ Failed: ${error.message}`);
      }
      throw new Error(`Failed to instantiate class module ${moduleData.name}: ${error.message}`);
    }
  }

  /**
   * Instantiate a JSON-based module
   */
  async instantiateJsonModule(moduleData, options = {}) {
    if (this.verbose) {
      console.log(`  📋 Instantiating JSON module: ${moduleData.name}`);
    }
    
    try {
      const config = moduleData.metadata?.config || {};
      
      // If there's an implementation path, load it
      if (moduleData.implementationPath) {
        const implPath = this.resolveModulePath(moduleData.implementationPath);
        const moduleExports = await import(implPath);
        
        if (config.initialization) {
          const { className, treatAsConstructor } = config.initialization;
          const ModuleClass = moduleExports.default || moduleExports[className];
          
          if (ModuleClass) {
            if (treatAsConstructor) {
              return new ModuleClass(options.config || {});
            } else if (ModuleClass.create) {
              return await ModuleClass.create(this.resourceManager, options.config || {});
            }
          }
        }
        
        // Try default export
        if (moduleExports.default) {
          if (typeof moduleExports.default === 'function') {
            return new moduleExports.default(options.config || {});
          }
          return moduleExports.default;
        }
      }
      
      // Create a synthetic module from JSON config
      return this.createSyntheticModule(moduleData, config);
      
    } catch (error) {
      if (this.verbose) {
        console.log(`    ❌ Failed: ${error.message}`);
      }
      throw new Error(`Failed to instantiate JSON module ${moduleData.name}: ${error.message}`);
    }
  }

  /**
   * Instantiate a definition-based module
   */
  async instantiateDefinitionModule(moduleData, options = {}) {
    if (this.verbose) {
      console.log(`  🏗️ Instantiating definition module: ${moduleData.name}`);
    }
    
    try {
      const modulePath = this.resolveModulePath(moduleData.path);
      const moduleExports = await import(modulePath);
      const DefinitionClass = moduleExports.default || moduleExports[moduleData.className];
      
      if (!DefinitionClass) {
        throw new Error(`Definition class not found: ${moduleData.className}`);
      }
      
      // Definition modules typically have static create method
      if (DefinitionClass.create && typeof DefinitionClass.create === 'function') {
        if (this.resourceManager) {
          return await DefinitionClass.create(this.resourceManager, options.config || {});
        }
        return await DefinitionClass.create(options.config || {});
      }
      
      // Try to instantiate as provider
      if (DefinitionClass.getMetadata && typeof DefinitionClass.getMetadata === 'function') {
        // This is a module definition, create a provider
        return {
          definition: DefinitionClass,
          getMetadata: () => DefinitionClass.getMetadata(),
          getInstance: async () => {
            if (DefinitionClass.create) {
              return await DefinitionClass.create(this.resourceManager || {}, options.config || {});
            }
            return new DefinitionClass(options.config || {});
          }
        };
      }
      
      // Fallback to direct instantiation
      return new DefinitionClass(options.config || {});
      
    } catch (error) {
      if (this.verbose) {
        console.log(`    ❌ Failed: ${error.message}`);
      }
      throw new Error(`Failed to instantiate definition module ${moduleData.name}: ${error.message}`);
    }
  }

  /**
   * Auto-detect module type and instantiate
   */
  async instantiateAutoDetect(moduleData, options = {}) {
    if (this.verbose) {
      console.log(`  🔍 Auto-detecting module type: ${moduleData.name}`);
    }
    
    const modulePath = this.resolveModulePath(moduleData.path);
    
    try {
      const moduleExports = await import(modulePath);
      
      // Check for various patterns
      if (moduleExports.default) {
        const DefaultExport = moduleExports.default;
        
        // Check if it's a class
        if (typeof DefaultExport === 'function' && DefaultExport.prototype) {
          // It's a class
          if (DefaultExport.create) {
            if (this.resourceManager) {
              return await DefaultExport.create(this.resourceManager, options.config || {});
            } else {
              return await DefaultExport.create(options.config || {});
            }
          }
          if (this.resourceManager) {
            return new DefaultExport({ resourceManager: this.resourceManager, ...options.config });
          } else {
            return new DefaultExport(options.config || {});
          }
        }
        
        // Check if it's already an instance
        if (typeof DefaultExport === 'object') {
          return DefaultExport;
        }
        
        // Check if it's a factory function
        if (typeof DefaultExport === 'function') {
          if (this.resourceManager) {
            return await DefaultExport(this.resourceManager, options.config || {});
          } else {
            return await DefaultExport(options.config || {});
          }
        }
      }
      
      // Check for named exports
      const moduleNames = Object.keys(moduleExports);
      for (const name of moduleNames) {
        if (name.includes('Module') || name.includes(moduleData.name)) {
          const ModuleClass = moduleExports[name];
          if (typeof ModuleClass === 'function') {
            if (ModuleClass.create) {
              if (this.resourceManager) {
                return await ModuleClass.create(this.resourceManager, options.config || {});
              } else {
                return await ModuleClass.create(options.config || {});
              }
            }
            if (this.resourceManager) {
              return new ModuleClass({ resourceManager: this.resourceManager, ...options.config });
            } else {
              return new ModuleClass(options.config || {});
            }
          }
        }
      }
      
      throw new Error('Could not auto-detect module type');
      
    } catch (error) {
      if (this.verbose) {
        console.log(`    ❌ Auto-detect failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a synthetic module from JSON configuration
   */
  createSyntheticModule(moduleData, config) {
    const tools = config.tools || moduleData.tools || [];
    
    return {
      name: moduleData.name,
      type: 'synthetic',
      description: moduleData.description,
      
      getTools() {
        // Convert JSON tool definitions to tool objects
        return tools.map(toolDef => ({
          name: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.parameters,
          outputSchema: toolDef.output,
          
          async execute(params) {
            // This is a placeholder - actual execution would need implementation
            return {
              success: true,
              message: `Executed ${toolDef.name} (synthetic)`,
              data: params
            };
          }
        }));
      },
      
      getTool(name) {
        const tools = this.getTools();
        return tools.find(t => t.name === name);
      }
    };
  }

  /**
   * Try fallback strategies for failed modules
   */
  async tryFallbackStrategies(moduleData, originalError) {
    if (this.verbose) {
      console.log(`  🔄 Trying fallback strategies for ${moduleData.name}`);
    }
    
    // Strategy 1: Try without ResourceManager
    if (moduleData.needsResourceManager) {
      try {
        const instance = await this.instantiate(
          { ...moduleData, needsResourceManager: false },
          { noFallback: true }
        );
        if (instance) return instance;
      } catch {
        // Continue to next strategy
      }
    }
    
    // Strategy 2: Try to load from a different path
    if (moduleData.metadata?.alternativePaths) {
      for (const altPath of moduleData.metadata.alternativePaths) {
        try {
          const instance = await this.instantiate(
            { ...moduleData, path: altPath },
            { noFallback: true }
          );
          if (instance) return instance;
        } catch {
          // Continue to next path
        }
      }
    }
    
    // Strategy 3: Create a mock module with basic functionality
    if (moduleData.hasGetTools || moduleData.tools) {
      return this.createMockModule(moduleData);
    }
    
    // All strategies failed
    throw originalError;
  }

  /**
   * Create a mock module for fallback
   */
  createMockModule(moduleData) {
    if (this.verbose) {
      console.log(`  🎭 Creating mock module for ${moduleData.name}`);
    }
    
    return {
      name: moduleData.name,
      type: 'mock',
      description: moduleData.description,
      
      getTools() {
        // Return empty array or basic tool definitions
        if (moduleData.tools) {
          return moduleData.tools.map(t => ({
            name: t.name || 'unknown',
            description: t.description || 'Mock tool',
            async execute() {
              throw new Error(`Mock module ${moduleData.name}: tool execution not implemented`);
            }
          }));
        }
        return [];
      },
      
      getTool(name) {
        const tools = this.getTools();
        return tools.find(t => t.name === name);
      }
    };
  }

  /**
   * Resolve module path for import
   */
  resolveModulePath(modulePath) {
    // Convert relative paths to absolute
    if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
      // Check if it's already an absolute path
      if (path.isAbsolute(modulePath)) {
        return pathToFileURL(modulePath).href;
      }
      
      // Resolve relative to current module
      const currentDir = path.dirname(new URL(import.meta.url).pathname);
      const resolvedPath = path.resolve(currentDir, modulePath);
      return pathToFileURL(resolvedPath).href;
    }
    
    // Return as-is for package imports
    return modulePath;
  }

  /**
   * Get cache key for a module
   */
  getCacheKey(moduleData) {
    return `${moduleData.package}:${moduleData.name}:${moduleData.type}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.moduleCache.clear();
    this.failedModules.clear();
  }

  /**
   * Get instantiation statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.moduleCache.size,
      failedCount: this.failedModules.size,
      successRate: this.stats.attempted > 0 
        ? (this.stats.succeeded / this.stats.attempted * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Batch instantiate multiple modules
   */
  async instantiateBatch(modulesData, options = {}) {
    const results = {
      succeeded: [],
      failed: []
    };
    
    const promises = modulesData.map(async (moduleData) => {
      try {
        const instance = await this.instantiate(moduleData, options);
        results.succeeded.push({
          module: moduleData.name,
          instance
        });
      } catch (error) {
        results.failed.push({
          module: moduleData.name,
          error: error.message
        });
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }
}