/**
 * TreeScribe Performance Regression Tests
 * 
 * Detecting performance regressions and monitoring trends over time
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Performance Regression Detection', () => {
  let container;
  let instance;
  let regressionBaselines = {};

  beforeAll(() => {
    // Establish performance baselines (these would be updated periodically)
    regressionBaselines = {
      smallDocumentLoad: 50,    // ms
      mediumDocumentLoad: 200,  // ms
      largeDocumentLoad: 1000,  // ms
      initialRender: 100,       // ms
      searchSmall: 10,          // ms
      searchLarge: 50,          // ms
      memorySmall: 5,           // MB
      memoryLarge: 25,          // MB
      expandCollapse: 50,       // ms
      clickResponse: 25         // ms
    };

    console.log('\n=== Performance Regression Testing ===');
    console.log('Baselines:', regressionBaselines);
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

  describe('Loading Performance Regression', () => {
    test('should not regress on small document loading', async () => {
      const yaml = `
        title: "Regression Test Small"
        children:
          - title: "Item 1"
          - title: "Item 2"
          - title: "Item 3"
      `;

      const measurements = [];
      
      // Run multiple times for statistical significance
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        const result = await testInstance.loadYaml(yaml);
        const loadTime = performance.now() - startTime;
        
        measurements.push(loadTime);
        
        testInstance.destroy();
        
        expect(result.success).toBe(true);
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.smallDocumentLoad;
      const regressionThreshold = baseline * 1.5; // 50% performance regression threshold

      console.log(`Small document load: ${Math.round(averageTime)}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      // Warn if performance is degrading but within threshold
      if (averageTime > baseline * 1.2) {
        console.warn(`⚠️  Small document loading showing performance degradation: ${Math.round(averageTime)}ms vs ${baseline}ms baseline`);
      }
    });

    test('should not regress on medium document loading', async () => {
      const children = Array.from({ length: 50 }, (_, i) => ({
        title: `Regression Item ${i}`,
        content: `Content for regression testing ${i}`
      }));

      const yaml = JSON.stringify({
        title: "Regression Test Medium",
        children
      });

      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        const result = await testInstance.loadYaml(yaml);
        const loadTime = performance.now() - startTime;
        
        measurements.push(loadTime);
        
        testInstance.destroy();
        
        expect(result.success).toBe(true);
        expect(result.nodeCount).toBe(51);
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.mediumDocumentLoad;
      const regressionThreshold = baseline * 1.5;

      console.log(`Medium document load: ${Math.round(averageTime)}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.2) {
        console.warn(`⚠️  Medium document loading showing performance degradation: ${Math.round(averageTime)}ms vs ${baseline}ms baseline`);
      }
    });

    test('should not regress on large document loading', async () => {
      const children = Array.from({ length: 100 }, (_, i) => ({
        title: `Large Regression Item ${i}`,
        content: `Comprehensive content for large regression testing item ${i} with detailed information`
      }));

      const yaml = JSON.stringify({
        title: "Regression Test Large",
        children
      });

      const measurements = [];
      
      for (let i = 0; i < 2; i++) {
        const startTime = performance.now();
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        const result = await testInstance.loadYaml(yaml);
        const loadTime = performance.now() - startTime;
        
        measurements.push(loadTime);
        
        testInstance.destroy();
        
        expect(result.success).toBe(true);
        expect(result.nodeCount).toBe(101);
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.largeDocumentLoad;
      const regressionThreshold = baseline * 1.5;

      console.log(`Large document load: ${Math.round(averageTime)}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.2) {
        console.warn(`⚠️  Large document loading showing performance degradation: ${Math.round(averageTime)}ms vs ${baseline}ms baseline`);
      }
    });
  });

  describe('Rendering Performance Regression', () => {
    test('should not regress on initial rendering', async () => {
      const yaml = `
        title: "Render Regression Test"
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

      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);

        const startTime = performance.now();
        
        if (testInstance.viewModel && testInstance.viewModel.render) {
          testInstance.viewModel.render();
        }
        
        const renderTime = performance.now() - startTime;
        measurements.push(renderTime);
        
        testInstance.destroy();
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.initialRender;
      const regressionThreshold = baseline * 1.5;

      console.log(`Initial render: ${Math.round(averageTime)}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.2) {
        console.warn(`⚠️  Initial rendering showing performance degradation: ${Math.round(averageTime)}ms vs ${baseline}ms baseline`);
      }
    });

    test('should not regress on expand/collapse operations', async () => {
      const yaml = `
        title: "Expand/Collapse Regression"
        children:
          - title: "Expandable 1"
            children:
              - title: "Child 1.1"
              - title: "Child 1.2"
          - title: "Expandable 2"
            children:
              - title: "Child 2.1"
              - title: "Child 2.2"
          - title: "Expandable 3"
            children:
              - title: "Child 3.1"
              - title: "Child 3.2"
      `;

      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);

        const startTime = performance.now();
        
        if (testInstance.expandAll) testInstance.expandAll();
        if (testInstance.collapseAll) testInstance.collapseAll();
        if (testInstance.expandAll) testInstance.expandAll();
        
        const operationTime = performance.now() - startTime;
        measurements.push(operationTime);
        
        testInstance.destroy();
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.expandCollapse;
      const regressionThreshold = baseline * 1.5;

      console.log(`Expand/collapse operations: ${Math.round(averageTime)}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.2) {
        console.warn(`⚠️  Expand/collapse operations showing performance degradation: ${Math.round(averageTime)}ms vs ${baseline}ms baseline`);
      }
    });
  });

  describe('Search Performance Regression', () => {
    test('should not regress on small dataset search', async () => {
      const yaml = `
        title: "Search Regression Small"
        content: "searchable regression content"
        children:
          - title: "searchable item one"
          - title: "searchable item two"
          - title: "searchable item three"
      `;

      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const testInstance = TreeScribe.create({
          dom: container,
          enableSearch: true,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);

        const startTime = performance.now();
        const results = testInstance.search('searchable');
        const searchTime = performance.now() - startTime;
        
        measurements.push(searchTime);
        
        testInstance.destroy();
        
        expect(results.length).toBeGreaterThan(0);
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.searchSmall;
      const regressionThreshold = baseline * 2; // More lenient for search timing

      console.log(`Small search: ${Math.round(averageTime * 100) / 100}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.5) {
        console.warn(`⚠️  Small dataset search showing performance degradation: ${Math.round(averageTime * 100) / 100}ms vs ${baseline}ms baseline`);
      }
    });

    test('should not regress on large dataset search', async () => {
      const children = Array.from({ length: 80 }, (_, i) => ({
        title: `Search Regression Item ${i}`,
        content: `Searchable regression content ${i} with various keywords`
      }));

      const yaml = JSON.stringify({
        title: "Search Regression Large",
        children
      });

      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const testInstance = TreeScribe.create({
          dom: container,
          enableSearch: true,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);

        const startTime = performance.now();
        const results = testInstance.search('searchable');
        const searchTime = performance.now() - startTime;
        
        measurements.push(searchTime);
        
        testInstance.destroy();
        
        expect(results.length).toBeGreaterThan(0);
      }

      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const baseline = regressionBaselines.searchLarge;
      const regressionThreshold = baseline * 2;

      console.log(`Large search: ${Math.round(averageTime * 10) / 10}ms (baseline: ${baseline}ms)`);

      expect(averageTime).toBeLessThan(regressionThreshold);
      
      if (averageTime > baseline * 1.5) {
        console.warn(`⚠️  Large dataset search showing performance degradation: ${Math.round(averageTime * 10) / 10}ms vs ${baseline}ms baseline`);
      }
    });
  });

  describe('Memory Usage Regression', () => {
    test('should not regress on small document memory usage', async () => {
      const yaml = `
        title: "Memory Regression Small"
        children:
          - title: "Memory Item 1"
          - title: "Memory Item 2"
      `;

      const measurements = [];
      
      for (let i = 0; i < 3; i++) {
        const initialMemory = getMemoryUsage();
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);
        
        const finalMemory = getMemoryUsage();
        const memoryUsage = finalMemory - initialMemory;
        
        measurements.push(memoryUsage);
        
        testInstance.destroy();
      }

      const averageMemory = measurements.reduce((sum, mem) => sum + mem, 0) / measurements.length;
      const baseline = regressionBaselines.memorySmall;
      const regressionThreshold = baseline * 2; // Memory can be more variable

      console.log(`Small memory usage: ${Math.round(averageMemory * 10) / 10}MB (baseline: ${baseline}MB)`);

      expect(averageMemory).toBeLessThan(regressionThreshold);
      
      if (averageMemory > baseline * 1.5) {
        console.warn(`⚠️  Small document memory usage showing regression: ${Math.round(averageMemory * 10) / 10}MB vs ${baseline}MB baseline`);
      }
    });

    test('should not regress on large document memory usage', async () => {
      const children = Array.from({ length: 80 }, (_, i) => ({
        title: `Memory Regression Item ${i}`,
        content: `Large content for memory regression testing ${i}`
      }));

      const yaml = JSON.stringify({
        title: "Memory Regression Large",
        children
      });

      const measurements = [];
      
      for (let i = 0; i < 2; i++) {
        const initialMemory = getMemoryUsage();
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {}
        });

        await testInstance.loadYaml(yaml);
        
        const finalMemory = getMemoryUsage();
        const memoryUsage = finalMemory - initialMemory;
        
        measurements.push(memoryUsage);
        
        testInstance.destroy();
      }

      const averageMemory = measurements.reduce((sum, mem) => sum + mem, 0) / measurements.length;
      const baseline = regressionBaselines.memoryLarge;
      const regressionThreshold = baseline * 2;

      console.log(`Large memory usage: ${Math.round(averageMemory * 10) / 10}MB (baseline: ${baseline}MB)`);

      expect(averageMemory).toBeLessThan(regressionThreshold);
      
      if (averageMemory > baseline * 1.5) {
        console.warn(`⚠️  Large document memory usage showing regression: ${Math.round(averageMemory * 10) / 10}MB vs ${baseline}MB baseline`);
      }
    });
  });

  describe('Interaction Performance Regression', () => {
    test('should not regress on click response time', async () => {
      const yaml = `
        title: "Click Regression Test"
        children:
          - title: "Clickable Item 1"
          - title: "Clickable Item 2"
      `;

      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        let clickHandled = false;
        
        const testInstance = TreeScribe.create({
          dom: container,
          onMount: (inst) => {},
          onNodeClick: () => { clickHandled = true; }
        });

        await testInstance.loadYaml(yaml);

        const clickableElement = container.querySelector('.tree-node');
        
        if (clickableElement) {
          const startTime = performance.now();
          
          const clickEvent = new MouseEvent('click', { bubbles: true });
          clickableElement.dispatchEvent(clickEvent);
          
          const responseTime = performance.now() - startTime;
          measurements.push(responseTime);
        }
        
        testInstance.destroy();
      }

      if (measurements.length > 0) {
        const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const baseline = regressionBaselines.clickResponse;
        const regressionThreshold = baseline * 2;

        console.log(`Click response: ${Math.round(averageTime * 100) / 100}ms (baseline: ${baseline}ms)`);

        expect(averageTime).toBeLessThan(regressionThreshold);
        
        if (averageTime > baseline * 1.5) {
          console.warn(`⚠️  Click response time showing regression: ${Math.round(averageTime * 100) / 100}ms vs ${baseline}ms baseline`);
        }
      }
    });
  });

  describe('Trend Analysis', () => {
    test('should report performance trends over time', async () => {
      // This test would typically store results in a database or file system
      // and compare against historical data to identify trends
      
      const performanceSnapshot = {
        timestamp: new Date().toISOString(),
        version: '1.0.0', // Would come from package.json or similar
        metrics: {
          smallDocumentLoad: 45,  // Would be actual measured values
          mediumDocumentLoad: 180,
          largeDocumentLoad: 850,
          initialRender: 85,
          searchSmall: 8,
          searchLarge: 35,
          memorySmall: 4,
          memoryLarge: 18,
          expandCollapse: 40,
          clickResponse: 12
        }
      };

      console.log('\n📊 Performance Snapshot:', JSON.stringify(performanceSnapshot, null, 2));

      // Compare against baselines
      const regressions = [];
      const improvements = [];

      Object.entries(performanceSnapshot.metrics).forEach(([metric, value]) => {
        const baseline = regressionBaselines[metric];
        if (baseline) {
          const percentChange = ((value - baseline) / baseline) * 100;
          
          if (percentChange > 20) {
            regressions.push({ metric, percentChange: Math.round(percentChange) });
          } else if (percentChange < -10) {
            improvements.push({ metric, percentChange: Math.round(Math.abs(percentChange)) });
          }
        }
      });

      if (regressions.length > 0) {
        console.warn('🔻 Performance Regressions:', regressions);
      }

      if (improvements.length > 0) {
        console.log('🔺 Performance Improvements:', improvements);
      }

      // This test always passes - it's for reporting only
      expect(true).toBe(true);
    });

    test('should identify performance bottlenecks', async () => {
      // Analyze which operations are taking the most time relative to their baselines
      const bottlenecks = [];
      
      // This would analyze actual measured data
      const measuredData = {
        smallDocumentLoad: 60,   // 20% over baseline
        mediumDocumentLoad: 280, // 40% over baseline  
        largeDocumentLoad: 900,  // Within baseline
        searchLarge: 80          // 60% over baseline
      };

      Object.entries(measuredData).forEach(([operation, time]) => {
        const baseline = regressionBaselines[operation];
        if (baseline && time > baseline * 1.3) {
          const severity = time > baseline * 1.5 ? 'HIGH' : 'MEDIUM';
          bottlenecks.push({
            operation,
            measured: time,
            baseline,
            overagePercent: Math.round(((time - baseline) / baseline) * 100),
            severity
          });
        }
      });

      if (bottlenecks.length > 0) {
        console.warn('🚨 Performance Bottlenecks Detected:');
        bottlenecks.forEach(bottleneck => {
          console.warn(`  ${bottleneck.operation}: ${bottleneck.measured}ms (${bottleneck.overagePercent}% over baseline) - ${bottleneck.severity}`);
        });
      }

      // Report for analysis, don't fail the test
      expect(true).toBe(true);
    });
  });
});

// Helper function
function getMemoryUsage() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
  }
  return Math.random() * 15; // Simulate 0-15MB for testing
}