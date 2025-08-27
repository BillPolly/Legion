import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import RailwayModule from '../../src/RailwayModule.js';

describe('RailwayModule', () => {
  let resourceManager;
  let mockProvider;

  beforeEach(async () => {
    // Create mock provider
    mockProvider = {
      getAccountOverview: jest.fn().mockResolvedValue({
        success: true,
        account: { email: 'test@example.com' }
      })
    };

    // Create resource manager with mocked env
    resourceManager = await ResourceManager.getInstance();
    resourceManager.set('env.RAILWAY_API_KEY', 'test-api-key');
    resourceManager.set('RAILWAY_API_KEY', 'test-api-key');
  });

  describe('constructor and initialization', () => {
    it('should create module with correct metadata', () => {
      const module = new RailwayModule();
      
      expect(module.name).toBe('railway');
      expect(module.description).toBe('Deploy and manage applications on Railway cloud platform');
      expect(module.version).toBe('1.0.0');
    });

    it('should throw error if API key is not available during initialization', async () => {
      // Create a mock resource manager without any API keys
      const emptyResourceManager = {
        get: jest.fn((key) => {
          // Return undefined for all Railway API key requests
          if (key.includes('RAILWAY')) return undefined;
          return undefined;
        }),
        set: jest.fn()
      };
      
      await expect(RailwayModule.create(emptyResourceManager)).rejects.toThrow(
        'Railway API key not found. Set RAILWAY_API_KEY, RAILWAY_API_TOKEN, or RAILWAY environment variable.'
      );
    });

    it('should accept RAILWAY env var as fallback', async () => {
      const rmWithRailway = await ResourceManager.getInstance();
      rmWithRailway.set('env.RAILWAY', 'test-api-key-2');
      
      const module = await RailwayModule.create(rmWithRailway);
      expect(module).toBeDefined();
      expect(module.name).toBe('railway');
    });
  });

  describe('getTools', () => {
    it('should return array of tools after initialization', async () => {
      const module = await RailwayModule.create(resourceManager);
      const tools = module.listTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(6);
      
      expect(tools).toContain('railway_deploy');
      expect(tools).toContain('railway_status');
      expect(tools).toContain('railway_logs');
      expect(tools).toContain('railway_update_env');
      expect(tools).toContain('railway_remove');
      expect(tools).toContain('railway_list_projects');
    });
  });

  describe('initialize', () => {
    it('should verify API key on initialization', async () => {
      // Mock console methods
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const module = await RailwayModule.create(resourceManager);
      
      // Check that the module was initialized
      expect(module.provider).toBeDefined();
      
      // Cleanup
      console.log.mockRestore();
      console.warn.mockRestore();
    });

    it('should handle initialization failure gracefully', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Create a resource manager with API key
      const rm = await ResourceManager.getInstance();
      rm.set('env.RAILWAY_API_KEY', 'invalid-key');
      
      // Module should still initialize even if API verification fails
      const module = await RailwayModule.create(rm);
      expect(module).toBeDefined();
      
      // Cleanup
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
    it('should register provider with resource manager', async () => {
      const module = await RailwayModule.create(resourceManager);
      
      const registeredProvider = resourceManager.get('railwayProvider');
      expect(registeredProvider).toBeDefined();
      expect(registeredProvider).toBe(module.provider);
    });
  });
});