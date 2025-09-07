/**
 * CapabilityManager - Manages agent capabilities including tools and modules
 */

import { getResourceManager } from '../utils/ResourceAccess.js';
import path from 'path';

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
    
    // Get tool registry from ResourceManager
    try {
      this.toolRegistry = await this.resourceManager.get('toolRegistry');
    } catch (error) {
      // Tool registry might not be available yet
      console.log('Tool registry not available from ResourceManager, will load tools directly');
    }

    // Load configured modules and tools
    await this.loadModules();
    await this.loadTools();

    this.initialized = true;
  }

  /**
   * Load configured modules
   */
  async loadModules() {
    if (!this.config.modules || this.config.modules.length === 0) {
      return;
    }

    for (const moduleName of this.config.modules) {
      await this._loadModule(moduleName);
    }
  }

  /**
   * Load a single module
   */
  async _loadModule(moduleName) {
    try {
      // Check if we're in test environment and use mock modules
      const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
      
      const moduleImportPaths = isTest ? [
        // For tests, use mock modules
        `../../__tests__/mocks/${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module.js`
      ] : [
        // For production, try real modules
        `@legion/tools`,
        `@legion/tool-${moduleName}`,
        `../../../tools/src/${moduleName}/index.js`
      ];

      let module = null;
      let moduleClass = null;

      for (const importPath of moduleImportPaths) {
        try {
          const imported = await import(importPath);
          
          // Check if it has the module as a named export
          const moduleClassName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1) + 'Module';
          if (imported[moduleClassName]) {
            moduleClass = imported[moduleClassName];
            module = new moduleClass();
            break;
          }
          
          // Check for default export
          if (imported.default) {
            moduleClass = imported.default;
            module = new moduleClass();
            break;
          }
        } catch (error) {
          // Try next import path
          continue;
        }
      }

      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }

      this.modules[moduleName] = module;

      // Extract tools from module
      if (typeof module.getTools === 'function') {
        const tools = module.getTools();
        for (const tool of tools) {
          this.tools[tool.name] = tool;
        }
      } else if (module.tools) {
        // Module might have tools as a property
        for (const [toolName, tool] of Object.entries(module.tools)) {
          this.tools[toolName] = tool;
        }
      }
    } catch (error) {
      throw new Error(`Module not found: ${moduleName}`);
    }
  }

  /**
   * Load individual tools
   */
  async loadTools() {
    if (!this.config.tools || this.config.tools.length === 0) {
      return;
    }

    for (const toolName of this.config.tools) {
      await this._loadTool(toolName);
    }
  }

  /**
   * Load a single tool
   */
  async _loadTool(toolName) {
    // Skip if already loaded
    if (this.tools[toolName]) {
      return;
    }

    // Try to get from tool registry first
    if (this.toolRegistry) {
      try {
        const tool = await this.toolRegistry.getTool(toolName);
        if (tool) {
          this.tools[toolName] = tool;
          return;
        }
      } catch (error) {
        // Fall back to direct loading
      }
    }

    // Map common tool names to their modules
    const toolModuleMap = {
      'file_read': 'file',
      'file_write': 'file',
      'file_delete': 'file',
      'directory_list': 'file',
      'directory_create': 'file',
      'directory_delete': 'file',
      'read': 'file',
      'write': 'file',
      'calculator': 'calculator',
      'add': 'calculator',
      'subtract': 'calculator',
      'multiply': 'calculator',
      'divide': 'calculator',
      'json_parse': 'json',
      'json_stringify': 'json',
      'json_validate': 'json'
    };

    const moduleName = toolModuleMap[toolName];
    if (!moduleName) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Temporarily load the module to get the specific tool
    // We don't store the module in this.modules to avoid loading all its tools
    const tempModule = await this._loadModuleForTool(moduleName);
    
    // Get the specific tool from the module
    if (tempModule && typeof tempModule.getTools === 'function') {
      const tools = tempModule.getTools();
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        this.tools[toolName] = tool;
        return;
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  /**
   * Load a module temporarily just to extract a specific tool
   */
  async _loadModuleForTool(moduleName) {
    try {
      // Check if we're in test environment and use mock modules
      const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
      
      const moduleImportPaths = isTest ? [
        // For tests, use mock modules
        `../../__tests__/mocks/${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module.js`
      ] : [
        // For production, try real modules
        `@legion/tools`,
        `@legion/tool-${moduleName}`,
        `../../../tools/src/${moduleName}/index.js`
      ];

      for (const importPath of moduleImportPaths) {
        try {
          const imported = await import(importPath);
          
          // Check if it has the module as a named export
          const moduleClassName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1) + 'Module';
          if (imported[moduleClassName]) {
            const moduleClass = imported[moduleClassName];
            return new moduleClass();
          }
          
          // Check for default export
          if (imported.default) {
            const moduleClass = imported.default;
            return new moduleClass();
          }
        } catch (error) {
          // Try next import path
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
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