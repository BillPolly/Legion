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
}