/**
 * Tool Loader
 * 
 * Optimized tool loading with various strategies including lazy loading,
 * preloading, batch loading, and priority-based loading.
 */

import { ModuleRegistry } from './ModuleRegistry.js';

export class ToolLoader {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      strategy: options.strategy || 'lazy', // lazy, eager, hybrid, priority
      preloadModules: options.preloadModules || [],
      preloadTools: options.preloadTools || [],
      priorityTools: options.priorityTools || [],
      batchSize: options.batchSize || 10,
      parallel: options.parallel !== false,
      maxParallel: options.maxParallel || 5,
      timeout: options.timeout || 10000,
      retryOnFailure: options.retryOnFailure || false,
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // Module registry
    this.moduleRegistry = options.moduleRegistry || new ModuleRegistry({
      resourceManager: options.resourceManager,
      verbose: options.verbose,
      lazyLoading: this.options.strategy === 'lazy',
      autoDiscover: this.options.strategy !== 'manual'
    });
    
    // Loading state
    this.loadingQueue = [];
    this.loadingInProgress = new Set();
    this.loadedTools = new Set();
    this.failedTools = new Map();
    
    // Statistics
    this.stats = {
      toolsRequested: 0,
      toolsLoaded: 0,
      toolsFailed: 0,
      modulesLoaded: 0,
      loadTime: 0,
      queueSize: 0,
      retries: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the loader
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.options.verbose) {
      console.log(`🚀 Initializing ToolLoader with ${this.options.strategy} strategy...`);
    }
    
    const startTime = Date.now();
    
    // Initialize module registry
    await this.moduleRegistry.initialize();
    
    // Apply loading strategy
    switch (this.options.strategy) {
      case 'eager':
        await this.eagerLoad();
        break;
        
      case 'hybrid':
        await this.hybridLoad();
        break;
        
      case 'priority':
        await this.priorityLoad();
        break;
        
      case 'lazy':
      default:
        // Lazy loading - load on demand
        if (this.options.preloadModules.length > 0 || this.options.preloadTools.length > 0) {
          await this.preload();
        }
        break;
    }
    
    this.initialized = true;
    
    const loadTime = Date.now() - startTime;
    this.stats.loadTime = loadTime;
    
    if (this.options.verbose) {
      console.log(`✅ ToolLoader initialized in ${loadTime}ms`);
      console.log(`  Strategy: ${this.options.strategy}`);
      console.log(`  Modules loaded: ${this.stats.modulesLoaded}`);
      console.log(`  Tools loaded: ${this.stats.toolsLoaded}`);
    }
  }

  /**
   * Load a tool
   */
  async loadTool(toolName, options = {}) {
    this.stats.toolsRequested++;
    
    // Check if already loaded
    if (this.loadedTools.has(toolName) && !options.reload) {
      return await this.moduleRegistry.getTool(toolName, options);
    }
    
    // Check if previously failed
    if (this.failedTools.has(toolName) && !options.retry) {
      const failure = this.failedTools.get(toolName);
      if (Date.now() - failure.timestamp < 60000) { // 1 minute cooldown
        throw new Error(`Tool previously failed to load: ${failure.error}`);
      }
    }
    
    // Check if already loading
    if (this.loadingInProgress.has(toolName)) {
      return await this.waitForLoading(toolName);
    }
    
    // Start loading
    this.loadingInProgress.add(toolName);
    
    try {
      const tool = await this.loadToolWithRetry(toolName, options);
      
      if (tool) {
        this.loadedTools.add(toolName);
        this.stats.toolsLoaded++;
        this.failedTools.delete(toolName);
        
        if (this.options.verbose) {
          console.log(`✅ Loaded tool: ${toolName}`);
        }
      }
      
      return tool;
      
    } catch (error) {
      this.stats.toolsFailed++;
      
      this.failedTools.set(toolName, {
        error: error.message,
        timestamp: Date.now(),
        attempts: (this.failedTools.get(toolName)?.attempts || 0) + 1
      });
      
      if (this.options.verbose) {
        console.log(`❌ Failed to load tool ${toolName}: ${error.message}`);
      }
      
      throw error;
      
    } finally {
      this.loadingInProgress.delete(toolName);
    }
  }

  /**
   * Load tool with retry logic
   */
  async loadToolWithRetry(toolName, options) {
    let lastError = null;
    const maxAttempts = this.options.retryOnFailure ? this.options.maxRetries : 1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          this.stats.retries++;
          if (this.options.verbose) {
            console.log(`🔄 Retry ${attempt} for tool: ${toolName}`);
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
        
        // Load with timeout
        const tool = await this.withTimeout(
          this.moduleRegistry.getTool(toolName, options),
          this.options.timeout
        );
        
        return tool;
        
      } catch (error) {
        lastError = error;
      }
    }
    
    throw lastError;
  }

  /**
   * Load multiple tools
   */
  async loadTools(toolNames, options = {}) {
    if (this.options.parallel) {
      return await this.loadToolsParallel(toolNames, options);
    } else {
      return await this.loadToolsSequential(toolNames, options);
    }
  }

  /**
   * Load tools in parallel
   */
  async loadToolsParallel(toolNames, options = {}) {
    const results = {
      loaded: [],
      failed: []
    };
    
    // Process in batches to limit parallelism
    const batches = this.createBatches(toolNames, this.options.maxParallel);
    
    for (const batch of batches) {
      const promises = batch.map(async (toolName) => {
        try {
          const tool = await this.loadTool(toolName, options);
          results.loaded.push({ name: toolName, tool });
        } catch (error) {
          results.failed.push({ name: toolName, error: error.message });
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }

  /**
   * Load tools sequentially
   */
  async loadToolsSequential(toolNames, options = {}) {
    const results = {
      loaded: [],
      failed: []
    };
    
    for (const toolName of toolNames) {
      try {
        const tool = await this.loadTool(toolName, options);
        results.loaded.push({ name: toolName, tool });
      } catch (error) {
        results.failed.push({ name: toolName, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Load a module and all its tools
   */
  async loadModule(moduleName, options = {}) {
    try {
      const module = await this.moduleRegistry.loadModule(moduleName, options);
      this.stats.modulesLoaded++;
      
      // Get all tools from the module
      const tools = await this.moduleRegistry.getModuleTools(moduleName);
      
      for (const tool of tools) {
        this.loadedTools.add(tool.name);
        this.stats.toolsLoaded++;
      }
      
      if (this.options.verbose) {
        console.log(`✅ Loaded module ${moduleName} with ${tools.length} tools`);
      }
      
      return { module, tools };
      
    } catch (error) {
      if (this.options.verbose) {
        console.log(`❌ Failed to load module ${moduleName}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Eager loading strategy - load everything upfront
   */
  async eagerLoad() {
    if (this.options.verbose) {
      console.log('📦 Eager loading all modules...');
    }
    
    const modules = this.moduleRegistry.listModules();
    
    for (const moduleInfo of modules) {
      try {
        await this.loadModule(moduleInfo.name);
      } catch (error) {
        // Continue loading other modules even if one fails
        if (this.options.verbose) {
          console.log(`⚠️ Skipped module ${moduleInfo.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Hybrid loading strategy - preload common tools, lazy load others
   */
  async hybridLoad() {
    if (this.options.verbose) {
      console.log('🔀 Hybrid loading strategy...');
    }
    
    // Define common tools to preload
    const commonTools = [
      'file_read', 'file_write', 'directory_list', 'directory_create',
      'command_executor', 'json_parse', 'json_stringify',
      'calculator', 'http_request'
    ];
    
    // Combine with user-specified preload tools
    const toolsToPreload = [...new Set([...commonTools, ...this.options.preloadTools])];
    
    await this.loadTools(toolsToPreload, { ignoreErrors: true });
  }

  /**
   * Priority loading strategy - load based on priority
   */
  async priorityLoad() {
    if (this.options.verbose) {
      console.log('⭐ Priority-based loading...');
    }
    
    // Load priority tools first
    if (this.options.priorityTools.length > 0) {
      await this.loadTools(this.options.priorityTools, { ignoreErrors: true });
    }
    
    // Then load preload tools
    if (this.options.preloadTools.length > 0) {
      await this.loadTools(this.options.preloadTools, { ignoreErrors: true });
    }
  }

  /**
   * Preload specified modules and tools
   */
  async preload() {
    if (this.options.verbose) {
      console.log('📦 Preloading specified modules and tools...');
    }
    
    // Preload modules
    for (const moduleName of this.options.preloadModules) {
      try {
        await this.loadModule(moduleName);
      } catch (error) {
        if (this.options.verbose) {
          console.log(`⚠️ Failed to preload module ${moduleName}: ${error.message}`);
        }
      }
    }
    
    // Preload tools
    if (this.options.preloadTools.length > 0) {
      await this.loadTools(this.options.preloadTools, { ignoreErrors: true });
    }
  }

  /**
   * Get a tool (load if necessary)
   */
  async getTool(toolName, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return await this.loadTool(toolName, options);
  }

  /**
   * Get multiple tools
   */
  async getTools(toolNames, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return await this.loadTools(toolNames, options);
  }

  /**
   * List available tools
   */
  listTools(options = {}) {
    return this.moduleRegistry.listTools(options);
  }

  /**
   * Search for tools
   */
  searchTools(query, options = {}) {
    return this.moduleRegistry.searchTools(query, options);
  }

  /**
   * List available modules
   */
  listModules(options = {}) {
    return this.moduleRegistry.listModules(options);
  }

  /**
   * Search for modules
   */
  searchModules(query, options = {}) {
    return this.moduleRegistry.searchModules(query, options);
  }

  /**
   * Wait for a tool to finish loading
   */
  async waitForLoading(toolName) {
    const maxWait = this.options.timeout;
    const startTime = Date.now();
    
    while (this.loadingInProgress.has(toolName)) {
      if (Date.now() - startTime > maxWait) {
        throw new Error(`Timeout waiting for tool ${toolName} to load`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return await this.moduleRegistry.getTool(toolName);
  }

  /**
   * Execute with timeout
   */
  async withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.moduleRegistry.clearCache();
    this.loadedTools.clear();
    this.failedTools.clear();
    
    if (this.options.verbose) {
      console.log('🗑️ All caches cleared');
    }
  }

  /**
   * Reload a tool
   */
  async reloadTool(toolName) {
    this.loadedTools.delete(toolName);
    this.failedTools.delete(toolName);
    
    return await this.loadTool(toolName, { reload: true });
  }

  /**
   * Reload a module
   */
  async reloadModule(moduleName) {
    // Clear tools from this module
    const tools = await this.moduleRegistry.getModuleTools(moduleName);
    for (const tool of tools) {
      this.loadedTools.delete(tool.name);
      this.failedTools.delete(tool.name);
    }
    
    return await this.moduleRegistry.reloadModule(moduleName);
  }

  /**
   * Get loader statistics
   */
  getStats() {
    const registryStats = this.moduleRegistry.getStats();
    
    return {
      loader: {
        ...this.stats,
        strategy: this.options.strategy,
        loadedTools: this.loadedTools.size,
        failedTools: this.failedTools.size,
        queueSize: this.loadingQueue.length,
        inProgress: this.loadingInProgress.size
      },
      registry: registryStats,
      performance: {
        avgLoadTime: this.stats.toolsLoaded > 0 
          ? (this.stats.loadTime / this.stats.toolsLoaded).toFixed(2) + 'ms'
          : '0ms',
        successRate: this.stats.toolsRequested > 0
          ? (this.stats.toolsLoaded / this.stats.toolsRequested * 100).toFixed(2) + '%'
          : '0%',
        retryRate: this.stats.toolsRequested > 0
          ? (this.stats.retries / this.stats.toolsRequested * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  /**
   * Export loader configuration
   */
  exportConfig() {
    return {
      strategy: this.options.strategy,
      preloadModules: this.options.preloadModules,
      preloadTools: this.options.preloadTools,
      priorityTools: this.options.priorityTools,
      parallel: this.options.parallel,
      maxParallel: this.options.maxParallel,
      timeout: this.options.timeout,
      retryOnFailure: this.options.retryOnFailure,
      maxRetries: this.options.maxRetries
    };
  }
}