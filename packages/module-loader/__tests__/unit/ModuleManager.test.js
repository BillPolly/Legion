import { jest } from '@jest/globals';
import { ModuleManager } from '../../src/module/ModuleManager.js';
import { ModuleFactory } from '../../src/module/ModuleFactory.js';
import ResourceManager from '../../src/resources/ResourceManager.js';
import { Module } from '../../src/module/Module.js';

// Mock module for testing
class TestModule extends Module {
  static dependencies = ['testDep'];
  
  constructor(dependencies) {
    super();
    this.dependencies = dependencies;
    this.name = 'test-module';
  }
  
  getTools() {
    return [{
      name: 'test-tool',
      description: 'Test tool'
    }];
  }
}

describe('ModuleManager', () => {
  let moduleManager;
  let moduleFactory;
  let resourceManager;

  beforeEach(() => {
    resourceManager = new ResourceManager();
    resourceManager.register('testDep', 'test-value');
    moduleFactory = new ModuleFactory(resourceManager);
    moduleManager = new ModuleManager(moduleFactory);
  });

  describe('constructor', () => {
    it('should create ModuleManager with ModuleFactory', () => {
      expect(moduleManager).toBeDefined();
      expect(moduleManager.moduleFactory).toBe(moduleFactory);
      expect(moduleManager.registry).toBeDefined();
      expect(moduleManager.jsonLoader).toBeDefined();
    });

    it('should throw error without ModuleFactory', () => {
      expect(() => new ModuleManager()).toThrow('ModuleFactory instance is required');
    });
  });

  describe('registry operations', () => {
    it('should track loaded modules in registry', async () => {
      // Create and register a test module
      const module = new TestModule({ testDep: 'value' });
      moduleManager.registry.register('test-module', {
        name: 'test-module',
        path: '/test/path',
        type: 'class'
      }, module);

      expect(moduleManager.isModuleLoaded('test-module')).toBe(true);
      expect(moduleManager.getLoadedModules()).toHaveLength(1);
    });

    it('should unload modules', async () => {
      // Create and register a test module
      const module = new TestModule({ testDep: 'value' });
      moduleManager.registry.register('test-module', {
        name: 'test-module',
        path: '/test/path',
        type: 'class'
      }, module);

      const unloaded = await moduleManager.unloadModule('test-module');
      expect(unloaded).toBe(true);
      expect(moduleManager.isModuleLoaded('test-module')).toBe(false);
    });
  });

  describe('module information', () => {
    it('should get module info for loaded module', () => {
      const module = new TestModule({ testDep: 'value' });
      moduleManager.registry.register('test-module', {
        name: 'test-module',
        path: '/test/path',
        type: 'class'
      }, module);

      const info = moduleManager.getModuleInfo('test-module');
      expect(info).toBeDefined();
      expect(info.name).toBe('test-module');
      expect(info.hasInstance).toBe(true);
      expect(info.tools).toHaveLength(1);
      expect(info.tools[0]).toHaveProperty('name', 'test-tool');
      expect(info.tools[0]).toHaveProperty('description', 'Test tool');
      expect(info.tools[0]).toHaveProperty('type', 'loaded');
    });

    it('should return null for unknown module', () => {
      const info = moduleManager.getModuleInfo('unknown');
      expect(info).toBeNull();
    });
  });

  describe('event emission', () => {
    it('should emit events during module operations', async () => {
      const events = [];
      moduleManager.on('loaded', event => events.push({ type: 'loaded', ...event }));
      moduleManager.on('unloaded', event => events.push({ type: 'unloaded', ...event }));

      // Register a module
      const module = new TestModule({ testDep: 'value' });
      moduleManager.registry.register('test-module', {
        name: 'test-module',
        path: '/test/path',
        type: 'class'
      }, module);

      moduleManager.emit('loaded', {
        name: 'test-module',
        type: 'loaded',
        path: '/test/path'
      });

      await moduleManager.unloadModule('test-module');

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'loaded',
        name: 'test-module',
        path: '/test/path'
      });
      expect(events[1]).toMatchObject({
        type: 'unloaded',
        name: 'test-module'
      });
    });
  });

  describe('statistics', () => {
    it('should provide manager statistics', () => {
      const module = new TestModule({ testDep: 'value' });
      moduleManager.registry.register('test-module', {
        name: 'test-module',
        path: '/test/path',
        type: 'class'
      }, module);

      moduleManager.discoveredModules.set('another-module', {
        name: 'another-module',
        path: '/another/path'
      });

      const stats = moduleManager.getStats();
      expect(stats.totalLoaded).toBe(1);
      expect(stats.totalDiscovered).toBe(1);
      expect(stats.totalAvailable).toBe(2);
    });
  });
});