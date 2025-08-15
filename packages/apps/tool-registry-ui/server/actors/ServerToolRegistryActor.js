/**
 * ServerToolRegistryActor - Server-side actor for tool registry operations
 */

export class ServerToolRegistryActor {
  constructor(toolRegistry, mongoProvider) {
    this.toolRegistry = toolRegistry;
    this.mongoProvider = mongoProvider;
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
      // Load tools from database
      const tools = await this.mongoProvider.listTools({ limit: 1000 });
      
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
      // Load modules from database
      const modules = await this.mongoProvider.listModules({ limit: 100 });
      
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
      // Get perspectives from database
      const perspectives = await this.mongoProvider.databaseService.mongoProvider.find(
        'tool_perspectives',
        { toolName },
        { limit: 100 }
      );
      
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
      console.log('🔧 Loading all modules from file system using ModuleLoader...');
      
      // Import ModuleLoader directly from the loading module
      const moduleLoaderModule = await import('@legion/tools-registry/src/loading/ModuleLoader.js');
      const ModuleLoader = moduleLoaderModule.ModuleLoader || moduleLoaderModule.default;
      
      // Create ModuleLoader with ToolRegistry's ResourceManager
      const moduleLoader = new ModuleLoader({
        resourceManager: this.toolRegistry.resourceManager,
        verbose: true
      });
      
      // Load all modules from the registry
      const result = await moduleLoader.loadModules();
      
      console.log(`📊 Module loading complete: ${result.summary.loaded} loaded, ${result.summary.failed} failed`);
      
      // Save loaded modules and tools to database
      for (const { config, instance } of result.loaded) {
        let tools = [];
        try {
          tools = instance.getTools ? instance.getTools() : [];
          // Ensure tools is an array
          if (!Array.isArray(tools)) {
            console.warn(`Module ${config.name} returned non-array tools:`, tools);
            tools = [];
          }
        } catch (error) {
          console.warn(`Error getting tools from module ${config.name}:`, error.message);
          tools = [];
        }
        
        // Save module to database
        const moduleDoc = {
          name: config.name,
          description: instance.description || config.description || `${config.name} module`,
          status: 'active',
          toolCount: tools.length,
          type: config.type,
          path: config.path,
          updatedAt: new Date()
        };
        
        await this.mongoProvider.databaseService.mongoProvider.update(
          'modules', 
          { name: config.name }, 
          { $set: moduleDoc }, 
          { upsert: true }
        );
        
        // Save tools to database
        for (const tool of tools) {
          const toolDoc = {
            name: tool.name,
            description: tool.description || 'No description',
            moduleName: config.name,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema || {},
            hasExecute: typeof tool.execute === 'function',
            updatedAt: new Date()
          };
          
          await this.mongoProvider.databaseService.mongoProvider.update(
            'tools', 
            { name: tool.name }, 
            { $set: toolDoc }, 
            { upsert: true }
          );
        }
      }
      
      // Send results to client
      if (this.remoteActor) {
        console.log('📤 Sending registry:loadAllComplete to client with data:', {
          loaded: result.summary.loaded,
          failed: result.summary.failed,
          total: result.summary.total,
          resultsCount: result.loaded.length + result.failed.length
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
      const [modules, tools, perspectives] = await Promise.all([
        this.mongoProvider.databaseService.mongoProvider.count('modules'),
        this.mongoProvider.databaseService.mongoProvider.count('tools'),
        this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives')
      ]);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:stats',
          data: {
            modules,
            tools,
            perspectives,
            timestamp: new Date()
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
      console.log('🔮 Generating perspectives using ToolRegistry LoadingManager...');
      
      // Send progress update to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesProgress',
          data: { status: 'Starting perspective generation...', percentage: 0 }
        });
      }
      
      // Import LoadingManager
      const { LoadingManager } = await import('@legion/tools-registry/src/loading/LoadingManager.js');
      
      // Create LoadingManager with ToolRegistry's ResourceManager
      const loadingManager = new LoadingManager({
        verbose: true,
        resourceManager: this.toolRegistry.resourceManager
      });
      
      // Initialize LoadingManager
      await loadingManager.initialize();
      
      // Send progress update
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesProgress',
          data: { status: 'Loading modules...', percentage: 25 }
        });
      }
      
      // First load modules, then generate perspectives
      console.log('📦 Loading modules first before generating perspectives...');
      const loadResult = await loadingManager.loadModules();
      console.log(`📊 Loaded ${loadResult.modulesLoaded} modules, added ${loadResult.toolsAdded} tools`);
      
      // Send progress update
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesProgress',
          data: { status: 'Generating perspectives...', percentage: 50 }
        });
      }
      
      // Generate perspectives for all tools with error handling
      let result;
      try {
        result = await loadingManager.generatePerspectives({ all: true });
      } catch (embeddingError) {
        console.error('ONNX Embedding error during perspective generation:', embeddingError.message);
        
        // If it's the device error, create mock perspectives without embeddings
        if (embeddingError.message.includes('Specified device is not supported') || 
            embeddingError.stack?.includes('Specified device is not supported')) {
          
          console.log('🔧 ONNX device compatibility issue detected. Creating mock perspectives without embeddings...');
          
          // Send progress update
          if (this.remoteActor) {
            this.remoteActor.receive({
              type: 'registry:perspectivesProgress',
              data: { status: 'Creating fallback perspectives (no embeddings)...', percentage: 75 }
            });
          }
          
          // Create mock perspectives for tools without ONNX embeddings
          const tools = await this.mongoProvider.listTools({ limit: 1000 });
          let perspectivesGenerated = 0;
          
          for (const tool of tools) {
            try {
              // Create mock perspective document in database
              const mockPerspective = {
                toolId: tool._id,
                toolName: tool.name,
                perspectiveType: 'technical_summary',
                content: `Technical perspective for ${tool.name}: ${tool.description || 'No description available'}`,
                // No embedding field - indicating this is a fallback perspective
                metadata: {
                  fallback: true,
                  reason: 'ONNX device compatibility issue',
                  generated: new Date()
                },
                createdAt: new Date()
              };
              
              await this.mongoProvider.databaseService.mongoProvider.update(
                'tool_perspectives',
                { toolId: tool._id, perspectiveType: 'technical_summary' },
                { $set: mockPerspective },
                { upsert: true }
              );
              
              perspectivesGenerated++;
            } catch (perspectiveError) {
              console.warn(`Failed to create mock perspective for ${tool.name}:`, perspectiveError.message);
            }
          }
          
          result = { 
            perspectivesGenerated, 
            toolsProcessed: tools.length,
            fallback: true,
            reason: 'ONNX device compatibility - created perspectives without embeddings'
          };
          
          console.log(`✅ Created ${perspectivesGenerated} fallback perspectives for ${tools.length} tools`);
        } else {
          // Re-throw other errors
          throw embeddingError;
        }
      }
      
      console.log(`✅ Perspective generation complete: ${result.perspectivesGenerated} perspectives generated for ${result.toolsProcessed} tools`);
      
      // Send success message to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesComplete',
          data: {
            perspectivesGenerated: result.perspectivesGenerated,
            toolsProcessed: result.toolsProcessed,
            timestamp: new Date()
          }
        });
      }
      
      // Send updated stats
      await this.getRegistryStats();
      
      // Clean up LoadingManager
      await loadingManager.close();
      
    } catch (error) {
      console.error('Failed to generate perspectives:', error);
      console.error('Error stack:', error.stack);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:perspectivesFailed',
          data: { 
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
          }
        });
      }
    }
  }

  async clearDatabase() {
    try {
      console.log('🗑️ Clearing all tools and modules from database...');
      
      // Delete all documents from collections
      const [toolsDeleted, modulesDeleted, perspectivesDeleted] = await Promise.all([
        this.mongoProvider.databaseService.mongoProvider.delete('tools', {}),
        this.mongoProvider.databaseService.mongoProvider.delete('modules', {}),
        this.mongoProvider.databaseService.mongoProvider.delete('tool_perspectives', {})
      ]);
      
      console.log(`✅ Database cleared: ${toolsDeleted} tools, ${modulesDeleted} modules, ${perspectivesDeleted} perspectives deleted`);
      
      // Send success message to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'registry:clearComplete',
          data: {
            toolsDeleted,
            modulesDeleted,
            perspectivesDeleted,
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
      
      // Import ModuleLoader and fs
      const moduleLoaderModule = await import('@legion/tools-registry/src/loading/ModuleLoader.js');
      const ModuleLoader = moduleLoaderModule.ModuleLoader || moduleLoaderModule.default;
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create ModuleLoader
      const moduleLoader = new ModuleLoader({
        resourceManager: this.toolRegistry.resourceManager,
        verbose: true
      });
      
      // Initialize ModuleLoader to set up paths
      await moduleLoader.initialize();
      
      // Read the module registry to find the module config
      const registryPath = path.join(moduleLoader.monorepoRoot, 'packages/tools/src/loading/module-registry.json');
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      const modules = JSON.parse(registryContent);
      
      // Find the module config by name
      const moduleConfig = modules.find(m => 
        m.name.toLowerCase() === moduleName.toLowerCase()
      );
      
      if (!moduleConfig) {
        throw new Error(`Module ${moduleName} not found in registry`);
      }
      
      // Load the specific module with its config
      const instance = await moduleLoader.loadModule(moduleConfig);
      
      if (instance) {
        const config = moduleConfig;
        
        // Get tools from module
        let tools = [];
        try {
          tools = instance.getTools ? instance.getTools() : [];
          if (!Array.isArray(tools)) {
            console.warn(`Module ${moduleName} returned non-array tools:`, tools);
            tools = [];
          }
        } catch (error) {
          console.warn(`Error getting tools from module ${moduleName}:`, error.message);
          tools = [];
        }
        
        // Save module to database
        const moduleDoc = {
          name: config.name,
          description: instance.description || config.description || `${config.name} module`,
          status: 'active',
          toolCount: tools.length,
          type: config.type,
          path: config.path,
          updatedAt: new Date()
        };
        
        await this.mongoProvider.databaseService.mongoProvider.update(
          'modules',
          { name: config.name },
          { $set: moduleDoc },
          { upsert: true }
        );
        
        // Save tools to database
        for (const tool of tools) {
          const toolDoc = {
            name: tool.name,
            description: tool.description || 'No description',
            moduleName: config.name,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema || {},
            hasExecute: typeof tool.execute === 'function',
            updatedAt: new Date()
          };
          
          await this.mongoProvider.databaseService.mongoProvider.update(
            'tools',
            { name: tool.name },
            { $set: toolDoc },
            { upsert: true }
          );
        }
        
        console.log(`✅ Module ${moduleName} loaded successfully with ${tools.length} tools`);
        
        // Send success message to client
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'module:loadComplete',
            data: {
              module: config.name,
              tools: tools.length,
              success: true
            }
          });
        }
        
        // Reload tools and modules lists
        await this.loadTools();
        await this.loadModules();
        
      } else {
        throw new Error(`Failed to load module ${moduleName}`);
      }
      
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