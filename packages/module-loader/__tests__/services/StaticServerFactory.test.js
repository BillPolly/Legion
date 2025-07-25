/**
 * Tests for StaticServerFactory
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createStaticServer, 
  createSimpleStaticServer,
  createStaticServerWithWebSocket,
  createDevelopmentServer,
  enhanceConfigWithEnvironment
} from '../../src/services/StaticServerFactory.js';
import { ResourceManager } from '../../src/resources/ResourceManager.js';
import { StaticServer } from '../../src/services/StaticServer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('StaticServerFactory', () => {
  let resourceManager;
  let testDir;
  let server;

  beforeEach(async () => {
    // Create ResourceManager
    resourceManager = new ResourceManager({ loadEnv: false });
    await resourceManager.initialize();
    
    // Create temporary test directory
    testDir = join(__dirname, 'test-factory');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'index.html'), '<!DOCTYPE html><html><body>Factory Test</body></html>');
  });

  afterEach(async () => {
    // Stop server if running
    if (server && server.isRunning) {
      await server.stop();
    }
    
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createStaticServer', () => {
    it('should create StaticServer with basic configuration', async () => {
      const config = {
        server: { port: 0, host: 'localhost' },
        static: { publicDir: testDir }
      };

      server = await createStaticServer(config, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
      expect(server.config.server.port).toBe(0);
      expect(server.config.server.host).toBe('localhost');
      expect(server.config.static.publicDir).toBe(testDir);
    });

    it('should throw error without ResourceManager', async () => {
      const config = { server: { port: 0 } };

      await expect(createStaticServer(config, null)).rejects.toThrow(
        'ResourceManager is required for StaticServer creation'
      );
    });

    it('should enhance configuration with environment variables', async () => {
      // Register environment variables in ResourceManager
      resourceManager.register('env.PORT', '8080');
      resourceManager.register('env.HOST', '0.0.0.0');
      resourceManager.register('env.CORS_ORIGIN', 'https://example.com');
      resourceManager.register('env.NODE_ENV', 'production');

      const config = {
        static: { publicDir: testDir }
      };

      server = await createStaticServer(config, resourceManager);
      
      expect(server.config.server.port).toBe(8080);
      expect(server.config.server.host).toBe('0.0.0.0');
      expect(server.config.security.cors.enabled).toBe(true);
      expect(server.config.security.cors.origin).toBe('https://example.com');
      expect(server.config.static.caching).toBe(true); // Production default
    });
  });

  describe('createSimpleStaticServer', () => {
    it('should create simple server with minimal config', async () => {
      server = await createSimpleStaticServer(testDir, 0, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
      expect(server.config.static.publicDir).toBe(testDir);
      expect(server.config.security.cors.enabled).toBe(true);
      expect(server.config.security.cors.origin).toBe('*');
    });

    it('should use default port when not specified', async () => {
      server = await createSimpleStaticServer(testDir, undefined, resourceManager);
      
      expect(server.config.server.port).toBe(3000);
    });
  });

  describe('createStaticServerWithWebSocket', () => {
    it('should create server with WebSocket configuration', async () => {
      const mockWsHandler = (httpServer, wsConfig, logger) => {
        return { close: () => {} }; // Mock WebSocket server
      };

      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await createStaticServerWithWebSocket(config, mockWsHandler, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
      expect(server.config.websocket.enabled).toBe(true);
      expect(server.config.websocket.handler).toBe(mockWsHandler);
    });

    it('should merge WebSocket config with existing config', async () => {
      const mockWsHandler = () => ({ close: () => {} });

      const config = {
        server: { port: 0 },
        static: { publicDir: testDir },
        websocket: { path: '/custom-ws' }
      };

      server = await createStaticServerWithWebSocket(config, mockWsHandler, resourceManager);
      
      expect(server.config.websocket.enabled).toBe(true);
      expect(server.config.websocket.path).toBe('/custom-ws');
      expect(server.config.websocket.handler).toBe(mockWsHandler);
    });
  });

  describe('createDevelopmentServer', () => {
    it('should create server with development settings', async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await createDevelopmentServer(config, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
      expect(server.config.static.caching).toBe(false);
      expect(server.config.static.compression).toBe(false);
      expect(server.config.security.cors.enabled).toBe(true);
      expect(server.config.security.cors.origin).toBe('*');
      expect(server.config.logging.level).toBe('debug');
      expect(server.config.logging.requests).toBe(true);
    });

    it('should preserve custom configuration while applying dev defaults', async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir, compression: true }, // Override dev default
        logging: { level: 'info' } // Override dev default
      };

      server = await createDevelopmentServer(config, resourceManager);
      
      expect(server.config.static.compression).toBe(true); // Custom value preserved
      expect(server.config.logging.level).toBe('info'); // Custom value preserved
      expect(server.config.static.caching).toBe(false); // Dev default applied
    });
  });

  describe('enhanceConfigWithEnvironment', () => {
    it('should enhance config with environment variables', async () => {
      resourceManager.register('env.PORT', '9000');
      resourceManager.register('env.HOST', '127.0.0.1');
      resourceManager.register('env.CORS_ORIGIN', 'localhost:3000');
      resourceManager.register('env.STATIC_DIR', '/custom/static');
      resourceManager.register('env.LOG_LEVEL', 'warn');

      const config = {
        server: { timeout: 5000 },
        static: { caching: true }
      };

      const enhanced = await enhanceConfigWithEnvironment(config, resourceManager);
      
      expect(enhanced.server.port).toBe(9000);
      expect(enhanced.server.host).toBe('127.0.0.1');
      expect(enhanced.server.timeout).toBe(5000); // Preserved
      expect(enhanced.security.cors.enabled).toBe(true);
      expect(enhanced.security.cors.origin).toBe('localhost:3000');
      expect(enhanced.static.publicDir).toBe('/custom/static');
      expect(enhanced.static.caching).toBe(true); // Preserved
      expect(enhanced.logging.level).toBe('warn');
    });

    it('should apply production environment defaults', async () => {
      resourceManager.register('env.NODE_ENV', 'production');

      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      const enhanced = await enhanceConfigWithEnvironment(config, resourceManager);
      
      expect(enhanced.static.caching).toBe(true);
      expect(enhanced.static.compression).toBe(true);
      expect(enhanced.logging.level).toBe('info');
    });

    it('should apply development environment defaults', async () => {
      resourceManager.register('env.NODE_ENV', 'development');

      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      const enhanced = await enhanceConfigWithEnvironment(config, resourceManager);
      
      expect(enhanced.static.caching).toBe(false);
      expect(enhanced.logging.level).toBe('debug');
      expect(enhanced.security.cors.enabled).toBe(true);
      expect(enhanced.security.cors.origin).toBe('*');
    });

    it('should preserve original config when no environment variables set', async () => {
      const config = {
        server: { port: 8080, host: 'localhost' },
        static: { publicDir: testDir, caching: false },
        security: { cors: { enabled: false } }
      };

      const enhanced = await enhanceConfigWithEnvironment(config, resourceManager);
      
      expect(enhanced.server.port).toBe(8080);
      expect(enhanced.server.host).toBe('localhost');
      expect(enhanced.static.publicDir).toBe(testDir);
      expect(enhanced.static.caching).toBe(false);
      expect(enhanced.security.cors.enabled).toBe(false);
    });
  });

  describe('ResourceManager Integration', () => {
    it('should work with factory pattern through ResourceManager', async () => {
      // This tests the integration with ResourceManager.getOrCreate()
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await resourceManager.getOrCreate('StaticServer', config);
      
      expect(server).toBeInstanceOf(StaticServer);
      await server.start();
      expect(server.isRunning).toBe(true);
    });

    it('should reuse existing server instance from ResourceManager', async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      const server1 = await resourceManager.getOrCreate('StaticServer', config);
      const server2 = await resourceManager.getOrCreate('StaticServer', config);
      
      // Should return the same instance
      expect(server1).toBe(server2);
      
      server = server1; // For cleanup
    });
  });
});