import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import RailwayModule from '../../src/RailwayModule.js';

describe('RailwayModule', () => {
  let resourceManager;
  let mockProvider;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      getAccountOverview: jest.fn().mockResolvedValue({
        success: true,
        account: { email: 'test@example.com' }
      })
    };

    // Create resource manager with mocked env
    resourceManager = ResourceManager.getInstance();
    resourceManager.register('env.RAILWAY_API_KEY', 'test-api-key');
  });

  describe('constructor', () => {
    it('should create module with correct metadata', () => {
      const module = new RailwayModule(resourceManager);
      
      expect(module.name).toBe('railway');
      expect(module.displayName).toBe('Railway Deployment Module');
      expect(module.description).toBe('Deploy and manage applications on Railway cloud platform');
    });

    it('should throw error if API key is not available', () => {
      const emptyResourceManager = ResourceManager.getInstance();
      
      expect(() => new RailwayModule(emptyResourceManager)).toThrow(
        'Railway API key not found. Set RAILWAY_API_KEY or RAILWAY environment variable.'
      );
    });

    it('should accept RAILWAY env var as fallback', () => {
      const rmWithRailway = ResourceManager.getInstance();
      rmWithRailway.register('env.RAILWAY', 'test-api-key-2');
      
      expect(() => new RailwayModule(rmWithRailway)).not.toThrow();
    });
  });

  describe('getTools', () => {
    it('should return array of tools', () => {
      const module = new RailwayModule(resourceManager);
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(6);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('railway_deploy');
      expect(toolNames).toContain('railway_status');
      expect(toolNames).toContain('railway_logs');
      expect(toolNames).toContain('railway_update_env');
      expect(toolNames).toContain('railway_remove');
      expect(toolNames).toContain('railway_list_projects');
    });
  });

  describe('initialize', () => {
    it('should verify API key on initialization', async () => {
      // Mock the provider's getAccountOverview method
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const module = new RailwayModule(resourceManager);
      module.provider = mockProvider;
      
      await module.initialize();
      
      expect(mockProvider.getAccountOverview).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Railway module initialized for account: test@example.com'
      );
      
      console.log.mockRestore();
      console.warn.mockRestore();
    });

    it('should handle initialization failure gracefully', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const module = new RailwayModule(resourceManager);
      module.provider = {
        getAccountOverview: jest.fn().mockResolvedValue({
          success: false,
          error: 'Invalid API key'
        })
      };
      
      await module.initialize();
      
      expect(console.warn).toHaveBeenCalledWith(
        'Railway API key verification failed:',
        'Invalid API key'
      );
      
      console.warn.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should perform cleanup', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const module = new RailwayModule(resourceManager);
      await module.cleanup();
      
      expect(console.log).toHaveBeenCalledWith('Railway module cleanup completed');
      
      console.log.mockRestore();
    });
  });

  describe('provider registration', () => {
    it('should register provider with resource manager', () => {
      const module = new RailwayModule(resourceManager);
      
      const registeredProvider = resourceManager.railwayProvider;
      expect(registeredProvider).toBeDefined();
      expect(registeredProvider).toBe(module.provider);
    });
  });
});