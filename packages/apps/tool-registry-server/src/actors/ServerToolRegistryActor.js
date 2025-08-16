/**
 * ServerToolRegistryActor
 * Server-side actor for tool registry operations
 * Uses singleton ToolRegistry and its loader
 */

export class ServerToolRegistryActor {
  constructor(registryService) {
    this.registryService = registryService;
    this.registry = registryService.getRegistry();
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
          data: { 
            error: error.message,
            stack: error.stack,
            originalType: type
          }
        });
      }
    }
  }

  async loadTools() {
    try {
      console.log('Loading tools from database...');
      
      // Use registry service to load tools
      const tools = await this.registryService.loadTools({ limit: 1000 });
      
      console.log(`Loaded ${tools.length} tools`);
      
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
      console.log('Loading modules from database...');
      
      // Use registry service to load modules
      const modules = await this.registryService.loadModules({ limit: 100 });
      
      console.log(`Loaded ${modules.length} modules`);
      
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

  async loadSingleModule(moduleName) {
    try {
      console.log(`Loading module: ${moduleName}`);
      
      // Use the loader to load a specific module
      const loader = await this.registryService.getLoader();
      
      // The loader's loadModuleByName method if available
      if (loader.loadModuleByName) {
        const result = await loader.loadModuleByName(moduleName);
        
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'module:loaded',
            data: {
              moduleName,
              success: true,
              result
            }
          });
        }
      } else {
        throw new Error('Module loading not supported');
      }
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'module:loaded',
          data: {
            moduleName,
            success: false,
            error: error.message
          }
        });
      }
    }
  }

  async executeTool(toolName, params) {
    try {
      console.log(`Executing tool: ${toolName}`);
      
      // Use registry service to execute tool
      const result = await this.registryService.executeTool(toolName, params);
      
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
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'tool:executed',
          data: {
            toolName,
            params,
            error: error.message,
            success: false
          }
        });
      }
    }
  }

  async getToolPerspectives(toolName) {
    try {
      console.log(`Getting perspectives for tool: ${toolName}`);
      
      // Use registry service to get perspectives
      const perspectives = await this.registryService.getToolPerspectives(toolName);
      
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
      console.log('🔧 Loading all modules from file system...');
      
      // Send loading started event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:loadAllStarted',
          data: {}
        });
      }
      
      // Use registry service to load all modules
      const result = await this.registryService.loadAllModulesFromFileSystem();
      
      console.log(`📊 Module loading complete: ${result.summary.loaded} loaded, ${result.summary.failed} failed`);
      
      // Send completion event with results
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:loadAllProgress',
          data: {
            message: `Loaded ${result.summary.loaded} modules, ${result.summary.failed} failed`,
            loaded: result.summary.loaded,
            failed: result.summary.failed,
            total: result.summary.total
          }
        });
        
        this.remoteActor.receive({
          type: 'registry:loadAllComplete',
          data: {
            loaded: result.summary.loaded,
            failed: result.summary.failed,
            total: result.summary.total,
            results: [
              ...result.loaded.map(m => {
                let toolCount = 0;
                try {
                  const tools = m.instance.getTools ? m.instance.getTools() : [];
                  toolCount = Array.isArray(tools) ? tools.length : 0;
                } catch (e) {
                  toolCount = 0;
                }
                return {
                  module: m.config.name,
                  status: 'success',
                  tools: toolCount
                };
              }),
              ...result.failed.map(m => ({
                module: m.config.name,
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
      console.log('Getting registry statistics...');
      
      // Use registry service to get stats
      const stats = await this.registryService.getRegistryStats();
      
      // Get counts from provider
      const provider = this.registryService.getProvider();
      let counts = {
        modules: 0,
        tools: 0,
        perspectives: 0
      };
      
      if (provider && provider.db) {
        try {
          const [moduleCount, toolCount, perspectiveCount] = await Promise.all([
            provider.db.collection('modules').countDocuments(),
            provider.db.collection('tools').countDocuments(),
            provider.db.collection('tool_perspectives').countDocuments()
          ]);
          
          counts = {
            modules: moduleCount,
            tools: toolCount,
            perspectives: perspectiveCount
          };
        } catch (error) {
          console.error('Error getting database counts:', error);
        }
      }
      
      const fullStats = {
        ...stats,
        ...counts,
        timestamp: new Date().toISOString()
      };
      
      console.log('Registry stats:', fullStats);
      
      // Send stats to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:stats',
          data: fullStats
        });
      }
    } catch (error) {
      console.error('Failed to get registry stats:', error);
      throw error;
    }
  }

  async generatePerspectives() {
    try {
      console.log('Generating perspectives for tools...');
      
      // Send start event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesStarted',
          data: {}
        });
      }
      
      // Use registry service to generate perspectives
      const result = await this.registryService.generatePerspectives();
      
      console.log('Perspectives generated:', result);
      
      // Send completion event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesComplete',
          data: result
        });
      }
      
      // Reload stats to show new perspective count
      await this.getRegistryStats();
      
    } catch (error) {
      console.error('Failed to generate perspectives:', error);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesFailed',
          data: { error: error.message }
        });
      }
    }
  }

  async clearDatabase() {
    try {
      console.log('Clearing database...');
      
      // Send clearing started event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:clearStarted',
          data: {}
        });
      }
      
      // Use registry service to clear database
      await this.registryService.clearDatabase();
      
      console.log('Database cleared');
      
      // Send completion event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:clearComplete',
          data: {}
        });
      }
      
      // Reload empty lists
      await this.loadTools();
      await this.loadModules();
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
}