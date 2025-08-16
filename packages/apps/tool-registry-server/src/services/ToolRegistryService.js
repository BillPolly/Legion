/**
 * ToolRegistryService
 * Singleton wrapper for ToolRegistry with server-specific functionality
 */

import toolRegistry from '@legion/tools-registry';

export class ToolRegistryService {
  static instance = null;
  
  constructor() {
    this.registry = toolRegistry;
    this.loader = null;
    this.initialized = false;
  }
  
  /**
   * Get singleton instance
   */
  static async getInstance() {
    if (!this.instance) {
      this.instance = new ToolRegistryService();
      await this.instance.initialize();
    }
    return this.instance;
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Ensure registry is initialized
      if (!this.registry.initialized) {
        await this.registry.initialize();
      }
      
      // Get loader reference
      this.loader = await this.registry.getLoader();
      
      this.initialized = true;
      console.log('  ✅ ToolRegistryService initialized');
    } catch (error) {
      console.error('Failed to initialize ToolRegistryService:', error);
      throw error;
    }
  }
  
  /**
   * Get the registry instance
   */
  getRegistry() {
    return this.registry;
  }
  
  /**
   * Get the loader instance
   */
  async getLoader() {
    if (!this.loader) {
      this.loader = await this.registry.getLoader();
    }
    return this.loader;
  }
  
  /**
   * Get registry provider
   */
  getProvider() {
    return this.registry.provider;
  }
  
  /**
   * Load all tools from database
   */
  async loadTools(options = {}) {
    const tools = await this.registry.listTools(options);
    return tools;
  }
  
  /**
   * Load all modules from database
   */
  async loadModules(options = {}) {
    const provider = this.getProvider();
    if (!provider || !provider.listModules) {
      throw new Error('Provider does not support module listing');
    }
    return await provider.listModules(options);
  }
  
  /**
   * Execute a tool
   */
  async executeTool(toolName, params) {
    const tool = await this.registry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    const result = await tool.execute(params);
    return result;
  }
  
  /**
   * Load all modules from filesystem
   */
  async loadAllModulesFromFileSystem() {
    const loader = await this.getLoader();
    const result = await loader.loadModules();
    return result;
  }
  
  /**
   * Clear all data from database
   */
  async clearDatabase() {
    const loader = await this.getLoader();
    await loader.clearAll();
  }
  
  /**
   * Get registry statistics
   */
  async getRegistryStats() {
    const stats = await this.registry.getUsageStats();
    
    // Add loader pipeline state
    const loader = await this.getLoader();
    const pipelineState = loader.getPipelineState();
    
    // Get counts from provider
    const provider = this.getProvider();
    let counts = {
      modules: 0,
      tools: 0,
      perspectives: 0
    };
    
    if (provider) {
      try {
        const [modules, tools] = await Promise.all([
          provider.listModules({ limit: 1 }),
          this.registry.listTools({ limit: 1 })
        ]);
        
        counts.modules = modules?.length || 0;
        counts.tools = tools?.length || 0;
      } catch (error) {
        console.error('Error getting counts:', error);
      }
    }
    
    return {
      ...stats,
      pipeline: pipelineState,
      counts
    };
  }
  
  /**
   * Get a specific tool
   */
  async getTool(toolName) {
    return await this.registry.getTool(toolName);
  }
  
  /**
   * List tools from registry
   */
  async listTools(options = {}) {
    return await this.registry.listTools(options);
  }
  
  /**
   * Search tools
   */
  async searchTools(query, options = {}) {
    return await this.registry.searchTools(query, options);
  }
  
  /**
   * Get registry usage stats (alias for getRegistryStats)
   */
  async getStats() {
    return await this.registry.getUsageStats();
  }

  /**
   * Generate perspectives for tools
   */
  async generatePerspectives() {
    const loader = await this.getLoader();
    
    // Check if perspective generation is available
    if (!loader.generatePerspectives) {
      throw new Error('Perspective generation not available in loader');
    }
    
    const result = await loader.generatePerspectives();
    return result;
  }
  
  /**
   * Get perspectives for a specific tool
   */
  async getToolPerspectives(toolName) {
    const provider = this.getProvider();
    
    if (!provider || !provider.db) {
      return [];
    }
    
    try {
      const perspectives = await provider.db.collection('tool_perspectives')
        .find({ toolName })
        .limit(100)
        .toArray();
      
      return perspectives;
    } catch (error) {
      console.error(`Failed to get perspectives for ${toolName}:`, error);
      return [];
    }
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // The singleton registry handles its own cleanup
      // We just ensure it's called
      if (this.registry && this.registry.cleanup) {
        await this.registry.cleanup();
      }
      
      this.loader = null;
      this.initialized = false;
      
      console.log('  ✅ ToolRegistryService cleaned up');
    } catch (error) {
      console.error('Error during ToolRegistryService cleanup:', error);
      throw error;
    }
  }
  
  /**
   * Reset singleton (for testing)
   */
  static reset() {
    this.instance = null;
  }
}