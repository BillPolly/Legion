/**
 * Enhanced MCP Server with Handle Integration
 * 
 * Extends the basic MCP server functionality with handle management,
 * parameter resolution, and advanced tool orchestration capabilities
 */

import { HandleRegistry } from '../handles/HandleRegistry.js';
import { LRUHandleRegistry } from '../handles/LRUHandleRegistry.js';
import { TTLHandleRegistry } from '../handles/TTLHandleRegistry.js';
import { HandleResolver } from '../handles/HandleResolver.js';

export class EnhancedMCPServer {
  constructor(options = {}) {
    this.name = options.name || 'enhanced-aiur';
    this.version = options.version || '1.0.0';
    
    // Initialize handle system
    this._initializeHandleSystem(options);
    
    // Server configuration
    this.enableParameterResolution = options.enableParameterResolution !== false;
    this.enableSaveAsHandling = options.enableSaveAsHandling !== false;
    
    // Tool registry
    this.tools = new Map();
    this.resources = new Map();
    
    // Event handlers
    this.onResourceUpdate = null;
    
    // Initialize built-in handle management tools
    this._initializeHandleTools();
    
    // Server state
    this.isRunning = false;
  }

  /**
   * Initialize the handle system based on configuration
   * @private
   */
  _initializeHandleSystem(options) {
    const registryType = options.handleRegistryType || 'basic';
    const registryOptions = options.handleRegistryOptions || {};
    
    // Create appropriate handle registry
    switch (registryType) {
      case 'lru':
        this.handleRegistry = new LRUHandleRegistry(registryOptions);
        break;
      case 'ttl':
        this.handleRegistry = new TTLHandleRegistry(registryOptions);
        break;
      case 'basic':
      default:
        this.handleRegistry = new HandleRegistry();
        break;
    }
    
    // Create handle resolver
    this.handleResolver = new HandleResolver(this.handleRegistry);
  }

  /**
   * Initialize built-in handle management tools
   * @private
   */
  _initializeHandleTools() {
    // Handle creation tool
    this.addTool({
      name: 'handle_create',
      description: 'Create a new handle to store data',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the handle'
          },
          data: {
            description: 'Data to store in the handle'
          },
          options: {
            type: 'object',
            description: 'Handle options (TTL, etc.)',
            properties: {
              ttl: {
                type: 'number',
                description: 'Time to live in milliseconds'
              }
            }
          }
        },
        required: ['name', 'data']
      },
      execute: async (params) => {
        const { name, data, options = {} } = params;
        
        try {
          // Check if this is a TTL registry and handle options appropriately
          let createOptions = options;
          if (this.handleRegistry.constructor.name === 'TTLHandleRegistry' && options.ttl) {
            createOptions = { ttl: options.ttl };
          }
          
          const handleId = this.handleRegistry.create(name, data, createOptions);
          this._notifyResourceUpdate(`handle://${name}`);
          
          return {
            success: true,
            handleId,
            name,
            message: `Handle '${name}' created successfully`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    // Handle retrieval tool
    this.addTool({
      name: 'handle_get',
      description: 'Retrieve a handle by name',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the handle to retrieve'
          }
        },
        required: ['name']
      },
      execute: async (params) => {
        const { name } = params;
        
        const handle = this.handleRegistry.getByName(name);
        if (!handle) {
          return {
            success: false,
            error: `Handle not found: ${name}`
          };
        }
        
        return {
          success: true,
          handle: {
            id: handle.id,
            name: handle.name,
            data: handle.data,
            metadata: handle.metadata
          }
        };
      }
    });

    // Handle listing tool
    this.addTool({
      name: 'handle_list',
      description: 'List all available handles',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Filter pattern for handle names'
          }
        }
      },
      execute: async (params) => {
        const { filter } = params;
        
        const allHandles = this.handleRegistry.listHandles();
        let handles = allHandles;
        
        if (filter) {
          const regex = new RegExp(filter, 'i');
          handles = allHandles.filter(handle => regex.test(handle.name));
        }
        
        return {
          success: true,
          handles: handles.map(handle => ({
            id: handle.id,
            name: handle.name,
            metadata: handle.metadata
          })),
          count: handles.length
        };
      }
    });

    // Handle deletion tool
    this.addTool({
      name: 'handle_delete',
      description: 'Delete a handle by name',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the handle to delete'
          }
        },
        required: ['name']
      },
      execute: async (params) => {
        const { name } = params;
        
        if (!this.handleRegistry.existsByName(name)) {
          return {
            success: false,
            error: `Handle not found: ${name}`
          };
        }
        
        const deleted = this.handleRegistry.deleteByName(name);
        if (deleted) {
          this._notifyResourceUpdate(`handle://${name}`);
        }
        
        return {
          success: deleted,
          deleted,
          message: deleted ? `Handle '${name}' deleted successfully` : `Failed to delete handle '${name}'`
        };
      }
    });
  }

  /**
   * Add a custom tool to the server
   * @param {Object} tool - Tool definition
   */
  addTool(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }
    
    this.tools.set(tool.name, tool);
  }

  /**
   * Remove a tool from the server
   * @param {string} name - Tool name to remove
   */
  removeTool(name) {
    return this.tools.delete(name);
  }

  /**
   * List all available tools
   * @returns {Array} Array of tool definitions
   */
  listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {}
    }));
  }

  /**
   * Call a tool with parameters
   * @param {string} toolName - Name of the tool to call
   * @param {Object} params - Parameters for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async callTool(toolName, params = {}) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`
      };
    }

    try {
      // Resolve handle references in parameters if enabled
      let resolvedParams = params;
      if (this.enableParameterResolution) {
        try {
          resolvedParams = this.handleResolver.resolveParameters(params);
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }

      // Execute the tool
      const result = await tool.execute(resolvedParams);

      // Handle saveAs functionality if enabled
      if (this.enableSaveAsHandling && result.success && result.saveAs) {
        await this._handleSaveAs(result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle saveAs functionality from tool responses
   * @private
   */
  async _handleSaveAs(result) {
    let saveName;
    let saveOptions = {};
    
    if (typeof result.saveAs === 'string') {
      saveName = result.saveAs;
    } else if (typeof result.saveAs === 'object') {
      saveName = result.saveAs.name;
      saveOptions = result.saveAs.options || {};
    } else {
      return; // Invalid saveAs format
    }

    if (!saveName) {
      return;
    }

    // Check if handle already exists
    const existingHandle = this.handleRegistry.getByName(saveName);
    if (existingHandle) {
      result.warning = `Handle '${saveName}' already exists and was overwritten`;
    }

    // Create the handle with the tool's result data
    try {
      const handleId = this.handleRegistry.create(saveName, result.data, saveOptions);
      result.handleId = handleId;
      result.handleName = saveName;
      
      this._notifyResourceUpdate(`handle://${saveName}`);
    } catch (error) {
      result.warning = `Failed to create handle '${saveName}': ${error.message}`;
    }
  }

  /**
   * Get server information
   * @returns {Object} Server information
   */
  getServerInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: [
        'handle-management',
        'parameter-resolution',
        'tool-orchestration',
        'resource-notification'
      ],
      handleRegistry: {
        type: this.handleRegistry.constructor.name,
        size: this.handleRegistry.size(),
        ...(this.handleRegistry.getStatistics ? this.handleRegistry.getStatistics() : {})
      }
    };
  }

  /**
   * List available resources
   * @returns {Promise<Array>} Array of resource definitions
   */
  async listResources() {
    const resources = [];
    
    // Add handle resources
    const handleNames = this.handleRegistry.listNames();
    for (const name of handleNames) {
      resources.push({
        uri: `handle://${name}`,
        name: `Handle: ${name}`,
        description: `Stored handle data for ${name}`,
        mimeType: 'application/json'
      });
    }
    
    // Add other registered resources
    for (const [uri, resource] of this.resources) {
      resources.push(resource);
    }
    
    return resources;
  }

  /**
   * Read a resource by URI
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async readResource(uri) {
    if (uri.startsWith('handle://')) {
      const handleName = uri.substring('handle://'.length);
      const handle = this.handleRegistry.getByName(handleName);
      
      if (!handle) {
        throw new Error(`Handle not found: ${handleName}`);
      }
      
      return {
        contents: JSON.stringify(handle.data, null, 2),
        mimeType: 'application/json'
      };
    }
    
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    if (resource.read) {
      return await resource.read();
    }
    
    return resource.contents || { contents: '', mimeType: 'text/plain' };
  }

  /**
   * Register a custom resource
   * @param {string} uri - Resource URI
   * @param {Object} resource - Resource definition
   */
  addResource(uri, resource) {
    this.resources.set(uri, resource);
  }

  /**
   * Remove a resource
   * @param {string} uri - Resource URI
   */
  removeResource(uri) {
    return this.resources.delete(uri);
  }

  /**
   * Start the MCP server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    // Perform any startup initialization
    await this._startup();
  }

  /**
   * Stop the MCP server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    // Perform cleanup
    await this._shutdown();
  }

  /**
   * Close the server (alias for stop)
   */
  close() {
    return this.stop();
  }

  /**
   * Startup initialization
   * @private
   */
  async _startup() {
    // Override in subclasses if needed
  }

  /**
   * Shutdown cleanup
   * @private
   */
  async _shutdown() {
    // Clean up handle registry if it has cleanup methods
    if (this.handleRegistry.destroy) {
      this.handleRegistry.destroy();
    }
  }

  /**
   * Notify about resource updates
   * @private
   */
  _notifyResourceUpdate(uri) {
    if (this.onResourceUpdate) {
      this.onResourceUpdate(uri);
    }
  }

  /**
   * Get handle statistics
   * @returns {Object} Handle statistics
   */
  getHandleStatistics() {
    const baseStats = {
      totalHandles: this.handleRegistry.size(),
      handleNames: this.handleRegistry.listNames()
    };
    
    if (this.handleRegistry.getStatistics) {
      return {
        ...baseStats,
        ...this.handleRegistry.getStatistics()
      };
    }
    
    return baseStats;
  }

  /**
   * Get health information
   * @returns {Object} Server health information
   */
  getHealthInfo() {
    const health = {
      status: this.isRunning ? 'running' : 'stopped',
      server: this.getServerInfo(),
      handles: this.getHandleStatistics(),
      tools: {
        total: this.tools.size,
        available: Array.from(this.tools.keys())
      },
      resources: {
        total: this.resources.size + this.handleRegistry.size()
      }
    };
    
    // Add TTL-specific health info if available
    if (this.handleRegistry.getTTLHealthInfo) {
      health.handles.ttl = this.handleRegistry.getTTLHealthInfo();
    }
    
    return health;
  }
}