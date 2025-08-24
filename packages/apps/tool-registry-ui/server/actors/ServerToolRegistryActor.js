/**
 * ServerToolRegistryActor - Server-side actor for tool registry operations
 * 
 * Refactored to use ToolRegistry singleton instead of direct MongoDB access
 */

export class ServerToolRegistryActor {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'tools:load':
          await this.loadTools();
          break;
          
        case 'modules:load':
          await this.loadModules();
          break;
          
        case 'registry:loadAll':
          await this.loadAllModulesFromFileSystem();
          break;
          
        case 'registry:stats':
          await this.getRegistryStats();
          break;
          
        case 'registry:generatePerspectives':
          await this.generatePerspectives();
          break;
          
        case 'registry:clear':
          await this.clearDatabase();
          break;
          
        case 'module:load':
          await this.loadSingleModule(data.moduleName);
          break;
          
        case 'tool:execute':
          await this.executeTool(data.toolName, data.params);
          break;
          
        case 'tool:get-perspectives':
          await this.getToolPerspectives(data.toolName);
          break;
          
        default:
          console.log('Unknown tool registry message:', type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'error',
          data: { error: error.message }
        });
      }
    }
  }

  async loadTools() {
    try {
      // Load tools from ToolRegistry
      const tools = await this.toolRegistry.listTools({ limit: 1000 });
      
      // Send tools to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'tools:list',
          data: { tools }
        });
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
      throw error;
    }
  }

  async loadModules() {
    try {
      // Load modules from ToolRegistry
      const modules = await this.toolRegistry.listModules({ limit: 100 });
      
      // Send modules to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'modules:list',
          data: { modules }
        });
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
      throw error;
    }
  }

  async executeTool(toolName, params) {
    try {
      // Get tool from registry
      const tool = await this.toolRegistry.getTool(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Execute tool
      const result = await tool.execute(params);
      
      // Send result to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'tool:executed',
          data: {
            toolName,
            params,
            result
          }
        });
      }
    } catch (error) {
      console.error('Tool execution failed:', error);
      throw error;
    }
  }

  async getToolPerspectives(toolName) {
    try {
      // Get tool with perspectives from ToolRegistry
      const toolWithPerspectives = await this.toolRegistry.getToolWithPerspectives(toolName);
      const perspectives = toolWithPerspectives?.perspectives || [];
      
      // Send perspectives to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'tool:perspectives',
          data: {
            toolName,
            perspectives
          }
        });
      }
    } catch (error) {
      console.error('Failed to get tool perspectives:', error);
      // Return empty array on error
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'tool:perspectives',
          data: {
            toolName,
            perspectives: []
          }
        });
      }
    }
  }

  async loadAllModulesFromFileSystem() {
    try {
      console.log('🔧 Loading all modules using ToolRegistry...');
      
      // Discover and load all modules using ToolRegistry
      const discoverResult = await this.toolRegistry.discoverModules();
      console.log(`📊 Module discovery complete: ${discoverResult.discovered} modules found`);
      
      const loadResult = await this.toolRegistry.loadAllModules();
      console.log(`📊 Module loading complete: ${loadResult.successful} loaded, ${loadResult.failed} failed`);
      
      // Send results to client
      if (this.remoteActor) {
        console.log('📤 Sending registry:loadAllComplete to client');
        this.remoteActor.receive({
          type: 'registry:loadAllComplete',
          data: {
            loaded: loadResult.successful,
            failed: loadResult.failed,
            total: loadResult.total,
            results: [
              ...loadResult.loadedModules.map(m => ({
                module: m.name,
                status: 'success',
                tools: m.tools
              })),
              ...loadResult.failedModules.map(m => ({
                module: m.name,
                status: 'failed',
                error: m.error
              }))
            ]
          }
        });
      }
      
      // Reload lists to send updated data to client
      await this.loadTools();
      await this.loadModules();
      
    } catch (error) {
      console.error('Failed to load all modules:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:loadAllFailed',
          data: { error: error.message }
        });
      }
    }
  }

  async getRegistryStats() {
    try {
      // Get statistics from ToolRegistry
      const stats = await this.toolRegistry.getStatistics();
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:stats',
          data: {
            modules: stats.modules || 0,
            tools: stats.tools || 0,
            perspectives: stats.perspectives || 0,
            timestamp: new Date(),
            ...stats
          }
        });
      }
    } catch (error) {
      console.error('Failed to get registry stats:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:stats',
          data: {
            modules: 0,
            tools: 0,
            perspectives: 0,
            error: error.message
          }
        });
      }
    }
  }

  async generatePerspectives() {
    try {
      console.log('🔮 Generating perspectives using ToolRegistry...');
      
      // Send progress update to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesProgress',
          data: { status: 'Starting perspective generation...', percentage: 0 }
        });
      }
      
      // Use ToolRegistry's built-in perspective generation
      // This is handled internally by the ToolRegistry
      const result = await this.toolRegistry.generateAllPerspectives();
      
      console.log(`✅ Perspective generation complete: ${result.generated} perspectives generated for ${result.tools} tools`);
      
      // Send success message to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesComplete',
          data: {
            perspectivesGenerated: result.generated,
            toolsProcessed: result.tools,
            timestamp: new Date()
          }
        });
      }
      
      // Send updated stats
      await this.getRegistryStats();
      
    } catch (error) {
      console.error('Failed to generate perspectives:', error);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesFailed',
          data: { 
            error: error.message
          }
        });
      }
    }
  }

  async clearDatabase() {
    try {
      console.log('🗑️ Clearing all tools and modules using ToolRegistry...');
      
      // Use ToolRegistry's clear method
      const result = await this.toolRegistry.clearAll();
      
      console.log(`✅ Database cleared: ${result.toolsDeleted} tools, ${result.modulesDeleted} modules, ${result.perspectivesDeleted} perspectives deleted`);
      
      // Send success message to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:clearComplete',
          data: {
            toolsDeleted: result.toolsDeleted || 0,
            modulesDeleted: result.modulesDeleted || 0,
            perspectivesDeleted: result.perspectivesDeleted || 0,
            timestamp: new Date()
          }
        });
      }
      
      // Send updated stats
      await this.getRegistryStats();
      
    } catch (error) {
      console.error('Failed to clear database:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:clearFailed',
          data: { error: error.message }
        });
      }
    }
  }

  async loadSingleModule(moduleName) {
    try {
      console.log(`📦 Loading single module: ${moduleName}`);
      
      // Use ToolRegistry to load the specific module
      const result = await this.toolRegistry.loadModule(moduleName);
      
      console.log(`✅ Module ${moduleName} loaded successfully with ${result.tools} tools`);
      
      // Send success message to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'module:loadComplete',
          data: {
            module: moduleName,
            tools: result.tools || 0,
            success: true
          }
        });
      }
      
      // Reload tools and modules lists
      await this.loadTools();
      await this.loadModules();
      
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'module:loadFailed',
          data: {
            module: moduleName,
            error: error.message
          }
        });
      }
    }
  }
}