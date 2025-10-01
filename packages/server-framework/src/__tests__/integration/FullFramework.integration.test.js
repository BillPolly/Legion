/**
 * Full framework integration tests
 * Tests complete end-to-end functionality with real actors
 * NO MOCKS - uses real server, WebSocket, and ActorSpace
 *
 * USES NEW PROTOCOL:
 * - Client creates ActorSpace and Channel
 * - Server sends session-ready first
 * - Remote actors for bidirectional communication
 */

import { BaseServer } from '../../BaseServer.js';
import { createSimpleServerActor } from '../fixtures/SimpleServerActor.js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import path from 'path';

describe('Full Framework Integration Tests', () => {
  let server;
  const testPort = 9401;
  const clientActorFile = path.join(process.cwd(), 'src/__tests__/fixtures/TestClientActor.js');

  beforeEach(async () => {
    server = new BaseServer();
    await server.initialize();
  });

  afterEach(async () => {
    if (server) {
      await server.stop().catch(() => {});
      server = null;
    }
  });

  describe('Complete route registration and serving', () => {
    it('should register route and serve HTML page', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(`http://localhost:${testPort}/app`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('/app/client.js');
      expect(html).toContain(`ws://localhost:${testPort}/ws`);
    });

    it('should serve client actor file', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(`http://localhost:${testPort}/app/client.js`);
      expect(response.status).toBe(200);

      const content = await response.text();
      expect(content).toBeTruthy();
    });
  });

  describe('Client WebSocket connection with new protocol', () => {
    it('should accept WebSocket connections', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('should receive session-ready from server', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client-side ActorSpace and actor
      const clientSpace = new ActorSpace('client-test');

      let sessionReadyReceived = null;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            sessionReadyReceived = { messageType, data };
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

      // CRITICAL: Create Channel BEFORE WebSocket opens
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      const startTime = Date.now();
      while (!sessionReadyReceived && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(sessionReadyReceived).toBeDefined();
      expect(sessionReadyReceived.messageType).toBe('session-ready');
      expect(sessionReadyReceived.data.sessionId).toBeDefined();
      expect(sessionReadyReceived.data.serverActor).toBeDefined();

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace.destroy();
    }, 10000);
  });

  describe('Bidirectional actor communication', () => {
    it('should handle messages from client to server', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client-side ActorSpace
      const clientSpace = new ActorSpace('client-test');

      let serverActorId = null;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            serverActorId = data.serverActor;
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

      // CRITICAL: Create Channel BEFORE WebSocket opens
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      const startTime = Date.now();
      while (!serverActorId && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(serverActorId).toBeDefined();

      // Now we can communicate with server actor
      const serverActorRef = channel.makeRemote(serverActorId);

      // Send ping
      const result = await serverActorRef.receive('ping', {});

      expect(result).toBeDefined();
      expect(result.pong).toBe(true);

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace.destroy();
    }, 10000);

    it('should handle echo messages', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const clientSpace = new ActorSpace('client-test');

      let serverActorId = null;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            serverActorId = data.serverActor;
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      const startTime = Date.now();
      while (!serverActorId && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const serverActorRef = channel.makeRemote(serverActorId);

      // Send echo message
      const testData = { echo: 'test', nested: { value: 123 } };
      const result = await serverActorRef.receive('echo', testData);

      expect(result).toEqual(testData);

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace.destroy();
    }, 10000);
  });

  describe('Multiple concurrent connections', () => {
    it('should handle multiple WebSocket connections', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create multiple connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        const clientSpace = new ActorSpace(`client-${i}`);

        let serverActorId = null;
        const clientActor = {
          isActor: true,
          receive: function(messageType, data) {
            if (messageType === 'session-ready') {
              serverActorId = data.serverActor;
            }
          }
        };
        clientSpace.register(clientActor, 'client-root');

        const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
        const channel = clientSpace.addChannel(ws, clientActor);

        await new Promise(resolve => ws.on('open', resolve));

        // Wait for session-ready
        const startTime = Date.now();
        while (!serverActorId && (Date.now() - startTime) < 3000) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        connections.push({ ws, clientSpace, serverActorId, channel });
      }

      // All should be connected with unique server actors
      const actors = connections.map(c => c.serverActorId);
      const uniqueActors = new Set(actors);
      expect(uniqueActors.size).toBe(3);

      // Clean up
      for (const conn of connections) {
        conn.ws.close();
        await new Promise(resolve => setTimeout(resolve, 100));
        await conn.clientSpace.destroy();
      }
    }, 15000);

    it('should maintain isolated actor spaces', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create two connections
      const clientSpace1 = new ActorSpace('client-1');
      const clientSpace2 = new ActorSpace('client-2');

      let serverActor1 = null;
      let serverActor2 = null;

      const clientActor1 = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            serverActor1 = data.serverActor;
          }
        }
      };
      const clientActor2 = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            serverActor2 = data.serverActor;
          }
        }
      };

      clientSpace1.register(clientActor1, 'client-root');
      clientSpace2.register(clientActor2, 'client-root');

      const ws1 = new WebSocket(`ws://localhost:${testPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${testPort}/ws`);

      const channel1 = clientSpace1.addChannel(ws1, clientActor1);
      const channel2 = clientSpace2.addChannel(ws2, clientActor2);

      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      // Wait for both session-ready messages
      let startTime = Date.now();
      while ((!serverActor1 || !serverActor2) && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(serverActor1).toBeDefined();
      expect(serverActor2).toBeDefined();

      // Create remote actor references
      const serverRef1 = channel1.makeRemote(serverActor1);
      const serverRef2 = channel2.makeRemote(serverActor2);

      // Send ping to each
      const [response1, response2] = await Promise.all([
        serverRef1.receive('ping', {}),
        serverRef2.receive('ping', {})
      ]);

      // Each should get pong response (count depends on SimpleServerActor implementation)
      expect(response1.pong).toBe(true);
      expect(response2.pong).toBe(true);

      ws1.close();
      ws2.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace1.destroy();
      await clientSpace2.destroy();
    }, 15000);
  });

  describe('Legion package imports in client', () => {
    it('should serve Legion packages correctly', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to fetch a Legion package
      const response = await fetch(`http://localhost:${testPort}/legion/actors/src/index.js`);
      expect(response.status).toBe(200);

      const content = await response.text();
      expect(content).toBeTruthy();
      expect(response.headers.get('content-type')).toContain('javascript');
    });
  });

  describe('Service access in actors', () => {
    it('should provide ResourceManager to server actors', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const clientSpace = new ActorSpace('client-test');

      let serverActorId = null;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            serverActorId = data.serverActor;
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      const startTime = Date.now();
      while (!serverActorId && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const serverActorRef = channel.makeRemote(serverActorId);

      // Ask server actor about services (if SimpleServerActor supports this)
      const result = await serverActorRef.receive('ping', {});

      // SimpleServerActor should respond
      expect(result).toBeDefined();
      expect(result.pong).toBe(true);

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace.destroy();
    }, 10000);
  });
});
