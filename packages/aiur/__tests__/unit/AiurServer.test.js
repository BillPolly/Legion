/**
 * AiurServer Unit Tests
 * 
 * Tests server startup, codec integration, and basic functionality
 * without complex WebSocket communication.
 */

import { jest } from '@jest/globals';
import { TestServer } from '../helpers/TestServer.js';

describe('AiurServer Unit Tests', () => {
  let testServer;

  afterEach(async () => {
    if (testServer) {
      await testServer.stop();
      testServer = null;
    }
  });

  describe('Server Startup', () => {
    test('should start server successfully', async () => {
      testServer = new TestServer();
      
      const url = await testServer.start();
      
      expect(url).toBeDefined();
      expect(testServer.isServerRunning()).toBe(true);
      expect(testServer.getWebSocketUrl()).toContain('ws://');
      expect(testServer.getHttpUrl()).toContain('http://');
      
      console.log('Server started at:', url);
      console.log('WebSocket URL:', testServer.getWebSocketUrl());
    });

    test('should start server on custom port', async () => {
      const customPort = 9500 + Math.floor(Math.random() * 100);
      testServer = new TestServer({ port: customPort });
      
      await testServer.start();
      
      expect(testServer.getConfig().port).toBe(customPort);
      expect(testServer.getWebSocketUrl()).toContain(`:${customPort}/ws`);
    });

    test('should stop server cleanly', async () => {
      testServer = new TestServer();
      
      await testServer.start();
      expect(testServer.isServerRunning()).toBe(true);
      
      await testServer.stop();
      expect(testServer.isServerRunning()).toBe(false);
    });
  });

  describe('Server Configuration', () => {
    test('should use default configuration', async () => {
      testServer = new TestServer();
      const config = testServer.getConfig();
      
      expect(config.host).toBe('localhost');
      expect(config.port).toBeGreaterThan(9000);
      expect(config.sessionTimeout).toBe(60000);
      expect(config.enableFileLogging).toBe(false);
    });

    test('should use custom configuration', async () => {
      const customConfig = {
        host: '127.0.0.1',
        sessionTimeout: 30000
      };
      
      testServer = new TestServer(customConfig);
      const config = testServer.getConfig();
      
      expect(config.host).toBe('127.0.0.1');
      expect(config.sessionTimeout).toBe(30000);
    });
  });

  describe('Health Check', () => {
    test('should provide health endpoint', async () => {
      testServer = new TestServer();
      await testServer.start();
      
      const healthUrl = `${testServer.getHttpUrl()}/health`;
      
      try {
        const response = await fetch(healthUrl);
        expect(response.ok).toBe(true);
        
        const health = await response.json();
        expect(health.status).toBe('healthy');
        expect(health.server).toBe('AiurServer');
        expect(health.version).toBeDefined();
        expect(typeof health.uptime).toBe('number');
        
        console.log('Health check passed:', health);
      } catch (error) {
        throw new Error(`Health check failed: ${error.message}`);
      }
    });
  });

  describe('Server Error Handling', () => {
    test('should handle port conflicts gracefully', async () => {
      const port = 9600;
      
      // Start first server
      const server1 = new TestServer({ port });
      await server1.start();
      
      try {
        // Try to start second server on same port
        const server2 = new TestServer({ port });
        
        await expect(server2.start()).rejects.toThrow();
      } finally {
        await server1.stop();
      }
    });

    test('should not allow multiple starts', async () => {
      testServer = new TestServer();
      
      await testServer.start();
      
      // Should throw error when trying to start again
      await expect(testServer.start()).rejects.toThrow('already running');
    });
  });

  describe('URL Generation', () => {
    test('should generate correct URLs', () => {
      const server = new TestServer({ port: 9123, host: 'localhost' });
      
      expect(server.getHttpUrl()).toBe('http://localhost:9123');
      expect(server.getWebSocketUrl()).toBe('ws://localhost:9123/ws');
      expect(server.getUrl()).toBe('http://localhost:9123');
    });
  });
});