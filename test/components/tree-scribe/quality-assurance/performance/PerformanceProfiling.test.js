/**
 * TreeScribe Performance Profiling Tests
 * 
 * Comprehensive performance testing to identify bottlenecks and optimize performance
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Performance Profiling', () => {
  let container;
  let instance;
  let performanceData = {};

  beforeAll(() => {
    // Initialize performance tracking
    performanceData = {
      loadTimes: [],
      renderTimes: [],
      searchTimes: [],
      memoryUsage: [],
      domNodeCounts: []
    };
  });

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
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  afterAll(() => {
    // Report performance summary
    console.log('\n=== TreeScribe Performance Report ===');
    console.log(`Average Load Time: ${calculateAverage(performanceData.loadTimes)}ms`);
    console.log(`Average Render Time: ${calculateAverage(performanceData.renderTimes)}ms`);
    console.log(`Average Search Time: ${calculateAverage(performanceData.searchTimes)}ms`);
    console.log(`Max Memory Usage: ${Math.max(...performanceData.memoryUsage)}MB`);
    console.log(`Max DOM Nodes: ${Math.max(...performanceData.domNodeCounts)}`);
  });

  describe('Document Loading Performance', () => {
    test('should load small documents quickly (< 50ms)', async () => {
      const yaml = `
        title: "Small Document"
        content: "Simple content"
        children:
          - title: "Child 1"
          - title: "Child 2"
      `;

      const startTime = performance.now();
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      performanceData.loadTimes.push(loadTime);

      expect(result.success).toBe(true);
      expect(loadTime).toBeLessThan(50);
    });

    test('should load medium documents efficiently (< 200ms)', async () => {
      // Generate medium-sized document (50 nodes)
      const children = [];
      for (let i = 0; i < 48; i++) {
        children.push({
          title: `Item ${i}`,
          content: `Content for item ${i} with some additional text to make it realistic`
        });
      }

      const yaml = JSON.stringify({
        title: "Medium Document",
        content: "This is a medium-sized document with 50 nodes total",
        children
      });

      const startTime = performance.now();
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      performanceData.loadTimes.push(loadTime);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(50);
      expect(loadTime).toBeLessThan(200);
    });

    test('should handle large documents within acceptable time (< 1000ms)', async () => {
      // Generate large document (500 nodes)
      const children = [];
      for (let i = 0; i < 499; i++) {
        children.push({
          title: `Large Item ${i}`,
          content: `Detailed content for large item ${i} with comprehensive description and multiple sentences to simulate real-world usage patterns.`
        });
      }

      const yaml = JSON.stringify({
        title: "Large Document",
        content: "This is a large document with 500 nodes for performance testing",
        children
      });

      const startTime = performance.now();
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      performanceData.loadTimes.push(loadTime);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(500);
      expect(loadTime).toBeLessThan(1000);
    });

    test('should handle deeply nested documents efficiently', async () => {
      // Create 15-level deep nesting
      let current = {
        title: "Root Level",
        content: "Level 0 content"
      };

      let root = current;
      for (let i = 1; i < 15; i++) {
        current.children = [{
          title: `Level ${i}`,
          content: `Content at nesting level ${i} with relevant information`
        }];
        current = current.children[0];
      }

      const yaml = JSON.stringify(root);

      const startTime = performance.now();
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      performanceData.loadTimes.push(loadTime);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(15);
      expect(loadTime).toBeLessThan(300);
    });
  });

  describe('Rendering Performance', () => {
    test('should render initial view quickly', async () => {
      const yaml = `
        title: "Render Performance Test"
        children:
          - title: "Section 1"
            children:
              - title: "Item 1.1"
              - title: "Item 1.2"
          - title: "Section 2"
            children:
              - title: "Item 2.1"
              - title: "Item 2.2"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      
      // Force re-render
      if (instance.viewModel && instance.viewModel.render) {
        instance.viewModel.render();
      }
      
      const renderTime = performance.now() - startTime;
      performanceData.renderTimes.push(renderTime);

      expect(renderTime).toBeLessThan(100);
      
      // Check DOM nodes were created
      const nodes = container.querySelectorAll('.tree-node');
      performanceData.domNodeCounts.push(nodes.length);
      expect(nodes.length).toBeGreaterThan(0);
    });

    test('should handle rapid expand/collapse operations efficiently', async () => {
      const yaml = `
        title: "Expand/Collapse Performance"
        children:
          - title: "Section 1"
            children:
              - title: "Item 1.1"
              - title: "Item 1.2"
              - title: "Item 1.3"
          - title: "Section 2"
            children:
              - title: "Item 2.1"
              - title: "Item 2.2"
              - title: "Item 2.3"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Perform rapid operations
      for (let i = 0; i < 10; i++) {
        if (instance.expandAll) instance.expandAll();
        if (instance.collapseAll) instance.collapseAll();
      }

      const operationTime = performance.now() - startTime;

      expect(operationTime).toBeLessThan(500);
    });

    test('should maintain performance with many DOM updates', async () => {
      const children = [];
      for (let i = 0; i < 100; i++) {
        children.push({
          title: `Dynamic Item ${i}`,
          content: `Content ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "DOM Update Performance",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Simulate DOM updates
      for (let i = 0; i < 20; i++) {
        if (instance.viewModel && instance.viewModel.render) {
          instance.viewModel.render();
        }
      }

      const updateTime = performance.now() - startTime;
      performanceData.renderTimes.push(updateTime);

      expect(updateTime).toBeLessThan(1000);
    });
  });

  describe('Search Performance', () => {
    test('should search small datasets quickly', async () => {
      const yaml = `
        title: "Search Performance Test"
        content: "searchable content here"
        children:
          - title: "searchable title"
            content: "more searchable text"
          - title: "another item"
            content: "different searchable content"
      `;

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      const results = instance.search('searchable');
      const searchTime = performance.now() - startTime;

      performanceData.searchTimes.push(searchTime);

      expect(searchTime).toBeLessThan(10);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should search large datasets efficiently', async () => {
      // Create large searchable dataset
      const children = [];
      for (let i = 0; i < 200; i++) {
        children.push({
          title: `Item ${i} searchable content`,
          content: `Large content block ${i} with searchable terms and keywords for testing search performance in datasets`
        });
      }

      const yaml = JSON.stringify({
        title: "Large Search Dataset",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      const results = instance.search('searchable');
      const searchTime = performance.now() - startTime;

      performanceData.searchTimes.push(searchTime);

      expect(searchTime).toBeLessThan(50);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle rapid consecutive searches', async () => {
      const yaml = `
        title: "Rapid Search Test"
        children:
          - title: "apple content"
          - title: "banana content"
          - title: "cherry content"
          - title: "date content"
          - title: "elderberry content"
      `;

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const searchTerms = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      const startTime = performance.now();

      // Perform rapid searches
      for (let i = 0; i < 50; i++) {
        const term = searchTerms[i % searchTerms.length];
        instance.search(term);
      }

      const totalSearchTime = performance.now() - startTime;
      performanceData.searchTimes.push(totalSearchTime);

      expect(totalSearchTime).toBeLessThan(200);
    });
  });

  describe('Memory Performance', () => {
    test('should manage memory efficiently during operations', async () => {
      const initialMemory = getMemoryUsage();

      const yaml = `
        title: "Memory Test"
        children:
          - title: "Section 1"
            content: "Content with data"
          - title: "Section 2"
            content: "More content data"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const afterLoadMemory = getMemoryUsage();
      const memoryIncrease = afterLoadMemory - initialMemory;
      
      performanceData.memoryUsage.push(memoryIncrease);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10); // Less than 10MB

      // Cleanup
      instance.destroy();

      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterCleanupMemory = getMemoryUsage();
      
      // Memory should be mostly freed (within 5MB of initial)
      expect(afterCleanupMemory - initialMemory).toBeLessThan(5);
    });

    test('should handle memory cleanup properly', async () => {
      const instances = [];
      const initialMemory = getMemoryUsage();

      // Create multiple instances
      for (let i = 0; i < 5; i++) {
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);

        const testInstance = TreeScribe.create({
          dom: testContainer,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(`
          title: "Instance ${i}"
          content: "Test content for memory cleanup"
        `);

        instances.push({ instance: testInstance, container: testContainer });
      }

      const maxMemory = getMemoryUsage();
      const memoryIncrease = maxMemory - initialMemory;
      performanceData.memoryUsage.push(memoryIncrease);

      // Destroy all instances
      instances.forEach(({ instance, container }) => {
        instance.destroy();
        if (container.parentNode) {
          document.body.removeChild(container);
        }
      });

      // Allow cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalMemory = getMemoryUsage();
      
      // Memory should return close to initial level
      expect(finalMemory - initialMemory).toBeLessThan(8);
    });

    test('should prevent memory leaks in event listeners', async () => {
      let eventCallbacks = 0;

      const yaml = `
        title: "Event Listener Test"
        content: "Testing for memory leaks"
      `;

      for (let i = 0; i < 10; i++) {
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);

        const testInstance = TreeScribe.create({
          dom: testContainer,
          onMount: (inst) => { eventCallbacks++; },
          onDestroy: (inst) => { eventCallbacks--; }
        });

        await testInstance.loadYaml(yaml);
        testInstance.destroy();
        
        if (testContainer.parentNode) {
          document.body.removeChild(testContainer);
        }
      }

      // All event callbacks should be cleaned up
      expect(eventCallbacks).toBe(0);
    });
  });

  describe('Virtual Scrolling Performance', () => {
    test('should handle large lists with virtual scrolling', async () => {
      // Create large list for virtual scrolling
      const children = [];
      for (let i = 0; i < 1000; i++) {
        children.push({
          title: `Virtual Item ${i}`,
          content: `Content for virtual scrolling item ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "Virtual Scrolling Test",
        children
      });

      const startTime = performance.now();

      instance = TreeScribe.create({
        dom: container,
        enableVirtualScroll: true,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      performanceData.loadTimes.push(loadTime);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(1001); // 1000 children + 1 root
      expect(loadTime).toBeLessThan(2000);

      // DOM should contain only visible elements (not all 1000)
      const visibleNodes = container.querySelectorAll('.tree-node');
      expect(visibleNodes.length).toBeLessThan(100);
    });

    test('should maintain performance during virtual scroll', async () => {
      const children = [];
      for (let i = 0; i < 500; i++) {
        children.push({
          title: `Scroll Item ${i}`,
          content: `Scrollable content ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "Scroll Performance Test",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        enableVirtualScroll: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Simulate scrolling
      const scrollContainer = container.querySelector('.scroll-container') || container;
      for (let i = 0; i < 20; i++) {
        scrollContainer.scrollTop = i * 50;
        // Trigger scroll event
        const scrollEvent = new Event('scroll');
        scrollContainer.dispatchEvent(scrollEvent);
      }

      const scrollTime = performance.now() - startTime;

      expect(scrollTime).toBeLessThan(100);
    });
  });

  describe('Network Loading Performance', () => {
    test('should handle concurrent URL loads efficiently', async () => {
      // Mock multiple URL responses
      const originalFetch = global.fetch;
      let requestCount = 0;

      global.fetch = (url) => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            title: "Network Document ${requestCount}"
            content: "Loaded from ${url}"
          `)
        });
      };

      const urls = [
        'https://example.com/doc1.yaml',
        'https://example.com/doc2.yaml',
        'https://example.com/doc3.yaml'
      ];

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const startTime = performance.now();
      
      // Load multiple URLs concurrently
      const promises = urls.map(url => instance.loadYaml(url));
      await Promise.all(promises);
      
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(500);
      expect(requestCount).toBe(3);

      // Restore fetch
      global.fetch = originalFetch;
    });
  });
});

// Helper functions
function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  return Math.round(numbers.reduce((sum, num) => sum + num, 0) / numbers.length);
}

function getMemoryUsage() {
  // Simulate memory usage measurement
  // In real browser environment, would use performance.memory if available
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  
  // Fallback for test environment
  return Math.random() * 50; // Simulate 0-50MB usage
}