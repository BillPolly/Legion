/**
 * Unit tests for configuration module using ResourceManager
 */

import { jest } from '@jest/globals';
import { getConfig, initializeConfig } from '../../config.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Configuration Module', () => {
  let mockResourceManager;

  beforeEach(() => {
    // Mock ResourceManager for unit tests
    mockResourceManager = {
      get: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true)
    };
    
    // Mock getInstance to return our mock
    jest.spyOn(ResourceManager, 'getInstance').mockReturnValue(mockResourceManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeConfig', () => {
    it('should get ResourceManager singleton', async () => {
      await initializeConfig();
      
      expect(ResourceManager.getInstance).toHaveBeenCalled();
    });

    it('should initialize ResourceManager', async () => {
      await initializeConfig();
      
      expect(mockResourceManager.initialize).toHaveBeenCalled();
    });

    it('should return the ResourceManager instance', async () => {
      const result = await initializeConfig();
      
      expect(result).toBe(mockResourceManager);
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      await initializeConfig();
    });

    it('should retrieve MONOREPO_ROOT from ResourceManager', () => {
      mockResourceManager.get.mockReturnValue('/path/to/monorepo');
      
      const config = getConfig();
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.MONOREPO_ROOT');
      expect(config.monorepoRoot).toBe('/path/to/monorepo');
    });

    it('should retrieve NODE_ENV with default', () => {
      mockResourceManager.get.mockReturnValue(undefined);
      
      const config = getConfig();
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.NODE_ENV');
      expect(config.env).toBe('development');
    });

    it('should retrieve LOG_LEVEL with default', () => {
      mockResourceManager.get.mockReturnValue(undefined);
      
      const config = getConfig();
      
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.LOG_LEVEL');
      expect(config.logLevel).toBe('info');
    });

    it('should parse CORS_ORIGINS as array', () => {
      mockResourceManager.get.mockImplementation((key) => {
        if (key === 'env.CORS_ORIGINS') {
          return 'http://localhost:3000,http://localhost:3001';
        }
        return undefined;
      });
      
      const config = getConfig();
      
      expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });

    it('should use default CORS origins when not set', () => {
      mockResourceManager.get.mockReturnValue(undefined);
      
      const config = getConfig();
      
      expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    });

    it('should always set host to localhost', () => {
      const config = getConfig();
      
      expect(config.host).toBe('localhost');
    });

    it('should throw error if not initialized', async () => {
      // Need to import fresh to test uninitialized state
      jest.resetModules();
      const { getConfig: getConfigFresh } = await import('../../config.js');
      
      expect(() => getConfigFresh()).toThrow('Configuration not initialized');
    });
  });
});