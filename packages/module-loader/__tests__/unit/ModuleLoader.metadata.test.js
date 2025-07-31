/**
 * Tests for ModuleLoader metadata methods
 */

import { jest } from '@jest/globals';
import { ModuleLoader } from '../../src/ModuleLoader.js';

// We'll test with direct instantiation instead of mocking the singleton

describe('ModuleLoader Metadata Methods', () => {
  let moduleLoader;
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock resource manager
    mockResourceManager = {
      initialized: true,
      initialize: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      findProjectRoot: jest.fn().mockReturnValue('/mock/project/root')
    };
    
    // Create module loader with mock resource manager
    moduleLoader = new ModuleLoader(mockResourceManager);
    
    // Mock the module factory
    mockModuleFactory = {
      createModule: jest.fn()
    };
    moduleLoader.moduleFactory = mockModuleFactory;
    moduleLoader._initialized = true;
  });

  describe('getModule', () => {
    it('should return loaded module by name', () => {
      // Arrange
      const mockModule = { name: 'testModule', getTools: jest.fn() };
      moduleLoader.loadedModules.set('testModule', mockModule);
      
      // Act
      const result = moduleLoader.getModule('testModule');
      
      // Assert
      expect(result).toBe(mockModule);
    });

    it('should return null for non-loaded module', () => {
      // Act
      const result = moduleLoader.getModule('nonExistentModule');
      
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getLoadedModuleNames', () => {
    it('should return array of loaded module names', () => {
      // Arrange
      moduleLoader.loadedModules.set('module1', {});
      moduleLoader.loadedModules.set('module2', {});
      moduleLoader.loadedModules.set('module3', {});
      
      // Act
      const result = moduleLoader.getLoadedModuleNames();
      
      // Assert
      expect(result).toEqual(['module1', 'module2', 'module3']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no modules loaded', () => {
      // Act
      const result = moduleLoader.getLoadedModuleNames();
      
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('hasModule', () => {
    it('should return true for loaded module', () => {
      // Arrange
      moduleLoader.loadedModules.set('testModule', {});
      
      // Act
      const result = moduleLoader.hasModule('testModule');
      
      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-loaded module', () => {
      // Act
      const result = moduleLoader.hasModule('nonExistentModule');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('integration with loadModuleByName', () => {
    it('should make module available via getModule after loading', async () => {
      // Arrange
      const mockModule = {
        name: 'TestModule',
        getTools: jest.fn().mockReturnValue([])
      };
      
      class TestModuleClass {}
      mockModuleFactory.createModule.mockResolvedValue(mockModule);
      
      // Act
      await moduleLoader.loadModuleByName('test-module', TestModuleClass);
      const retrievedModule = moduleLoader.getModule('test-module');
      
      // Assert
      expect(retrievedModule).toBe(mockModule);
      expect(moduleLoader.hasModule('test-module')).toBe(true);
      expect(moduleLoader.getLoadedModuleNames()).toContain('test-module');
    });
  });

  describe('clear method integration', () => {
    it('should remove modules from metadata tracking', () => {
      // Arrange
      moduleLoader.loadedModules.set('module1', {});
      moduleLoader.loadedModules.set('module2', {});
      moduleLoader.toolRegistry.set('tool1', {});
      
      // Act
      moduleLoader.clear();
      
      // Assert
      expect(moduleLoader.getModule('module1')).toBeNull();
      expect(moduleLoader.getModule('module2')).toBeNull();
      expect(moduleLoader.hasModule('module1')).toBe(false);
      expect(moduleLoader.hasModule('module2')).toBe(false);
      expect(moduleLoader.getLoadedModuleNames()).toEqual([]);
    });
  });
});