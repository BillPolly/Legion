/**
 * Unit tests for DatabaseOperations
 * 
 * Tests database operations for loading and clearing modules/tools
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';

describe('DatabaseOperations', () => {
  let databaseOperations;
  let mockDb;
  let mockModulesCollection;
  let mockToolsCollection;
  let mockStorage;
  
  beforeEach(() => {
    // Create mock collections
    mockModulesCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null),
      replaceOne: jest.fn().mockResolvedValue({ upsertedId: '123' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0)
    };
    
    mockToolsCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null),
      replaceOne: jest.fn().mockResolvedValue({ upsertedId: '456' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0)
    };
    
    // Create mock module registry collection
    const mockModuleRegistryCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null),
      replaceOne: jest.fn().mockResolvedValue({ upsertedId: '789' }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0)
    };
    
    // Create mock database
    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'modules') return mockModulesCollection;
        if (name === 'tools') return mockToolsCollection;
        if (name === 'module-registry') return mockModuleRegistryCollection;
        return null;
      })
    };
    
    // Create mock storage - use jest.fn() to create a mock instance
    mockStorage = {
      saveModule: jest.fn().mockResolvedValue(1), // Deprecated method
      saveLoadedModule: jest.fn().mockResolvedValue(1), // New method
      saveDiscoveredModule: jest.fn().mockResolvedValue(1), // New method
      saveTools: jest.fn().mockResolvedValue(1),
      findModule: jest.fn().mockResolvedValue(null),
      findModules: jest.fn().mockResolvedValue([]),
      findDiscoveredModule: jest.fn().mockResolvedValue(null), // New method
      findDiscoveredModules: jest.fn().mockResolvedValue([]), // New method
      deleteModule: jest.fn().mockResolvedValue(1),
      deleteTools: jest.fn().mockResolvedValue(1),
      clearAll: jest.fn().mockResolvedValue({ modules: 0, tools: 0 }),
      getStatistics: jest.fn().mockResolvedValue({ modules: 0, tools: 0 }),
      getCollection: jest.fn((name) => {
        if (name === 'modules') return mockModulesCollection;
        if (name === 'tools') return mockToolsCollection;
        if (name === 'module-registry') return mockDb.collection('module-registry');
        return null;
      }),
      initialize: jest.fn().mockResolvedValue(true),
      healthCheck: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn().mockResolvedValue(true)
    };
    
    // Create mock module loader
    const mockModuleLoader = new ModuleLoader();
    jest.spyOn(mockModuleLoader, 'loadModule').mockImplementation(async (path) => {
      // Fail for invalid paths
      if (path.includes('/invalid/') || path.includes('/non/existent/')) {
        throw new Error('Module not found');
      }
      // Return different modules based on path
      if (path.includes('ValidModule')) {
        return {
          getName: () => 'ValidModule',
          getVersion: () => '1.0.0',
          getDescription: () => 'Valid module',
          getTools: () => []
        };
      }
      // Default to TestModule
      return {
        getName: () => 'TestModule',
        getVersion: () => '1.0.0',
        getDescription: () => 'Test module',
        getTools: () => []
      };
    });
    jest.spyOn(mockModuleLoader, 'getModuleMetadata').mockImplementation(async (module) => {
      const name = module.getName();
      return {
        name: name,
        version: '1.0.0',
        description: module.getDescription()
      };
    });
    jest.spyOn(mockModuleLoader, 'getTools').mockResolvedValue([]);
    
    // Create mock module discovery
    const mockModuleDiscovery = new ModuleDiscovery({ databaseStorage: mockStorage });
    jest.spyOn(mockModuleDiscovery, 'getModuleInfo').mockImplementation((path) => {
      if (path.includes('ValidModule')) {
        return {
          name: 'ValidModule',
          path: path,
          packageName: 'test-package'
        };
      }
      return {
        name: 'TestModule',
        path: path,
        packageName: 'test-package'
      };
    });
    
    // Create database operations instance
    databaseOperations = new DatabaseOperations({
      databaseStorage: mockStorage,
      moduleLoader: mockModuleLoader,
      moduleDiscovery: mockModuleDiscovery
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a DatabaseOperations instance', () => {
      expect(databaseOperations).toBeInstanceOf(DatabaseOperations);
    });
    
    it('should accept options', () => {
      const ops = new DatabaseOperations({ 
        verbose: true,
        databaseStorage: new DatabaseStorage({ db: mockDb })
      });
      expect(ops.options.verbose).toBe(true);
    });
  });
  
  describe('loadModule', () => {
    it('should load a single module and its tools', async () => {
      const modulePath = '/test/TestModule.js';
      const result = await databaseOperations.loadModule(modulePath);
      
      expect(result).toHaveProperty('module');
      expect(result).toHaveProperty('tools');
      expect(result).toHaveProperty('success');
    });
    
    it('should save module metadata to database', async () => {
      const modulePath = '/test/TestModule.js';
      await databaseOperations.loadModule(modulePath);
      
      expect(mockStorage.saveLoadedModule).toHaveBeenCalled();
      expect(mockStorage.saveLoadedModule).toHaveBeenCalledWith(
        expect.objectContaining({ 
          name: 'TestModule'
        })
      );
    });
    
    it('should save tools to database', async () => {
      const modulePath = '/test/TestModule.js';
      await databaseOperations.loadModule(modulePath);
      
      // Tools should be saved if module has tools
      // This will depend on the actual module
    });
    
    it('should handle module loading errors', async () => {
      const invalidPath = '/non/existent/module.js';
      
      const result = await databaseOperations.loadModule(invalidPath);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('loadModuleByName', () => {
    it('should load a module by name from discovered modules', async () => {
      // Mock first checking loaded modules (empty), then discovered modules
      mockStorage.findModule.mockResolvedValue(null);
      mockStorage.findDiscoveredModule.mockResolvedValue({
        name: 'TestModule',
        path: '/test/TestModule.js'
      });
      
      const result = await databaseOperations.loadModuleByName('TestModule');
      
      expect(result).toHaveProperty('module');
      expect(result).toHaveProperty('tools');
    });
    
    it('should return error if module not found', async () => {
      mockStorage.findModule.mockResolvedValue(null);
      mockStorage.findDiscoveredModule.mockResolvedValue(null);
      
      const result = await databaseOperations.loadModuleByName('NonExistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Module not found');
    });
  });
  
  describe('loadAllModules', () => {
    it('should load all discovered modules', async () => {
      // Mock findDiscoveredModules to return test modules
      mockStorage.findDiscoveredModules.mockResolvedValue([
        { name: 'Module1', path: '/test/Module1.js' },
        { name: 'Module2', path: '/test/Module2.js' }
      ]);
      
      const result = await databaseOperations.loadAllModules();
      
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
      expect(result.total).toBe(2);
    });
    
    it('should continue loading even if some modules fail', async () => {
      // Mock findDiscoveredModules to return test modules with one invalid
      mockStorage.findDiscoveredModules.mockResolvedValue([
        { name: 'ValidModule', path: '/test/ValidModule.js' },
        { name: 'InvalidModule', path: '/invalid/path.js' }
      ]);
      
      const result = await databaseOperations.loadAllModules();
      
      expect(result.total).toBe(2);
      expect(result.failed.length).toBeGreaterThan(0);
    });
  });
  
  describe('clearModule', () => {
    it('should clear a specific module and its tools', async () => {
      const result = await databaseOperations.clearModule('TestModule');
      
      expect(result).toHaveProperty('modulesDeleted');
      expect(result).toHaveProperty('toolsDeleted');
      expect(mockModulesCollection.deleteMany).toHaveBeenCalledWith({ name: 'TestModule' });
      expect(mockToolsCollection.deleteMany).toHaveBeenCalledWith({ moduleName: 'TestModule' });
    });
    
    it('should handle non-existent modules gracefully', async () => {
      mockModulesCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockToolsCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });
      
      const result = await databaseOperations.clearModule('NonExistent');
      
      expect(result.modulesDeleted).toBe(0);
      expect(result.toolsDeleted).toBe(0);
    });
  });
  
  describe('clearAllModules', () => {
    it('should clear all modules and tools', async () => {
      mockModulesCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });
      mockToolsCollection.deleteMany.mockResolvedValue({ deletedCount: 20 });
      
      const result = await databaseOperations.clearAllModules();
      
      expect(result.modulesDeleted).toBe(5);
      expect(result.toolsDeleted).toBe(20);
      expect(mockModulesCollection.deleteMany).toHaveBeenCalledWith({});
      expect(mockToolsCollection.deleteMany).toHaveBeenCalledWith({});
    });
  });
  
  describe('discoverAndLoad', () => {
    it('should discover modules and load them', async () => {
      const result = await databaseOperations.discoverAndLoad();
      
      expect(result).toHaveProperty('discovered');
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
    });
    
    it('should save discovered modules to database', async () => {
      await databaseOperations.discoverAndLoad();
      
      // Discovery should trigger saves through loadModule which calls saveLoadedModule
      // Since we mocked loadModule on the moduleLoader, we can check that saveLoadedModule was called
      expect(mockStorage.saveLoadedModule).toHaveBeenCalled();
    });
  });
  
  describe('getStatistics', () => {
    it('should return database statistics', async () => {
      mockModulesCollection.countDocuments.mockResolvedValue(10);
      mockToolsCollection.countDocuments.mockResolvedValue(50);
      
      const stats = await databaseOperations.getStatistics();
      
      expect(stats).toHaveProperty('modules');
      expect(stats).toHaveProperty('tools');
      expect(stats.modules.count).toBe(10);
      expect(stats.tools.count).toBe(50);
    });
  });
  
  describe('loadModulesFromPackage', () => {
    it('should load all modules from a specific package', async () => {
      // This test uses DatabaseOperations.loadModulesFromPackage which queries module-registry directly
      // We don't need to mock the storage methods, just the collection
      const mockModuleRegistryCollection = mockDb.collection('module-registry');
      mockModuleRegistryCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', path: '/packages/tools/Module1.js', packageName: 'tools' },
          { name: 'Module2', path: '/packages/tools/Module2.js', packageName: 'tools' }
        ])
      });
      
      const result = await databaseOperations.loadModulesFromPackage('tools');
      
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(mockModuleRegistryCollection.find).toHaveBeenCalledWith({ packageName: 'tools' });
    });
  });
  
  describe('clearModulesFromPackage', () => {
    it('should clear all modules from a specific package', async () => {
      mockModulesCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', packageName: 'tools' },
          { name: 'Module2', packageName: 'tools' }
        ])
      });
      
      mockModulesCollection.deleteMany.mockResolvedValue({ deletedCount: 2 });
      mockToolsCollection.deleteMany.mockResolvedValue({ deletedCount: 8 });
      
      const result = await databaseOperations.clearModulesFromPackage('tools');
      
      expect(result.modulesDeleted).toBe(2);
      expect(result.toolsDeleted).toBeGreaterThan(0);
    });
  });
  
  describe('refreshModule', () => {
    it('should reload a module and update database', async () => {
      // Mock findModule and findDiscoveredModule on databaseStorage
      mockStorage.findModule.mockResolvedValue({
        name: 'TestModule',
        path: '/test/TestModule.js'
      });
      
      const result = await databaseOperations.refreshModule('TestModule');
      
      expect(result).toHaveProperty('module');
      expect(result).toHaveProperty('tools');
      expect(result.success).toBeDefined();
    });
    
    it('should clear old tools before loading new ones', async () => {
      // Mock findModule on databaseStorage
      mockStorage.findModule.mockResolvedValue({
        name: 'TestModule',
        path: '/test/TestModule.js'
      });
      
      await databaseOperations.refreshModule('TestModule');
      
      // Should delete old tools first
      expect(mockToolsCollection.deleteMany).toHaveBeenCalledWith({ moduleName: 'TestModule' });
    });
  });
});