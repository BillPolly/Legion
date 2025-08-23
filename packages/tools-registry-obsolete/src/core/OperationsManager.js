/**
 * Simplified Operations Manager
 * 
 * Replaces the complex LoadingManager → PipelineOrchestrator → PipelineVerifier chain
 * with direct, simple operations.
 * 
 * Architecture:
 * ToolRegistry → OperationsManager → Database Operations
 * 
 * No complex pipelines, no state management, just direct operations.
 */

import { ModuleDiscovery } from '../loading/ModuleDiscovery.js';

export class OperationsManager {
  constructor(databaseService, semanticService = null) {
    this.db = databaseService;
    this.semantic = semanticService; // Optional
    this.discovery = new ModuleDiscovery();
  }
  
  /**
   * Load a single module - simple, direct operation
   */
  async loadModule(moduleName, options = {}) {
    const { verbose = false, includePerspectives = false, includeVectors = false } = options;
    
    if (verbose) console.log(`📦 Loading module: ${moduleName}`);
    
    // 1. Discover module
    const modules = await this.discovery.discoverModules();
    const module = modules.find(m => m.name === moduleName || m.path.includes(moduleName));
    
    if (!module) {
      throw new Error(`Module '${moduleName}' not found`);
    }
    
    // 2. Extract tools
    const tools = await this.extractTools(module);
    if (verbose) console.log(`🔧 Found ${tools.length} tools in ${moduleName}`);
    
    // 3. Save to database
    await this.saveModule(module);
    await this.saveTools(tools);
    
    // 4. Optional semantic processing (non-blocking)
    if (this.semantic && (includePerspectives || includeVectors)) {
      try {
        if (includePerspectives) {
          await this.semantic.generatePerspectives(tools);
        }
        if (includeVectors) {
          await this.semantic.indexTools(tools);
        }
      } catch (error) {
        console.warn(`⚠️ Semantic processing failed for ${moduleName}:`, error.message);
        // Don't throw - semantic is optional
      }
    }
    
    return { 
      moduleName, 
      toolsLoaded: tools.length,
      semanticProcessed: !!(this.semantic && (includePerspectives || includeVectors))
    };
  }
  
  /**
   * Clear a specific module
   */
  async clearModule(moduleName) {
    // Remove from database
    await this.db.mongoProvider.deleteMany('tools', { moduleName });
    await this.db.mongoProvider.deleteMany('modules', { name: moduleName });
    
    // Optional: Remove from semantic search
    if (this.semantic) {
      try {
        await this.semantic.removeModule(moduleName);
      } catch (error) {
        console.warn(`⚠️ Semantic cleanup failed for ${moduleName}:`, error.message);
      }
    }
    
    return { success: true, moduleName };
  }
  
  /**
   * Clear all modules
   */
  async clearAllModules() {
    // Clear database collections
    await this.db.mongoProvider.deleteMany('tools', {});
    await this.db.mongoProvider.deleteMany('modules', {});
    await this.db.mongoProvider.deleteMany('tool_perspectives', {});
    
    // Optional: Clear semantic search
    if (this.semantic) {
      try {
        await this.semantic.clearAll();
      } catch (error) {
        console.warn('⚠️ Semantic cleanup failed:', error.message);
      }
    }
    
    return { success: true };
  }
  
  /**
   * Get tools with simple query
   */
  async getTools(query = {}) {
    return this.db.mongoProvider.find('tools', query);
  }
  
  /**
   * Get a single tool by name
   */
  async getTool(name) {
    const tools = await this.db.mongoProvider.find('tools', { name });
    return tools.length > 0 ? tools[0] : null;
  }
  
  /**
   * Search tools by text query
   */
  async searchTools(query, options = {}) {
    const { limit = 10 } = options;
    
    // Simple text search in name and description
    const searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };
    
    return this.db.mongoProvider.find('tools', searchQuery, { limit });
  }
  
  /**
   * Extract tools from a module
   */
  async extractTools(module) {
    try {
      // Import and instantiate the module
      const ModuleClass = await import(module.path);
      const moduleInstance = new (ModuleClass.default || ModuleClass)();
      
      // Get tools
      if (!moduleInstance.getTools || typeof moduleInstance.getTools !== 'function') {
        throw new Error(`Module ${module.name} does not have getTools() method`);
      }
      
      const tools = moduleInstance.getTools();
      
      // Add module metadata to each tool
      return tools.map(tool => ({
        ...tool,
        moduleName: module.name,
        modulePath: module.path,
        _id: this.generateToolId(tool.name, module.name)
      }));
      
    } catch (error) {
      throw new Error(`Failed to extract tools from ${module.name}: ${error.message}`);
    }
  }
  
  /**
   * Save module to database
   */
  async saveModule(module) {
    const moduleData = {
      _id: this.generateModuleId(module.name),
      name: module.name,
      path: module.path,
      type: module.type || 'class',
      toolCount: 0, // Will be updated when tools are saved
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Use upsert to avoid duplicates
    await this.db.mongoProvider.updateOne(
      'modules',
      { name: module.name },
      { $set: moduleData },
      { upsert: true }
    );
  }
  
  /**
   * Save tools to database
   */
  async saveTools(tools) {
    for (const tool of tools) {
      const toolData = {
        _id: tool._id,
        name: tool.name,
        description: tool.description || 'No description available',
        moduleName: tool.moduleName,
        modulePath: tool.modulePath,
        inputSchema: tool.inputSchema || {},
        outputSchema: tool.outputSchema || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Use upsert to avoid duplicates
      await this.db.mongoProvider.updateOne(
        'tools',
        { name: tool.name },
        { $set: toolData },
        { upsert: true }
      );
    }
    
    // Update module tool count
    if (tools.length > 0) {
      const moduleName = tools[0].moduleName;
      await this.db.mongoProvider.updateOne(
        'modules',
        { name: moduleName },
        { $inc: { toolCount: tools.length } }
      );
    }
  }
  
  /**
   * Generate simple tool ID: moduleName.toolName
   */
  generateToolId(toolName, moduleName) {
    return `${moduleName}.${toolName}`;
  }
  
  /**
   * Generate simple module ID: just the module name
   */
  generateModuleId(moduleName) {
    return moduleName;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    // Simple cleanup - just database connections
    if (this.db && this.db.cleanup) {
      await this.db.cleanup();
    }
    
    if (this.semantic && this.semantic.cleanup) {
      await this.semantic.cleanup();
    }
  }
}