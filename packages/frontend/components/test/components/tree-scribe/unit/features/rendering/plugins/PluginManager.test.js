/**
 * PluginManager Tests
 * 
 * Testing plugin registration, loading, isolation, and lifecycle management
 */

import { PluginManager } from '../../../../../../src/components/tree-scribe/features/rendering/plugins/PluginManager.js';

describe('PluginManager', () => {
  let pluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  afterEach(() => {
    if (pluginManager && !pluginManager.destroyed) {
      pluginManager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(pluginManager.destroyed).toBe(false);
      expect(pluginManager.options.allowDynamicImport).toBe(true);
      expect(pluginManager.options.sandboxPlugins).toBe(true);
      expect(pluginManager.options.validatePlugins).toBe(true);
      expect(pluginManager.options.maxLoadTime).toBe(5000);
      expect(pluginManager.options.retryAttempts).toBe(2);
    });

    test('should accept custom options', () => {
      const customManager = new PluginManager({
        allowDynamicImport: false,
        sandboxPlugins: false,
        maxLoadTime: 3000,
        retryAttempts: 1
      });

      expect(customManager.options.allowDynamicImport).toBe(false);
      expect(customManager.options.sandboxPlugins).toBe(false);
      expect(customManager.options.maxLoadTime).toBe(3000);
      expect(customManager.options.retryAttempts).toBe(1);

      customManager.destroy();
    });

    test('should create security sandbox', () => {
      expect(pluginManager.sandbox).toBeDefined();
      expect(pluginManager.sandbox.console).toBeDefined();
      expect(pluginManager.sandbox.setTimeout).toBeDefined();
      expect(pluginManager.sandbox.eval).toBeNull();
      expect(pluginManager.sandbox.Function).toBeNull();
    });
  });

  describe('Plugin Registration', () => {
    test('should register valid plugin', async () => {
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'MockPlugin', version: '1.0.0' })
      };

      const result = await pluginManager.registerPlugin('mock-plugin', mockPlugin, {
        type: 'renderer'
      });

      expect(result.success).toBe(true);
      expect(result.instance).toBeDefined();
      expect(pluginManager.hasPlugin('mock-plugin')).toBe(true);
    });

    test('should reject invalid plugin ID', async () => {
      const result = await pluginManager.registerPlugin('', {}, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin ID');
    });

    test('should reject duplicate registration', async () => {
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'MockPlugin' })
      };

      await pluginManager.registerPlugin('duplicate', mockPlugin);
      const result = await pluginManager.registerPlugin('duplicate', mockPlugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    test('should validate plugin structure', async () => {
      const invalidPlugin = {
        // Missing required methods
        someMethod: () => {}
      };

      const result = await pluginManager.registerPlugin('invalid', invalidPlugin, {
        type: 'renderer'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing required method');
    });

    test('should skip validation when disabled', async () => {
      const customManager = new PluginManager({ validatePlugins: false });
      
      const invalidPlugin = {
        someMethod: () => {}
      };

      const result = await customManager.registerPlugin('invalid', invalidPlugin);
      expect(result.success).toBe(true);

      customManager.destroy();
    });

    test('should initialize class-based plugins', async () => {
      class TestPlugin {
        constructor(context) {
          this.context = context;
          this.initialized = true;
        }
        
        render() { return 'rendered'; }
        getInfo() { return { name: 'TestPlugin' }; }
      }

      const result = await pluginManager.registerPlugin('test-class', TestPlugin, {
        type: 'renderer'
      });

      expect(result.success).toBe(true);
      expect(result.instance).toBeInstanceOf(TestPlugin);
      expect(result.instance.initialized).toBe(true);
      expect(result.instance.context).toBeDefined();
    });

    test('should call init method if present', async () => {
      let initCalled = false;
      const pluginWithInit = {
        init: async (context) => {
          initCalled = true;
          expect(context).toBeDefined();
        },
        render: () => {},
        getInfo: () => ({ name: 'InitPlugin' })
      };

      const result = await pluginManager.registerPlugin('init-plugin', pluginWithInit, {
        type: 'renderer'
      });

      expect(result.success).toBe(true);
      expect(initCalled).toBe(true);
    });

    test('should store plugin metadata', async () => {
      const metadata = {
        type: 'renderer',
        version: '2.0.0',
        author: 'Test Author',
        dependencies: ['dep1', 'dep2']
      };

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'MetaPlugin' })
      };

      await pluginManager.registerPlugin('meta-plugin', mockPlugin, metadata);

      const storedMetadata = pluginManager.pluginMetadata.get('meta-plugin');
      expect(storedMetadata.version).toBe('2.0.0');
      expect(storedMetadata.author).toBe('Test Author');
      expect(storedMetadata.dependencies).toEqual(['dep1', 'dep2']);
      expect(storedMetadata.registeredAt).toBeDefined();
    });
  });

  describe('Plugin Lifecycle Hooks', () => {
    test('should call lifecycle hooks', async () => {
      const hooks = {
        beforeLoad: false,
        afterLoad: false,
        beforeUnload: false,
        afterUnload: false
      };

      pluginManager.addLifecycleHook('beforeLoad', async ({ pluginId }) => {
        expect(pluginId).toBe('lifecycle-test');
        hooks.beforeLoad = true;
      });

      pluginManager.addLifecycleHook('afterLoad', async ({ pluginId, instance }) => {
        expect(pluginId).toBe('lifecycle-test');
        expect(instance).toBeDefined();
        hooks.afterLoad = true;
      });

      pluginManager.addLifecycleHook('beforeUnload', async ({ pluginId }) => {
        expect(pluginId).toBe('lifecycle-test');
        hooks.beforeUnload = true;
      });

      pluginManager.addLifecycleHook('afterUnload', async ({ pluginId }) => {
        expect(pluginId).toBe('lifecycle-test');
        hooks.afterUnload = true;
      });

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'LifecyclePlugin' })
      };

      // Register plugin
      await pluginManager.registerPlugin('lifecycle-test', mockPlugin, {
        type: 'renderer'
      });

      expect(hooks.beforeLoad).toBe(true);
      expect(hooks.afterLoad).toBe(true);

      // Unregister plugin
      await pluginManager.unregisterPlugin('lifecycle-test');

      expect(hooks.beforeUnload).toBe(true);
      expect(hooks.afterUnload).toBe(true);
    });

    test('should handle lifecycle hook errors', async () => {
      pluginManager.addLifecycleHook('beforeLoad', async () => {
        throw new Error('Hook error');
      });

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'ErrorPlugin' })
      };

      // Should not throw
      const result = await pluginManager.registerPlugin('error-plugin', mockPlugin, {
        type: 'renderer'
      });

      expect(result.success).toBe(true);
    });

    test('should remove lifecycle hooks', () => {
      const hook = async () => {};
      
      const added = pluginManager.addLifecycleHook('beforeLoad', hook);
      expect(added).toBe(true);

      const removed = pluginManager.removeLifecycleHook('beforeLoad', hook);
      expect(removed).toBe(true);

      const removedAgain = pluginManager.removeLifecycleHook('beforeLoad', hook);
      expect(removedAgain).toBe(false);
    });
  });

  describe('Plugin Unregistration', () => {
    test('should unregister plugin', async () => {
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'UnregisterPlugin' }),
        destroy: async () => {}
      };

      await pluginManager.registerPlugin('unregister-test', mockPlugin);
      expect(pluginManager.hasPlugin('unregister-test')).toBe(true);

      const result = await pluginManager.unregisterPlugin('unregister-test');
      expect(result.success).toBe(true);
      expect(pluginManager.hasPlugin('unregister-test')).toBe(false);
    });

    test('should call plugin destroy method', async () => {
      let destroyCalled = false;
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'DestroyPlugin' }),
        destroy: async () => {
          destroyCalled = true;
        }
      };

      await pluginManager.registerPlugin('destroy-test', mockPlugin);
      await pluginManager.unregisterPlugin('destroy-test');

      expect(destroyCalled).toBe(true);
    });

    test('should handle missing plugin gracefully', async () => {
      const result = await pluginManager.unregisterPlugin('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should emit unregistration event', async () => {
      let eventData = null;
      pluginManager.on('pluginUnregistered', (data) => {
        eventData = data;
      });

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'EventPlugin' })
      };

      await pluginManager.registerPlugin('event-test', mockPlugin);
      await pluginManager.unregisterPlugin('event-test');

      expect(eventData).toBeDefined();
      expect(eventData.pluginId).toBe('event-test');
    });
  });

  describe('Plugin Retrieval', () => {
    beforeEach(async () => {
      // Register test plugins
      await pluginManager.registerPlugin('renderer1', {
        render: () => {},
        getInfo: () => ({ name: 'Renderer1' })
      }, { type: 'renderer' });

      await pluginManager.registerPlugin('renderer2', {
        render: () => {},
        getInfo: () => ({ name: 'Renderer2' })
      }, { type: 'renderer' });

      await pluginManager.registerPlugin('processor1', {
        process: () => {},
        getInfo: () => ({ name: 'Processor1' })
      }, { type: 'processor' });
    });

    test('should get plugin by ID', () => {
      const plugin = pluginManager.getPlugin('renderer1');
      expect(plugin).toBeDefined();
      expect(plugin.getInfo().name).toBe('Renderer1');
    });

    test('should get all plugins', () => {
      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins.length).toBe(3);
      expect(allPlugins[0]).toHaveProperty('id');
      expect(allPlugins[0]).toHaveProperty('plugin');
      expect(allPlugins[0]).toHaveProperty('metadata');
    });

    test('should get plugins by type', () => {
      const renderers = pluginManager.getPluginsByType('renderer');
      expect(renderers.length).toBe(2);
      expect(renderers.every(p => p.metadata.type === 'renderer')).toBe(true);

      const processors = pluginManager.getPluginsByType('processor');
      expect(processors.length).toBe(1);
      expect(processors[0].metadata.type).toBe('processor');
    });

    test('should check if plugin exists', () => {
      expect(pluginManager.hasPlugin('renderer1')).toBe(true);
      expect(pluginManager.hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('Plugin Method Execution', () => {
    test('should execute plugin method', async () => {
      const mockPlugin = {
        testMethod: (arg1, arg2) => {
          return `${arg1}-${arg2}`;
        },
        render: () => {},
        getInfo: () => ({ name: 'ExecPlugin' })
      };

      await pluginManager.registerPlugin('exec-test', mockPlugin);

      const result = await pluginManager.executePluginMethod('exec-test', 'testMethod', 'hello', 'world');
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello-world');
    });

    test('should handle method execution errors', async () => {
      const mockPlugin = {
        errorMethod: () => {
          throw new Error('Method error');
        },
        render: () => {},
        getInfo: () => ({ name: 'ErrorPlugin' })
      };

      await pluginManager.registerPlugin('error-test', mockPlugin);

      const result = await pluginManager.executePluginMethod('error-test', 'errorMethod');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Method error');
    });

    test('should handle missing method', async () => {
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'MissingPlugin' })
      };

      await pluginManager.registerPlugin('missing-test', mockPlugin);

      const result = await pluginManager.executePluginMethod('missing-test', 'nonExistentMethod');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Method nonExistentMethod not found');
    });

    test('should handle missing plugin', async () => {
      const result = await pluginManager.executePluginMethod('non-existent', 'anyMethod');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Plugin non-existent not found');
    });
  });

  describe('Dependency Validation', () => {
    test('should validate dependencies', async () => {
      await pluginManager.registerPlugin('dep1', {
        render: () => {},
        getInfo: () => ({ name: 'Dep1' })
      });

      await pluginManager.registerPlugin('main-plugin', {
        render: () => {},
        getInfo: () => ({ name: 'MainPlugin' })
      }, {
        dependencies: ['dep1', 'dep2']
      });

      const validation = pluginManager.validateDependencies('main-plugin');
      expect(validation.valid).toBe(false);
      expect(validation.missing).toEqual(['dep2']);
    });

    test('should pass validation when all dependencies present', async () => {
      await pluginManager.registerPlugin('dep1', {
        render: () => {},
        getInfo: () => ({ name: 'Dep1' })
      });

      await pluginManager.registerPlugin('dep2', {
        render: () => {},
        getInfo: () => ({ name: 'Dep2' })
      });

      await pluginManager.registerPlugin('main-plugin', {
        render: () => {},
        getInfo: () => ({ name: 'MainPlugin' })
      }, {
        dependencies: ['dep1', 'dep2']
      });

      const validation = pluginManager.validateDependencies('main-plugin');
      expect(validation.valid).toBe(true);
      expect(validation.missing).toEqual([]);
    });

    test('should handle missing plugin in validation', () => {
      const validation = pluginManager.validateDependencies('non-existent');
      // When plugin doesn't exist but has no dependencies, it's valid
      expect(validation.valid).toBe(true);
      expect(validation.missing).toEqual([]);
    });
  });

  describe('Dynamic Loading', () => {
    test('should reject dynamic import when disabled', async () => {
      const customManager = new PluginManager({ allowDynamicImport: false });
      
      const result = await customManager.loadPlugin('./test-plugin.js');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dynamic import not allowed');

      customManager.destroy();
    });

    test('should handle concurrent loading of same plugin', async () => {
      // Mock the _loadPluginAsync method instead of global import
      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'DynamicPlugin' })
      };

      let loadCount = 0;
      pluginManager._loadPluginAsync = async (path, pluginId, metadata) => {
        loadCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          instance: mockPlugin
        };
      };

      // Start multiple loads concurrently
      const load1 = pluginManager.loadPlugin('./test-plugin.js', { id: 'dynamic1' });
      const load2 = pluginManager.loadPlugin('./test-plugin.js', { id: 'dynamic1' });
      
      // Should be the same promise
      expect(pluginManager.loadingPlugins.size).toBe(1);

      const [result1, result2] = await Promise.all([load1, load2]);
      
      // Both should be the same promise result
      expect(result1).toBe(result2);
      // Should only load once
      expect(loadCount).toBe(1);
      expect(pluginManager.loadingPlugins.size).toBe(0);
    });
  });

  describe('Events', () => {
    test('should emit and handle events', async () => {
      const events = [];
      
      const unsubscribe = pluginManager.on('pluginRegistered', (data) => {
        events.push({ type: 'registered', data });
      });

      pluginManager.on('pluginError', (data) => {
        events.push({ type: 'error', data });
      });

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'EventPlugin' })
      };

      await pluginManager.registerPlugin('event-test', mockPlugin);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('registered');
      expect(events[0].data.pluginId).toBe('event-test');

      // Test unsubscribe
      unsubscribe();
      await pluginManager.registerPlugin('event-test2', mockPlugin);
      expect(events.length).toBe(1); // Should not increase
    });

    test('should handle event listener errors', async () => {
      pluginManager.on('pluginRegistered', () => {
        throw new Error('Listener error');
      });

      const mockPlugin = {
        render: () => {},
        getInfo: () => ({ name: 'ErrorPlugin' })
      };

      // Should not throw
      const result = await pluginManager.registerPlugin('listener-error', mockPlugin);
      expect(result.success).toBe(true);
    });
  });

  describe('Information', () => {
    test('should provide plugin manager info', async () => {
      await pluginManager.registerPlugin('info-test', {
        render: () => {},
        getInfo: () => ({ name: 'InfoPlugin' })
      });

      const info = pluginManager.getInfo();
      
      expect(info.name).toBe('PluginManager');
      expect(info.version).toBeDefined();
      expect(info.pluginCount).toBe(1);
      expect(info.loadingCount).toBe(0);
      expect(info.options).toBeDefined();
      expect(info.destroyed).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should destroy all plugins on destroy', async () => {
      let plugin1Destroyed = false;
      let plugin2Destroyed = false;

      await pluginManager.registerPlugin('destroy1', {
        render: () => {},
        getInfo: () => ({ name: 'Destroy1' }),
        destroy: async () => { plugin1Destroyed = true; }
      });

      await pluginManager.registerPlugin('destroy2', {
        render: () => {},
        getInfo: () => ({ name: 'Destroy2' }),
        destroy: async () => { plugin2Destroyed = true; }
      });

      expect(pluginManager.plugins.size).toBe(2);

      await pluginManager.destroy();

      expect(plugin1Destroyed).toBe(true);
      expect(plugin2Destroyed).toBe(true);
      expect(pluginManager.plugins.size).toBe(0);
      expect(pluginManager.destroyed).toBe(true);
    });

    test('should be safe to call destroy multiple times', async () => {
      await expect(async () => {
        await pluginManager.destroy();
        await pluginManager.destroy();
        await pluginManager.destroy();
      }).not.toThrow();
    });

    test('should reject operations after destroy', async () => {
      await pluginManager.destroy();

      const result = await pluginManager.registerPlugin('after-destroy', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');

      expect(pluginManager.getPlugin('test')).toBeNull();
      expect(pluginManager.getAllPlugins()).toEqual([]);
      expect(pluginManager.hasPlugin('test')).toBe(false);
    });
  });
});