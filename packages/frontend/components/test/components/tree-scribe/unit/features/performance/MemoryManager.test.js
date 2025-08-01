/**
 * MemoryManager Tests
 * 
 * Testing memory management and caching for TreeScribe nodes
 */

import { MemoryManager } from '../../../../../../src/components/tree-scribe/features/performance/MemoryManager.js';

describe('MemoryManager', () => {
  let manager;

  beforeEach(() => {
    manager = new MemoryManager({
      maxCacheSize: 100,
      ttl: 5000 // 5 seconds
    });
  });

  afterEach(() => {
    if (manager && !manager.destroyed) {
      manager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const defaultManager = new MemoryManager();
      
      expect(defaultManager.options.maxCacheSize).toBe(500);
      expect(defaultManager.options.ttl).toBe(300000); // 5 minutes
      expect(defaultManager.options.checkInterval).toBe(60000); // 1 minute
      expect(defaultManager.destroyed).toBe(false);
      
      defaultManager.destroy();
    });

    test('should accept custom options', () => {
      expect(manager.options.maxCacheSize).toBe(100);
      expect(manager.options.ttl).toBe(5000);
      expect(manager.cache.size).toBe(0);
    });

    test('should start cleanup interval', () => {
      const cleanupManager = new MemoryManager({
        checkInterval: 1000
      });
      
      expect(cleanupManager.cleanupInterval).toBeDefined();
      
      cleanupManager.destroy();
    });
  });

  describe('Cache Operations', () => {
    test('should store items in cache', () => {
      const node = { id: 'node1', content: 'Test content' };
      
      manager.store('node1', node);
      
      expect(manager.cache.size).toBe(1);
      expect(manager.has('node1')).toBe(true);
    });

    test('should retrieve items from cache', () => {
      const node = { id: 'node1', content: 'Test content' };
      
      manager.store('node1', node);
      const retrieved = manager.get('node1');
      
      expect(retrieved).toEqual(node);
    });

    test('should update access time on get', (done) => {
      const node = { id: 'node1', content: 'Test content' };
      
      manager.store('node1', node);
      const entry1 = manager.cache.get('node1');
      const firstAccess = entry1.lastAccess;
      
      // Wait a bit and access again
      setTimeout(() => {
        manager.get('node1');
        const entry2 = manager.cache.get('node1');
        expect(entry2.lastAccess).toBeGreaterThan(firstAccess);
        done();
      }, 10);
    });

    test('should delete items from cache', () => {
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      
      expect(manager.cache.size).toBe(2);
      
      manager.delete('node1');
      
      expect(manager.cache.size).toBe(1);
      expect(manager.has('node1')).toBe(false);
      expect(manager.has('node2')).toBe(true);
    });

    test('should clear all items', () => {
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      manager.store('node3', { id: 'node3' });
      
      expect(manager.cache.size).toBe(3);
      
      manager.clear();
      
      expect(manager.cache.size).toBe(0);
    });
  });

  describe('Cache Size Management', () => {
    test('should evict oldest items when cache is full', () => {
      manager = new MemoryManager({ maxCacheSize: 3 });
      
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      manager.store('node3', { id: 'node3' });
      
      // Cache is now full
      expect(manager.cache.size).toBe(3);
      
      // Adding another should evict the oldest (node1)
      manager.store('node4', { id: 'node4' });
      
      expect(manager.cache.size).toBe(3);
      expect(manager.has('node1')).toBe(false);
      expect(manager.has('node4')).toBe(true);
    });

    test('should use LRU eviction policy', () => {
      manager = new MemoryManager({ maxCacheSize: 3 });
      
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      manager.store('node3', { id: 'node3' });
      
      // Access node1 to make it recently used
      manager.get('node1');
      
      // Adding another should evict node2 (least recently used)
      manager.store('node4', { id: 'node4' });
      
      expect(manager.has('node1')).toBe(true);
      expect(manager.has('node2')).toBe(false);
      expect(manager.has('node3')).toBe(true);
      expect(manager.has('node4')).toBe(true);
    });

    test('should handle batch stores efficiently', () => {
      const nodes = [];
      for (let i = 0; i < 50; i++) {
        nodes.push({ id: `node${i}`, content: `Content ${i}` });
      }
      
      manager.storeMany(nodes, (node) => node.id);
      
      // Should only keep maxCacheSize items
      expect(manager.cache.size).toBe(50);
      
      // Recent items should be in cache
      expect(manager.has('node49')).toBe(true);
      expect(manager.has('node45')).toBe(true);
    });
  });

  describe('TTL Expiration', () => {
    test('should expire items after TTL', () => {
      manager = new MemoryManager({ ttl: 100 }); // 100ms TTL
      
      manager.store('node1', { id: 'node1' });
      
      expect(manager.has('node1')).toBe(true);
      
      // Manually set created time to past
      const entry = manager.cache.get('node1');
      entry.created = Date.now() - 200; // 200ms ago
      
      // Try to get expired item
      expect(manager.get('node1')).toBeNull();
      expect(manager.has('node1')).toBe(false);
    });

    test('should cleanup expired items periodically', (done) => {
      manager = new MemoryManager({ 
        ttl: 50,
        checkInterval: 100 
      });
      
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      
      expect(manager.cache.size).toBe(2);
      
      // Manually expire items
      manager.cache.forEach(entry => {
        entry.created = Date.now() - 100;
      });
      
      // Wait for cleanup
      setTimeout(() => {
        expect(manager.cache.size).toBe(0);
        done();
      }, 150);
    });

    test('should reset TTL on access', () => {
      manager = new MemoryManager({ ttl: 1000 });
      
      manager.store('node1', { id: 'node1' });
      
      // Get initial access time
      const firstAccess = manager.cache.get('node1').lastAccess;
      
      // Access again
      manager.get('node1');
      
      const secondAccess = manager.cache.get('node1').lastAccess;
      
      // Access time should be updated
      expect(secondAccess).toBeGreaterThanOrEqual(firstAccess);
    });
  });

  describe('Memory Pressure Handling', () => {
    test('should monitor memory usage', () => {
      const memoryInfo = manager.getMemoryInfo();
      
      expect(memoryInfo.cacheSize).toBe(0);
      expect(memoryInfo.maxCacheSize).toBe(100);
      expect(memoryInfo.hitRate).toBe(0);
      expect(memoryInfo.missRate).toBe(0);
    });

    test('should track cache hit rate', () => {
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      
      // Hits
      manager.get('node1');
      manager.get('node2');
      manager.get('node1');
      
      // Misses
      manager.get('node3');
      manager.get('node4');
      
      const stats = manager.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3/5
    });

    test('should reduce cache size under memory pressure', () => {
      // Fill cache
      for (let i = 0; i < 100; i++) {
        manager.store(`node${i}`, { id: `node${i}`, data: new Array(1000).fill(0) });
      }
      
      expect(manager.cache.size).toBe(100);
      
      // Simulate memory pressure
      manager.handleMemoryPressure('critical');
      
      // Should reduce cache size
      expect(manager.cache.size).toBeLessThan(50);
    });

    test('should adjust eviction strategy under pressure', () => {
      manager.store('important', { id: 'important', priority: 'high' });
      manager.store('normal1', { id: 'normal1' });
      manager.store('normal2', { id: 'normal2' });
      
      // Mark important item
      manager.pin('important');
      
      // Handle pressure
      manager.handleMemoryPressure('moderate');
      
      // Important item should remain
      expect(manager.has('important')).toBe(true);
    });
  });

  describe('Node-Specific Optimizations', () => {
    test('should cache rendered content separately', () => {
      const node = { 
        id: 'node1', 
        content: 'Raw content',
        type: 'markdown'
      };
      
      const rendered = '<p>Rendered content</p>';
      
      manager.store('node1', node);
      manager.storeRendered('node1', rendered);
      
      expect(manager.getRendered('node1')).toBe(rendered);
    });

    test('should invalidate rendered cache on node update', () => {
      const node1 = { id: 'node1', content: 'Content 1' };
      const rendered1 = '<p>Rendered 1</p>';
      
      manager.store('node1', node1);
      manager.storeRendered('node1', rendered1);
      
      // Update node
      const node2 = { id: 'node1', content: 'Content 2' };
      manager.store('node1', node2);
      
      // Rendered cache should be invalidated
      expect(manager.getRendered('node1')).toBeNull();
    });

    test('should cache node metadata', () => {
      const metadata = {
        depth: 2,
        hasChildren: true,
        expanded: false,
        parentId: 'parent1'
      };
      
      manager.storeMetadata('node1', metadata);
      
      expect(manager.getMetadata('node1')).toEqual(metadata);
    });

    test('should batch prefetch related nodes', (done) => {
      const nodes = [
        { id: 'parent', children: ['child1', 'child2'] },
        { id: 'child1', parentId: 'parent' },
        { id: 'child2', parentId: 'parent' }
      ];
      
      manager.prefetchRelated('parent', async (ids) => {
        expect(ids).toContain('child1');
        expect(ids).toContain('child2');
        done();
        return nodes.filter(n => ids.includes(n.id));
      });
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure operation timings', () => {
      const timings = manager.getTimings();
      
      expect(timings.avgStoreTime).toBeDefined();
      expect(timings.avgGetTime).toBeDefined();
      expect(timings.avgEvictionTime).toBeDefined();
    });

    test('should track memory usage patterns', () => {
      // Add items over time
      for (let i = 0; i < 10; i++) {
        manager.store(`node${i}`, { id: `node${i}` });
      }
      
      const patterns = manager.getUsagePatterns();
      
      expect(patterns.growthRate).toBeGreaterThan(0);
      expect(patterns.averageItemSize).toBeGreaterThan(0);
      expect(patterns.peakUsage).toBeGreaterThan(0);
    });

    test('should provide optimization suggestions', () => {
      // Create inefficient usage pattern
      for (let i = 0; i < 200; i++) {
        manager.store(`node${i}`, { id: `node${i}` });
        manager.get(`node${i % 10}`); // Only access first 10
      }
      
      const suggestions = manager.getOptimizationSuggestions();
      
      expect(suggestions).toContain('cache size'); // Should suggest reducing cache
    });
  });

  describe('Serialization', () => {
    test('should serialize cache state', () => {
      manager.store('node1', { id: 'node1', content: 'Test' });
      manager.store('node2', { id: 'node2', content: 'Test2' });
      
      const serialized = manager.serialize();
      
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.entries).toHaveLength(2);
    });

    test('should deserialize cache state', () => {
      const state = {
        entries: [
          { key: 'node1', value: { id: 'node1' }, lastAccess: Date.now() },
          { key: 'node2', value: { id: 'node2' }, lastAccess: Date.now() }
        ]
      };
      
      manager.deserialize(JSON.stringify(state));
      
      expect(manager.cache.size).toBe(2);
      expect(manager.get('node1')).toEqual({ id: 'node1' });
      expect(manager.get('node2')).toEqual({ id: 'node2' });
    });

    test('should handle corrupted serialized data', () => {
      expect(() => {
        manager.deserialize('invalid json');
      }).not.toThrow();
      
      expect(manager.cache.size).toBe(0);
    });
  });

  describe('Integration', () => {
    test('should work with TreeScribe nodes', () => {
      const treeNode = {
        id: 'test-node',
        title: 'Test Node',
        content: '# Markdown content',
        children: ['child1', 'child2'],
        metadata: {
          type: 'markdown',
          created: Date.now()
        }
      };
      
      manager.store(treeNode.id, treeNode);
      
      const retrieved = manager.get(treeNode.id);
      expect(retrieved).toEqual(treeNode);
    });

    test('should handle node updates efficiently', () => {
      const node = { id: 'node1', version: 1, content: 'Original' };
      
      manager.store('node1', node);
      
      // Update node
      const updated = { ...node, version: 2, content: 'Updated' };
      manager.store('node1', updated);
      
      expect(manager.get('node1').version).toBe(2);
      expect(manager.get('node1').content).toBe('Updated');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup on destroy', () => {
      manager.store('node1', { id: 'node1' });
      manager.store('node2', { id: 'node2' });
      
      expect(manager.cache.size).toBe(2);
      
      manager.destroy();
      
      expect(manager.destroyed).toBe(true);
      expect(manager.cache.size).toBe(0);
    });

    test('should stop cleanup interval on destroy', () => {
      const intervalManager = new MemoryManager({
        checkInterval: 1000
      });
      
      expect(intervalManager.cleanupInterval).toBeDefined();
      
      intervalManager.destroy();
      
      expect(intervalManager.cleanupInterval).toBeNull();
    });

    test('should be safe to call destroy multiple times', () => {
      expect(() => {
        manager.destroy();
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });
});