/**
 * Unit tests for LayoutPluginSystem
 * Tests plugin registration, validation, execution, and management
 */

import { jest } from '@jest/globals';
import { LayoutPluginSystem } from '../../../../src/renderers/diagram/layout/LayoutPluginSystem.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

// Create mock layout plugins
const createMockLayoutPlugin = (name, options = {}) => {
  return class MockLayout {
    constructor(config = {}) {
      this.config = config;
      this.name = name;
      this.initialized = false;
    }
    
    async initialize() {
      this.initialized = true;
      if (options.initError) {
        throw new Error(`Initialization failed for ${name}`);
      }
    }
    
    async layout(graphData) {
      if (options.layoutError) {
        throw new Error(`Layout failed for ${name}`);
      }
      
      if (!this.initialized && options.requireInit) {
        throw new Error(`${name} not initialized`);
      }
      
      // Simple mock layout - just return positions in a grid
      const positions = new Map();
      const spacing = 100;
      const cols = Math.ceil(Math.sqrt(graphData.nodes.length));
      
      graphData.nodes.forEach((node, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        positions.set(node.id, {
          x: col * spacing,
          y: row * spacing
        });
      });
      
      return {
        positions,
        bounds: {
          x: 0,
          y: 0,
          width: cols * spacing,
          height: Math.ceil(graphData.nodes.length / cols) * spacing
        },
        edges: new Map(),
        metadata: {
          algorithm: name,
          nodeCount: graphData.nodes.length,
          executionTime: options.executionTime || 50
        }
      };
    }
    
    destroy() {
      this.initialized = false;
    }
  };
};

const createSampleGraphData = () => ({
  nodes: [
    { id: 'node1', size: { width: 100, height: 60 } },
    { id: 'node2', size: { width: 100, height: 60 } },
    { id: 'node3', size: { width: 100, height: 60 } },
    { id: 'node4', size: { width: 100, height: 60 } }
  ],
  edges: [
    { id: 'e1', source: 'node1', target: 'node2' },
    { id: 'e2', source: 'node2', target: 'node3' },
    { id: 'e3', source: 'node3', target: 'node4' }
  ]
});

describe('LayoutPluginSystem', () => {
  let pluginSystem;
  let graphData;

  beforeEach(() => {
    graphData = createSampleGraphData();
    jest.clearAllMocks();
    performance.now.mockReturnValue(1000);
  });

  afterEach(() => {
    if (pluginSystem) {
      pluginSystem.destroy();
      pluginSystem = null;
    }
  });

  describe('Initialization', () => {
    test('should create plugin system with default config', () => {
      pluginSystem = new LayoutPluginSystem();
      
      expect(pluginSystem).toBeDefined();
      expect(pluginSystem.config.autoDiscover).toBe(true);
      expect(pluginSystem.config.strictValidation).toBe(true);
      expect(pluginSystem.config.enableCaching).toBe(true);
      expect(pluginSystem.plugins.size).toBe(0);
    });

    test('should accept custom configuration', () => {
      const onPluginRegistered = jest.fn();
      const onLayoutChanged = jest.fn();
      
      pluginSystem = new LayoutPluginSystem({
        autoDiscover: false,
        strictValidation: false,
        enableCaching: false,
        maxCacheSize: 50,
        onPluginRegistered,
        onLayoutChanged
      });

      expect(pluginSystem.config.autoDiscover).toBe(false);
      expect(pluginSystem.config.strictValidation).toBe(false);
      expect(pluginSystem.config.enableCaching).toBe(false);
      expect(pluginSystem.config.maxCacheSize).toBe(50);
      expect(pluginSystem.config.onPluginRegistered).toBe(onPluginRegistered);
      expect(pluginSystem.config.onLayoutChanged).toBe(onLayoutChanged);
    });

    test('should initialize without built-in layouts if imports fail', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      
      // Mock failed imports - the system should handle this gracefully
      await expect(pluginSystem.initialize()).resolves.toBe(pluginSystem);
      
      // Should still work without built-ins
      expect(pluginSystem.plugins.size).toBe(0);
    });
  });

  describe('Plugin Registration', () => {
    beforeEach(() => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
    });

    test('should register valid plugin successfully', async () => {
      const MockLayout = createMockLayoutPlugin('test-layout');
      const metadata = {
        version: '1.0.0',
        description: 'Test layout plugin',
        category: 'custom'
      };

      const result = await pluginSystem.registerPlugin('test-layout', MockLayout, metadata);

      expect(result).toBe(true);
      expect(pluginSystem.plugins.has('test-layout')).toBe(true);
      expect(pluginSystem.loadedPlugins.has('test-layout')).toBe(true);
      expect(pluginSystem.pluginMetadata.get('test-layout')).toMatchObject({
        name: 'test-layout',
        version: '1.0.0',
        description: 'Test layout plugin',
        category: 'custom'
      });
    });

    test('should register plugin instance', async () => {
      const MockLayout = createMockLayoutPlugin('instance-layout');
      const instance = new MockLayout();
      
      const result = await pluginSystem.registerPlugin('instance-layout', instance);
      
      expect(result).toBe(true);
      expect(pluginSystem.plugins.has('instance-layout')).toBe(true);
    });

    test('should call onPluginRegistered callback', async () => {
      const onPluginRegistered = jest.fn();
      pluginSystem.config.onPluginRegistered = onPluginRegistered;
      
      const MockLayout = createMockLayoutPlugin('callback-test');
      const metadata = { version: '1.0.0' };
      
      await pluginSystem.registerPlugin('callback-test', MockLayout, metadata);
      
      expect(onPluginRegistered).toHaveBeenCalledWith('callback-test', expect.objectContaining(metadata));
    });

    test('should reject invalid plugin name', async () => {
      const MockLayout = createMockLayoutPlugin('invalid');
      
      const result = await pluginSystem.registerPlugin('', MockLayout);
      
      expect(result).toBe(false);
      expect(pluginSystem.failedPlugins.has('')).toBe(true);
    });

    test('should reject plugin without layout method', async () => {
      const InvalidPlugin = class {
        constructor() {}
      };
      
      const result = await pluginSystem.registerPlugin('invalid-plugin', InvalidPlugin);
      
      expect(result).toBe(false);
      expect(pluginSystem.failedPlugins.has('invalid-plugin')).toBe(true);
    });

    test('should handle plugin registration errors', async () => {
      const onPluginError = jest.fn();
      pluginSystem.config.onPluginError = onPluginError;
      
      const result = await pluginSystem.registerPlugin('error-plugin', null);
      
      expect(result).toBe(false);
      expect(onPluginError).toHaveBeenCalled();
    });
  });

  describe('Plugin Unregistration', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      const MockLayout = createMockLayoutPlugin('test-plugin');
      await pluginSystem.registerPlugin('test-plugin', MockLayout);
    });

    test('should unregister plugin successfully', () => {
      const result = pluginSystem.unregisterPlugin('test-plugin');
      
      expect(result).toBe(true);
      expect(pluginSystem.plugins.has('test-plugin')).toBe(false);
      expect(pluginSystem.loadedPlugins.has('test-plugin')).toBe(false);
      expect(pluginSystem.pluginMetadata.has('test-plugin')).toBe(false);
    });

    test('should return false for non-existent plugin', () => {
      const result = pluginSystem.unregisterPlugin('non-existent');
      
      expect(result).toBe(false);
    });

    test('should clean up plugin instance on unregistration', async () => {
      // Create instance first
      const instance = await pluginSystem.getPlugin('test-plugin');
      const destroySpy = jest.spyOn(instance, 'destroy');
      
      pluginSystem.unregisterPlugin('test-plugin');
      
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Plugin Discovery', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      
      // Register multiple plugins for testing
      const MockLayout1 = createMockLayoutPlugin('layout1');
      const MockLayout2 = createMockLayoutPlugin('layout2');
      const MockLayout3 = createMockLayoutPlugin('layout3');
      
      await pluginSystem.registerPlugin('layout1', MockLayout1, {
        category: 'custom',
        tags: ['grid', 'structured']
      });
      await pluginSystem.registerPlugin('layout2', MockLayout2, {
        category: 'physics',
        tags: ['force', 'dynamic']
      });
      await pluginSystem.registerPlugin('layout3', MockLayout3, {
        category: 'custom',
        tags: ['circular', 'radial']
      });
    });

    test('should get all available plugins', () => {
      const plugins = pluginSystem.getAvailablePlugins();
      
      expect(plugins).toHaveLength(3);
      expect(plugins.map(p => p.name)).toEqual(['layout1', 'layout2', 'layout3']);
    });

    test('should filter plugins by category', () => {
      const customPlugins = pluginSystem.getAvailablePlugins({ category: 'custom' });
      
      expect(customPlugins).toHaveLength(2);
      expect(customPlugins.map(p => p.name)).toEqual(['layout1', 'layout3']);
    });

    test('should filter plugins by tags', () => {
      const gridPlugins = pluginSystem.getAvailablePlugins({ tags: ['grid'] });
      
      expect(gridPlugins).toHaveLength(1);
      expect(gridPlugins[0].name).toBe('layout1');
    });

    test('should filter plugins by capabilities', async () => {
      await pluginSystem.registerPlugin('capable-layout', createMockLayoutPlugin('capable'), {
        capabilities: { directed: true, weighted: true }
      });
      
      const capablePlugins = pluginSystem.getAvailablePlugins({
        capabilities: { directed: true }
      });
      
      expect(capablePlugins.some(p => p.name === 'capable-layout')).toBe(true);
    });
  });

  describe('Plugin Instantiation', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
    });

    test('should get plugin instance successfully', async () => {
      const MockLayout = createMockLayoutPlugin('test-plugin', { requireInit: true });
      await pluginSystem.registerPlugin('test-plugin', MockLayout);
      
      const instance = await pluginSystem.getPlugin('test-plugin');
      
      expect(instance).toBeDefined();
      expect(instance.name).toBe('test-plugin');
      expect(instance.initialized).toBe(true);
      expect(pluginSystem.activePlugins.has('test-plugin')).toBe(true);
    });

    test('should cache plugin instances', async () => {
      const MockLayout = createMockLayoutPlugin('cached-plugin');
      await pluginSystem.registerPlugin('cached-plugin', MockLayout);
      
      const instance1 = await pluginSystem.getPlugin('cached-plugin');
      const instance2 = await pluginSystem.getPlugin('cached-plugin');
      
      expect(instance1).toBe(instance2);
    });

    test('should create different instances for different configs', async () => {
      const MockLayout = createMockLayoutPlugin('config-plugin');
      await pluginSystem.registerPlugin('config-plugin', MockLayout);
      
      const instance1 = await pluginSystem.getPlugin('config-plugin', { param: 1 });
      const instance2 = await pluginSystem.getPlugin('config-plugin', { param: 2 });
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.config.param).toBe(1);
      expect(instance2.config.param).toBe(2);
    });

    test('should throw error for non-existent plugin', async () => {
      await expect(pluginSystem.getPlugin('non-existent')).rejects.toThrow('Plugin not found: non-existent');
    });

    test('should handle initialization errors', async () => {
      const MockLayout = createMockLayoutPlugin('error-plugin', { initError: true });
      await pluginSystem.registerPlugin('error-plugin', MockLayout);
      
      await expect(pluginSystem.getPlugin('error-plugin')).rejects.toThrow('Initialization failed for error-plugin');
    });
  });

  describe('Layout Execution', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      const MockLayout = createMockLayoutPlugin('executor', { executionTime: 100 });
      await pluginSystem.registerPlugin('executor', MockLayout);
    });

    test('should execute layout successfully', async () => {
      const result = await pluginSystem.executeLayout('executor', graphData);
      
      expect(result).toBeDefined();
      expect(result.positions).toBeInstanceOf(Map);
      expect(result.positions.size).toBe(4);
      expect(result.metadata.plugin).toBe('executor');
      expect(result.metadata.executionTime).toBeDefined();
      expect(pluginSystem.currentLayout.plugin).toBe('executor');
    });

    test('should add layout to history', async () => {
      await pluginSystem.executeLayout('executor', graphData);
      
      expect(pluginSystem.layoutHistory).toHaveLength(1);
      expect(pluginSystem.layoutHistory[0].plugin).toBe('executor');
    });

    test('should call onLayoutChanged callback', async () => {
      const onLayoutChanged = jest.fn();
      pluginSystem.config.onLayoutChanged = onLayoutChanged;
      
      const result = await pluginSystem.executeLayout('executor', graphData);
      
      expect(onLayoutChanged).toHaveBeenCalledWith('executor', result);
    });

    test('should handle layout execution errors', async () => {
      const ErrorLayout = createMockLayoutPlugin('error-layout', { layoutError: true });
      await pluginSystem.registerPlugin('error-layout', ErrorLayout);
      
      await expect(pluginSystem.executeLayout('error-layout', graphData)).rejects.toThrow('Layout failed for error-layout');
    });

    test('should throw error for plugin without layout method', async () => {
      const InvalidLayout = class {
        constructor() {}
      };
      await pluginSystem.registerPlugin('invalid-layout', InvalidLayout);
      
      await expect(pluginSystem.executeLayout('invalid-layout', graphData)).rejects.toThrow('does not implement layout() method');
    });
  });

  describe('Layout Caching', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false, enableCaching: true });
      const MockLayout = createMockLayoutPlugin('cached-layout');
      await pluginSystem.registerPlugin('cached-layout', MockLayout);
    });

    test('should cache layout results', async () => {
      const result1 = await pluginSystem.executeLayout('cached-layout', graphData);
      const result2 = await pluginSystem.executeLayout('cached-layout', graphData);
      
      expect(result2.fromCache).toBe(true);
      expect(pluginSystem.cacheStats.hits).toBe(1);
      expect(pluginSystem.cacheStats.misses).toBe(1);
    });

    test('should not cache when caching is disabled', async () => {
      pluginSystem.config.enableCaching = false;
      
      await pluginSystem.executeLayout('cached-layout', graphData);
      const result2 = await pluginSystem.executeLayout('cached-layout', graphData);
      
      expect(result2.fromCache).toBeUndefined();
    });

    test('should clear cache correctly', async () => {
      await pluginSystem.executeLayout('cached-layout', graphData);
      expect(pluginSystem.layoutCache.size).toBe(1);
      
      pluginSystem.clearCache();
      expect(pluginSystem.layoutCache.size).toBe(0);
    });

    test('should clear cache for specific plugin', async () => {
      const MockLayout2 = createMockLayoutPlugin('another-layout');
      await pluginSystem.registerPlugin('another-layout', MockLayout2);
      
      await pluginSystem.executeLayout('cached-layout', graphData);
      await pluginSystem.executeLayout('another-layout', graphData);
      expect(pluginSystem.layoutCache.size).toBe(2);
      
      pluginSystem.clearCache('cached-layout');
      expect(pluginSystem.layoutCache.size).toBe(1);
    });
  });

  describe('Plugin Capabilities', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      
      const MockLayout = createMockLayoutPlugin('capable-layout');
      await pluginSystem.registerPlugin('capable-layout', MockLayout, {
        capabilities: {
          directed: true,
          undirected: false,
          weighted: true,
          constraints: true,
          animation: false
        }
      });
    });

    test('should get plugin capabilities', () => {
      const capabilities = pluginSystem.getPluginCapabilities('capable-layout');
      
      expect(capabilities).toEqual({
        directed: true,
        undirected: false,
        weighted: true,
        constraints: true,
        animation: false
      });
    });

    test('should check feature support', () => {
      expect(pluginSystem.supportsFeatures('capable-layout', ['directed'])).toBe(true);
      expect(pluginSystem.supportsFeatures('capable-layout', ['directed', 'weighted'])).toBe(true);
      expect(pluginSystem.supportsFeatures('capable-layout', ['undirected'])).toBe(false);
      expect(pluginSystem.supportsFeatures('capable-layout', ['directed', 'animation'])).toBe(false);
    });

    test('should return null for non-existent plugin capabilities', () => {
      const capabilities = pluginSystem.getPluginCapabilities('non-existent');
      expect(capabilities).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      
      const MockLayout = createMockLayoutPlugin('config-layout');
      await pluginSystem.registerPlugin('config-layout', MockLayout, {
        configSchema: {
          required: ['spacing'],
          properties: {
            spacing: { type: 'number' },
            direction: { type: 'string' },
            animate: { type: 'boolean' }
          }
        }
      });
    });

    test('should validate valid configuration', () => {
      const config = {
        spacing: 100,
        direction: 'horizontal',
        animate: true
      };
      
      const result = pluginSystem.validatePluginConfig('config-layout', config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing required fields', () => {
      const config = {
        direction: 'horizontal'
        // missing required 'spacing'
      };
      
      const result = pluginSystem.validatePluginConfig('config-layout', config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: spacing');
    });

    test('should reject wrong field types', () => {
      const config = {
        spacing: '100', // should be number
        direction: true // should be string
      };
      
      const result = pluginSystem.validatePluginConfig('config-layout', config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return valid for plugin without schema', () => {
      const result = pluginSystem.validatePluginConfig('non-existent', { any: 'config' });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('System Statistics', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false, enableCaching: true });
      
      const MockLayout1 = createMockLayoutPlugin('stats-layout1');
      const MockLayout2 = createMockLayoutPlugin('stats-layout2');
      
      await pluginSystem.registerPlugin('stats-layout1', MockLayout1);
      await pluginSystem.registerPlugin('stats-layout2', MockLayout2);
      
      // Execute some layouts to generate stats
      await pluginSystem.executeLayout('stats-layout1', graphData);
      await pluginSystem.executeLayout('stats-layout1', graphData); // Should be cached
    });

    test('should provide system statistics', () => {
      const stats = pluginSystem.getStats();
      
      expect(stats.plugins.total).toBe(2);
      expect(stats.plugins.loaded).toBe(2);
      expect(stats.plugins.active).toBe(1); // Only one was executed
      expect(stats.cache.size).toBe(1);
      expect(stats.cache.hits).toBe(1);
      expect(stats.cache.misses).toBe(1);
      expect(stats.cache.hitRate).toBe(0.5);
      expect(stats.history.size).toBe(1);
      expect(stats.history.current).toBe('stats-layout1');
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      
      const MockLayout = createMockLayoutPlugin('cleanup-test');
      await pluginSystem.registerPlugin('cleanup-test', MockLayout);
      await pluginSystem.getPlugin('cleanup-test'); // Create instance
    });

    test('should destroy cleanly', () => {
      pluginSystem.destroy();
      
      expect(pluginSystem.plugins.size).toBe(0);
      expect(pluginSystem.pluginMetadata.size).toBe(0);
      expect(pluginSystem.pluginInstances.size).toBe(0);
      expect(pluginSystem.layoutCache.size).toBe(0);
      expect(pluginSystem.loadedPlugins.size).toBe(0);
      expect(pluginSystem.activePlugins.size).toBe(0);
      expect(pluginSystem.layoutHistory).toHaveLength(0);
      expect(pluginSystem.currentLayout).toBeNull();
    });

    test('should call destroy on plugin instances', () => {
      const instance = pluginSystem.pluginInstances.values().next().value;
      const destroySpy = jest.spyOn(instance, 'destroy');
      
      pluginSystem.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
    });

    test('should handle malformed plugin gracefully', async () => {
      const result = await pluginSystem.registerPlugin('malformed', 'not-a-plugin');
      
      expect(result).toBe(false);
      expect(pluginSystem.failedPlugins.has('malformed')).toBe(true);
    });

    test('should handle plugin without layout method', async () => {
      const BadPlugin = class {
        constructor() {}
        // missing layout method
      };
      
      const result = await pluginSystem.registerPlugin('bad-plugin', BadPlugin);
      expect(result).toBe(false);
    });

    test('should maintain system stability after plugin errors', async () => {
      // Register a good plugin
      const GoodPlugin = createMockLayoutPlugin('good-plugin');
      await pluginSystem.registerPlugin('good-plugin', GoodPlugin);
      
      // Try to register a bad plugin
      await pluginSystem.registerPlugin('bad-plugin', null);
      
      // Good plugin should still work
      const result = await pluginSystem.executeLayout('good-plugin', graphData);
      expect(result).toBeDefined();
    });
  });
});