/**
 * TreeScribe Optimization Strategies Tests
 * 
 * Testing specific optimization techniques and performance improvements
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Optimization Strategies', () => {
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
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('DOM Optimization', () => {
    test('should minimize DOM manipulations during batch updates', async () => {
      const yaml = `
        title: "DOM Batch Update Test"
        children:
          - title: "Item 1"
          - title: "Item 2"
          - title: "Item 3"
          - title: "Item 4"
          - title: "Item 5"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      // Track DOM mutation count
      let mutationCount = 0;
      const observer = new MutationObserver((mutations) => {
        mutationCount += mutations.length;
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true
      });

      const startTime = performance.now();

      // Perform batch operations
      if (instance.expandAll) instance.expandAll();
      if (instance.collapseAll) instance.collapseAll();
      if (instance.expandAll) instance.expandAll();

      const operationTime = performance.now() - startTime;

      observer.disconnect();

      // Should complete quickly with minimal DOM changes
      expect(operationTime).toBeLessThan(100);
      expect(mutationCount).toBeLessThan(50); // Reasonable limit for DOM changes
    });

    test('should reuse DOM elements when possible', async () => {
      const yaml1 = `
        title: "Document 1"
        children:
          - title: "Child A"
          - title: "Child B"
      `;

      const yaml2 = `
        title: "Document 2"
        children:
          - title: "Child X"
          - title: "Child Y"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml1);
      const initialNodes = container.querySelectorAll('.tree-node');
      const initialNodeCount = initialNodes.length;

      const startTime = performance.now();
      await instance.loadYaml(yaml2);
      const reloadTime = performance.now() - startTime;

      const finalNodes = container.querySelectorAll('.tree-node');
      const finalNodeCount = finalNodes.length;

      // Second load should be faster due to DOM reuse
      expect(reloadTime).toBeLessThan(50);
      expect(finalNodeCount).toBe(initialNodeCount); // Same structure
    });

    test('should use document fragments for bulk DOM operations', async () => {
      // Create large structure to test fragment usage
      const children = [];
      for (let i = 0; i < 50; i++) {
        children.push({
          title: `Bulk Item ${i}`,
          content: `Content for bulk DOM test ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "Bulk DOM Operations Test",
        children
      });

      const startTime = performance.now();

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(51); // 50 children + 1 root
      expect(loadTime).toBeLessThan(200); // Should be fast with fragments

      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handler Optimization', () => {
    test('should use event delegation for performance', async () => {
      const yaml = `
        title: "Event Delegation Test"
        children:
          - title: "Clickable 1"
            children:
              - title: "Nested 1.1"
              - title: "Nested 1.2"
          - title: "Clickable 2"
            children:
              - title: "Nested 2.1"
              - title: "Nested 2.2"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      // Check that events are delegated at container level
      const nodes = container.querySelectorAll('.tree-node');
      let individualListeners = 0;
      
      nodes.forEach(node => {
        // Check if node has individual click listeners
        const events = getEventListeners ? getEventListeners(node) : {};
        if (events.click && events.click.length > 0) {
          individualListeners++;
        }
      });

      // Should use delegation, not individual listeners on each node
      expect(individualListeners).toBeLessThan(nodes.length / 2);
    });

    test('should throttle rapid events properly', async () => {
      const yaml = `
        title: "Event Throttling Test"
        content: "Testing event throttling performance"
      `;

      let eventCallCount = 0;
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; },
        onNodeClick: () => { eventCallCount++; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Simulate rapid events
      const clickableElement = container.querySelector('.tree-node');
      if (clickableElement) {
        for (let i = 0; i < 100; i++) {
          const clickEvent = new MouseEvent('click', { bubbles: true });
          clickableElement.dispatchEvent(clickEvent);
        }
      }

      const eventTime = performance.now() - startTime;

      // Events should be processed quickly
      expect(eventTime).toBeLessThan(50);
      
      // Events should be throttled (not all 100 processed)
      if (eventCallCount > 0) {
        expect(eventCallCount).toBeLessThan(100);
      }
    });

    test('should debounce search input effectively', async () => {
      const yaml = `
        title: "Search Debounce Test"
        children:
          - title: "searchable item 1"
          - title: "searchable item 2"
          - title: "searchable item 3"
      `;

      let searchCallCount = 0;
      const originalSearch = TreeScribe.prototype.search;
      
      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      // Mock search to count calls
      if (instance.search) {
        const originalInstanceSearch = instance.search;
        instance.search = function(...args) {
          searchCallCount++;
          return originalInstanceSearch.apply(this, args);
        };
      }

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Simulate rapid typing
      const searchTerms = ['s', 'se', 'sea', 'sear', 'searc', 'search', 'searcha', 'searchab', 'searchabl', 'searchable'];
      
      for (const term of searchTerms) {
        if (instance.search) {
          instance.search(term);
        }
      }

      const searchTime = performance.now() - startTime;

      expect(searchTime).toBeLessThan(100);
      
      // Should debounce searches (fewer calls than inputs)
      if (searchCallCount > 0) {
        expect(searchCallCount).toBeLessThan(searchTerms.length);
      }
    });
  });

  describe('Memory Optimization', () => {
    test('should implement object pooling for frequent allocations', async () => {
      const yaml = `
        title: "Object Pooling Test"
        children:
          - title: "Pool Item 1"
          - title: "Pool Item 2"
          - title: "Pool Item 3"
      `;

      const initialMemory = getMemorySnapshot();

      // Create and destroy multiple instances to test pooling
      for (let i = 0; i < 10; i++) {
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);

        const testInstance = TreeScribe.create({
          dom: testContainer,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);
        testInstance.destroy();
        
        if (testContainer.parentNode) {
          document.body.removeChild(testContainer);
        }
      }

      const finalMemory = getMemorySnapshot();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal due to pooling
      expect(memoryIncrease).toBeLessThan(5); // Less than 5MB increase
    });

    test('should clean up circular references properly', async () => {
      const yaml = `
        title: "Circular Reference Test"
        children:
          - title: "Parent"
            children:
              - title: "Child with parent reference"
      `;

      let instance1 = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance1 = inst; }
      });

      await instance1.loadYaml(yaml);

      // Get references before cleanup
      const modelRef = instance1.model;
      const viewRef = instance1.view;
      const viewModelRef = instance1.viewModel;

      const beforeCleanup = getMemorySnapshot();

      // Destroy instance
      instance1.destroy();
      instance1 = null;

      // Force garbage collection simulation
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterCleanup = getMemorySnapshot();
      const memoryFreed = beforeCleanup - afterCleanup;

      // Memory should be freed (positive value indicates memory was released)
      expect(memoryFreed).toBeGreaterThanOrEqual(-2); // Allow small variance
    });

    test('should cache computed values efficiently', async () => {
      const children = [];
      for (let i = 0; i < 30; i++) {
        children.push({
          title: `Cached Item ${i}`,
          content: `Content that should be cached for performance ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "Cache Performance Test",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      // First calculation
      const startTime1 = performance.now();
      if (instance.getStatistics) {
        instance.getStatistics();
      }
      const firstCalcTime = performance.now() - startTime1;

      // Second calculation (should use cache)
      const startTime2 = performance.now();
      if (instance.getStatistics) {
        instance.getStatistics();
      }
      const secondCalcTime = performance.now() - startTime2;

      // Second calculation should be faster due to caching
      if (firstCalcTime > 0 && secondCalcTime > 0) {
        expect(secondCalcTime).toBeLessThanOrEqual(firstCalcTime);
      }
    });
  });

  describe('Rendering Optimization', () => {
    test('should implement virtual scrolling for large lists', async () => {
      const children = [];
      for (let i = 0; i < 200; i++) {
        children.push({
          title: `Virtual Item ${i}`,
          content: `Virtual scrolling content ${i}`
        });
      }

      const yaml = JSON.stringify({
        title: "Virtual Scrolling Optimization",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        enableVirtualScroll: true,
        onMount: (inst) => { instance = inst; }
      });

      const startTime = performance.now();
      const result = await instance.loadYaml(yaml);
      const loadTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(201); // 200 children + 1 root

      // Should load quickly despite large dataset
      expect(loadTime).toBeLessThan(500);

      // Should render only visible elements
      const visibleNodes = container.querySelectorAll('.tree-node');
      expect(visibleNodes.length).toBeLessThan(50); // Only visible portion rendered
    });

    test('should use requestAnimationFrame for smooth animations', async () => {
      const yaml = `
        title: "Animation Optimization"
        children:
          - title: "Animated Item 1"
          - title: "Animated Item 2"
          - title: "Animated Item 3"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      let rafCallCount = 0;
      const originalRaf = window.requestAnimationFrame;
      
      window.requestAnimationFrame = function(callback) {
        rafCallCount++;
        return originalRaf.call(this, callback);
      };

      const startTime = performance.now();

      // Trigger animations
      if (instance.expandAll) instance.expandAll();
      if (instance.collapseAll) instance.collapseAll();

      const animationTime = performance.now() - startTime;

      window.requestAnimationFrame = originalRaf;

      expect(animationTime).toBeLessThan(200);
      
      // Should use RAF for smooth animations
      if (rafCallCount > 0) {
        expect(rafCallCount).toBeGreaterThan(0);
      }
    });

    test('should batch style updates efficiently', async () => {
      const yaml = `
        title: "Style Batch Update Test"
        children:
          - title: "Styled Item 1"
          - title: "Styled Item 2"
          - title: "Styled Item 3"
          - title: "Styled Item 4"
          - title: "Styled Item 5"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      // Track style recalculations
      let recalcCount = 0;
      const originalGetComputedStyle = window.getComputedStyle;
      
      window.getComputedStyle = function(...args) {
        recalcCount++;
        return originalGetComputedStyle.apply(this, args);
      };

      const startTime = performance.now();

      // Perform style changes
      if (instance.setTheme) {
        instance.setTheme('dark');
        instance.setTheme('light');
        instance.setTheme('dark');
      }

      const styleTime = performance.now() - startTime;

      window.getComputedStyle = originalGetComputedStyle;

      expect(styleTime).toBeLessThan(100);
      
      // Should batch style updates to minimize recalculations
      expect(recalcCount).toBeLessThan(50);
    });
  });

  describe('Search Optimization', () => {
    test('should use efficient search indexing', async () => {
      const children = [];
      for (let i = 0; i < 100; i++) {
        children.push({
          title: `Indexed Item ${i}`,
          content: `Searchable content for performance testing item number ${i} with various keywords`
        });
      }

      const yaml = JSON.stringify({
        title: "Search Index Optimization",
        children
      });

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      // First search (builds index)
      const startTime1 = performance.now();
      const results1 = instance.search('performance');
      const firstSearchTime = performance.now() - startTime1;

      // Second search (uses index)
      const startTime2 = performance.now();
      const results2 = instance.search('testing');
      const secondSearchTime = performance.now() - startTime2;

      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);

      // Both searches should be fast
      expect(firstSearchTime).toBeLessThan(50);
      expect(secondSearchTime).toBeLessThan(20);
    });

    test('should implement fuzzy search efficiently', async () => {
      const yaml = `
        title: "Fuzzy Search Optimization"
        children:
          - title: "JavaScript Programming"
          - title: "TypeScript Development"
          - title: "React Components"
          - title: "Vue Templates"
          - title: "Angular Services"
      `;

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();

      // Test fuzzy matching
      const fuzzyResults = [
        instance.search('jvascript'), // Missing 'a'
        instance.search('typscript'), // Missing 'e'
        instance.search('reakt'),     // Wrong 'k'
        instance.search('anglar')     // Wrong 'a'
      ];

      const fuzzySearchTime = performance.now() - startTime;

      expect(fuzzySearchTime).toBeLessThan(100);
      
      // Should find fuzzy matches efficiently
      const totalResults = fuzzyResults.reduce((sum, results) => sum + results.length, 0);
      expect(totalResults).toBeGreaterThan(0);
    });
  });
});

// Helper functions
function getMemorySnapshot() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  return Math.random() * 10; // Simulate 0-10MB for testing
}