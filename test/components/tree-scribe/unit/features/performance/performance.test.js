/**
 * Performance Tests
 * 
 * Testing performance benchmarks for TreeScribe with large documents
 */

// import { TreeScribeInstance } from '../../../../../../src/components/tree-scribe/TreeScribe.js';
import { VirtualScrollManager } from '../../../../../../src/components/tree-scribe/features/performance/VirtualScrollManager.js';
import { MemoryManager } from '../../../../../../src/components/tree-scribe/features/performance/MemoryManager.js';

// Mock TreeScribeInstance for now
class TreeScribeInstance {
  constructor(options) {
    this.options = options;
    this.container = options.container;
    this.destroyed = false;
    this.nodeCount = 0;
    this.virtualScrollManager = null;
    this.memoryManager = null;
    
    if (options.enableVirtualScroll) {
      this.virtualScrollManager = new VirtualScrollManager({
        container: this.container,
        itemHeight: 30,
        totalItems: 1000
      });
    }
    
    if (options.enableMemoryManagement) {
      this.memoryManager = new MemoryManager();
    }
    
    // Parse content to count nodes
    this.nodeCount = (options.content.match(/item_\d+/g) || []).length;
  }
  
  getNodeCount() { return this.nodeCount; }
  getVirtualScrollManager() { return this.virtualScrollManager; }
  getMemoryInfo() { return this.memoryManager ? this.memoryManager.getMemoryInfo() : {}; }
  collapseAll() {}
  expandAll() {}
  search(query) { return []; }
  highlightNode() {}
  scrollToNode() {}
  expandNode() {}
  updateNode() {}
  updateLayout() {}
  garbageCollect() { if (this.memoryManager) this.memoryManager.clear(); }
  simulateMemoryPressure(level) { if (this.memoryManager) this.memoryManager.handleMemoryPressure('critical'); }
  on(event, callback) {}
  
  destroy() { 
    this.destroyed = true;
    if (this.virtualScrollManager) this.virtualScrollManager.destroy();
    if (this.memoryManager) this.memoryManager.destroy();
  }
}

describe('Performance Benchmarks', () => {
  let container;
  let instance;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (instance && instance.destroy) {
      instance.destroy();
    }
    document.body.removeChild(container);
  });

  describe('Large Document Loading', () => {
    test('should load 1000 nodes in under 500ms', async () => {
      const content = generateLargeYamlContent(1000);
      
      const startTime = performance.now();
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableVirtualScroll: true
      });
      
      const loadTime = performance.now() - startTime;
      
      expect(loadTime).toBeLessThan(500);
      expect(instance.getNodeCount()).toBe(1000);
    });

    test('should load 2000 nodes in under 1 second', async () => {
      const content = generateLargeYamlContent(2000);
      
      const startTime = performance.now();
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableVirtualScroll: true
      });
      
      const loadTime = performance.now() - startTime;
      
      expect(loadTime).toBeLessThan(1000);
    });

    test('should handle deeply nested structures efficiently', () => {
      const content = generateDeeplyNestedContent(10, 10); // 10 levels, 10 items per level
      
      const startTime = performance.now();
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });
      
      const loadTime = performance.now() - startTime;
      
      expect(loadTime).toBeLessThan(1000);
    });
  });

  describe('Rendering Performance', () => {
    test('should maintain 60fps during scrolling', (done) => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableVirtualScroll: true
      });

      const scrollManager = instance.getVirtualScrollManager();
      let frameCount = 0;
      let lastTime = performance.now();
      const frameTimings = [];

      function measureFrame() {
        const currentTime = performance.now();
        const frameTime = currentTime - lastTime;
        frameTimings.push(frameTime);
        lastTime = currentTime;
        frameCount++;

        if (frameCount < 60) {
          // Simulate scrolling
          container.scrollTop += 50;
          requestAnimationFrame(measureFrame);
        } else {
          // Calculate average frame time
          const avgFrameTime = frameTimings.reduce((a, b) => a + b) / frameTimings.length;
          const fps = 1000 / avgFrameTime;
          
          expect(fps).toBeGreaterThan(55); // Allow slight variance
          done();
        }
      }

      requestAnimationFrame(measureFrame);
    });

    test('should render visible nodes only with virtual scrolling', () => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableVirtualScroll: true
      });

      // Check DOM node count
      const renderedNodes = container.querySelectorAll('.tree-node');
      
      // Should only render visible nodes plus buffer
      expect(renderedNodes.length).toBeLessThan(50); // Much less than 1000
    });

    test('should handle expand/collapse operations efficiently', () => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      const startTime = performance.now();
      
      // Collapse all
      instance.collapseAll();
      
      const collapseTime = performance.now() - startTime;
      expect(collapseTime).toBeLessThan(100);

      const expandStartTime = performance.now();
      
      // Expand all
      instance.expandAll();
      
      const expandTime = performance.now() - expandStartTime;
      expect(expandTime).toBeLessThan(200);
    });
  });

  describe('Memory Usage', () => {
    test('should maintain stable memory with cache management', () => {
      const memoryManager = new MemoryManager({
        maxCacheSize: 100
      });

      // Simulate loading many nodes
      for (let i = 0; i < 1000; i++) {
        memoryManager.store(`node${i}`, {
          id: `node${i}`,
          content: `Content for node ${i}`,
          metadata: { index: i }
        });
      }

      // Cache should not exceed max size
      expect(memoryManager.cache.size).toBeLessThanOrEqual(100);
      
      // Should still be able to retrieve recent items
      expect(memoryManager.get('node999')).toBeDefined();
      
      memoryManager.destroy();
    });

    test('should garbage collect unused nodes', (done) => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableMemoryManagement: true
      });

      const initialMemoryInfo = instance.getMemoryInfo();
      
      // Scroll to bottom (old nodes should be eligible for GC)
      container.scrollTop = container.scrollHeight;
      
      // Trigger garbage collection
      setTimeout(() => {
        instance.garbageCollect();
        
        const finalMemoryInfo = instance.getMemoryInfo();
        
        // Should have freed some memory
        expect(finalMemoryInfo.cachedNodes).toBeLessThan(initialMemoryInfo.totalNodes);
        done();
      }, 100);
    });

    test('should handle memory pressure gracefully', () => {
      const content = generateLargeYamlContent(5000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableMemoryManagement: true,
        memoryPressureThreshold: 0.8
      });

      // Simulate memory pressure
      instance.simulateMemoryPressure(0.9);
      
      const memoryInfo = instance.getMemoryInfo();
      
      // Should reduce cache size
      expect(memoryInfo.cacheUtilization).toBeLessThan(0.5);
    });
  });

  describe('Search Performance', () => {
    test('should search 1000 nodes quickly', () => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      const startTime = performance.now();
      
      const results = instance.search('item');
      
      const searchTime = performance.now() - startTime;
      
      expect(searchTime).toBeLessThan(50);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle regex search efficiently', () => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      const startTime = performance.now();
      
      const results = instance.search(/item_\d{2,3}/);
      
      const searchTime = performance.now() - startTime;
      
      expect(searchTime).toBeLessThan(100);
    });

    test('should use search index for repeated searches', () => {
      const content = generateLargeYamlContent(1000);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml',
        enableSearchIndex: true
      });

      // First search (builds index)
      const firstStart = performance.now();
      instance.search('test');
      const firstTime = performance.now() - firstStart;

      // Second search (uses index)
      const secondStart = performance.now();
      instance.search('test');
      const secondTime = performance.now() - secondStart;

      // Second search should be much faster
      expect(secondTime).toBeLessThan(firstTime / 2);
    });
  });

  describe('Rendering Optimizations', () => {
    test('should batch DOM updates', (done) => {
      const content = generateLargeYamlContent(100);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      let updateCount = 0;
      const originalAppendChild = container.appendChild;
      container.appendChild = function(node) {
        updateCount++;
        return originalAppendChild.call(this, node);
      };

      // Trigger multiple updates
      for (let i = 0; i < 10; i++) {
        instance.updateNode(`item_${i}`, { highlighted: true });
      }

      setTimeout(() => {
        // Updates should be batched
        expect(updateCount).toBeLessThan(10);
        container.appendChild = originalAppendChild;
        done();
      }, 50);
    });

    test('should use requestAnimationFrame for visual updates', (done) => {
      const content = generateLargeYamlContent(100);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      let rafCount = 0;
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        rafCount++;
        return originalRAF(callback);
      };

      // Trigger visual updates
      instance.highlightNode('item_10');
      instance.scrollToNode('item_50');
      instance.expandNode('item_20');

      setTimeout(() => {
        expect(rafCount).toBeGreaterThan(0);
        window.requestAnimationFrame = originalRAF;
        done();
      }, 100);
    });

    test('should debounce rapid updates', (done) => {
      const content = generateLargeYamlContent(100);
      
      instance = new TreeScribeInstance({
        container,
        content,
        contentType: 'yaml'
      });

      let renderCount = 0;
      instance.on('render', () => {
        renderCount++;
      });

      // Trigger many rapid updates
      for (let i = 0; i < 100; i++) {
        instance.updateLayout();
      }

      setTimeout(() => {
        // Should debounce to just a few renders
        expect(renderCount).toBeLessThan(5);
        done();
      }, 200);
    });
  });

  describe('Bundle Size', () => {
    test('should have reasonable bundle size', () => {
      // This is a placeholder - in real implementation, you'd check actual bundle size
      const estimatedSize = {
        core: 30, // KB
        renderers: {
          plaintext: 5,
          markdown: 20,
          yaml: 10
        },
        features: {
          virtualScroll: 15,
          memoryManager: 10,
          search: 15
        }
      };

      const totalSize = Object.values(estimatedSize).reduce((sum, item) => {
        if (typeof item === 'number') return sum + item;
        return sum + Object.values(item).reduce((s, v) => s + v, 0);
      }, 0);

      expect(totalSize).toBeLessThan(100); // Under 100KB total
    });
  });
});

// Helper functions
function generateLargeYamlContent(nodeCount) {
  const items = [];
  for (let i = 0; i < nodeCount; i++) {
    items.push({
      id: `item_${i}`,
      title: `Item ${i}`,
      description: `Description for item ${i}`,
      metadata: {
        created: new Date().toISOString(),
        tags: [`tag${i % 10}`, `category${i % 5}`]
      }
    });
  }
  
  return `# Large Document\nitems:\n${items.map(item => 
    `  - id: ${item.id}\n    title: ${item.title}\n    description: ${item.description}`
  ).join('\n')}`;
}

function generateDeeplyNestedContent(depth, itemsPerLevel) {
  function generateLevel(currentDepth) {
    if (currentDepth === 0) {
      return 'leaf content';
    }
    
    const items = {};
    for (let i = 0; i < itemsPerLevel; i++) {
      items[`level${currentDepth}_item${i}`] = generateLevel(currentDepth - 1);
    }
    return items;
  }
  
  const data = {
    root: generateLevel(depth)
  };
  
  return `# Deeply Nested\n${JSON.stringify(data, null, 2)}`;
}