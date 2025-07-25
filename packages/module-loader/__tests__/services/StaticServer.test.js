/**
 * Tests for StaticServer service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StaticServer } from '../../src/services/StaticServer.js';
import { ResourceManager } from '../../src/resources/ResourceManager.js';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('StaticServer', () => {
  let resourceManager;
  let testDir;
  let server;

  beforeEach(async () => {
    // Create ResourceManager
    resourceManager = new ResourceManager({ loadEnv: false });
    await resourceManager.initialize();
    
    // Create temporary test directory
    testDir = join(__dirname, 'test-static');
    mkdirSync(testDir, { recursive: true });
    
    // Create test files
    writeFileSync(join(testDir, 'index.html'), '<!DOCTYPE html><html><body>Test</body></html>');
    writeFileSync(join(testDir, 'app.js'), 'console.log("test");');
    writeFileSync(join(testDir, 'styles.css'), 'body { color: red; }');
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

  describe('Server Creation', () => {
    it('should create server with default configuration', async () => {
      const config = {
        server: { port: 0 }, // Use random port
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
      expect(server.config.server.port).toBe(0);
      expect(server.config.static.publicDir).toBe(testDir);
    });

    it('should validate and normalize configuration', () => {
      const config = {
        port: 3001,
        publicDir: './custom',
        cors: { enabled: true }
      };

      const normalized = StaticServer.validateConfig(config);
      
      expect(normalized.server.port).toBe(3001);
      expect(normalized.static.publicDir).toBe('./custom');
      expect(normalized.security.cors.enabled).toBe(true);
    });

    it('should handle missing configuration gracefully', () => {
      const normalized = StaticServer.validateConfig();
      
      expect(normalized.server.port).toBe(3000);
      expect(normalized.static.publicDir).toBe('./public');
      expect(normalized.security.cors.enabled).toBe(false);
    });
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      await server.start();
    });

    it('should serve index.html at root', async () => {
      const response = await request(server.getApp())
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('<!DOCTYPE html>');
    });

    it('should serve static files with correct MIME types', async () => {
      await request(server.getApp())
        .get('/app.js')
        .expect(200)
        .expect('Content-Type', /javascript/);

      await request(server.getApp())
        .get('/styles.css')
        .expect(200)
        .expect('Content-Type', /css/);
    });

    it('should set cache control headers', async () => {
      const response = await request(server.getApp())
        .get('/app.js')
        .expect(200);
      
      expect(response.headers['cache-control']).toBeDefined();
    });

    it('should serve SPA fallback for unknown routes', async () => {
      const response = await request(server.getApp())
        .get('/some/unknown/route')
        .expect(200)
        .expect('Content-Type', /html/);
      
      expect(response.text).toContain('<!DOCTYPE html>');
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir },
        api: {
          endpoints: {
            '/api/test': (req, res) => res.json({ test: true }),
            '/custom': (req, res) => res.json({ custom: 'endpoint' })
          }
        }
      };

      server = await StaticServer.create(config, resourceManager);
      await server.start();
    });

    it('should serve configured API endpoints', async () => {
      const response = await request(server.getApp())
        .get('/api/test')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body.test).toBe(true);
    });

    it('should serve custom endpoints', async () => {
      const response = await request(server.getApp())
        .get('/custom')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body.custom).toBe('endpoint');
    });

    it('should provide default health endpoint', async () => {
      const response = await request(server.getApp())
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir },
        security: {
          cors: { enabled: true, origin: 'https://example.com' },
          csp: true,
          headers: true
        }
      };

      server = await StaticServer.create(config, resourceManager);
      await server.start();
    });

    it('should set security headers', async () => {
      const response = await request(server.getApp())
        .get('/')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should handle CORS when enabled', async () => {
      const response = await request(server.getApp())
        .get('/health')
        .set('Origin', 'https://example.com')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      await server.start();
    });

    it('should handle 404 errors', async () => {
      const response = await request(server.getApp())
        .get('/api/nonexistent')
        .expect(404)
        .expect('Content-Type', /json/);
      
      expect(response.body.error).toBe('Not found');
      expect(response.body.path).toBe('/api/nonexistent');
    });

    it('should handle server errors', async () => {
      // Add endpoint that throws error
      server.addEndpoint('GET', '/api/error', (req, res, next) => {
        throw new Error('Test error');
      });

      const response = await request(server.getApp())
        .get('/api/error')
        .expect(500)
        .expect('Content-Type', /json/);
      
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Dynamic Endpoint Management', () => {
    beforeEach(async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      await server.start();
    });

    it('should allow adding endpoints dynamically', async () => {
      server.addEndpoint('GET', '/dynamic', (req, res) => {
        res.json({ dynamic: true });
      });

      const response = await request(server.getApp())
        .get('/api/dynamic')
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body.dynamic).toBe(true);
    });

    it('should handle POST endpoints', async () => {
      server.addEndpoint('POST', '/data', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(server.getApp())
        .post('/api/data')
        .send({ test: 'data' })
        .expect(200)
        .expect('Content-Type', /json/);
      
      expect(response.body.received.test).toBe('data');
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server correctly', async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      
      expect(server.isRunning).toBe(false);
      
      await server.start();
      expect(server.isRunning).toBe(true);
      
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('should provide server status information', async () => {
      const config = {
        server: { port: 0, host: 'localhost' },
        static: { publicDir: testDir },
        websocket: { enabled: true }
      };

      server = await StaticServer.create(config, resourceManager);
      
      const status = server.getStatus();
      
      expect(status.running).toBe(false);
      expect(status.host).toBe('localhost');
      expect(status.publicDir).toBe(testDir);
      expect(status.websocket).toBe(true);
    });

    it('should handle double start gracefully', async () => {
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      
      await server.start();
      
      // Should not throw error
      await server.start();
      
      expect(server.isRunning).toBe(true);
    });
  });

  describe('ResourceManager Integration', () => {
    it('should use logger from ResourceManager', async () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };

      resourceManager.register('logger', mockLogger);

      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      server = await StaticServer.create(config, resourceManager);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'StaticServer initialized',
        expect.any(Object)
      );
    });

    it('should work without logger from ResourceManager', async () => {
      // Don't register any logger
      const config = {
        server: { port: 0 },
        static: { publicDir: testDir }
      };

      // Should not throw error
      server = await StaticServer.create(config, resourceManager);
      
      expect(server).toBeInstanceOf(StaticServer);
    });
  });
});