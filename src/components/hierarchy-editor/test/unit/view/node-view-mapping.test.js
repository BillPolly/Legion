/**
 * NodeViewMapping Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('NodeViewMapping', () => {
  let mapping;
  let container1, container2, container3;

  beforeEach(async () => {
    const { NodeViewMapping } = await import('../../../view/NodeViewMapping.js');
    mapping = new NodeViewMapping();
    
    // Create test containers
    container1 = createTestContainer();
    container2 = createTestContainer();
    container3 = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container1);
    cleanupTestContainer(container2);
    cleanupTestContainer(container3);
  });

  describe('Basic Functionality', () => {
    test('should initialize with empty mappings', () => {
      expect(mapping.modelToView.size).toBe(0);
      expect(mapping.dirtyNodes.size).toBe(0);
    });

    test('should register model-view pairs', () => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);

      expect(mapping.modelToView.get('node1')).toBe(container1);
      expect(mapping.modelToView.get('node2')).toBe(container2);
      expect(mapping.viewToModel.get(container1)).toBe('node1');
      expect(mapping.viewToModel.get(container2)).toBe('node2');
    });

    test('should unregister mappings', () => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);

      mapping.unregister('node1');

      expect(mapping.modelToView.get('node1')).toBeUndefined();
      expect(mapping.viewToModel.get(container1)).toBeUndefined();
      expect(mapping.modelToView.get('node2')).toBe(container2);
    });
  });

  describe('Element Retrieval', () => {
    beforeEach(() => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);
    });

    test('should get element by node ID', () => {
      expect(mapping.getElement('node1')).toBe(container1);
      expect(mapping.getElement('node2')).toBe(container2);
      expect(mapping.getElement('nonexistent')).toBeUndefined();
    });

    test('should get node ID by element', () => {
      expect(mapping.getNodeId(container1)).toBe('node1');
      expect(mapping.getNodeId(container2)).toBe('node2');
      expect(mapping.getNodeId(container3)).toBeUndefined();
    });
  });

  describe('Dirty Node Tracking', () => {
    beforeEach(() => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);
      mapping.register('node3', container3);
    });

    test('should mark nodes as dirty', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node2');

      expect(mapping.isDirty('node1')).toBe(true);
      expect(mapping.isDirty('node2')).toBe(true);
      expect(mapping.isDirty('node3')).toBe(false);
    });

    test('should get dirty nodes', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node3');

      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes).toContain('node1');
      expect(dirtyNodes).toContain('node3');
      expect(dirtyNodes).not.toContain('node2');
      expect(dirtyNodes.length).toBe(2);
    });

    test('should clear dirty state', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node2');

      expect(mapping.getDirtyNodes().length).toBe(2);

      mapping.clearDirty();

      expect(mapping.getDirtyNodes().length).toBe(0);
      expect(mapping.isDirty('node1')).toBe(false);
      expect(mapping.isDirty('node2')).toBe(false);
    });

    test('should handle duplicate dirty marks', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node1');
      mapping.markDirty('node1');

      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.filter(id => id === 'node1').length).toBe(1);
      expect(dirtyNodes.length).toBe(1);
    });
  });

  describe('Bulk Operations', () => {
    test('should clear all mappings', () => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);
      mapping.markDirty('node1');

      mapping.clear();

      expect(mapping.modelToView.size).toBe(0);
      expect(mapping.dirtyNodes.size).toBe(0);
      expect(mapping.viewToModel.get(container1)).toBeUndefined();
    });

    test('should get all registered node IDs', () => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);
      mapping.register('node3', container3);

      const nodeIds = mapping.getAllNodeIds();
      expect(nodeIds).toContain('node1');
      expect(nodeIds).toContain('node2');
      expect(nodeIds).toContain('node3');
      expect(nodeIds.length).toBe(3);
    });
  });

  describe('Statistics', () => {
    test('should provide mapping statistics', () => {
      mapping.register('node1', container1);
      mapping.register('node2', container2);
      mapping.markDirty('node1');

      const stats = mapping.getStats();
      expect(stats.totalMappings).toBe(2);
      expect(stats.dirtyNodes).toBe(1);
    });

    test('should update statistics as mappings change', () => {
      const initialStats = mapping.getStats();
      expect(initialStats.totalMappings).toBe(0);
      expect(initialStats.dirtyNodes).toBe(0);

      mapping.register('node1', container1);
      mapping.markDirty('node1');

      const updatedStats = mapping.getStats();
      expect(updatedStats.totalMappings).toBe(1);
      expect(updatedStats.dirtyNodes).toBe(1);

      mapping.unregister('node1');

      const finalStats = mapping.getStats();
      expect(finalStats.totalMappings).toBe(0);
      expect(finalStats.dirtyNodes).toBe(1); // Dirty state persists
    });
  });

  describe('WeakMap Integration', () => {
    test('should handle garbage collection gracefully', () => {
      let tempElement = document.createElement('div');
      mapping.register('node1', tempElement);

      expect(mapping.getElement('node1')).toBe(tempElement);
      expect(mapping.getNodeId(tempElement)).toBe('node1');

      // Remove reference and force cleanup
      tempElement = null;

      // WeakMap should handle garbage collection, but we can't easily test it
      // The mapping should still exist in modelToView but viewToModel might be cleaned up
      expect(mapping.modelToView.has('node1')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined gracefully', () => {
      expect(() => mapping.register(null, container1)).not.toThrow();
      expect(() => mapping.register('node1', null)).not.toThrow();
      expect(() => mapping.unregister(null)).not.toThrow();
      expect(() => mapping.markDirty(null)).not.toThrow();
      
      expect(mapping.getElement(null)).toBeUndefined();
      expect(mapping.getNodeId(null)).toBeUndefined();
      expect(mapping.isDirty(null)).toBe(false);
    });

    test('should handle empty strings and special characters', () => {
      mapping.register('', container1);
      mapping.register('node-with-special-chars!@#$%', container2);

      expect(mapping.getElement('')).toBe(container1);
      expect(mapping.getElement('node-with-special-chars!@#$%')).toBe(container2);
    });

    test('should handle registering same node with different elements', () => {
      mapping.register('node1', container1);
      mapping.register('node1', container2); // Override

      expect(mapping.getElement('node1')).toBe(container2);
      expect(mapping.getNodeId(container1)).toBeUndefined();
      expect(mapping.getNodeId(container2)).toBe('node1');
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle large numbers of mappings efficiently', () => {
      const startTime = performance.now();
      
      // Register 1000 mappings
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div');
        mapping.register(`node${i}`, element);
      }

      const registrationTime = performance.now() - startTime;
      expect(registrationTime).toBeLessThan(100); // Should be very fast

      // Mark half as dirty
      const dirtyStartTime = performance.now();
      for (let i = 0; i < 500; i++) {
        mapping.markDirty(`node${i}`);
      }

      const dirtyTime = performance.now() - dirtyStartTime;
      expect(dirtyTime).toBeLessThan(50); // Should be very fast

      // Verify counts
      expect(mapping.getStats().totalMappings).toBe(1000);
      expect(mapping.getStats().dirtyNodes).toBe(500);
    });
  });
});