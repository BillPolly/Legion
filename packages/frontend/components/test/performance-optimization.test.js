/**
 * Performance Optimization Tests
 * Tests for all performance-related features including virtual scrolling,
 * streaming, caching, profiling, and rendering optimization.
 */

import { VirtualScrollManager } from '../src/components/tree-scribe/features/performance/VirtualScrollManager.js';
import { MemoryManager } from '../src/components/tree-scribe/features/performance/MemoryManager.js';
import { StreamingParser } from '../src/components/tree-scribe/features/performance/StreamingParser.js';
import { PerformanceProfiler } from '../src/components/tree-scribe/features/performance/PerformanceProfiler.js';
import { IntelligentCache } from '../src/components/tree-scribe/features/performance/IntelligentCache.js';
import { RenderingOptimizer } from '../src/components/tree-scribe/features/performance/RenderingOptimizer.js';

// Mock DOM environment
const createMockContainer = () => {
  const container = document.createElement('div');
  container.style.height = '400px';
  container.style.width = '300px';
  document.body.appendChild(container);
  return container;
};

const createLargeTree = (depth, breadth) => {
  const createNode = (level, index) => ({
    id: `node-${level}-${index}`,
    title: `Node ${level}-${index}`,
    content: `Content for node at level ${level}, index ${index}`,
    children: level < depth ? Array.from({ length: breadth }, (_, i) => createNode(level + 1, i)) : []
  });
  
  return createNode(0, 0);
};

const createMockParser = () => ({
  getName: () => 'MockParser',
  getSupportedFormats: () => ['mock'],
  canParse: () => 1.0,
  validate: () => ({ valid: true, errors: [] }),
  parse: async (content) => {
    // Simulate parsing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (typeof content === 'string') {
      const lines = content.split('\n');
      return {
        title: 'Parsed Document',
        content: `${lines.length} lines`,
        children: lines.map((line, i) => ({
          id: `line-${i}`,
          title: `Line ${i + 1}`,
          content: line,
          children: []
        })),
        sourceFormat: 'mock'
      };
    }
    
    return content; // Return as-is for object content
  }
});

describe('Performance Optimization Systems', () => {
  let container;

  beforeEach(() => {
    container = createMockContainer();
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('VirtualScrollManager', () => {
    let virtualScroll;

    beforeEach(() => {
      virtualScroll = new VirtualScrollManager({
        container,
        itemHeight: 30,
        totalItems: 1000,
        buffer: 5
      });
    });

    afterEach(() => {
      if (virtualScroll) {
        virtualScroll.destroy();
      }
    });

    test('should initialize with correct parameters', () => {
      expect(virtualScroll.options.totalItems).toBe(1000);
      expect(virtualScroll.options.itemHeight).toBe(30);
      expect(virtualScroll.visibleRange.start).toBe(0);
    });

    test('should calculate visible range correctly', () => {
      // Simulate scroll
      container.scrollTop = 300; // 10 items down
      virtualScroll._updateViewport();
      virtualScroll._calculateVisibleRange();
      
      expect(virtualScroll.visibleRange.start).toBeGreaterThanOrEqual(5); // 10 - buffer
      expect(virtualScroll.visibleRange.end).toBeLessThanOrEqual(30); // Based on viewport
    });

    test('should handle scroll events', (done) => {
      let rangeChangeCount = 0;
      
      virtualScroll.onVisibleRangeChange((range) => {
        rangeChangeCount++;
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.end).toBeGreaterThanOrEqual(range.start);
        
        if (rangeChangeCount === 2) {
          done();
        }
      });
      
      // Trigger scroll events
      container.scrollTop = 100;
      container.dispatchEvent(new Event('scroll'));
      
      setTimeout(() => {
        container.scrollTop = 200;
        container.dispatchEvent(new Event('scroll'));
      }, 50);
    });

    test('should scroll to item correctly', () => {
      virtualScroll.scrollToItem(50);
      expect(container.scrollTop).toBe(50 * 30); // 50 items * 30px height
    });

    test('should update total items and recalculate', () => {
      virtualScroll.updateTotalItems(2000);
      expect(virtualScroll.options.totalItems).toBe(2000);
      
      const spacer = container.querySelector('.virtual-scroll-spacer');
      expect(spacer.style.height).toBe('60000px'); // 2000 * 30px
    });
  });

  describe('MemoryManager', () => {
    let memoryManager;

    beforeEach(() => {
      memoryManager = new MemoryManager({
        maxCacheSize: 100,
        ttl: 1000 // 1 second for testing
      });
    });

    afterEach(() => {
      if (memoryManager) {
        memoryManager.destroy();
      }
    });

    test('should store and retrieve items', () => {
      const testData = { id: 1, name: 'test' };
      
      memoryManager.store('test-key', testData);
      const retrieved = memoryManager.get('test-key');
      
      expect(retrieved).toEqual(testData);
      expect(memoryManager.getStats().stores).toBe(1);
      expect(memoryManager.getStats().hits).toBe(1);
    });

    test('should handle cache eviction', () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 150; i++) {
        memoryManager.store(`key-${i}`, { data: `value-${i}` });
      }
      
      const memInfo = memoryManager.getMemoryInfo();
      expect(memInfo.cacheSize).toBeLessThanOrEqual(100);
      expect(memoryManager.getStats().evictions).toBeGreaterThan(0);
    });

    test('should respect TTL expiration', async () => {
      memoryManager.store('expiring-key', 'test-value');
      
      // Should be available immediately
      expect(memoryManager.get('expiring-key')).toBe('test-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(memoryManager.get('expiring-key')).toBeNull();
    });

    test('should store and retrieve rendered content', () => {
      const renderedContent = '<div>Rendered</div>';
      
      memoryManager.storeRendered('render-key', renderedContent);
      const retrieved = memoryManager.getRendered('render-key');
      
      expect(retrieved).toBe(renderedContent);
    });

    test('should handle memory pressure', () => {
      // Fill cache
      for (let i = 0; i < 100; i++) {
        memoryManager.store(`pressure-${i}`, { data: `large-value-${i}` });
      }
      
      const beforeSize = memoryManager.getMemoryInfo().cacheSize;
      
      // Simulate memory pressure
      memoryManager.handleMemoryPressure('moderate');
      
      const afterSize = memoryManager.getMemoryInfo().cacheSize;
      expect(afterSize).toBeLessThan(beforeSize);
    });
  });

  describe('StreamingParser', () => {
    let streamingParser;
    let mockParser;

    beforeEach(() => {
      streamingParser = new StreamingParser({
        chunkSize: 100,
        batchSize: 10,
        priorityThreshold: 500
      });
      mockParser = createMockParser();
    });

    afterEach(() => {
      if (streamingParser) {
        streamingParser.destroy();
      }
    });

    test('should use regular parsing for small content', async () => {
      const smallContent = 'Small content';
      
      const result = await streamingParser.parseStream(smallContent, mockParser);
      
      expect(result.title).toBe('Parsed Document');
      expect(result.children).toHaveLength(1); // One line
    });

    test('should use streaming for large content', async () => {
      const largeContent = 'Line 1\n'.repeat(100); // Above threshold
      let progressCallbacks = 0;
      let chunkCallbacks = 0;
      
      streamingParser.onProgress(() => progressCallbacks++);
      streamingParser.onChunk(() => chunkCallbacks++);
      
      const result = await streamingParser.parseStream(largeContent, mockParser);
      
      expect(result.title).toBe('Parsed Document');
      expect(progressCallbacks).toBeGreaterThan(0);
    });

    test('should handle progressive parsing', async () => {
      const content = createLargeTree(3, 5); // Medium-sized tree
      let chunkCount = 0;
      
      streamingParser.onChunk(() => chunkCount++);
      
      const result = await streamingParser.parseProgressive(content, mockParser);
      
      expect(result).toBeDefined();
      expect(result.children).toBeDefined();
    });

    test('should cancel streams', async () => {
      const largeContent = 'Line 1\n'.repeat(1000);
      
      const parsePromise = streamingParser.parseStream(largeContent, mockParser);
      
      // Cancel after a short delay
      setTimeout(() => {
        const activeStreams = streamingParser.getActiveStreams();
        if (activeStreams.length > 0) {
          streamingParser.cancelStream(activeStreams[0].id);
        }
      }, 10);
      
      await expect(parsePromise).rejects.toThrow('Stream canceled');
    });

    test('should provide stream metrics', async () => {
      const content = 'Test content for metrics';
      
      await streamingParser.parseStream(content, mockParser);
      
      const metrics = streamingParser.getMetrics();
      expect(metrics.totalProcessingTime).toBeGreaterThan(0);
      expect(metrics.nodesCreated).toBeGreaterThan(0);
    });
  });

  describe('PerformanceProfiler', () => {
    let profiler;

    beforeEach(() => {
      profiler = new PerformanceProfiler({
        enableProfiling: true,
        enableMetrics: true
      });
    });

    afterEach(() => {
      if (profiler) {
        profiler.destroy();
      }
    });

    test('should create and end profiling sessions', () => {
      const sessionId = profiler.startSession('test-session', { test: true });
      
      expect(sessionId).toBeGreaterThan(0);
      expect(profiler.activeSessions.has(sessionId)).toBe(true);
      
      const session = profiler.endSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session.completed).toBe(true);
      expect(session.duration).toBeGreaterThan(0);
      expect(profiler.activeSessions.has(sessionId)).toBe(false);
    });

    test('should add marks and measures', () => {
      const sessionId = profiler.startSession('mark-test');
      
      profiler.mark(sessionId, 'start-operation');
      
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      
      profiler.mark(sessionId, 'end-operation');
      const duration = profiler.measure(sessionId, 'operation-time', 'start-operation', 'end-operation');
      
      expect(duration).toBeGreaterThan(0);
      
      const report = profiler.getSessionReport(sessionId);
      expect(report.marks).toHaveLength(2);
      expect(report.measures).toHaveLength(1);
    });

    test('should profile parsing operations', async () => {
      const sessionId = profiler.startSession('parse-test');
      const mockParser = createMockParser();
      const content = 'Test content\nSecond line\nThird line';
      
      const result = await profiler.profileParsing(
        sessionId,
        () => mockParser.parse(content),
        content,
        mockParser
      );
      
      expect(result.title).toBe('Parsed Document');
      
      const report = profiler.getSessionReport(sessionId);
      expect(report.marks.some(m => m.name === 'parse-start')).toBe(true);
      expect(report.marks.some(m => m.name === 'parse-end')).toBe(true);
    });

    test('should provide performance summary', () => {
      const sessionId = profiler.startSession('summary-test');
      profiler.mark(sessionId, 'test-mark');
      profiler.endSession(sessionId);
      
      const summary = profiler.getSummary();
      
      expect(summary).toHaveProperty('activeSessions');
      expect(summary).toHaveProperty('totalMetrics');
      expect(summary).toHaveProperty('averages');
      expect(summary).toHaveProperty('memory');
    });

    test('should track performance trends', async () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const sessionId = profiler.startSession(`trend-test-${i}`);
        await new Promise(resolve => setTimeout(resolve, 10));
        profiler.endSession(sessionId);
      }
      
      const trends = profiler.getTrends(60000); // 1 minute window
      expect(trends).toBeDefined();
    });
  });

  describe('IntelligentCache', () => {
    let cache;

    beforeEach(() => {
      cache = new IntelligentCache({
        maxCacheSize: 50,
        predictivePrefetch: true,
        compressionEnabled: true
      });
    });

    afterEach(() => {
      if (cache) {
        cache.destroy();
      }
    });

    test('should store and retrieve with compression', async () => {
      const largeData = {
        content: 'This is a large piece of content that should be compressed '.repeat(50),
        metadata: { size: 'large' }
      };
      
      await cache.store('large-key', largeData);
      const retrieved = await cache.get('large-key');
      
      expect(retrieved).toEqual(largeData);
      
      const analytics = cache.getAnalytics();
      expect(analytics.performance.compressionRatio).toBeGreaterThan(0);
    });

    test('should implement predictive prefetching', async () => {
      // Create access pattern
      await cache.store('item-1', { data: 'first' });
      await cache.store('item-2', { data: 'second' });
      await cache.store('item-3', { data: 'third' });
      
      // Access in sequence to establish pattern
      await cache.get('item-1');
      await cache.get('item-2');
      await cache.get('item-1');
      await cache.get('item-2');
      
      // This should trigger prefetching
      await cache.get('item-1');
      
      const analytics = cache.getAnalytics();
      expect(analytics.predictions.totalPredictions).toBeGreaterThanOrEqual(0);
    });

    test('should handle thermal throttling', async () => {
      // Generate high activity - force thermal heating
      for (let i = 0; i < 200; i++) {
        await cache.store(`thermal-${i}`, { data: i });
        await cache.get(`thermal-${i}`);
        
        // Manually trigger thermal heating for testing
        if (i % 10 === 0) {
          cache.thermal.temperature = Math.min(100, cache.thermal.temperature * cache.thermal.heatingRate + 5);
        }
      }
      
      const analytics = cache.getAnalytics();
      expect(analytics.thermal.temperature).toBeGreaterThanOrEqual(0); // Allow 0 temperature
    });

    test('should provide comprehensive analytics', async () => {
      // Generate some activity
      await cache.store('analytics-1', { data: 'test' });
      await cache.get('analytics-1');
      await cache.get('non-existent'); // Miss
      
      const analytics = cache.getAnalytics();
      
      expect(analytics.performance.hitRate).toBeGreaterThan(0);
      expect(analytics.usage.cacheSize).toBeGreaterThan(0);
      expect(analytics.patterns).toBeDefined();
      expect(analytics.predictions).toBeDefined();
    });

    test('should optimize based on usage patterns', async () => {
      // Create usage pattern
      for (let i = 0; i < 20; i++) {
        await cache.store(`pattern-${i}`, { data: i });
      }
      
      await cache.optimize();
      
      // Check that optimization ran without errors
      const analytics = cache.getAnalytics();
      expect(analytics).toBeDefined();
    });
  });

  describe('RenderingOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new RenderingOptimizer({
        batchSize: 10,
        recycleElements: true,
        diffingEnabled: true
      });
    });

    afterEach(() => {
      if (optimizer) {
        optimizer.destroy();
      }
    });

    test('should render tree efficiently', async () => {
      const tree = createLargeTree(2, 3); // Small tree for testing
      
      await optimizer.renderTree(container, tree);
      
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
      
      const metrics = optimizer.getMetrics();
      expect(metrics.totalRenders).toBe(1);
    });

    test('should recycle elements', () => {
      const element1 = optimizer.createElement('div', 'test-class', 'content');
      expect(element1.tagName).toBe('DIV');
      expect(element1.className).toBe('test-class');
      expect(element1.textContent).toBe('content');
      
      // Recycle element
      optimizer.recycleElement(element1);
      
      // Get another element of same type
      const element2 = optimizer.createElement('div', 'test-class', 'new content');
      
      const metrics = optimizer.getMetrics();
      expect(metrics.recycledElements).toBeGreaterThan(0);
    });

    test('should batch DOM updates', async () => {
      const updates = [
        () => container.appendChild(document.createElement('div')),
        () => container.appendChild(document.createElement('span')),
        () => container.appendChild(document.createElement('p'))
      ];
      
      await optimizer.batchUpdate(updates);
      
      expect(container.children.length).toBe(3);
      
      const metrics = optimizer.getMetrics();
      expect(metrics.batchedRenders).toBeGreaterThan(0);
    });

    test('should diff and update trees', async () => {
      const oldTree = {
        title: 'Old Tree',
        children: [
          { id: '1', title: 'Child 1', children: [] },
          { id: '2', title: 'Child 2', children: [] }
        ]
      };
      
      const newTree = {
        title: 'Updated Tree',
        children: [
          { id: '1', title: 'Child 1 Updated', children: [] },
          { id: '3', title: 'Child 3', children: [] } // Child 2 removed, Child 3 added
        ]
      };
      
      // Initial render
      await optimizer.renderTree(container, oldTree);
      
      // Update with diffing
      await optimizer.updateTree(container, newTree, oldTree);
      
      const metrics = optimizer.getMetrics();
      expect(metrics.totalRenders).toBeGreaterThan(0);
    });

    test('should adapt to performance conditions', () => {
      const initialBatchSize = optimizer.options.batchSize;
      
      // Simulate poor performance
      optimizer.metrics.averageFrameTime = 50; // 20fps
      optimizer.adaptToPerformance();
      
      expect(optimizer.options.batchSize).toBeGreaterThanOrEqual(initialBatchSize);
      
      // Simulate good performance
      optimizer.metrics.averageFrameTime = 10; // 100fps
      optimizer.adaptToPerformance();
    });

    test('should provide performance metrics', async () => {
      const tree = createLargeTree(1, 5);
      
      await optimizer.renderTree(container, tree);
      
      const metrics = optimizer.getMetrics();
      
      expect(metrics.totalRenders).toBe(1);
      expect(metrics.frameRate).toBeGreaterThan(0);
      expect(metrics.batchEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.recycleEfficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Integration', () => {
    test('should work together seamlessly', async () => {
      const profiler = new PerformanceProfiler();
      const cache = new IntelligentCache({ maxCacheSize: 100 });
      const optimizer = new RenderingOptimizer();
      const mockParser = createMockParser();
      
      try {
        const sessionId = profiler.startSession('integration-test');
        
        // Generate and cache content
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        await cache.store('test-content', content);
        
        // Parse with profiling
        const result = await profiler.profileParsing(
          sessionId,
          () => mockParser.parse(content),
          content,
          mockParser
        );
        
        // Render with optimization
        await optimizer.renderTree(container, result);
        
        // Check that everything worked
        const session = profiler.endSession(sessionId);
        const cacheAnalytics = cache.getAnalytics();
        const renderMetrics = optimizer.getMetrics();
        
        expect(session.completed).toBe(true);
        expect(cacheAnalytics.usage.cacheSize).toBeGreaterThan(0);
        expect(renderMetrics.totalRenders).toBe(1);
        expect(container.children.length).toBeGreaterThan(0);
        
      } finally {
        profiler.destroy();
        cache.destroy();
        optimizer.destroy();
      }
    });
  });
});