/**
 * Tests for PlanToolRegistry metadata methods
 */

import { jest } from '@jest/globals';
import { PlanToolRegistry } from '../../core/PlanToolRegistry.js';

describe('PlanToolRegistry Metadata Methods', () => {
  let registry;
  let mockModuleLoader;
  let mockPlanAnalyzer;

  beforeEach(() => {
    // Create mock module loader
    mockModuleLoader = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getModule: jest.fn(),
      hasModule: jest.fn(),
      getLoadedModuleNames: jest.fn(),
      loadModuleFromJson: jest.fn(),
      loadModuleByName: jest.fn(),
      getTool: jest.fn(),
      hasTool: jest.fn(),
      getToolNames: jest.fn().mockReturnValue([]),
      toolRegistry: new Map(),
      resourceManager: {
        findProjectRoot: jest.fn().mockReturnValue('/mock/project/root')
      }
    };

    // Create mock plan analyzer
    mockPlanAnalyzer = {
      analyzePlan: jest.fn().mockReturnValue({ requiredModules: [], requiredTools: [] }),
      findMissingTools: jest.fn().mockReturnValue([]),
      getEssentialModules: jest.fn().mockReturnValue([])
    };

    // Create registry with mocks
    registry = new PlanToolRegistry({
      moduleLoader: mockModuleLoader,
      planAnalyzer: mockPlanAnalyzer
    });
  });

  describe('isModuleAvailable', () => {
    it('should return true when module exists in registry', async () => {
      // Arrange
      registry.moduleRegistry = {
        modules: {
          'test-module': { type: 'json', path: 'path/to/module.json' },
          'another-module': { type: 'class', path: 'path/to/module.js' }
        }
      };

      // Act & Assert
      expect(registry.isModuleAvailable('test-module')).toBe(true);
      expect(registry.isModuleAvailable('another-module')).toBe(true);
    });

    it('should return false when module does not exist', async () => {
      // Arrange
      registry.moduleRegistry = {
        modules: {
          'test-module': { type: 'json', path: 'path/to/module.json' }
        }
      };

      // Act & Assert
      expect(registry.isModuleAvailable('non-existent')).toBe(false);
    });

    it('should return false when moduleRegistry is null', () => {
      // Arrange
      registry.moduleRegistry = null;

      // Act & Assert
      expect(registry.isModuleAvailable('any-module')).toBe(false);
    });
  });

  describe('getAvailableModules', () => {
    it('should return all module names from registry', () => {
      // Arrange
      registry.moduleRegistry = {
        modules: {
          'module1': {},
          'module2': {},
          'module3': {}
        }
      };

      // Act
      const modules = registry.getAvailableModules();

      // Assert
      expect(modules).toEqual(['module1', 'module2', 'module3']);
      expect(modules).toHaveLength(3);
    });

    it('should return empty array when no modules', () => {
      // Arrange
      registry.moduleRegistry = { modules: {} };

      // Act
      const modules = registry.getAvailableModules();

      // Assert
      expect(modules).toEqual([]);
    });

    it('should return empty array when moduleRegistry is null', () => {
      // Arrange
      registry.moduleRegistry = null;

      // Act
      const modules = registry.getAvailableModules();

      // Assert
      expect(modules).toEqual([]);
    });
  });

  describe('getModuleToolMetadata', () => {
    it('should return tool metadata for loaded module', async () => {
      // Arrange
      const mockTools = [
        { name: 'tool1', description: 'Tool 1 description' },
        { name: 'tool2', description: 'Tool 2 description' }
      ];
      
      const mockModule = {
        getTools: jest.fn().mockReturnValue(mockTools)
      };
      
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      registry.moduleRegistry = {
        modules: {
          'test-module': { type: 'json', path: 'path/to/module.json' }
        }
      };

      // Mock loadModule to succeed
      jest.spyOn(registry, 'loadModule').mockResolvedValue(mockModule);

      // Act
      const metadata = await registry.getModuleToolMetadata('test-module');

      // Assert
      expect(metadata).toEqual([
        { name: 'tool1', description: 'Tool 1 description', module: 'test-module' },
        { name: 'tool2', description: 'Tool 2 description', module: 'test-module' }
      ]);
    });

    it('should return empty array when module has no getTools method', async () => {
      // Arrange
      const mockModule = {}; // No getTools method
      
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      jest.spyOn(registry, 'loadModule').mockResolvedValue(mockModule);

      // Act
      const metadata = await registry.getModuleToolMetadata('test-module');

      // Assert
      expect(metadata).toEqual([]);
    });

    it('should return empty array and log warning when module load fails', async () => {
      // Arrange
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(registry, 'loadModule').mockRejectedValue(new Error('Load failed'));

      // Act
      const metadata = await registry.getModuleToolMetadata('test-module');

      // Assert
      expect(metadata).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Could not get tool metadata for test-module: Load failed'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('hasTool with tool availability', () => {
    it('should check tool availability through moduleLoader', () => {
      // Arrange
      mockModuleLoader.hasTool.mockReturnValue(true);

      // Act
      const result = registry.hasTool('test-tool');

      // Assert
      expect(result).toBe(true);
      expect(mockModuleLoader.hasTool).toHaveBeenCalledWith('test-tool');
    });

    it('should return false when tool not available', () => {
      // Arrange
      mockModuleLoader.hasTool.mockReturnValue(false);

      // Act
      const result = registry.hasTool('non-existent-tool');

      // Assert
      expect(result).toBe(false);
      expect(mockModuleLoader.hasTool).toHaveBeenCalledWith('non-existent-tool');
    });
  });

  describe('loadModule', () => {
    it('should initialize, load module, and return it', async () => {
      // Arrange
      const mockModule = { name: 'TestModule' };
      mockModuleLoader.getModule.mockReturnValue(mockModule);
      
      registry.moduleRegistry = {
        modules: {
          'test-module': { type: 'json', path: 'path/to/module.json' }
        }
      };
      
      jest.spyOn(registry, 'initialize').mockResolvedValue(undefined);
      jest.spyOn(registry, '_loadModuleByName').mockResolvedValue(undefined);

      // Act
      const result = await registry.loadModule('test-module');

      // Assert
      expect(registry.initialize).toHaveBeenCalled();
      expect(registry._loadModuleByName).toHaveBeenCalledWith('test-module');
      expect(mockModuleLoader.getModule).toHaveBeenCalledWith('test-module');
      expect(result).toBe(mockModule);
    });
  });
});