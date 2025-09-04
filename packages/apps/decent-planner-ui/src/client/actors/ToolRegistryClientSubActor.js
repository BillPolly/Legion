/**
 * ToolRegistryClientSubActor - Clean MVVM sub-actor for tool registry management
 * 
 * Handles:
 * - Module discovery and management
 * - Tool browsing and search
 * - Database inspection
 * - Registry statistics
 */

import { ToolRegistryTabComponent } from '../components/ToolRegistryTabComponent.js';

export default class ToolRegistryClientSubActor {
  constructor() {
    this.parentActor = null;
    this.remoteActor = null;
    this.toolRegistryComponent = null;
    
    // State
    this.state = {
      connected: false,
      modules: [],
      tools: [],
      registryStats: null
    };
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 Tool Registry client sub-actor connected');
    
    // If UI is already set up, update the remoteActor
    if (this.toolRegistryComponent && this.toolRegistryComponent.setRemoteActor) {
      this.toolRegistryComponent.setRemoteActor(remoteActor);
    }
  }

  setupUI(container) {
    this.toolRegistryComponent = new ToolRegistryTabComponent(container, {
      remoteActor: this.remoteActor,
      onModuleSearch: (query) => this.handleModuleSearch(query),
      onModuleSelect: (module) => this.handleModuleSelect(module),
      onToolSearch: (query, type) => this.handleToolSearch(query, type),
      onLoadData: () => this.loadRegistryData()
    });
    
    // Set initial connection status
    this.toolRegistryComponent.setConnected(this.state.connected);
  }

  /**
   * Handle module search requests (new backend search)
   */
  handleModuleSearch(query) {
    console.log(`Tool Registry: Module search requested: "${query}"`);
    
    if (this.remoteActor) {
      this.remoteActor.receive('modules:search', { 
        query: query || '',
        options: { limit: 100 }
      });
    }
  }
  
  /**
   * Handle module selection
   */
  handleModuleSelect(module) {
    console.log(`Tool Registry: Module selected:`, module.name);
    // Could show module details or switch to tools view filtered by module
  }

  /**
   * Handle tool search requests
   */
  handleToolSearch(query, type) {
    console.log(`Tool Registry: ${type} search for "${query}"`);
    
    if (this.remoteActor) {
      this.remoteActor.receive(`search-tools-${type}`, { 
        query,
        limit: 50
      });
    }
  }

  // NOTE: Database query removed - now using search-based backend

  /**
   * Load initial registry data using new search-based approach
   */
  loadRegistryData() {
    console.log('Tool Registry: Loading registry data via search...');
    
    if (this.remoteActor) {
      this.remoteActor.receive('registry:stats', {});
      this.remoteActor.receive('modules:search', { query: '', options: { limit: 100 } }); // List all modules
      this.remoteActor.receive('tools:search', { query: '', options: { limit: 1000 } }); // List all tools
    }
  }

  /**
   * Handle incoming messages from server
   */
  receive(messageType, data) {
    // Handle different calling conventions
    if (typeof messageType === 'object' && messageType.type) {
      // Protocol actor format: receive({type, data})
      data = messageType.data;
      messageType = messageType.type;
    }
    
    console.log('📨 Tool Registry client received:', messageType);
    
    switch (messageType) {
      case 'modules:searchResult':
        this.handleModulesSearchResult(data);
        break;

      case 'tools:searchResult':
        this.handleToolsSearchResult(data);
        break;

      case 'registry:stats':
        this.handleRegistryStats(data);
        break;

      case 'tool:executed':
        this.handleToolExecuted(data);
        break;

      case 'modules:searchError':
      case 'tools:searchError':
      case 'registry:statsError':
      case 'error':
        this.handleError(data);
        break;
        
      case 'ready':
        console.log('📦 Tool registry server ready');
        break;
        
      default:
        console.warn('Unknown message type in tool registry sub-actor:', messageType);
        break;
    }
  }

  /**
   * Handle module search results (new format)
   */
  handleModulesSearchResult(data) {
    console.log('📦 Module search results:', `"${data.query}" found ${data.count} modules`);
    
    this.state.modules = data.modules || [];
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateModules(data.modules);
    }
  }

  // NOTE: Database query handling removed - using search results instead

  /**
   * Handle registry statistics (new format)
   */
  handleRegistryStats(data) {
    console.log('📊 Registry stats received:', data);
    
    this.state.registryStats = data;
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateStats(data);
    }
  }

  /**
   * Handle tool search results (new format)
   */
  handleToolsSearchResult(data) {
    console.log('🔧 Tool search results:', `"${data.query}" found ${data.count} tools`);
    
    this.state.tools = data.tools || [];
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateTools(data.tools);
    }
  }

  /**
   * Handle tool execution results
   */
  handleToolExecuted(data) {
    console.log('🚀 Tool execution result:', data.toolName, data.result?.success ? 'success' : 'failed');
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.handleToolExecuted(data);
    }
  }

  /**
   * Handle errors
   */
  handleError(data) {
    console.error('Tool Registry error:', data.error);
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.showError(data.error);
    }
  }

  /**
   * Called when tab becomes active
   */
  onTabActivated() {
    console.log('Tool Registry tab activated');
    
    // Load fresh data when tab becomes active
    this.loadRegistryData();
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.setConnected(this.state.connected);
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      connected: this.state.connected,
      moduleCount: this.state.modules.length,
      toolCount: this.state.tools.length,
      hasStats: !!this.state.registryStats
    };
  }
}