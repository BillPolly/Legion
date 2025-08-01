/**
 * EnhancedRendererRegistry Tests
 * 
 * Testing enhanced registry with plugin support
 */

import { EnhancedRendererRegistry } from '../../../../../../src/components/tree-scribe/features/rendering/EnhancedRendererRegistry.js';
import { JsonRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/plugins/JsonRenderer.plugin.js';

describe('EnhancedRendererRegistry', () => {
  let registry;

  beforeEach(() => {
    // Clear singleton instance
    EnhancedRendererRegistry.instance = null;
    registry = new EnhancedRendererRegistry();
  });

  afterEach(async () => {
    if (registry) {
      await registry.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with plugin manager', () => {
      expect(registry.pluginManager).toBeDefined();
      expect(registry.pluginRenderers).toBeInstanceOf(Map);
      expect(registry.pendingLoads).toBeInstanceOf(Map);
    });

    test('should be a singleton', () => {
      const instance1 = EnhancedRendererRegistry.getInstance();
      const instance2 = EnhancedRendererRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should extend base RendererRegistry', () => {
      expect(registry.register).toBeDefined();
      expect(registry.getRenderer).toBeDefined();
      expect(registry.getSupportedContentTypes).toBeDefined();
    });
  });

  describe('Renderer Plugin Registration', () => {
    test('should register renderer plugin', async () => {
      const result = await registry.registerRendererPlugin('json-renderer', JsonRenderer, {
        version: '1.0.0',
        author: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.renderer).toBeDefined();
      expect(registry.pluginRenderers.has('json-renderer')).toBe(true);
      expect(registry.isRegistered('JsonRenderer')).toBe(true);
    });

    test('should handle registration failure', async () => {
      // Create invalid renderer
      class InvalidRenderer {
        // Missing required methods
      }

      const result = await registry.registerRendererPlugin('invalid', InvalidRenderer);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(registry.pluginRenderers.has('invalid')).toBe(false);
    });

    test('should rollback plugin registration on renderer registration failure', async () => {
      // Mock a renderer that passes plugin validation but fails registry validation
      class PartialRenderer {
        render() { return 'test'; }
        getInfo() { return { name: 'Partial' }; }
        // Missing other required methods for registry
      }

      const result = await registry.registerRendererPlugin('partial', PartialRenderer);
      
      expect(result.success).toBe(false);
      expect(registry.pluginManager.hasPlugin('partial')).toBe(false);
    });

    test('should track plugin-renderer mapping', async () => {
      await registry.registerRendererPlugin('test-json', JsonRenderer);
      
      const rendererName = registry.pluginRenderers.get('test-json');
      expect(rendererName).toBe('JsonRenderer');
      
      const renderer = registry.getRendererByName(rendererName);
      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(JsonRenderer);
    });
  });

  describe('Renderer Plugin Unregistration', () => {
    beforeEach(async () => {
      await registry.registerRendererPlugin('test-renderer', JsonRenderer);
    });

    test('should unregister renderer plugin', async () => {
      expect(registry.pluginRenderers.has('test-renderer')).toBe(true);
      expect(registry.isRegistered('JsonRenderer')).toBe(true);

      const result = await registry.unregisterRendererPlugin('test-renderer');
      
      expect(result.success).toBe(true);
      expect(registry.pluginRenderers.has('test-renderer')).toBe(false);
      expect(registry.isRegistered('JsonRenderer')).toBe(false);
      expect(registry.pluginManager.hasPlugin('test-renderer')).toBe(false);
    });

    test('should handle missing plugin gracefully', async () => {
      const result = await registry.unregisterRendererPlugin('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Async Renderer Retrieval', () => {
    test('should get renderer from base registry', async () => {
      // Register directly
      const jsonRenderer = new JsonRenderer();
      registry.register(jsonRenderer);

      const renderer = await registry.getRendererAsync('json');
      
      expect(renderer).toBe(jsonRenderer);
    });

    test('should return fallback when no renderer found', async () => {
      const fallbackRenderer = {
        getName: () => 'Fallback',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => [],
        getDescription: () => 'Fallback renderer',
        canRender: () => true,
        render: () => document.createElement('div')
      };
      
      registry.setFallbackRenderer(fallbackRenderer);
      
      const renderer = await registry.getRendererAsync('unknown-type');
      expect(renderer).toBe(fallbackRenderer);
    });

    test('should attempt to load plugin for unknown content type', async () => {
      // Mock the find plugin method
      let findPluginCalled = false;
      registry._findPluginForContentType = async (contentType) => {
        findPluginCalled = true;
        expect(contentType).toBe('custom-type');
        return null; // No plugin found
      };

      await registry.getRendererAsync('custom-type');
      
      expect(findPluginCalled).toBe(true);
    });
  });

  describe('Plugin Renderer Management', () => {
    test('should get all plugin renderers', async () => {
      await registry.registerRendererPlugin('plugin1', JsonRenderer, {
        version: '1.0.0'
      });

      // Create another renderer class
      class TestRenderer extends JsonRenderer {
        getName() { return 'TestRenderer'; }
      }

      await registry.registerRendererPlugin('plugin2', TestRenderer, {
        version: '2.0.0'
      });

      const pluginRenderers = registry.getPluginRenderers();
      
      expect(pluginRenderers.length).toBe(2);
      expect(pluginRenderers[0].pluginId).toBe('plugin1');
      expect(pluginRenderers[0].rendererName).toBe('JsonRenderer');
      expect(pluginRenderers[0].metadata.version).toBe('1.0.0');
      
      expect(pluginRenderers[1].pluginId).toBe('plugin2');
      expect(pluginRenderers[1].rendererName).toBe('TestRenderer');
      expect(pluginRenderers[1].metadata.version).toBe('2.0.0');
    });

    test('should reload renderer plugin', async () => {
      // Register initial plugin
      await registry.registerRendererPlugin('reload-test', JsonRenderer, {
        path: './test-path.js'
      });

      // Mock loadRendererPlugin
      let loadCalled = false;
      const originalLoad = registry.loadRendererPlugin;
      registry.loadRendererPlugin = async (path, metadata) => {
        loadCalled = true;
        expect(path).toBe('./test-path.js');
        return { success: true };
      };

      const result = await registry.reloadRendererPlugin('reload-test');
      
      expect(loadCalled).toBe(true);
      expect(result.success).toBe(true);

      // Restore
      registry.loadRendererPlugin = originalLoad;
    });

    test('should handle reload without path', async () => {
      await registry.registerRendererPlugin('no-path', JsonRenderer);
      
      const result = await registry.reloadRendererPlugin('no-path');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No plugin path');
    });
  });

  describe('Dynamic Loading', () => {
    test('should handle concurrent loads of same plugin', async () => {
      // Mock the load function
      let loadCount = 0;
      registry._loadRendererPluginAsync = async (path, metadata) => {
        loadCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true, rendererName: 'TestRenderer' };
      };

      // Start concurrent loads
      const load1 = registry.loadRendererPlugin('./test-path.js');
      const load2 = registry.loadRendererPlugin('./test-path.js');
      
      expect(registry.pendingLoads.size).toBe(1);
      
      const [result1, result2] = await Promise.all([load1, load2]);
      
      expect(result1).toBe(result2);
      expect(loadCount).toBe(1); // Should only load once
      expect(registry.pendingLoads.size).toBe(0);
    });

    test('should generate plugin ID from path', () => {
      const id1 = registry._generatePluginId('./path/to/my-renderer.js');
      expect(id1).toBe('renderer-my-renderer');

      const id2 = registry._generatePluginId('custom-renderer.plugin.js');
      expect(id2).toBe('renderer-custom-renderer.plugin');
    });
  });

  describe('Enhanced Statistics', () => {
    test('should provide enhanced statistics', async () => {
      await registry.registerRendererPlugin('stats-test', JsonRenderer);
      
      const stats = registry.getEnhancedStatistics();
      
      expect(stats.totalRenderers).toBeGreaterThanOrEqual(1);
      expect(stats.pluginRenderers).toBe(1);
      expect(stats.pendingLoads).toBe(0);
      expect(stats.pluginManager).toBeDefined();
      expect(stats.pluginManager.pluginCount).toBe(1);
    });
  });

  describe('Lifecycle Hooks', () => {
    test('should log plugin load events', async () => {
      // Spy on console.log
      const originalLog = console.log;
      let logMessage = '';
      console.log = (message) => {
        logMessage = message;
      };

      try {
        await registry.registerRendererPlugin('log-test', JsonRenderer);
        expect(logMessage).toContain('Renderer plugin loaded: log-test');
      } finally {
        console.log = originalLog;
      }
    });

    test('should log plugin unload events', async () => {
      const originalLog = console.log;
      let logMessage = '';
      console.log = (message) => {
        logMessage = message;
      };

      try {
        await registry.registerRendererPlugin('unload-test', JsonRenderer);
        await registry.unregisterRendererPlugin('unload-test');
        expect(logMessage).toContain('Unloading renderer plugin: unload-test');
      } finally {
        console.log = originalLog;
      }
    });

    test('should handle plugin errors', async () => {
      const originalError = console.error;
      let errorLogged = false;
      console.error = () => {
        errorLogged = true;
      };

      try {
        // Trigger an error through plugin manager
        await registry.pluginManager._handlePluginError('test-plugin', new Error('Test error'));
        expect(errorLogged).toBe(true);
      } finally {
        console.error = originalError;
      }
    });
  });

  describe('Cleanup', () => {
    test('should clear all data including plugins', async () => {
      await registry.registerRendererPlugin('clear1', JsonRenderer);
      
      // Register non-plugin renderer
      registry.register(new JsonRenderer());
      
      expect(registry.pluginRenderers.size).toBe(1);
      expect(registry.getRegisteredRenderers().length).toBeGreaterThan(0);

      await registry.clearAll();

      expect(registry.pluginRenderers.size).toBe(0);
      expect(registry.getRegisteredRenderers().length).toBe(0);
      expect(registry.pluginManager.plugins.size).toBe(0);
    });

    test('should destroy registry and plugin manager', async () => {
      await registry.registerRendererPlugin('destroy-test', JsonRenderer);
      
      expect(EnhancedRendererRegistry.instance).toBe(registry);
      
      await registry.destroy();
      
      expect(EnhancedRendererRegistry.instance).toBeNull();
      expect(registry.pluginManager.destroyed).toBe(true);
    });

    test('should handle multiple destroy calls', async () => {
      await expect(async () => {
        await registry.destroy();
        await registry.destroy();
      }).not.toThrow();
    });
  });
});