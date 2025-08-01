/**
 * FoldingManager Tests
 * 
 * Testing FoldingManager class for node folding state management
 */

import { FoldingManager } from '../../../../../../src/components/tree-scribe/features/interaction/FoldingManager.js';
import { TreeScribeModel } from '../../../../../../src/components/tree-scribe/core/model/TreeScribeModel.js';

describe('FoldingManager', () => {
  let model;
  let foldingManager;

  beforeEach(() => {
    model = new TreeScribeModel();
    const yamlContent = `
title: Root Document
sections:
  - title: Section A
    id: section-a
    subsections:
      - title: Subsection A1
        id: subsection-a1
        description: Content A1
      - title: Subsection A2
        id: subsection-a2
        description: Content A2
  - title: Section B
    id: section-b
    description: Section B content
    subsections:
      - title: Subsection B1
        id: subsection-b1
        items:
          - title: Item B1-1
            id: item-b1-1
          - title: Item B1-2
            id: item-b1-2
`;
    model.loadYaml(yamlContent);
    foldingManager = new FoldingManager(model);
  });

  afterEach(() => {
    if (foldingManager) {
      foldingManager.destroy();
    }
    if (model) {
      model.destroy();
    }
  });

  describe('Individual Node Folding', () => {
    test('should expand individual node', () => {
      const success = foldingManager.expandNode('section-a');
      
      expect(success).toBe(true);
      const node = model.getNode('section-a');
      expect(node.state.expanded).toBe(true);
    });

    test('should collapse individual node', () => {
      // First expand the node
      foldingManager.expandNode('section-a');
      
      const success = foldingManager.collapseNode('section-a');
      
      expect(success).toBe(true);
      const node = model.getNode('section-a');
      expect(node.state.expanded).toBe(false);
    });

    test('should toggle individual node', () => {
      const node = model.getNode('section-a');
      const initialState = node.state.expanded;
      
      const success = foldingManager.toggleNode('section-a');
      
      expect(success).toBe(true);
      expect(node.state.expanded).toBe(!initialState);
      
      // Toggle back
      foldingManager.toggleNode('section-a');
      expect(node.state.expanded).toBe(initialState);
    });

    test('should handle non-existent node gracefully', () => {
      const success = foldingManager.toggleNode('non-existent');
      expect(success).toBe(false);
    });

    test('should handle leaf node folding', () => {
      // Leaf nodes can't be folded
      const success = foldingManager.toggleNode('item-b1-1');
      expect(success).toBe(false);
    });

    test('should emit events on node state change', () => {
      let eventFired = false;
      let eventData = null;
      
      foldingManager.on('nodeStateChanged', (data) => {
        eventFired = true;
        eventData = data;
      });
      
      foldingManager.expandNode('section-a');
      
      expect(eventFired).toBe(true);
      expect(eventData.nodeId).toBe('section-a');
      expect(eventData.expanded).toBe(true);
    });
  });

  describe('Global Folding Operations', () => {
    test('should expand all nodes', () => {
      foldingManager.expandAll();
      
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          expect(node.state.expanded).toBe(true);
        }
      });
    });

    test('should collapse all nodes', () => {
      // First expand all
      foldingManager.expandAll();
      
      foldingManager.collapseAll();
      
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isRoot() && !node.isLeaf()) {
          expect(node.state.expanded).toBe(false);
        }
      });
    });

    test('should preserve root node expansion on collapseAll', () => {
      foldingManager.expandAll();
      foldingManager.collapseAll();
      
      const rootNode = model.rootNode;
      expect(rootNode.state.expanded).toBe(true); // Root should stay expanded
    });

    test('should emit events for global operations', () => {
      let expandAllFired = false;
      let collapseAllFired = false;
      
      foldingManager.on('expandAll', () => { expandAllFired = true; });
      foldingManager.on('collapseAll', () => { collapseAllFired = true; });
      
      foldingManager.expandAll();
      foldingManager.collapseAll();
      
      expect(expandAllFired).toBe(true);
      expect(collapseAllFired).toBe(true);
    });
  });

  describe('Expand to Depth Functionality', () => {
    test('should expand to depth 1', () => {
      foldingManager.expandToDepth(1);
      
      const rootNode = model.rootNode;
      expect(rootNode.state.expanded).toBe(true); // Depth 0
      
      // Direct children (depth 1) should be expanded
      rootNode.children.forEach(child => {
        if (!child.isLeaf()) {
          expect(child.state.expanded).toBe(true);
        }
      });
      
      // Grandchildren (depth 2) should be collapsed
      rootNode.children.forEach(child => {
        child.children.forEach(grandchild => {
          if (!grandchild.isLeaf()) {
            expect(grandchild.state.expanded).toBe(false);
          }
        });
      });
    });

    test('should expand to depth 2', () => {
      foldingManager.expandToDepth(2);
      
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          const depth = node.getDepth();
          if (depth <= 2) {
            expect(node.state.expanded).toBe(true);
          } else {
            expect(node.state.expanded).toBe(false);
          }
        }
      });
    });

    test('should handle depth 0 (collapse all except root)', () => {
      foldingManager.expandAll();
      foldingManager.expandToDepth(0);
      
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          if (node.isRoot()) {
            expect(node.state.expanded).toBe(true);
          } else {
            expect(node.state.expanded).toBe(false);
          }
        }
      });
    });

    test('should handle negative depth gracefully', () => {
      const success = foldingManager.expandToDepth(-1);
      expect(success).toBe(false);
    });

    test('should emit expandToDepth event', () => {
      let eventFired = false;
      let eventDepth = null;
      
      foldingManager.on('expandToDepth', (data) => {
        eventFired = true;
        eventDepth = data.depth;
      });
      
      foldingManager.expandToDepth(2);
      
      expect(eventFired).toBe(true);
      expect(eventDepth).toBe(2);
    });
  });

  describe('Folding State Persistence', () => {
    test('should get current folding state', () => {
      foldingManager.expandNode('section-a');
      foldingManager.collapseNode('section-b');
      
      const state = foldingManager.getFoldingState();
      
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
      expect(state['section-a']).toBe(true);
      expect(state['section-b']).toBe(false);
    });

    test('should restore folding state', () => {
      const targetState = {
        'section-a': true,
        'section-b': false,
        'subsection-b1': true  // Only non-leaf node with children
      };
      
      const success = foldingManager.restoreFoldingState(targetState);
      
      expect(success).toBe(true);
      expect(model.getNode('section-a').state.expanded).toBe(true);
      expect(model.getNode('section-b').state.expanded).toBe(false);
      expect(model.getNode('subsection-b1').state.expanded).toBe(true);
    });

    test('should handle invalid state gracefully', () => {
      const invalidState = {
        'non-existent-node': true,
        'section-a': 'invalid-value'
      };
      
      const success = foldingManager.restoreFoldingState(invalidState);
      
      // Should succeed but ignore invalid entries
      expect(success).toBe(true);
    });

    test('should emit stateRestored event', () => {
      let eventFired = false;
      
      foldingManager.on('stateRestored', () => {
        eventFired = true;
      });
      
      foldingManager.restoreFoldingState({ 'section-a': true });
      
      expect(eventFired).toBe(true);
    });
  });

  describe('State History and Undo', () => {
    test('should track state history', () => {
      const history = foldingManager.getStateHistory();
      expect(Array.isArray(history)).toBe(true);
      
      const initialLength = history.length;
      
      foldingManager.expandNode('section-a');
      
      const newHistory = foldingManager.getStateHistory();
      expect(newHistory.length).toBe(initialLength + 1);
    });

    test('should undo last operation', () => {
      const node = model.getNode('section-a');
      const initialState = node.state.expanded;
      
      foldingManager.expandNode('section-a');
      expect(node.state.expanded).toBe(true);
      
      const success = foldingManager.undo();
      expect(success).toBe(true);
      expect(node.state.expanded).toBe(initialState);
    });

    test('should redo undone operation', () => {
      const node = model.getNode('section-a');
      
      foldingManager.expandNode('section-a');
      foldingManager.undo();
      
      const success = foldingManager.redo();
      expect(success).toBe(true);
      expect(node.state.expanded).toBe(true);
    });

    test('should handle undo when no history available', () => {
      const success = foldingManager.undo();
      expect(success).toBe(false);
    });

    test('should handle redo when no redo available', () => {
      const success = foldingManager.redo();
      expect(success).toBe(false);
    });

    test('should limit history size', () => {
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        foldingManager.toggleNode('section-a');
      }
      
      const history = foldingManager.getStateHistory();
      expect(history.length).toBeLessThanOrEqual(50); // Max history size
    });

    test('should emit undo/redo events', () => {
      let undoFired = false;
      let redoFired = false;
      
      foldingManager.on('undo', () => { undoFired = true; });
      foldingManager.on('redo', () => { redoFired = true; });
      
      foldingManager.expandNode('section-a');
      foldingManager.undo();
      foldingManager.redo();
      
      expect(undoFired).toBe(true);
      expect(redoFired).toBe(true);
    });
  });

  describe('Visual Folding Indicators', () => {
    test('should provide folding indicators for nodes', () => {
      const indicators = foldingManager.getFoldingIndicators();
      
      expect(indicators).toBeDefined();
      expect(typeof indicators).toBe('object');
      
      // Should have indicators for non-leaf nodes
      const allNodes = model.getAllNodes();
      const nonLeafNodes = allNodes.filter(node => !node.isLeaf());
      
      nonLeafNodes.forEach(node => {
        expect(indicators).toHaveProperty(node.id);
        expect(['expanded', 'collapsed', 'loading']).toContain(indicators[node.id]);
      });
    });

    test('should update indicators on state change', () => {
      const initialIndicators = foldingManager.getFoldingIndicators();
      
      foldingManager.expandNode('section-a');
      
      const updatedIndicators = foldingManager.getFoldingIndicators();
      expect(updatedIndicators['section-a']).toBe('expanded');
      expect(updatedIndicators['section-a']).not.toBe(initialIndicators['section-a']);
    });

    test('should provide loading indicators for async operations', () => {
      // Mock async operation
      foldingManager._setNodeLoading('section-a', true);
      
      const indicators = foldingManager.getFoldingIndicators();
      expect(indicators['section-a']).toBe('loading');
      
      foldingManager._setNodeLoading('section-a', false);
      const updatedIndicators = foldingManager.getFoldingIndicators();
      expect(updatedIndicators['section-a']).not.toBe('loading');
    });
  });

  describe('Event System', () => {
    test('should support event listeners', () => {
      expect(foldingManager.on).toBeInstanceOf(Function);
      expect(foldingManager.off).toBeInstanceOf(Function);
    });

    test('should support event listener removal', () => {
      let eventFired = false;
      
      const removeListener = foldingManager.on('nodeStateChanged', () => {
        eventFired = true;
      });
      
      removeListener();
      foldingManager.expandNode('section-a');
      
      expect(eventFired).toBe(false);
    });

    test('should support multiple listeners for same event', () => {
      let listener1Called = false;
      let listener2Called = false;
      
      foldingManager.on('nodeStateChanged', () => { listener1Called = true; });
      foldingManager.on('nodeStateChanged', () => { listener2Called = true; });
      
      foldingManager.expandNode('section-a');
      
      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      foldingManager.expandNode('section-a');
      
      expect(foldingManager.destroyed).toBe(false);
      
      foldingManager.destroy();
      
      expect(foldingManager.destroyed).toBe(true);
    });

    test('should handle operations after destroy gracefully', () => {
      foldingManager.destroy();
      
      expect(() => {
        foldingManager.expandNode('section-a');
      }).not.toThrow();
      
      expect(foldingManager.expandNode('section-a')).toBe(false);
    });
  });
});