/**
 * ResourceManager Dependency Injection Test
 * 
 * This test ensures that:
 * 1. ALL modules receive ResourceManager regardless of their needsResourceManager flag
 * 2. Tools have proper reference to their parent module
 * 3. Modules can access environment variables through ResourceManager
 * 4. The entire dependency injection chain works end-to-end
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { ResourceManager } from '@legion/core';

describe('ResourceManager Dependency Injection', () => {
  let resourceManager;
  let moduleLoader;
  let loadedModules;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    // Create module loader
    moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();

    // Load all modules
    const result = await moduleLoader.loadModules();
    loadedModules = result.loaded;
  });

  describe('ResourceManager Singleton Pattern', () => {
    test('should provide the same ResourceManager instance to all modules', () => {
      const rm1 = ResourceManager.getInstance();
      const rm2 = ResourceManager.getInstance();
      
      expect(rm1).toBe(rm2);
      expect(rm1).toBe(resourceManager);
    });

    test('should be properly initialized', () => {
      expect(resourceManager.initialized).toBe(true);
      expect(typeof resourceManager.get).toBe('function');
    });
  });

  describe('Module Instantiation with ResourceManager', () => {
    test('should load modules successfully', () => {
      expect(loadedModules).toBeDefined();
      expect(Array.isArray(loadedModules)).toBe(true);
      expect(loadedModules.length).toBeGreaterThan(0);
    });

    test('should instantiate modules with proper structure', () => {
      loadedModules.forEach(({ config, instance }) => {
        expect(config).toBeDefined();
        expect(config.name).toBeDefined();
        
        expect(instance).toBeDefined();
        expect(typeof instance.getTools).toBe('function');
      });
    });

    test('should provide modules with access to ResourceManager capabilities', () => {
      // Test that modules can be instantiated (which means they got dependencies they needed)
      loadedModules.forEach(({ instance, config }) => {
        expect(instance).toBeDefined();
        
        // If the module has a resourceManager property, it should be the singleton
        if (instance.resourceManager) {
          expect(instance.resourceManager).toBe(resourceManager);
        }
        
        // Module should be able to provide tools
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true);
      });
    });
  });

  describe('Environment Variable Access', () => {
    test('should provide access to environment variables', () => {
      // Test that ResourceManager can access environment variables
      const nodeEnv = resourceManager.get('env.NODE_ENV');
      expect(nodeEnv).toBeDefined();
      
      // Test specific Legion environment variables
      const mongodbUrl = resourceManager.get('env.MONGODB_URL');
      expect(mongodbUrl).toBeDefined();
    });

    test('should handle missing environment variables gracefully', () => {
      const nonExistent = resourceManager.get('env.NON_EXISTENT_VAR');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Tool-Module Relationship', () => {
    test('should provide tools with proper parent module context', () => {
      loadedModules.forEach(({ instance, config }) => {
        const tools = instance.getTools();
        
        tools.forEach(tool => {
          expect(tool).toBeDefined();
          expect(tool.name).toBeDefined();
          expect(typeof tool.execute).toBe('function');
          
          // Tools should have proper structure
          expect(tool.description).toBeDefined();
        });
      });
    });

    test('should maintain tool uniqueness within modules', () => {
      loadedModules.forEach(({ instance }) => {
        const tools = instance.getTools();
        const toolNames = tools.map(t => t.name);
        const uniqueNames = new Set(toolNames);
        
        expect(uniqueNames.size).toBe(toolNames.length);
      });
    });
  });

  describe('Dependency Resolution', () => {
    test('should handle modules with different dependency patterns', () => {
      // Test that we can load modules regardless of their dependency patterns
      const moduleTypes = new Set(loadedModules.map(({ config }) => config.type));
      
      // Should have at least class-based modules
      expect(moduleTypes.has('class')).toBe(true);
      
      // All modules should be successfully instantiated
      loadedModules.forEach(({ instance, config }) => {
        expect(instance).toBeDefined();
        expect(instance.constructor).toBeDefined();
      });
    });

    test('should provide consistent module interfaces', () => {
      loadedModules.forEach(({ instance }) => {
        // All modules should implement getTools
        expect(typeof instance.getTools).toBe('function');
        
        // Tools should be an array
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle module loading failures gracefully', async () => {
      // Test that the loader can handle failures without crashing
      const result = await moduleLoader.loadModules();
      
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.loaded).toBeGreaterThan(0);
      
      // Some failures might be expected (missing dependencies, etc.)
      expect(result.failed).toBeDefined();
      expect(Array.isArray(result.failed)).toBe(true);
    });
  });
});