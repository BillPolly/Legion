/**
 * Integration tests for BaseServer with real ResourceManager
 * NO MOCKS - uses real components
 */

import { BaseServer } from '../../BaseServer.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('BaseServer Integration Tests', () => {
  let server;

  afterEach(async () => {
    if (server) {
      await server.stop().catch(() => {});
    }
  });

  describe('Full initialization with real ResourceManager', () => {
    it('should initialize with real ResourceManager singleton', async () => {
      server = new BaseServer();
      await server.initialize();
      const singleton = await ResourceManager.getInstance();

      expect(server.resourceManager).toBe(singleton);
      expect(server.resourceManager).toBeDefined();
    });

    it('should get real MONOREPO_ROOT from environment', async () => {
      server = new BaseServer();
      await server.initialize();
      
      // Should get actual value from .env
      expect(server.monorepoRoot).toBeDefined();
      expect(server.monorepoRoot).toContain('Legion');
    });

    it('should set up services correctly', async () => {
      server = new BaseServer();
      await server.initialize();
      const singleton = await ResourceManager.getInstance();

      expect(server.services.get('resourceManager')).toBe(singleton);
      expect(server.host).toBe('localhost');
    });

    it('should handle multiple initializations gracefully', async () => {
      server = new BaseServer();
      
      await server.initialize();
      const rm1 = server.resourceManager;
      
      await server.initialize();
      const rm2 = server.resourceManager;
      
      expect(rm1).toBe(rm2);
    });
  });

  describe('Route registration with real file system', () => {
    let testClientFile;

    beforeAll(async () => {
      // Create a real test client file
      testClientFile = path.join(process.cwd(), 'test-client.js');
      await fs.writeFile(testClientFile, `
        export default class TestClient {
          constructor() {
            this.name = 'TestClient';
          }
          setRemoteActor(remote) {
            this.remote = remote;
          }
        }
      `);
    });

    afterAll(async () => {
      // Clean up test file
      await fs.unlink(testClientFile).catch(() => {});
    });

    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should register route with real factory and client file', () => {
      const factory = (services) => {
        return {
          name: 'TestServerActor',
          services
        };
      };
      
      server.registerRoute('/test', factory, testClientFile, 8090);
      
      const route = server.routes.get('/test');
      expect(route).toBeDefined();
      expect(route.factory).toBe(factory);
      expect(route.clientFile).toBe(testClientFile);
      expect(route.port).toBe(8090);
    });

    it('should create server actor instance from factory', async () => {
      const factory = (services) => {
        return {
          name: 'TestServerActor',
          resourceManager: services.get('resourceManager')
        };
      };

      server.registerRoute('/test', factory, testClientFile);

      const route = server.routes.get('/test');
      const actorInstance = route.factory(server.services);
      const singleton = await ResourceManager.getInstance();

      expect(actorInstance.name).toBe('TestServerActor');
      expect(actorInstance.resourceManager).toBe(singleton);
    });

    it('should handle multiple route registrations', () => {
      const factory1 = (services) => ({ name: 'Actor1' });
      const factory2 = (services) => ({ name: 'Actor2' });
      const factory3 = (services) => ({ name: 'Actor3' });
      
      server.registerRoute('/route1', factory1, testClientFile, 8090);
      server.registerRoute('/route2', factory2, testClientFile, 8091);
      server.registerRoute('/route3', factory3, testClientFile); // default port
      
      expect(server.routes.size).toBe(3);
      expect(server.routes.get('/route1').port).toBe(8090);
      expect(server.routes.get('/route2').port).toBe(8091);
      expect(server.routes.get('/route3').port).toBe(8080);
    });
  });

  describe('Static route registration', () => {
    let testDir;

    beforeAll(async () => {
      // Create test directory
      testDir = path.join(process.cwd(), 'test-static');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.html'), '<h1>Test</h1>');
    });

    afterAll(async () => {
      // Clean up
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should register static route with real directory', () => {
      server.registerStaticRoute('/static', testDir);
      
      expect(server.staticRoutes.get('/static')).toBe(testDir);
    });

    it('should handle multiple static routes', () => {
      server.registerStaticRoute('/assets', testDir);
      server.registerStaticRoute('/public', testDir);
      
      expect(server.staticRoutes.size).toBe(2);
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should fail fast on invalid factory', () => {
      expect(() => {
        server.registerRoute('/test', null, '/client.js');
      }).toThrow();
    });

    it('should fail fast on invalid route format', () => {
      const factory = () => ({});
      
      expect(() => {
        server.registerRoute('no-slash', factory, '/client.js');
      }).toThrow();
    });

    it('should fail fast on invalid port', () => {
      const factory = () => ({});
      
      expect(() => {
        server.registerRoute('/test', factory, '/client.js', 999);
      }).toThrow();
    });
  });
});