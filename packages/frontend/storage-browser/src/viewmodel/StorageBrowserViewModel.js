/**
 * Storage Browser ViewModel
 * Coordination layer between Model and View
 */

export class StorageBrowserViewModel {
  constructor(model, view, actorClient, options = {}) {
    this.model = model;
    this.view = view;
    this.actorClient = actorClient;
    this.options = options;
    this.listeners = new Map();

    this.setupModelBindings();
    this.setupViewBindings();
    this.setupActorBindings();
  }

  setupModelBindings() {
    this.model.on('change', (change) => {
      this.handleModelChange(change);
    });
  }

  setupViewBindings() {
    this.view.on('action', (action) => {
      this.handleViewAction(action);
    });
  }

  setupActorBindings() {
    this.actorClient.on('connect', () => {
      this.model.setConnectionStatus('connected');
    });

    this.actorClient.on('disconnect', () => {
      this.model.setConnectionStatus('disconnected');
    });

    this.actorClient.on('error', (error) => {
      this.model.setConnectionError(error);
      this.emit('error', error);
    });
  }

  handleModelChange(change) {
    switch (change.type) {
      case 'connection':
        this.view.updateConnection(change.data);
        break;
      case 'databases':
        this.view.updateDatabases(change.data);
        break;
      case 'collections':
        this.view.updateCollections(change.data);
        break;
      case 'documents':
        this.view.updateDocuments(change.data);
        break;
      case 'ui':
        this.view.updateUI(change.data);
        break;
    }
  }

  async handleViewAction(action) {
    try {
      switch (action.type) {
        case 'connect':
          await this.connect();
          break;
        case 'selectProvider':
          await this.selectProvider(action.provider);
          break;
        case 'listDatabases':
          await this.loadDatabases();
          break;
        case 'selectDatabase':
          await this.selectDatabase(action.database);
          break;
        case 'selectCollection':
          await this.selectCollection(action.collection);
          break;
        case 'executeQuery':
          await this.executeQuery(action.query);
          break;
        case 'createDocument':
          await this.createDocument(action.data);
          break;
        case 'updateDocument':
          await this.updateDocument(action.id, action.update);
          break;
        case 'deleteDocument':
          await this.deleteDocument(action.id);
          break;
        case 'deleteDatabase':
          await this.deleteDatabase(action.database);
          break;
        case 'cellEdited':
          // Just trigger re-render to show save button
          // Actual save happens when user clicks Save Changes
          this.model.emitChange('documents', { 
            items: this.model.getState().documents.items 
          });
          break;
        case 'refresh':
          await this.refresh();
          break;
        default:
          console.warn('Unknown action:', action.type);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  async initialize() {
    console.log('[ViewModel] Initializing...');
    try {
      await this.connect();
      
      // If provider is MongoDB, load databases first
      const state = this.model.getState();
      console.log('[ViewModel] Initial state:', state);
      if (state.connection.provider === 'mongodb') {
        console.log('[ViewModel] MongoDB provider detected, loading databases...');
        await this.loadDatabases();
      }
      
      await this.loadCollections();
    } catch (error) {
      console.error('[ViewModel] Initialization error:', error);
      this.emit('error', error);
    }
  }

  async connect() {
    this.model.setConnectionStatus('connecting');
    // Connection is handled by ActorClient
    return new Promise((resolve) => {
      const handler = () => {
        this.actorClient.off('connect', handler);
        resolve();
      };
      this.actorClient.on('connect', handler);
    });
  }

  async loadDatabases() {
    console.log('[ViewModel] loadDatabases called');
    try {
      this.model.setDatabasesLoading(true);
      console.log('[ViewModel] Requesting databases from actor client...');
      const databases = await this.actorClient.listDatabases(
        this.model.getState().connection.provider
      );
      console.log('[ViewModel] Databases received:', databases);
      this.model.setDatabases(databases);
    } catch (error) {
      console.error('[ViewModel] Error loading databases:', error);
      this.model.setDatabasesLoading(false);
      throw error;
    }
  }

  async selectProvider(provider) {
    this.model.setProvider(provider);
    if (provider === 'mongodb') {
      await this.loadDatabases();
    }
    await this.loadCollections();
  }

  async selectDatabase(database) {
    try {
      const result = await this.actorClient.switchDatabase(database);
      if (result.success) {
        this.model.setCurrentDatabase(database);
        await this.loadCollections();
      }
    } catch (error) {
      throw error;
    }
  }

  async loadCollections() {
    try {
      this.model.setCollectionsLoading(true);
      const collections = await this.actorClient.listCollections(
        this.model.getState().connection.provider
      );
      
      // Fetch count for each collection
      const collectionsWithCount = await Promise.all(
        collections.map(async (name) => {
          try {
            const count = await this.actorClient.count(name, {}, {
              provider: this.model.getState().connection.provider
            });
            return { name, count };
          } catch (error) {
            console.error(`Error getting count for ${name}:`, error);
            return { name, count: 0 };
          }
        })
      );
      
      this.model.setCollections(collectionsWithCount);
    } catch (error) {
      this.model.setCollectionsLoading(false);
      throw error;
    }
  }

  async selectCollection(name) {
    this.model.selectCollection(name);
    await this.loadDocuments();
  }

  async loadDocuments(query = {}, options = {}) {
    const state = this.model.getState();
    const collection = state.collections.selected;
    console.log('[ViewModel] loadDocuments - collection:', collection, 'query:', query);
    
    if (!collection) {
      console.log('[ViewModel] No collection selected, skipping document load');
      return;
    }

    try {
      this.model.setDocumentsLoading(true);
      
      console.log('[ViewModel] Fetching documents...');
      const docs = await this.actorClient.find(collection, query, {
        limit: state.documents.pageSize,
        skip: (state.documents.page - 1) * state.documents.pageSize,
        provider: state.connection.provider,
        ...options
      });
      console.log('[ViewModel] Documents received:', docs);

      const total = await this.actorClient.count(collection, query, {
        provider: state.connection.provider
      });
      console.log('[ViewModel] Total count:', total);
      
      this.model.setDocuments(docs, total);
    } catch (error) {
      console.error('[ViewModel] Error loading documents:', error);
      this.model.setDocumentsLoading(false);
      throw error;
    }
  }

  async executeQuery(query) {
    this.model.setQuery(query);
    this.model.addQueryToHistory(query);
    await this.loadDocuments(query);
    
    this.emit('query:execute', {
      query,
      collection: this.model.getState().collections.selected
    });
  }

  async createDocument(data) {
    const collection = this.model.getState().collections.selected;
    if (!collection) throw new Error('No collection selected');

    const result = await this.actorClient.insert(collection, data, {
      provider: this.model.getState().connection.provider
    });
    await this.refresh();
    
    this.emit('document:change', {
      type: 'create',
      collection,
      document: data,
      result
    });
    
    return result;
  }

  async updateDocument(id, update) {
    const collection = this.model.getState().collections.selected;
    if (!collection) throw new Error('No collection selected');

    console.log(`[ViewModel] Updating document ${id} in ${collection}:`, update);
    
    const result = await this.actorClient.update(collection, { _id: id }, update, {
      provider: this.model.getState().connection.provider
    });
    
    await this.refresh();
    
    this.emit('document:change', {
      type: 'update',
      collection,
      documentId: id,
      update,
      result
    });
    
    return result;
  }

  async deleteDocument(id) {
    const collection = this.model.getState().collections.selected;
    if (!collection) throw new Error('No collection selected');

    console.log(`[ViewModel] Deleting document ${id} from ${collection}`);
    
    const result = await this.actorClient.delete(collection, { _id: id }, {
      provider: this.model.getState().connection.provider
    });
    
    await this.refresh();
    
    this.emit('document:change', {
      type: 'delete',
      collection,
      documentId: id,
      result
    });
    
    return result;
  }

  async deleteDatabase(database) {
    console.log(`[ViewModel] Deleting database ${database}`);
    
    try {
      const result = await this.actorClient.dropDatabase(database);
      
      if (result.success) {
        // Reload databases list
        await this.loadDatabases();
        
        // Switch to first available database or default
        const databases = this.model.getState().databases.list;
        if (databases.length > 0) {
          const nextDb = databases[0].name || databases[0];
          await this.selectDatabase(nextDb);
        }
        
        this.emit('database:deleted', { database });
      }
    } catch (error) {
      console.error(`[ViewModel] Error deleting database:`, error);
      throw error;
    }
  }

  async refresh() {
    const state = this.model.getState();
    if (state.collections.selected) {
      await this.loadDocuments(state.query.current);
    }
  }

  setProvider(provider) {
    this.model.setProvider(provider);
    return this.loadCollections();
  }

  // Event handling
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in ViewModel listener for ${event}:`, error);
      }
    });
  }

  destroy() {
    this.listeners.clear();
  }
}