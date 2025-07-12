/**
 * GlobalToolRegistry - Manages global tool discovery with short names and no module prefixes
 */

export class GlobalToolRegistry {
  constructor(moduleLoader) {
    this.moduleLoader = moduleLoader;
    this.toolMap = new Map(); // toolName -> { module, tool, metadata }
    this.shortNameMap = new Map(); // shortName -> toolName
    this.functionMap = new Map(); // functionName -> toolName
    this.initialized = false;
  }

  /**
   * Initialize the global tool registry
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.toolMap.clear();
    this.shortNameMap.clear();
    this.functionMap.clear();

    // Get all loaded modules
    const modules = this.moduleLoader.modules;
    
    for (const [moduleName, moduleInfo] of modules) {
      for (const tool of moduleInfo.tools) {
        this.registerTool(moduleName, tool);
      }
    }

    this.initialized = true;
  }

  /**
   * Register a single tool
   */
  registerTool(moduleName, tool) {
    // Handle tools with multiple functions (like GitHub, PolyRepo)
    if (typeof tool.getAllToolDescriptions === 'function') {
      const descriptions = tool.getAllToolDescriptions();
      
      for (const desc of descriptions) {
        const functionName = desc.function.name;
        
        // Register with function name
        this.toolMap.set(functionName, {
          module: moduleName,
          tool,
          metadata: {
            name: functionName,
            description: desc.function.description,
            parameters: desc.function.parameters,
            functionName: functionName
          }
        });
        
        // Register short names
        // 1. Remove module prefix: "github_create_repo" -> "create_repo"
        if (functionName.includes('_')) {
          const parts = functionName.split('_');
          if (parts.length > 1 && parts[0] === moduleName) {
            const shortName = parts.slice(1).join('_');
            if (!this.toolMap.has(shortName)) {
              this.shortNameMap.set(shortName, functionName);
            }
          }
        }
        
        // 2. Add common short names
        const commonShortNames = {
          'file_read': 'read',
          'file_write': 'write',
          'directory_create': 'mkdir',
          'calculator_evaluate': 'calc'
        };
        
        if (commonShortNames[functionName]) {
          this.shortNameMap.set(commonShortNames[functionName], functionName);
        }
      }
    } 
    // Handle tools with single function (like Calculator)
    else if (typeof tool.getToolDescription === 'function') {
      const desc = tool.getToolDescription();
      const functionName = desc.function.name;
      
      this.toolMap.set(functionName, {
        module: moduleName,
        tool,
        metadata: {
          name: functionName,
          description: desc.function.description,
          parameters: desc.function.parameters,
          functionName: functionName
        }
      });
      
      // Register short name if provided
      if (tool.shortName) {
        this.shortNameMap.set(tool.shortName, functionName);
      }
      
      // Also register tool name without module prefix
      const toolName = tool.name;
      if (toolName && !this.toolMap.has(toolName)) {
        this.shortNameMap.set(toolName, functionName);
      }
    }
    // Handle ModularTool instances
    else if (tool.name) {
      const toolName = tool.name;
      
      this.toolMap.set(toolName, {
        module: moduleName,
        tool,
        metadata: {
          name: toolName,
          description: tool.description,
          parameters: tool.parameters
        }
      });
      
      // Register short name if provided
      if (tool.shortName) {
        this.shortNameMap.set(tool.shortName, toolName);
      }
    }
  }

  /**
   * Resolve a command name to a tool
   */
  resolveTool(commandName) {
    this.initialize();
    
    // Direct match
    if (this.toolMap.has(commandName)) {
      return this.toolMap.get(commandName);
    }
    
    // Short name match
    if (this.shortNameMap.has(commandName)) {
      const resolvedName = this.shortNameMap.get(commandName);
      return this.toolMap.get(resolvedName);
    }
    
    return null;
  }

  /**
   * Get all tools for listing
   */
  getAllTools() {
    this.initialize();
    
    const tools = [];
    
    for (const [toolName, toolData] of this.toolMap) {
      const shortNames = [];
      
      // Find short names for this tool
      for (const [shortName, resolvedName] of this.shortNameMap) {
        if (resolvedName === toolName) {
          shortNames.push(shortName);
        }
      }
      
      tools.push({
        name: toolName,
        shortNames,
        module: toolData.module,
        description: toolData.metadata.description,
        tool: toolData.tool
      });
    }
    
    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get tools by module
   */
  getToolsByModule() {
    this.initialize();
    
    const byModule = new Map();
    
    for (const tool of this.getAllTools()) {
      if (!byModule.has(tool.module)) {
        byModule.set(tool.module, []);
      }
      byModule.get(tool.module).push(tool);
    }
    
    return byModule;
  }

  /**
   * Get total count
   */
  getCount() {
    this.initialize();
    return this.toolMap.size;
  }
}

export default GlobalToolRegistry;