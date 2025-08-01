/**
 * Incremental Rendering Infrastructure Tests
 */
import { createTestContainer, cleanupTestContainer, createTestNode } from '../../test-helpers.js';

describe('Incremental Rendering Infrastructure', () => {
  let mapping;
  let container;

  beforeEach(async () => {
    const { NodeViewMapping } = await import('../../../view/NodeViewMapping.js');
    mapping = new NodeViewMapping();
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Registering Node-Element Pairs', () => {
    test('should register new node-element pairs', () => {
      const element = document.createElement('div');
      element.className = 'hierarchy-node';
      container.appendChild(element);

      mapping.register('node1', element);

      expect(mapping.getElement('node1')).toBe(element);
      expect(mapping.getNodeId(element)).toBe('node1');
      expect(mapping.getStats().totalMappings).toBe(1);
    });

    test('should handle multiple node-element registrations', () => {
      const elements = [];
      for (let i = 0; i < 5; i++) {
        const element = document.createElement('div');
        element.className = 'hierarchy-node';
        element.dataset.nodeId = `node${i}`;
        container.appendChild(element);
        elements.push(element);
        
        mapping.register(`node${i}`, element);
      }

      // Verify all registrations
      for (let i = 0; i < 5; i++) {
        expect(mapping.getElement(`node${i}`)).toBe(elements[i]);
        expect(mapping.getNodeId(elements[i])).toBe(`node${i}`);
      }
      
      expect(mapping.getStats().totalMappings).toBe(5);
    });

    test('should update existing mappings when re-registering', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');
      container.appendChild(element1);
      container.appendChild(element2);

      // Initial registration
      mapping.register('node1', element1);
      expect(mapping.getElement('node1')).toBe(element1);
      expect(mapping.getNodeId(element1)).toBe('node1');

      // Re-register with different element
      mapping.register('node1', element2);
      expect(mapping.getElement('node1')).toBe(element2);
      expect(mapping.getNodeId(element2)).toBe('node1');
      expect(mapping.getNodeId(element1)).toBeUndefined(); // Old mapping cleaned up
    });

    test('should handle element lifecycle', () => {
      let element = document.createElement('div');
      element.className = 'hierarchy-node';
      container.appendChild(element);

      mapping.register('node1', element);
      expect(mapping.getStats().totalMappings).toBe(1);

      // Remove element from DOM
      container.removeChild(element);
      
      // Mapping should still exist (WeakMap handles cleanup automatically)
      expect(mapping.getElement('node1')).toBe(element);
      
      // Manually unregister
      mapping.unregister('node1');
      expect(mapping.getElement('node1')).toBeUndefined();
      expect(mapping.getStats().totalMappings).toBe(0);
    });
  });

  describe('Marking Nodes Dirty', () => {
    beforeEach(() => {
      // Set up test nodes
      for (let i = 1; i <= 3; i++) {
        const element = document.createElement('div');
        element.className = 'hierarchy-node';
        element.dataset.nodeId = `node${i}`;
        container.appendChild(element);
        mapping.register(`node${i}`, element);
      }
    });

    test('should mark individual nodes as dirty', () => {
      mapping.markDirty('node1');
      
      expect(mapping.isDirty('node1')).toBe(true);
      expect(mapping.isDirty('node2')).toBe(false);
      expect(mapping.isDirty('node3')).toBe(false);
      expect(mapping.getStats().dirtyNodes).toBe(1);
    });

    test('should mark multiple nodes as dirty', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node3');
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes).toContain('node1');
      expect(dirtyNodes).toContain('node3');
      expect(dirtyNodes).not.toContain('node2');
      expect(dirtyNodes.length).toBe(2);
    });

    test('should handle marking same node dirty multiple times', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node1');
      mapping.markDirty('node1');
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.filter(id => id === 'node1').length).toBe(1);
      expect(mapping.getStats().dirtyNodes).toBe(1);
    });

    test('should mark nodes dirty without requiring registration', () => {
      // Mark non-existent node as dirty
      mapping.markDirty('nonexistent-node');
      
      expect(mapping.isDirty('nonexistent-node')).toBe(true);
      expect(mapping.getStats().dirtyNodes).toBe(1);
    });

    test('should persist dirty state through registration changes', () => {
      mapping.markDirty('node1');
      expect(mapping.isDirty('node1')).toBe(true);
      
      // Unregister and re-register
      const element = mapping.getElement('node1');
      mapping.unregister('node1');
      mapping.register('node1', element);
      
      // Dirty state should persist
      expect(mapping.isDirty('node1')).toBe(true);
    });
  });

  describe('Batch Update Scheduling', () => {
    let updateQueue;
    let updateCallback;
    let callCount;

    beforeEach(() => {
      updateQueue = [];
      callCount = 0;
      updateCallback = function(nodeIds) {
        callCount++;
        updateQueue.push([...nodeIds]);
      };

      // Set up test nodes
      for (let i = 1; i <= 5; i++) {
        const element = document.createElement('div');
        element.className = 'hierarchy-node';
        container.appendChild(element);
        mapping.register(`node${i}`, element);
      }
    });

    test('should collect dirty nodes for batch processing', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node3');
      mapping.markDirty('node5');
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(3);
      expect(dirtyNodes).toContain('node1');
      expect(dirtyNodes).toContain('node3');
      expect(dirtyNodes).toContain('node5');
    });

    test('should process batch updates efficiently', () => {
      // Mark multiple nodes dirty
      mapping.markDirty('node1');
      mapping.markDirty('node2');
      mapping.markDirty('node4');
      
      // Simulate batch update
      const dirtyNodes = mapping.getDirtyNodes();
      updateCallback(dirtyNodes);
      
      expect(callCount).toBe(1);
      expect(updateQueue[0]).toEqual(expect.arrayContaining(['node1', 'node2', 'node4']));
      expect(updateQueue[0].length).toBe(3);
    });

    test('should clear dirty state after batch update', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node2');
      
      expect(mapping.getStats().dirtyNodes).toBe(2);
      
      // Process updates
      const dirtyNodes = mapping.getDirtyNodes();
      updateCallback(dirtyNodes);
      
      // Clear dirty state
      mapping.clearDirty();
      
      expect(mapping.getStats().dirtyNodes).toBe(0);
      expect(mapping.isDirty('node1')).toBe(false);
      expect(mapping.isDirty('node2')).toBe(false);
    });

    test('should handle empty batch updates', () => {
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(0);
      
      updateCallback(dirtyNodes);
      expect(callCount).toBe(1);
      expect(updateQueue[0]).toEqual([]);
    });

    test('should maintain order independence for batch updates', () => {
      // Mark nodes in different order
      mapping.markDirty('node3');
      mapping.markDirty('node1');
      mapping.markDirty('node2');
      
      const dirtyNodes = mapping.getDirtyNodes();
      updateCallback(dirtyNodes);
      
      // All nodes should be processed regardless of order
      expect(updateQueue[0]).toEqual(expect.arrayContaining(['node1', 'node2', 'node3']));
      expect(updateQueue[0].length).toBe(3);
    });
  });

  describe('Update Mechanism Integration', () => {
    let renderCallCount;
    let renderedNodes;

    beforeEach(() => {
      renderCallCount = 0;
      renderedNodes = [];

      // Mock render function
      function mockRender(nodeIds) {
        renderCallCount++;
        renderedNodes.push(...nodeIds);
      }

      // Set up test hierarchy
      const elements = [];
      for (let i = 1; i <= 3; i++) {
        const element = document.createElement('div');
        element.className = 'hierarchy-node';
        element.textContent = `Node ${i}`;
        container.appendChild(element);
        elements.push(element);
        mapping.register(`node${i}`, element);
      }
    });

    test('should trigger incremental updates only for dirty nodes', () => {
      mapping.markDirty('node2');
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes).toEqual(['node2']);
      
      // Only node2 should be updated
      expect(dirtyNodes.length).toBe(1);
      expect(mapping.getStats().totalMappings).toBe(3);
    });

    test('should handle mixed dirty and clean nodes', () => {
      mapping.markDirty('node1');
      mapping.markDirty('node3');
      
      const allNodes = mapping.getAllNodeIds();
      const dirtyNodes = mapping.getDirtyNodes();
      const cleanNodes = allNodes.filter(id => !mapping.isDirty(id));
      
      expect(allNodes.length).toBe(3);
      expect(dirtyNodes.length).toBe(2);
      expect(cleanNodes.length).toBe(1);
      expect(cleanNodes).toContain('node2');
    });

    test('should support incremental update workflow', () => {
      // Step 1: Mark nodes dirty
      mapping.markDirty('node1');
      mapping.markDirty('node3');
      
      // Step 2: Get dirty nodes for update
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(2);
      
      // Step 3: Process updates (simulated)
      const updatedElements = dirtyNodes.map(nodeId => mapping.getElement(nodeId));
      expect(updatedElements.length).toBe(2);
      expect(updatedElements.every(el => el instanceof HTMLElement)).toBe(true);
      
      // Step 4: Clear dirty state
      mapping.clearDirty();
      expect(mapping.getStats().dirtyNodes).toBe(0);
    });

    test('should handle concurrent dirty marking during updates', () => {
      mapping.markDirty('node1');
      
      // Simulate update cycle
      let dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes).toEqual(['node1']);
      
      // Mark additional nodes dirty during update
      mapping.markDirty('node2');
      mapping.markDirty('node3');
      
      // New dirty nodes should be available
      const newDirtyNodes = mapping.getDirtyNodes();
      expect(newDirtyNodes.length).toBe(3);
      expect(newDirtyNodes).toContain('node1');
      expect(newDirtyNodes).toContain('node2');
      expect(newDirtyNodes).toContain('node3');
    });
  });
});