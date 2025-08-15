/**
 * Tool Discovery and Module Integrity Test
 * 
 * Tests the module loading system and validates that all modules
 * in the Legion codebase conform to proper interfaces and can be instantiated correctly.
 */

import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { DatabasePopulator } from '../../src/loading/DatabasePopulator.js';
import { SemanticToolDiscovery } from '../../src/search/SemanticToolDiscovery.js';
import { ResourceManager } from '@legion/core';

describe('Tool Discovery and Module Integrity', () => {
  let resourceManager;
  let moduleLoader;
  let databasePopulator;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    
    // Create module loader
    moduleLoader = new ModuleLoader({ verbose: false });
    await moduleLoader.initialize();
    
    databasePopulator = new DatabasePopulator({ verbose: false });
  });

  describe('Module Loading System', () => {
    test('should load modules from registry', async () => {
      const result = await moduleLoader.loadModules();
      
      expect(result).toBeDefined();
      expect(result.loaded).toBeDefined();
      expect(Array.isArray(result.loaded)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
    });

    test('should validate module structure', async () => {
      const result = await moduleLoader.loadModules();
      
      for (const { config, instance } of result.loaded) {
        // Validate config structure
        expect(config).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.type).toBeDefined();
        expect(config.path).toBeDefined();
        
        // Validate instance structure
        expect(instance).toBeDefined();
        expect(typeof instance.getTools).toBe('function');
        
        // Validate tools - should always return an array per the Module base class
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true);
        
        tools.forEach(tool => {
          expect(tool.name).toBeDefined();
          expect(tool.description).toBeDefined();
          expect(typeof tool.execute).toBe('function');
        });
      }
    });

    test('should handle module instantiation properly', async () => {
      const result = await moduleLoader.loadModules();
      
      // Check that modules were instantiated without errors
      expect(result.failed.length).toBeLessThan(result.loaded.length);
      
      // Check that each loaded module is properly instantiated
      for (const { instance } of result.loaded) {
        expect(instance).toBeDefined();
        expect(instance.constructor).toBeDefined();
        expect(instance.name || instance.constructor.name).toBeDefined();
      }
    });
  });

  describe('Tool Extraction and Validation', () => {
    test('should extract tools from all modules', async () => {
      const result = await moduleLoader.loadModules();
      let totalTools = 0;
      
      for (const { instance } of result.loaded) {
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true); // Should always be an array
        totalTools += tools.length;
        
        // Each tool should have required properties
        tools.forEach(tool => {
          expect(tool.name).toBeDefined();
          expect(typeof tool.name).toBe('string');
          expect(tool.name.length).toBeGreaterThan(0);
          
          expect(tool.description).toBeDefined();
          expect(typeof tool.description).toBe('string');
          
          expect(typeof tool.execute).toBe('function');
        });
      }
      
      expect(totalTools).toBeGreaterThan(0);
    });

    test('should have unique tool names within modules', async () => {
      const result = await moduleLoader.loadModules();
      
      for (const { instance } of result.loaded) {
        const tools = instance.getTools();
        expect(Array.isArray(tools)).toBe(true); // Should always be an array
        const toolNames = tools.map(t => t.name);
        const uniqueNames = new Set(toolNames);
        
        expect(uniqueNames.size).toBe(toolNames.length);
      }
    });
  });

  describe('Database Integration', () => {
    test('should be able to populate database with discovered modules', async () => {
      const result = await moduleLoader.loadModules();
      
      // This test just verifies the populator can be created and would work
      // without actually modifying the database
      expect(databasePopulator).toBeDefined();
      expect(typeof databasePopulator.populate).toBe('function');
      
      // Verify modules are in correct format for population
      expect(result.loaded.length).toBeGreaterThan(0);
      result.loaded.forEach(({ config, instance }) => {
        expect(config.name).toBeDefined();
        expect(typeof instance.getTools).toBe('function');
      });
    });
  });

  describe('Module Registry Validation', () => {
    test('should have consistent module registry format', async () => {
      const result = await moduleLoader.loadModules();
      
      // All modules should follow consistent patterns
      result.loaded.forEach(({ config }) => {
        expect(config).toMatchObject({
          name: expect.any(String),
          type: expect.any(String),
          path: expect.any(String)
        });
        
        if (config.type === 'class') {
          expect(config.className).toBeDefined();
        }
      });
    });

    test('should load modules from valid paths', async () => {
      const result = await moduleLoader.loadModules();
      
      // All loaded modules should have valid paths
      result.loaded.forEach(({ config }) => {
        expect(config.path).toMatch(/^packages\//);
      });
    });
  });
});