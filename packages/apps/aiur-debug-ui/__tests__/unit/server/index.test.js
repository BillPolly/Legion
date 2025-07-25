/**
 * Tests for Express server
 */

import { createServer } from '../../../src/server/index.js';
import request from 'supertest';
import { WebSocketServer } from 'ws';
import { jest } from '@jest/globals';

// Mock WebSocket server creation
jest.mock('../../../src/server/websocket.js', () => ({
  createWebSocketServer: jest.fn(() => ({
    close: jest.fn()
  }))
}));

describe('Express Server', () => {
  let server;
  let config;
  let logger;

  beforeEach(() => {
    config = global.testUtils.createTestConfig();
    logger = global.testUtils.createMockLogger();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe('Server Creation', () => {
    it('should create and start server', async () => {
      server = await createServer(config, logger);
      
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);
      
      const port = global.testUtils.getServerPort(server);
      expect(port).toBeGreaterThan(0);
    });

    it('should handle server creation errors', async () => {
      // Force port conflict
      config.server.port = 1; // Privileged port
      
      await expect(createServer(config, logger)).rejects.toThrow();
    });

    it('should bind to specified host and port', async () => {
      config.server.port = 0; // Random port
      config.server.host = '127.0.0.1';
      
      server = await createServer(config, logger);
      
      const address = server.address();
      expect(address.address).toBe('127.0.0.1');
    });
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      server = await createServer(config, logger);
    });

    it('should serve index.html at root', async () => {
      const response = await request(server)
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('<!DOCTYPE html>');
    });

    it('should serve static files', async () => {
      const response = await request(server)
        .get('/styles.css')
        .expect(200)
        .expect('Content-Type', /css/);
    });

    it('should set cache headers based on environment', async () => {
      process.env.NODE_ENV = 'production';
      const prodServer = await createServer(config, logger);
      
      const response = await request(prodServer)
        .get('/app.js')
        .expect(200);
      
      expect(response.headers['cache-control']).toContain('max-age=');
      
      await prodServer.close();
      process.env.NODE_ENV = 'test';
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
      server = await createServer(config, logger);
    });

    it('should serve configuration at /api/config', async () => {
      const response = await request(server)
        .get('/api/config')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toMatchObject({
        mcp: {
          defaultUrl: config.mcp.defaultUrl,
          reconnectInterval: config.mcp.reconnectInterval,
          maxReconnectAttempts: config.mcp.maxReconnectAttempts
        },
        ui: {
          theme: config.ui.theme,
          autoConnect: config.ui.autoConnect
        }
      });
    });

    it('should not expose sensitive configuration', async () => {
      const response = await request(server)
        .get('/api/config')
        .expect(200);
      
      // Should not expose server configuration
      expect(response.body.server).toBeUndefined();
      expect(response.body.logging).toBeUndefined();
    });

    it('should provide health check endpoint', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });
  });

  describe('Security Headers', () => {
    beforeEach(async () => {
      server = await createServer(config, logger);
    });

    it('should set security headers', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should allow WebSocket connections in CSP', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('ws:');
      expect(csp).toContain('wss:');
    });
  });

  describe('CORS Configuration', () => {
    it('should enable CORS when configured', async () => {
      config.cors.enabled = true;
      config.cors.origin = 'https://example.com';
      
      server = await createServer(config, logger);
      
      const response = await request(server)
        .get('/api/config')
        .set('Origin', 'https://example.com')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });

    it('should disable CORS when configured', async () => {
      config.cors.enabled = false;
      
      server = await createServer(config, logger);
      
      const response = await request(server)
        .get('/api/config')
        .set('Origin', 'https://example.com')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      server = await createServer(config, logger);
    });

    it('should handle 404 errors', async () => {
      const response = await request(server)
        .get('/non-existent-path')
        .expect(404)
        .expect('Content-Type', /json/);
      
      expect(response.body).toMatchObject({
        error: 'Not found',
        path: '/non-existent-path'
      });
    });

    it('should log requests', async () => {
      await request(server)
        .get('/api/config')
        .expect(200);
      
      expect(logger.debug).toHaveBeenCalledWith(
        'GET /api/config',
        expect.objectContaining({
          ip: expect.any(String),
          userAgent: expect.any(String)
        })
      );
    });
  });

  describe('Server Lifecycle', () => {
    it('should close server gracefully', async () => {
      server = await createServer(config, logger);
      const port = global.testUtils.getServerPort(server);
      
      await server.close();
      
      // Server should no longer be listening
      expect(server.listening).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Server closed');
    });

    it('should close WebSocket server on shutdown', async () => {
      const { createWebSocketServer } = require('../../../src/server/websocket.js');
      const mockWss = { close: jest.fn() };
      createWebSocketServer.mockReturnValueOnce(mockWss);
      
      server = await createServer(config, logger);
      await server.close();
      
      expect(mockWss.close).toHaveBeenCalled();
    });
  });
});