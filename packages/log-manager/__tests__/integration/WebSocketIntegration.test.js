/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LegionLogManager } from '../../src/LegionLogManager.js';
import { LogWebSocketServer } from '../../src/websocket/LogWebSocketServer.js';
import {
  MockResourceManager,
  MockStorageProvider,
  MockSemanticSearchProvider,
  sleep,
  waitForEvent
} from '../utils/TestUtils.js';
import WebSocket from 'ws';

describe('WebSocket Integration Tests', () => {
  let legionLogManager;
  let mockResourceManager;
  let wsServer;
  let serverPort;

  beforeEach(async () => {
    mockResourceManager = new MockResourceManager();
    mockResourceManager.set('StorageProvider', new MockStorageProvider());
    mockResourceManager.set('SemanticSearchProvider', new MockSemanticSearchProvider());
    
    legionLogManager = await LegionLogManager.create(mockResourceManager);
    
    // Start WebSocket server on random port
    const serverResult = await legionLogManager.startWebSocketServer({ port: 0 });
    serverPort = serverResult.port;
    wsServer = legionLogManager.wsServer;
  });

  afterEach(async () => {
    if (legionLogManager) {
      await legionLogManager.cleanup();
    }
  });

  describe('WebSocket Server Lifecycle', () => {
    test('should start WebSocket server on specified port', async () => {
      // Server should be running from beforeEach
      expect(serverPort).toBeGreaterThan(0);
      expect(wsServer.isRunning()).toBe(true);
    });

    test('should accept WebSocket connections', (done) => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      client.on('open', () => {
        expect(wsServer.getClientCount()).toBe(1);
        client.close();
        done();
      });

      client.on('error', done);
    });

    test('should handle client disconnections', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(wsServer.getClientCount()).toBe(1);
      
      client.close();
      
      // Wait for disconnect to be processed
      await sleep(100);
      expect(wsServer.getClientCount()).toBe(0);
    });

    test('should stop WebSocket server cleanly', async () => {
      expect(wsServer.isRunning()).toBe(true);
      
      const stopResult = await legionLogManager.stopWebSocketServer();
      
      expect(stopResult.success).toBe(true);
      expect(wsServer.isRunning()).toBe(false);
    });
  });

  describe('Real-time Log Streaming', () => {
    let client;
    let sessionId;

    beforeEach(async () => {
      // Create test session
      const sessionResult = await legionLogManager.createSession({ name: 'WebSocket Test' });
      sessionId = sessionResult.sessionId;
      
      // Connect WebSocket client
      client = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client.on('open', resolve);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should stream log messages to subscribed clients', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe to session logs
      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId
      }));

      // Wait for subscription confirmation
      await sleep(100);

      // Send a log message
      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-stream-test',
        source: 'stdout',
        message: 'Streaming test message',
        level: 'info'
      });

      // Wait for message to be streamed
      await sleep(100);

      // Should have received subscription confirmation and log message
      expect(messages.length).toBeGreaterThanOrEqual(2);
      
      const logMessage = messages.find(m => m.type === 'log');
      expect(logMessage).toBeDefined();
      expect(logMessage.data.message).toBe('Streaming test message');
      expect(logMessage.data.sessionId).toBe(sessionId);
    });

    test('should filter logs by level subscription', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe to only error logs
      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId,
        levels: ['error']
      }));

      await sleep(100);

      // Send different level logs
      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-filter',
        source: 'stdout',
        message: 'Info message',
        level: 'info'
      });

      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-filter',
        source: 'stderr',
        message: 'Error message',
        level: 'error'
      });

      await sleep(100);

      const logMessages = messages.filter(m => m.type === 'log');
      expect(logMessages.length).toBe(1);
      expect(logMessages[0].data.level).toBe('error');
      expect(logMessages[0].data.message).toBe('Error message');
    });

    test('should support multiple client subscriptions', async () => {
      const client2 = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client2.on('open', resolve);
      });

      const messages1 = [];
      const messages2 = [];

      client.on('message', (data) => {
        messages1.push(JSON.parse(data.toString()));
      });

      client2.on('message', (data) => {
        messages2.push(JSON.parse(data.toString()));
      });

      // Both clients subscribe to same session
      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId
      }));

      client2.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId
      }));

      await sleep(100);

      // Send log message
      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-multi',
        source: 'stdout',
        message: 'Multi-client test',
        level: 'info'
      });

      await sleep(100);

      // Both clients should receive the message
      const log1 = messages1.find(m => m.type === 'log');
      const log2 = messages2.find(m => m.type === 'log');

      expect(log1).toBeDefined();
      expect(log2).toBeDefined();
      expect(log1.data.message).toBe('Multi-client test');
      expect(log2.data.message).toBe('Multi-client test');

      client2.close();
    });

    test('should handle unsubscribe requests', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe first
      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionId
      }));

      await sleep(100);

      // Send a message (should be received)
      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-unsub',
        source: 'stdout',
        message: 'Before unsubscribe',
        level: 'info'
      });

      await sleep(100);

      // Unsubscribe
      client.send(JSON.stringify({
        type: 'unsubscribe',
        sessionId: sessionId
      }));

      await sleep(100);

      // Send another message (should NOT be received)
      await legionLogManager.logMessage({
        sessionId,
        processId: 'proc-unsub',
        source: 'stdout',
        message: 'After unsubscribe',
        level: 'info'
      });

      await sleep(100);

      const logMessages = messages.filter(m => m.type === 'log');
      expect(logMessages.length).toBe(1);
      expect(logMessages[0].data.message).toBe('Before unsubscribe');
    });
  });

  describe('Search Result Streaming', () => {
    let client;
    let sessionId;

    beforeEach(async () => {
      // Create session with test data
      const sessionResult = await legionLogManager.createSession({ name: 'Search Stream Test' });
      sessionId = sessionResult.sessionId;
      
      // Add test logs
      for (let i = 0; i < 20; i++) {
        await legionLogManager.logMessage({
          sessionId,
          processId: 'proc-search',
          source: i % 2 === 0 ? 'stdout' : 'stderr',
          message: `Search test message ${i} with keyword search`,
          level: i % 3 === 0 ? 'error' : 'info'
        });
      }

      // Connect client
      client = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client.on('open', resolve);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should stream search results', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Request search
      client.send(JSON.stringify({
        type: 'search',
        query: 'Search test',
        sessionId: sessionId,
        mode: 'keyword',
        limit: 10
      }));

      // Wait for search results
      await sleep(500);

      const searchResults = messages.filter(m => m.type === 'search-result');
      expect(searchResults.length).toBeGreaterThan(0);
      
      const result = searchResults[0];
      expect(result.data.query).toBe('Search test');
      expect(result.data.matches).toBeDefined();
      expect(result.data.matches.length).toBeGreaterThan(0);
    });

    test('should handle search errors gracefully', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Request invalid search
      client.send(JSON.stringify({
        type: 'search',
        query: '[invalid(regex',
        sessionId: sessionId,
        mode: 'regex'
      }));

      await sleep(200);

      const errorMessages = messages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].data.error).toContain('Invalid regex');
    });
  });

  describe('Session Management via WebSocket', () => {
    let client;

    beforeEach(async () => {
      client = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client.on('open', resolve);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should create session via WebSocket', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      client.send(JSON.stringify({
        type: 'create-session',
        name: 'WS Created Session',
        description: 'Created via WebSocket'
      }));

      await sleep(200);

      const sessionMessages = messages.filter(m => m.type === 'session-created');
      expect(sessionMessages.length).toBe(1);
      
      const session = sessionMessages[0].data;
      expect(session.name).toBe('WS Created Session');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('active');
    });

    test('should list sessions via WebSocket', async () => {
      // Create a couple of sessions first
      await legionLogManager.createSession({ name: 'Session 1' });
      await legionLogManager.createSession({ name: 'Session 2' });

      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      client.send(JSON.stringify({
        type: 'list-sessions'
      }));

      await sleep(200);

      const listMessages = messages.filter(m => m.type === 'sessions-list');
      expect(listMessages.length).toBe(1);
      
      const sessionsList = listMessages[0].data;
      expect(sessionsList.sessions).toHaveLength(2);
      expect(sessionsList.total).toBe(2);
    });

    test('should end session via WebSocket', async () => {
      const sessionResult = await legionLogManager.createSession({ name: 'End Test' });
      
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      client.send(JSON.stringify({
        type: 'end-session',
        sessionId: sessionResult.sessionId
      }));

      await sleep(200);

      const endMessages = messages.filter(m => m.type === 'session-ended');
      expect(endMessages.length).toBe(1);
      
      const endedSession = endMessages[0].data;
      expect(endedSession.sessionId).toBe(sessionResult.sessionId);
      expect(endedSession.status).toBe('completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let client;

    beforeEach(async () => {
      client = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client.on('open', resolve);
      });
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    test('should handle malformed JSON messages', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send invalid JSON
      client.send('invalid json {');

      await sleep(100);

      const errorMessages = messages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].data.error).toContain('Invalid JSON');
    });

    test('should handle unknown message types', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      client.send(JSON.stringify({
        type: 'unknown-type',
        data: 'test'
      }));

      await sleep(100);

      const errorMessages = messages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBe(1);
      expect(errorMessages[0].data.error).toContain('Unknown message type');
    });

    test('should handle subscription to non-existent session', async () => {
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: 'non-existent-session'
      }));

      await sleep(100);

      // Should still confirm subscription (client-side filtering)
      const confirmMessages = messages.filter(m => m.type === 'subscription-confirmed');
      expect(confirmMessages.length).toBe(1);
    });

    test('should handle server shutdown gracefully', async () => {
      let disconnected = false;
      client.on('close', () => {
        disconnected = true;
      });

      // Stop the server
      await legionLogManager.stopWebSocketServer();
      
      // Wait for disconnect
      await sleep(200);
      
      expect(disconnected).toBe(true);
    });

    test('should handle multiple rapid subscriptions', async () => {
      const sessionResult = await legionLogManager.createSession({ name: 'Rapid Sub Test' });
      
      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send multiple rapid subscription requests
      for (let i = 0; i < 10; i++) {
        client.send(JSON.stringify({
          type: 'subscribe',
          sessionId: sessionResult.sessionId
        }));
      }

      await sleep(200);

      const confirmMessages = messages.filter(m => m.type === 'subscription-confirmed');
      expect(confirmMessages.length).toBe(10); // Should handle all requests
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent clients', async () => {
      const clientCount = 10;
      const clients = [];
      
      // Connect multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = new WebSocket(`ws://localhost:${serverPort}`);
        await new Promise((resolve) => {
          client.on('open', resolve);
        });
        clients.push(client);
      }

      expect(wsServer.getClientCount()).toBe(clientCount);

      // All clients subscribe to same session
      const sessionResult = await legionLogManager.createSession({ name: 'Load Test' });
      
      clients.forEach(client => {
        client.send(JSON.stringify({
          type: 'subscribe',
          sessionId: sessionResult.sessionId
        }));
      });

      await sleep(200);

      // Send log message - all clients should receive it
      await legionLogManager.logMessage({
        sessionId: sessionResult.sessionId,
        processId: 'proc-load',
        source: 'stdout',
        message: 'Load test message',
        level: 'info'
      });

      await sleep(200);

      // Cleanup clients
      clients.forEach(client => client.close());
      await sleep(100);

      expect(wsServer.getClientCount()).toBe(0);
    }, 10000); // Increase timeout for load test

    test('should handle rapid log message streaming', async () => {
      const client = new WebSocket(`ws://localhost:${serverPort}`);
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      const messages = [];
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      const sessionResult = await legionLogManager.createSession({ name: 'Rapid Stream Test' });
      
      client.send(JSON.stringify({
        type: 'subscribe',
        sessionId: sessionResult.sessionId
      }));

      await sleep(100);

      // Send many rapid log messages
      const messageCount = 100;
      for (let i = 0; i < messageCount; i++) {
        await legionLogManager.logMessage({
          sessionId: sessionResult.sessionId,
          processId: 'proc-rapid',
          source: 'stdout',
          message: `Rapid message ${i}`,
          level: 'info'
        });
      }

      // Wait for all messages to be processed
      await sleep(1000);

      const logMessages = messages.filter(m => m.type === 'log');
      expect(logMessages.length).toBe(messageCount);

      client.close();
    }, 10000);
  });
});