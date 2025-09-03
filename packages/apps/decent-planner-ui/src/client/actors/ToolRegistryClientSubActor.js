/**
 * ToolRegistryClientSubActor - Clean MVVM sub-actor for tool registry management
 * 
 * Handles:
 * - Module discovery and management
 * - Tool browsing and search
 * - Database inspection
 * - Registry statistics
 */

import { ToolRegistryTabComponent } from '/src/client/components/ToolRegistryTabComponent.js';

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
  }

  setupUI(container) {
    this.toolRegistryComponent = new ToolRegistryTabComponent(container, {
      onModuleAction: (action, moduleName) => this.handleModuleAction(action, moduleName),
      onToolSearch: (query, type) => this.handleToolSearch(query, type),
      onDatabaseQuery: (collection, command, params) => this.handleDatabaseQuery(collection, command, params),
      onLoadData: () => this.loadRegistryData()
    });
    
    // Set initial connection status
    this.toolRegistryComponent.setConnected(this.state.connected);
  }

  /**
   * Handle module actions (load, unload, refresh)
   */
  handleModuleAction(action, moduleName) {
    console.log(`Tool Registry: ${action} module ${moduleName}`);
    
    if (this.remoteActor) {
      this.remoteActor.receive(`module-${action}`, { 
        moduleName: moduleName || 'all' 
      });
    }
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

  /**
   * Handle database query requests
   */
  handleDatabaseQuery(collection, command, params) {
    console.log(`Tool Registry: Database query ${command} on ${collection}`);
    
    if (this.remoteActor) {
      this.remoteActor.receive('database-query', {
        collection,
        command, 
        params
      });
    }
  }

  /**
   * Load initial registry data
   */
  loadRegistryData() {
    console.log('Tool Registry: Loading registry data...');
    
    if (this.remoteActor) {
      this.remoteActor.receive('get-registry-stats', {});
      this.remoteActor.receive('list-all-modules', {});
      this.remoteActor.receive('list-all-tools', {});
    }
  }

  /**
   * Handle incoming messages from server
   */
  receive(messageType, data) {
    console.log('📨 Tool Registry client received:', messageType);
    
    switch (messageType) {
      case 'modulesListComplete':
        this.handleModulesListComplete(data);
        break;

      case 'databaseQueryComplete':
        this.handleDatabaseQueryComplete(data);
        break;

      case 'registryStatsComplete':
        this.handleRegistryStatsComplete(data);
        break;

      case 'toolsListComplete':
        this.handleToolsListComplete(data);
        break;

      case 'toolsSearchTextComplete':
      case 'toolsSearchSemanticComplete':
        this.handleToolSearchComplete(data);
        break;

      case 'moduleLoadComplete':
      case 'moduleUnloadComplete':
        this.handleModuleActionComplete(data);
        break;

      case 'error':
        this.handleError(data);
        break;
        
      default:
        console.warn('Unknown message type in tool registry sub-actor:', messageType);
        break;
    }
  }

  /**
   * Handle modules list response
   */
  handleModulesListComplete(data) {
    console.log('📦 Modules list received:', data.totalModules, 'modules');
    
    this.state.modules = data.modules || [];
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateModules(data.modules);
    }
  }

  /**
   * Handle database query response
   */
  handleDatabaseQueryComplete(data) {
    console.log('🗄️ Database query result:', data.collection, data.count, 'records');
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.handleDbQueryResult({
        collection: data.collection,
        command: data.command,
        results: data.result,
        count: data.count
      });
    }
  }

  /**
   * Handle registry statistics
   */
  handleRegistryStatsComplete(data) {
    console.log('📊 Registry stats received:', data);
    
    this.state.registryStats = data;
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateStats(data);
    }
  }

  /**
   * Handle tools list response
   */
  handleToolsListComplete(data) {
    console.log('🔧 Tools list received:', data.tools?.length || 0, 'tools');
    
    this.state.tools = data.tools || [];
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.updateTools(data.tools);
    }
  }

  /**
   * Handle tool search results
   */
  handleToolSearchComplete(data) {
    console.log('🔍 Tool search results:', data.results?.length || 0, 'results');
    
    if (this.toolRegistryComponent) {
      this.toolRegistryComponent.handleSearchResults(data);
    }
  }

  /**
   * Handle module action completion
   */
  handleModuleActionComplete(data) {
    console.log('⚙️ Module action complete:', data.moduleName, data.message);
    
    // Refresh modules list after action
    this.loadRegistryData();
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