/**
 * ServerToolRegistryActor
 * Protocol-enhanced server-side actor for tool registry browsing operations
 * Uses singleton ToolRegistry for searching and querying
 */

import { ProtocolActor } from '../shared/ProtocolActor.js';

export class ServerToolRegistryActor extends ProtocolActor {
  constructor(registryService) {
    super();
    this.registryService = registryService;
    this.registry = registryService.getRegistry();
    this.remoteActor = null;
  }
  
  getProtocol() {
    return {
      name: "ServerToolRegistryActor", 
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          processing: { type: 'boolean', required: true },
          lastSearchQuery: { type: 'string' },
          error: { type: 'string' }
        },
        initial: {
          connected: false,
          processing: false,
          lastSearchQuery: '',
          error: null
        }
      },
      
      messages: {
        receives: {
          "tools:search": {
            schema: {
              query: { type: 'string', required: true },
              options: { type: 'object' }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.lastSearchQuery !== null"]
          },
          
          "modules:search": {
            schema: {
              query: { type: 'string', required: true },
              options: { type: 'object' }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.lastSearchQuery !== null"]
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
        },
        
        sends: {
          "tools:searchResult": {
            schema: {
              query: { type: 'string', required: true },
              tools: { type: 'array', required: true },
              count: { type: 'number', minimum: 0 }
            }
          },
          
          "modules:searchResult": {
            schema: {
              query: { type: 'string', required: true },
              modules: { type: 'array', required: true },
              count: { type: 'number', minimum: 0 }
            }
          },
          
          "registry:stats": {
            schema: {
              timestamp: { type: 'string', required: true }
            }
          },
          
          "tool:executed": {
            schema: {
              toolName: { type: 'string', required: true },
              result: { type: 'object' },
              error: { type: 'string' }
            }
          }
        }
      }
    };
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
  }

  // Override to handle protocol validation
  async receive(message) {
    console.log('🎯 ServerToolRegistryActor.receive() called with:', message.type);
    
    // Use ProtocolActor's enhanced receive for validation
    return super.receive(message.type, message.data || message);
  }
  
  // Implement ProtocolActor's abstract method
  handleMessage(messageType, data) {
    console.log(`📝 Server processing ${messageType} message...`);
    
    this.state.processing = true;
    this.state.lastSearchQuery = data.query || '';
    
    try {
      switch (messageType) {
        case 'tools:search':
          return this.searchTools(data.query || '', data.options || {});
          
        case 'modules:search':
          return this.searchModules(data.query || '', data.options || {});
          
        case 'registry:stats':
          return this.getStats();
          
        case 'tool:execute':
          return this.executeTool(data.toolName, data.params);
          
        default:
          console.log('Unknown message:', messageType);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.processing = false;
    }
  }
  
  // Implement ProtocolActor's abstract doSend method
  doSend(messageType, data) {
    if (!this.remoteActor) {
      throw new Error('No remote actor connection available');
    }
    
    console.log(`📤 Sending ${messageType} to client:`, data);
    this.remoteActor.receive({
      type: messageType,
      data: data
    });
  }

  async searchTools(query = '', options = {}) {
    try {
      console.log(`Searching tools: "${query}"`);
      
      // Use registry service to search tools
      const tools = await this.registryService.searchTools(query, { limit: 1000, ...options });
      
      console.log(`Found ${tools.length} tools`);
      
      // Send tools to client using protocol
      this.send('tools:searchResult', { query, tools, count: tools.length });
    } catch (error) {
      console.error('Failed to search tools:', error);
      throw error;
    }
  }

  async searchModules(query = '', options = {}) {
    try {
      console.log(`Searching modules: "${query}"`);
      
      // Use registry service to search modules
      const modules = await this.registryService.searchModules(query, { limit: 100, ...options });
      
      console.log(`Found ${modules.length} modules`);
      
      // Send modules to client using protocol
      this.send('modules:searchResult', { query, modules, count: modules.length });
    } catch (error) {
      console.error('Failed to search modules:', error);
      throw error;
    }
  }

  // NOTE: Single module loading removed - use registry.loadAllModules() instead

  async executeTool(toolName, params) {
    try {
      console.log(`Executing tool: ${toolName}`);
      
      // Use registry service to execute tool
      const result = await this.registryService.executeTool(toolName, params);
      
      // Send result to client using protocol
      this.send('tool:executed', {
        toolName,
        params, 
        result
      });
    } catch (error) {
      console.error('Tool execution failed:', error);
      
      // Send error result using protocol
      this.send('tool:executed', {
        toolName,
        params,
        error: error.message,
        success: false
      });
    }
  }

  // NOTE: Tool perspectives removed - not needed for browsing UI

  // NOTE: Module loading removed - browsing UI only queries existing modules

  async getStats() {
    try {
      console.log('Getting registry statistics...');
      
      // Use registry singleton for all stats (includes counts)
      const stats = await this.registryService.getStats();
      
      const fullStats = {
        ...stats,
        timestamp: new Date().toISOString()
      };
      
      console.log('Registry stats:', fullStats);
      
      // Send stats to client using protocol
      this.send('registry:stats', fullStats);
    } catch (error) {
      console.error('Failed to get registry stats:', error);
      throw error;
    }
  }

  // NOTE: Admin operations removed - this is a browsing-only UI actor
}