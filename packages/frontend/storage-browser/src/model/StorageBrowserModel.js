/**
 * Storage Browser Model
 * Core state management for the storage browser component
 */

export class StorageBrowserModel {
  constructor(actorClient, initialState = {}, options = {}) {
    this.actorClient = actorClient;
    this.options = {
      persistState: false,
      storageKey: 'storage-browser-state',
      maxQueryHistory: 50,
      ...options
    };

    // Initialize state
    this.state = this.initializeState(initialState);
    
    // Event listeners
    this.listeners = new Map();
    
    // Batch update flag
    this.isBatching = false;
    this.batchedChanges = [];

    // Load persisted state if enabled
    if (this.options.persistState) {
      this.loadState();
    }

    // Set initial connection status
    if (actorClient && actorClient.isConnected()) {
      this.state.connection.status = 'connected';
    }
  }

  initializeState(overrides = {}) {
    const defaultState = {
      connection: {
        status: 'disconnected',
        serverUrl: null,
        provider: null,
        error: null
      },
      databases: {
        list: [],
        current: 'legion_storage',
        loading: false
      },
      collections: {
        list: [],
        selected: null,
        loading: false
      },
      documents: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        loading: false,
        selected: new Set()
      },
      query: {
        current: {},
        history: [],
        saved: []
      },
      ui: {
        mode: 'split',
        theme: 'light',
        documentView: 'table',
        splitRatio: 30
      }
    };

    return this.mergeDeep(defaultState, overrides);
  }

  mergeDeep(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // State accessors
  getState() {
    return { ...this.state };
  }

  // Connection management
  setConnectionStatus(status) {
    this.state.connection.status = status;
    this.emitChange('connection', { status });
  }

  setProvider(provider) {
    this.state.connection.provider = provider;
    this.emitChange('provider', { provider });
  }

  setConnectionError(error) {
    this.state.connection.error = error;
    this.emitChange('connection', { error });
  }

  // Database management
  setDatabases(databases) {
    this.state.databases.list = databases;
    this.state.databases.loading = false;
    this.emitChange('databases', { list: databases, current: this.state.databases.current });
  }

  setCurrentDatabase(database) {
    this.state.databases.current = database;
    this.emitChange('databases', { current: database, list: this.state.databases.list });
  }

  setDatabasesLoading(loading) {
    this.state.databases.loading = loading;
    this.emitChange('databases', { loading });
  }

  // Collections management
  setCollections(collections) {
    this.state.collections.list = collections;
    this.state.collections.loading = false;
    this.emitChange('collections', { list: collections });
  }

  selectCollection(name) {
    this.state.collections.selected = name;
    this.state.documents.items = [];
    this.state.documents.page = 1;
    this.emitChange('collection', { selected: name });
  }

  setCollectionsLoading(loading) {
    this.state.collections.loading = loading;
    this.emitChange('collections', { loading });
  }

  // Documents management
  setDocuments(documents, total) {
    this.state.documents.items = documents;
    this.state.documents.total = total || documents.length;
    this.state.documents.loading = false;
    this.emitChange('documents', { items: documents, total });
  }

  setPage(page) {
    this.state.documents.page = page;
    this.emitChange('pagination', { page });
  }

  setPageSize(pageSize) {
    this.state.documents.pageSize = pageSize;
    this.state.documents.page = 1;
    this.emitChange('pagination', { pageSize });
  }

  setDocumentsLoading(loading) {
    this.state.documents.loading = loading;
    this.emitChange('documents', { loading });
  }

  selectDocument(id) {
    this.state.documents.selected.add(id);
    this.emitChange('selection', { selected: Array.from(this.state.documents.selected) });
  }

  deselectDocument(id) {
    this.state.documents.selected.delete(id);
    this.emitChange('selection', { selected: Array.from(this.state.documents.selected) });
  }

  clearSelection() {
    this.state.documents.selected.clear();
    this.emitChange('selection', { selected: [] });
  }

  // Query management
  setQuery(query) {
    this.state.query.current = query;
    this.emitChange('query', { query });
  }

  addQueryToHistory(query) {
    // Avoid duplicates
    const exists = this.state.query.history.some(
      h => JSON.stringify(h) === JSON.stringify(query)
    );
    
    if (!exists) {
      this.state.query.history.push(query);
      
      // Limit history size
      if (this.state.query.history.length > this.options.maxQueryHistory) {
        this.state.query.history.shift();
      }
    }
  }

  getQueryHistory() {
    return [...this.state.query.history];
  }

  saveQuery(name, query) {
    const index = this.state.query.saved.findIndex(q => q.name === name);
    
    if (index !== -1) {
      this.state.query.saved[index] = { name, query, timestamp: Date.now() };
    } else {
      this.state.query.saved.push({ name, query, timestamp: Date.now() });
    }
    
    this.emitChange('savedQueries', { saved: this.state.query.saved });
  }

  getSavedQueries() {
    return [...this.state.query.saved];
  }

  deleteSavedQuery(name) {
    this.state.query.saved = this.state.query.saved.filter(q => q.name !== name);
    this.emitChange('savedQueries', { saved: this.state.query.saved });
  }

  // UI state management
  setUIMode(mode) {
    this.state.ui.mode = mode;
    this.emitChange('ui', { mode });
  }

  setTheme(theme) {
    this.state.ui.theme = theme;
    this.emitChange('ui', { theme });
  }

  setDocumentView(view) {
    this.state.ui.documentView = view;
    this.emitChange('ui', { documentView: view });
  }

  setSplitRatio(ratio) {
    this.state.ui.splitRatio = ratio;
    this.emitChange('ui', { splitRatio: ratio });
  }

  // Batch updates
  batchUpdate(updateFn) {
    this.isBatching = true;
    this.batchedChanges = [];
    
    updateFn();
    
    this.isBatching = false;
    
    if (this.batchedChanges.length > 0) {
      this.emit('change', {
        type: 'batch',
        changes: this.batchedChanges
      });
    }
    
    this.batchedChanges = [];
  }

  // State persistence
  saveState() {
    if (!this.options.persistState) return;
    
    try {
      const stateToSave = {
        ui: this.state.ui,
        documents: {
          pageSize: this.state.documents.pageSize
        },
        query: {
          saved: this.state.query.saved
        }
      };
      
      localStorage.setItem(
        this.options.storageKey,
        JSON.stringify(stateToSave)
      );
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  loadState() {
    if (!this.options.persistState) return;
    
    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = this.mergeDeep(this.state, parsed);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  // Event handling
  emitChange(type, data) {
    const change = { type, data };
    
    if (this.isBatching) {
      this.batchedChanges.push(change);
    } else {
      this.emit('change', change);
      this.emit(`${type}:change`, data);
    }
    
    // Auto-save state on changes
    if (this.options.persistState) {
      this.saveState();
    }
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  // Cleanup
  destroy() {
    this.listeners.clear();
    this.batchedChanges = [];
  }
}