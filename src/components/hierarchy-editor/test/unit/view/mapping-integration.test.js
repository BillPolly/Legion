/**
 * Mapping Integration Tests
 */
import { createTestContainer, cleanupTestContainer, createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('Mapping Integration', () => {
  let mapping;
  let mockView;
  let testHierarchy;
  let container;

  beforeEach(async () => {
    const { NodeViewMapping } = await import('../../../view/NodeViewMapping.js');
    mapping = new NodeViewMapping();
    
    container = createTestContainer();
    testHierarchy = createTestHierarchy();
    
    // Mock view for testing integration
    mockView = {
      mapping: mapping,
      container: container,
      renderedElements: new Map(),
      
      createElement(node) {
        const element = document.createElement('div');
        element.className = 'hierarchy-node';
        element.dataset.nodeId = node.id;
        element.dataset.nodeType = node.type;
        element.textContent = `${node.name}: ${node.value || ''}`;
        return element;
      },
      
      renderNode(node) {
        const element = this.createElement(node);
        this.container.appendChild(element);
        this.mapping.register(node.id, element);
        this.renderedElements.set(node.id, element);
        return element;
      },
      
      updateNode(nodeId) {
        const element = this.mapping.getElement(nodeId);
        if (element) {
          element.classList.add('updated');
          element.dataset.lastUpdate = Date.now().toString();
        }
      },
      
      removeNode(nodeId) {
        const element = this.mapping.getElement(nodeId);
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.mapping.unregister(nodeId);
        this.renderedElements.delete(nodeId);
      }
    };
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Mapping Lifecycle', () => {
    test('should create mappings during node creation', () => {
      const node = createTestNode('value', 'testNode', 'testValue');
      const element = mockView.renderNode(node);
      
      expect(mapping.getElement(node.id)).toBe(element);
      expect(mapping.getNodeId(element)).toBe(node.id);
      expect(mapping.getStats().totalMappings).toBe(1);
      expect(element.parentNode).toBe(container);
    });

    test('should handle hierarchy creation with multiple mappings', () => {
      const hierarchy = createTestHierarchy();
      const elements = [];
      
      // Render root and children
      elements.push(mockView.renderNode(hierarchy));
      hierarchy.children.forEach(child => {
        elements.push(mockView.renderNode(child));
      });
      
      expect(mapping.getStats().totalMappings).toBe(3); // root + 2 children
      expect(elements.length).toBe(3);
      
      // Verify all mappings
      elements.forEach(element => {
        const nodeId = mapping.getNodeId(element);
        expect(nodeId).toBeDefined();
        expect(mapping.getElement(nodeId)).toBe(element);
      });
    });

    test('should clean up mappings during node destruction', () => {
      const node = createTestNode('value', 'tempNode', 'tempValue');
      mockView.renderNode(node);
      
      expect(mapping.getStats().totalMappings).toBe(1);
      
      mockView.removeNode(node.id);
      
      expect(mapping.getStats().totalMappings).toBe(0);
      expect(mapping.getElement(node.id)).toBeUndefined();
      expect(mockView.renderedElements.has(node.id)).toBe(false);
    });

    test('should handle mapping persistence through view updates', () => {
      const node = createTestNode('value', 'persistentNode', 'originalValue');
      mockView.renderNode(node);
      
      const originalElement = mapping.getElement(node.id);
      expect(originalElement).toBeDefined();
      
      // Simulate update without recreation
      mockView.updateNode(node.id);
      
      // Mapping should persist
      expect(mapping.getElement(node.id)).toBe(originalElement);
      expect(originalElement.classList.contains('updated')).toBe(true);
      expect(originalElement.dataset.lastUpdate).toBeDefined();
    });
  });

  describe('Mapping Persistence During Updates', () => {
    let testNodes;

    beforeEach(() => {
      testNodes = [];
      for (let i = 1; i <= 5; i++) {
        const node = createTestNode('value', `node${i}`, `value${i}`);
        testNodes.push(node);
        mockView.renderNode(node);
      }
    });

    test('should maintain mappings during incremental updates', () => {
      const initialMappings = mapping.getStats().totalMappings;
      expect(initialMappings).toBe(5);
      
      // Mark some nodes dirty and update
      mapping.markDirty(testNodes[0].id);
      mapping.markDirty(testNodes[2].id);
      mapping.markDirty(testNodes[4].id);
      
      const dirtyNodes = mapping.getDirtyNodes();
      dirtyNodes.forEach(nodeId => mockView.updateNode(nodeId));
      
      // All mappings should still exist
      expect(mapping.getStats().totalMappings).toBe(initialMappings);
      
      // Updated elements should be marked
      dirtyNodes.forEach(nodeId => {
        const element = mapping.getElement(nodeId);
        expect(element.classList.contains('updated')).toBe(true);
      });
    });

    test('should handle partial hierarchy updates', () => {
      // Mark selective nodes for update
      mapping.markDirty(testNodes[1].id); // node2
      mapping.markDirty(testNodes[3].id); // node4
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(2);
      
      // Update only dirty nodes
      dirtyNodes.forEach(nodeId => mockView.updateNode(nodeId));
      
      // Verify selective updates
      testNodes.forEach((node, index) => {
        const element = mapping.getElement(node.id);
        if (index === 1 || index === 3) {
          expect(element.classList.contains('updated')).toBe(true);
        } else {
          expect(element.classList.contains('updated')).toBe(false);
        }
      });
    });

    test('should preserve mappings during bulk operations', () => {
      // Get all current mappings
      const allNodeIds = mapping.getAllNodeIds();
      expect(allNodeIds.length).toBe(5);
      
      // Mark all nodes dirty
      allNodeIds.forEach(nodeId => mapping.markDirty(nodeId));
      
      // Bulk update
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(5);
      
      dirtyNodes.forEach(nodeId => mockView.updateNode(nodeId));
      
      // All mappings should be preserved and all elements updated
      expect(mapping.getStats().totalMappings).toBe(5);
      allNodeIds.forEach(nodeId => {
        const element = mapping.getElement(nodeId);
        expect(element).toBeDefined();
        expect(element.classList.contains('updated')).toBe(true);
      });
    });

    test('should handle mapping updates with new elements', () => {
      const originalNode = testNodes[0];
      const originalElement = mapping.getElement(originalNode.id);
      
      // Create new element for same node (simulating re-render)
      const newElement = mockView.createElement(originalNode);
      container.appendChild(newElement);
      
      // Update mapping to new element
      mapping.register(originalNode.id, newElement);
      
      expect(mapping.getElement(originalNode.id)).toBe(newElement);
      expect(mapping.getNodeId(newElement)).toBe(originalNode.id);
      expect(mapping.getNodeId(originalElement)).toBeUndefined(); // Old mapping cleaned up
    });
  });

  describe('Element Lookup Performance', () => {
    let largeDataSet;

    beforeEach(() => {
      largeDataSet = [];
      
      // Create large dataset for performance testing
      for (let i = 0; i < 1000; i++) {
        const node = createTestNode('value', `perfNode${i}`, `value${i}`);
        largeDataSet.push(node);
        mockView.renderNode(node);
      }
    });

    test('should perform fast lookups with large datasets', () => {
      const startTime = performance.now();
      
      // Perform 1000 lookups
      for (let i = 0; i < 1000; i++) {
        const node = largeDataSet[i];
        const element = mapping.getElement(node.id);
        expect(element).toBeDefined();
        
        const foundNodeId = mapping.getNodeId(element);
        expect(foundNodeId).toBe(node.id);
      }
      
      const lookupTime = performance.now() - startTime;
      expect(lookupTime).toBeLessThan(50); // Should be very fast
    });

    test('should handle efficient dirty node tracking with large datasets', () => {
      const startTime = performance.now();
      
      // Mark 500 nodes dirty
      for (let i = 0; i < 500; i++) {
        mapping.markDirty(largeDataSet[i].id);
      }
      
      const dirtyTime = performance.now() - startTime;
      expect(dirtyTime).toBeLessThan(25);
      
      const dirtyNodes = mapping.getDirtyNodes();
      expect(dirtyNodes.length).toBe(500);
      expect(mapping.getStats().dirtyNodes).toBe(500);
    });

    test('should maintain performance during mixed operations', () => {
      const operations = [];
      const startTime = performance.now();
      
      // Mixed operations: lookups, dirty marking, clearing
      for (let i = 0; i < 100; i++) {
        const nodeIndex = i % largeDataSet.length;
        const node = largeDataSet[nodeIndex];
        
        // Lookup
        const element = mapping.getElement(node.id);
        operations.push('lookup');
        
        // Mark dirty
        mapping.markDirty(node.id);
        operations.push('dirty');
        
        // Check dirty status
        const isDirty = mapping.isDirty(node.id);
        operations.push('check');
      }
      
      // Clear all dirty
      mapping.clearDirty();
      operations.push('clear');
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(100);
      expect(operations.length).toBe(301); // 100 * 3 + 1
    });

    test('should handle concurrent access patterns efficiently', () => {
      const results = [];
      const startTime = performance.now();
      
      // Simulate concurrent read/write access
      const operations = [
        () => {
          // Batch lookups
          for (let i = 0; i < 100; i++) {
            const element = mapping.getElement(largeDataSet[i].id);
            results.push(element ? 'found' : 'missing');
          }
        },
        () => {
          // Batch dirty marking
          for (let i = 100; i < 200; i++) {
            mapping.markDirty(largeDataSet[i].id);
            results.push('marked');
          }
        },
        () => {
          // Stats collection
          for (let i = 0; i < 10; i++) {
            const stats = mapping.getStats();
            results.push(`stats-${stats.totalMappings}`);
          }
        }
      ];
      
      // Execute all operations
      operations.forEach(operation => operation());
      
      const concurrentTime = performance.now() - startTime;
      expect(concurrentTime).toBeLessThan(50);
      expect(results.length).toBe(210); // 100 + 100 + 10
    });
  });

  describe('View Layer Integration', () => {
    test('should integrate seamlessly with view rendering pipeline', () => {
      const hierarchy = createTestHierarchy();
      const renderOrder = [];
      
      // Enhanced mock view with render tracking
      const enhancedView = {
        ...mockView,
        renderNode(node) {
          renderOrder.push(node.id);
          return mockView.renderNode(node);
        }
      };
      
      // Render hierarchy
      enhancedView.renderNode(hierarchy);
      hierarchy.children.forEach(child => {
        enhancedView.renderNode(child);
      });
      
      expect(renderOrder.length).toBe(3);
      expect(mapping.getStats().totalMappings).toBe(3);
      
      // Verify DOM structure matches mappings
      renderOrder.forEach(nodeId => {
        const element = mapping.getElement(nodeId);
        expect(element.parentNode).toBe(container);
        expect(element.dataset.nodeId).toBe(nodeId);
      });
    });

    test('should support view refresh scenarios', () => {
      const node = createTestNode('object', 'refreshNode', null);
      mockView.renderNode(node);
      
      const originalElement = mapping.getElement(node.id);
      expect(originalElement).toBeDefined();
      
      // Simulate view refresh (remove and re-add)
      mockView.removeNode(node.id);
      expect(mapping.getElement(node.id)).toBeUndefined();
      
      const newElement = mockView.renderNode(node);
      expect(mapping.getElement(node.id)).toBe(newElement);
      expect(newElement).not.toBe(originalElement);
    });

    test('should handle view state synchronization', () => {
      const nodes = [];
      for (let i = 1; i <= 3; i++) {
        const node = createTestNode('value', `syncNode${i}`, `value${i}`);
        nodes.push(node);
        mockView.renderNode(node);
      }
      
      // Mark nodes dirty in view
      mapping.markDirty(nodes[0].id);
      mapping.markDirty(nodes[2].id);
      
      // Synchronize view state
      const dirtyNodes = mapping.getDirtyNodes();
      const viewState = {
        total: mapping.getStats().totalMappings,
        dirty: dirtyNodes.length,
        clean: mapping.getStats().totalMappings - dirtyNodes.length
      };
      
      expect(viewState.total).toBe(3);
      expect(viewState.dirty).toBe(2);
      expect(viewState.clean).toBe(1);
      
      // Apply updates
      dirtyNodes.forEach(nodeId => mockView.updateNode(nodeId));
      mapping.clearDirty();
      
      // Verify synchronized state
      expect(mapping.getStats().dirtyNodes).toBe(0);
      dirtyNodes.forEach(nodeId => {
        const element = mapping.getElement(nodeId);
        expect(element.classList.contains('updated')).toBe(true);
      });
    });
  });
});