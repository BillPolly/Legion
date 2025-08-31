/**
 * ToolService - Single Responsibility for Tool Management
 * 
 * Handles only tool-related operations:
 * - Tool retrieval and caching
 * - Tool registration and storage
 * - Tool execution coordination
 * - Tool metadata management
 * 
 * Clean Architecture: Application Layer Service
 * Depends only on abstractions, not concretions
 */

export class ToolService {
  constructor(dependencies) {
    // Minimal dependencies - only what we actually use
    this.toolCache = dependencies.toolCache;
    this.moduleService = dependencies.moduleService;
    this.toolRepository = dependencies.toolRepository; // Database access for tools
    this.eventBus = dependencies.eventBus;
  }

  /**
   * Get tool by name
   * Single responsibility: Tool retrieval with caching
   */
  async getTool(toolName) {
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    // Check cache first
    const cachedTool = await this.toolCache.get(toolName);
    if (cachedTool) {
      return cachedTool;
    }

    try {
      // Phase 1: Find tool metadata in database
      const toolMetadata = await this.toolRepository.findTool(toolName);
      if (!toolMetadata) {
        throw new Error(`Tool not found in database: ${toolName}`);
      }

      console.log(`[ToolService] Found tool ${toolName} in database with moduleName: ${toolMetadata.moduleName}, moduleId: ${toolMetadata.moduleId}`);
      
      // Tools MUST have valid moduleId - no fallbacks allowed
      if (!toolMetadata.moduleId) {
        throw new Error(`Tool ${toolName} has no moduleId - database integrity error`);
      }
      
      const moduleInstance = await this.moduleService.getModuleById(toolMetadata.moduleId);
      const moduleTools = moduleInstance.getTools();
      const executableTool = moduleTools.find(t => t.name === toolName);
      
      if (!executableTool) {
        throw new Error(`Tool ${toolName} found in database but not in module ${toolMetadata.moduleName}`);
      }

      // Cache the executable tool for future requests
      await this.toolCache.set(toolName, executableTool);
      
      this.eventBus.emit('tool:retrieved', {
        name: toolName,
        moduleName: toolMetadata.moduleName,
        moduleId: toolMetadata.moduleId,
        cached: false
      });
      
      return executableTool;
    } catch (error) {
      console.error(`[ToolService] Error retrieving tool ${toolName}:`, error.message);
      throw new Error(`Tool not found: ${toolName}`);
    }
  }

  /**
   * Get tool by database ID
   * Single responsibility: Tool retrieval by ID
   */
  async getToolById(toolId) {
    if (!toolId || typeof toolId !== 'string') {
      throw new Error('Tool ID must be a non-empty string');
    }

    // For module-based approach, we'll search by tool ID across all modules
    const moduleStats = await this.moduleService.getModuleStatistics();
    
    for (const moduleName of moduleStats.loadedModules) {
      try {
        const moduleInstance = await this.moduleService.getModule(moduleName);
        const tools = moduleInstance.getTools();
        
        const tool = tools.find(t => t.id === toolId);
        if (tool) {
          this.eventBus.emit('tool:retrieved-by-id', {
            id: toolId,
            name: tool.name,
            moduleName
          });
          
          return tool;
        }
      } catch (error) {
        // Continue searching other modules
        continue;
      }
    }

    throw new Error(`Tool not found with ID: ${toolId}`);
  }

  /**
   * Get multiple tools by names
   * Single responsibility: Batch tool retrieval
   */
  async getTools(toolNames) {
    const tools = [];
    const errors = [];

    for (const toolName of toolNames) {
      try {
        const tool = await this.getTool(toolName);
        tools.push(tool);
      } catch (error) {
        errors.push({
          toolName,
          error: error.message
        });
      }
    }

    return { tools, errors };
  }

  /**
   * List all available tools
   * Single responsibility: Tool enumeration from database
   */
  async listTools(options = {}) {
    const {
      limit = null,
      category = null,
      module = null,
      includeMetadata = false
    } = options;

    // Build database query
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (module) {
      query.moduleName = module;
    }

    try {
      // Query database directly instead of looking in memory
      const dbTools = await this.toolRepository.findTools(query);
      
      // Apply limit and format response
      const limitedTools = limit ? dbTools.slice(0, limit) : dbTools;
      
      const allTools = limitedTools.map(tool => {
        const toolInfo = {
          name: tool.name,
          description: tool.description,
          category: tool.category,
          moduleName: tool.moduleName
        };

        if (includeMetadata) {
          toolInfo.inputSchema = tool.inputSchema;
          toolInfo.outputSchema = tool.outputSchema;
          toolInfo.version = tool.version;
          toolInfo.keywords = tool.keywords;
          toolInfo.examples = tool.examples;
        }

        return toolInfo;
      });

      this.eventBus.emit('tools:listed', {
        count: allTools.length,
        filters: { category, module, limit }
      });

      return allTools;
    } catch (error) {
      console.error('[ToolService] Error listing tools from database:', error.message);
      this.eventBus.emit('tools:list-error', {
        error: error.message,
        filters: { category, module, limit }
      });
      return [];
    }
  }

  /**
   * Register tools from a loaded module
   * Single responsibility: Tool registration
   */
  async registerModuleTools(moduleName, moduleInstance) {
    const tools = moduleInstance.getTools();
    const registeredTools = [];
    const errors = [];

    for (const tool of tools) {
      try {
        // Basic validation - check required properties
        if (!tool.name || !tool.execute) {
          throw new Error('Tool must have name and execute method');
        }

        // Cache the tool for fast access
        await this.toolCache.set(tool.name, tool);
        registeredTools.push(tool.name);
        
        this.eventBus.emit('tool:registered', {
          name: tool.name,
          moduleName
        });
      } catch (error) {
        errors.push({
          toolName: tool.name || 'unnamed',
          error: error.message
        });
      }
    }

    return { registered: registeredTools, errors };
  }

  /**
   * Get tools with their perspectives
   * Single responsibility: Tool with metadata retrieval
   */
  async getToolWithPerspectives(toolName) {
    const tool = await this.getTool(toolName);
    
    // For now, return tool without perspectives since we don't have perspective repository
    // This will be enhanced when perspective system is fully implemented
    return {
      ...tool,
      perspectives: [] // Empty array - perspectives not yet implemented
    };
  }

  /**
   * Cache tool directly (used by ModuleService when caching modules)
   * Single responsibility: Direct tool caching
   */
  async cacheToolDirect(toolName, toolInstance) {
    await this.toolCache.set(toolName, toolInstance);
    console.log(`[ToolService] Directly cached tool: ${toolName}`);
  }

  /**
   * Clear tool from cache
   * Single responsibility: Tool cleanup
   */
  async clearTool(toolName) {
    await this.toolCache.remove(toolName);
    
    this.eventBus.emit('tool:cleared', { name: toolName });
    
    return { success: true };
  }

  /**
   * Clear all tools for a module
   * Single responsibility: Module tool cleanup
   */
  async clearModuleTools(moduleName) {
    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name must be a non-empty string');
    }

    let clearedCount = 0;

    try {
      // Get the module and its tools
      const moduleInstance = await this.moduleService.getModule(moduleName);
      const tools = moduleInstance.getTools();
      
      // Clear each tool from cache
      for (const tool of tools) {
        await this.clearTool(tool.name);
        clearedCount++;
      }
    } catch (error) {
      // Module might not be loaded - continue with cache cleanup
      // Clear any cached tools that might belong to this module
      // This is a best-effort cleanup
    }
    
    this.eventBus.emit('module-tools:cleared', { 
      moduleName, 
      count: clearedCount 
    });
    
    return { 
      success: true, 
      clearedCount 
    };
  }

  /**
   * Verify tool metadata integrity
   * Single responsibility: Tool validation
   */
  async verifyToolMetadata(toolName) {
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    const verification = {
      toolName,
      exists: false,
      moduleFound: false,
      toolInModule: false,
      schemaMatch: true, // Default to true for module-only approach
      errors: [],
      warnings: []
    };

    try {
      // Try to get the tool - this will search loaded modules
      const tool = await this.getTool(toolName);
      verification.exists = true;
      verification.toolInModule = true;

      // Find which module contains this tool
      const moduleStats = await this.moduleService.getModuleStatistics();
      
      for (const moduleName of moduleStats.loadedModules) {
        try {
          const moduleInstance = await this.moduleService.getModule(moduleName);
          const tools = moduleInstance.getTools();
          
          if (tools.find(t => t.name === toolName)) {
            verification.moduleFound = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Basic schema validation
      if (!tool.inputSchema && !tool.outputSchema) {
        verification.warnings.push('Tool lacks input/output schema definitions');
      }

      if (!tool.description) {
        verification.warnings.push('Tool lacks description');
      }

    } catch (error) {
      verification.errors.push(`Tool verification failed: ${error.message}`);
    }

    return verification;
  }

  /**
   * Get tool statistics
   * Single responsibility: Tool metrics
   */
  async getToolStatistics() {
    try {
      // Get real statistics from database instead of in-memory state
      const totalTools = await this.toolRepository.countTools();
      
      // Count unique modules that have tools - use toolRepository method
      const moduleCount = await this.toolRepository.countModulesWithTools();
      
      // For cached tools, we'll check our in-memory cache
      let cachedTools = 0;
      try {
        // Get all tools from database and check cache
        const allTools = await this.toolRepository.findTools({}, { projection: { name: 1 } });
        for (const tool of allTools) {
          const cached = await this.toolCache.get(tool.name);
          if (cached) {
            cachedTools++;
          }
        }
      } catch (cacheError) {
        // If cache check fails, continue with other stats
        console.warn('[ToolService] Cache check failed:', cacheError.message);
      }
      
      return {
        total: totalTools,
        cached: cachedTools,
        modules: moduleCount || 0
      };
    } catch (error) {
      throw new Error(`Failed to get tool statistics: ${error.message}`);
    }
  }

  /**
   * Execute tool with parameters
   * Single responsibility: Tool execution coordination
   */
  async executeTool(toolName, parameters) {
    const tool = await this.getTool(toolName);
    
    // Tool validation happens in the tool itself
    const result = await tool.execute(parameters);
    
    this.eventBus.emit('tool:executed', {
      name: toolName,
      success: true
    });
    
    return result;
  }

  /**
   * Compare schemas between database and module tool
   * Private helper - single responsibility
   */
  _schemasMatch(dbTool, moduleTool) {
    const dbInput = JSON.stringify(dbTool.inputSchema || {});
    const moduleInput = JSON.stringify(moduleTool.inputSchema || {});
    const dbOutput = JSON.stringify(dbTool.outputSchema || {});
    const moduleOutput = JSON.stringify(moduleTool.outputSchema || {});
    
    return dbInput === moduleInput && dbOutput === moduleOutput;
  }
}