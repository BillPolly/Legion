import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import ResourceManager from '../../../module-loader/src/resources/ResourceManager.js';

describe('ModuleLoader', () => {
  let moduleLoader;

  beforeEach(() => {
    moduleLoader = new ModuleLoader();
  });

  describe('module management', () => {
    beforeEach(() => {
      // Set up test modules directly in the loader
      moduleLoader.modules.set('calculator', {
        name: 'calculator',
        className: 'CalculatorModule',
        dependencies: [],
        tools: [],
        functionCount: 2
      });
      
      moduleLoader.modules.set('file', {
        name: 'file',
        className: 'FileModule',
        dependencies: ['fs'],
        tools: [],
        functionCount: 2
      });
      
      // Mock module classes
      class MockCalculatorModule {
        constructor() {
          this.name = 'calculator';
        }
      }
      
      class MockFileModule {
        constructor() {
          this.name = 'file';
        }
      }
      
      moduleLoader.moduleClasses.set('calculator', MockCalculatorModule);
      moduleLoader.moduleClasses.set('file', MockFileModule);
    });

    it('should get all modules', () => {
      const modules = moduleLoader.getModules();
      
      expect(modules.size).toBe(2);
      expect(modules.has('calculator')).toBe(true);
      expect(modules.has('file')).toBe(true);
    });

    it('should get module info by name', () => {
      const module = moduleLoader.getModuleInfo('calculator');
      
      expect(module).toBeDefined();
      expect(module.name).toBe('calculator');
      expect(module.functionCount).toBe(2);
    });

    it('should return undefined for unknown module', () => {
      const module = moduleLoader.getModuleInfo('unknown');
      
      expect(module).toBeUndefined();
    });

    it('should get module classes', () => {
      const moduleClasses = moduleLoader.getModuleClasses();
      
      expect(moduleClasses.size).toBe(2);
      expect(moduleClasses.has('calculator')).toBe(true);
      expect(moduleClasses.has('file')).toBe(true);
    });

    it('should create module instance', () => {
      const instance = moduleLoader.createModuleInstance('calculator');
      
      expect(instance).toBeDefined();
      expect(instance.name).toBe('calculator');
    });

    it('should throw error for unknown module instance', () => {
      expect(() => moduleLoader.createModuleInstance('unknown'))
        .toThrow("Module 'unknown' not found");
    });

    it('should cache module instances', () => {
      const instance1 = moduleLoader.createModuleInstance('calculator');
      const instance2 = moduleLoader.createModuleInstance('calculator');
      
      expect(instance1).toBe(instance2);
    });

    it('should get all module instances', () => {
      // Create some instances first
      moduleLoader.createModuleInstance('calculator');
      moduleLoader.createModuleInstance('file');
      
      const instances = moduleLoader.getAllModuleInstances();
      
      expect(instances).toHaveLength(2);
      expect(instances[0].name).toBe('calculator');
      expect(instances[1].name).toBe('file');
    });
  });

  describe('setResourceManager', () => {
    it('should set resource manager', () => {
      const resourceManager = new ResourceManager();
      
      moduleLoader.setResourceManager(resourceManager);
      
      expect(moduleLoader.resourceManager).toBe(resourceManager);
      expect(moduleLoader.moduleFactory).toBeDefined();
    });
  });


  describe('loadModules', () => {
    it('should handle when no tools directory exists', async () => {
      // This will log warnings but should not throw
      await expect(moduleLoader.loadModules()).resolves.not.toThrow();
    });
  });
});