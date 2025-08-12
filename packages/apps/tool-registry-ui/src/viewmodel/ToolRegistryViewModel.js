/**
 * ToolRegistryViewModel - Coordinates between Model and View
 */

export class ToolRegistryViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = config;
    
    // Actors (will be set after WebSocket connection)
    this.toolActor = null;
    this.dbActor = null;
    this.searchActor = null;
    
    // State
    this.isConnected = false;
    this.searchQuery = '';
    
    // Bind model events to view updates
    this.bindModelEvents();
    
    // Bind view events to model actions
    this.bindViewEvents();
  }

  bindModelEvents() {
    // Tool events
    this.model.on('tools-updated', (tools) => {
      this.view.updateToolList(tools);
      this.view.updateStats(this.model.getStats());
    });
    
    this.model.on('tool-selected', (tool) => {
      this.view.updateToolDetails(tool);
    });
    
    this.model.on('execution-result', ({ toolName, params, result }) => {
      this.view.updateExecutionResults(result);
      if (this.config.onToolExecuted) {
        this.config.onToolExecuted(toolName, params, result);
      }
    });
    
    // Collection events
    this.model.on('collections-updated', (collections) => {
      this.view.updateCollectionTree(collections);
    });
    
    this.model.on('collection-selected', (collection) => {
      if (collection?.documents) {
        this.view.updateDocumentsView(collection.documents);
      }
    });
    
    this.model.on('collection-data-updated', (collection) => {
      if (collection?.documents) {
        this.view.updateDocumentsView(collection.documents);
      }
    });
    
    // Vector search events
    this.model.on('vector-stats-updated', (stats) => {
      this.view.updateQdrantStats(stats);
    });
    
    this.model.on('search-results-updated', (results) => {
      this.view.updateVectorResults(results);
      if (this.config.onSearchPerformed) {
        this.config.onSearchPerformed(this.searchQuery, results);
      }
    });
    
    // Loading/error events
    this.model.on('loading-changed', (loading) => {
      this.view.showLoading(loading);
    });
    
    this.model.on('error', (error) => {
      this.view.showError(error);
    });
  }

  bindViewEvents() {
    // Tool selection
    this.view.on('tool-selected', (toolName) => {
      this.selectTool(toolName);
    });
    
    // Tool search
    this.view.on('tool-search', (query) => {
      this.searchTools(query);
    });
    
    // Tool execution
    this.view.on('execute-tool', (toolName, params) => {
      this.executeTool(toolName, params);
    });
    
    // Semantic search test
    this.view.on('test-semantic-search', (toolName) => {
      this.testSemanticSearch(toolName);
    });
    
    // Collection selection
    this.view.on('collection-selected', (collectionName) => {
      this.selectCollection(collectionName);
    });
    
    // Vector search
    this.view.on('vector-search', (query) => {
      this.performVectorSearch(query);
    });
    
    // Tab switching
    this.view.on('tab-switched', (tabName) => {
      if (tabName === 'database') {
        this.loadDatabaseData();
      }
    });
  }

  // Set actors after WebSocket connection
  setActors(toolActor, dbActor, searchActor) {
    this.toolActor = toolActor;
    this.dbActor = dbActor;
    this.searchActor = searchActor;
    this.isConnected = true;
    this.view.updateConnectionStatus(true);
  }

  // Initial data loading
  async loadInitialData() {
    try {
      this.model.setLoading(true);
      
      // Load tools
      await this.loadTools();
      
      // Load modules
      await this.loadModules();
      
      // Load collections
      await this.loadCollections();
      
      // Load vector stats
      await this.loadVectorStats();
      
      this.model.setLoading(false);
    } catch (error) {
      this.model.setError(error);
      this.model.setLoading(false);
    }
  }

  // Tool operations
  async loadTools() {
    if (!this.toolActor) return;
    
    try {
      const tools = await this.toolActor.loadTools();
      this.model.setTools(tools);
    } catch (error) {
      console.error('Failed to load tools:', error);
      this.model.setError(error);
    }
  }

  async loadModules() {
    if (!this.toolActor) return;
    
    try {
      const modules = await this.toolActor.loadModules();
      this.model.setModules(modules);
    } catch (error) {
      console.error('Failed to load modules:', error);
    }
  }

  searchTools(query) {
    this.searchQuery = query;
    
    if (!query) {
      this.view.updateToolList(this.model.getTools());
    } else {
      const filtered = this.model.filterTools(query);
      this.view.updateToolList(filtered);
    }
  }

  selectTool(toolName) {
    const tool = this.model.selectTool(toolName);
    if (tool && this.toolActor) {
      // Load tool perspectives for semantic search
      this.toolActor.getToolPerspectives(toolName).then(perspectives => {
        this.model.setPerspectives(toolName, perspectives);
      }).catch(console.error);
    }
  }

  async executeTool(toolName, params) {
    if (!this.toolActor) return;
    
    try {
      this.model.setLoading(true);
      const result = await this.toolActor.executeTool(toolName, params);
      this.model.addExecutionResult(toolName, params, {
        success: true,
        data: result
      });
      this.model.setLoading(false);
    } catch (error) {
      console.error('Tool execution failed:', error);
      this.model.addExecutionResult(toolName, params, {
        success: false,
        error: error.message
      });
      this.model.setLoading(false);
    }
  }

  async testSemanticSearch(toolName) {
    if (!this.searchActor) return;
    
    try {
      const tool = this.model.getTool(toolName);
      if (!tool) return;
      
      // Search for tools similar to this one
      const query = tool.description || tool.name;
      const results = await this.searchActor.semanticSearch(query, {
        limit: 10,
        threshold: 0.5
      });
      
      // Show results in vector search tab
      this.view.switchInnerTab('vectors');
      this.model.setSearchResults(results);
    } catch (error) {
      console.error('Semantic search test failed:', error);
      this.model.setError(error);
    }
  }

  // Database operations
  async loadCollections() {
    if (!this.dbActor) return;
    
    try {
      const collections = await this.dbActor.listCollections();
      this.model.setCollections(collections);
    } catch (error) {
      console.error('Failed to load collections:', error);
      this.model.setError(error);
    }
  }

  async selectCollection(collectionName) {
    if (!this.dbActor) return;
    
    try {
      this.model.selectCollection(collectionName);
      
      // Load collection documents
      const data = await this.dbActor.getCollectionData(collectionName, {
        limit: 20
      });
      
      this.model.updateCollectionData(collectionName, data);
    } catch (error) {
      console.error('Failed to load collection data:', error);
      this.model.setError(error);
    }
  }

  async loadDatabaseData() {
    // Reload collections when switching to database tab
    await this.loadCollections();
    await this.loadVectorStats();
  }

  // Vector/Semantic search operations
  async loadVectorStats() {
    if (!this.searchActor) return;
    
    try {
      const stats = await this.searchActor.getVectorStats();
      this.model.setVectorStats(stats);
    } catch (error) {
      console.error('Failed to load vector stats:', error);
    }
  }

  async performVectorSearch(query) {
    if (!this.searchActor) return;
    
    this.searchQuery = query;
    
    try {
      this.model.setLoading(true);
      
      const results = await this.searchActor.semanticSearch(query, {
        limit: 20,
        includeMetadata: true
      });
      
      this.model.setSearchResults(results);
      this.model.setLoading(false);
    } catch (error) {
      console.error('Vector search failed:', error);
      this.model.setError(error);
      this.model.setLoading(false);
    }
  }

  // Semantic search operations
  async performSemanticSearch(query, options = {}) {
    if (!this.searchActor) return;
    
    try {
      const results = await this.searchActor.semanticSearch(query, {
        limit: options.limit || 10,
        threshold: options.threshold || 0.5,
        includeMetadata: true
      });
      
      return results;
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  async getVectorStats() {
    if (!this.searchActor) return null;
    
    try {
      return await this.searchActor.getVectorStats();
    } catch (error) {
      console.error('Failed to get vector stats:', error);
      return null;
    }
  }

  // Collection operations (exposed to component API)
  async queryCollection(collection, query) {
    if (!this.dbActor) return [];
    
    try {
      return await this.dbActor.queryCollection(collection, query);
    } catch (error) {
      console.error('Collection query failed:', error);
      throw error;
    }
  }

  // Rendering
  render() {
    // Initial render - update all views
    const stats = this.model.getStats();
    this.view.updateStats(stats);
    
    const tools = this.model.getTools();
    if (tools.length > 0) {
      this.view.updateToolList(tools);
    }
    
    const collections = this.model.getCollections();
    if (collections.length > 0) {
      this.view.updateCollectionTree(collections);
    }
    
    const vectorStats = this.model.getVectorStats();
    if (vectorStats) {
      this.view.updateQdrantStats(vectorStats);
    }
    
    this.view.updateConnectionStatus(this.isConnected);
  }

  // Cleanup
  destroy() {
    // Remove all event listeners
    this.model.destroy();
    this.view.destroy();
    
    // Clear actor references
    this.toolActor = null;
    this.dbActor = null;
    this.searchActor = null;
  }
}