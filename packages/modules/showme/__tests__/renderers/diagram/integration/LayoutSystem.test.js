/**
 * Integration tests for the complete Layout System
 * Tests the interaction between LayoutPluginSystem, layout algorithms,
 * LayoutTransitionManager, and LayoutPersistenceManager
 */

import { jest } from '@jest/globals';
import { LayoutPluginSystem } from '../../../../src/renderers/diagram/layout/LayoutPluginSystem.js';
import { LayoutTransitionManager } from '../../../../src/renderers/diagram/layout/LayoutTransitionManager.js';
import { LayoutPersistenceManager } from '../../../../src/renderers/diagram/layout/LayoutPersistenceManager.js';
import { GridLayout } from '../../../../src/renderers/diagram/layout/GridLayout.js';
import { CircularLayout } from '../../../../src/renderers/diagram/layout/CircularLayout.js';

// Mock browser APIs
global.performance = {
  now: jest.fn(() => Date.now())
};

global.requestAnimationFrame = jest.fn(callback => {
  setTimeout(callback, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

const mockStorage = new Map();
global.localStorage = {
  getItem: jest.fn(key => mockStorage.get(key) || null),
  setItem: jest.fn((key, value) => mockStorage.set(key, value)),
  removeItem: jest.fn(key => mockStorage.delete(key))
};

// Sample graph data for testing
const createSampleGraphData = (nodeCount = 6) => ({
  nodes: Array.from({ length: nodeCount }, (_, i) => ({
    id: `node${i + 1}`,
    size: { width: 80, height: 60 },
    data: { label: `Node ${i + 1}` }
  })),
  edges: [
    { id: 'e1', source: 'node1', target: 'node2' },
    { id: 'e2', source: 'node2', target: 'node3' },
    { id: 'e3', source: 'node3', target: 'node4' },
    { id: 'e4', source: 'node1', target: 'node5' },
    { id: 'e5', source: 'node5', target: 'node6' }
  ]
});

describe('Layout System Integration', () => {
  let pluginSystem;
  let transitionManager;
  let persistenceManager;
  let graphData;

  beforeEach(async () => {
    mockStorage.clear();
    graphData = createSampleGraphData();
    jest.clearAllMocks();
    // Integration tests should use real performance.now, not mock it
  });

  afterEach(async () => {
    if (pluginSystem) {
      pluginSystem.destroy();
      pluginSystem = null;
    }
    if (transitionManager) {
      transitionManager.destroy();
      transitionManager = null;
    }
    if (persistenceManager) {
      persistenceManager.destroy();
      persistenceManager = null;
    }
  });

  describe('Complete Layout System Integration', () => {
    test('should integrate plugin system, transitions, and persistence', async () => {
      // Initialize all components
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      transitionManager = new LayoutTransitionManager({ duration: 100, useRAF: false });
      persistenceManager = new LayoutPersistenceManager({ storageType: 'memory' });

      await pluginSystem.initialize();
      await persistenceManager.initialize();

      // Register layout plugins
      await pluginSystem.registerPlugin('grid', GridLayout, {
        version: '1.0.0',
        category: 'structured'
      });

      await pluginSystem.registerPlugin('circular', CircularLayout, {
        version: '1.0.0',
        category: 'geometric'
      });

      expect(pluginSystem.getAvailablePlugins()).toHaveLength(2);

      // Execute first layout
      const gridResult = await pluginSystem.executeLayout('grid', graphData);
      expect(gridResult.positions.size).toBe(6);
      expect(gridResult.metadata.algorithm).toBe('grid');

      // Save layout state
      const savedSnapshot = await persistenceManager.saveLayout('test-layout', gridResult);
      expect(savedSnapshot.id).toBe('test-layout');
      expect(savedSnapshot.data.positions).toBeDefined();

      // Execute second layout
      const circularResult = await pluginSystem.executeLayout('circular', graphData);
      expect(circularResult.positions.size).toBe(6);
      expect(circularResult.metadata.algorithm).toBe('circular');

      // Transition between layouts
      const transitionPromise = transitionManager.transition(
        gridResult.positions,
        circularResult.positions
      );

      expect(transitionManager.isTransitioning()).toBe(true);
      await transitionPromise;
      expect(transitionManager.isTransitioning()).toBe(false);

      // Restore saved layout
      const restoredLayout = await persistenceManager.restoreLayout('test-layout');
      expect(restoredLayout.positions.size).toBe(6);
      expect(restoredLayout.metadata.restored).toBe(true);
    });

    test('should handle layout plugin system with multiple algorithms', async () => {
      pluginSystem = new LayoutPluginSystem({ 
        autoDiscover: false,
        enableCaching: true
      });
      await pluginSystem.initialize();

      // Register multiple plugins
      await pluginSystem.registerPlugin('grid', GridLayout);
      await pluginSystem.registerPlugin('circular', CircularLayout);

      expect(pluginSystem.getAvailablePlugins()).toHaveLength(2);

      // Test each layout type
      const gridResult = await pluginSystem.executeLayout('grid', graphData, {
        rows: 2,
        cols: 3,
        spacing: 100
      });

      expect(gridResult.positions.size).toBe(6);
      expect(gridResult.metadata.algorithm).toBe('grid');
      expect(pluginSystem.currentLayout.plugin).toBe('grid');

      const circularResult = await pluginSystem.executeLayout('circular', graphData, {
        layoutType: 'circle',
        radius: 150
      });

      expect(circularResult.positions.size).toBe(6);
      expect(circularResult.metadata.algorithm).toBe('circular');
      expect(pluginSystem.currentLayout.plugin).toBe('circular');

      // Verify layout history
      expect(pluginSystem.layoutHistory).toHaveLength(2);
      expect(pluginSystem.layoutHistory[0].plugin).toBe('grid');
      expect(pluginSystem.layoutHistory[1].plugin).toBe('circular');
    });

    test('should handle layout transitions with different algorithms', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      transitionManager = new LayoutTransitionManager({ 
        duration: 50, 
        useRAF: false,
        enableFade: true,
        enableScale: true
      });

      await pluginSystem.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);
      await pluginSystem.registerPlugin('circular', CircularLayout);

      // Execute layouts
      const gridResult = await pluginSystem.executeLayout('grid', graphData, {
        spacing: 100
      });
      const circularResult = await pluginSystem.executeLayout('circular', graphData, {
        radius: 200
      });

      // Test transition callbacks
      let startCalled = false;
      let progressCalled = false;
      let completeCalled = false;

      const transitionResult = await transitionManager.transition(
        gridResult.positions,
        circularResult.positions,
        {
          onStart: () => { startCalled = true; },
          onProgress: (id, progress) => { 
            progressCalled = true;
            expect(progress).toBeGreaterThanOrEqual(0);
            expect(progress).toBeLessThanOrEqual(1);
          },
          onComplete: () => { completeCalled = true; }
        }
      );

      expect(startCalled).toBe(true);
      expect(progressCalled).toBe(true);
      expect(completeCalled).toBe(true);
      expect(transitionResult.size).toBe(6);

      // Verify transition statistics
      const stats = transitionManager.getStats();
      expect(stats.totalTransitions).toBe(1);
      expect(stats.completedTransitions).toBe(1);
      expect(stats.canceledTransitions).toBe(0);
    });

    test('should handle layout persistence with versioning', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      persistenceManager = new LayoutPersistenceManager({ 
        storageType: 'memory',
        enableVersioning: true,
        maxVersions: 3
      });

      await pluginSystem.initialize();
      await persistenceManager.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);

      // Execute and save multiple layout versions
      const layout1 = await pluginSystem.executeLayout('grid', graphData, { spacing: 50 });
      const snapshot1 = await persistenceManager.saveLayout('versioned-layout', layout1, {
        name: 'Version 1 - Small spacing'
      });

      const layout2 = await pluginSystem.executeLayout('grid', graphData, { spacing: 100 });
      const snapshot2 = await persistenceManager.saveLayout('versioned-layout', layout2, {
        name: 'Version 2 - Medium spacing'
      });

      const layout3 = await pluginSystem.executeLayout('grid', graphData, { spacing: 150 });
      const snapshot3 = await persistenceManager.saveLayout('versioned-layout', layout3, {
        name: 'Version 3 - Large spacing'
      });

      // Test version management
      const versions = persistenceManager.getLayoutVersions('versioned-layout');
      expect(versions).toHaveLength(3);
      expect(versions[0].name).toContain('Version 1');
      expect(versions[1].name).toContain('Version 2');
      expect(versions[2].name).toContain('Version 3');

      // Test version restoration
      const restored1 = await persistenceManager.restoreLayout('versioned-layout', {
        version: snapshot1.version
      });
      expect(restored1.metadata.restoredFrom).toBe(snapshot1.version);

      // Test layout listing
      const layouts = persistenceManager.listLayouts();
      expect(layouts).toHaveLength(1);
      expect(layouts[0].id).toBe('versioned-layout');
      expect(layouts[0].versions).toBe(3);
    });

    test('should handle layout export and import workflow', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      persistenceManager = new LayoutPersistenceManager({ storageType: 'memory' });

      await pluginSystem.initialize();
      await persistenceManager.initialize();
      await pluginSystem.registerPlugin('circular', CircularLayout);

      // Create and save layout
      const circularResult = await pluginSystem.executeLayout('circular', graphData, {
        layoutType: 'concentric',
        ringCount: 2
      });

      await persistenceManager.saveLayout('export-test', circularResult, {
        name: 'Test Export Layout',
        metadata: { creator: 'test', purpose: 'integration-test' }
      });

      // Export layout
      const exportedData = await persistenceManager.exportLayout('export-test', {
        format: 'json'
      });

      expect(typeof exportedData).toBe('string');
      const parsedExport = JSON.parse(exportedData);
      expect(parsedExport.layoutId).toBe('export-test');
      expect(parsedExport.format).toBe('single-version');
      expect(parsedExport.snapshot.name).toBe('Test Export Layout');

      // Import to new layout
      const importedId = await persistenceManager.importLayout(exportedData, {
        layoutId: 'imported-layout'
      });

      expect(importedId).toBe('imported-layout');

      // Verify imported layout
      const restoredImport = await persistenceManager.restoreLayout('imported-layout');
      expect(restoredImport.positions.size).toBe(6);
      expect(restoredImport.metadata.algorithm).toBe('circular');

      // Verify both layouts exist
      const allLayouts = persistenceManager.listLayouts();
      expect(allLayouts).toHaveLength(2);
      expect(allLayouts.map(l => l.id)).toEqual(expect.arrayContaining(['export-test', 'imported-layout']));
    });

    test('should handle layout system error scenarios gracefully', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      transitionManager = new LayoutTransitionManager({ duration: 50, useRAF: false });
      persistenceManager = new LayoutPersistenceManager({ 
        storageType: 'memory',
        gracefulFallback: true
      });

      await pluginSystem.initialize();
      await persistenceManager.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);

      // Test plugin system error handling
      await expect(pluginSystem.executeLayout('non-existent', graphData))
        .rejects.toThrow('Plugin not found: non-existent');

      // Test persistence error handling with fallback
      const fallbackLayout = await persistenceManager.restoreLayout('non-existent');
      expect(fallbackLayout.positions.size).toBe(0);
      expect(fallbackLayout.metadata.restored).toBe(false);

      // Test transition cancellation
      const layout1 = await pluginSystem.executeLayout('grid', graphData);
      const layout2 = await pluginSystem.executeLayout('grid', graphData, { spacing: 200 });

      // Start transition then cancel
      const transitionPromise = transitionManager.transition(layout1.positions, layout2.positions);
      
      // Cancel immediately
      transitionManager.cancelTransition();
      
      await expect(transitionPromise).rejects.toThrow('Transition cancelled');

      const stats = transitionManager.getStats();
      expect(stats.canceledTransitions).toBe(1);
    });

    test('should handle complex workflow with all components', async () => {
      // Initialize complete system
      pluginSystem = new LayoutPluginSystem({ 
        autoDiscover: false,
        enableCaching: true
      });
      transitionManager = new LayoutTransitionManager({ 
        duration: 30,
        useRAF: false,
        enableFade: true
      });
      persistenceManager = new LayoutPersistenceManager({ 
        storageType: 'memory',
        autoSave: false
      });

      await pluginSystem.initialize();
      await persistenceManager.initialize();

      // Register plugins
      await pluginSystem.registerPlugin('grid', GridLayout);
      await pluginSystem.registerPlugin('circular', CircularLayout);

      // Create complex workflow
      const layouts = [];
      const transitions = [];

      // Execute multiple layouts
      layouts.push(await pluginSystem.executeLayout('grid', graphData, { 
        spacing: 80,
        arrangement: 'rows'
      }));

      layouts.push(await pluginSystem.executeLayout('circular', graphData, { 
        layoutType: 'circle',
        radius: 120
      }));

      layouts.push(await pluginSystem.executeLayout('circular', graphData, { 
        layoutType: 'concentric',
        ringCount: 2
      }));

      // Save all layouts
      for (let i = 0; i < layouts.length; i++) {
        await persistenceManager.saveLayout(`workflow-layout-${i}`, layouts[i], {
          name: `Workflow Step ${i + 1}`,
          step: i + 1
        });
      }

      // Execute transitions between layouts
      for (let i = 0; i < layouts.length - 1; i++) {
        const transitionResult = await transitionManager.transition(
          layouts[i].positions,
          layouts[i + 1].positions
        );
        transitions.push(transitionResult);
      }

      // Verify workflow results
      expect(layouts).toHaveLength(3);
      expect(transitions).toHaveLength(2);
      expect(pluginSystem.layoutHistory).toHaveLength(3);

      const allSavedLayouts = persistenceManager.listLayouts();
      expect(allSavedLayouts).toHaveLength(3);

      const systemStats = pluginSystem.getStats();
      expect(systemStats.plugins.total).toBe(2);
      expect(systemStats.plugins.loaded).toBe(2);
      expect(systemStats.cache.size).toBe(3); // Grid and circular layouts cached

      const transitionStats = transitionManager.getStats();
      expect(transitionStats.totalTransitions).toBe(2);
      expect(transitionStats.completedTransitions).toBe(2);

      const persistenceStats = persistenceManager.getStats();
      expect(persistenceStats.totalSaves).toBe(3);
      expect(persistenceStats.layoutCount).toBe(3);
    });

    test('should handle performance with large graphs', async () => {
      // Create larger graph data
      const largeGraphData = createSampleGraphData(20);

      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      transitionManager = new LayoutTransitionManager({ 
        duration: 100,
        useRAF: false,
        batchSize: 10
      });

      await pluginSystem.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);
      await pluginSystem.registerPlugin('circular', CircularLayout);

      const startTime = performance.now();

      // Execute layout on large graph
      const gridResult = await pluginSystem.executeLayout('grid', largeGraphData);
      const circularResult = await pluginSystem.executeLayout('circular', largeGraphData);

      expect(gridResult.positions.size).toBe(20);
      expect(circularResult.positions.size).toBe(20);

      // Test transition performance
      const transitionStart = performance.now();
      await transitionManager.transition(gridResult.positions, circularResult.positions);
      const transitionEnd = performance.now();

      // Verify reasonable execution times (these are loose bounds for testing)
      expect(gridResult.metadata.executionTime).toBeLessThan(1000);
      expect(circularResult.metadata.executionTime).toBeLessThan(1000);

      const stats = transitionManager.getStats();
      expect(stats.completedTransitions).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    test('should maintain layout consistency across operations', async () => {
      pluginSystem = new LayoutPluginSystem({ autoDiscover: false });
      persistenceManager = new LayoutPersistenceManager({ storageType: 'memory' });

      await pluginSystem.initialize();
      await persistenceManager.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);

      // Execute layout
      const originalLayout = await pluginSystem.executeLayout('grid', graphData, {
        spacing: 100,
        arrangement: 'rows'
      });

      // Save layout
      await persistenceManager.saveLayout('consistency-test', originalLayout);

      // Restore layout
      const restoredLayout = await persistenceManager.restoreLayout('consistency-test');

      // Verify consistency
      expect(restoredLayout.positions.size).toBe(originalLayout.positions.size);

      for (const [nodeId, originalPos] of originalLayout.positions) {
        const restoredPos = restoredLayout.positions.get(nodeId);
        expect(restoredPos).toBeDefined();
        expect(restoredPos.x).toBe(originalPos.x);
        expect(restoredPos.y).toBe(originalPos.y);
      }

      // Verify metadata preservation
      expect(restoredLayout.metadata.algorithm).toBe('grid');
      expect(restoredLayout.metadata.restored).toBe(true);
    });
  });

  describe('Layout System Configuration', () => {
    test('should handle system-wide configuration updates', async () => {
      pluginSystem = new LayoutPluginSystem({ 
        autoDiscover: false,
        enableCaching: false
      });
      transitionManager = new LayoutTransitionManager({ duration: 200 });
      persistenceManager = new LayoutPersistenceManager({ autoSave: false });

      await pluginSystem.initialize();
      await persistenceManager.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout);

      // Update configurations
      transitionManager.updateConfig({ duration: 50, enableFade: false });
      expect(transitionManager.getConfig().duration).toBe(50);
      expect(transitionManager.getConfig().enableFade).toBe(false);

      const layout1 = await pluginSystem.executeLayout('grid', graphData);
      const layout2 = await pluginSystem.executeLayout('grid', graphData, { spacing: 150 });

      // Test updated transition configuration
      const transitionStart = performance.now();
      await transitionManager.transition(layout1.positions, layout2.positions);
      const transitionEnd = performance.now();

      // Should complete faster with reduced duration
      const stats = transitionManager.getStats();
      expect(stats.completedTransitions).toBe(1);
    });

    test('should handle plugin configuration validation', async () => {
      pluginSystem = new LayoutPluginSystem({ 
        autoDiscover: false,
        strictValidation: true
      });
      
      await pluginSystem.initialize();
      await pluginSystem.registerPlugin('grid', GridLayout, {
        configSchema: {
          required: ['spacing'],
          properties: {
            spacing: { type: 'number', minimum: 10 },
            arrangement: { type: 'string', enum: ['rows', 'columns'] }
          }
        }
      });

      // Test valid configuration
      const validResult = pluginSystem.validatePluginConfig('grid', {
        spacing: 100,
        arrangement: 'rows'
      });
      expect(validResult.isValid).toBe(true);

      // Test invalid configuration
      const invalidResult = pluginSystem.validatePluginConfig('grid', {
        spacing: 5, // Below minimum
        arrangement: 'invalid'
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});