/**
 * Tests for Storage Browser Model
 */

describe('StorageBrowserModel', () => {
  let model;
  let mockActorClient;

  beforeEach(() => {
    mockActorClient = {
      request: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    };
  });

  afterEach(() => {
    if (model) {
      model.destroy();
    }
  });

  describe('State Structure and Initialization', () => {
    test('should initialize with default state', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const state = model.getState();
      expect(state.connection.status).toBe('disconnected');
      expect(state.connection.provider).toBeNull();
      expect(state.collections.list).toEqual([]);
      expect(state.collections.selected).toBeNull();
      expect(state.documents.items).toEqual([]);
      expect(state.documents.page).toBe(1);
      expect(state.documents.pageSize).toBe(25);
      expect(state.query.current).toEqual({});
      expect(state.ui.mode).toBe('split');
    });

    test('should accept custom initial state', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      
      const initialState = {
        ui: { mode: 'documents', theme: 'dark' },
        documents: { pageSize: 50 }
      };

      model = new StorageBrowserModel(mockActorClient, initialState);
      
      const state = model.getState();
      expect(state.ui.mode).toBe('documents');
      expect(state.ui.theme).toBe('dark');
      expect(state.documents.pageSize).toBe(50);
    });

    test('should initialize connection state based on actor client', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      
      mockActorClient.isConnected.mockReturnValue(true);
      model = new StorageBrowserModel(mockActorClient);
      
      expect(model.getState().connection.status).toBe('connected');
    });
  });

  describe('State Updates and Mutations', () => {
    test('should update connection status', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.setConnectionStatus('connecting');
      expect(model.getState().connection.status).toBe('connecting');

      model.setConnectionStatus('connected');
      expect(model.getState().connection.status).toBe('connected');

      model.setConnectionStatus('disconnected');
      expect(model.getState().connection.status).toBe('disconnected');
    });

    test('should update provider', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.setProvider('mongodb');
      expect(model.getState().connection.provider).toBe('mongodb');

      model.setProvider('sqlite');
      expect(model.getState().connection.provider).toBe('sqlite');
    });

    test('should update collections list', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const collections = [
        { name: 'users', count: 100 },
        { name: 'products', count: 50 }
      ];

      model.setCollections(collections);
      expect(model.getState().collections.list).toEqual(collections);
    });

    test('should select collection', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.selectCollection('users');
      expect(model.getState().collections.selected).toBe('users');
    });

    test('should update documents', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const documents = [
        { _id: '1', name: 'Doc 1' },
        { _id: '2', name: 'Doc 2' }
      ];

      model.setDocuments(documents, 100);
      
      const state = model.getState();
      expect(state.documents.items).toEqual(documents);
      expect(state.documents.total).toBe(100);
    });

    test('should update pagination', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.setPage(3);
      expect(model.getState().documents.page).toBe(3);

      model.setPageSize(50);
      expect(model.getState().documents.pageSize).toBe(50);
    });

    test('should update query', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const query = { status: 'active', age: { $gte: 18 } };
      model.setQuery(query);
      expect(model.getState().query.current).toEqual(query);
    });

    test('should update UI state', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.setUIMode('collections');
      expect(model.getState().ui.mode).toBe('collections');

      model.setTheme('dark');
      expect(model.getState().ui.theme).toBe('dark');

      model.setDocumentView('cards');
      expect(model.getState().ui.documentView).toBe('cards');
    });
  });

  describe('State Persistence', () => {
    test('should save state to localStorage', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      
      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };
      global.localStorage = mockLocalStorage;

      model = new StorageBrowserModel(mockActorClient, {}, {
        persistState: true,
        storageKey: 'storage-browser-state'
      });

      model.setTheme('dark');
      model.saveState();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'storage-browser-state',
        expect.stringContaining('"theme":"dark"')
      );
    });

    test('should load state from localStorage', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      
      const savedState = {
        ui: { theme: 'dark', mode: 'documents' },
        documents: { pageSize: 100 }
      };

      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn().mockReturnValue(JSON.stringify(savedState)),
        removeItem: jest.fn()
      };
      global.localStorage = mockLocalStorage;

      model = new StorageBrowserModel(mockActorClient, {}, {
        persistState: true,
        storageKey: 'storage-browser-state'
      });

      const state = model.getState();
      expect(state.ui.theme).toBe('dark');
      expect(state.ui.mode).toBe('documents');
      expect(state.documents.pageSize).toBe(100);
    });

    test('should handle corrupted localStorage data', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      
      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn().mockReturnValue('invalid json {'),
        removeItem: jest.fn()
      };
      global.localStorage = mockLocalStorage;

      model = new StorageBrowserModel(mockActorClient, {}, {
        persistState: true,
        storageKey: 'storage-browser-state'
      });

      // Should use default state when localStorage is corrupted
      expect(model.getState().ui.mode).toBe('split');
    });
  });

  describe('State Change Notifications', () => {
    test('should emit change events on state updates', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const changeHandler = jest.fn();
      model.on('change', changeHandler);

      model.setConnectionStatus('connected');
      expect(changeHandler).toHaveBeenCalledWith({
        type: 'connection',
        data: { status: 'connected' }
      });

      model.selectCollection('users');
      expect(changeHandler).toHaveBeenCalledWith({
        type: 'collection',
        data: { selected: 'users' }
      });
    });

    test('should emit specific events for different state changes', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const collectionHandler = jest.fn();
      const documentHandler = jest.fn();
      const queryHandler = jest.fn();

      model.on('collection:change', collectionHandler);
      model.on('documents:change', documentHandler);
      model.on('query:change', queryHandler);

      model.selectCollection('users');
      expect(collectionHandler).toHaveBeenCalled();

      model.setDocuments([{ _id: '1' }], 1);
      expect(documentHandler).toHaveBeenCalled();

      model.setQuery({ status: 'active' });
      expect(queryHandler).toHaveBeenCalled();
    });

    test('should batch state changes', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const changeHandler = jest.fn();
      model.on('change', changeHandler);

      model.batchUpdate(() => {
        model.setConnectionStatus('connected');
        model.setProvider('mongodb');
        model.selectCollection('users');
      });

      // Should emit only one change event for batched updates
      expect(changeHandler).toHaveBeenCalledTimes(1);
      expect(changeHandler).toHaveBeenCalledWith({
        type: 'batch',
        changes: expect.arrayContaining([
          expect.objectContaining({ type: 'connection' }),
          expect.objectContaining({ type: 'provider' }),
          expect.objectContaining({ type: 'collection' })
        ])
      });
    });

    test('should allow unsubscribing from events', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      const handler = jest.fn();
      model.on('change', handler);

      model.setConnectionStatus('connected');
      expect(handler).toHaveBeenCalledTimes(1);

      model.off('change', handler);
      model.setConnectionStatus('disconnected');
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Query History', () => {
    test('should maintain query history', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.addQueryToHistory({ status: 'active' });
      model.addQueryToHistory({ age: { $gte: 18 } });
      model.addQueryToHistory({ name: { $regex: 'john' } });

      const history = model.getQueryHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual({ status: 'active' });
    });

    test('should limit query history size', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient, {}, {
        maxQueryHistory: 3
      });

      for (let i = 0; i < 5; i++) {
        model.addQueryToHistory({ index: i });
      }

      const history = model.getQueryHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual({ index: 2 }); // Oldest kept
      expect(history[2]).toEqual({ index: 4 }); // Newest
    });

    test('should avoid duplicate queries in history', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.addQueryToHistory({ status: 'active' });
      model.addQueryToHistory({ status: 'active' });
      model.addQueryToHistory({ status: 'active' });

      const history = model.getQueryHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('Saved Queries', () => {
    test('should save named queries', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.saveQuery('Active Users', { status: 'active' });
      model.saveQuery('Adults', { age: { $gte: 18 } });

      const saved = model.getSavedQueries();
      expect(saved).toHaveLength(2);
      expect(saved[0].name).toBe('Active Users');
      expect(saved[0].query).toEqual({ status: 'active' });
    });

    test('should update existing saved query', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.saveQuery('Active', { status: 'active' });
      model.saveQuery('Active', { status: 'active', verified: true });

      const saved = model.getSavedQueries();
      expect(saved).toHaveLength(1);
      expect(saved[0].query).toEqual({ status: 'active', verified: true });
    });

    test('should delete saved query', () => {
      const { StorageBrowserModel } = require('./StorageBrowserModel.js');
      model = new StorageBrowserModel(mockActorClient);

      model.saveQuery('Query1', { a: 1 });
      model.saveQuery('Query2', { b: 2 });
      model.saveQuery('Query3', { c: 3 });

      model.deleteSavedQuery('Query2');

      const saved = model.getSavedQueries();
      expect(saved).toHaveLength(2);
      expect(saved.find(q => q.name === 'Query2')).toBeUndefined();
    });
  });
});