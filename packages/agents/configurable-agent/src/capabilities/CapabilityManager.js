/**
 * CapabilityManager - Manages agent capabilities including tools and modules
 */

import { getResourceManager } from '../utils/ResourceAccess.js';
import { getToolRegistry } from '@legion/tools-registry';

/**
 * Manages loading and execution of tools and modules for the agent
 */
export class CapabilityManager {
  constructor(config = {}) {
    this.config = this._validateConfig(config);
    this.modules = {};
    this.tools = {};
    this.permissions = config.permissions || {};
    this.resourceManager = null;
    this.initialized = false;
    this.toolRegistry = null;
  }

  /**
   * Validate configuration
   */
  _validateConfig(config) {
    if (config.modules && !Array.isArray(config.modules)) {
      throw new Error('Invalid configuration: modules must be an array');
    }
    if (config.tools && !Array.isArray(config.tools)) {
      throw new Error('Invalid configuration: tools must be an array');
    }
    return config;
  }

  /**
   * Initialize with ResourceManager
   */
  async initialize(resourceManager) {
    if (this.initialized) {
      throw new Error('CapabilityManager already initialized');
    }

    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    
    // Get tool registry singleton - this is the ONLY source of tools
    this.toolRegistry = await getToolRegistry();

    // Load configured modules and tools - everything goes through ToolRegistry
    await this.loadModules();
    await this.loadTools();

    this.initialized = true;
  }

  /**
   * Load configured modules - all tools come from ToolRegistry
   */
  async loadModules() {
    if (!this.config.modules || this.config.modules.length === 0) {
      return;
    }

    for (const moduleName of this.config.modules) {
      await this._loadModuleFromToolRegistry(moduleName);
    }
  }

  /**
   * Load a module using ONLY ToolRegistry
   */
  async _loadModuleFromToolRegistry(moduleName) {
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry not available');
    }

    try {
      // Get all tools for this module from ToolRegistry
      const toolMetadataList = await this.toolRegistry.listTools();
      const moduleToolsMetadata = toolMetadataList.filter(tool => 
        tool.moduleName === moduleName || 
        tool.module === moduleName
      );
      
      if (moduleToolsMetadata.length === 0) {
        throw new Error(`No tools found for module: ${moduleName}`);
      }

      // Get actual executable tools using getTool()
      const executableTools = [];
      for (const toolMeta of moduleToolsMetadata) {
        const executableTool = await this.toolRegistry.getTool(toolMeta.name);
        if (executableTool && typeof executableTool.execute === 'function') {
          executableTools.push(executableTool);
        }
      }
      
      if (executableTools.length === 0) {
        throw new Error(`No executable tools found for module: ${moduleName}`);
      }

      // Create a pseudo-module with the executable tools
      const pseudoModule = {
        name: moduleName,
        getTools: () => executableTools
      };
      this.modules[moduleName] = pseudoModule;
      
      // Add executable tools to our tools map
      for (const tool of executableTools) {
        this.tools[tool.name] = tool;
      }
      
    } catch (error) {
      throw new Error(`Module not found: ${moduleName}`);
    }
  }

  /**
   * Load individual tools - all from ToolRegistry
   */
  async loadTools() {
    if (!this.config.tools || this.config.tools.length === 0) {
      return;
    }

    for (const toolName of this.config.tools) {
      await this._loadToolFromToolRegistry(toolName);
    }
  }

  /**
   * Load a single tool using ONLY ToolRegistry
   */
  async _loadToolFromToolRegistry(toolName) {
    // Skip if already loaded
    if (this.tools[toolName]) {
      return;
    }

    if (!this.toolRegistry) {
      throw new Error('ToolRegistry not available');
    }

    try {
      const tool = await this.toolRegistry.getTool(toolName);
      if (tool && typeof tool.execute === 'function') {
        this.tools[toolName] = tool;
        return;
      }
      throw new Error(`Tool not found or not executable: ${toolName}`);
    } catch (error) {
      throw new Error(`Tool not found: ${toolName}`);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name) {
    return this.tools[name] || null;
  }

  /**
   * List all available tools
   */
  listTools() {
    return Object.keys(this.tools);
  }

  /**
   * Get tool metadata
   */
  getToolMetadata(name) {
    const tool = this.getTool(name);
    if (!tool) {
      return null;
    }

    return {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
      outputSchema: tool.outputSchema || {},
      category: tool.category || 'general'
    };
  }

  /**
   * Validate permission for tool execution
   */
  validatePermission(toolName, params) {
    const rules = this.permissions[toolName];
    if (!rules) {
      // No rules means allowed
      return true;
    }

    // Check allowed paths
    if (rules.allowedPaths && params.path) {
      const allowed = rules.allowedPaths.some(allowedPath => 
        params.path.startsWith(allowedPath)
      );
      if (!allowed) {
        return false;
      }
    }

    // Check allowed extensions
    if (rules.allowedExtensions && params.path) {
      const extension = path.extname(params.path);
      if (!rules.allowedExtensions.includes(extension)) {
        return false;
      }
    }

    // Check file size limits
    if (rules.maxFileSize && params.size) {
      if (params.size > rules.maxFileSize) {
        return false;
      }
    }

    // Check allowed operations
    if (rules.allowedOperations && params.operation) {
      if (!rules.allowedOperations.includes(params.operation)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get permission rules for a tool
   */
  getPermissionRules(toolName) {
    return this.permissions[toolName] || {};
  }

  /**
   * Execute a tool with permission checking
   */
  async executeTool(toolName, params) {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Check permissions
    if (!this.validatePermission(toolName, params)) {
      throw new Error(`Permission denied for tool: ${toolName}`);
    }

    // Execute the tool
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool ${toolName} does not have an execute function`);
    }

    // Execute tool with provided parameters
    return await tool.execute(params);
  }

  /**
   * Discover tools by category
   */
  discoverToolsByCategory(category) {
    return Object.keys(this.tools).filter(toolName => {
      const tool = this.tools[toolName];
      
      // Check if tool category matches
      if (tool.category === category) {
        return true;
      }
      
      // Check if tool name starts with category
      if (toolName.startsWith(category + '_')) {
        return true;
      }
      
      // Check if tool belongs to a module with that name
      for (const [moduleName, module] of Object.entries(this.modules)) {
        if (moduleName === category) {
          if (module.getTools) {
            const moduleTools = module.getTools();
            if (moduleTools.some(t => t.name === toolName)) {
              return true;
            }
          }
        }
      }
      
      return false;
    });
  }

  /**
   * Discover tools by capability
   */
  discoverToolsByCapability(capability) {
    return Object.keys(this.tools).filter(toolName => {
      const tool = this.tools[toolName];
      
      // Check tool name
      if (toolName.includes(capability)) {
        return true;
      }
      
      // Check tool description
      if (tool.description && tool.description.toLowerCase().includes(capability.toLowerCase())) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Search tools by description
   */
  searchTools(query) {
    const lowerQuery = query.toLowerCase();
    
    return Object.keys(this.tools).filter(toolName => {
      const tool = this.tools[toolName];
      
      // Check tool name
      if (toolName.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check tool description
      if (tool.description && tool.description.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Check if has access to a tool operation
   */
  async hasToolAccess(toolName, operation) {
    // Check if tool exists
    if (!this.tools[toolName]) {
      return false;
    }
    
    // Check if operation is allowed
    const permissions = this.permissions[toolName];
    if (permissions) {
      if (Array.isArray(permissions)) {
        return permissions.includes(operation);
      }
      if (typeof permissions === 'object') {
        return permissions[operation] !== false;
      }
    }
    
    // Default to allowing if no specific permissions set
    return true;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return Object.keys(this.tools);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear all loaded modules and tools
    this.modules = {};
    this.tools = {};
    this.initialized = false;
    this.resourceManager = null;
    this.toolRegistry = null;
  }
}