/**
 * ClientToolRegistryActor - Protocol-enhanced client-side actor for tool registry operations
 * Communicates with ServerToolRegistryActor via WebSocket with full protocol validation
 */

import { ProtocolActor } from '../shared/ProtocolActor.js';

export class ClientToolRegistryActor extends ProtocolActor {
  constructor(toolRegistryBrowser) {
    super();
    this.toolRegistryBrowser = toolRegistryBrowser;
    this.remoteActor = null;
  }
  
  getProtocol() {
    return {
      name: "ClientToolRegistryActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          loading: { type: 'boolean', required: true },
          toolsLoaded: { type: 'boolean', required: true },
          modulesLoaded: { type: 'boolean', required: true },
          error: { type: 'string' },
          toolsCount: { type: 'number', minimum: 0 },
          modulesCount: { type: 'number', minimum: 0 }
        },
        initial: {
          connected: false,
          loading: false,
          toolsLoaded: false,
          modulesLoaded: false,
          error: null,
          toolsCount: 0,
          modulesCount: 0
        }
      },
      
      messages: {
        receives: {
          // Tools browsing
          "tools:searchResult": {
            schema: {
              query: { type: 'string', required: true },
              tools: { type: 'array', required: true },
              count: { type: 'number', minimum: 0 }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.toolsCount >= 0"],
            sideEffects: ["ui.updateToolsList(data.tools)"]
          },
          
          // Modules browsing  
          "modules:searchResult": {
            schema: {
              query: { type: 'string', required: true },
              modules: { type: 'array', required: true },
              count: { type: 'number', minimum: 0 }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.modulesCount >= 0"],
            sideEffects: ["ui.updateModulesList(data.modules)"]
          },
          
          // Registry info
          "registry:stats": {
            schema: {
              timestamp: { type: 'string', required: true }
            },
            preconditions: ["state.connected === true"]
          },
          
          // Tool execution results
          "tool:executed": {
            schema: {
              toolName: { type: 'string', required: true },
              result: { type: 'object' },
              error: { type: 'string' }
            },
            preconditions: ["state.connected === true"]
          }
        },
        
        sends: {
          // Browsing and search operations only
          "tools:search": {
            schema: {
              query: { type: 'string', required: true },
              options: { type: 'object' }
            },
            preconditions: ["state.connected === true"]
          },
          
          "modules:search": {
            schema: {
              query: { type: 'string', required: true },
              options: { type: 'object' }
            },
            preconditions: ["state.connected === true"]
          },
          
          "registry:stats": {
            schema: {},
            preconditions: ["state.connected === true"]
          },
          
          "tool:execute": {
            schema: {
              toolName: { type: 'string', required: true },
              params: { type: 'object', required: true }
            },
            preconditions: ["state.connected === true"]
          }
        }
      }
    };
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🔗 ClientToolRegistryActor connected to server');
    
    // Update protocol state
    this.state.connected = true;
    
    // Immediately request tools and modules
    this.loadTools();
    this.loadModules();
  }

  // Override to handle the protocol validation
  async receive(message) {
    console.log('🎯 ClientToolRegistryActor.receive() called with:', message.type);
    
    // Use ProtocolActor's enhanced receive for validation
    return super.receive(message.type, message.data || message);
  }
  
  // Implement ProtocolActor's abstract method
  handleMessage(messageType, data) {
    console.log(`📝 Processing ${messageType} message...`);
    
    try {
      switch (messageType) {
        case 'tools:searchResult':
          console.log(`🔍 Tool search results: "${data.query}" found ${data.count} tools`);
          this.handleToolsList(data.tools);
          this.state.toolsLoaded = true;
          this.state.toolsCount = data.tools?.length || 0;
          break;
          
        case 'modules:searchResult':
          console.log(`🔍 Module search results: "${data.query}" found ${data.count} modules`);
          this.handleModulesList(data.modules);
          this.state.modulesLoaded = true;
          this.state.modulesCount = data.modules?.length || 0;
          break;
          
        case 'registry:stats':
          console.log('📊 Registry stats:', data);
          const statsCallback = this.toolRegistryBrowser.onRegistryStats || 
                               window.toolRegistryApp?.onRegistryStats;
          if (statsCallback) {
            statsCallback(data);
          }
          break;
          
        case 'tool:executed':
          console.log('✅ Tool execution result:', data);
          if (this.toolRegistryBrowser.onToolExecuted) {
            this.toolRegistryBrowser.onToolExecuted(data);
          }
          break;
          
        default:
          console.log('Unknown message from server:', messageType, data);
      }
      console.log(`✅ Finished processing ${messageType} message`);
    } catch (error) {
      console.error(`❌ Error processing ${messageType}:`, error);
      this.state.error = error.message;
      throw error;
    }
  }
  
  // Implement ProtocolActor's abstract doSend method
  doSend(messageType, data) {
    if (!this.remoteActor) {
      throw new Error('No remote actor connection available');
    }
    
    console.log(`📡 Sending ${messageType} to server:`, data);
    this.remoteActor.receive({
      type: messageType,
      data: data
    });
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

  // Search modules from server (empty query = list all)
  searchModules(query = '', options = {}) {
    this.send('modules:search', { query, options });
  }
  
  // Backward compatibility: loadModules now uses search
  loadModules() {
    console.log('📡 Loading all modules (via search)...');
    this.searchModules(''); // Empty query = list all
  }

  // Execute tool on server
  executeTool(toolName, params) {
    this.send('tool:execute', { toolName, params });
  }

  // Get tool perspectives from server (deprecated - not in protocol)
  getToolPerspectives(toolName) {
    console.warn('⚠️ getToolPerspectives is deprecated - tool perspectives removed from protocol');
  }

  // Get registry statistics
  getRegistryStats() {
    this.send('registry:stats', {});
  }

  // Load single module (deprecated - use searchModules instead)
  loadSingleModule(moduleName) {
    console.warn('⚠️ loadSingleModule is deprecated - use searchModules instead');
    this.searchModules(moduleName); // Search for specific module
  }

  // NOTE: Admin operations removed - this is a browsing UI only

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