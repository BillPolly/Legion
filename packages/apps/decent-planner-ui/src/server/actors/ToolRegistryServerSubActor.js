/**
 * ToolRegistryServerSubActor - Dedicated server actor for tool registry operations
 * Provides point-to-point communication with ToolRegistryClientSubActor
 * Handles: modules search, tools search, registry stats, tool execution
 */

import { getToolRegistry } from '@legion/tools-registry';

export default class ToolRegistryServerSubActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.parentActor = null;
    
    // Tool Registry - will be initialized async
    this.toolRegistry = null;
    
    // State
    this.state = {
      connected: false,
      processing: false,
      lastQuery: null,
      initialized: false
    };
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 ToolRegistry server sub-actor connected');
    
    // Initialize tool registry
    await this.initializeToolRegistry();
    
    // Send ready signal
    this.remoteActor.receive('ready', {
      timestamp: new Date().toISOString()
    });
  }
  
  async initializeToolRegistry() {
    try {
      console.log('Initializing tool registry...');
      this.toolRegistry = await getToolRegistry();
      this.state.initialized = true;
      console.log('✅ Tool registry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tool registry:', error);
      this.state.initialized = false;
      throw error;
    }
  }

  receive(messageType, data) {
    console.log('📨 ToolRegistry server received:', messageType);
    
    switch (messageType) {
      case 'modules:search':
        this.handleModulesSearchRequest(data);
        break;
        
      case 'tools:search':
        this.handleToolsSearchRequest(data);
        break;
        
      case 'registry:stats':
        this.handleRegistryStatsRequest(data);
        break;
        
      case 'tool:execute':
        this.handleToolExecuteRequest(data);
        break;
        
      case 'ping':
        this.remoteActor.receive('pong', { timestamp: Date.now() });
        break;
        
      default:
        console.warn('Unknown message type in tool registry server sub-actor:', messageType);
        break;
    }
  }

  async handleModulesSearchRequest(data) {
    try {
      const { query = '', options = {} } = data || {};
      this.state.processing = true;
      this.state.lastQuery = query;
      
      if (!this.toolRegistry || !this.state.initialized) {
        throw new Error('Tool registry not initialized');
      }
      
      console.log(`🔍 Modules search: "${query}"`);
      
      // Get all tools and group by modules
      const allTools = await this.toolRegistry.listTools();
      const moduleMap = new Map();
      
      // Group tools by module
      allTools.forEach(tool => {
        const moduleName = tool.moduleName || 'Unknown';
        if (!moduleMap.has(moduleName)) {
          moduleMap.set(moduleName, {
            name: moduleName,
            description: tool.moduleDescription || `Module containing ${moduleName} tools`,
            tools: [],
            status: 'loaded'
          });
        }
        moduleMap.get(moduleName).tools.push(tool.name);
      });
      
      // Convert to array and filter by search query if provided
      let modules = Array.from(moduleMap.values());
      
      if (query) {
        const queryLower = query.toLowerCase();
        modules = modules.filter(module => {
          const nameMatch = module.name.toLowerCase().includes(queryLower);
          const descMatch = module.description.toLowerCase().includes(queryLower);
          const toolsMatch = module.tools.some(tool => tool.toLowerCase().includes(queryLower));
          return nameMatch || descMatch || toolsMatch;
        });
      }
      
      // Apply limit
      if (options.limit && options.limit > 0) {
        modules = modules.slice(0, options.limit);
      }
      
      this.remoteActor.receive('modules:searchResult', {
        query,
        modules,
        count: modules.length
      });
      
    } catch (error) {
      console.error('Failed to search modules:', error);
      this.remoteActor.receive('modules:searchError', {
        query: data?.query || '',
        error: error.message
      });
    } finally {
      this.state.processing = false;
    }
  }

  async handleToolsSearchRequest(data) {
    try {
      const { query = '', options = {} } = data || {};
      this.state.processing = true;
      this.state.lastQuery = query;
      
      if (!this.toolRegistry || !this.state.initialized) {
        throw new Error('Tool registry not initialized');
      }
      
      console.log(`🔍 Tools search: "${query}"`);
      
      // Use tool registry search with proper options
      const tools = query === '' 
        ? await this.toolRegistry.listTools({ limit: options.limit || 1000 })
        : await this.toolRegistry.searchTools(query, { limit: options.limit || 1000 });
      
      this.remoteActor.receive('tools:searchResult', {
        query,
        tools,
        count: tools.length
      });
      
    } catch (error) {
      console.error('Failed to search tools:', error);
      this.remoteActor.receive('tools:searchError', {
        query: data?.query || '',
        error: error.message
      });
    } finally {
      this.state.processing = false;
    }
  }

  async handleRegistryStatsRequest(data) {
    try {
      if (!this.toolRegistry || !this.state.initialized) {
        throw new Error('Tool registry not initialized');
      }
      
      const allTools = await this.toolRegistry.listTools();
      const uniqueModules = new Set(allTools.map(t => t.moduleName)).size;
      
      const stats = {
        totalTools: allTools.length,
        totalModules: uniqueModules,
        timestamp: new Date().toISOString()
      };
      
      this.remoteActor.receive('registry:stats', stats);
      
    } catch (error) {
      console.error('Failed to get registry stats:', error);
      this.remoteActor.receive('registry:statsError', {
        error: error.message
      });
    }
  }

  async handleToolExecuteRequest(data) {
    try {
      const { toolName, params } = data;
      this.state.processing = true;
      
      if (!this.toolRegistry || !this.state.initialized) {
        throw new Error('Tool registry not initialized');
      }
      
      console.log(`🚀 Executing tool: ${toolName}`);
      
      const tool = await this.toolRegistry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      const result = await tool.execute(params);
      
      this.remoteActor.receive('tool:executed', {
        toolName,
        params,
        result
      });
      
    } catch (error) {
      console.error('Tool execution failed:', error);
      this.remoteActor.receive('tool:executed', {
        toolName: data?.toolName,
        params: data?.params,
        error: error.message,
        success: false
      });
    } finally {
      this.state.processing = false;
    }
  }
}