/**
 * Tool Registry
 * Central registry for tool modules and discovery
 * Enhanced with MCP server support for automatic tool discovery and integration
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * ModuleProvider - Provides module instances
 */
export class ModuleProvider {
  constructor(config) {
    this.name = config.name;
    this.definition = config.definition;
    this.config = config.config || {};
    this.lazy = config.lazy || false;
    this.instance = null;
  }

  async getInstance() {
    if (!this.instance) {
      this.instance = await this.definition.create(this.config);
    }
    return this.instance;
  }

  async destroy() {
    if (this.instance && this.instance.cleanup) {
      await this.instance.cleanup();
    }
    this.instance = null;
  }

  getMetadata() {
    return this.definition.getMetadata();
  }
}

/**
 * ToolRegistry - Central registry for tools
 */
export class ToolRegistry {
  constructor(options = {}) {
    this.providers = new Map();
    this.instances = new Map();
    this.metadata = new Map();
    this.usageStats = new Map();
    this.toolIndex = null;
    this.capabilityMap = null;
    this.initialized = false;
    this.toolsDatabase = null;
    this.moduleCache = new Map(); // Cache for loaded module instances
    this.toolCache = new Map(); // Cache for individual tools
    
    // Database provider (for database operations like populateDatabase)
    this.provider = options.provider || null;
    
    // MCP Integration
    this.mcpServerRegistry = options.mcpServerRegistry;
    this.enableMCPIntegration = options.enableMCPIntegration !== false;
    this.mcpToolPrefix = options.mcpToolPrefix || 'mcp';
    
    // Enhanced search capabilities
    this.semanticSearch = options.semanticSearch;
    this.enableSemanticSearch = options.enableSemanticSearch !== false;
    
    // Initialize MCP integration if enabled
    if (this.enableMCPIntegration) {
      this.initializeMCPIntegration();
    }
  }

  /**
   * Initialize ToolRegistry by auto-discovering existing modules
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      if (this.provider) {
        // When we have a database provider, we don't need to pre-register modules
        // Tools will be loaded on-demand from the database
        console.log('✅ ToolRegistry initialized with database provider (lazy loading)');
      } else {
        // Only auto-register modules when no database provider is available
        await this.autoRegisterKnownModules();
        console.log(`✅ ToolRegistry initialized with ${this.metadata.size} filesystem modules`);
      }
      
      this.initialized = true;
      
    } catch (error) {
      console.error('Failed to initialize ToolRegistry:', error);
      throw error;
    }
  }

  /**
   * Auto-register modules from the tools database
   */
  async autoRegisterKnownModules() {
    // Load modules from the comprehensive tools database
    try {
      const toolsDbPath = new URL('./tools-database.json', import.meta.url).pathname;
      const toolsDb = JSON.parse(await fs.readFile(toolsDbPath, 'utf-8'));
      
      // Convert database entries to module list, prioritizing working modules
      const workingModules = [
        { name: 'file', path: '../file/index.js', type: 'class' },
        { name: 'calculator', path: '../calculator/index.js', type: 'class' },
        { name: 'json', path: '../json/index.js', type: 'class' },
        { name: 'command-executor', path: '../command-executor/module.json', type: 'module.json' },
        { name: 'server-starter', path: '../server-starter/module.json', type: 'module.json' },
        { name: 'http', path: './modules/HTTPModule.js', type: 'definition', className: 'HTTPModuleDefinition' },
        { name: 'utility', path: './modules/UtilityModule.js', type: 'definition', className: 'UtilityModuleDefinition' },
      ];

      console.log(`Loading ${workingModules.length} modules from tools database...`);
      
      for (const module of workingModules) {
        try {
          if (module.type === 'class') {
            await this.loadClassModule(module);
          } else if (module.type === 'module.json') {
            await this.loadJsonModule(module);
          } else if (module.type === 'definition') {
            await this.loadDefinitionModule(module);
          }
        } catch (error) {
          console.warn(`⚠️  Could not load module ${module.name}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Could not load tools database, falling back to hardcoded modules');
      // Fallback to original hardcoded list
      const knownModules = [
        { name: 'file', path: '../file/index.js', type: 'class' },
        { name: 'calculator', path: '../calculator/index.js', type: 'class' },
        { name: 'json', path: '../json/index.js', type: 'class' }
      ];
    
      for (const module of knownModules) {
        try {
          await this.loadClassModule(module);
        } catch (error) {
          console.warn(`⚠️  Could not load fallback module ${module.name}:`, error.message);
        }
      }
    }
  }

  /**
   * Load a class-based module
   */
  async loadClassModule(module) {
    const ModuleClass = await import(module.path);
    const moduleInstance = new (ModuleClass.default || ModuleClass)();
    
    // Get tools from module
    let tools = {};
    if (moduleInstance.getTools) {
      const toolArray = moduleInstance.getTools();
      for (const tool of toolArray) {
        tools[tool.name] = {
          name: tool.name,
          description: tool.description || 'No description available'
        };
      }
    }
    
    // Register metadata
    this.metadata.set(module.name, {
      name: module.name,
      description: `${module.name} module`,
      tools: tools
    });
    
    // Cache the instance
    this.moduleCache.set(module.name, moduleInstance);
    
    console.log(`📦 Registered class module: ${module.name} with ${Object.keys(tools).length} tools`);
  }

  /**
   * Load a JSON-based module
   */
  async loadJsonModule(module) {
    console.log(`📋 Loading JSON module: ${module.name}`);
    
    try {
      // Load the module.json file to get tool definitions
      const moduleJsonPath = path.resolve(path.join(path.dirname(import.meta.url.replace('file://', '')), module.path));
      const moduleJsonContent = await import('fs/promises').then(fs => fs.readFile(moduleJsonPath, 'utf8'));
      const moduleConfig = JSON.parse(moduleJsonContent);
      
      // Extract tools from the module configuration
      const tools = {};
      if (moduleConfig.tools && Array.isArray(moduleConfig.tools)) {
        for (const tool of moduleConfig.tools) {
          tools[tool.name] = {
            name: tool.name,
            description: tool.description,
            schema: tool.parameters || {},
            metadata: tool
          };
        }
      }
      
      // Register metadata with actual tool information
      this.metadata.set(module.name, {
        name: module.name,
        description: moduleConfig.description || `${module.name} module (JSON-based)`,
        tools: tools,
        type: 'json',
        config: moduleConfig
      });
      
      // Create a provider that creates a proper JSON module instance
      const provider = {
        getInstance: async () => {
          // Create a custom module instance for JSON modules
          const { Module } = await import('../compatibility.js');
          
          class JSONModule extends Module {
            constructor() {
              super(moduleConfig.name, {});
              this.config = moduleConfig;
              this.toolsMap = new Map();
              
              // Register all tools from the JSON configuration
              if (moduleConfig.tools && Array.isArray(moduleConfig.tools)) {
                for (const toolDef of moduleConfig.tools) {
                  this.toolsMap.set(toolDef.name, this.createJSONTool(toolDef));
                }
              }
            }
            
            createJSONTool(toolDef) {
              // Load the actual tool implementation based on the tool name
              if (toolDef.name === 'command_executor') {
                // Load the real CommandExecutor
                return this.createRealCommandExecutor();
              }
              
              // For other JSON tools, create a simple wrapper that matches the definition
              return {
                name: toolDef.name,
                description: toolDef.description,
                schema: toolDef.parameters || {},
                execute: async (params) => {
                  // This is a mock implementation - in a real system, this would
                  // execute the actual command or functionality defined in the JSON
                  console.log(`Executing JSON tool ${toolDef.name} with params:`, params);
                  return {
                    success: true,
                    message: `JSON tool ${toolDef.name} executed successfully`,
                    data: { toolName: toolDef.name, params }
                  };
                }
              };
            }
            
            createRealCommandExecutor() {
              // Create a wrapper that uses the real CommandExecutor
              return {
                name: 'command_executor',
                description: 'Execute a bash command in the terminal and return the output',
                schema: {
                  type: 'object',
                  properties: {
                    command: { type: 'string', description: 'The bash command to execute' },
                    timeout: { type: 'number', description: 'Optional timeout in milliseconds' }
                  },
                  required: ['command']
                },
                execute: async (params) => {
                  // Import and use the real CommandExecutor
                  const { CommandExecutor } = await import('../command-executor/index.js');
                  const executor = new CommandExecutor();
                  
                  try {
                    const result = await executor.execute(params.command, params.timeout);
                    return {
                      success: true,
                      message: 'Command executed successfully',
                      data: result
                    };
                  } catch (error) {
                    return {
                      success: false,
                      message: error.message,
                      error: error.message
                    };
                  }
                }
              };
            }
            
            getTool(name) {
              return this.toolsMap.get(name) || null;
            }
            
            getTools() {
              return Array.from(this.toolsMap.values());
            }
          }
          
          return new JSONModule();
        }
      };
      
      this.providers.set(module.name, provider);
      
      console.log(`✅ Registered JSON module: ${module.name} with ${Object.keys(tools).length} tools`);
      
    } catch (error) {
      console.warn(`Failed to load JSON module ${module.name}:`, error.message);
      
      // Fallback to basic registration
      this.metadata.set(module.name, {
        name: module.name,
        description: `${module.name} module (JSON-based)`,
        tools: {},
        type: 'json'
      });
    }
  }

  /**
   * Load a ModuleDefinition-based module
   */
  async loadDefinitionModule(module) {
    console.log(`🏗️  Loading definition module: ${module.name}`);
    
    try {
      // Import the module definition class
      const ModuleExports = await import(module.path);
      const DefinitionClass = ModuleExports[module.className];
      
      if (!DefinitionClass) {
        throw new Error(`Definition class ${module.className} not found in ${module.path}`);
      }
      
      // Create a provider for the module
      const provider = new ModuleProvider({
        name: module.name,
        definition: DefinitionClass,
        config: {},
        lazy: true
      });
      
      this.providers.set(module.name, provider);
      
      // Get metadata from the definition
      const metadata = DefinitionClass.getMetadata();
      
      // Register metadata
      this.metadata.set(module.name, {
        name: module.name,
        description: metadata.description,
        tools: metadata.tools,
        type: 'definition',
        version: metadata.version
      });
      
      console.log(`✅ Registered definition module: ${module.name} with ${Object.keys(metadata.tools).length} tools`);
      
    } catch (error) {
      console.warn(`Failed to load definition module ${module.name}:`, error.message);
      
      // Fallback to basic registration
      this.metadata.set(module.name, {
        name: module.name,
        description: `${module.name} module (definition-based)`,
        tools: {},
        type: 'definition'
      });
    }
  }

  /**
   * Initialize MCP integration
   */
  async initializeMCPIntegration() {
    if (!this.mcpServerRegistry) return;
    
    try {
      // Set up event listeners for MCP server events
      this.mcpServerRegistry.on('server-registered', async (info) => {
        await this.handleMCPServerRegistered(info);
      });
      
      this.mcpServerRegistry.on('server-unregistered', (info) => {
        this.handleMCPServerUnregistered(info);
      });
      
      this.mcpServerRegistry.on('tools-changed', async (info) => {
        await this.handleMCPToolsChanged(info);
      });
      
      // Register existing MCP servers
      const existingServers = this.mcpServerRegistry.getMCPServersStatus();
      for (const server of existingServers) {
        if (server.status === 'running') {
          await this.handleMCPServerRegistered({
            serverId: server.serverId,
            toolCount: server.toolCount
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize MCP integration:', error);
    }
  }
  
  /**
   * Handle MCP server registration
   */
  async handleMCPServerRegistered(info) {
    const { serverId } = info;
    
    try {
      // The MCPServerRegistry has already created the provider
      // We just need to ensure it's available for tool discovery
      this.invalidateCaches();
      
      console.log(`MCP server ${serverId} tools integrated into ToolRegistry`);
      
    } catch (error) {
      console.error(`Failed to handle MCP server registration for ${serverId}:`, error);
    }
  }
  
  /**
   * Handle MCP server unregistration
   */
  handleMCPServerUnregistered(info) {
    const { serverId } = info;
    
    // Clean up any MCP-specific caches
    this.invalidateCaches();
    
    console.log(`MCP server ${serverId} tools removed from ToolRegistry`);
  }
  
  /**
   * Handle MCP tools changed
   */
  async handleMCPToolsChanged(info) {
    const { serverId, toolsAdded, toolsRemoved } = info;
    
    // Invalidate caches to reflect tool changes
    this.invalidateCaches();
    
    console.log(`MCP server ${serverId} tools changed: +${toolsAdded.length} -${toolsRemoved.length}`);
  }
  
  /**
   * Search tools including MCP tools
   */
  async searchToolsWithMCP(query, options = {}) {
    // First, search regular tools
    const regularResults = await this.searchTools(query);
    
    // If MCP integration is enabled, also search MCP tools
    if (this.enableMCPIntegration && this.mcpServerRegistry) {
      try {
        const mcpResults = await this.mcpServerRegistry.searchMCPTools(query, {
          limit: options.mcpLimit || 10,
          categories: options.mcpCategories,
          ...options
        });
        
        // Combine and deduplicate results
        const combinedResults = [...regularResults];
        
        for (const mcpResult of mcpResults) {
          // Avoid duplicates
          if (!combinedResults.find(r => r.name === mcpResult.name)) {
            combinedResults.push({
              ...mcpResult,
              source: 'mcp',
              serverId: mcpResult.serverId
            });
          }
        }
        
        // Sort by relevance
        combinedResults.sort((a, b) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );
        
        return combinedResults;
        
      } catch (error) {
        console.warn('MCP tool search failed, returning regular results:', error);
        return regularResults;
      }
    }
    
    return regularResults;
  }
  
  /**
   * Get tool with MCP fallback
   */
  async getToolWithMCP(toolName) {
    // First try regular tool lookup
    const regularTool = await this.getTool(toolName);
    if (regularTool) {
      return regularTool;
    }
    
    // Try MCP tools if integration is enabled
    if (this.enableMCPIntegration && this.mcpServerRegistry) {
      try {
        return await this.mcpServerRegistry.executeMCPTool(toolName, {}, {
          returnProxy: true // Return the proxy instead of executing
        });
      } catch (error) {
        // Tool not found in MCP either
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * List all tools including MCP tools
   */
  async listToolsWithMCP() {
    const regularTools = await this.listTools();
    
    if (this.enableMCPIntegration && this.mcpServerRegistry) {
      try {
        const mcpTools = this.mcpServerRegistry.getAvailableMCPTools()
          .map(tool => `${this.mcpToolPrefix}.${tool.name}`);
        
        return [...regularTools, ...mcpTools];
      } catch (error) {
        console.warn('Failed to list MCP tools:', error);
        return regularTools;
      }
    }
    
    return regularTools;
  }
  
  /**
   * Get smart tool recommendations (includes MCP auto-install suggestions)
   */
  async getSmartToolRecommendations(taskDescription, options = {}) {
    const recommendations = {
      availableTools: [],
      installableServers: [],
      suggestions: []
    };
    
    // Search available tools (regular + MCP)
    const availableTools = await this.searchToolsWithMCP(taskDescription, {
      limit: options.maxTools || 10
    });
    recommendations.availableTools = availableTools;
    
    // If MCP integration is enabled and we have few results, suggest installable servers
    if (this.enableMCPIntegration && this.mcpServerRegistry && availableTools.length < 3) {
      try {
        const installableServers = await this.mcpServerRegistry.packageManager
          .getRecommendations(taskDescription, {
            maxRecommendations: options.maxServers || 5,
            includeInstalled: false
          });
        
        recommendations.installableServers = installableServers;
        
        // Create actionable suggestions
        if (installableServers.length > 0) {
          recommendations.suggestions.push({
            type: 'install-server',
            message: `Install ${installableServers[0].name} to get tools for: ${taskDescription}`,
            action: {
              type: 'install-mcp-server',
              serverId: installableServers[0].id,
              serverName: installableServers[0].name
            }
          });
        }
      } catch (error) {
        console.warn('Failed to get MCP server recommendations:', error);
      }
    }
    
    return recommendations;
  }
  
  /**
   * Execute tool with MCP fallback and auto-install
   */
  async executeToolSmart(toolName, arguments_, options = {}) {
    try {
      // Try regular tool execution first
      const tool = await this.getTool(toolName);
      if (tool) {
        return await tool.execute(arguments_);
      }
      
      // Try MCP tool execution
      if (this.enableMCPIntegration && this.mcpServerRegistry) {
        return await this.mcpServerRegistry.executeMCPTool(toolName, arguments_, {
          autoInstall: options.autoInstall,
          retry: options.retry
        });
      }
      
      throw new Error(`Tool '${toolName}' not found`);
      
    } catch (error) {
      if (error.message.includes('not found') && options.autoInstall) {
        // Try to suggest and potentially auto-install
        const recommendations = await this.getSmartToolRecommendations(toolName);
        
        if (recommendations.installableServers.length > 0) {
          throw new Error(
            `Tool '${toolName}' not found. Try installing: ${
              recommendations.installableServers.map(s => s.name).join(', ')
            }`
          );
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Invalidate caches (enhanced to handle MCP caches)
   */
  invalidateCaches() {
    this.toolIndex = null;
    this.capabilityMap = null;
    
    // Also invalidate MCP-related caches if applicable
    if (this.mcpServerRegistry && this.mcpServerRegistry.metadataExtractor) {
      this.mcpServerRegistry.metadataExtractor.clearCache();
    }
  }

  /**
   * Register a module with its tools
   */
  async registerModule(module, moduleName) {
    // Create metadata with tools
    const metadata = {
      name: moduleName,
      tools: {}
    };
    
    // Get tools from module and add to metadata
    if (module.getTools) {
      const tools = module.getTools();
      for (const tool of tools) {
        metadata.tools[tool.name] = {
          name: tool.name,
          description: tool.description
        };
      }
    }
    
    // Create a simple provider for the module
    const provider = {
      name: moduleName,
      getMetadata: () => metadata,
      getInstance: async () => module,
      lazy: false
    };
    
    return this.registerProvider(provider);
  }

  /**
   * Register a module provider
   */
  async registerProvider(provider) {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider ${provider.name} already registered`);
    }

    // Validate provider by attempting to get metadata
    const metadata = provider.getMetadata();
    if (!metadata || !metadata.name) {
      throw new Error('Invalid provider metadata');
    }

    this.providers.set(provider.name, provider);
    this.metadata.set(provider.name, metadata);

    // Create instance immediately if not lazy
    if (!provider.lazy) {
      try {
        const instance = await provider.getInstance();
        this.instances.set(provider.name, instance);
      } catch (error) {
        // Rollback registration on failure
        this.providers.delete(provider.name);
        this.metadata.delete(provider.name);
        throw error;
      }
    }

    // Invalidate caches
    this.toolIndex = null;
    this.capabilityMap = null;
  }

  /**
   * Unregister a provider
   */
  async unregisterProvider(name) {
    const provider = this.providers.get(name);
    if (!provider) return;

    // Destroy instance if exists
    if (this.instances.has(name)) {
      await this.destroyInstance(name);
    }

    this.providers.delete(name);
    this.metadata.delete(name);
    
    // Invalidate caches
    this.toolIndex = null;
    this.capabilityMap = null;
  }

  /**
   * Check if provider exists
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * List all provider names
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get module instance
   */
  async getInstance(moduleName) {
    if (!this.providers.has(moduleName)) {
      return null;
    }

    if (!this.instances.has(moduleName)) {
      const provider = this.providers.get(moduleName);
      const instance = await provider.getInstance();
      this.instances.set(moduleName, instance);
    }

    return this.instances.get(moduleName);
  }

  /**
   * Check if instance exists
   */
  hasInstance(moduleName) {
    return this.instances.has(moduleName);
  }

  /**
   * Destroy module instance
   */
  async destroyInstance(moduleName) {
    const instance = this.instances.get(moduleName);
    if (instance && instance.cleanup) {
      await instance.cleanup();
    }
    this.instances.delete(moduleName);
  }

  /**
   * List all available tools
   */
  async listTools() {
    const tools = [];
    
    for (const [moduleName, metadata] of this.metadata) {
      if (metadata.tools) {
        for (const toolName of Object.keys(metadata.tools)) {
          tools.push(`${moduleName}.${toolName}`);
        }
      }
    }
    
    return tools;
  }

  /**
   * Get a specific tool by simple name or full name
   * Implements proper caching flow: tool cache → database → module cache → load module → cache tool
   */
  async getTool(name) {
    // Auto-initialize if not done yet
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if name is valid
    if (!name || typeof name !== 'string') {
      return null;
    }
    
    // 1. Check tool cache first
    if (this.toolCache.has(name)) {
      this.trackUsage(name);
      return this.toolCache.get(name);
    }
    
    // 2. If we have a database provider, use the database-first approach
    if (this.provider) {
      return await this.getToolFromDatabase(name);
    }
    
    // 3. Fallback to file-based approach for modules without database
    return await this.getToolFromFilesystem(name);
  }

  /**
   * Get tool from database with proper caching flow
   */
  async getToolFromDatabase(name) {
    try {
      // Query database for tool metadata
      let toolMetadata;
      if (name.includes('.')) {
        const [moduleName, toolName] = name.split('.');
        toolMetadata = await this.provider.getTool(toolName, moduleName);
      } else {
        // Search by tool name only
        toolMetadata = await this.provider.getTool(name);
      }

      if (!toolMetadata) {
        return null;
      }

      // Get module name from the tool metadata
      const moduleName = toolMetadata.moduleName || toolMetadata.module;
      if (!moduleName) {
        console.warn(`Tool ${name} has no module reference in database`);
        return null;
      }

      // Check module cache
      let moduleInstance;
      if (this.moduleCache.has(moduleName)) {
        moduleInstance = this.moduleCache.get(moduleName);
      } else {
        // Load and cache the module
        moduleInstance = await this.loadModuleFromDatabase(moduleName);
        if (moduleInstance) {
          this.moduleCache.set(moduleName, moduleInstance);
        }
      }

      if (!moduleInstance) {
        console.warn(`Could not load module ${moduleName} for tool ${name}`);
        return null;
      }

      // Get the executable tool from the module
      let executableTool = null;
      const toolName = toolMetadata.name;
      
      if (moduleInstance.getTool) {
        executableTool = moduleInstance.getTool(toolName);
      } else if (moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        executableTool = tools.find(t => t.name === toolName);
        
        // If exact match not found, try to find by removing module prefix
        if (!executableTool) {
          const simpleToolName = toolName.replace(/_/g, '');
          executableTool = tools.find(t => {
            const simpleName = t.name.replace(/_/g, '');
            return simpleName === simpleToolName;
          });
        }
      }

      if (executableTool) {
        // Cache the executable tool
        this.toolCache.set(name, executableTool);
        this.trackUsage(name);
        return executableTool;
      } else {
        console.warn(`Failed to get tool ${toolName} from module ${moduleName}`);
      }

      return null;
    } catch (error) {
      console.warn(`Failed to get tool ${name} from database:`, error.message);
      return null;
    }
  }

  /**
   * Load module from database metadata
   */
  async loadModuleFromDatabase(moduleName) {
    try {
      // Get module metadata from database
      const moduleMetadata = await this.provider.getModule(moduleName);
      if (!moduleMetadata) {
        console.warn(`Module ${moduleName} not found in database`);
        return null;
      }

      // First check if the module is already cached
      if (this.moduleCache.has(moduleName)) {
        return this.moduleCache.get(moduleName);
      }

      // Try to load from known modules first (fallback to hardcoded list)
      // Map database module names to their file paths
      const knownModules = {
        'File': '../file/index.js',
        'Json': '../json/index.js',
        'Calculator': '../calculator/index.js',
        'CommandExecutor': '../command-executor/index.js',
        'ServerStarter': '../server-starter/index.js',
        // Legacy names for backward compatibility
        'FileModule': '../file/index.js',
        'JsonModule': '../json/index.js',
        'CalculatorModule': '../calculator/index.js',
        'CommandExecutorModule': '../command-executor/index.js',
        'ServerStarterModule': '../server-starter/index.js'
      };

      if (knownModules[moduleName]) {
        try {
          const ModuleClass = await import(knownModules[moduleName]);
          const moduleInstance = new (ModuleClass.default || ModuleClass)();
          this.moduleCache.set(moduleName, moduleInstance);
          return moduleInstance;
        } catch (error) {
          console.warn(`Failed to load known module ${moduleName}:`, error.message);
        }
      }

      // Load the module based on its type and path from database
      if (moduleMetadata.type === 'class' && moduleMetadata.path) {
        return await this.loadClassModuleFromPath(moduleMetadata.path);
      } else if (moduleMetadata.type === 'json' && moduleMetadata.path) {
        return await this.loadJsonModuleFromPath(moduleMetadata.path);
      } else if (moduleMetadata.type === 'definition' && moduleMetadata.path) {
        return await this.loadDefinitionModuleFromPath(moduleMetadata.path, moduleMetadata.className);
      }

      console.warn(`Unknown module type ${moduleMetadata.type} for module ${moduleName}`);
      return null;
    } catch (error) {
      console.warn(`Failed to load module ${moduleName} from database:`, error.message);
      return null;
    }
  }

  /**
   * Load class module from path
   */
  async loadClassModuleFromPath(modulePath) {
    const ModuleClass = await import(modulePath);
    return new (ModuleClass.default || ModuleClass)();
  }

  /**
   * Load JSON module from path
   */
  async loadJsonModuleFromPath(modulePath) {
    // This would implement JSON module loading logic
    // For now, return null as JSON modules need special handling
    console.warn(`JSON module loading from path ${modulePath} not yet implemented`);
    return null;
  }

  /**
   * Load definition module from path
   */
  async loadDefinitionModuleFromPath(modulePath, className) {
    const ModuleExports = await import(modulePath);
    const DefinitionClass = ModuleExports[className];
    if (DefinitionClass && DefinitionClass.create) {
      return await DefinitionClass.create({});
    }
    return null;
  }

  /**
   * Get tool from filesystem (fallback for modules without database)
   */
  async getToolFromFilesystem(name) {
    // Try to find tool across all registered modules
    if (!name.includes('.')) {
      for (const [moduleName, metadata] of this.metadata) {
        if (metadata.tools && metadata.tools[name]) {
          const tool = await this.loadToolFromModule(moduleName, name);
          if (tool) {
            this.toolCache.set(name, tool); // Cache the tool
            this.trackUsage(name);
            return tool;
          }
        }
      }
      return null;
    }
    
    // Full module.tool name
    const [moduleName, toolName] = name.split('.');
    
    if (!moduleName || !toolName) {
      return null;
    }

    const tool = await this.loadToolFromModule(moduleName, toolName);
    if (tool) {
      this.toolCache.set(name, tool); // Cache the tool
      this.trackUsage(name);
      return tool;
    }

    return null;
  }

  /**
   * Load a specific tool from a module with caching
   */
  async loadToolFromModule(moduleName, toolName) {
    try {
      // Check if module is cached
      let instance;
      if (this.moduleCache.has(moduleName)) {
        instance = this.moduleCache.get(moduleName);
      } else {
        // Lazy load the module
        instance = await this.getInstance(moduleName);
        if (instance) {
          this.moduleCache.set(moduleName, instance);
        }
      }

      if (!instance) {
        return null;
      }

      let tool = null;
      
      // Try getTool method first
      if (instance.getTool) {
        tool = instance.getTool(toolName);
      } else if (instance.getTools) {
        // Fallback: search through getTools() array
        const tools = instance.getTools();
        tool = tools.find(t => t.name === toolName) || null;
      }

      return tool;
    } catch (error) {
      console.warn(`Failed to load tool ${toolName} from module ${moduleName}:`, error);
      return null;
    }
  }

  /**
   * Search tools by criteria
   */
  async searchTools(criteria) {
    const allTools = await this.listTools();
    const results = [];

    for (const toolName of allTools) {
      const [moduleName, tool] = toolName.split('.');
      
      // Search by module
      if (criteria.module && moduleName === criteria.module) {
        results.push(toolName);
        continue;
      }

      // Search by capability (simple text match)
      if (criteria.capability) {
        const metadata = await this.getToolMetadata(toolName);
        if (metadata && metadata.description) {
          const desc = metadata.description.toLowerCase();
          if (desc.includes(criteria.capability.toLowerCase())) {
            results.push(toolName);
          }
        }
      }

      // Search by tags
      if (criteria.tags) {
        const metadata = await this.getToolMetadata(toolName);
        if (metadata && metadata.tags) {
          const hasTag = criteria.tags.some(tag => 
            metadata.tags.includes(tag)
          );
          if (hasTag) {
            results.push(toolName);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get tool metadata
   */
  async getToolMetadata(fullName) {
    const [moduleName, toolName] = fullName.split('.');
    
    const moduleMetadata = this.metadata.get(moduleName);
    if (!moduleMetadata || !moduleMetadata.tools) {
      return null;
    }

    return moduleMetadata.tools[toolName];
  }

  /**
   * Get module metadata
   */
  async getModuleMetadata(moduleName) {
    return this.metadata.get(moduleName);
  }

  /**
   * Get all metadata
   */
  async getAllMetadata() {
    const modules = [];
    let totalTools = 0;
    const capabilities = new Set();

    for (const [name, metadata] of this.metadata) {
      modules.push({
        name,
        ...metadata
      });

      if (metadata.tools) {
        totalTools += Object.keys(metadata.tools).length;
        
        // Extract capabilities from descriptions
        for (const tool of Object.values(metadata.tools)) {
          if (tool.description) {
            const words = tool.description.toLowerCase().split(/\s+/);
            words.forEach(word => {
              if (word.length > 3) capabilities.add(word);
            });
          }
        }
      }
    }

    return {
      modules,
      totalTools,
      capabilities: Array.from(capabilities)
    };
  }

  /**
   * Get tool index
   */
  async getToolIndex() {
    if (this.toolIndex) {
      return this.toolIndex;
    }

    const index = {
      byModule: {},
      byOperation: {}
    };

    for (const [moduleName, metadata] of this.metadata) {
      if (metadata.tools) {
        index.byModule[moduleName] = Object.keys(metadata.tools);
        
        for (const [toolName, toolMeta] of Object.entries(metadata.tools)) {
          // Extract operation from tool name or description
          const operation = this.extractOperation(toolName, toolMeta.description);
          if (!index.byOperation[operation]) {
            index.byOperation[operation] = [];
          }
          index.byOperation[operation].push(`${moduleName}.${toolName}`);
        }
      }
    }

    this.toolIndex = index;
    return index;
  }

  /**
   * Get capability map
   */
  async getCapabilityMap() {
    if (this.capabilityMap) {
      return this.capabilityMap;
    }

    const map = {};

    for (const [moduleName, metadata] of this.metadata) {
      if (metadata.tools) {
        for (const [toolName, toolMeta] of Object.entries(metadata.tools)) {
          // Generate capability keys
          const capabilities = this.extractCapabilities(
            moduleName,
            toolName,
            toolMeta
          );
          
          for (const capability of capabilities) {
            if (!map[capability]) {
              map[capability] = [];
            }
            map[capability].push(`${moduleName}.${toolName}`);
          }
        }
      }
    }

    this.capabilityMap = map;
    return map;
  }

  /**
   * Track tool usage
   */
  trackUsage(toolName) {
    if (!this.usageStats.has(toolName)) {
      this.usageStats.set(toolName, {
        count: 0,
        firstUsed: Date.now(),
        lastUsed: null
      });
    }

    const stats = this.usageStats.get(toolName);
    stats.count++;
    stats.lastUsed = Date.now();
  }

  /**
   * Get usage statistics
   */
  async getUsageStats() {
    const stats = {};
    for (const [tool, data] of this.usageStats) {
      stats[tool] = { ...data };
    }
    return stats;
  }

  /**
   * Domain-based tool filtering - Simple keyword-based approach
   */
  
  // Domain mappings - predefined sets of tools for common domains
  static DOMAIN_MAPPINGS = {
    // File and content operations
    'files': [
      'FileSystemModule.readFile', 
      'FileSystemModule.writeFile', 
      'FileSystemModule.appendFile', 
      'FileSystemModule.deleteFile', 
      'FileSystemModule.exists', 
      'FileSystemModule.mkdir',
      'FileSystemModule.rmdir',
      'FileSystemModule.listFiles',
      'FileSystemModule.copyFile',
      'FileSystemModule.moveFile'
    ],
    
    // Web and frontend development
    'web': [
      'FileSystemModule.writeFile', 
      'FileSystemModule.readFile', 
      'FileSystemModule.mkdir',
      'HTTPModule.get', 
      'HTTPModule.post',
      'APIGenerator.APIGenerator'
    ],
    'frontend': [
      'FileSystemModule.writeFile', 
      'FileSystemModule.readFile', 
      'FileSystemModule.mkdir',
      'FileSystemModule.copyFile'
    ],
    'website': [
      'FileSystemModule.writeFile', 
      'FileSystemModule.readFile', 
      'FileSystemModule.mkdir',
      'HTTPModule.get'
    ],
    
    // API and HTTP operations  
    'api': [
      'HTTPModule.get', 
      'HTTPModule.post', 
      'HTTPModule.put', 
      'HTTPModule.delete', 
      'HTTPModule.patch',
      'APIGenerator.APIGenerator'
    ],
    'http': [
      'HTTPModule.get', 
      'HTTPModule.post', 
      'HTTPModule.put', 
      'HTTPModule.delete',
      'HTTPModule.uploadFile',
      'HTTPModule.downloadFile'
    ],
    
    // Version control
    'git': [
      'GitModule.clone', 
      'GitModule.commit', 
      'GitModule.push', 
      'GitModule.pull', 
      'GitModule.status',
      'GitModule.branch',
      'GitModule.merge',
      'GitModule.add'
    ],
    'deploy': [
      'GitModule.push', 
      'HTTPModule.post', 
      'FileSystemModule.readFile',
      'GitModule.status'
    ],
    'deployment': [
      'GitModule.push', 
      'HTTPModule.post', 
      'HTTPModule.put',
      'FileSystemModule.readFile'
    ],
    
    // Development workflows
    'development': [
      'FileSystemModule.writeFile', 
      'FileSystemModule.readFile', 
      'FileSystemModule.mkdir',
      'GitModule.commit', 
      'GitModule.push',
      'GitModule.add',
      'ClassGenerator.ClassGenerator',
      'APIGenerator.APIGenerator'
    ],
    'project': [
      'FileSystemModule.mkdir', 
      'FileSystemModule.writeFile', 
      'FileSystemModule.readFile',
      'GitModule.init'
    ],
    
    // Code generation and development
    'code': [
      'FileSystemModule.writeFile',
      'FileSystemModule.readFile', 
      'ClassGenerator.ClassGenerator',
      'TestSuiteGenerator.TestSuiteGenerator'
    ],
    'testing': [
      'TestSuiteGenerator.TestSuiteGenerator'
    ],
    
    // Content creation
    'content': [
      'FileSystemModule.writeFile',
      'FileSystemModule.readFile',
      'FileSystemModule.appendFile'
    ],
    'document': [
      'FileSystemModule.writeFile',
      'FileSystemModule.readFile',
      'FileSystemModule.appendFile'
    ]
  };

  // Goal keyword mappings to domains
  static GOAL_KEYWORDS = {
    'web': ['website', 'web', 'html', 'css', 'frontend', 'page', 'site'],
    'api': ['api', 'request', 'endpoint', 'service', 'rest'],
    'files': ['file', 'document', 'content', 'write', 'read', 'create'],
    'git': ['repository', 'repo', 'commit', 'git', 'version', 'branch'],
    'deploy': ['deploy', 'deployment', 'production', 'server', 'publish'],
    'development': ['project', 'code', 'develop', 'build', 'setup', 'system'],
    'frontend': ['frontend', 'ui', 'interface', 'client'],
    'website': ['website', 'site', 'webpage', 'portal'],
    'content': ['content', 'article', 'text', 'documentation'],
    'document': ['document', 'doc', 'report', 'readme'],
    'code': ['class', 'function', 'method', 'code', 'generate', 'create', 'user'],
    'testing': ['test', 'testing', 'coverage', 'spec', 'suite']
  };

  /**
   * Get tools for specific domains
   * @param {Array<string>} domains - Array of domain names
   * @returns {Promise<Array<string>>} Array of tool names (without duplicates)
   */
  async getToolsForDomains(domains) {
    const toolSet = new Set();
    
    for (const domain of domains) {
      const domainTools = ToolRegistry.DOMAIN_MAPPINGS[domain.toLowerCase()];
      if (domainTools) {
        domainTools.forEach(tool => toolSet.add(tool));
      }
    }
    
    // Filter to only include tools that are actually available in the registry
    const allAvailableTools = await this.listTools();
    const availableToolSet = new Set(allAvailableTools);
    
    const filteredTools = Array.from(toolSet).filter(tool => 
      availableToolSet.has(tool)
    );
    
    return filteredTools;
  }

  /**
   * Extract domains from a goal using simple keyword matching
   * @param {string} goal - The user's goal text
   * @returns {Array<string>} Array of detected domain names
   */
  extractDomainsFromGoal(goal) {
    const goalLower = goal.toLowerCase();
    const detectedDomains = new Set();
    
    // Check each domain's keywords against the goal
    for (const [domain, keywords] of Object.entries(ToolRegistry.GOAL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (goalLower.includes(keyword)) {
          detectedDomains.add(domain);
          break; // Found a match for this domain, move to next
        }
      }
    }
    
    // Default fallback: if no specific domains detected, include files as it's most common
    if (detectedDomains.size === 0) {
      detectedDomains.add('files');
    }
    
    return Array.from(detectedDomains);
  }

  /**
   * Get relevant tools for a goal using domain-based filtering
   * @param {string} goal - The user's goal
   * @param {Object} context - Additional context (optional)
   * @returns {Promise<Array>} Array of actual tool objects
   */
  async getRelevantToolsForGoal(goal, context = {}) {
    // 1. Extract domains from the goal
    const domains = this.extractDomainsFromGoal(goal);
    
    console.log(`[ToolRegistry] Detected domains for goal "${goal.substring(0, 50)}...": ${domains.join(', ')}`);
    
    // 2. Get tool names for those domains
    const toolNames = await this.getToolsForDomains(domains);
    
    console.log(`[ToolRegistry] Selected ${toolNames.length} tools: ${toolNames.join(', ')}`);
    
    // 3. Get actual tool objects
    const tools = [];
    for (const toolName of toolNames) {
      try {
        const tool = await this.getTool(toolName);
        if (tool) {
          tools.push(tool);
        }
      } catch (error) {
        console.warn(`[ToolRegistry] Could not load tool ${toolName}:`, error.message);
      }
    }
    
    return tools;
  }

  /**
   * Get available domains
   * @returns {Array<string>} List of available domain names
   */
  getAvailableDomains() {
    return Object.keys(ToolRegistry.DOMAIN_MAPPINGS);
  }

  /**
   * Get domain information including keywords and tools
   * @param {string} domain - Domain name
   * @returns {Object|null} Domain information or null if not found
   */
  getDomainInfo(domain) {
    const domainLower = domain.toLowerCase();
    
    return {
      name: domainLower,
      keywords: ToolRegistry.GOAL_KEYWORDS[domainLower] || [],
      tools: ToolRegistry.DOMAIN_MAPPINGS[domainLower] || [],
      available: (ToolRegistry.DOMAIN_MAPPINGS[domainLower] || []).length > 0
    };
  }

  /**
   * Get tool dependencies
   */
  async getToolDependencies(toolName) {
    // This is a simplified implementation
    // Real implementation would analyze tool requirements
    const dependencies = {
      'git.push': ['git.commit'],
      'git.commit': ['git.add'],
      'git.merge': ['git.fetch']
    };

    return dependencies[toolName] || [];
  }

  /**
   * Get module dependencies
   */
  async getModuleDependencies(moduleName) {
    // This would be defined in module metadata
    const dependencies = {
      'deployment': ['git', 'filesystem'],
      'backup': ['filesystem', 'http']
    };

    return dependencies[moduleName] || [];
  }

  /**
   * Order tools by dependency
   */
  async orderByDependency(tools) {
    // Simple topological sort
    const graph = {};
    const visited = new Set();
    const result = [];

    // Build dependency graph
    for (const tool of tools) {
      const deps = await this.getToolDependencies(tool);
      graph[tool] = deps.filter(d => tools.includes(d));
    }

    // DFS topological sort
    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);
      
      const deps = graph[node] || [];
      for (const dep of deps) {
        visit(dep);
      }
      
      result.push(node);
    };

    for (const tool of tools) {
      visit(tool);
    }

    return result;
  }

  /**
   * Populate database with all tools found in the repository
   * This method delegates to the provider's populateDatabase method
   */
  async populateDatabase(options = {}) {
    if (!this.provider) {
      throw new Error('No provider configured for database population');
    }

    if (typeof this.provider.populateDatabase !== 'function') {
      throw new Error('Provider does not support database population');
    }

    console.log('🔄 Starting database population...');
    const result = await this.provider.populateDatabase(options);
    
    // Invalidate caches after population
    this.invalidateCaches();
    
    console.log('✅ Database population completed');
    return result;
  }

  /**
   * Shutdown registry
   */
  async shutdown() {
    // Clean up all instances
    for (const [name, instance] of this.instances) {
      if (instance && instance.cleanup) {
        await instance.cleanup();
      }
    }
    
    this.instances.clear();
    this.providers.clear();
    this.metadata.clear();
    this.usageStats.clear();
    this.toolIndex = null;
    this.capabilityMap = null;
  }

  /**
   * Extract operation from tool name/description
   */
  extractOperation(toolName, description) {
    // Common operations
    const operations = ['read', 'write', 'get', 'post', 'delete', 'create', 'update'];
    
    const nameLower = toolName.toLowerCase();
    for (const op of operations) {
      if (nameLower.includes(op)) {
        return op;
      }
    }

    if (description) {
      const descLower = description.toLowerCase();
      for (const op of operations) {
        if (descLower.includes(op)) {
          return op;
        }
      }
    }

    return 'other';
  }

  /**
   * Extract capabilities from tool metadata
   */
  extractCapabilities(moduleName, toolName, metadata) {
    const capabilities = [];
    
    // Module-based capability
    capabilities.push(`${moduleName}:${toolName}`);
    
    // Operation-based capability
    const operation = this.extractOperation(toolName, metadata.description);
    capabilities.push(`${moduleName}:${operation}`);
    
    // Generic operation capability
    if (operation !== 'other') {
      capabilities.push(operation);
    }

    return capabilities;
  }
}

/**
 * ToolResolver - Resolves tools based on requirements
 */
export class ToolResolver {
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Resolve tool by exact name
   */
  async resolve(toolName) {
    return await this.registry.getTool(toolName);
  }

  /**
   * Resolve tool by capability description
   */
  async resolveByCapability(description) {
    // First try exact capability search
    let tools = await this.registry.searchTools({
      capability: description
    });

    // If no exact match, try searching for key words
    if (tools.length === 0) {
      const keywords = description.toLowerCase().split(/\s+/);
      for (const keyword of keywords) {
        tools = await this.registry.searchTools({
          capability: keyword
        });
        if (tools.length > 0) break;
      }
    }

    if (tools.length === 0) {
      return null;
    }

    // Return first match (could be improved with ranking)
    const tool = await this.registry.getTool(tools[0]);
    return tool;
  }

  /**
   * Resolve multiple tools for a capability
   */
  async resolveMultiple(description) {
    const toolNames = await this.registry.searchTools({
      capability: description.split(' ')[0] // Simple keyword extraction
    });

    const tools = [];
    for (const name of toolNames) {
      const tool = await this.registry.getTool(name);
      if (tool) tools.push(tool);
    }

    return tools;
  }

  /**
   * Rank tools by relevance to description
   */
  async rankTools(description, toolNames) {
    const scores = new Map();
    const keywords = description.toLowerCase().split(/\s+/);

    for (const toolName of toolNames) {
      let score = 0;
      
      // Check tool name match
      const nameLower = toolName.toLowerCase();
      for (const keyword of keywords) {
        if (nameLower.includes(keyword)) {
          score += 10;
        }
      }

      // Check metadata match
      const metadata = await this.registry.getToolMetadata(toolName);
      if (metadata && metadata.description) {
        const descLower = metadata.description.toLowerCase();
        for (const keyword of keywords) {
          if (descLower.includes(keyword)) {
            score += 5;
          }
        }
      }

      scores.set(toolName, score);
    }

    // Sort by score
    return toolNames.sort((a, b) => {
      return (scores.get(b) || 0) - (scores.get(a) || 0);
    });
  }

  /**
   * Suggest alternative tools
   */
  async suggestAlternatives(toolName) {
    const [moduleName] = toolName.split('.');
    
    // Get all tools from the same module
    const sameModule = await this.registry.searchTools({
      module: moduleName
    });

    // Filter out the original tool
    return sameModule.filter(t => t !== toolName);
  }
}