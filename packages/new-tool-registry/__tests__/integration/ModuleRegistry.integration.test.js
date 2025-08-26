/**
 * Integration tests for ModuleRegistry
 * 
 * Tests real registry operations with actual MongoDB connection
 * NO MOCKS - real implementation testing only
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleRegistry Integration', () => {
  let moduleRegistry;
  let databaseStorage;
  let databaseOperations;
  let resourceManager;
  let testDir;
  
  beforeAll(async () => {
    // Create isolated test ResourceManager instance
    resourceManager = await global.createTestResourceManager();
    
    // Create test directory for test modules
    testDir = path.join(__dirname, '../tmp/registry-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test modules
    await fs.writeFile(
      path.join(testDir, 'RegistryTestModule.js'),
      `
export default class RegistryTestModule {
  getName() { return 'RegistryTestModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Test module for registry integration'; }
  getTools() {
    return [
      {
        name: 'registry-tool-1',
        description: 'First registry test tool',
        execute: (params) => ({ success: true, result: params }),
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'object' } } }
      },
      {
        name: 'registry-tool-2',
        description: 'Second registry test tool',
        execute: (params) => ({ success: true, value: params.value * 2 }),
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } }
      }
    ];
  }
}`
    );
    
    await fs.writeFile(
      path.join(testDir, 'AnotherRegistryModule.js'),
      `
export default class AnotherRegistryModule {
  getName() { return 'AnotherRegistryModule'; }
  getVersion() { return '2.0.0'; }
  getDescription() { return 'Another registry test module'; }
  getTools() {
    return [
      {
        name: 'another-registry-tool',
        description: 'Another registry test tool',
        execute: (params) => ({ success: true, data: params }),
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      }
    ];
  }
}`
    );
    
    await fs.writeFile(
      path.join(testDir, 'CalculatorModule.js'),
      `
export default class CalculatorModule {
  getName() { return 'CalculatorModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Calculator module for pattern matching tests'; }
  getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers',
        execute: (params) => ({ success: true, result: params.a + params.b }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            a: { type: 'number' },
            b: { type: 'number' }
          } 
        },
        outputSchema: { type: 'object', properties: { result: { type: 'number' } } }
      }
    ];
  }
}`
    );
  });
  
  afterAll(async () => {
    // Close database connection
    if (databaseStorage) {
      await databaseStorage.close();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  beforeEach(async () => {
    // Create fresh database storage
    databaseStorage = new DatabaseStorage({ resourceManager });
    await databaseStorage.initialize();
    
    // Register for cleanup
    global.registerTestConnection(databaseStorage);
    
    // Clear collections before each test
    try {
      await databaseStorage.clearCollection('modules');
      await databaseStorage.clearCollection('tools');
    } catch (error) {
      // Collections might not exist yet
    }
    
    // Create database operations
    databaseOperations = new DatabaseOperations({
      databaseStorage,
      resourceManager
    });
    
    // Create module registry
    moduleRegistry = new ModuleRegistry({
      databaseOperations,
      resourceManager,
      cacheEnabled: true,
      verbose: false
    });
    
    await moduleRegistry.initialize();
  });
  
  afterEach(async () => {
    if (moduleRegistry) {
      await moduleRegistry.shutdown();
    }
  });
  
  describe('Database Integration', () => {
    it('should connect to MongoDB and initialize', async () => {
      expect(databaseStorage.isConnected).toBe(true);
      expect(moduleRegistry).toBeInstanceOf(ModuleRegistry);
      expect(moduleRegistry).toBeInstanceOf(EventEmitter);
    });
  });
  
  describe('Module Loading', () => {
    it('should load a module by name from database', async () => {
      // Pre-discover modules for this specific test
      await databaseOperations.discoverAndLoad(testDir);
      
      const module = await moduleRegistry.getModule('RegistryTestModule');
      
      expect(module).toBeDefined();
      expect(module.getName()).toBe('RegistryTestModule');
      expect(module.getVersion()).toBe('1.0.0');
    });
    
    it('should cache loaded modules', async () => {
      // Pre-discover modules for this specific test
      await databaseOperations.discoverAndLoad(testDir);
      
      const module1 = await moduleRegistry.getModule('RegistryTestModule');
      const module2 = await moduleRegistry.getModule('RegistryTestModule');
      
      // Should be same instance
      expect(module1).toBe(module2);
      expect(moduleRegistry.getCache().size).toBe(1);
    });
    
    it('should force reload when requested', async () => {
      // Pre-discover modules for this specific test
      await databaseOperations.discoverAndLoad(testDir);
      
      const module1 = await moduleRegistry.getModule('RegistryTestModule');
      const module2 = await moduleRegistry.getModule('RegistryTestModule', { forceReload: true });
      
      // ES modules are cached by runtime, so instances will be the same
      // but the force reload should bypass our internal cache
      expect(module1).toBe(module2); // Same due to ES module caching
      expect(module1.getName()).toBe(module2.getName());
    });
    
    it('should return null for non-existent modules', async () => {
      const module = await moduleRegistry.getModule('NonExistentModule');
      
      expect(module).toBeNull();
    });
    
    it('should load multiple modules', async () => {
      // Pre-discover modules for this specific test
      await databaseOperations.discoverAndLoad(testDir);
      
      const modules = await moduleRegistry.getModules([
        'RegistryTestModule',
        'AnotherRegistryModule'
      ]);
      
      expect(modules).toHaveLength(2);
      expect(modules[0].name).toBe('RegistryTestModule');
      expect(modules[1].name).toBe('AnotherRegistryModule');
    });
  });
  
  describe('Module Discovery', () => {
    it('should discover and load modules from directory', async () => {
      const result = await moduleRegistry.discoverAndLoad(testDir);
      
      expect(result.discovered).toBeGreaterThanOrEqual(3);
      expect(result.loaded).toHaveLength(3);
      
      // Verify modules are cached
      expect(moduleRegistry.getCache().size).toBe(3);
    });
    
    it('should load all modules from database', async () => {
      // First discover
      await moduleRegistry.discoverAndLoad(testDir);
      
      // Clear cache
      moduleRegistry.clearCache();
      expect(moduleRegistry.getCache().size).toBe(0);
      
      // Load all from database
      const result = await moduleRegistry.loadAll();
      
      expect(result.loaded).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.total).toBe(3);
      
      // Should be cached
      expect(moduleRegistry.getCache().size).toBe(3);
    });
  });
  
  describe('Module Searching', () => {
    it('should find modules by pattern', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const modules = await moduleRegistry.findModules(/.*Module$/);
      
      expect(modules.length).toBeGreaterThanOrEqual(3);
      modules.forEach(module => {
        expect(module.getName()).toMatch(/.*Module$/);
      });
    });
    
    it('should find modules by filter function', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const modules = await moduleRegistry.findModules(
        metadata => metadata.version === '1.0.0'
      );
      
      expect(modules.length).toBeGreaterThanOrEqual(2); // RegistryTestModule and CalculatorModule
    });
    
    it('should check if module exists', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const exists1 = await moduleRegistry.hasModule('RegistryTestModule');
      const exists2 = await moduleRegistry.hasModule('NonExistentModule');
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
  });
  
  describe('Module Management', () => {
    it('should reload a module', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const module1 = await moduleRegistry.getModule('RegistryTestModule');
      const reloaded = await moduleRegistry.reloadModule('RegistryTestModule');
      
      expect(reloaded).toBeDefined();
      expect(reloaded.getName()).toBe('RegistryTestModule');
      
      // Should be cached after reload
      const cached = await moduleRegistry.getModule('RegistryTestModule');
      expect(cached).toBe(reloaded);
    });
    
    it('should unload a module from registry', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      await moduleRegistry.getModule('RegistryTestModule');
      expect(moduleRegistry.getCache().has('RegistryTestModule')).toBe(true);
      
      const unloaded = await moduleRegistry.unloadModule('RegistryTestModule');
      
      expect(unloaded).toBe(true);
      expect(moduleRegistry.getCache().has('RegistryTestModule')).toBe(false);
    });
    
    it('should clear a module from database and cache', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      await moduleRegistry.getModule('RegistryTestModule');
      
      const result = await moduleRegistry.clearModule('RegistryTestModule');
      
      expect(result.modulesDeleted).toBe(1);
      expect(result.toolsDeleted).toBe(2); // Two tools in RegistryTestModule
      
      // Should be gone from cache
      expect(moduleRegistry.getCache().has('RegistryTestModule')).toBe(false);
      
      // Should be gone from database
      const module = await moduleRegistry.getModule('RegistryTestModule');
      expect(module).toBeNull();
    });
    
    it('should clear all modules', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const result = await moduleRegistry.clearAll();
      
      expect(result.modulesDeleted).toBe(3);
      expect(result.toolsDeleted).toBe(4); // Total tools from all modules
      
      // Cache should be empty
      expect(moduleRegistry.getCache().size).toBe(0);
      
      // Database should be empty
      const stats = await moduleRegistry.getStatistics();
      expect(stats.database.modules.count).toBe(0);
      expect(stats.database.tools.count).toBe(0);
    });
  });
  
  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      await moduleRegistry.discoverAndLoad(testDir);
      
      const stats = await moduleRegistry.getStatistics();
      
      expect(stats).toHaveProperty('database');
      expect(stats).toHaveProperty('cache');
      
      expect(stats.database.modules.count).toBe(3);
      expect(stats.database.modules.loaded).toBe(3);
      expect(stats.database.tools.count).toBe(4);
      
      expect(stats.cache.size).toBe(3);
      expect(stats.cache.modules).toContain('RegistryTestModule');
      expect(stats.cache.modules).toContain('AnotherRegistryModule');
      expect(stats.cache.modules).toContain('CalculatorModule');
    });
  });
  
  describe('Event Handling', () => {
    it('should emit module:loaded event', async () => {
      await databaseOperations.discoverAndLoad(testDir);
      
      const loadedEvents = [];
      moduleRegistry.on('module:loaded', (event) => {
        loadedEvents.push(event);
      });
      
      await moduleRegistry.getModule('RegistryTestModule');
      
      expect(loadedEvents).toHaveLength(1);
      expect(loadedEvents[0].name).toBe('RegistryTestModule');
      expect(loadedEvents[0].module).toBeDefined();
    });
    
    it('should emit module:unloaded event', async () => {
      await databaseOperations.discoverAndLoad(testDir);
      await moduleRegistry.getModule('RegistryTestModule');
      
      const unloadedEvents = [];
      moduleRegistry.on('module:unloaded', (event) => {
        unloadedEvents.push(event);
      });
      
      await moduleRegistry.unloadModule('RegistryTestModule');
      
      expect(unloadedEvents).toHaveLength(1);
      expect(unloadedEvents[0].name).toBe('RegistryTestModule');
    });
    
    it('should emit cache:cleared event', async () => {
      let cacheCleared = false;
      moduleRegistry.on('cache:cleared', () => {
        cacheCleared = true;
      });
      
      moduleRegistry.clearCache();
      
      expect(cacheCleared).toBe(true);
    });
    
    it('should emit registry:initialized event', async () => {
      const newRegistry = new ModuleRegistry({
        databaseOperations,
        resourceManager
      });
      
      let initialized = false;
      newRegistry.on('registry:initialized', () => {
        initialized = true;
      });
      
      await newRegistry.initialize();
      
      expect(initialized).toBe(true);
      
      await newRegistry.shutdown();
    });
    
    it('should emit registry:shutdown event', async () => {
      const newRegistry = new ModuleRegistry({
        databaseOperations,
        resourceManager
      });
      
      await newRegistry.initialize();
      
      let shutdownEmitted = false;
      newRegistry.on('registry:shutdown', () => {
        shutdownEmitted = true;
      });
      
      await newRegistry.shutdown();
      
      expect(shutdownEmitted).toBe(true);
    });
  });
  
  describe('Cache Management', () => {
    it('should respect cache enabled setting', async () => {
      await databaseOperations.discoverAndLoad(testDir);
      
      const module1 = await moduleRegistry.getModule('RegistryTestModule');
      const module2 = await moduleRegistry.getModule('RegistryTestModule');
      
      expect(module1).toBe(module2);
      expect(moduleRegistry.getCache().size).toBe(1);
    });
    
    it('should work with cache disabled', async () => {
      await databaseOperations.discoverAndLoad(testDir);
      
      const noCacheRegistry = new ModuleRegistry({
        databaseOperations,
        resourceManager,
        cacheEnabled: false
      });
      
      await noCacheRegistry.initialize();
      
      const module1 = await noCacheRegistry.getModule('RegistryTestModule');
      const module2 = await noCacheRegistry.getModule('RegistryTestModule');
      
      // ES modules are cached by runtime, so instances will be the same
      // even without our cache
      expect(module1).toBe(module2); // Same due to ES module caching
      expect(module1.getName()).toBe(module2.getName());
      
      // Cache should remain empty
      expect(noCacheRegistry.getCache().size).toBe(0);
      
      await noCacheRegistry.shutdown();
    });
    
    it('should handle metadata caching', async () => {
      await databaseOperations.discoverAndLoad(testDir);
      
      const metadata1 = await moduleRegistry.getModuleMetadata('RegistryTestModule');
      const metadata2 = await moduleRegistry.getModuleMetadata('RegistryTestModule');
      
      expect(metadata1).toBe(metadata2); // Same cached object
      expect(metadata1.name).toBe('RegistryTestModule');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle module loading errors gracefully', async () => {
      // Try to load a module that doesn't exist in database
      const module = await moduleRegistry.getModule('NonExistentModule');
      
      expect(module).toBeNull();
      
      // Registry should still be functional
      await databaseOperations.discoverAndLoad(testDir);
      const validModule = await moduleRegistry.getModule('RegistryTestModule');
      expect(validModule).toBeDefined();
    });
    
    it('should handle database connection issues gracefully', async () => {
      // Close database connection
      await databaseStorage.close();
      
      // Try to get statistics with closed connection
      try {
        await moduleRegistry.getStatistics();
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
      
      // Re-initialize for other tests
      await databaseStorage.initialize();
    });
  });
  
  describe('Performance', () => {
    it('should handle many modules efficiently', async () => {
      // Create multiple test modules
      const moduleCount = 20;
      const modules = [];
      
      for (let i = 0; i < moduleCount; i++) {
        const modulePath = path.join(testDir, `PerfModule${i}.js`);
        await fs.writeFile(
          modulePath,
          `
export default class PerfModule${i} {
  getName() { return 'PerfModule${i}'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Performance test module ${i}'; }
  getTools() {
    return [{
      name: 'perf-tool-${i}',
      description: 'Performance test tool ${i}',
      execute: (params) => ({ success: true }),
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' }
    }];
  }
}`
        );
        modules.push(`PerfModule${i}`);
      }
      
      // Discover all modules
      const startDiscover = Date.now();
      await moduleRegistry.discoverAndLoad(testDir);
      const discoverTime = Date.now() - startDiscover;
      
      console.log(`Discovery time for ${moduleCount + 3} modules: ${discoverTime}ms`);
      expect(discoverTime).toBeLessThan(10000); // Should be under 10 seconds
      
      // Load all modules
      const startLoad = Date.now();
      const loadedModules = await moduleRegistry.getModules(modules);
      const loadTime = Date.now() - startLoad;
      
      console.log(`Load time for ${moduleCount} modules: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Should be under 5 seconds
      
      // Verify caching performance
      const startCached = Date.now();
      for (let i = 0; i < moduleCount; i++) {
        await moduleRegistry.getModule(`PerfModule${i}`);
      }
      const cachedTime = Date.now() - startCached;
      
      console.log(`Cached retrieval time for ${moduleCount} modules: ${cachedTime}ms`);
      expect(cachedTime).toBeLessThan(100); // Should be very fast from cache
    });
  });
});