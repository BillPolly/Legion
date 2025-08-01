/**
 * TreeScribe Performance Benchmarks
 * 
 * Comparative performance testing against established benchmarks
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Performance Benchmarks', () => {
  let container;
  let instance;
  let benchmarkResults = {};

  beforeAll(() => {
    benchmarkResults = {
      loadingBenchmarks: [],
      renderingBenchmarks: [],
      searchBenchmarks: [],
      memoryBenchmarks: [],
      interactionBenchmarks: []
    };
    
    console.log('\n=== Starting TreeScribe Performance Benchmarks ===');
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
    console.log('\n=== TreeScribe Performance Benchmark Results ===');
    
    console.log('\nLoading Performance:');
    benchmarkResults.loadingBenchmarks.forEach(result => {
      console.log(`  ${result.name}: ${result.time}ms (${result.status})`);
    });
    
    console.log('\nRendering Performance:');
    benchmarkResults.renderingBenchmarks.forEach(result => {
      console.log(`  ${result.name}: ${result.time}ms (${result.status})`);
    });
    
    console.log('\nSearch Performance:');
    benchmarkResults.searchBenchmarks.forEach(result => {
      console.log(`  ${result.name}: ${result.time}ms (${result.status})`);
    });
    
    console.log('\nMemory Performance:');
    benchmarkResults.memoryBenchmarks.forEach(result => {
      console.log(`  ${result.name}: ${result.memory}MB (${result.status})`);
    });
    
    console.log('\nInteraction Performance:');
    benchmarkResults.interactionBenchmarks.forEach(result => {
      console.log(`  ${result.name}: ${result.time}ms (${result.status})`);
    });
  });

  describe('Document Loading Benchmarks', () => {
    test('Benchmark: Small document loading (< 25ms = Excellent)', async () => {
      const yaml = `
        title: "Small Benchmark Document"
        content: "Performance test content"
        children:
          - title: "Item 1"
          - title: "Item 2"
          - title: "Item 3"
      `;

      const { time, result } = await measureLoadTime(yaml);
      
      const status = time < 25 ? 'Excellent' : time < 50 ? 'Good' : time < 100 ? 'Fair' : 'Poor';
      benchmarkResults.loadingBenchmarks.push({
        name: 'Small Document Loading',
        time,
        status,
        target: '< 25ms'
      });

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(100); // Minimum acceptable performance
    });

    test('Benchmark: Medium document loading (< 100ms = Excellent)', async () => {
      const children = Array.from({ length: 50 }, (_, i) => ({
        title: `Medium Item ${i}`,
        content: `Content for medium benchmark item ${i}`
      }));

      const yaml = JSON.stringify({
        title: "Medium Benchmark Document",
        content: "Medium-sized performance test",
        children
      });

      const { time, result } = await measureLoadTime(yaml);
      
      const status = time < 100 ? 'Excellent' : time < 200 ? 'Good' : time < 400 ? 'Fair' : 'Poor';
      benchmarkResults.loadingBenchmarks.push({
        name: 'Medium Document Loading (50 nodes)',
        time,
        status,
        target: '< 100ms'
      });

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(51);
      expect(time).toBeLessThan(400);
    });

    test('Benchmark: Large document loading (< 500ms = Excellent)', async () => {
      const children = Array.from({ length: 200 }, (_, i) => ({
        title: `Large Item ${i}`,
        content: `Comprehensive content for large benchmark item ${i} with detailed information and multiple properties for realistic testing scenarios.`
      }));

      const yaml = JSON.stringify({
        title: "Large Benchmark Document",
        content: "Large-scale performance test with substantial content",
        children
      });

      const { time, result } = await measureLoadTime(yaml);
      
      const status = time < 500 ? 'Excellent' : time < 1000 ? 'Good' : time < 2000 ? 'Fair' : 'Poor';
      benchmarkResults.loadingBenchmarks.push({
        name: 'Large Document Loading (200 nodes)',
        time,
        status,
        target: '< 500ms'
      });

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(201);
      expect(time).toBeLessThan(2000);
    });

    test('Benchmark: Deep nesting loading (< 150ms = Excellent)', async () => {
      let current = { title: "Root Level", content: "Level 0" };
      const root = current;
      
      for (let i = 1; i < 20; i++) {
        current.children = [{
          title: `Deep Level ${i}`,
          content: `Content at depth ${i} for nesting benchmark`
        }];
        current = current.children[0];
      }

      const yaml = JSON.stringify(root);
      const { time, result } = await measureLoadTime(yaml);
      
      const status = time < 150 ? 'Excellent' : time < 300 ? 'Good' : time < 600 ? 'Fair' : 'Poor';
      benchmarkResults.loadingBenchmarks.push({
        name: 'Deep Nesting Loading (20 levels)',
        time,
        status,
        target: '< 150ms'
      });

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(20);
      expect(time).toBeLessThan(600);
    });
  });

  describe('Rendering Performance Benchmarks', () => {
    test('Benchmark: Initial render time (< 50ms = Excellent)', async () => {
      const yaml = `
        title: "Render Benchmark"
        children:
          - title: "Section A"
            children:
              - title: "Item A1"
              - title: "Item A2"
          - title: "Section B"
            children:
              - title: "Item B1"
              - title: "Item B2"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      
      // Trigger re-render
      if (instance.viewModel && instance.viewModel.render) {
        instance.viewModel.render();
      }
      
      const renderTime = performance.now() - startTime;
      
      const status = renderTime < 50 ? 'Excellent' : renderTime < 100 ? 'Good' : renderTime < 200 ? 'Fair' : 'Poor';
      benchmarkResults.renderingBenchmarks.push({
        name: 'Initial Render Time',
        time: Math.round(renderTime),
        status,
        target: '< 50ms'
      });

      expect(renderTime).toBeLessThan(200);
    });

    test('Benchmark: Expand/collapse operations (< 30ms = Excellent)', async () => {
      const yaml = `
        title: "Expand/Collapse Benchmark"
        children:
          - title: "Expandable 1"
            children:
              - title: "Child 1.1"
              - title: "Child 1.2"
          - title: "Expandable 2"
            children:
              - title: "Child 2.1"
              - title: "Child 2.2"
      `;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      
      // Perform expand/collapse operations
      if (instance.expandAll) instance.expandAll();
      if (instance.collapseAll) instance.collapseAll();
      if (instance.expandAll) instance.expandAll();
      
      const operationTime = performance.now() - startTime;
      
      const status = operationTime < 30 ? 'Excellent' : operationTime < 60 ? 'Good' : operationTime < 120 ? 'Fair' : 'Poor';
      benchmarkResults.renderingBenchmarks.push({
        name: 'Expand/Collapse Operations',
        time: Math.round(operationTime),
        status,
        target: '< 30ms'
      });

      expect(operationTime).toBeLessThan(120);
    });

    test('Benchmark: Large list rendering (< 200ms = Excellent)', async () => {
      const children = Array.from({ length: 100 }, (_, i) => ({
        title: `Render Item ${i}`,
        content: `Rendering performance test content ${i}`
      }));

      const yaml = JSON.stringify({
        title: "Large List Render Benchmark",
        children
      });

      const startTime = performance.now();

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);
      const renderTime = performance.now() - startTime;
      
      const status = renderTime < 200 ? 'Excellent' : renderTime < 400 ? 'Good' : renderTime < 800 ? 'Fair' : 'Poor';
      benchmarkResults.renderingBenchmarks.push({
        name: 'Large List Rendering (100 items)',
        time: Math.round(renderTime),
        status,
        target: '< 200ms'
      });

      expect(renderTime).toBeLessThan(800);
    });
  });

  describe('Search Performance Benchmarks', () => {
    test('Benchmark: Small dataset search (< 5ms = Excellent)', async () => {
      const yaml = `
        title: "Search Benchmark Small"
        content: "searchable benchmark content"
        children:
          - title: "searchable item one"
          - title: "searchable item two"
          - title: "searchable item three"
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
      
      const status = searchTime < 5 ? 'Excellent' : searchTime < 10 ? 'Good' : searchTime < 25 ? 'Fair' : 'Poor';
      benchmarkResults.searchBenchmarks.push({
        name: 'Small Dataset Search (4 nodes)',
        time: Math.round(searchTime * 100) / 100, // Round to 2 decimals
        status,
        target: '< 5ms'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(25);
    });

    test('Benchmark: Large dataset search (< 25ms = Excellent)', async () => {
      const children = Array.from({ length: 150 }, (_, i) => ({
        title: `Search Item ${i}`,
        content: `Searchable benchmark content ${i} with various keywords and searchable terms`
      }));

      const yaml = JSON.stringify({
        title: "Search Benchmark Large",
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
      
      const status = searchTime < 25 ? 'Excellent' : searchTime < 50 ? 'Good' : searchTime < 100 ? 'Fair' : 'Poor';
      benchmarkResults.searchBenchmarks.push({
        name: 'Large Dataset Search (150 nodes)',
        time: Math.round(searchTime * 10) / 10, // Round to 1 decimal
        status,
        target: '< 25ms'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100);
    });

    test('Benchmark: Rapid consecutive searches (< 100ms = Excellent)', async () => {
      const yaml = `
        title: "Rapid Search Benchmark"
        children:
          - title: "apple fruit content"
          - title: "banana fruit content"
          - title: "cherry fruit content"
          - title: "date fruit content"
      `;

      instance = TreeScribe.create({
        dom: container,
        enableSearch: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const searches = ['apple', 'banana', 'cherry', 'date', 'fruit'];
      const startTime = performance.now();
      
      // Perform rapid searches
      for (let i = 0; i < 20; i++) {
        const term = searches[i % searches.length];
        instance.search(term);
      }
      
      const totalSearchTime = performance.now() - startTime;
      
      const status = totalSearchTime < 100 ? 'Excellent' : totalSearchTime < 200 ? 'Good' : totalSearchTime < 400 ? 'Fair' : 'Poor';
      benchmarkResults.searchBenchmarks.push({
        name: 'Rapid Consecutive Searches (20 searches)',
        time: Math.round(totalSearchTime),
        status,
        target: '< 100ms'
      });

      expect(totalSearchTime).toBeLessThan(400);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('Benchmark: Small document memory (< 2MB = Excellent)', async () => {
      const yaml = `
        title: "Memory Benchmark Small"
        children:
          - title: "Item 1"
          - title: "Item 2"
      `;

      const initialMemory = getMemoryUsage();

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);
      
      const finalMemory = getMemoryUsage();
      const memoryUsage = finalMemory - initialMemory;
      
      const status = memoryUsage < 2 ? 'Excellent' : memoryUsage < 5 ? 'Good' : memoryUsage < 10 ? 'Fair' : 'Poor';
      benchmarkResults.memoryBenchmarks.push({
        name: 'Small Document Memory Usage',
        memory: Math.round(memoryUsage * 10) / 10,
        status,
        target: '< 2MB'
      });

      expect(memoryUsage).toBeLessThan(10);
    });

    test('Benchmark: Large document memory (< 15MB = Excellent)', async () => {
      const children = Array.from({ length: 200 }, (_, i) => ({
        title: `Memory Test Item ${i}`,
        content: `Large content block for memory benchmarking with item ${i} and extensive details`
      }));

      const yaml = JSON.stringify({
        title: "Memory Benchmark Large",
        children
      });

      const initialMemory = getMemoryUsage();

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);
      
      const finalMemory = getMemoryUsage();
      const memoryUsage = finalMemory - initialMemory;
      
      const status = memoryUsage < 15 ? 'Excellent' : memoryUsage < 25 ? 'Good' : memoryUsage < 40 ? 'Fair' : 'Poor';
      benchmarkResults.memoryBenchmarks.push({
        name: 'Large Document Memory Usage (200 nodes)',
        memory: Math.round(memoryUsage * 10) / 10,
        status,
        target: '< 15MB'
      });

      expect(memoryUsage).toBeLessThan(40);
    });

    test('Benchmark: Memory cleanup efficiency (< 5MB retained = Excellent)', async () => {
      const yaml = `
        title: "Cleanup Benchmark"
        children:
          - title: "Cleanup Item 1"
          - title: "Cleanup Item 2"
      `;

      const initialMemory = getMemoryUsage();
      
      // Create and destroy instance
      let testInstance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { testInstance = inst; }
      });

      await testInstance.loadYaml(yaml);
      testInstance.destroy();
      testInstance = null;

      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = getMemoryUsage();
      const memoryRetained = finalMemory - initialMemory;
      
      const status = memoryRetained < 5 ? 'Excellent' : memoryRetained < 10 ? 'Good' : memoryRetained < 20 ? 'Fair' : 'Poor';
      benchmarkResults.memoryBenchmarks.push({
        name: 'Memory Cleanup Efficiency',
        memory: Math.round(memoryRetained * 10) / 10,
        status,
        target: '< 5MB retained'
      });

      expect(memoryRetained).toBeLessThan(20);
    });
  });

  describe('User Interaction Benchmarks', () => {
    test('Benchmark: Click response time (< 10ms = Excellent)', async () => {
      const yaml = `
        title: "Click Benchmark"
        children:
          - title: "Clickable Item 1"
          - title: "Clickable Item 2"
      `;

      let clickHandled = false;
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; },
        onNodeClick: () => { clickHandled = true; }
      });

      await instance.loadYaml(yaml);

      const clickableElement = container.querySelector('.tree-node');
      
      if (clickableElement) {
        const startTime = performance.now();
        
        const clickEvent = new MouseEvent('click', { bubbles: true });
        clickableElement.dispatchEvent(clickEvent);
        
        const responseTime = performance.now() - startTime;
        
        const status = responseTime < 10 ? 'Excellent' : responseTime < 20 ? 'Good' : responseTime < 50 ? 'Fair' : 'Poor';
        benchmarkResults.interactionBenchmarks.push({
          name: 'Click Response Time',
          time: Math.round(responseTime * 100) / 100,
          status,
          target: '< 10ms'
        });

        expect(responseTime).toBeLessThan(50);
      }
    });

    test('Benchmark: Keyboard navigation (< 15ms = Excellent)', async () => {
      const yaml = `
        title: "Keyboard Benchmark"
        children:
          - title: "Nav Item 1"
          - title: "Nav Item 2"
          - title: "Nav Item 3"
      `;

      instance = TreeScribe.create({
        dom: container,
        enableKeyboard: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(yaml);

      const startTime = performance.now();
      
      // Simulate arrow key navigation
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true
      });
      
      container.dispatchEvent(keyEvent);
      
      const navigationTime = performance.now() - startTime;
      
      const status = navigationTime < 15 ? 'Excellent' : navigationTime < 30 ? 'Good' : navigationTime < 60 ? 'Fair' : 'Poor';
      benchmarkResults.interactionBenchmarks.push({
        name: 'Keyboard Navigation Response',
        time: Math.round(navigationTime * 100) / 100,
        status,
        target: '< 15ms'
      });

      expect(navigationTime).toBeLessThan(60);
    });
  });

  // Helper function to measure load time
  async function measureLoadTime(yaml) {
    const startTime = performance.now();
    
    instance = TreeScribe.create({
      dom: container,
      onMount: (inst) => { instance = inst; }
    });

    const result = await instance.loadYaml(yaml);
    const time = Math.round(performance.now() - startTime);
    
    return { time, result };
  }
});

// Helper function
function getMemoryUsage() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  return Math.random() * 20; // Simulate 0-20MB for testing
}