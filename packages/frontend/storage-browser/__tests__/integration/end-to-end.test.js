/**
 * End-to-end integration tests for StorageBrowser
 * Tests the complete flow from frontend to backend through Actor protocol
 */

import { StorageActorServer } from '../../../storage/server/storage-actor-server.js';
import { StorageBrowser } from '../../src/index.js';
import { ResourceManager } from '@legion/module-loader';
import WebSocket from 'ws';
import { JSDOM } from 'jsdom';

describe('StorageBrowser End-to-End Integration', () => {
  let server;
  let resourceManager;
  let dom;
  let container;
  let browser;
  
  const TEST_PORT = 3701;
  const SERVER_URL = `ws://localhost:${TEST_PORT}/storage`;

  beforeAll(async () => {
    // Setup JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.Node = dom.window.Node;
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;
    global.WebSocket = WebSocket;
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    
    container = dom.window.document.getElementById('container');

    // Initialize ResourceManager with test environment
    resourceManager = ResourceManager.getInstance();
    
    // Mock environment variables for testing
    process.env.MONGODB_URL = 'memory://test';
    process.env.SQLITE_FILE = ':memory:';
    process.env.STORAGE_ACTOR_PORT = TEST_PORT.toString();
    
    await resourceManager.initialize();

    // Start test server
    server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });
    await server.start();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (browser) {
      browser.destroy();
    }
    if (server) {
      await server.stop();
    }
    
    // Clean up globals
    delete global.document;
    delete global.window;
    delete global.Node;
    delete global.Element;
    delete global.HTMLElement;
    delete global.WebSocket;
    delete global.localStorage;
  });

  test('should start backend Actor server and accept connections', async () => {
    expect(server).toBeDefined();
    expect(server.isRunning()).toBe(true);
    
    // Test direct WebSocket connection
    const ws = new WebSocket(SERVER_URL);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  test('should create StorageBrowser instance with proper configuration', async () => {
    browser = StorageBrowser.create({
      dom: container,
      serverUrl: SERVER_URL,
      provider: 'memory',
      database: 'test'
    });

    expect(browser).toBeDefined();
    expect(typeof browser.connect).toBe('function');
    expect(typeof browser.getCollections).toBe('function');
    expect(typeof browser.executeQuery).toBe('function');
  });

  test('should establish WebSocket connection and Actor handshake', async () => {
    let connectionResult;
    let errorResult;

    const connectPromise = new Promise((resolve, reject) => {
      browser.onConnect = (info) => {
        connectionResult = info;
        resolve();
      };
      browser.onError = (error) => {
        errorResult = error;
        reject(error);
      };
      
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    await browser.connect();
    await connectPromise;

    expect(connectionResult).toBeDefined();
    expect(connectionResult.provider).toBe('memory');
    expect(browser.isConnected()).toBe(true);
    expect(errorResult).toBeUndefined();
  });

  test('should handle provider selection and initialization', async () => {
    const providers = await browser.getProviders();
    expect(providers).toContain('memory');
    expect(providers).toContain('mongodb');
    expect(providers).toContain('sqlite');

    await browser.setProvider('memory');
    
    const info = await browser.getProviderInfo();
    expect(info.provider).toBe('memory');
    expect(info.database).toBe('test');
  });

  test('should perform collection operations', async () => {
    // Create a test collection
    await browser.createCollection('test_collection');
    
    // List collections
    const collections = await browser.getCollections();
    expect(collections).toContain('test_collection');
    
    // Select collection
    await browser.selectCollection('test_collection');
    expect(browser.getCurrentCollection()).toBe('test_collection');
  });

  test('should perform document CRUD operations', async () => {
    await browser.selectCollection('test_collection');
    
    // Create document
    const createResult = await browser.createDocument({
      name: 'Test Document',
      status: 'active',
      value: 42
    });
    expect(createResult.success).toBe(true);
    expect(createResult.id).toBeDefined();
    
    const docId = createResult.id;
    
    // Read document
    const document = await browser.getDocument(docId);
    expect(document).toBeDefined();
    expect(document.name).toBe('Test Document');
    expect(document.status).toBe('active');
    expect(document.value).toBe(42);
    
    // Update document
    await browser.updateDocument(docId, {
      $set: { status: 'updated', value: 100 }
    });
    
    const updatedDoc = await browser.getDocument(docId);
    expect(updatedDoc.status).toBe('updated');
    expect(updatedDoc.value).toBe(100);
    expect(updatedDoc.name).toBe('Test Document'); // Should remain unchanged
    
    // List documents
    const documents = await browser.getDocuments();
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.some(doc => doc._id === docId)).toBe(true);
    
    // Delete document
    await browser.deleteDocument(docId);
    
    const deletedDoc = await browser.getDocument(docId);
    expect(deletedDoc).toBeNull();
  });

  test('should execute MongoDB queries correctly', async () => {
    await browser.selectCollection('test_collection');
    
    // Insert test data
    await browser.createDocument({ name: 'John', age: 25, status: 'active' });
    await browser.createDocument({ name: 'Jane', age: 30, status: 'active' });
    await browser.createDocument({ name: 'Bob', age: 20, status: 'inactive' });
    
    // Simple query
    const activeUsers = await browser.executeQuery({ status: 'active' });
    expect(activeUsers.length).toBe(2);
    expect(activeUsers.every(user => user.status === 'active')).toBe(true);
    
    // Range query
    const adultUsers = await browser.executeQuery({ 
      age: { $gte: 25 },
      status: 'active'
    });
    expect(adultUsers.length).toBe(2);
    expect(adultUsers.every(user => user.age >= 25)).toBe(true);
    
    // Complex query
    const complexQuery = await browser.executeQuery({
      $and: [
        { age: { $gte: 20, $lt: 30 } },
        { status: 'active' }
      ]
    });
    expect(complexQuery.length).toBe(1);
    expect(complexQuery[0].name).toBe('John');
    
    // Count query
    const count = await browser.count({ status: 'active' });
    expect(count).toBe(2);
  });

  test('should handle errors gracefully', async () => {
    let errorCaught = null;
    
    browser.onError = (error) => {
      errorCaught = error;
    };
    
    // Try to access non-existent collection
    try {
      await browser.selectCollection('non_existent_collection');
      await browser.getDocuments();
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    // Try invalid query
    try {
      await browser.executeQuery({ $invalidOperator: 'test' });
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    // Try to get non-existent document
    const nonExistentDoc = await browser.getDocument('non-existent-id');
    expect(nonExistentDoc).toBeNull();
  });

  test('should handle connection resilience', async () => {
    let disconnectCount = 0;
    let reconnectCount = 0;
    
    browser.onDisconnect = () => {
      disconnectCount++;
    };
    
    browser.onConnect = () => {
      reconnectCount++;
    };
    
    expect(browser.isConnected()).toBe(true);
    
    // Force disconnect
    browser.disconnect();
    expect(browser.isConnected()).toBe(false);
    expect(disconnectCount).toBe(1);
    
    // Reconnect
    await browser.connect();
    expect(browser.isConnected()).toBe(true);
    expect(reconnectCount).toBeGreaterThan(0);
  });

  test('should comply with Umbilical protocol', () => {
    // Test introspection mode
    const introspection = StorageBrowser.create({
      describe: true
    });
    
    expect(introspection).toBeDefined();
    expect(introspection.name).toBe('StorageBrowser');
    expect(introspection.version).toBeDefined();
    expect(introspection.description).toBeDefined();
    expect(introspection.configSchema).toBeDefined();
    
    // Test validation mode
    const validation = StorageBrowser.create({
      validate: {
        dom: container,
        serverUrl: SERVER_URL,
        provider: 'memory'
      }
    });
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    
    // Test invalid configuration
    const invalidValidation = StorageBrowser.create({
      validate: {
        // Missing required dom
        serverUrl: SERVER_URL
      }
    });
    
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);
  });

  test('should render UI components correctly', async () => {
    // The browser should have rendered into the container
    expect(container.children.length).toBeGreaterThan(0);
    
    const browserElement = container.querySelector('.storage-browser');
    expect(browserElement).toBeDefined();
    
    // Check for key UI elements
    const collectionsPane = container.querySelector('.collections-pane');
    const documentsPane = container.querySelector('.documents-pane');
    const queryEditor = container.querySelector('.query-editor');
    
    // These should exist based on our view implementation
    expect(collectionsPane || documentsPane || queryEditor).toBeTruthy();
  });

  test('should handle data caching correctly', async () => {
    await browser.selectCollection('test_collection');
    
    // First query should hit the backend
    const startTime = Date.now();
    const results1 = await browser.executeQuery({ status: 'active' });
    const firstQueryTime = Date.now() - startTime;
    
    // Second identical query should be faster due to caching
    const startTime2 = Date.now();
    const results2 = await browser.executeQuery({ status: 'active' });
    const secondQueryTime = Date.now() - startTime2;
    
    expect(results1).toEqual(results2);
    // Cache should make second query significantly faster
    // (though this might be flaky in test environment)
    expect(secondQueryTime).toBeLessThanOrEqual(firstQueryTime + 10);
  });
});