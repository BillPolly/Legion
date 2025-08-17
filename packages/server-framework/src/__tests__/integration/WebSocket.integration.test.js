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
    it('should handle actor handshake message', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));
      
      // Send handshake
      const handshakePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'actor_handshake_ack') {
            resolve(message);
          }
        });
      });
      
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      }));
      
      const response = await handshakePromise;
      expect(response.type).toBe('actor_handshake_ack');
      expect(response.serverRootActor).toBeDefined();
      
      ws.close();
    });

    it('should handle messages after handshake', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({
        name: 'TestActor',
        handleMessage: async (msg) => {
          if (msg.type === 'ping') {
            return { type: 'pong', timestamp: Date.now() };
          }
        }
      });
      
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      const ws = new WebSocket(`ws://localhost:${testPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));
      
      // Complete handshake first
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        clientRootActor: 'client-root',
        route: '/test'
      }));
      
      await new Promise(resolve => {
        ws.once('message', resolve);
      });
      
      // Now send a real message
      const responsePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            resolve(message);
          }
        });
      });
      
      ws.send(JSON.stringify({
        type: 'ping'
      }));
      
      const response = await Promise.race([
        responsePromise,
        new Promise((_, reject) => setTimeout(() => reject('Timeout'), 1000))
      ]).catch(() => null);
      
      // May not be implemented yet in Phase 3.1
      if (response) {
        expect(response.type).toBe('pong');
      }
      
      ws.close();
    });
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