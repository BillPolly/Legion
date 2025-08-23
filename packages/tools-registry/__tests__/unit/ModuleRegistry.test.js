/**
 * Unit tests for ModuleRegistry
 * 
 * Tests the registry that manages all modules in the system
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';

describe('ModuleRegistry', () => {
  let moduleRegistry;
  let mockDatabaseOperations;
  let mockModuleLoader;
  
  beforeEach(() => {
    // Create mock database operations
    mockDatabaseOperations = {
      loadModule: jest.fn().mockResolvedValue({
        success: true,
        module: { name: 'TestModule', version: '1.0.0' },
        tools: []
      }),
      loadModuleByName: jest.fn().mockResolvedValue({
        success: true,
        module: { name: 'TestModule', version: '1.0.0' },
        tools: []
      }),
      loadAllModules: jest.fn().mockResolvedValue({
        loaded: [{ name: 'Module1' }, { name: 'Module2' }],
        failed: [],
        total: 2
      }),
      discoverAndLoad: jest.fn().mockResolvedValue({
        discovered: 5,
        loaded: [{ name: 'Module1' }],
        failed: []
      }),
      clearModule: jest.fn().mockResolvedValue({
        modulesDeleted: 1,
        toolsDeleted: 3
      }),
      clearAllModules: jest.fn().mockResolvedValue({
        modulesDeleted: 5,
        toolsDeleted: 20
      }),
      getStatistics: jest.fn().mockResolvedValue({
        modules: { count: 10, loaded: 8 },
        tools: { count: 50 }
      })
    };
    
    // Create mock module loader
    mockModuleLoader = {
      loadModule: jest.fn().mockResolvedValue({
        getName: () => 'TestModule',
        getTools: () => []
      }),
      moduleCache: new Map()
    };
    
    // Create module registry with mocks
    moduleRegistry = new ModuleRegistry({
      databaseOperations: mockDatabaseOperations,
      moduleLoader: mockModuleLoader
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    if (moduleRegistry) {
      moduleRegistry.clearCache();
    }
  });
  
  describe('constructor', () => {
    it('should create a ModuleRegistry instance', () => {
      expect(moduleRegistry).toBeInstanceOf(ModuleRegistry);
    });
    
    it('should initialize with empty cache', () => {
      expect(moduleRegistry.getCache().size).toBe(0);
    });
    
    it('should accept options', () => {
      const registry = new ModuleRegistry({
        databaseOperations: mockDatabaseOperations,
        moduleLoader: mockModuleLoader,
        cacheEnabled: false,
        verbose: true
      });
      expect(registry.options.cacheEnabled).toBe(false);
      expect(registry.options.verbose).toBe(true);
    });
  });
  
  describe('getModule', () => {
    it('should get a module by name', async () => {
      const module = await moduleRegistry.getModule('TestModule');
      
      expect(module).toBeDefined();
      expect(module.getName()).toBe('TestModule');
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledWith('TestModule');
    });
    
    it('should cache loaded modules', async () => {
      const module1 = await moduleRegistry.getModule('TestModule');
      const module2 = await moduleRegistry.getModule('TestModule');
      
      expect(module1).toBe(module2); // Same instance
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledTimes(1);
    });
    
    it('should return null for non-existent modules', async () => {
      mockDatabaseOperations.loadModuleByName.mockResolvedValue({
        success: false,
        error: 'Module not found'
      });
      
      const module = await moduleRegistry.getModule('NonExistent');
      expect(module).toBeNull();
    });
    
    it('should bypass cache when forced', async () => {
      await moduleRegistry.getModule('TestModule');
      await moduleRegistry.getModule('TestModule', { forceReload: true });
      
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getModules', () => {
    it('should get multiple modules by names', async () => {
      const modules = await moduleRegistry.getModules(['Module1', 'Module2']);
      
      expect(modules).toHaveLength(2);
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledTimes(2);
    });
    
    it('should filter out failed modules', async () => {
      mockDatabaseOperations.loadModuleByName
        .mockResolvedValueOnce({ success: true, module: { name: 'Module1' } })
        .mockResolvedValueOnce({ success: false, error: 'Failed' });
      
      const modules = await moduleRegistry.getModules(['Module1', 'Module2']);
      
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('Module1');
    });
  });
  
  describe('getAllModules', () => {
    it('should get all loaded modules', async () => {
      await moduleRegistry.loadAll();
      const modules = await moduleRegistry.getAllModules();
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
    });
    
    it('should return empty array if no modules loaded', async () => {
      const modules = await moduleRegistry.getAllModules();
      
      expect(modules).toEqual([]);
    });
  });
  
  describe('findModules', () => {
    it('should find modules by pattern', async () => {
      // Pre-load some modules
      await moduleRegistry.getModule('TestModule');
      await moduleRegistry.getModule('CalculatorModule');
      
      const modules = await moduleRegistry.findModules(/.*Module$/);
      
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.every(m => m.getName().endsWith('Module'))).toBe(true);
    });
    
    it('should find modules by filter function', async () => {
      await moduleRegistry.loadAll();
      
      const modules = await moduleRegistry.findModules(
        module => module.version === '1.0.0'
      );
      
      expect(Array.isArray(modules)).toBe(true);
    });
  });
  
  describe('hasModule', () => {
    it('should check if module exists', async () => {
      await moduleRegistry.getModule('TestModule');
      
      const exists = await moduleRegistry.hasModule('TestModule');
      expect(exists).toBe(true);
    });
    
    it('should return false for non-existent modules', async () => {
      const exists = await moduleRegistry.hasModule('NonExistent');
      expect(exists).toBe(false);
    });
  });
  
  describe('loadAll', () => {
    it('should load all modules from database', async () => {
      const result = await moduleRegistry.loadAll();
      
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
      expect(mockDatabaseOperations.loadAllModules).toHaveBeenCalled();
    });
    
    it('should update cache with loaded modules', async () => {
      await moduleRegistry.loadAll();
      
      const cacheSize = moduleRegistry.getCache().size;
      expect(cacheSize).toBeGreaterThan(0);
    });
  });
  
  describe('discoverAndLoad', () => {
    it('should discover and load modules', async () => {
      const result = await moduleRegistry.discoverAndLoad();
      
      expect(result).toHaveProperty('discovered');
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(mockDatabaseOperations.discoverAndLoad).toHaveBeenCalled();
    });
    
    it('should discover modules in specific directory', async () => {
      const result = await moduleRegistry.discoverAndLoad('/test/path');
      
      expect(mockDatabaseOperations.discoverAndLoad).toHaveBeenCalledWith('/test/path');
    });
  });
  
  describe('reloadModule', () => {
    it('should reload a specific module', async () => {
      await moduleRegistry.getModule('TestModule');
      
      const reloaded = await moduleRegistry.reloadModule('TestModule');
      
      expect(reloaded).toBeDefined();
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledTimes(2);
    });
    
    it('should clear module from cache before reloading', async () => {
      await moduleRegistry.getModule('TestModule');
      const cacheSize1 = moduleRegistry.getCache().size;
      
      await moduleRegistry.reloadModule('TestModule');
      const cacheSize2 = moduleRegistry.getCache().size;
      
      expect(cacheSize2).toBe(cacheSize1); // Same size but reloaded
    });
  });
  
  describe('unloadModule', () => {
    it('should unload a module from registry', async () => {
      await moduleRegistry.getModule('TestModule');
      
      const unloaded = await moduleRegistry.unloadModule('TestModule');
      
      expect(unloaded).toBe(true);
      expect(moduleRegistry.getCache().has('TestModule')).toBe(false);
    });
    
    it('should return false for non-existent modules', async () => {
      const unloaded = await moduleRegistry.unloadModule('NonExistent');
      
      expect(unloaded).toBe(false);
    });
  });
  
  describe('clearModule', () => {
    it('should clear module from database and cache', async () => {
      await moduleRegistry.getModule('TestModule');
      
      const result = await moduleRegistry.clearModule('TestModule');
      
      expect(result.modulesDeleted).toBe(1);
      expect(moduleRegistry.getCache().has('TestModule')).toBe(false);
      expect(mockDatabaseOperations.clearModule).toHaveBeenCalledWith('TestModule');
    });
  });
  
  describe('clearAll', () => {
    it('should clear all modules from database and cache', async () => {
      await moduleRegistry.loadAll();
      
      const result = await moduleRegistry.clearAll();
      
      expect(result.modulesDeleted).toBeGreaterThan(0);
      expect(moduleRegistry.getCache().size).toBe(0);
      expect(mockDatabaseOperations.clearAllModules).toHaveBeenCalled();
    });
  });
  
  describe('getStatistics', () => {
    it('should return registry statistics', async () => {
      await moduleRegistry.loadAll();
      
      const stats = await moduleRegistry.getStatistics();
      
      expect(stats).toHaveProperty('database');
      expect(stats).toHaveProperty('cache');
      expect(stats.database).toHaveProperty('modules');
      expect(stats.database).toHaveProperty('tools');
      expect(stats.cache).toHaveProperty('size');
      expect(stats.cache).toHaveProperty('modules');
    });
  });
  
  describe('cache management', () => {
    it('should get cache contents', () => {
      const cache = moduleRegistry.getCache();
      
      expect(cache).toBeInstanceOf(Map);
    });
    
    it('should clear cache', async () => {
      await moduleRegistry.getModule('TestModule');
      expect(moduleRegistry.getCache().size).toBe(1);
      
      moduleRegistry.clearCache();
      expect(moduleRegistry.getCache().size).toBe(0);
    });
    
    it('should respect cache disabled option', async () => {
      const registry = new ModuleRegistry({
        cacheEnabled: false,
        databaseOperations: mockDatabaseOperations,
        moduleLoader: mockModuleLoader
      });
      
      await registry.getModule('TestModule');
      await registry.getModule('TestModule');
      
      expect(mockDatabaseOperations.loadModuleByName).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getModulesByPackage', () => {
    it('should get modules from specific package', async () => {
      mockDatabaseOperations.loadModulesFromPackage = jest.fn().mockResolvedValue({
        loaded: [{ name: 'Module1' }, { name: 'Module2' }],
        failed: [],
        total: 2
      });
      
      const modules = await moduleRegistry.getModulesByPackage('tools');
      
      expect(modules).toHaveLength(2);
    });
  });
  
  describe('getModuleMetadata', () => {
    it('should get module metadata without loading', async () => {
      mockDatabaseOperations.databaseStorage = {
        findModule: jest.fn().mockResolvedValue({
          name: 'TestModule',
          version: '1.0.0',
          description: 'Test module',
          packageName: 'test'
        })
      };
      
      const metadata = await moduleRegistry.getModuleMetadata('TestModule');
      
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('description');
    });
    
    it('should return null for non-existent modules', async () => {
      mockDatabaseOperations.databaseStorage = {
        findModule: jest.fn().mockResolvedValue(null)
      };
      
      const metadata = await moduleRegistry.getModuleMetadata('NonExistent');
      
      expect(metadata).toBeNull();
    });
  });
  
  describe('event handling', () => {
    it('should emit events on module load', async () => {
      const listener = jest.fn();
      moduleRegistry.on('module:loaded', listener);
      
      await moduleRegistry.getModule('TestModule');
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TestModule'
      }));
    });
    
    it('should emit events on module unload', async () => {
      const listener = jest.fn();
      moduleRegistry.on('module:unloaded', listener);
      
      await moduleRegistry.getModule('TestModule');
      await moduleRegistry.unloadModule('TestModule');
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TestModule'
      }));
    });
    
    it('should emit events on cache clear', () => {
      const listener = jest.fn();
      moduleRegistry.on('cache:cleared', listener);
      
      moduleRegistry.clearCache();
      
      expect(listener).toHaveBeenCalled();
    });
  });
});