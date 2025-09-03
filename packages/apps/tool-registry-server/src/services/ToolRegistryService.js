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
      // toolRegistry is already the initialized singleton instance
      // No separate loader needed - ToolRegistry has the methods directly
      this.loader = this.registry; // Use registry as loader since it has the methods
      
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
   * Get a specific tool
   */
  async getTool(toolName) {
    return await this.registry.getTool(toolName);
  }
  
  /**
   * Search tools
   */
  async searchTools(query, options = {}) {
    return await this.registry.searchTools(query, options);
  }
  
  /**
   * Get registry statistics (includes all counts)
   */
  async getStats() {
    return await this.registry.getStatistics();
  }

  /**
   * Generate perspectives for tools
   */
  async generatePerspectives() {
    const result = await this.registry.generatePerspectives();
    return result;
  }
  
  /**
   * Search modules and return actual module objects
   */
  async searchModules(query, options = {}) {
    return await this.registry.searchModules(query, options);
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