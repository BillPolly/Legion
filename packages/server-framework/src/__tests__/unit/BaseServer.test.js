/**
 * Unit tests for BaseServer class
 */

import { jest } from '@jest/globals';
import { BaseServer } from '../../BaseServer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('BaseServer', () => {
  let mockResourceManager;
  let server;

  beforeEach(() => {
    // Mock ResourceManager for unit tests
    mockResourceManager = {
      get: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true)
    };
    
    jest.spyOn(ResourceManager, 'getInstance').mockReturnValue(mockResourceManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (server) {
      server.stop().catch(() => {});
    }
  });

  describe('constructor', () => {
    it('should create BaseServer instance with default properties', () => {
      server = new BaseServer();
      
      expect(server.app).toBeDefined();
      expect(server.resourceManager).toBeNull();
      expect(server.routes).toBeInstanceOf(Map);
      expect(server.services).toBeInstanceOf(Map);
      expect(server.servers).toBeInstanceOf(Map);
      expect(server.wssInstances).toBeInstanceOf(Map);
    });

    it('should initialize Express app', () => {
      server = new BaseServer();
      
      expect(server.app).toBeDefined();
      expect(typeof server.app.use).toBe('function');
      expect(typeof server.app.get).toBe('function');
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      server = new BaseServer();
    });

    it('should get ResourceManager singleton', async () => {
      await server.initialize();
      
      expect(ResourceManager.getInstance).toHaveBeenCalled();
      expect(server.resourceManager).toBe(mockResourceManager);
    });

    it('should get ResourceManager (auto-initializes)', async () => {
      await server.initialize();

      // ResourceManager auto-initializes, so we just check it was retrieved
      expect(ResourceManager.getInstance).toHaveBeenCalled();
    });

    it('should get monorepo root from ResourceManager', async () => {
      mockResourceManager.get.mockReturnValue('/test/monorepo');
      
      await server.initialize();
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.MONOREPO_ROOT');
      expect(server.monorepoRoot).toBe('/test/monorepo');
    });

    it('should store ResourceManager in services', async () => {
      await server.initialize();
      
      expect(server.services.get('resourceManager')).toBe(mockResourceManager);
    });

    it('should set host to localhost', async () => {
      await server.initialize();
      
      expect(server.host).toBe('localhost');
    });

    it('should handle missing MONOREPO_ROOT gracefully', async () => {
      mockResourceManager.get.mockReturnValue(undefined);
      
      await server.initialize();
      
      expect(server.monorepoRoot).toBeUndefined();
    });

    it('should only get ResourceManager once', async () => {
      await server.initialize();
      await server.initialize();

      // getInstance should only be called once (cached after first call)
      expect(ResourceManager.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerRoute()', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should register route with factory and client file', () => {
      const factory = jest.fn();
      const clientFile = '/path/to/client.js';
      
      server.registerRoute('/test', factory, clientFile, 8090);
      
      const route = server.routes.get('/test');
      expect(route).toBeDefined();
      expect(route.factory).toBe(factory);
      expect(route.clientFile).toBe(clientFile);
      expect(route.port).toBe(8090);
    });

    it('should default port to 8080 if not specified', () => {
      const factory = jest.fn();
      const clientFile = '/path/to/client.js';
      
      server.registerRoute('/test', factory, clientFile);
      
      const route = server.routes.get('/test');
      expect(route.port).toBe(8080);
    });

    it('should register multiple routes', () => {
      const factory1 = jest.fn();
      const factory2 = jest.fn();
      
      server.registerRoute('/route1', factory1, '/client1.js', 8090);
      server.registerRoute('/route2', factory2, '/client2.js', 8091);
      
      expect(server.routes.size).toBe(2);
      expect(server.routes.get('/route1').port).toBe(8090);
      expect(server.routes.get('/route2').port).toBe(8091);
    });

    it('should validate factory is a function', () => {
      expect(() => {
        server.registerRoute('/test', 'not-a-function', '/client.js');
      }).toThrow('Server actor factory must be a function');
    });

    it('should validate client file is provided', () => {
      const factory = jest.fn();
      
      expect(() => {
        server.registerRoute('/test', factory, null);
      }).toThrow('Client actor file path is required');
    });

    it('should validate route starts with slash', () => {
      const factory = jest.fn();
      
      expect(() => {
        server.registerRoute('test', factory, '/client.js');
      }).toThrow('Route must start with /');
    });

    it('should validate port is a number', () => {
      const factory = jest.fn();
      
      expect(() => {
        server.registerRoute('/test', factory, '/client.js', 'not-a-number');
      }).toThrow('Port must be a number');
    });

    it('should validate port is in valid range', () => {
      const factory = jest.fn();
      
      expect(() => {
        server.registerRoute('/test', factory, '/client.js', 100);
      }).toThrow('Port must be between 1024 and 65535');
      
      expect(() => {
        server.registerRoute('/test', factory, '/client.js', 70000);
      }).toThrow('Port must be between 1024 and 65535');
    });
  });

  describe('registerStaticRoute()', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should register static route', () => {
      server.registerStaticRoute('/static', './public');
      
      const route = server.staticRoutes.get('/static');
      expect(route).toBe('./public');
    });

    it('should register multiple static routes', () => {
      server.registerStaticRoute('/assets', './assets');
      server.registerStaticRoute('/images', './images');
      
      expect(server.staticRoutes.size).toBe(2);
    });

    it('should validate path starts with slash', () => {
      expect(() => {
        server.registerStaticRoute('static', './public');
      }).toThrow('Path must start with /');
    });

    it('should validate directory is provided', () => {
      expect(() => {
        server.registerStaticRoute('/static', null);
      }).toThrow('Directory is required');
    });
  });
});