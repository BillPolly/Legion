/**
 * Integration tests for server lifecycle (start/stop)
 * NO MOCKS - uses real server instances
 */

import { BaseServer } from '../../BaseServer.js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

describe('Server Lifecycle Integration Tests', () => {
  let server;
  let testClientFile;

  beforeAll(async () => {
    // Create test client file
    testClientFile = path.join(process.cwd(), 'test-lifecycle-client.js');
    await fs.writeFile(testClientFile, `
      import { Actor } from '@legion/actors';
      
      export default class TestClient extends Actor {
        constructor() {
          super();
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

  describe('Server start', () => {
    it('should start server on specified port', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      const testPort = 9301;
      server.registerRoute('/app', factory, testClientFile, testPort);
      
      await server.start();
      
      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check server is running
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('legion-server');
      expect(data.port).toBe(testPort);
    });

    it('should start multiple routes on different ports', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory1 = () => ({ name: 'Actor1' });
      const factory2 = () => ({ name: 'Actor2' });
      
      server.registerRoute('/app1', factory1, testClientFile, 9302);
      server.registerRoute('/app2', factory2, testClientFile, 9303);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check both servers are running
      const response1 = await fetch('http://localhost:9302/health');
      const response2 = await fetch('http://localhost:9303/health');
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      expect(data1.port).toBe(9302);
      expect(data2.port).toBe(9303);
    });

    it('should handle multiple routes on same port', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory1 = () => ({ name: 'Actor1' });
      const factory2 = () => ({ name: 'Actor2' });
      
      server.registerRoute('/app1', factory1, testClientFile, 9304);
      server.registerRoute('/app2', factory2, testClientFile, 9304);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Both routes should be accessible on same port
      const response1 = await fetch('http://localhost:9304/app1');
      const response2 = await fetch('http://localhost:9304/app2');
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      const html1 = await response1.text();
      const html2 = await response2.text();
      
      expect(html1).toContain('/app1/client.js');
      expect(html2).toContain('/app2/client.js');
    });

    it('should fail to start without initialization', async () => {
      server = new BaseServer();
      // Don't call initialize()
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, testClientFile, 9305);
      
      await expect(server.start()).rejects.toThrow('Server not initialized');
    });

    it('should serve static routes', async () => {
      server = new BaseServer();
      await server.initialize();
      
      // Create test static directory
      const staticDir = path.join(process.cwd(), 'test-static');
      await fs.mkdir(staticDir, { recursive: true });
      await fs.writeFile(path.join(staticDir, 'test.txt'), 'Hello static');
      
      try {
        server.registerStaticRoute('/static', staticDir);
        
        const factory = () => ({ name: 'TestActor' });
        server.registerRoute('/app', factory, testClientFile, 9306);
        
        await server.start();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const response = await fetch('http://localhost:9306/static/test.txt');
        expect(response.status).toBe(200);
        
        const content = await response.text();
        expect(content).toBe('Hello static');
      } finally {
        // Clean up
        await fs.rm(staticDir, { recursive: true }).catch(() => {});
      }
    });

    it('should accept WebSocket connections', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, testClientFile, 9307);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to connect via WebSocket
      const ws = new WebSocket('ws://localhost:9307/ws');
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });

  describe('Port conflict handling', () => {
    it('should handle port already in use', async () => {
      // Start first server
      const server1 = new BaseServer();
      await server1.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server1.registerRoute('/app1', factory, testClientFile, 9308);
      
      await server1.start();
      
      // Try to start second server on same port
      const server2 = new BaseServer();
      await server2.initialize();
      
      server2.registerRoute('/app2', factory, testClientFile, 9308);
      
      // This should throw an error
      await expect(server2.start()).rejects.toThrow();
      
      // Clean up
      await server1.stop();
    });
  });

  describe('Graceful shutdown', () => {
    it('should stop all servers on stop()', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app1', factory, testClientFile, 9309);
      server.registerRoute('/app2', factory, testClientFile, 9310);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify servers are running
      const response1 = await fetch('http://localhost:9309/health');
      const response2 = await fetch('http://localhost:9310/health');
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Stop servers
      await server.stop();
      
      // Servers should no longer respond
      await expect(fetch('http://localhost:9309/health')).rejects.toThrow();
      await expect(fetch('http://localhost:9310/health')).rejects.toThrow();
    });

    it('should close WebSocket connections on stop()', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, testClientFile, 9311);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connect WebSocket
      const ws = new WebSocket('ws://localhost:9311/ws');
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Stop server
      await server.stop();
      
      // WebSocket should be closed - wait with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket did not close within timeout'));
        }, 2000);
        
        if (ws.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          resolve();
        } else {
          ws.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });
      
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle multiple stop() calls gracefully', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, testClientFile, 9312);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop multiple times
      await server.stop();
      await server.stop(); // Should not throw
      await server.stop(); // Should not throw
    });

    it('should allow restart after stop', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, testClientFile, 9313);
      
      // Start
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let response = await fetch('http://localhost:9313/health');
      expect(response.status).toBe(200);
      
      // Stop
      await server.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await expect(fetch('http://localhost:9313/health')).rejects.toThrow();
      
      // Start again
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      response = await fetch('http://localhost:9313/health');
      expect(response.status).toBe(200);
    });
  });

  describe('Actor cleanup', () => {
    it('should clean up ActorSpaces on stop', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const actorInstances = [];
      const factory = () => {
        const actor = { 
          name: 'TestActor',
          cleanup: function() { /* mock cleanup */ },
          cleanupCalled: false
        };
        // Override cleanup to track calls
        const originalCleanup = actor.cleanup;
        actor.cleanup = function() {
          actor.cleanupCalled = true;
          return originalCleanup.call(this);
        };
        actorInstances.push(actor);
        return actor;
      };
      
      server.registerRoute('/app', factory, testClientFile, 9314);
      
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connect WebSocket to create actor
      const ws = new WebSocket('ws://localhost:9314/ws');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 2000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      // Send handshake to create actor
      ws.send(JSON.stringify({
        type: 'actor_handshake',
        route: '/app',
        clientRootActor: 'client-123'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop server
      await server.stop();
      
      // Check that connection was closed properly
      // Wait for connection to close with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket did not close within timeout'));
        }, 2000);
        
        if (ws.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          resolve();
        } else {
          ws.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });
      
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
  });
});