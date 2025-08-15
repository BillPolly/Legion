/**
 * ResourceManager Instance Debug Test
 * 
 * This test debugs ResourceManager singleton behavior and environment variable access
 * to ensure proper dependency injection across the module loading system.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { ResourceManager } from '@legion/core';

describe('ResourceManager Instance Debug', () => {
  let resourceManager;
  let moduleLoader;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    // Create module loader
    moduleLoader = new ModuleLoader({ verbose: true });
    await moduleLoader.initialize();
  });

  describe('ResourceManager Singleton Behavior', () => {
    test('should maintain singleton pattern consistently', () => {
      const rm1 = ResourceManager.getInstance();
      const rm2 = ResourceManager.getInstance();
      const rm3 = resourceManager;

      expect(rm1).toBe(rm2);
      expect(rm1).toBe(rm3);
      expect(rm2).toBe(rm3);
    });

    test('should have environment variables loaded', () => {
      console.log('🔍 Debugging ResourceManager state:');
      console.log('Initialized:', resourceManager.initialized);
      
      // Check for common environment variables
      const nodeEnv = resourceManager.get('env.NODE_ENV');
      const mongoUrl = resourceManager.get('env.MONGODB_URL');
      
      console.log('NODE_ENV:', nodeEnv);
      console.log('MONGODB_URL:', mongoUrl ? 'configured' : 'not found');
      
      expect(nodeEnv).toBeDefined();
      expect(mongoUrl).toBeDefined();
    });
  });

  describe('Module Loading with ResourceManager', () => {
    test('should load modules with consistent ResourceManager access', async () => {
      console.log('🔍 Testing module loading...');
      
      const result = await moduleLoader.loadModules();
      
      console.log(`Loaded ${result.loaded.length} modules successfully`);
      console.log(`Failed to load ${result.failed.length} modules`);
      
      if (result.failed.length > 0) {
        console.log('Failed modules:');
        result.failed.forEach(({ config, error }) => {
          console.log(`  - ${config.name}: ${error}`);
        });
      }

      expect(result.loaded.length).toBeGreaterThan(0);
    });

    test('should provide modules with working ResourceManager access', async () => {
      const result = await moduleLoader.loadModules();
      
      result.loaded.forEach(({ config, instance }) => {
        console.log(`🔍 Checking module: ${config.name}`);
        
        // If module has resourceManager property, verify it's the singleton
        if (instance.resourceManager) {
          console.log(`  - Has resourceManager property`);
          expect(instance.resourceManager).toBe(resourceManager);
        }
        
        // Verify module can provide tools (indicates successful instantiation)
        const tools = instance.getTools();
        console.log(`  - Provides ${tools.length} tools`);
        expect(Array.isArray(tools)).toBe(true);
      });
    });
  });

  describe('Environment Variable Access Patterns', () => {
    test('should access environment variables consistently', () => {
      const envVars = [
        'NODE_ENV',
        'MONGODB_URL',
        'MONGODB_URI',
        'MONGODB_DATABASE',
        'QDRANT_URL'
      ];

      console.log('🔍 Environment variable access test:');
      
      envVars.forEach(varName => {
        const value = resourceManager.get(`env.${varName}`);
        console.log(`  ${varName}: ${value ? 'configured' : 'not found'}`);
      });
      
      // At least NODE_ENV should always be available
      expect(resourceManager.get('env.NODE_ENV')).toBeDefined();
    });

    test('should handle missing variables gracefully', () => {
      const nonExistent = resourceManager.get('env.NON_EXISTENT_VAR_12345');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Module Dependencies Resolution', () => {
    test('should resolve module dependencies correctly', async () => {
      const result = await moduleLoader.loadModules();
      
      console.log('🔍 Module dependency resolution:');
      
      result.loaded.forEach(({ config, instance }) => {
        console.log(`Module: ${config.name} (${config.type})`);
        
        // Check if module was instantiated properly
        expect(instance).toBeDefined();
        expect(instance.constructor).toBeDefined();
        
        // Check if module can provide tools
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true);
        
        console.log(`  - Successfully instantiated with ${tools.length} tools`);
      });
    });
  });
});