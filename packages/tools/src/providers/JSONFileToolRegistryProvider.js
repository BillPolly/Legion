/**
 * JSON File Tool Registry Provider
 * 
 * File-based implementation of the Tool Registry Provider interface.
 * Provides backward compatibility with the existing JSON file-based approach
 * while implementing the standard provider interface.
 */

import fs from 'fs/promises';
import path from 'path';
import { IToolRegistryProvider, PROVIDER_CAPABILITIES } from './IToolRegistryProvider.js';

export class JSONFileToolRegistryProvider extends IToolRegistryProvider {
  constructor(config = {}) {
    super(config);
    
    this.toolsDatabasePath = config.toolsDatabasePath || new URL('../integration/tools-database.json', import.meta.url).pathname;
    this.modules = new Map();
    this.tools = new Map();
    this.usageStats = new Map();
    this.lastModified = null;
  }

  /**
   * Static factory method
   */
  static async create(config = {}) {
    const provider = new JSONFileToolRegistryProvider(config);
    await provider.initialize();
    return provider;
  }

  /**
   * Initialize the provider by loading JSON data
   */
  async initialize() {
    if (this.initialized) return;

    console.log('📄 Initializing JSON File Tool Registry Provider...');

    try {
      await this.loadFromFile();
      this.initialized = true;
      this.connected = true;
      console.log(`✅ JSON File Provider initialized with ${this.modules.size} modules`);
    } catch (error) {
      console.error('❌ Failed to initialize JSON File Provider:', error);
      throw error;
    }
  }

  /**
   * Connect (no-op for file provider)
   */
  async connect() {
    this.connected = true;
  }

  /**
   * Disconnect (no-op for file provider)
   */
  async disconnect() {
    this.connected = false;
  }

  /**
   * Load data from JSON file
   */
  async loadFromFile() {
    try {
      const data = await fs.readFile(this.toolsDatabasePath, 'utf-8');
      const toolsDatabase = JSON.parse(data);
      
      // Clear existing data
      this.modules.clear();
      this.tools.clear();

      // Load modules
      if (toolsDatabase.modules) {
        for (const [moduleName, moduleData] of Object.entries(toolsDatabase.modules)) {
          const processedModule = {
            name: moduleName,
            description: moduleData.description || `${moduleName} module`,
            version: moduleData.version || '1.0.0',
            path: moduleData.path,
            className: moduleData.className,
            type: moduleData.type || 'class',
            dependencies: moduleData.dependencies || [],
            tags: moduleData.tags || [moduleName],
            category: this.inferModuleCategory(moduleName),
            status: 'active',
            toolCount: Object.keys(moduleData.tools || {}).length,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          this.modules.set(moduleName, processedModule);

          // Load tools for this module
          if (moduleData.tools) {
            for (const [toolName, toolData] of Object.entries(moduleData.tools)) {
              const processedTool = {
                name: toolName,
                moduleName: moduleName,
                description: toolData.description || `${toolName} tool`,
                summary: toolData.description?.substring(0, 200),
                inputSchema: toolData.inputSchema || toolData.schema,
                outputSchema: toolData.outputSchema,
                examples: toolData.examples || [],
                tags: this.inferToolTags(toolName, toolData.description),
                category: this.inferToolCategory(toolName),
                complexity: 'simple',
                permissions: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
              };

              const toolKey = `${moduleName}.${toolName}`;
              this.tools.set(toolKey, processedTool);
            }
          }
        }
      }

      // Update last modified time
      const stats = await fs.stat(this.toolsDatabasePath);
      this.lastModified = stats.mtime;

      console.log(`📦 Loaded ${this.modules.size} modules and ${this.tools.size} tools from JSON file`);

    } catch (error) {
      console.error('Failed to load tools database from file:', error);
      throw error;
    }
  }

  /**
   * Check if file has been modified and reload if necessary
   */
  async checkAndReload() {
    try {
      const stats = await fs.stat(this.toolsDatabasePath);
      if (this.lastModified && stats.mtime > this.lastModified) {
        console.log('📄 Tools database file modified, reloading...');
        await this.loadFromFile();
      }
    } catch (error) {
      console.warn('Failed to check file modification time:', error.message);
    }
  }

  // ============================================================================
  // MODULE OPERATIONS
  // ============================================================================

  /**
   * Get module by name
   */
  async getModule(name) {
    await this.checkAndReload();
    return this.modules.get(name) || null;
  }

  /**
   * List all modules with optional filtering
   */
  async listModules(options = {}) {
    await this.checkAndReload();
    
    let modules = Array.from(this.modules.values());

    if (options.status) {
      modules = modules.filter(m => m.status === options.status);
    }
    if (options.category) {
      modules = modules.filter(m => m.category === options.category);
    }
    if (options.tags) {
      modules = modules.filter(m => 
        options.tags.some(tag => (m.tags || []).includes(tag))
      );
    }

    if (options.sort) {
      // Simple sorting by field name
      const sortField = Object.keys(options.sort)[0];
      const sortDirection = options.sort[sortField];
      modules.sort((a, b) => {
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        return sortDirection === -1 ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    }

    if (options.skip) modules = modules.slice(options.skip);
    if (options.limit) modules = modules.slice(0, options.limit);

    return modules;
  }

  /**
   * Save or update a module (not implemented for read-only JSON provider)
   */
  async saveModule(moduleData) {
    throw new Error('JSONFileToolRegistryProvider is read-only. Use MongoDB provider for write operations.');
  }

  /**
   * Delete a module (not implemented for read-only JSON provider)
   */
  async deleteModule(name) {
    throw new Error('JSONFileToolRegistryProvider is read-only. Use MongoDB provider for write operations.');
  }

  /**
   * Search modules by text
   */
  async searchModules(searchText, options = {}) {
    await this.checkAndReload();
    
    const searchLower = searchText.toLowerCase();
    let modules = Array.from(this.modules.values()).filter(module => 
      module.name.toLowerCase().includes(searchLower) ||
      module.description.toLowerCase().includes(searchLower) ||
      (module.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
    );

    if (options.category) {
      modules = modules.filter(m => m.category === options.category);
    }
    if (options.status) {
      modules = modules.filter(m => m.status === options.status);
    }

    if (options.limit) {
      modules = modules.slice(0, options.limit);
    }

    return modules;
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Get tool by name
   */
  async getTool(toolName, moduleName = null) {
    await this.checkAndReload();
    
    if (moduleName) {
      const toolKey = `${moduleName}.${toolName}`;
      return this.tools.get(toolKey) || null;
    } else {
      // Search across all modules
      for (const [toolKey, tool] of this.tools) {
        if (tool.name === toolName) {
          return tool;
        }
      }
      return null;
    }
  }

  /**
   * List tools with optional filtering
   */
  async listTools(options = {}) {
    await this.checkAndReload();
    
    let tools = Array.from(this.tools.values());

    if (options.moduleName) {
      tools = tools.filter(t => t.moduleName === options.moduleName);
    }
    if (options.category) {
      tools = tools.filter(t => t.category === options.category);
    }
    if (options.status) {
      tools = tools.filter(t => t.status === options.status);
    }
    if (options.tags) {
      tools = tools.filter(t => 
        options.tags.some(tag => (t.tags || []).includes(tag))
      );
    }

    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortDirection = options.sort[sortField];
      tools.sort((a, b) => {
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        return sortDirection === -1 ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    }

    if (options.skip) tools = tools.slice(options.skip);
    if (options.limit) tools = tools.slice(0, options.limit);

    return tools;
  }

  /**
   * Save or update a tool (not implemented for read-only JSON provider)
   */
  async saveTool(toolData) {
    throw new Error('JSONFileToolRegistryProvider is read-only. Use MongoDB provider for write operations.');
  }

  /**
   * Delete a tool (not implemented for read-only JSON provider)
   */
  async deleteTool(toolName, moduleName) {
    throw new Error('JSONFileToolRegistryProvider is read-only. Use MongoDB provider for write operations.');
  }

  /**
   * Search tools by text
   */
  async searchTools(searchText, options = {}) {
    await this.checkAndReload();
    
    const searchLower = searchText.toLowerCase();
    let tools = Array.from(this.tools.values()).filter(tool => 
      tool.name.toLowerCase().includes(searchLower) ||
      tool.description.toLowerCase().includes(searchLower) ||
      (tool.summary || '').toLowerCase().includes(searchLower) ||
      (tool.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
    );

    if (options.moduleName) {
      tools = tools.filter(t => t.moduleName === options.moduleName);
    }
    if (options.category) {
      tools = tools.filter(t => t.category === options.category);
    }
    if (options.status) {
      tools = tools.filter(t => t.status === options.status);
    }

    if (options.limit) {
      tools = tools.slice(0, options.limit);
    }

    return tools;
  }

  // ============================================================================
  // USAGE TRACKING (in-memory only)
  // ============================================================================

  /**
   * Record tool usage (in-memory only)
   */
  async recordUsage(usageData) {
    const key = `${usageData.moduleName}.${usageData.toolName}`;
    
    if (!this.usageStats.has(key)) {
      this.usageStats.set(key, {
        totalUsage: 0,
        successfulUsage: 0,
        executionTimes: [],
        firstUsed: new Date(),
        lastUsed: null
      });
    }

    const stats = this.usageStats.get(key);
    stats.totalUsage++;
    
    if (usageData.success !== false) {
      stats.successfulUsage++;
    }
    
    if (usageData.executionTime) {
      stats.executionTimes.push(usageData.executionTime);
      // Keep only last 100 execution times
      if (stats.executionTimes.length > 100) {
        stats.executionTimes = stats.executionTimes.slice(-100);
      }
    }
    
    stats.lastUsed = new Date();
  }

  /**
   * Get usage statistics for a tool
   */
  async getUsageStats(toolName, moduleName, options = {}) {
    const key = `${moduleName}.${toolName}`;
    const stats = this.usageStats.get(key);
    
    if (!stats) {
      return {
        totalUsage: 0,
        successfulUsage: 0,
        averageExecutionTime: null,
        lastUsed: null
      };
    }

    return {
      totalUsage: stats.totalUsage,
      successfulUsage: stats.successfulUsage,
      averageExecutionTime: stats.executionTimes.length > 0 
        ? stats.executionTimes.reduce((a, b) => a + b, 0) / stats.executionTimes.length
        : null,
      lastUsed: stats.lastUsed
    };
  }

  /**
   * Get trending tools (based on in-memory stats)
   */
  async getTrendingTools(options = {}) {
    const trending = [];
    
    for (const [toolKey, stats] of this.usageStats) {
      const [moduleName, toolName] = toolKey.split('.');
      trending.push({
        toolName,
        moduleName,
        recentUsage: stats.totalUsage,
        successRate: stats.totalUsage > 0 ? stats.successfulUsage / stats.totalUsage : 0
      });
    }

    // Sort by usage
    trending.sort((a, b) => b.recentUsage - a.recentUsage);
    
    if (options.limit) {
      return trending.slice(0, options.limit);
    }
    
    return trending;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get provider statistics
   */
  async getStats() {
    await this.checkAndReload();
    
    return {
      modules: this.modules.size,
      tools: this.tools.size,
      usageRecords: this.usageStats.size
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await fs.access(this.toolsDatabasePath);
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        initialized: this.initialized,
        connected: this.connected,
        provider: 'JSONFileToolRegistryProvider',
        file: this.toolsDatabasePath,
        lastModified: this.lastModified,
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        initialized: this.initialized,
        connected: false,
        provider: 'JSONFileToolRegistryProvider'
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return [
      PROVIDER_CAPABILITIES.MODULES,
      PROVIDER_CAPABILITIES.TOOLS,
      PROVIDER_CAPABILITIES.SEARCH,
      PROVIDER_CAPABILITIES.USAGE_TRACKING // in-memory only
    ];
  }

  // ============================================================================
  // INFERENCE HELPERS
  // ============================================================================

  /**
   * Infer module category from name
   */
  inferModuleCategory(moduleName) {
    const name = moduleName.toLowerCase();
    if (name.includes('file') || name.includes('fs')) return 'filesystem';
    if (name.includes('http') || name.includes('network') || name.includes('api')) return 'network';
    if (name.includes('ai') || name.includes('llm')) return 'ai';
    if (name.includes('test')) return 'testing';
    if (name.includes('deploy')) return 'deployment';
    if (name.includes('data') || name.includes('json')) return 'data';
    if (name.includes('storage') || name.includes('db')) return 'storage';
    return 'utility';
  }

  /**
   * Infer tool category from name
   */
  inferToolCategory(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('read') || name.includes('get') || name.includes('find')) return 'read';
    if (name.includes('write') || name.includes('create') || name.includes('save')) return 'write';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    if (name.includes('update') || name.includes('modify')) return 'update';
    if (name.includes('execute') || name.includes('run') || name.includes('command')) return 'execute';
    if (name.includes('search') || name.includes('query')) return 'search';
    if (name.includes('transform') || name.includes('convert')) return 'transform';
    if (name.includes('validate') || name.includes('check')) return 'validate';
    if (name.includes('generate') || name.includes('build')) return 'generate';
    return 'other';
  }

  /**
   * Infer tool tags from name and description
   */
  inferToolTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json');
    if (text.includes('command') || text.includes('bash')) tags.push('command');
    if (text.includes('search')) tags.push('search');
    if (text.includes('http') || text.includes('api')) tags.push('network');
    if (text.includes('database') || text.includes('db')) tags.push('database');
    if (text.includes('ai') || text.includes('llm')) tags.push('ai');
    
    // Add category as tag
    const category = this.inferToolCategory(toolName);
    if (category !== 'other') {
      tags.push(category);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }
}