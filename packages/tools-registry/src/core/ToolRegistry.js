/**
 * ToolRegistry - Central registry for all tools
 * 
 * Manages tool lifecycle, caching, text search, and provides API for tool access
 * No mocks, no fallbacks - real implementation only
 */

import { EventEmitter } from 'events';
import { ModuleRegistry } from './ModuleRegistry.js';
import { DatabaseStorage } from './DatabaseStorage.js';
import {
  ToolNotFoundError,
  ToolLoadError,
  CacheError
} from '../errors/index.js';

export class ToolRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      cacheEnabled: true,
      verbose: false,
      ...options
    };
    
    this.moduleRegistry = options.moduleRegistry || new ModuleRegistry(options);
    this.databaseStorage = options.databaseStorage || new DatabaseStorage(options);
    
    // Tool cache - stores loaded tool instances with execute functions
    this.toolCache = new Map();
    
    // Metadata cache - stores tool metadata without execute functions
    this.metadataCache = new Map();
  }
  
  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @param {Object} options - Options (forceReload, etc)
   * @returns {Object|null} Tool with execute function or null
   */
  async getTool(name, options = {}) {
    // Check cache first (unless force reload or cache disabled)
    if (this.options.cacheEnabled && !options.forceReload) {
      if (this.toolCache.has(name)) {
        return this.toolCache.get(name);
      }
    }
    
    try {
      // Find tool in database
      const toolDoc = await this.databaseStorage.findTool(name);
      
      if (!toolDoc) {
        if (this.options.verbose) {
          console.log(`Tool not found: ${name}`);
        }
        return null;
      }
      
      // Get module instance to access execute function
      const module = await this.moduleRegistry.getModule(toolDoc.moduleName);
      
      if (!module) {
        if (this.options.verbose) {
          console.log(`Module not found for tool ${name}: ${toolDoc.moduleName}`);
        }
        return null;
      }
      
      // Find the tool in the module
      const moduleTools = module.getTools ? module.getTools() : [];
      const moduleTool = moduleTools.find(t => t.name === name);
      
      if (!moduleTool) {
        if (this.options.verbose) {
          console.log(`Tool ${name} not found in module ${toolDoc.moduleName}`);
        }
        return null;
      }
      
      // Combine database metadata with module execute function
      const tool = {
        ...toolDoc,
        execute: moduleTool.execute,
        // Override with module's current metadata if available
        description: moduleTool.description || toolDoc.description,
        inputSchema: moduleTool.inputSchema || toolDoc.inputSchema,
        outputSchema: moduleTool.outputSchema || toolDoc.outputSchema
      };
      
      // Cache the tool if caching is enabled
      if (this.options.cacheEnabled) {
        this.toolCache.set(name, tool);
      }
      
      // Emit event
      this.emit('tool:loaded', {
        name: name,
        tool: tool
      });
      
      return tool;
      
    } catch (error) {
      if (this.options.verbose) {
        console.error(`Error loading tool ${name}:`, error);
      }
      return null;
    }
  }
  
  /**
   * Get tool by database ID
   * @param {string} toolId - Tool database ID
   * @param {Object} options - Options (forceReload)
   * @returns {Object|null} Tool with execute function
   */
  async getToolById(toolId, options = {}) {
    // First try to find the tool in the database by ID
    const toolsCollection = this.databaseStorage.getCollection('tools');
    const toolDoc = await toolsCollection.findOne({ 
      _id: toolId.toString ? toolId.toString() : toolId 
    });
    
    if (!toolDoc) {
      if (this.options.verbose) {
        console.log(`Tool not found by ID: ${toolId}`);
      }
      return null;
    }
    
    // Now use the existing getTool method with the name
    return await this.getTool(toolDoc.name, options);
  }

  /**
   * Get multiple tools by names
   * @param {Array<string>} names - Tool names
   * @returns {Array} Array of tools (excludes failed ones)
   */
  async getTools(names) {
    const tools = [];
    
    for (const name of names) {
      const tool = await this.getTool(name);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }
  
  /**
   * Get all tools from database
   * @returns {Array} Array of all tools with execute functions
   */
  async getAllTools() {
    const toolDocs = await this.databaseStorage.findTools({});
    const tools = [];
    
    for (const toolDoc of toolDocs) {
      const tool = await this.getTool(toolDoc.name);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }
  
  /**
   * Find tools by pattern or filter
   * @param {RegExp|Function} filter - Pattern or filter function
   * @returns {Array} Matching tools
   */
  async findTools(filter) {
    const allTools = await this.getAllTools();
    
    if (filter instanceof RegExp) {
      return allTools.filter(tool => filter.test(tool.name));
    } else if (typeof filter === 'function') {
      return allTools.filter(filter);
    }
    
    return [];
  }
  
  /**
   * Search tools using text search
   * @param {string} query - Search query
   * @param {Object} options - Search options (limit, etc)
   * @returns {Array} Matching tools
   */
  async searchTools(query, options = {}) {
    const toolsCollection = this.databaseStorage.getCollection('tools');
    
    // Build search query
    const searchQuery = {
      $text: { $search: query }
    };
    
    // Execute search
    let cursor = toolsCollection.find(searchQuery);
    
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    
    const results = await cursor.toArray();
    
    // Load full tools with execute functions
    const tools = [];
    for (const result of results) {
      const tool = await this.getTool(result.name);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }
  
  /**
   * Get all tools from a specific module
   * @param {string} moduleName - Module name
   * @returns {Array} Tools from module
   */
  async getToolsByModule(moduleName) {
    const toolDocs = await this.databaseStorage.findTools({ moduleName });
    const tools = [];
    
    for (const toolDoc of toolDocs) {
      const tool = await this.getTool(toolDoc.name);
      if (tool) {
        tools.push(tool);
      }
    }
    
    return tools;
  }
  
  /**
   * Check if tool exists
   * @param {string} name - Tool name
   * @returns {boolean} True if exists
   */
  async hasTool(name) {
    // Check cache first
    if (this.toolCache.has(name)) {
      return true;
    }
    
    // Check database
    const tool = await this.databaseStorage.findTool(name);
    return tool !== null;
  }
  
  /**
   * Refresh a tool by reloading from module
   * @param {string} name - Tool name
   * @returns {Object|null} Refreshed tool
   */
  async refreshTool(name) {
    // Clear from cache
    if (this.toolCache.has(name)) {
      this.toolCache.delete(name);
    }
    
    // Clear from metadata cache
    if (this.metadataCache.has(name)) {
      this.metadataCache.delete(name);
    }
    
    // Find tool in database to get module name
    const toolDoc = await this.databaseStorage.findTool(name);
    
    if (!toolDoc) {
      return null;
    }
    
    // Reload module to ensure fresh tool definition
    await this.moduleRegistry.reloadModule(toolDoc.moduleName);
    
    // Reload tool with force flag
    return await this.getTool(name, { forceReload: true });
  }
  
  /**
   * Get tool statistics
   * @returns {Object} Statistics
   */
  async getStatistics() {
    const toolsCollection = this.databaseStorage.getCollection('tools');
    const total = await toolsCollection.countDocuments();
    
    // Get module breakdown
    const byModule = {};
    const toolDocs = await this.databaseStorage.findTools({});
    
    for (const toolDoc of toolDocs) {
      if (!byModule[toolDoc.moduleName]) {
        byModule[toolDoc.moduleName] = 0;
      }
      byModule[toolDoc.moduleName]++;
    }
    
    return {
      total: total,
      cached: this.toolCache.size,
      byModule: byModule
    };
  }
  
  /**
   * Get tool cache
   * @returns {Map} Tool cache
   */
  getCache() {
    return this.toolCache;
  }
  
  /**
   * Clear tool cache
   */
  clearCache() {
    this.toolCache.clear();
    this.metadataCache.clear();
    
    // Emit event
    this.emit('cache:cleared');
  }
  
  /**
   * Get tool metadata without loading execute function
   * @param {string} name - Tool name
   * @returns {Object|null} Tool metadata
   */
  async getToolMetadata(name) {
    // Check metadata cache first
    if (this.metadataCache.has(name)) {
      return this.metadataCache.get(name);
    }
    
    // Get from database
    const metadata = await this.databaseStorage.findTool(name);
    
    if (metadata) {
      // Cache metadata
      this.metadataCache.set(name, metadata);
      return metadata;
    }
    
    return null;
  }
  
  /**
   * Initialize the registry (create indexes, etc)
   */
  async initialize() {
    // Create text index for search
    const toolsCollection = this.databaseStorage.getCollection('tools');
    
    try {
      await toolsCollection.createIndex(
        { name: 'text', description: 'text' },
        { name: 'tool_text_index' }
      );
      
      if (this.options.verbose) {
        console.log('Created text index for tools collection');
      }
    } catch (error) {
      // Index might already exist
      if (this.options.verbose) {
        console.log('Text index already exists or creation failed:', error.message);
      }
    }
    
    // Initialize module registry if needed
    if (typeof this.moduleRegistry.initialize === 'function') {
      await this.moduleRegistry.initialize();
    }
    
    this.emit('registry:initialized');
  }
  
  /**
   * Shutdown the registry (close connections, cleanup)
   */
  async shutdown() {
    // Clear caches
    this.clearCache();
    
    // Shutdown module registry if needed
    if (typeof this.moduleRegistry.shutdown === 'function') {
      await this.moduleRegistry.shutdown();
    }
    
    this.emit('registry:shutdown');
  }
}