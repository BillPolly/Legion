/**
 * Full framework integration tests
 * Tests complete end-to-end functionality with real actors
 * NO MOCKS - uses real server, WebSocket, and actors
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

    it('should serve client actor file with import rewriting', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/app/client.js`);
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('/legion/actors');
      expect(content).toContain('/legion/resource-manager');
      expect(content).not.toContain('@legion/actors');
    });
  });

  describe('Client WebSocket connection', () => {
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

    it('should complete actor handshake', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send handshake
      const handshakeMessage = {
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-root-123'
      };
      
      ws.send(JSON.stringify(handshakeMessage));
      
      // Wait for handshake response
      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });
      
      expect(response.type).toBe('actor_handshake_ack');
      expect(response.serverRootActor).toBeDefined();
      expect(response.route).toBe('/app');
      
      ws.close();
    });
  });

  describe('Bidirectional actor communication', () => {
    it('should handle messages from client to server', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Complete handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-root-456'
      }));
      
      let serverRootActor;
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_handshake_ack') {
            serverRootActor = msg.serverRootActor;
            resolve();
          }
        });
      });
      
      // Send actor message
      const actorMessage = {
        type: 'actor_message',
        from: 'client-root-456',
        to: serverRootActor,
        message: {
          type: 'ping',
          data: { test: 'value' }
        }
      };
      
      ws.send(JSON.stringify(actorMessage));
      
      // Wait for response
      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_message') {
            resolve(msg);
          }
        });
      });
      
      expect(response.type).toBe('actor_message');
      expect(response.message.type).toBe('pong');
      expect(response.message.count).toBe(1);
      
      ws.close();
    });

    it('should handle echo messages', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Complete handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-root-789'
      }));
      
      let serverRootActor;
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_handshake_ack') {
            serverRootActor = msg.serverRootActor;
            resolve();
          }
        });
      });
      
      // Send echo message
      const testData = { echo: 'test', nested: { value: 123 } };
      const echoMessage = {
        type: 'actor_message',
        from: 'client-root-789',
        to: serverRootActor,
        message: {
          type: 'echo',
          data: testData
        }
      };
      
      ws.send(JSON.stringify(echoMessage));
      
      // Wait for echo response
      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_message') {
            resolve(msg);
          }
        });
      });
      
      expect(response.message.type).toBe('echo');
      expect(response.message.data).toEqual(testData);
      
      ws.close();
    });
  });

  describe('Multiple concurrent connections', () => {
    it('should handle multiple WebSocket connections', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create multiple connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
        
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });
        
        connections.push(ws);
      }
      
      // All should be connected
      for (const ws of connections) {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      }
      
      // Each should be able to handshake independently
      const actors = [];
      for (let i = 0; i < connections.length; i++) {
        const ws = connections[i];
        
        ws.send(JSON.stringify({
          type: 'actor_handshake',
          route: '/app',
          clientRootActor: `client-${i}`
        }));
        
        const response = await new Promise((resolve) => {
          ws.on('message', (data) => {
            resolve(JSON.parse(data.toString()));
          });
        });
        
        expect(response.type).toBe('actor_handshake_ack');
        actors.push(response.serverRootActor);
      }
      
      // Each should have unique server actor
      const uniqueActors = new Set(actors);
      expect(uniqueActors.size).toBe(3);
      
      // Clean up
      for (const ws of connections) {
        ws.close();
      }
    });

    it('should maintain isolated actor spaces', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create two connections
      const ws1 = new WebSocket(`ws://localhost:${testPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);
      
      // Handshake both
      ws1.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-1'
      }));
      
      ws2.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-2'
      }));
      
      const [actor1, actor2] = await Promise.all([
        new Promise(resolve => {
          ws1.on('message', data => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'actor_handshake_ack') {
              resolve(msg.serverRootActor);
            }
          });
        }),
        new Promise(resolve => {
          ws2.on('message', data => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'actor_handshake_ack') {
              resolve(msg.serverRootActor);
            }
          });
        })
      ]);
      
      // Send ping to each
      ws1.send(JSON.stringify({
        type: 'actor_message',
        from: 'client-1',
        to: actor1,
        message: { type: 'ping', data: 'from-1' }
      }));
      
      ws2.send(JSON.stringify({
        type: 'actor_message',
        from: 'client-2',
        to: actor2,
        message: { type: 'ping', data: 'from-2' }
      }));
      
      // Each should get independent response
      const [response1, response2] = await Promise.all([
        new Promise(resolve => {
          ws1.on('message', data => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'actor_message') {
              resolve(msg);
            }
          });
        }),
        new Promise(resolve => {
          ws2.on('message', data => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'actor_message') {
              resolve(msg);
            }
          });
        })
      ]);
      
      // Each should have count = 1 (isolated actors)
      expect(response1.message.count).toBe(1);
      expect(response2.message.count).toBe(1);
      
      ws1.close();
      ws2.close();
    });
  });

  describe('Legion package imports in client', () => {
    it('should serve Legion packages correctly', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to fetch a Legion package
      const response = await fetch(`http://localhost:${testPort}/legion/actors/index.js`);
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toBeTruthy();
      expect(response.headers.get('content-type')).toContain('javascript');
    });

    it('should rewrite nested imports in Legion packages', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch a Legion package that might have internal imports
      const response = await fetch(`http://localhost:${testPort}/legion/actors/Actor.js`);
      
      if (response.status === 200) {
        const content = await response.text();
        // Check that any @legion imports are rewritten
        expect(content).not.toMatch(/@legion\//);
      }
    });
  });

  describe('Service access in actors', () => {
    it('should provide ResourceManager to server actors', async () => {
      server.registerRoute('/app', createSimpleServerActor, clientActorFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-services'
      }));
      
      let serverActor;
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_handshake_ack') {
            serverActor = msg.serverRootActor;
            resolve();
          }
        });
      });
      
      // Ask server actor about services
      ws.send(JSON.stringify({
        type: 'actor_message',
        from: 'client-services',
        to: serverActor,
        message: { type: 'get_services' }
      }));
      
      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'actor_message') {
            resolve(msg);
          }
        });
      });
      
      expect(response.message.hasResourceManager).toBe(true);
      expect(response.message.serviceCount).toBeGreaterThan(0);
      
      ws.close();
    });
  });
});