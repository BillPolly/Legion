/**
 * Storage Browser Integration Test
 * Full end-to-end test without WebSocket server
 */

import { JSDOM } from 'jsdom';
import { ResourceManager } from '../../../module-loader/src/resources/ResourceManager.js';
import { StorageActorHost } from '../../../storage/server/StorageActorHost.js';
import { StorageBrowserModel } from '../../src/model/StorageBrowserModel.js';
import { StorageBrowserView } from '../../src/view/StorageBrowserView.js';
import { StorageBrowserViewModel } from '../../src/viewmodel/StorageBrowserViewModel.js';

/**
 * Mock WebSocket Channel that directly connects to ActorHost
 */
class DirectActorChannel {
  constructor(actorHost) {
    this.actorHost = actorHost;
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    this.connected = true;
    this.emit('connect');
    // Send connected message like real WebSocket would
    setTimeout(() => {
      this.emit('message', {
        type: 'connected',
        spaceId: 'test-space',
        timestamp: Date.now()
      });
    }, 0);
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }

  isConnected() {
    return this.connected;
  }

  async send(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // Directly call actor host instead of WebSocket
    try {
      const { actor, method, params, id } = message;
      const actorInstance = this.actorHost.getActor(actor);
      
      if (!actorInstance) {
        this.emit('message', {
          type: 'response',
          id,
          success: false,
          error: { message: `Actor ${actor} not found` }
        });
        return;
      }

      // Call actor method directly
      const result = await actorInstance.receive(method, params);
      
      // Send response back
      this.emit('message', {
        type: 'response',
        id,
        success: true,
        data: result
      });
    } catch (error) {
      this.emit('message', {
        type: 'response',
        id: message.id,
        success: false,
        error: { message: error.message }
      });
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
        console.error(`Error in listener for ${event}:`, error);
      }
    });
  }
}

/**
 * Mock StorageActorClient that uses DirectActorChannel
 */
class MockStorageActorClient {
  constructor(actorHost) {
    this.channel = new DirectActorChannel(actorHost);
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.listeners = new Map();
    
    this.setupChannelHandlers();
    this.channel.connect();
  }

  setupChannelHandlers() {
    this.channel.on('message', (message) => {
      this.handleMessage(message);
    });

    this.channel.on('connect', () => {
      this.emit('connect');
    });

    this.channel.on('disconnect', () => {
      this.emit('disconnect');
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'response':
        this.handleResponse(message);
        break;
      case 'connected':
        this.emit('connected', message);
        break;
    }
  }

  handleResponse(message) {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);
    
    if (message.success) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(message.error?.message || 'Request failed'));
    }
  }

  request(actor, method, params = {}) {
    const requestId = `req-${++this.requestIdCounter}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.channel.send({
        type: 'request',
        id: requestId,
        actor,
        method,
        params
      });
    });
  }

  isConnected() {
    return this.channel.isConnected();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    const listeners = this.listeners.get(event);
    listeners.forEach(listener => listener(...args));
  }

  // Convenience methods
  async listDatabases(provider = 'mongodb') {
    return this.request('DatabaseActor', 'listDatabases', { provider });
  }

  async switchDatabase(database, provider = 'mongodb') {
    return this.request('DatabaseActor', 'switchDatabase', { database, provider });
  }

  async getCurrentDatabase() {
    return this.request('DatabaseActor', 'getCurrentDatabase', {});
  }

  async listCollections(provider = 'mongodb') {
    return this.request('CollectionActor', 'listCollections', { provider });
  }

  async find(collection, query = {}, options = {}) {
    return this.request('CollectionActor', 'find', {
      collection,
      query,
      options
    });
  }

  async insert(collection, documents, options = {}) {
    return this.request('CollectionActor', 'insert', {
      collection,
      documents,
      options
    });
  }

  async count(collection, query = {}, options = {}) {
    return this.request('CollectionActor', 'count', {
      collection,
      query,
      options
    });
  }
}

describe('StorageBrowser Integration Tests', () => {
  let dom;
  let container;
  let resourceManager;
  let actorHost;
  let actorClient;
  let model;
  let view;
  let viewModel;

  beforeEach(async () => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><div id="app"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    container = document.getElementById('app');

    // Initialize ResourceManager and ActorHost
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    actorHost = new StorageActorHost(resourceManager);
    await actorHost.initialize();

    // Create mock client
    actorClient = new MockStorageActorClient(actorHost);

    // Initialize MVVM components
    model = new StorageBrowserModel(actorClient);
    view = new StorageBrowserView(container);
    viewModel = new StorageBrowserViewModel(model, view, actorClient);
  });

  afterEach(async () => {
    if (actorHost) {
      await actorHost.cleanup();
    }
    if (view) {
      view.destroy();
    }
  });

  describe('Database Selection', () => {
    test('should list available databases', async () => {
      // Wait for connection
      await new Promise(resolve => {
        if (actorClient.isConnected()) {
          resolve();
        } else {
          actorClient.on('connect', resolve);
        }
      });

      // List databases
      const databases = await actorClient.listDatabases('mongodb');
      
      expect(databases).toBeDefined();
      expect(Array.isArray(databases)).toBe(true);
      
      // Should have at least default MongoDB databases
      const dbNames = databases.map(db => db.name || db);
      expect(dbNames).toContain('legion_storage');
    });

    test('should switch database and update collections', async () => {
      // Initial database
      const initialDb = await actorClient.getCurrentDatabase();
      expect(initialDb.database).toBe('legion_storage');

      // List databases
      const databases = await actorClient.listDatabases();
      
      // Switch to a different database (or create test db)
      const result = await actorClient.switchDatabase('test_db');
      expect(result.success).toBe(true);
      expect(result.database).toBe('test_db');

      // Verify current database changed
      const currentDb = await actorClient.getCurrentDatabase();
      expect(currentDb.database).toBe('test_db');

      // Collections should be available for new database
      const collections = await actorClient.listCollections();
      expect(Array.isArray(collections)).toBe(true);
    });
  });

  describe('UI Integration', () => {
    test('should update UI when provider changes to MongoDB', async () => {
      // Trigger provider change
      view.emit('action', { type: 'selectProvider', provider: 'mongodb' });

      // Database select should be visible
      const databaseSelect = container.querySelector('.database-select');
      expect(databaseSelect).toBeDefined();
      expect(databaseSelect.style.display).toBe('inline-block');
    });

    test('should populate database dropdown', async () => {
      // Set provider to MongoDB
      await viewModel.selectProvider('mongodb');

      // Wait for databases to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check database dropdown is populated
      const databaseSelect = container.querySelector('.database-select');
      const options = databaseSelect.querySelectorAll('option');
      
      expect(options.length).toBeGreaterThan(0);
      
      // Should have at least legion_storage
      const optionValues = Array.from(options).map(opt => opt.value);
      expect(optionValues).toContain('legion_storage');
    });

    test('should switch database when selected from dropdown', async () => {
      // Setup MongoDB provider
      await viewModel.selectProvider('mongodb');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Select a different database
      const databaseSelect = container.querySelector('.database-select');
      databaseSelect.value = 'test_db';
      
      // Trigger change event
      const changeEvent = new dom.window.Event('change');
      databaseSelect.dispatchEvent(changeEvent);

      // Wait for switch to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify database switched
      const currentDb = await actorClient.getCurrentDatabase();
      expect(currentDb.database).toBe('test_db');
    });
  });

  describe('Data Operations with Database Selection', () => {
    test('should perform CRUD operations on selected database', async () => {
      // Switch to test database
      await actorClient.switchDatabase('integration_test_db');

      // Insert test document
      const testDoc = { name: 'Test Item', value: 123 };
      const insertResult = await actorClient.insert('test_collection', testDoc);
      expect(insertResult.acknowledged).toBe(true);

      // Find documents
      const docs = await actorClient.find('test_collection', {});
      expect(Array.isArray(docs)).toBe(true);
      
      // Count documents
      const count = await actorClient.count('test_collection', {});
      expect(typeof count).toBe('number');
    });

    test('should isolate data between databases', async () => {
      // Insert in first database
      await actorClient.switchDatabase('db1');
      await actorClient.insert('shared_collection', { db: 'db1', value: 1 });

      // Insert in second database
      await actorClient.switchDatabase('db2');
      await actorClient.insert('shared_collection', { db: 'db2', value: 2 });

      // Check first database
      await actorClient.switchDatabase('db1');
      const db1Docs = await actorClient.find('shared_collection', {});
      
      // Check second database
      await actorClient.switchDatabase('db2');
      const db2Docs = await actorClient.find('shared_collection', {});

      // Data should be isolated
      expect(db1Docs).not.toEqual(db2Docs);
    });
  });

  describe('Full User Flow', () => {
    test('should complete full browse flow with database selection', async () => {
      // 1. Connect and select MongoDB provider
      await viewModel.selectProvider('mongodb');
      
      // 2. Load and select database
      await viewModel.loadDatabases();
      const databases = model.getState().databases.list;
      expect(databases.length).toBeGreaterThan(0);
      
      // 3. Select a database
      await viewModel.selectDatabase('legion_storage');
      expect(model.getState().databases.current).toBe('legion_storage');
      
      // 4. Load collections
      const collections = model.getState().collections.list;
      expect(Array.isArray(collections)).toBe(true);
      
      // 5. Select a collection (if any exist)
      if (collections.length > 0) {
        await viewModel.selectCollection(collections[0].name);
        expect(model.getState().collections.selected).toBe(collections[0].name);
        
        // 6. Documents should be loaded
        const documents = model.getState().documents.items;
        expect(Array.isArray(documents)).toBe(true);
      }
    });
  });
});