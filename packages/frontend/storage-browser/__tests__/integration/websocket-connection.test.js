/**
 * WebSocket connection and protocol tests
 */

import { WebSocketChannel } from '../../src/actors/WebSocketChannel.js';
import { StorageActorServer } from '../../../storage/server/storage-actor-server.js';
import { ResourceManager } from '@legion/module-loader';
import WebSocket from 'ws';

describe('WebSocket Connection Integration', () => {
  let server;
  let resourceManager;
  const TEST_PORT = 3703;
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
    if (server) {
      await server.stop();
    }
    delete global.WebSocket;
  });

  test('should establish WebSocket connection successfully', async () => {
    const channel = new WebSocketChannel(SERVER_URL);
    
    let connected = false;
    channel.on('open', () => {
      connected = true;
    });

    await channel.connect();
    expect(connected).toBe(true);
    expect(channel.isConnected()).toBe(true);

    channel.disconnect();
  });

  test('should handle connection failure gracefully', async () => {
    const channel = new WebSocketChannel('ws://localhost:99999/invalid');
    
    let errorReceived = false;
    channel.on('error', () => {
      errorReceived = true;
    });

    try {
      await channel.connect();
    } catch (error) {
      expect(error).toBeDefined();
      errorReceived = true;
    }

    expect(errorReceived).toBe(true);
    expect(channel.isConnected()).toBe(false);
  });

  test('should send and receive messages correctly', async () => {
    const channel = new WebSocketChannel(SERVER_URL);
    await channel.connect();

    let messageReceived = null;
    channel.on('message', (message) => {
      messageReceived = message;
    });

    const testMessage = {
      type: 'request',
      id: 'test-message',
      method: 'getProviders',
      params: {}
    };

    channel.send(testMessage);

    // Wait for response
    await new Promise((resolve) => {
      const checkMessage = () => {
        if (messageReceived && messageReceived.id === 'test-message') {
          resolve();
        } else {
          setTimeout(checkMessage, 10);
        }
      };
      checkMessage();
    });

    expect(messageReceived).toBeDefined();
    expect(messageReceived.type).toBe('response');
    expect(messageReceived.id).toBe('test-message');
    expect(Array.isArray(messageReceived.result)).toBe(true);

    channel.disconnect();
  });

  test('should handle auto-reconnection with exponential backoff', async () => {
    const channel = new WebSocketChannel(SERVER_URL, {
      autoReconnect: true,
      initialReconnectDelay: 100,
      maxReconnectDelay: 1000,
      maxReconnectAttempts: 3
    });

    let connectCount = 0;
    let disconnectCount = 0;

    channel.on('open', () => {
      connectCount++;
    });

    channel.on('close', () => {
      disconnectCount++;
    });

    // Initial connection
    await channel.connect();
    expect(connectCount).toBe(1);

    // Force close connection (simulates network failure)
    channel.ws.close();

    // Wait for reconnection attempts
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should have attempted reconnection
    expect(disconnectCount).toBeGreaterThan(0);
    expect(connectCount).toBeGreaterThan(1);

    channel.disconnect();
  });

  test('should queue messages during disconnection', async () => {
    const channel = new WebSocketChannel(SERVER_URL, {
      autoReconnect: true,
      initialReconnectDelay: 100
    });

    await channel.connect();

    // Disconnect
    channel.ws.close();

    // Send messages while disconnected
    const queuedMessages = [
      { type: 'request', id: 'queued-1', method: 'getProviders' },
      { type: 'request', id: 'queued-2', method: 'getProviders' }
    ];

    queuedMessages.forEach(msg => channel.send(msg));

    // Wait for reconnection
    await new Promise(resolve => {
      channel.on('open', resolve);
      setTimeout(() => resolve(), 3000); // Timeout fallback
    });

    // Messages should be sent after reconnection
    const responses = [];
    
    await new Promise(resolve => {
      channel.on('message', (message) => {
        if (message.id?.startsWith('queued-')) {
          responses.push(message);
          if (responses.length === queuedMessages.length) {
            resolve();
          }
        }
      });
      
      setTimeout(resolve, 2000); // Timeout fallback
    });

    expect(responses.length).toBe(queuedMessages.length);
    responses.forEach(response => {
      expect(response.type).toBe('response');
    });

    channel.disconnect();
  });

  test('should handle connection timeout properly', async () => {
    const channel = new WebSocketChannel('ws://localhost:99999/timeout', {
      connectionTimeout: 500
    });

    const startTime = Date.now();
    
    try {
      await channel.connect();
      fail('Should have thrown timeout error');
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // Should timeout quickly
      expect(error.message).toMatch(/timeout|connection/i);
    }

    expect(channel.isConnected()).toBe(false);
  });

  test('should emit proper events during connection lifecycle', async () => {
    const channel = new WebSocketChannel(SERVER_URL);
    
    const events = [];
    
    channel.on('connecting', () => events.push('connecting'));
    channel.on('open', () => events.push('open'));
    channel.on('close', () => events.push('close'));
    channel.on('error', () => events.push('error'));

    await channel.connect();
    channel.disconnect();

    // Wait for close event
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(events).toContain('connecting');
    expect(events).toContain('open');
    expect(events).toContain('close');
  });

  test('should handle malformed messages gracefully', async () => {
    const channel = new WebSocketChannel(SERVER_URL);
    await channel.connect();

    let errorCaught = false;
    channel.on('error', () => {
      errorCaught = true;
    });

    // Send malformed JSON
    channel.ws.send('invalid json {');

    // Wait for potential error
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not crash or error - just ignore malformed messages
    expect(channel.isConnected()).toBe(true);

    channel.disconnect();
  });
});