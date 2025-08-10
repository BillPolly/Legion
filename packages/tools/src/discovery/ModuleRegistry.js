/**
 * Module Registry
 * 
 * Central registry for all discovered modules.
 * Provides efficient lookup, caching, lifecycle management, and dependency resolution.
 */

import { ModuleDiscoveryService } from './ModuleDiscoveryService.js';
import { ModuleInstantiator } from './ModuleInstantiator.js';
import { ToolExtractor } from './ToolExtractor.js';
import { ToolAdapter } from './ToolAdapter.js';

export class ModuleRegistry {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour
      maxCacheSize: options.maxCacheSize || 100,
      lazyLoading: options.lazyLoading !== false,
      autoDiscover: options.autoDiscover !== false,
      ...options
    };
    
    // Core services
    this.resourceManager = options.resourceManager;
    this.discoveryService = new ModuleDiscoveryService(options);
    this.instantiator = new ModuleInstantiator({
      resourceManager: this.resourceManager,
      ...options
    });
    this.toolExtractor = new ToolExtractor(options);
    this.toolAdapter = new ToolAdapter(options);
    
    // Registries
    this.modules = new Map();        // module name -> module metadata
    this.instances = new Map();      // module name -> module instance
    this.tools = new Map();          // tool name -> tool object
    this.toolsByModule = new Map();  // module name -> Set of tool names
    this.aliases = new Map();        // alias -> module/tool name
    
    // Caching
    this.cache = {
      modules: new Map(),
      tools: new Map(),
      timestamps: new Map()
    };
    
    // Statistics
    this.stats = {
      modulesDiscovered: 0,
      modulesLoaded: 0,
      modulesFailed: 0,
      toolsDiscovered: 0,
      toolsLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.options.verbose) {
      console.log('🏗️ Initializing Module Registry...');
    }
    
    // Auto-discover modules if enabled
    if (this.options.autoDiscover) {
      await this.discoverModules();
    }
    
    this.initialized = true;
    
    if (this.options.verbose) {
      console.log('✅ Module Registry initialized');
      console.log(`  Modules: ${this.modules.size}`);
      console.log(`  Tools: ${this.tools.size}`);
    }
  }

  /**
   * Discover all modules in the repository
   */
  async discoverModules(rootPath = null) {
    if (this.options.verbose) {
      console.log('🔍 Discovering modules...');
    }
    
    // Use provided path or find Legion root
    const searchPath = rootPath || await this.findLegionRoot();
    
    // Discover modules
    const discoveredModules = await this.discoveryService.discoverModules(searchPath);
    this.stats.modulesDiscovered = discoveredModules.length;
    
    // Register discovered modules
    for (const moduleData of discoveredModules) {
      this.registerModule(moduleData);
    }
    
    if (this.options.verbose) {
      const stats = this.discoveryService.getStats();
      console.log(`✅ Discovery complete:`);
      console.log(`  Found: ${stats.total} modules`);
      console.log(`  Types: ${JSON.stringify(stats.byType)}`);
      if (stats.errors > 0) {
        console.log(`  Errors: ${stats.errors}`);
      }
    }
    
    return discoveredModules;
  }

  /**
   * Register a module
   */
  registerModule(moduleData) {
    const key = this.getModuleKey(moduleData);
    
    // Store metadata
    this.modules.set(key, {
      ...moduleData,
      registered: Date.now(),
      loaded: false,
      tools: []
    });
    
    // Register aliases
    if (moduleData.aliases) {
      for (const alias of moduleData.aliases) {
        this.aliases.set(alias, key);
      }
    }
    
    // Also register by simple name
    this.modules.set(moduleData.name, moduleData);
    
    return key;
  }

  /**
   * Load a module and its tools
   */
  async loadModule(moduleName, options = {}) {
    // Check if already loaded
    if (this.instances.has(moduleName) && !options.force) {
      this.stats.cacheHits++;
      return this.instances.get(moduleName);
    }
    
    this.stats.cacheMisses++;
    
    // Resolve aliases
    const resolvedName = this.aliases.get(moduleName) || moduleName;
    
    // Get module metadata
    const moduleData = this.modules.get(resolvedName);
    if (!moduleData) {
      throw new Error(`Module not found: ${moduleName}`);
    }
    
    if (this.options.verbose) {
      console.log(`📦 Loading module: ${moduleData.name}`);
    }
    
    try {
      // Instantiate module
      const instance = await this.instantiator.instantiate(moduleData, options);
      
      if (!instance) {
        throw new Error(`Failed to instantiate module: ${moduleData.name}`);
      }
      
      // Store instance
      this.instances.set(resolvedName, instance);
      this.instances.set(moduleData.name, instance);
      
      // Extract and register tools
      const tools = await this.toolExtractor.extractTools(instance, moduleData);
      
      if (tools.length > 0) {
        const toolNames = new Set();
        
        for (const tool of tools) {
          // Adapt tool to unified interface
          const adaptedTool = this.toolAdapter.adaptTool(tool, {
            moduleName: moduleData.name,
            moduleType: moduleData.type
          });
          
          // Register tool
          this.registerTool(adaptedTool, moduleData.name);
          toolNames.add(adaptedTool.name);
        }
        
        // Store module-tool mapping
        this.toolsByModule.set(moduleData.name, toolNames);
        
        if (this.options.verbose) {
          console.log(`  ✅ Loaded ${tools.length} tools`);
        }
      }
      
      // Update metadata
      moduleData.loaded = true;
      moduleData.tools = Array.from(this.toolsByModule.get(moduleData.name) || []);
      
      this.stats.modulesLoaded++;
      
      return instance;
      
    } catch (error) {
      this.stats.modulesFailed++;
      
      if (this.options.verbose) {
        console.log(`  ❌ Failed to load: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Register a tool
   */
  registerTool(tool, moduleName) {
    // Store tool
    this.tools.set(tool.name, tool);
    
    // Store module association
    if (!this.toolsByModule.has(moduleName)) {
      this.toolsByModule.set(moduleName, new Set());
    }
    this.toolsByModule.get(moduleName).add(tool.name);
    
    // Register aliases if provided
    if (tool.aliases) {
      for (const alias of tool.aliases) {
        this.aliases.set(alias, tool.name);
      }
    }
    
    this.stats.toolsLoaded++;
  }

  /**
   * Get a module instance
   */
  async getModule(moduleName, options = {}) {
    // Check cache first
    if (this.isCacheValid(moduleName, 'module')) {
      this.stats.cacheHits++;
      return this.cache.modules.get(moduleName);
    }
    
    // Load if needed
    if (!this.instances.has(moduleName) || options.reload) {
      await this.loadModule(moduleName, options);
    }
    
    const instance = this.instances.get(moduleName);
    
    // Update cache
    if (instance) {
      this.updateCache(moduleName, instance, 'module');
    }
    
    return instance;
  }

  /**
   * Get a tool
   */
  async getTool(toolName, options = {}) {
    // Resolve aliases
    const resolvedName = this.aliases.get(toolName) || toolName;
    
    // Check cache first
    if (this.isCacheValid(resolvedName, 'tool')) {
      this.stats.cacheHits++;
      return this.cache.tools.get(resolvedName);
    }
    
    // Check if tool is already loaded
    if (this.tools.has(resolvedName)) {
      const tool = this.tools.get(resolvedName);
      this.updateCache(resolvedName, tool, 'tool');
      return tool;
    }
    
    // Try to find and load the module containing this tool
    if (this.options.lazyLoading) {
      const moduleForTool = await this.findModuleForTool(resolvedName);
      
      if (moduleForTool) {
        await this.loadModule(moduleForTool, options);
        
        if (this.tools.has(resolvedName)) {
          const tool = this.tools.get(resolvedName);
          this.updateCache(resolvedName, tool, 'tool');
          return tool;
        }
      }
    }
    
    return null;
  }

  /**
   * Get all tools for a module
   */
  async getModuleTools(moduleName) {
    // Ensure module is loaded
    await this.getModule(moduleName);
    
    const toolNames = this.toolsByModule.get(moduleName);
    if (!toolNames) return [];
    
    const tools = [];
    for (const toolName of toolNames) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }

  /**
   * Find module that contains a tool
   */
  async findModuleForTool(toolName) {
    // Check already loaded modules
    for (const [moduleName, toolNames] of this.toolsByModule) {
      if (toolNames.has(toolName)) {
        return moduleName;
      }
    }
    
    // Search in module metadata
    for (const [moduleName, moduleData] of this.modules) {
      if (moduleData.tools && moduleData.tools.includes(toolName)) {
        return moduleName;
      }
    }
    
    // Try to discover if not found
    if (this.options.autoDiscover && !this.discoveryAttempted) {
      this.discoveryAttempted = true;
      await this.discoverModules();
      return this.findModuleForTool(toolName);
    }
    
    return null;
  }

  /**
   * List all modules
   */
  listModules(options = {}) {
    const modules = [];
    
    for (const [name, metadata] of this.modules) {
      // Skip duplicates (same module registered under different keys)
      if (name !== metadata.name && this.modules.has(metadata.name)) {
        continue;
      }
      
      if (options.loaded && !metadata.loaded) continue;
      if (options.type && metadata.type !== options.type) continue;
      if (options.package && metadata.package !== options.package) continue;
      
      modules.push({
        name: metadata.name,
        type: metadata.type,
        loaded: metadata.loaded,
        package: metadata.package,
        description: metadata.description,
        toolCount: metadata.tools?.length || 0
      });
    }
    
    return modules;
  }

  /**
   * List all tools
   */
  listTools(options = {}) {
    const tools = [];
    
    for (const [name, tool] of this.tools) {
      if (options.module && tool.moduleName !== options.module) continue;
      if (options.category && tool.category !== options.category) continue;
      if (options.tags && !options.tags.some(tag => tool.tags?.includes(tag))) continue;
      
      tools.push({
        name: tool.name,
        module: tool.moduleName,
        description: tool.description,
        category: tool.category,
        tags: tool.tags || []
      });
    }
    
    return tools;
  }

  /**
   * Search for modules
   */
  searchModules(query, options = {}) {
    const results = [];
    const searchLower = query.toLowerCase();
    
    for (const [name, metadata] of this.modules) {
      // Skip duplicates
      if (name !== metadata.name && this.modules.has(metadata.name)) {
        continue;
      }
      
      // Search in name and description
      const nameMatch = metadata.name.toLowerCase().includes(searchLower);
      const descMatch = metadata.description?.toLowerCase().includes(searchLower);
      const tagMatch = metadata.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      
      if (nameMatch || descMatch || tagMatch) {
        results.push({
          name: metadata.name,
          type: metadata.type,
          loaded: metadata.loaded,
          description: metadata.description,
          relevance: nameMatch ? 1.0 : (descMatch ? 0.7 : 0.5)
        });
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    if (options.limit) {
      return results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * Search for tools
   */
  searchTools(query, options = {}) {
    const results = [];
    const searchLower = query.toLowerCase();
    
    for (const [name, tool] of this.tools) {
      // Search in name, description, and tags
      const nameMatch = tool.name.toLowerCase().includes(searchLower);
      const descMatch = tool.description?.toLowerCase().includes(searchLower);
      const tagMatch = tool.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      
      if (nameMatch || descMatch || tagMatch) {
        results.push({
          name: tool.name,
          module: tool.moduleName,
          description: tool.description,
          category: tool.category,
          tags: tool.tags || [],
          relevance: nameMatch ? 1.0 : (descMatch ? 0.7 : 0.5)
        });
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    if (options.limit) {
      return results.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * Reload a module
   */
  async reloadModule(moduleName) {
    // Clear instances and tools
    this.instances.delete(moduleName);
    
    const toolNames = this.toolsByModule.get(moduleName);
    if (toolNames) {
      for (const toolName of toolNames) {
        this.tools.delete(toolName);
      }
      this.toolsByModule.delete(moduleName);
    }
    
    // Clear cache
    this.cache.modules.delete(moduleName);
    
    // Reload
    return await this.loadModule(moduleName, { force: true });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.modules.clear();
    this.cache.tools.clear();
    this.cache.timestamps.clear();
    
    if (this.options.verbose) {
      console.log('🗑️ Cache cleared');
    }
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(key, type) {
    if (!this.options.cacheTTL) return false;
    
    const timestamp = this.cache.timestamps.get(`${type}:${key}`);
    if (!timestamp) return false;
    
    return Date.now() - timestamp < this.options.cacheTTL;
  }

  /**
   * Update cache
   */
  updateCache(key, value, type) {
    const cache = type === 'module' ? this.cache.modules : this.cache.tools;
    
    // Enforce max cache size
    if (cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
      this.cache.timestamps.delete(`${type}:${firstKey}`);
    }
    
    cache.set(key, value);
    this.cache.timestamps.set(`${type}:${key}`, Date.now());
  }

  /**
   * Get module key
   */
  getModuleKey(moduleData) {
    return `${moduleData.package}:${moduleData.name}`;
  }

  /**
   * Find Legion root directory
   */
  async findLegionRoot() {
    const path = await import('path');
    const fs = await import('fs');
    
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === '@legion/monorepo' || 
              (packageJson.workspaces && packageJson.workspaces.includes('packages/*'))) {
            return currentDir;
          }
        } catch (error) {
          // Invalid package.json, continue searching
        }
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentState: {
        modules: this.modules.size,
        loadedModules: Array.from(this.modules.values()).filter(m => m.loaded).length,
        instances: this.instances.size,
        tools: this.tools.size,
        aliases: this.aliases.size,
        cacheSize: this.cache.modules.size + this.cache.tools.size
      },
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%'
        : '0%',
      moduleSuccessRate: this.stats.modulesLoaded + this.stats.modulesFailed > 0
        ? (this.stats.modulesLoaded / (this.stats.modulesLoaded + this.stats.modulesFailed) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Export registry data
   */
  exportData() {
    const data = {
      modules: [],
      tools: [],
      statistics: this.getStats()
    };
    
    // Export modules
    for (const [name, metadata] of this.modules) {
      if (name === metadata.name) {
        data.modules.push({
          ...metadata,
          instance: undefined // Don't export instances
        });
      }
    }
    
    // Export tools
    for (const [name, tool] of this.tools) {
      data.tools.push({
        name: tool.name,
        module: tool.moduleName,
        description: tool.description,
        category: tool.category,
        tags: tool.tags,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      });
    }
    
    return data;
  }
}