/**
 * Integration tests for WebSocket server and connections
 * NO MOCKS - uses real WebSocket connections
 */

import { BaseServer } from '../../BaseServer.js';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

describe('WebSocket Integration Tests', () => {
  let server;
  let testClientFile;
  const testPort = 9877;

  beforeAll(async () => {
    // Create test client file
    testClientFile = path.join(process.cwd(), 'test-ws-client.js');
    await fs.writeFile(testClientFile, `
      export default class TestWSClient {
        constructor() {
          this.name = 'TestWSClient';
        }
        setRemoteActor(remote) {
          this.remoteActor = remote;
        }
      }
    `);
  });

  afterAll(async () => {
    await fs.unlink(testClientFile).catch(() => {});
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  describe('WebSocket server creation', () => {
    it('should create WebSocket server on /ws endpoint', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      // Connect to WebSocket
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('should handle WebSocket connection', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      const connected = await new Promise((resolve) => {
        ws.on('open', () => resolve(true));
        ws.on('error', () => resolve(false));
      });
      
      expect(connected).toBe(true);
      ws.close();
    });

    it('should support multiple concurrent connections', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      // Create multiple connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
        connections.push(ws);
      }
      
      // Wait for all to connect
      await Promise.all(connections.map(ws => 
        new Promise((resolve) => {
          ws.on('open', resolve);
        })
      ));
      
      // All should be connected
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Clean up
      connections.forEach(ws => ws.close());
    });
  });

  describe('WebSocket on multiple ports', () => {
    it('should create separate WebSocket servers for different ports', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory1 = () => ({ name: 'Actor1' });
      const factory2 = () => ({ name: 'Actor2' });
      
      server.registerRoute('/app1', factory1, testClientFile, testPort);
      server.registerRoute('/app2', factory2, testClientFile, testPort + 1);
      await server.start();
      
      // Connect to first port
      const ws1 = new WebSocket(`ws://localhost:${testPort}/ws`);
      await new Promise(resolve => ws1.on('open', resolve));
      expect(ws1.readyState).toBe(WebSocket.OPEN);
      
      // Connect to second port
      const ws2 = new WebSocket(`ws://localhost:${testPort + 1}/ws`);
      await new Promise(resolve => ws2.on('open', resolve));
      expect(ws2.readyState).toBe(WebSocket.OPEN);
      
      // Different WebSocket servers
      expect(server.wssInstances.size).toBe(2);
      
      ws1.close();
      ws2.close();
    });
  });

  describe('WebSocket message handling', () => {
    it('should receive session-ready message from server on connect', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server = new BaseServer();
      await server.initialize();

      const factory = () => ({
        isActor: true,
        name: 'TestActor',
        receive: () => {},
        setRemoteActor: () => {}
      });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();

      // Create client-side ActorSpace and actor
      const clientSpace = new ActorSpace('client-test');

      // Track if session-ready was received
      let sessionReadyReceived = null;

      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          console.log('[TEST CLIENT] Received message:', messageType, data);
          if (messageType === 'session-ready') {
            sessionReadyReceived = { messageType, data };
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

      // CRITICAL: Create Channel BEFORE WebSocket opens so messages can be received!
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for session-ready')), 3000);
        const check = () => {
          if (sessionReadyReceived) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

      // Server should have sent session-ready
      expect(sessionReadyReceived).toBeDefined();
      expect(sessionReadyReceived.messageType).toBe('session-ready');
      expect(sessionReadyReceived.data.sessionId).toBeDefined();
      expect(sessionReadyReceived.data.serverActor).toBeDefined();

      ws.close();
      await clientSpace.destroy();
    }, 10000);

    it('should support actor communication after session-ready', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server = new BaseServer();
      await server.initialize();

      const factory = () => ({
        isActor: true,
        name: 'TestActor',
        receive: (messageType, data) => {
          console.log('[TEST SERVER ACTOR] Received:', messageType, data);
          if (messageType === 'ping') {
            return { pong: true, timestamp: Date.now() };
          }
        },
        setRemoteActor: () => {}
      });

      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();

      // Create client-side ActorSpace
      const clientSpace = new ActorSpace('client-test');

      let serverActorId = null;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          console.log('[TEST CLIENT] Received:', messageType, data);
          if (messageType === 'session-ready') {
            serverActorId = data.serverActor;
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

      // CRITICAL: Create Channel BEFORE WebSocket opens so messages can be received!
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for session-ready')), 3000);
        const check = () => {
          if (serverActorId) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

      // Now we can communicate with server actor
      const serverActorRef = channel.makeRemote(serverActorId);

      // Send ping
      const result = await serverActorRef.receive('ping', {});

      expect(result).toBeDefined();
      expect(result.pong).toBe(true);

      ws.close();
      await clientSpace.destroy();
    }, 10000);
  });

  describe('Connection lifecycle', () => {
    it('should handle connection close', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));
      
      // Close connection
      const closePromise = new Promise(resolve => {
        ws.on('close', resolve);
      });
      
      ws.close();
      await closePromise;
      
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle server shutdown with active connections', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      // Create connections
      const ws1 = new WebSocket(`ws://localhost:${testPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);
      
      // Stop server
      await server.stop();
      
      // Connections should be closed
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(ws1.readyState).toBe(WebSocket.CLOSED);
      expect(ws2.readyState).toBe(WebSocket.CLOSED);
    });
  });
});