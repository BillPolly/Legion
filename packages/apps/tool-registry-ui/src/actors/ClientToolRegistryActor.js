/**
 * ClientToolRegistryActor - Client-side actor for tool registry operations
 * Communicates with ServerToolRegistryActor via WebSocket
 */

import { Actor } from '/legion/shared/actors/src/index.js';

export class ClientToolRegistryActor extends Actor {
  constructor(toolRegistryBrowser) {
    super();
    this.toolRegistryBrowser = toolRegistryBrowser;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🔗 ClientToolRegistryActor connected to server');
    
    // Immediately request tools and modules
    this.loadTools();
    this.loadModules();
  }

  async receive(message) {
    console.log('🎯 ClientToolRegistryActor.receive() called with:', message.type);
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'tools:list':
          console.log('📝 Processing tools:list message...');
          await this.handleToolsList(data.tools);
          console.log('✅ Finished processing tools:list message');
          break;
          
        case 'modules:list':
          console.log('📝 Processing modules:list message...');
          await this.handleModulesList(data.modules);
          console.log('✅ Finished processing modules:list message');
          break;
          
        case 'registry:loadAllComplete':
          console.log('✅ Registry load all complete:', data);
          // Check both locations for the callback
          const loadCompleteCallback = this.toolRegistryBrowser.onRegistryLoadComplete || 
                                       window.toolRegistryApp?.onRegistryLoadComplete;
          if (loadCompleteCallback) {
            loadCompleteCallback(data);
          }
          break;
          
        case 'registry:loadAllFailed':
          console.error('❌ Registry load all failed:', data.error);
          // Check both locations for the callback
          const loadFailedCallback = this.toolRegistryBrowser.onRegistryLoadFailed || 
                                     window.toolRegistryApp?.onRegistryLoadFailed;
          if (loadFailedCallback) {
            loadFailedCallback(data.error);
          }
          break;
          
        case 'registry:stats':
          console.log('📊 Registry stats:', data);
          // Check both locations for the callback
          const statsCallback = this.toolRegistryBrowser.onRegistryStats || 
                               window.toolRegistryApp?.onRegistryStats;
          if (statsCallback) {
            statsCallback(data);
          }
          break;
          
        case 'registry:clearComplete':
          console.log('✅ Database cleared:', data);
          const clearCompleteCallback = this.toolRegistryBrowser.onRegistryClearComplete || 
                                       window.toolRegistryApp?.onRegistryClearComplete;
          if (clearCompleteCallback) {
            clearCompleteCallback(data);
          }
          break;
          
        case 'registry:clearFailed':
          console.error('❌ Database clear failed:', data.error);
          const clearFailedCallback = this.toolRegistryBrowser.onRegistryClearFailed || 
                                     window.toolRegistryApp?.onRegistryClearFailed;
          if (clearFailedCallback) {
            clearFailedCallback(data.error);
          }
          break;
          
        case 'module:loadComplete':
          console.log('✅ Module loaded:', data);
          const moduleLoadCompleteCallback = this.toolRegistryBrowser.onModuleLoadComplete || 
                                            window.toolRegistryApp?.onModuleLoadComplete;
          if (moduleLoadCompleteCallback) {
            moduleLoadCompleteCallback(data);
          }
          break;
          
        case 'module:loadFailed':
          console.error('❌ Module load failed:', data);
          const moduleLoadFailedCallback = this.toolRegistryBrowser.onModuleLoadFailed || 
                                          window.toolRegistryApp?.onModuleLoadFailed;
          if (moduleLoadFailedCallback) {
            moduleLoadFailedCallback(data);
          }
          break;
          
        case 'registry:perspectivesProgress':
          console.log('🔄 Perspectives generation progress:', data.status, `${data.percentage}%`);
          const progressCallback = this.toolRegistryBrowser.onPerspectivesProgress || 
                                 window.toolRegistryApp?.onPerspectivesProgress;
          if (progressCallback) {
            progressCallback(data);
          }
          break;
          
        case 'registry:perspectivesComplete':
          console.log('✅ Perspectives generated:', data);
          const perspectivesCompleteCallback = this.toolRegistryBrowser.onPerspectivesComplete || 
                                             window.toolRegistryApp?.onPerspectivesComplete;
          if (perspectivesCompleteCallback) {
            perspectivesCompleteCallback(data);
          }
          break;
          
        case 'registry:perspectivesFailed':
          console.error('❌ Perspective generation failed:', data.error);
          console.error('Error details:', data.stack);
          const perspectivesFailedCallback = this.toolRegistryBrowser.onPerspectivesFailed || 
                                           window.toolRegistryApp?.onPerspectivesFailed;
          if (perspectivesFailedCallback) {
            perspectivesFailedCallback(data);
          }
          break;
          
        case 'tool:execute:result':
          await this.handleToolExecutionResult(data);
          break;
          
        case 'tool:perspectives':
          await this.handleToolPerspectives(data);
          break;
          
        case 'error':
          console.error('Server error:', data.error);
          break;
          
        default:
          console.log('Unknown message from server:', type, data);
      }
    } catch (error) {
      console.error('❌ Error in ClientToolRegistryActor.receive():', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  // Request tools from server
  loadTools() {
    if (this.remoteActor) {
      console.log('📡 Requesting tools from server...');
      this.remoteActor.receive({
        type: 'tools:load'
      });
    }
  }

  // Request modules from server
  loadModules() {
    if (this.remoteActor) {
      console.log('📡 Requesting modules from server...');
      this.remoteActor.receive({
        type: 'modules:load'
      });
    }
  }

  // Execute tool on server
  executeTool(toolName, params) {
    if (this.remoteActor) {
      console.log('🚀 Executing tool on server:', toolName, params);
      this.remoteActor.receive({
        type: 'tool:execute',
        data: { toolName, params }
      });
    }
  }

  // Get tool perspectives from server
  getToolPerspectives(toolName) {
    if (this.remoteActor) {
      console.log('🔍 Getting tool perspectives from server:', toolName);
      this.remoteActor.receive({
        type: 'tool:get-perspectives',
        data: { toolName }
      });
    }
  }

  // Load all modules from file system
  loadAllModules() {
    if (this.remoteActor) {
      console.log('🔧 Requesting server to load all modules from file system...');
      this.remoteActor.receive({
        type: 'registry:loadAll'
      });
    }
  }

  // Get registry statistics
  getRegistryStats() {
    if (this.remoteActor) {
      console.log('📊 Requesting registry statistics...');
      this.remoteActor.receive({
        type: 'registry:stats'
      });
    }
  }

  // Clear database
  clearDatabase() {
    if (this.remoteActor) {
      console.log('🗑️ Requesting to clear database...');
      this.remoteActor.receive({
        type: 'registry:clear'
      });
    }
  }

  // Load single module
  loadSingleModule(moduleName) {
    if (this.remoteActor) {
      console.log(`📦 Requesting to load module: ${moduleName}`);
      this.remoteActor.receive({
        type: 'module:load',
        data: { moduleName }
      });
    }
  }

  // Generate perspectives
  generatePerspectives() {
    if (this.remoteActor) {
      console.log('🔮 Requesting to generate perspectives...');
      this.remoteActor.receive({
        type: 'registry:generatePerspectives'
      });
    }
  }

  // Handle tools list from server
  async handleToolsList(tools) {
    console.log(`✅ Received ${tools.length} tools from server:`, tools.map(t => t.name));
    
    try {
      // Update the main application with real tools
      if (this.toolRegistryBrowser) {
        console.log('🔄 Calling setTools with', tools.length, 'tools...');
        this.toolRegistryBrowser.setTools(tools);
        console.log('✅ Successfully updated UI with real tools from server');
      } else {
        console.error('❌ toolRegistryBrowser is not available');
      }
    } catch (error) {
      console.error('❌ Error updating UI with tools:', error);
      throw error;
    }
  }

  // Handle modules list from server
  async handleModulesList(modules) {
    console.log(`✅ Received ${modules.length} modules from server:`, modules.map(m => m.name));
    
    try {
      // Update the main application with real modules
      if (this.toolRegistryBrowser) {
        console.log('🔄 Calling setModules with', modules.length, 'modules...');
        this.toolRegistryBrowser.setModules(modules);
        console.log('✅ Successfully updated UI with real modules from server');
      } else {
        console.error('❌ toolRegistryBrowser is not available');
      }
    } catch (error) {
      console.error('❌ Error updating UI with modules:', error);
      throw error;
    }
  }

  // Handle tool execution result
  async handleToolExecutionResult(data) {
    console.log('✅ Tool execution result:', data);
    
    // TODO: Update UI with execution result
    // This could show in a results panel or notification
  }

  // Handle tool perspectives
  async handleToolPerspectives(data) {
    console.log('✅ Tool perspectives:', data);
    
    // TODO: Update tool details panel with perspectives
  }
}