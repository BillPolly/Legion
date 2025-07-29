/**
 * ContextManager - Handles context management tools and execution
 * 
 * Follows the Async Resource Manager Pattern for proper dependency injection
 * and testability.
 */

export class ContextManager {
  constructor(handleRegistry, handleResolver) {
    this.handleRegistry = handleRegistry;
    this.handleResolver = handleResolver;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<ContextManager>} Initialized ContextManager instance
   */
  static async create(resourceManager) {
    const handleRegistry = resourceManager.get('handleRegistry');
    const handleResolver = resourceManager.get('handleResolver');
    
    return new ContextManager(handleRegistry, handleResolver);
  }

  /**
   * Get MCP tool definitions for context management tools
   * @returns {Array} Array of MCP tool definitions
   */
  getToolDefinitions() {
    return [
      {
        name: "context_add",
        description: "Add data to the context for AI agents to reference",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name/key for the context data"
            },
            data: {
              description: "Context data to store (any type)"
            },
            description: {
              type: "string",
              description: "Optional description of what this context contains"
            }
          },
          required: ["name", "data"]
        }
      },
      {
        name: "context_get",
        description: "Retrieve context data by name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the context data to retrieve"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "context_list",
        description: "List all available context data",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "string",
              description: "Optional filter pattern for context names"
            }
          }
        }
      }
    ];
  }

  /**
   * Check if a tool name is a context tool
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if it's a context tool
   */
  isContextTool(toolName) {
    return ['context_add', 'context_get', 'context_list'].includes(toolName);
  }

  /**
   * Execute a context management tool
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments (already resolved)
   * @returns {Object} MCP-formatted response
   */
  async executeContextTool(name, args) {
    try {
      switch (name) {
        case 'context_add':
          return await this._executeContextAdd(args);
        case 'context_get':
          return await this._executeContextGet(args);
        case 'context_list':
          return await this._executeContextList(args);
        default:
          throw new Error(`Unknown context tool: ${name}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute context_add tool
   * @private
   */
  async _executeContextAdd(args) {
    const contextName = `context_${args.name}`;
    const contextData = {
      data: args.data,
      description: args.description || `Context data: ${args.name}`,
      addedAt: new Date().toISOString(),
      type: 'context'
    };
    
    const handleId = this.handleRegistry.create(contextName, contextData);
    
    // Return Legion format - let centralized formatter handle MCP conversion
    return {
      success: true,
      message: `Context '${args.name}' added successfully`,
      handleId,
      contextName: args.name
    };
  }

  /**
   * Execute context_get tool
   * @private
   */
  async _executeContextGet(args) {
    const contextName = `context_${args.name}`;
    const handle = this.handleRegistry.getByName(contextName);
    
    if (!handle) {
      // Return Legion format
      return {
        success: false,
        error: `Context '${args.name}' not found`
      };
    }
    
    // Return Legion format
    return {
      success: true,
      name: args.name,
      data: handle.data.data,
      description: handle.data.description,
      addedAt: handle.data.addedAt
    };
  }

  /**
   * Execute context_list tool
   * @private
   */
  async _executeContextList(args) {
    const allHandles = this.handleRegistry.listHandles();
    const contextHandles = allHandles.filter(h => h.name.startsWith('context_'));
    
    let filteredHandles = contextHandles;
    if (args.filter) {
      const regex = new RegExp(args.filter, 'i');
      filteredHandles = contextHandles.filter(h => 
        regex.test(h.name.substring('context_'.length))
      );
    }
    
    const contexts = filteredHandles.map(h => ({
      name: h.name.substring('context_'.length),
      description: h.data.description,
      addedAt: h.data.addedAt,
      dataType: typeof h.data.data
    }));
    
    // Return Legion format
    return {
      success: true,
      contexts,
      total: contexts.length
    };
  }
}