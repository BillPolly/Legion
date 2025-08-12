import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    this._listeners = new Map();
    
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen(new Event('open'));
      this._emit('open', new Event('open'));
    }, 10);
  }
  
  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    // Store sent data for testing
    this._lastSent = data;
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose(new Event('close'));
    this._emit('close', new Event('close'));
  }
  
  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }
  
  removeEventListener(type, listener) {
    const listeners = this._listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  _emit(type, event) {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }
  
  // Test helper to simulate receiving a message
  _simulateMessage(data) {
    const event = new MessageEvent('message', { data });
    if (this.onmessage) this.onmessage(event);
    this._emit('message', event);
  }
};

// Mock localStorage
const localStorageStore = new Map();
global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, value) => localStorageStore.set(key, String(value)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
  get length() { return localStorageStore.size; },
  key: (index) => Array.from(localStorageStore.keys())[index] || null
};

// Mock MongoDB client
global.MongoClient = class MockMongoClient {
  constructor(url) {
    this.url = url;
  }
  
  async connect() {
    return this;
  }
  
  async close() {
    return true;
  }
  
  db(name) {
    return {
      collection: (collName) => ({
        find: () => ({
          toArray: async () => [],
          limit: () => ({ toArray: async () => [] }),
          skip: () => ({ limit: () => ({ toArray: async () => [] }) })
        }),
        findOne: async () => null,
        insertOne: async (doc) => ({ insertedId: 'mock-id' }),
        updateOne: async () => ({ modifiedCount: 1 }),
        deleteOne: async () => ({ deletedCount: 1 }),
        countDocuments: async () => 0,
        aggregate: () => ({ toArray: async () => [] })
      }),
      listCollections: () => ({ toArray: async () => [] })
    };
  }
};

// Mock Qdrant client
global.QdrantClient = class MockQdrantClient {
  constructor(config) {
    this.config = config;
  }
  
  async getCollections() {
    return { collections: [] };
  }
  
  async collectionInfo(name) {
    return {
      result: {
        status: 'green',
        vectors_count: 0,
        indexed_vectors_count: 0,
        points_count: 0,
        segments_count: 1
      }
    };
  }
  
  async search(collection, params) {
    return [];
  }
  
  async upsert(collection, params) {
    return { operation_id: 1, status: 'completed' };
  }
  
  async delete(collection, params) {
    return { operation_id: 2, status: 'completed' };
  }
};

// Mock DOM methods that jsdom doesn't fully support
if (typeof document !== 'undefined') {
  // Mock getBoundingClientRect
  Element.prototype.getBoundingClientRect = function() {
    return {
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0
    };
  };
  
  // Mock scrollIntoView
  Element.prototype.scrollIntoView = function() {};
  
  // Mock focus/blur if not present
  if (!Element.prototype.focus) {
    Element.prototype.focus = function() {};
  }
  if (!Element.prototype.blur) {
    Element.prototype.blur = function() {};
  }
}

// Helper to create mock umbilicals for testing
global.createMockUmbilical = (overrides = {}) => {
  return {
    dom: document.createElement('div'),
    onMount: () => {},
    onDestroy: () => {},
    onChange: () => {},
    ...overrides
  };
};

// Helper to wait for async operations
global.waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timeout waiting for condition'));
    }, timeout);
  });
};

// Helper to wait for next tick
global.nextTick = () => new Promise(resolve => setTimeout(resolve, 0));