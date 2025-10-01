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
      expect(text).toBe('File not found');
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

    it('should handle malformed JSON gracefully', async () => {
      server = new BaseServer();
      await server.initialize();

      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9503);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const ws = new WebSocket('ws://localhost:9503/ws');

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      // Send malformed message - should be caught by Channel's error handler
      ws.send('not valid json');

      // Connection should handle it gracefully and stay open
      await new Promise(resolve => setTimeout(resolve, 100));

      // Connection should still be open (error logged but not fatal)
      expect(ws.readyState).toBe(WebSocket.OPEN);

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

      // With new protocol, error happens when WebSocket connects
      // The error should be caught and logged, connection may close
      const ws = new WebSocket('ws://localhost:9505/ws');

      // Either connection fails or stays open but no session created
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Connection opened despite factory error (error is logged)
          setTimeout(resolve, 200);
        });
        ws.on('error', resolve);
        ws.on('close', resolve);
      });

      // Test passes if error was handled gracefully
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
    it('should handle message to non-existent actor', async () => {
      const { ActorSpace } = await import('@legion/actors');

      server = new BaseServer();
      await server.initialize();

      server.registerRoute('/app', createSimpleServerActor, testClientFile, 9510);
      await server.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create client-side ActorSpace
      const clientSpace = new ActorSpace('client-test');

      let sessionReadyReceived = false;
      const clientActor = {
        isActor: true,
        receive: function(messageType, data) {
          if (messageType === 'session-ready') {
            sessionReadyReceived = true;
          }
        }
      };
      clientSpace.register(clientActor, 'client-root');

      const ws = new WebSocket('ws://localhost:9510/ws');
      const channel = clientSpace.addChannel(ws, clientActor);

      await new Promise(resolve => ws.on('open', resolve));

      // Wait for session-ready
      const startTime = Date.now();
      while (!sessionReadyReceived && (Date.now() - startTime) < 3000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Try to send message to non-existent actor
      // This should log an error but not crash
      const nonExistentActor = channel.makeRemote('non-existent-actor-guid');

      // Send message - will timeout since actor doesn't exist, but shouldn't crash
      const result = await nonExistentActor.receive('test', {});

      // Should get undefined (timeout) since actor doesn't exist
      expect(result).toBeUndefined();

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      await clientSpace.destroy();
    }, 10000);
  });
});