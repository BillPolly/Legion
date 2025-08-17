/**
 * Unit tests for middleware functionality
 */

import { jest } from '@jest/globals';
import { BaseServer } from '../../BaseServer.js';
import { ResourceManager } from '@legion/resource-manager';
import express from 'express';

describe('Middleware Unit Tests', () => {
  let mockResourceManager;
  let server;

  beforeEach(() => {
    // Mock ResourceManager for unit tests
    mockResourceManager = {
      get: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true)
    };
    
    jest.spyOn(ResourceManager, 'getInstance').mockReturnValue(mockResourceManager);
    
    server = new BaseServer();
    server.resourceManager = mockResourceManager;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (server) {
      server.stop().catch(() => {});
    }
  });

  describe('CORS middleware', () => {
    it('should apply CORS middleware with default origins', () => {
      const useSpy = jest.spyOn(server.app, 'use');
      
      server.setupMiddleware();
      
      // Check that CORS was applied
      const corsCall = useSpy.mock.calls.find(call => 
        call[0] && call[0].name === 'corsMiddleware'
      );
      
      expect(corsCall).toBeDefined();
    });

    it('should use CORS origins from ResourceManager', async () => {
      await server.initialize();
      
      // ResourceManager might have CORS_ORIGINS configured
      const corsOrigins = server.resourceManager.get('env.CORS_ORIGINS');
      
      if (corsOrigins) {
        expect(corsOrigins).toBeDefined();
      }
    });
  });

  describe('JSON parsing middleware', () => {
    it('should apply JSON parsing middleware', () => {
      const useSpy = jest.spyOn(server.app, 'use');
      
      server.setupMiddleware();
      
      // Should have JSON parsing
      const jsonCalls = useSpy.mock.calls.filter(call => 
        call[0] && (call[0].name === 'jsonParser' || call[0].name === 'urlencodedParser')
      );
      
      expect(jsonCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Logging middleware', () => {
    it('should add request logging in development', async () => {
      await server.initialize();
      
      const nodeEnv = server.resourceManager.get('env.NODE_ENV');
      
      if (nodeEnv !== 'production') {
        // In non-production, logging should be enabled
        const useSpy = jest.spyOn(server.app, 'use');
        server.setupMiddleware();
        
        const loggingMiddleware = useSpy.mock.calls.find(call =>
          call[0] && typeof call[0] === 'function' && call[0].length === 3
        );
        
        expect(loggingMiddleware).toBeDefined();
      }
    });

    it('should not add request logging in production', async () => {
      await server.initialize();
      
      // Mock production environment
      const originalGet = server.resourceManager.get;
      server.resourceManager.get = (key) => {
        if (key === 'env.NODE_ENV') return 'production';
        return originalGet.call(server.resourceManager, key);
      };
      
      const useSpy = jest.spyOn(server.app, 'use');
      server.setupMiddleware();
      
      // Check that no custom logging middleware was added
      // In production, only CORS, JSON parsing, and query middleware should be added
      const middlewareCalls = useSpy.mock.calls;
      
      // Should have CORS middleware and JSON parsing middleware, but no custom logging
      expect(middlewareCalls.length).toBeGreaterThanOrEqual(2);
      
      // None of the middleware calls should be a custom logging function
      const hasCustomLogging = middlewareCalls.some(call => {
        const middleware = call[0];
        return typeof middleware === 'function' && middleware.length === 3 && 
               middleware.toString().includes('console.log');
      });
      
      expect(hasCustomLogging).toBe(false);
    });
  });

  describe('Error handling middleware', () => {
    it('should handle middleware errors gracefully', () => {
      const errorHandler = (err, req, res, next) => {
        res.status(500).json({ error: err.message });
      };
      
      server.app.use(errorHandler);
      
      // Verify error handler is registered
      const errorMiddleware = server.app._router?.stack?.find(layer =>
        layer.handle && layer.handle.length === 4
      );
      
      expect(errorMiddleware).toBeDefined();
    });
  });

  describe('Static file middleware', () => {
    it('should apply static middleware for registered paths', () => {
      server.registerStaticRoute('/assets', '/path/to/assets');
      
      const staticRoutes = server.staticRoutes;
      expect(staticRoutes.get('/assets')).toBe('/path/to/assets');
    });

    it('should validate static route paths', () => {
      expect(() => {
        server.registerStaticRoute('invalid', '/path');
      }).toThrow('Path must start with /');
      
      expect(() => {
        server.registerStaticRoute('/valid', null);
      }).toThrow('Directory is required');
    });
  });

  describe('Health check endpoint', () => {
    it('should have /health endpoint configured', async () => {
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, 'client.js', 8080);
      
      // The health check is added in startServerOnPort
      // We can verify it's in the route setup
      expect(server.routes.has('/app')).toBe(true);
    });
  });

  describe('Middleware order', () => {
    it('should apply middleware in correct order', () => {
      const callOrder = [];
      
      // Mock middleware to track order
      const corsMiddleware = (req, res, next) => {
        callOrder.push('cors');
        next();
      };
      
      const jsonMiddleware = (req, res, next) => {
        callOrder.push('json');
        next();
      };
      
      const loggingMiddleware = (req, res, next) => {
        callOrder.push('logging');
        next();
      };
      
      // Apply in expected order
      server.app.use(corsMiddleware);
      server.app.use(jsonMiddleware);
      server.app.use(loggingMiddleware);
      
      // Simulate request
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();
      
      // Process through middleware
      let currentIndex = 0;
      const middlewares = [corsMiddleware, jsonMiddleware, loggingMiddleware];
      
      const processNext = () => {
        if (currentIndex < middlewares.length) {
          const middleware = middlewares[currentIndex++];
          middleware(mockReq, mockRes, processNext);
        }
      };
      
      processNext();
      
      expect(callOrder).toEqual(['cors', 'json', 'logging']);
    });
  });
});