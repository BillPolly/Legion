import { PluginManager } from '../PluginManager';
import { Plugin, PluginContext } from '../types';
import { LLMCLIFramework } from '../../../core/framework/LLMCLIFramework';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('PluginManager', () => {
  let manager: PluginManager;
  let framework: LLMCLIFramework;
  let testPlugin: Plugin;

  beforeEach(() => {
    framework = new LLMCLIFramework({
      llmProvider: new MockLLMProvider(),
      commands: {}
    });

    manager = new PluginManager(framework);

    testPlugin = {
      metadata: {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin'
      },
      initialize: jest.fn(),
      cleanup: jest.fn()
    };
  });

  describe('loadPlugin', () => {
    it('should load a plugin', async () => {
      await manager.loadPlugin(testPlugin);

      expect(testPlugin.initialize).toHaveBeenCalled();
      expect(manager.isLoaded('test-plugin')).toBe(true);
    });

    it('should pass context to plugin', async () => {
      await manager.loadPlugin(testPlugin);

      const context = (testPlugin.initialize as jest.Mock).mock.calls[0][0];
      expect(context.framework).toBeDefined();
      expect(context.framework.getConfig).toBeDefined();
    });

    it('should pass plugin config', async () => {
      const config = { apiKey: 'test-key' };
      await manager.loadPlugin(testPlugin, config);

      const context = (testPlugin.initialize as jest.Mock).mock.calls[0][0];
      expect(context.pluginConfig).toEqual(config);
    });

    it('should prevent loading duplicate plugins', async () => {
      await manager.loadPlugin(testPlugin);

      await expect(manager.loadPlugin(testPlugin)).rejects.toThrow('Plugin test-plugin is already loaded');
    });

    it('should handle plugin initialization errors', async () => {
      testPlugin.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      await expect(manager.loadPlugin(testPlugin)).rejects.toThrow('Init failed');
      expect(manager.isLoaded('test-plugin')).toBe(false);
    });

    it('should validate plugin dependencies', async () => {
      const dependentPlugin: Plugin = {
        metadata: {
          name: 'dependent-plugin',
          version: '1.0.0',
          description: 'Plugin with dependencies',
          dependencies: ['missing-plugin@^1.0.0']
        },
        initialize: jest.fn()
      };

      await expect(manager.loadPlugin(dependentPlugin)).rejects.toThrow('Missing dependency: missing-plugin');
    });

    it('should load plugins with satisfied dependencies', async () => {
      const basePlugin: Plugin = {
        metadata: {
          name: 'base-plugin',
          version: '1.0.0',
          description: 'Base plugin'
        },
        initialize: jest.fn()
      };

      const dependentPlugin: Plugin = {
        metadata: {
          name: 'dependent-plugin',
          version: '1.0.0',
          description: 'Plugin with dependencies',
          dependencies: ['base-plugin@^1.0.0']
        },
        initialize: jest.fn()
      };

      await manager.loadPlugin(basePlugin);
      await manager.loadPlugin(dependentPlugin);

      expect(manager.isLoaded('dependent-plugin')).toBe(true);
    });
  });

  describe('unloadPlugin', () => {
    it('should unload a plugin', async () => {
      await manager.loadPlugin(testPlugin);
      await manager.unloadPlugin('test-plugin');

      expect(testPlugin.cleanup).toHaveBeenCalled();
      expect(manager.isLoaded('test-plugin')).toBe(false);
    });

    it('should handle plugins without cleanup', async () => {
      testPlugin.cleanup = undefined;
      await manager.loadPlugin(testPlugin);

      // Should not throw
      await manager.unloadPlugin('test-plugin');
      expect(manager.isLoaded('test-plugin')).toBe(false);
    });

    it('should handle unloading non-existent plugin', async () => {
      await expect(manager.unloadPlugin('non-existent')).rejects.toThrow('Plugin non-existent is not loaded');
    });

    it('should prevent unloading plugins with dependents', async () => {
      const basePlugin: Plugin = {
        metadata: {
          name: 'base-plugin',
          version: '1.0.0',
          description: 'Base plugin'
        },
        initialize: jest.fn()
      };

      const dependentPlugin: Plugin = {
        metadata: {
          name: 'dependent-plugin',
          version: '1.0.0',
          description: 'Plugin with dependencies',
          dependencies: ['base-plugin@^1.0.0']
        },
        initialize: jest.fn()
      };

      await manager.loadPlugin(basePlugin);
      await manager.loadPlugin(dependentPlugin);

      await expect(manager.unloadPlugin('base-plugin')).rejects.toThrow('Cannot unload plugin with dependents');
    });
  });

  describe('getPlugin', () => {
    it('should return loaded plugin', async () => {
      await manager.loadPlugin(testPlugin);

      const plugin = manager.getPlugin('test-plugin');
      expect(plugin).toBe(testPlugin);
    });

    it('should return undefined for non-existent plugin', () => {
      const plugin = manager.getPlugin('non-existent');
      expect(plugin).toBeUndefined();
    });
  });

  describe('listPlugins', () => {
    it('should list all loaded plugins', async () => {
      const plugin2: Plugin = {
        metadata: {
          name: 'plugin-2',
          version: '2.0.0',
          description: 'Second plugin'
        },
        initialize: jest.fn()
      };

      await manager.loadPlugin(testPlugin);
      await manager.loadPlugin(plugin2);

      const plugins = manager.listPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('test-plugin');
      expect(plugins[1].name).toBe('plugin-2');
    });

    it('should return empty array when no plugins', () => {
      const plugins = manager.listPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe('executeHook', () => {
    it('should execute hook on all plugins', async () => {
      const onCommandMock = jest.fn();
      testPlugin.onCommand = onCommandMock;

      const plugin2: Plugin = {
        metadata: {
          name: 'plugin-2',
          version: '2.0.0',
          description: 'Second plugin'
        },
        initialize: jest.fn(),
        onCommand: jest.fn()
      };

      await manager.loadPlugin(testPlugin);
      await manager.loadPlugin(plugin2);

      await manager.executeHook('onCommand', 'test', { success: true });

      expect(onCommandMock).toHaveBeenCalled();
      expect(plugin2.onCommand).toHaveBeenCalled();
    });

    it('should continue executing hooks even if one fails', async () => {
      const plugin1OnCommand = jest.fn().mockRejectedValue(new Error('Hook failed'));
      const plugin2OnCommand = jest.fn();

      testPlugin.onCommand = plugin1OnCommand;

      const plugin2: Plugin = {
        metadata: {
          name: 'plugin-2',
          version: '2.0.0',
          description: 'Second plugin'
        },
        initialize: jest.fn(),
        onCommand: plugin2OnCommand
      };

      await manager.loadPlugin(testPlugin);
      await manager.loadPlugin(plugin2);

      await manager.executeHook('onCommand', 'test', { success: true });

      expect(plugin1OnCommand).toHaveBeenCalled();
      expect(plugin2OnCommand).toHaveBeenCalled();
    });

    it('should skip plugins without the hook', async () => {
      // testPlugin has no onCommand hook
      delete testPlugin.onCommand;

      await manager.loadPlugin(testPlugin);
      
      // Should not throw
      await manager.executeHook('onCommand', 'test', { success: true });
    });
  });

  describe('Plugin Configuration', () => {
    it('should get plugin configuration', async () => {
      const config = { apiKey: 'test-key' };
      await manager.loadPlugin(testPlugin, config);

      const retrievedConfig = manager.getPluginConfig('test-plugin');
      expect(retrievedConfig).toEqual(config);
    });

    it('should set plugin configuration', async () => {
      await manager.loadPlugin(testPlugin);

      const newConfig = { apiKey: 'new-key' };
      manager.setPluginConfig('test-plugin', newConfig);

      const retrievedConfig = manager.getPluginConfig('test-plugin');
      expect(retrievedConfig).toEqual(newConfig);
    });

    it('should return undefined for non-existent plugin config', () => {
      const config = manager.getPluginConfig('non-existent');
      expect(config).toBeUndefined();
    });

    it('should throw when setting config for non-existent plugin', () => {
      expect(() => {
        manager.setPluginConfig('non-existent', {});
      }).toThrow('Plugin non-existent is not loaded');
    });
  });

  describe('loadPluginFromPath', () => {
    it('should load plugin from file path', async () => {
      // Since we can't easily mock require in Jest, we'll test the concept
      // by creating a temporary test plugin file
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      
      const tmpDir = os.tmpdir();
      const pluginPath = path.join(tmpDir, 'test-plugin.js');
      
      // Write a simple plugin file
      const pluginCode = `
        module.exports = {
          metadata: {
            name: 'file-plugin',
            version: '1.0.0',
            description: 'Plugin loaded from file'
          },
          initialize: async (context) => {
            // Plugin initialization
          }
        };
      `;
      
      fs.writeFileSync(pluginPath, pluginCode);
      
      try {
        await manager.loadPluginFromPath(pluginPath);
        expect(manager.isLoaded('file-plugin')).toBe(true);
      } finally {
        // Clean up
        fs.unlinkSync(pluginPath);
      }
    });

    it('should handle invalid plugin files', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      
      const tmpDir = os.tmpdir();
      const pluginPath = path.join(tmpDir, 'invalid-plugin.js');
      
      // Write an invalid plugin file
      const invalidCode = `
        module.exports = {
          // Missing required fields
          someOtherField: 'value'
        };
      `;
      
      fs.writeFileSync(pluginPath, invalidCode);
      
      try {
        await expect(manager.loadPluginFromPath(pluginPath)).rejects.toThrow('Invalid plugin');
      } finally {
        // Clean up
        fs.unlinkSync(pluginPath);
      }
    });
  });

  describe('Plugin Communication', () => {
    it('should allow plugins to access each other', async () => {
      const plugin1: Plugin = {
        metadata: {
          name: 'plugin-1',
          version: '1.0.0',
          description: 'First plugin'
        },
        initialize: jest.fn(),
        customMethod: jest.fn().mockReturnValue('result')
      };

      const plugin2: Plugin = {
        metadata: {
          name: 'plugin-2',
          version: '1.0.0',
          description: 'Second plugin'
        },
        initialize: async (context: PluginContext) => {
          const plugin1Instance = context.framework.getPlugin?.('plugin-1');
          expect(plugin1Instance).toBeDefined();
          
          const result = await context.framework.callPlugin?.('plugin-1', 'customMethod', 'arg1');
          expect(result).toBe('result');
        }
      };

      await manager.loadPlugin(plugin1);
      await manager.loadPlugin(plugin2);
    });
  });

  describe('Plugin Ordering', () => {
    it('should respect plugin load order for hooks', async () => {
      const executionOrder: string[] = [];

      const plugin1: Plugin = {
        metadata: {
          name: 'plugin-1',
          version: '1.0.0',
          description: 'First plugin'
        },
        initialize: jest.fn(),
        onCommand: async () => {
          executionOrder.push('plugin-1');
        }
      };

      const plugin2: Plugin = {
        metadata: {
          name: 'plugin-2',
          version: '1.0.0',
          description: 'Second plugin'
        },
        initialize: jest.fn(),
        onCommand: async () => {
          executionOrder.push('plugin-2');
        }
      };

      await manager.loadPlugin(plugin1);
      await manager.loadPlugin(plugin2);

      await manager.executeHook('onCommand', 'test', { success: true });

      expect(executionOrder).toEqual(['plugin-1', 'plugin-2']);
    });
  });
});