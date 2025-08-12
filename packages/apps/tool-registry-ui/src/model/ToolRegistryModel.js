/**
 * ToolRegistryModel - Data management for tool registry
 */

export class ToolRegistryModel {
  constructor(config = {}) {
    this.config = config;
    
    // Tool data
    this.tools = new Map();
    this.modules = new Map();
    this.selectedTool = null;
    
    // Database data
    this.collections = new Map();
    this.selectedCollection = null;
    
    // Vector/semantic search data
    this.vectorStats = null;
    this.searchResults = [];
    this.perspectives = new Map();
    
    // State
    this.loading = false;
    this.error = null;
    
    // Event listeners
    this.listeners = new Map();
  }

  // Tool operations
  setTools(tools) {
    this.tools.clear();
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    this.emit('tools-updated', Array.from(this.tools.values()));
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  selectTool(toolName) {
    this.selectedTool = this.tools.get(toolName);
    this.emit('tool-selected', this.selectedTool);
    return this.selectedTool;
  }

  getSelectedTool() {
    return this.selectedTool;
  }

  // Module operations
  setModules(modules) {
    this.modules.clear();
    modules.forEach(module => {
      this.modules.set(module.name, module);
    });
    this.emit('modules-updated', Array.from(this.modules.values()));
  }

  getModule(name) {
    return this.modules.get(name);
  }

  getModules() {
    return Array.from(this.modules.values());
  }

  // Collection operations
  setCollections(collections) {
    this.collections.clear();
    collections.forEach(collection => {
      this.collections.set(collection.name, collection);
    });
    this.emit('collections-updated', Array.from(this.collections.values()));
  }

  getCollection(name) {
    return this.collections.get(name);
  }

  getCollections() {
    return Array.from(this.collections.values());
  }

  selectCollection(name) {
    this.selectedCollection = this.collections.get(name);
    this.emit('collection-selected', this.selectedCollection);
    return this.selectedCollection;
  }

  updateCollectionData(name, data) {
    const collection = this.collections.get(name);
    if (collection) {
      collection.documents = data.documents;
      collection.count = data.count;
      collection.schema = data.schema;
      this.emit('collection-data-updated', collection);
    }
  }

  // Vector/Semantic search operations
  setVectorStats(stats) {
    this.vectorStats = stats;
    this.emit('vector-stats-updated', stats);
  }

  getVectorStats() {
    return this.vectorStats;
  }

  setSearchResults(results) {
    this.searchResults = results;
    this.emit('search-results-updated', results);
  }

  getSearchResults() {
    return this.searchResults;
  }

  setPerspectives(toolName, perspectives) {
    this.perspectives.set(toolName, perspectives);
    this.emit('perspectives-updated', { toolName, perspectives });
  }

  getPerspectives(toolName) {
    return this.perspectives.get(toolName) || [];
  }

  // Tool execution
  addExecutionResult(toolName, params, result) {
    const tool = this.tools.get(toolName);
    if (tool) {
      if (!tool.executionHistory) {
        tool.executionHistory = [];
      }
      tool.executionHistory.push({
        timestamp: new Date(),
        params,
        result
      });
      this.emit('execution-result', { toolName, params, result });
    }
  }

  getExecutionHistory(toolName) {
    const tool = this.tools.get(toolName);
    return tool?.executionHistory || [];
  }

  // Loading state
  setLoading(loading) {
    this.loading = loading;
    this.emit('loading-changed', loading);
  }

  isLoading() {
    return this.loading;
  }

  // Error handling
  setError(error) {
    this.error = error;
    this.emit('error', error);
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  getError() {
    return this.error;
  }

  clearError() {
    this.error = null;
    this.emit('error-cleared');
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Statistics
  getStats() {
    return {
      totalTools: this.tools.size,
      totalModules: this.modules.size,
      totalCollections: this.collections.size,
      perspectivesLoaded: this.perspectives.size,
      hasVectorStats: !!this.vectorStats,
      searchResultsCount: this.searchResults.length
    };
  }

  // Search/filter tools
  filterTools(query) {
    const lowerQuery = query.toLowerCase();
    return this.getTools().filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description?.toLowerCase().includes(lowerQuery) ||
      tool.moduleName?.toLowerCase().includes(lowerQuery)
    );
  }

  // Clear all data
  clear() {
    this.tools.clear();
    this.modules.clear();
    this.collections.clear();
    this.perspectives.clear();
    this.selectedTool = null;
    this.selectedCollection = null;
    this.vectorStats = null;
    this.searchResults = [];
    this.error = null;
    this.emit('data-cleared');
  }

  // Cleanup
  destroy() {
    this.clear();
    this.listeners.clear();
  }
}