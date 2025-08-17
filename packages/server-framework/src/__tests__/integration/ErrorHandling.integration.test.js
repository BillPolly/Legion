/**
 * Error handling integration tests
 * Tests error conditions and recovery
 * NO MOCKS - uses real components
 */

import { BaseServer } from '../../BaseServer.js';
import { createSimpleServerActor } from '../fixtures/SimpleServerActor.js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

describe('Error Handling Integration Tests', () => {
  let server;
  let testClientFile;

  beforeAll(async () => {
    // Create test client file
    testClientFile = path.join(process.cwd(), 'test-error-client.js');
    await fs.writeFile(testClientFile, `
      export default class ErrorTestClient {
        constructor() {
          this.name = 'ErrorTestClient';
        }
      }
    `);
  });

  afterAll(async () => {
    await fs.unlink(testClientFile).catch(() => {});
  });

  afterEach(async () => {
    if (server) {
      await server.stop().catch(() => {});
      server = null;
    }
  });

  describe('Invalid route registration', () => {
    it('should throw error for invalid route', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerRoute('invalid', createSimpleServerActor, testClientFile);
      }).toThrow('Route must start with /');
    });

    it('should throw error for missing server actor factory', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerRoute('/app', null, testClientFile);
      }).toThrow('Server actor factory must be a function');
    });

    it('should throw error for missing client file', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerRoute('/app', createSimpleServerActor, null);
      }).toThrow('Client actor file path is required');
    });

    it('should throw error for invalid port', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerRoute('/app', createSimpleServerActor, testClientFile, 999);
      }).toThrow('Port must be between 1024 and 65535');
      
      expect(() => {
        server.registerRoute('/app', createSimpleServerActor, testClientFile, 70000);
      }).toThrow('Port must be between 1024 and 65535');
    });
  });

  describe('Missing client actor file', () => {
    it('should return 404 for non-existent client file', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const nonExistentFile = path.join(process.cwd(), 'non-existent.js');
      server.registerRoute('/app', createSimpleServerActor, nonExistentFile, 9501);
      
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch('http://localhost:9501/app/client.js');
      expect(response.status).toBe(404);
      
      const text = await response.text();
      expect(text).toBe('Client actor file not found');
    });
  });

  describe('WebSocket connection failures', () => {
    it('should handle invalid WebSocket path', async () => {
      server = new BaseServer();
      await server.initialize();
      
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9502);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to connect to wrong path
      const ws = new WebSocket('ws://localhost:9502/wrong-path');
      
      await new Promise((resolve) => {
        ws.on('error', resolve);
        ws.on('unexpected-response', resolve);
      });
      
      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });

    it('should handle malformed handshake message', async () => {
      server = new BaseServer();
      await server.initialize();
      
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9503);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket('ws://localhost:9503/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send malformed message
      ws.send('not valid json');
      
      // Connection should handle it gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try sending valid message after
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-123'
      }));
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 1000);
        ws.on('message', (data) => {
          clearTimeout(timeout);
          resolve(JSON.parse(data.toString()));
        });
      }).catch(() => null);
      
      // Should either recover or close connection
      if (response) {
        expect(response.type).toBe('actor_handshake_ack');
      } else {
        expect(ws.readyState).not.toBe(WebSocket.OPEN);
      }
      
      ws.close();
    });

    it('should handle handshake for non-existent route', async () => {
      server = new BaseServer();
      await server.initialize();
      
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9504);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket('ws://localhost:9504/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send handshake for wrong route
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/non-existent',
        clientRootActor: 'client-123'
      }));
      
      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connection might close or send error
      if (ws.readyState === WebSocket.OPEN) {
        // Try correct route
        ws.send(JSON.stringify({
          type: 'actor_handshake',
          route: '/app',
          clientRootActor: 'client-456'
        }));
        
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 1000);
          ws.on('message', (data) => {
            clearTimeout(timeout);
            resolve(JSON.parse(data.toString()));
          });
        }).catch(() => null);
        
        if (response && response.type === 'actor_handshake_ack') {
          expect(response.route).toBe('/app');
        }
      }
      
      ws.close();
    });
  });

  describe('Actor creation failures', () => {
    it('should handle actor factory throwing error', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const errorFactory = () => {
        throw new Error('Factory error');
      };
      
      server.registerRoute('/app', errorFactory, testClientFile, 9505);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket('ws://localhost:9505/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-error'
      }));
      
      // Should handle error gracefully
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Connection might still be open but no actor created
      ws.close();
    });

    it('should handle actor factory returning null', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const nullFactory = () => null;
      
      server.registerRoute('/app', nullFactory, testClientFile, 9506);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket('ws://localhost:9506/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-null'
      }));
      
      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 200));
      
      ws.close();
    });
  });

  describe('Server lifecycle errors', () => {
    it('should handle port already in use', async () => {
      // Start first server
      const server1 = new BaseServer();
      await server1.initialize();
      server1.registerRoute('/app1', createSimpleServerActor, testClientFile, 9507);
      await server1.start();
      
      // Try to start second server on same port
      const server2 = new BaseServer();
      await server2.initialize();
      server2.registerRoute('/app2', createSimpleServerActor, testClientFile, 9507);
      
      await expect(server2.start()).rejects.toThrow('Port 9507 is already in use');
      
      await server1.stop();
    });

    it('should handle start without initialization', async () => {
      server = new BaseServer();
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9508);
      
      await expect(server.start()).rejects.toThrow('Server not initialized');
    });
  });

  describe('Static route errors', () => {
    it('should throw error for invalid static route', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerStaticRoute('invalid', '/some/dir');
      }).toThrow('Path must start with /');
    });

    it('should throw error for missing directory', () => {
      server = new BaseServer();
      
      expect(() => {
        server.registerStaticRoute('/static', null);
      }).toThrow('Directory is required');
    });

    it('should handle non-existent static directory gracefully', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const nonExistentDir = path.join(process.cwd(), 'non-existent-dir');
      server.registerStaticRoute('/static', nonExistentDir);
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9509);
      
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to access static file
      const response = await fetch('http://localhost:9509/static/file.txt');
      expect(response.status).toBe(404);
    });
  });

  describe('Message handling errors', () => {
    it('should handle actor message to non-existent actor', async () => {
      server = new BaseServer();
      await server.initialize();
      
      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9510);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const ws = new WebSocket('ws://localhost:9510/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Complete handshake
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-msg'
      }));
      
      await new Promise((resolve) => {
        ws.on('message', resolve);
      });
      
      // Send message to non-existent actor
      ws.send(JSON.stringify({
        type: 'actor_message',
        from: 'client-msg',
        to: 'non-existent-actor',
        message: { type: 'test' }
      }));
      
      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });
});