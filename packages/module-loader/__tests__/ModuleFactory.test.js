import { jest } from '@jest/globals';
import { ModuleFactory } from '../src/ModuleFactory.js';
import ResourceManager from '../src/ResourceManager.js';
import { Module } from '../src/Module.js';

// Test modules
class SimpleModule extends Module {
  static dependencies = [];
  
  constructor() {
    super();
    this.name = 'simple';
    this.constructorCalled = true;
  }
}

class SingleDependencyModule extends Module {
  static dependencies = ['apiKey'];
  
  constructor({ apiKey }) {
    super();
    this.name = 'single_dep';
    this.apiKey = apiKey;
  }
}

class MultipleDependencyModule extends Module {
  static dependencies = ['database', 'logger', 'config'];
  
  constructor({ database, logger, config }) {
    super();
    this.name = 'multi_dep';
    this.database = database;
    this.logger = logger;
    this.config = config;
  }
}

describe('ModuleFactory', () => {
  let resourceManager;
  let moduleFactory;

  beforeEach(() => {
    resourceManager = new ResourceManager();
    moduleFactory = new ModuleFactory(resourceManager);
  });

  describe('constructor', () => {
    it('should initialize with ResourceManager', () => {
      expect(moduleFactory.resourceManager).toBe(resourceManager);
    });

    it('should throw if no ResourceManager provided', () => {
      expect(() => new ModuleFactory()).toThrow();
    });

    it('should throw if invalid ResourceManager provided', () => {
      expect(() => new ModuleFactory({})).toThrow();
    });
  });

  describe('createModule()', () => {
    describe('with no dependencies', () => {
      it('should create module without dependencies', () => {
        const module = moduleFactory.createModule(SimpleModule);
        
        expect(module).toBeInstanceOf(SimpleModule);
        expect(module.name).toBe('simple');
        expect(module.constructorCalled).toBe(true);
      });

      it('should handle module with undefined dependencies', () => {
        class NoDepsPropertyModule extends Module {
          // No static dependencies property
          constructor() {
            super();
            this.name = 'no_deps_property';
          }
        }

        const module = moduleFactory.createModule(NoDepsPropertyModule);
        expect(module).toBeInstanceOf(NoDepsPropertyModule);
        expect(module.name).toBe('no_deps_property');
      });
    });

    describe('with single dependency', () => {
      beforeEach(() => {
        resourceManager.register('apiKey', 'test-api-key-123');
      });

      it('should create module with resolved dependency', () => {
        const module = moduleFactory.createModule(SingleDependencyModule);
        
        expect(module).toBeInstanceOf(SingleDependencyModule);
        expect(module.name).toBe('single_dep');
        expect(module.apiKey).toBe('test-api-key-123');
      });

      it('should throw if dependency is missing', () => {
        const emptyResourceManager = new ResourceManager();
        const factory = new ModuleFactory(emptyResourceManager);
        
        expect(() => {
          factory.createModule(SingleDependencyModule);
        }).toThrow("Resource 'apiKey' not found");
      });
    });

    describe('with multiple dependencies', () => {
      beforeEach(() => {
        resourceManager.register('database', { connection: 'db://localhost' });
        resourceManager.register('logger', console.log);
        resourceManager.register('config', { debug: true, port: 3000 });
      });

      it('should create module with all dependencies resolved', () => {
        const module = moduleFactory.createModule(MultipleDependencyModule);
        
        expect(module).toBeInstanceOf(MultipleDependencyModule);
        expect(module.name).toBe('multi_dep');
        expect(module.database).toEqual({ connection: 'db://localhost' });
        expect(module.logger).toBe(console.log);
        expect(module.config).toEqual({ debug: true, port: 3000 });
      });

      it('should throw if any dependency is missing', () => {
        // Remove one dependency
        const partialResourceManager = new ResourceManager();
        partialResourceManager.register('database', {});
        partialResourceManager.register('logger', console.log);
        // 'config' is missing
        
        const factory = new ModuleFactory(partialResourceManager);
        
        expect(() => {
          factory.createModule(MultipleDependencyModule);
        }).toThrow("Resource 'config' not found");
      });

      it('should pass exact resource references', () => {
        const dbObject = { connection: 'test' };
        const logFunction = jest.fn();
        const configObject = { test: true };
        
        resourceManager.register('database', dbObject);
        resourceManager.register('logger', logFunction);
        resourceManager.register('config', configObject);
        
        const module = moduleFactory.createModule(MultipleDependencyModule);
        
        // Should be exact same references
        expect(module.database).toBe(dbObject);
        expect(module.logger).toBe(logFunction);
        expect(module.config).toBe(configObject);
      });
    });

    describe('error handling', () => {
      it('should provide helpful error message for missing dependency', () => {
        resourceManager.register('apiKey', 'test-key');
        resourceManager.register('database', {});
        // 'logger' and 'config' are missing
        
        expect(() => {
          moduleFactory.createModule(MultipleDependencyModule);
        }).toThrow("Resource 'logger' not found");
      });

      it('should handle null and undefined dependencies', () => {
        resourceManager.register('apiKey', null);
        
        const module = moduleFactory.createModule(SingleDependencyModule);
        expect(module.apiKey).toBe(null);
      });
    });
  });

  describe('createAllModules()', () => {
    beforeEach(() => {
      resourceManager.register('apiKey', 'test-key');
      resourceManager.register('database', {});
      resourceManager.register('logger', console.log);
      resourceManager.register('config', {});
    });

    it('should create multiple modules', () => {
      const moduleClasses = [SimpleModule, SingleDependencyModule, MultipleDependencyModule];
      const modules = moduleFactory.createAllModules(moduleClasses);
      
      expect(modules).toHaveLength(3);
      expect(modules[0]).toBeInstanceOf(SimpleModule);
      expect(modules[1]).toBeInstanceOf(SingleDependencyModule);
      expect(modules[2]).toBeInstanceOf(MultipleDependencyModule);
    });

    it('should handle empty array', () => {
      const modules = moduleFactory.createAllModules([]);
      expect(modules).toEqual([]);
    });

    it('should stop on first error', () => {
      const partialResourceManager = new ResourceManager();
      partialResourceManager.register('apiKey', 'test');
      // Missing dependencies for MultipleDependencyModule
      
      const factory = new ModuleFactory(partialResourceManager);
      const moduleClasses = [SimpleModule, SingleDependencyModule, MultipleDependencyModule];
      
      expect(() => {
        factory.createAllModules(moduleClasses);
      }).toThrow("Resource 'database' not found");
    });

    it('should create independent module instances', () => {
      const modules1 = moduleFactory.createAllModules([SimpleModule]);
      const modules2 = moduleFactory.createAllModules([SimpleModule]);
      
      expect(modules1[0]).not.toBe(modules2[0]);
    });
  });

  describe('edge cases', () => {
    it('should handle module with empty dependency name', () => {
      class WeirdDepsModule extends Module {
        static dependencies = [''];
        
        constructor(deps) {
          super();
          this.emptyDep = deps[''];
        }
      }
      
      resourceManager.register('', 'empty-name-value');
      const module = moduleFactory.createModule(WeirdDepsModule);
      expect(module.emptyDep).toBe('empty-name-value');
    });

    it('should handle module that throws in constructor', () => {
      class ThrowingModule extends Module {
        static dependencies = [];
        
        constructor() {
          super();
          throw new Error('Constructor error');
        }
      }
      
      expect(() => {
        moduleFactory.createModule(ThrowingModule);
      }).toThrow('Constructor error');
    });

    it('should preserve dependency object structure', () => {
      class ComplexDepsModule extends Module {
        static dependencies = ['complexResource'];
        
        constructor({ complexResource }) {
          super();
          this.resource = complexResource;
        }
      }
      
      const complexObject = {
        nested: {
          deep: {
            value: 'test'
          }
        },
        array: [1, 2, 3],
        fn: () => 'result'
      };
      
      resourceManager.register('complexResource', complexObject);
      const module = moduleFactory.createModule(ComplexDepsModule);
      
      expect(module.resource).toBe(complexObject);
      expect(module.resource.nested.deep.value).toBe('test');
      expect(module.resource.array).toEqual([1, 2, 3]);
      expect(module.resource.fn()).toBe('result');
    });
  });
});