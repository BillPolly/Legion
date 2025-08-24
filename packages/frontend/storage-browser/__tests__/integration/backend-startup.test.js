/**
 * Backend Actor server startup and configuration tests
 */

import { StorageActorServer } from '../../../storage/server/storage-actor-server.js';
import { ResourceManager } from '@legion/module-loader';
import WebSocket from 'ws';

describe('Backend Actor Server Integration', () => {
  let resourceManager;
  const TEST_PORT = 3702;

  beforeEach(async () => {
    resourceManager = ResourceManager.getInstance();
    
    // Mock environment for testing
    process.env.MONGODB_URL = 'memory://test';
    process.env.SQLITE_FILE = ':memory:';
    process.env.STORAGE_ACTOR_PORT = TEST_PORT.toString();
    
    await resourceManager.initialize();
  });

  test('should create StorageActorServer with ResourceManager', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
    expect(typeof server.isRunning).toBe('function');
    
    expect(server.isRunning()).toBe(false);
  });

  test('should start server and bind to correct port', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    await server.start();
    expect(server.isRunning()).toBe(true);

    // Test that port is actually bound
    const testConnection = new WebSocket(`ws://localhost:${TEST_PORT}/storage`);
    
    await new Promise((resolve, reject) => {
      testConnection.on('open', () => {
        testConnection.close();
        resolve();
      });
      testConnection.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  test('should auto-configure storage providers from ResourceManager', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    await server.start();

    // Test WebSocket connection and provider info
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/storage`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Send getProviders request
        ws.send(JSON.stringify({
          type: 'request',
          id: 'test-1',
          method: 'getProviders',
          params: {}
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.id === 'test-1' && message.type === 'response') {
          expect(message.result).toBeDefined();
          expect(Array.isArray(message.result)).toBe(true);
          expect(message.result).toContain('memory');
          
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    await server.stop();
  });

  test('should handle multiple concurrent connections', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    await server.start();

    const connectionPromises = [];
    const connectionCount = 5;

    for (let i = 0; i < connectionCount; i++) {
      const promise = new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}/storage`);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'request',
            id: `test-${i}`,
            method: 'getProviders',
            params: {}
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.id === `test-${i}`) {
            ws.close();
            resolve(message);
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      connectionPromises.push(promise);
    }

    const results = await Promise.all(connectionPromises);
    expect(results.length).toBe(connectionCount);
    results.forEach(result => {
      expect(result.type).toBe('response');
      expect(Array.isArray(result.result)).toBe(true);
    });

    await server.stop();
  });

  test('should gracefully shutdown and cleanup resources', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    await server.start();
    expect(server.isRunning()).toBe(true);

    // Create connection
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/storage`);
    await new Promise(resolve => ws.on('open', resolve));

    // Stop server
    await server.stop();
    expect(server.isRunning()).toBe(false);

    // Connection should be closed
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  test('should handle server restart correctly', async () => {
    const server = new StorageActorServer({ 
      resourceManager,
      port: TEST_PORT
    });

    // Start server
    await server.start();
    expect(server.isRunning()).toBe(true);

    // Stop server
    await server.stop();
    expect(server.isRunning()).toBe(false);

    // Restart server
    await server.start();
    expect(server.isRunning()).toBe(true);

    // Test connection still works
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/storage`);
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 2000);
    });

    await server.stop();
  });
});