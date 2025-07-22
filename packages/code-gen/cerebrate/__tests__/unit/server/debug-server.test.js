import { DebugServer } from '../../../src/server/debug-server.js';
import WebSocket from 'ws';

describe('DebugServer', () => {
  let debugServer;
  const testPort = 9223; // Use different port for testing

  afterEach(async () => {
    if (debugServer) {
      await debugServer.stop();
      debugServer = null;
    }
  });

  describe('Server Initialization and Startup', () => {
    test('should initialize server with default configuration', () => {
      debugServer = new DebugServer();
      
      expect(debugServer).toBeDefined();
      expect(debugServer.port).toBe(9222); // Default port
      expect(debugServer.host).toBe('localhost'); // Default host
      expect(debugServer.isRunning()).toBe(false);
    });

    test('should initialize server with custom configuration', () => {
      const config = {
        port: testPort,
        host: '127.0.0.1',
        maxPayload: 2 * 1024 * 1024, // 2MB
        heartbeatInterval: 60000
      };

      debugServer = new DebugServer(config);
      
      expect(debugServer.port).toBe(testPort);
      expect(debugServer.host).toBe('127.0.0.1');
      expect(debugServer.config.maxPayload).toBe(2 * 1024 * 1024);
      expect(debugServer.config.heartbeatInterval).toBe(60000);
    });

    test('should start WebSocket server successfully', async () => {
      debugServer = new DebugServer({ port: testPort });
      
      await debugServer.start();
      
      expect(debugServer.isRunning()).toBe(true);
      expect(debugServer.getServerInfo().port).toBe(testPort);
      expect(debugServer.getServerInfo().address).toBeDefined();
    });

    test('should handle server startup errors gracefully', async () => {
      const invalidConfig = { port: -1 }; // Invalid port
      debugServer = new DebugServer(invalidConfig);
      
      await expect(debugServer.start()).rejects.toThrow();
      expect(debugServer.isRunning()).toBe(false);
    });

    test('should prevent starting server twice', async () => {
      debugServer = new DebugServer({ port: testPort });
      
      await debugServer.start();
      expect(debugServer.isRunning()).toBe(true);
      
      await expect(debugServer.start()).rejects.toThrow('Server is already running');
    });
  });

  describe('WebSocket Connection Acceptance', () => {
    beforeEach(async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
    });

    test('should accept WebSocket connection', (done) => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      
      client.on('open', () => {
        expect(debugServer.getConnectionCount()).toBe(1);
        client.close();
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    test('should handle multiple concurrent connections', (done) => {
      const clients = [];
      const expectedConnections = 3;
      let connectionsEstablished = 0;
      
      for (let i = 0; i < expectedConnections; i++) {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        clients.push(client);
        
        client.on('open', () => {
          connectionsEstablished++;
          if (connectionsEstablished === expectedConnections) {
            expect(debugServer.getConnectionCount()).toBe(expectedConnections);
            
            // Close all connections
            clients.forEach(c => c.close());
            done();
          }
        });
        
        client.on('error', (error) => {
          done(error);
        });
      }
    });

    test('should reject connections when at maximum limit', (done) => {
      debugServer.config.maxConnections = 1;
      
      const client1 = new WebSocket(`ws://localhost:${testPort}`);
      client1.on('open', () => {
        // Try to open second connection
        const client2 = new WebSocket(`ws://localhost:${testPort}`);
        
        client2.on('close', (code) => {
          expect(code).toBe(1008); // Policy violation
          expect(debugServer.getConnectionCount()).toBe(1);
          client1.close();
          done();
        });
        
        client2.on('error', () => {
          // Connection should be rejected
          expect(debugServer.getConnectionCount()).toBe(1);
          client1.close();
          done();
        });
      });
    });
  });

  describe('Connection Handshake Validation', () => {
    beforeEach(async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
    });

    test('should validate connection protocol', (done) => {
      const client = new WebSocket(`ws://localhost:${testPort}`, ['cerebrate-debug-v1']);
      
      client.on('open', () => {
        expect(client.protocol).toBe('cerebrate-debug-v1');
        client.close();
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    test('should reject unsupported protocols', (done) => {
      const client = new WebSocket(`ws://localhost:${testPort}`, ['unsupported-protocol']);
      
      client.on('close', (code) => {
        expect(code).toBe(1002); // Protocol error
        done();
      });
      
      client.on('open', () => {
        done(new Error('Connection should have been rejected'));
      });
      
      client.on('error', () => {
        // Expected for unsupported protocol
        done();
      });
    });

    test('should handle connection without subprotocol', (done) => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      
      client.on('open', () => {
        // Should still connect without subprotocol
        expect(debugServer.getConnectionCount()).toBe(1);
        client.close();
        done();
      });
      
      client.on('close', (code) => {
        // May close normally
        if (debugServer.getConnectionCount() === 0) {
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Server Shutdown and Cleanup', () => {
    test('should stop server gracefully', async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
      
      expect(debugServer.isRunning()).toBe(true);
      
      await debugServer.stop();
      
      expect(debugServer.isRunning()).toBe(false);
    });

    test('should close all connections on shutdown', (done) => {
      debugServer = new DebugServer({ port: testPort });
      debugServer.start().then(() => {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        
        client.on('open', () => {
          expect(debugServer.getConnectionCount()).toBe(1);
          
          // Stop server
          debugServer.stop().then(() => {
            expect(debugServer.getConnectionCount()).toBe(0);
            done();
          });
        });
        
        client.on('close', () => {
          // Connection should be closed by server shutdown
        });
        
        client.on('error', (error) => {
          done(error);
        });
      });
    });

    test('should handle shutdown when not running', async () => {
      debugServer = new DebugServer({ port: testPort });
      
      // Should not throw error when stopping non-running server
      await expect(debugServer.stop()).resolves.not.toThrow();
    });

    test('should cleanup resources on shutdown', async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
      
      const serverInfo = debugServer.getServerInfo();
      expect(serverInfo.port).toBe(testPort);
      
      await debugServer.stop();
      
      expect(debugServer.isRunning()).toBe(false);
      expect(debugServer.getConnectionCount()).toBe(0);
    });
  });

  describe('Server Configuration and Info', () => {
    test('should provide server information', async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
      
      const info = debugServer.getServerInfo();
      
      expect(info).toHaveProperty('port', testPort);
      expect(info).toHaveProperty('address');
      expect(info).toHaveProperty('protocol', 'ws');
      expect(info).toHaveProperty('running', true);
      expect(info).toHaveProperty('connections');
      expect(info).toHaveProperty('uptime');
    });

    test('should track server uptime', async () => {
      debugServer = new DebugServer({ port: testPort });
      const startTime = Date.now();
      
      await debugServer.start();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const info = debugServer.getServerInfo();
      expect(info.uptime).toBeGreaterThan(0);
      expect(info.started_at).toBeInstanceOf(Date);
    });

    test('should provide connection statistics', async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
      
      const stats = debugServer.getConnectionStats();
      
      expect(stats).toHaveProperty('current_connections', 0);
      expect(stats).toHaveProperty('total_connections_accepted', 0);
      expect(stats).toHaveProperty('total_connections_closed', 0);
      expect(stats).toHaveProperty('total_messages_received', 0);
      expect(stats).toHaveProperty('total_messages_sent', 0);
    });

    test('should update connection statistics on connection events', (done) => {
      debugServer = new DebugServer({ port: testPort });
      debugServer.start().then(() => {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        
        client.on('open', () => {
          const stats = debugServer.getConnectionStats();
          expect(stats.current_connections).toBe(1);
          expect(stats.total_connections_accepted).toBe(1);
          
          client.close();
        });
        
        client.on('close', () => {
          setTimeout(() => {
            const stats = debugServer.getConnectionStats();
            expect(stats.current_connections).toBe(0);
            expect(stats.total_connections_closed).toBe(1);
            done();
          }, 10);
        });
        
        client.on('error', (error) => {
          done(error);
        });
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle port already in use error', async () => {
      debugServer = new DebugServer({ port: testPort });
      await debugServer.start();
      
      // Try to start another server on same port
      const debugServer2 = new DebugServer({ port: testPort });
      
      try {
        await debugServer2.start();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.code).toBe('EADDRINUSE');
        expect(debugServer2.isRunning()).toBe(false);
      } finally {
        await debugServer2.stop();
      }
    });

    test('should handle WebSocket errors gracefully', (done) => {
      debugServer = new DebugServer({ port: testPort });
      debugServer.start().then(() => {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        
        client.on('open', () => {
          // Send invalid data to trigger error handling
          client.send('invalid-json-data');
          
          // Server should handle the error gracefully and keep running
          setTimeout(() => {
            expect(debugServer.isRunning()).toBe(true);
            client.close();
            done();
          }, 100);
        });
        
        client.on('error', () => {
          // Client error is expected
        });
      });
    });

    test('should recover from connection errors', (done) => {
      debugServer = new DebugServer({ port: testPort });
      debugServer.start().then(() => {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        
        client.on('open', () => {
          // Force connection error
          client.terminate();
          
          // Server should remain running and accept new connections
          setTimeout(() => {
            const newClient = new WebSocket(`ws://localhost:${testPort}`);
            newClient.on('open', () => {
              expect(debugServer.isRunning()).toBe(true);
              newClient.close();
              done();
            });
            
            newClient.on('error', (error) => {
              done(error);
            });
          }, 100);
        });
      });
    });
  });
});