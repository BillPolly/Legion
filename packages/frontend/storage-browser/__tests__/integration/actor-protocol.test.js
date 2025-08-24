/**
 * Actor message protocol and handshake tests
 */

import { StorageActorClient } from '../../src/actors/StorageActorClient.js';
import { StorageActorServer } from '../../../storage/server/storage-actor-server.js';
import { ResourceManager } from '@legion/module-loader';
import WebSocket from 'ws';

describe('Actor Protocol Integration', () => {
  let server;
  let resourceManager;
  let client;
  const TEST_PORT = 3704;
  const SERVER_URL = `ws://localhost:${TEST_PORT}/storage`;

  beforeAll(async () => {
    global.WebSocket = WebSocket;
    
    resourceManager = ResourceManager.getInstance();
    process.env.MONGODB_URL = 'memory://test';
    process.env.STORAGE_ACTOR_PORT = TEST_PORT.toString();
    await resourceManager.initialize();

    server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });
    await server.start();
  });

  afterAll(async () => {
    if (client) {
      client.disconnect();
    }
    if (server) {
      await server.stop();
    }
    delete global.WebSocket;
  });

  beforeEach(() => {
    client = new StorageActorClient(SERVER_URL);
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  test('should complete Actor handshake successfully', async () => {
    let handshakeComplete = false;
    let connectionInfo = null;

    client.on('connected', (info) => {
      handshakeComplete = true;
      connectionInfo = info;
    });

    await client.connect();

    expect(handshakeComplete).toBe(true);
    expect(connectionInfo).toBeDefined();
    expect(connectionInfo.provider).toBeDefined();
    expect(Array.isArray(connectionInfo.availableProviders)).toBe(true);
    expect(client.isConnected()).toBe(true);
  });

  test('should handle request-response message pattern', async () => {
    await client.connect();

    const response = await client.request('getProviders', {});

    expect(response).toBeDefined();
    expect(Array.isArray(response)).toBe(true);
    expect(response.length).toBeGreaterThan(0);
    expect(response).toContain('memory');
  });

  test('should handle concurrent requests with unique IDs', async () => {
    await client.connect();

    const requests = [
      client.request('getProviders', {}),
      client.request('getProviders', {}),
      client.request('getProviders', {})
    ];

    const responses = await Promise.all(requests);

    expect(responses.length).toBe(3);
    responses.forEach(response => {
      expect(Array.isArray(response)).toBe(true);
      expect(response).toContain('memory');
    });
  });

  test('should handle provider selection via Actor protocol', async () => {
    await client.connect();

    // Get available providers
    const providers = await client.request('getProviders', {});
    expect(providers).toContain('memory');

    // Select memory provider
    const result = await client.request('setProvider', { 
      provider: 'memory', 
      database: 'test' 
    });
    
    expect(result.success).toBe(true);
    expect(result.provider).toBe('memory');
    expect(result.database).toBe('test');

    // Verify provider is set
    const info = await client.request('getProviderInfo', {});
    expect(info.provider).toBe('memory');
    expect(info.database).toBe('test');
  });

  test('should handle collection operations via Actor protocol', async () => {
    await client.connect();
    
    // Set provider first
    await client.request('setProvider', { 
      provider: 'memory', 
      database: 'test' 
    });

    // Create collection
    const createResult = await client.request('createCollection', { 
      name: 'test_collection' 
    });
    expect(createResult.success).toBe(true);

    // List collections
    const collections = await client.request('getCollections', {});
    expect(Array.isArray(collections)).toBe(true);
    expect(collections).toContain('test_collection');

    // Select collection
    const selectResult = await client.request('selectCollection', { 
      name: 'test_collection' 
    });
    expect(selectResult.success).toBe(true);
  });

  test('should handle document CRUD via Actor protocol', async () => {
    await client.connect();
    
    // Setup
    await client.request('setProvider', { 
      provider: 'memory', 
      database: 'test' 
    });
    await client.request('createCollection', { name: 'test_docs' });
    await client.request('selectCollection', { name: 'test_docs' });

    // Create document
    const createResult = await client.request('createDocument', {
      document: { name: 'Test Doc', value: 42 }
    });
    expect(createResult.success).toBe(true);
    expect(createResult.id).toBeDefined();

    const docId = createResult.id;

    // Read document
    const document = await client.request('getDocument', { id: docId });
    expect(document).toBeDefined();
    expect(document.name).toBe('Test Doc');
    expect(document.value).toBe(42);

    // Update document
    const updateResult = await client.request('updateDocument', {
      id: docId,
      update: { $set: { value: 100 } }
    });
    expect(updateResult.success).toBe(true);

    // Verify update
    const updatedDoc = await client.request('getDocument', { id: docId });
    expect(updatedDoc.value).toBe(100);

    // Delete document
    const deleteResult = await client.request('deleteDocument', { id: docId });
    expect(deleteResult.success).toBe(true);

    // Verify deletion
    const deletedDoc = await client.request('getDocument', { id: docId });
    expect(deletedDoc).toBeNull();
  });

  test('should handle query operations via Actor protocol', async () => {
    await client.connect();
    
    // Setup
    await client.request('setProvider', { 
      provider: 'memory', 
      database: 'test' 
    });
    await client.request('createCollection', { name: 'query_test' });
    await client.request('selectCollection', { name: 'query_test' });

    // Insert test data
    await client.request('createDocument', {
      document: { name: 'John', age: 25, status: 'active' }
    });
    await client.request('createDocument', {
      document: { name: 'Jane', age: 30, status: 'active' }
    });
    await client.request('createDocument', {
      document: { name: 'Bob', age: 20, status: 'inactive' }
    });

    // Execute query
    const results = await client.request('executeQuery', {
      query: { status: 'active' }
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    results.forEach(doc => {
      expect(doc.status).toBe('active');
    });

    // Count query
    const count = await client.request('count', {
      query: { age: { $gte: 25 } }
    });
    expect(typeof count).toBe('number');
    expect(count).toBe(2);
  });

  test('should handle Actor protocol errors gracefully', async () => {
    await client.connect();

    // Test invalid method
    try {
      await client.request('invalidMethod', {});
      fail('Should have thrown error for invalid method');
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toMatch(/method|unknown/i);
    }

    // Test invalid parameters
    try {
      await client.request('setProvider', { invalidParam: 'test' });
      fail('Should have thrown error for invalid parameters');
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Connection should still be alive
    expect(client.isConnected()).toBe(true);
  });

  test('should handle message timeout correctly', async () => {
    await client.connect();

    // Mock a request that takes too long
    const originalTimeout = client.timeout;
    client.timeout = 100; // Very short timeout

    try {
      // This should timeout since we set a very short timeout
      await client.request('getProviders', {});
    } catch (error) {
      expect(error.message).toMatch(/timeout/i);
    } finally {
      client.timeout = originalTimeout;
    }
  });

  test('should emit events during Actor operations', async () => {
    const events = [];
    
    client.on('connecting', () => events.push('connecting'));
    client.on('connected', () => events.push('connected'));
    client.on('request', (data) => events.push(`request:${data.method}`));
    client.on('response', (data) => events.push(`response:${data.id}`));
    client.on('error', () => events.push('error'));

    await client.connect();
    await client.request('getProviders', {});

    expect(events).toContain('connecting');
    expect(events).toContain('connected');
    expect(events.some(e => e.startsWith('request:'))).toBe(true);
    expect(events.some(e => e.startsWith('response:'))).toBe(true);
  });

  test('should handle notification messages from server', async () => {
    await client.connect();

    const notifications = [];
    client.on('notification', (notification) => {
      notifications.push(notification);
    });

    // Simulate server notification by manually sending message
    client.channel.ws.send(JSON.stringify({
      type: 'notification',
      event: 'documentChanged',
      data: { collection: 'test', id: 'doc123' }
    }));

    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(notifications.length).toBe(1);
    expect(notifications[0].event).toBe('documentChanged');
    expect(notifications[0].data.collection).toBe('test');
  });

  test('should maintain protocol compliance with Actor specification', async () => {
    await client.connect();

    // All requests should follow Actor protocol format
    let lastMessage = null;
    
    const originalSend = client.channel.send;
    client.channel.send = (message) => {
      lastMessage = message;
      return originalSend.call(client.channel, message);
    };

    await client.request('getProviders', {});

    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('request');
    expect(lastMessage.id).toBeDefined();
    expect(lastMessage.method).toBe('getProviders');
    expect(lastMessage.params).toBeDefined();
    expect(typeof lastMessage.timestamp).toBe('number');
  });
});