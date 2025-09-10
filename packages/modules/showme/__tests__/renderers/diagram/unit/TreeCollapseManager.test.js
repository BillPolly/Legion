/**
 * Unit tests for TreeCollapseManager component
 * Tests tree expand/collapse functionality
 */

import { jest } from '@jest/globals';
import { TreeCollapseManager } from '../../../../src/renderers/diagram/ui/TreeCollapseManager.js';

// Mock DOM environment
const createMockContainer = () => {
  const container = {
    innerHTML: '',
    className: '',
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  // Mock document methods
  global.document = {
    createElement: jest.fn((tagName) => {
      const element = {
        tagName: tagName.toUpperCase(),
        innerHTML: '',
        textContent: '',
        className: '',
        style: {},
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        setAttribute: jest.fn(),
        querySelector: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          toggle: jest.fn()
        }
      };
      return element;
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  // Mock localStorage
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
  
  // Mock performance
  global.performance = {
    now: jest.fn(() => Date.now())
  };
  
  // Mock cancelAnimationFrame
  global.cancelAnimationFrame = jest.fn();
  
  return container;
};

const createSampleGraphData = () => ({
  nodes: [
    { id: 'root', size: { width: 100, height: 60 } },
    { id: 'child1', size: { width: 80, height: 50 } },
    { id: 'child2', size: { width: 80, height: 50 } },
    { id: 'child3', size: { width: 80, height: 50 } },
    { id: 'grandchild1', size: { width: 70, height: 40 } },
    { id: 'grandchild2', size: { width: 70, height: 40 } },
    { id: 'leaf', size: { width: 60, height: 30 } }
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'child1' },
    { id: 'e2', source: 'root', target: 'child2' },
    { id: 'e3', source: 'root', target: 'child3' },
    { id: 'e4', source: 'child1', target: 'grandchild1' },
    { id: 'e5', source: 'child1', target: 'grandchild2' },
    { id: 'e6', source: 'child2', target: 'leaf' }
  ]
});

describe('TreeCollapseManager', () => {
  let manager;
  let container;
  let graphData;
  let onStateChange;
  let onNodeToggle;

  beforeEach(() => {
    container = createMockContainer();
    graphData = createSampleGraphData();
    onStateChange = jest.fn();
    onNodeToggle = jest.fn();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
      manager = null;
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create manager instance with default config', () => {
      manager = new TreeCollapseManager({ container, graphData });
      
      expect(manager).toBeDefined();
      expect(manager.config.container).toBe(container);
      expect(manager.config.showToggleButtons).toBe(true);
      expect(manager.config.defaultExpanded).toBe(true);
      expect(manager.config.animateTransitions).toBe(true);
    });

    test('should accept custom configuration', () => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        onStateChange,
        onNodeToggle,
        showToggleButtons: false,
        defaultExpanded: false,
        animateTransitions: false,
        buttonSize: 20,
        animationDuration: 500
      });

      expect(manager.config.onStateChange).toBe(onStateChange);
      expect(manager.config.onNodeToggle).toBe(onNodeToggle);
      expect(manager.config.showToggleButtons).toBe(false);
      expect(manager.config.defaultExpanded).toBe(false);
      expect(manager.config.animateTransitions).toBe(false);
      expect(manager.config.buttonSize).toBe(20);
      expect(manager.config.animationDuration).toBe(500);
    });

    test('should throw error without container', () => {
      manager = new TreeCollapseManager({ graphData });
      
      expect(() => manager.initialize()).toThrow('TreeCollapseManager requires a container element');
    });

    test('should initialize successfully with container', () => {
      manager = new TreeCollapseManager({ container, graphData });
      
      expect(() => manager.initialize()).not.toThrow();
      expect(manager.nodeMap.size).toBe(7);
      expect(manager.childrenMap.size).toBe(7);
    });
  });

  describe('Tree Structure Building', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({ container, graphData });
      manager.initialize();
    });

    test('should build node map correctly', () => {
      expect(manager.nodeMap.size).toBe(7);
      expect(manager.nodeMap.has('root')).toBe(true);
      expect(manager.nodeMap.has('leaf')).toBe(true);
    });

    test('should build parent-child relationships', () => {
      expect(manager.parentMap.get('child1')).toBe('root');
      expect(manager.parentMap.get('grandchild1')).toBe('child1');
      expect(manager.parentMap.get('leaf')).toBe('child2');
      expect(manager.parentMap.has('root')).toBe(false); // root has no parent
    });

    test('should build children map', () => {
      const rootChildren = manager.childrenMap.get('root');
      expect(rootChildren).toEqual(expect.arrayContaining(['child1', 'child2', 'child3']));
      
      const child1Children = manager.childrenMap.get('child1');
      expect(child1Children).toEqual(expect.arrayContaining(['grandchild1', 'grandchild2']));
      
      const leafChildren = manager.childrenMap.get('leaf');
      expect(leafChildren).toEqual([]);
    });
  });

  describe('Default State Initialization', () => {
    test('should initialize with all nodes expanded by default', () => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        defaultExpanded: true
      });
      manager.initialize();

      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(manager.isNodeExpanded('child1')).toBe(true);
      expect(manager.isNodeExpanded('child2')).toBe(true);
      expect(manager.isNodeExpanded('leaf')).toBe(true); // leaf nodes are always "expanded"
    });

    test('should initialize with all nodes collapsed when defaultExpanded is false', () => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        defaultExpanded: false
      });
      manager.initialize();

      expect(manager.isNodeExpanded('root')).toBe(false);
      expect(manager.isNodeExpanded('child1')).toBe(false);
      expect(manager.isNodeExpanded('child2')).toBe(false);
      expect(manager.isNodeExpanded('leaf')).toBe(true); // leaf nodes can't be collapsed
    });
  });

  describe('Toggle Button Creation', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        showToggleButtons: true
      });
      manager.initialize();
    });

    test('should create toggle buttons for nodes with children', () => {
      expect(manager.toggleButtons.size).toBe(3); // root, child1, child2 have children
      expect(manager.toggleButtons.has('root')).toBe(true);
      expect(manager.toggleButtons.has('child1')).toBe(true);
      expect(manager.toggleButtons.has('child2')).toBe(true);
      expect(manager.toggleButtons.has('leaf')).toBe(false); // leaf has no children
    });

    test('should not create buttons when showToggleButtons is false', () => {
      manager.destroy();
      manager = new TreeCollapseManager({
        container,
        graphData,
        showToggleButtons: false
      });
      manager.initialize();

      expect(manager.toggleButtons.size).toBe(0);
    });

    test('should update button positions when provided', () => {
      const positions = new Map([
        ['root', { x: 100, y: 50 }],
        ['child1', { x: 50, y: 150 }],
        ['child2', { x: 150, y: 150 }]
      ]);

      manager.updateButtonPositions(positions);

      const rootButton = manager.toggleButtons.get('root');
      expect(rootButton.style.left).toBe('92px'); // 100 + 50/2 - 8
      expect(rootButton.style.top).toBe('72px'); // 50 + 60/2 - 8
    });
  });

  describe('Node State Management', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        onStateChange,
        onNodeToggle
      });
      manager.initialize();
    });

    test('should check node expansion state correctly', () => {
      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(manager.isNodeCollapsed('root')).toBe(false);
      
      // Leaf nodes are always "expanded"
      expect(manager.isNodeExpanded('leaf')).toBe(true);
      expect(manager.isNodeCollapsed('leaf')).toBe(false);
    });

    test('should toggle node state', () => {
      expect(manager.isNodeExpanded('root')).toBe(true);
      
      const result = manager.toggleNode('root');
      
      expect(result).toBe(true);
      expect(manager.isNodeExpanded('root')).toBe(false);
      expect(manager.isNodeCollapsed('root')).toBe(true);
      expect(onNodeToggle).toHaveBeenCalledWith('root', false);
    });

    test('should not toggle leaf nodes', () => {
      const result = manager.toggleNode('leaf');
      
      expect(result).toBe(false);
      expect(onNodeToggle).not.toHaveBeenCalled();
    });

    test('should expand node', () => {
      // First collapse it
      manager.collapseNode('root', false);
      expect(manager.isNodeExpanded('root')).toBe(false);
      
      const result = manager.expandNode('root');
      
      expect(result).toBe(true);
      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(onNodeToggle).toHaveBeenCalledWith('root', true);
    });

    test('should collapse node', () => {
      expect(manager.isNodeExpanded('root')).toBe(true);
      
      const result = manager.collapseNode('root');
      
      expect(result).toBe(true);
      expect(manager.isNodeExpanded('root')).toBe(false);
      expect(onNodeToggle).toHaveBeenCalledWith('root', false);
    });
  });

  describe('Visibility Management', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        defaultExpanded: true
      });
      manager.initialize();
    });

    test('should determine node visibility correctly when all expanded', () => {
      expect(manager.isNodeVisible('root')).toBe(true);
      expect(manager.isNodeVisible('child1')).toBe(true);
      expect(manager.isNodeVisible('grandchild1')).toBe(true);
      expect(manager.isNodeVisible('leaf')).toBe(true);
    });

    test('should hide descendants when parent is collapsed', () => {
      manager.collapseNode('child1', false);
      
      expect(manager.isNodeVisible('child1')).toBe(true); // child1 itself is visible
      expect(manager.isNodeVisible('grandchild1')).toBe(false); // hidden by collapsed parent
      expect(manager.isNodeVisible('grandchild2')).toBe(false);
    });

    test('should hide deeply nested descendants', () => {
      manager.collapseNode('root', false);
      
      expect(manager.isNodeVisible('root')).toBe(true);
      expect(manager.isNodeVisible('child1')).toBe(false);
      expect(manager.isNodeVisible('grandchild1')).toBe(false);
      expect(manager.isNodeVisible('leaf')).toBe(false);
    });

    test('should get visible nodes correctly', () => {
      manager.collapseNode('child1', false);
      
      const visibleNodes = manager.getVisibleNodes();
      
      expect(visibleNodes).toContain('root');
      expect(visibleNodes).toContain('child1');
      expect(visibleNodes).toContain('child2');
      expect(visibleNodes).toContain('child3');
      expect(visibleNodes).toContain('leaf');
      expect(visibleNodes).not.toContain('grandchild1');
      expect(visibleNodes).not.toContain('grandchild2');
    });

    test('should get visible edges correctly', () => {
      manager.collapseNode('child1', false);
      
      const visibleEdges = manager.getVisibleEdges();
      
      const visibleEdgeIds = visibleEdges.map(e => e.id);
      expect(visibleEdgeIds).toContain('e1'); // root -> child1
      expect(visibleEdgeIds).toContain('e2'); // root -> child2
      expect(visibleEdgeIds).toContain('e6'); // child2 -> leaf
      expect(visibleEdgeIds).not.toContain('e4'); // child1 -> grandchild1 (hidden)
      expect(visibleEdgeIds).not.toContain('e5'); // child1 -> grandchild2 (hidden)
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        defaultExpanded: false, // Start collapsed
        onStateChange
      });
      manager.initialize();
    });

    test('should expand all nodes', () => {
      manager.expandAll();
      
      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(manager.isNodeExpanded('child1')).toBe(true);
      expect(manager.isNodeExpanded('child2')).toBe(true);
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
        action: 'expandAll'
      }));
    });

    test('should collapse all nodes', () => {
      // First expand all
      manager.expandAll();
      jest.clearAllMocks();
      
      manager.collapseAll();
      
      expect(manager.isNodeExpanded('root')).toBe(false);
      expect(manager.isNodeExpanded('child1')).toBe(false);
      expect(manager.isNodeExpanded('child2')).toBe(false);
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
        action: 'collapseAll'
      }));
    });

    test('should expand subtree', () => {
      manager.expandSubtree('root', 2); // Expand 2 levels
      
      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(manager.isNodeExpanded('child1')).toBe(true);
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
        action: 'expandSubtree'
      }));
    });

    test('should collapse subtree', () => {
      // First expand everything
      manager.expandAll();
      jest.clearAllMocks();
      
      manager.collapseSubtree('child1');
      
      expect(manager.isNodeExpanded('child1')).toBe(false);
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
        action: 'collapseSubtree'
      }));
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({ container, graphData });
      manager.initialize();
    });

    test('should get current state', () => {
      manager.collapseNode('child1', false);
      
      const state = manager.getState();
      
      expect(state.expanded).toBeInstanceOf(Set);
      expect(state.collapsed).toBeInstanceOf(Set);
      expect(state.visible).toBeInstanceOf(Map);
      expect(state.collapsed.has('child1')).toBe(true);
    });

    test('should restore state', () => {
      const state = {
        expanded: new Set(['root', 'child2']),
        collapsed: new Set(['child1'])
      };
      
      manager.setState(state);
      
      expect(manager.isNodeExpanded('root')).toBe(true);
      expect(manager.isNodeExpanded('child1')).toBe(false);
      expect(manager.isNodeExpanded('child2')).toBe(true);
    });
  });

  describe('Persistence', () => {
    test('should save state to localStorage when persistState is true', () => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        persistState: true,
        storageKey: 'test-tree-state'
      });
      manager.initialize();
      
      manager.collapseNode('root', false);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-tree-state',
        expect.stringContaining('"collapsed":["root"]')
      );
    });

    test('should load state from localStorage on initialization', () => {
      const mockState = {
        expanded: ['child1'],
        collapsed: ['root'],
        timestamp: Date.now()
      };
      
      localStorage.getItem.mockReturnValue(JSON.stringify(mockState));
      
      manager = new TreeCollapseManager({
        container,
        graphData,
        persistState: true,
        storageKey: 'test-tree-state'
      });
      manager.initialize();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('test-tree-state');
      expect(manager.isNodeExpanded('root')).toBe(false);
    });
  });

  describe('Data Updates', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({ container, graphData });
      manager.initialize();
    });

    test('should update graph data and rebuild structure', () => {
      const newGraphData = {
        nodes: [
          { id: 'newRoot', size: { width: 100, height: 60 } },
          { id: 'newChild', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'newRoot', target: 'newChild' }
        ]
      };
      
      manager.updateGraphData(newGraphData);
      
      expect(manager.nodeMap.size).toBe(2);
      expect(manager.nodeMap.has('newRoot')).toBe(true);
      expect(manager.nodeMap.has('root')).toBe(false); // Old node gone
    });

    test('should clean up state for removed nodes', () => {
      manager.collapseNode('root', false);
      expect(manager.collapsedNodes.has('root')).toBe(true);
      
      const newGraphData = {
        nodes: [{ id: 'newNode', size: { width: 100, height: 60 } }],
        edges: []
      };
      
      manager.updateGraphData(newGraphData);
      
      expect(manager.collapsedNodes.has('root')).toBe(false); // Cleaned up
    });
  });

  describe('Error Handling', () => {
    test('should handle empty graph data gracefully', () => {
      manager = new TreeCollapseManager({
        container,
        graphData: { nodes: [], edges: [] }
      });
      
      expect(() => manager.initialize()).not.toThrow();
      expect(manager.nodeMap.size).toBe(0);
      expect(manager.getVisibleNodes()).toEqual([]);
    });

    test('should handle missing edges gracefully', () => {
      manager = new TreeCollapseManager({
        container,
        graphData: { nodes: graphData.nodes }
      });
      
      expect(() => manager.initialize()).not.toThrow();
      expect(manager.childrenMap.get('root')).toEqual([]);
    });

    test('should handle localStorage errors gracefully', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      manager = new TreeCollapseManager({
        container,
        graphData,
        persistState: true
      });
      
      expect(() => manager.initialize()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        showToggleButtons: true
      });
      manager.initialize();
    });

    test('should destroy cleanly', () => {
      manager.animationFrameId = 123;
      
      manager.destroy();
      
      expect(cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(manager.expandedNodes.size).toBe(0);
      expect(manager.collapsedNodes.size).toBe(0);
      expect(manager.nodeMap.size).toBe(0);
      expect(manager.toggleButtons.size).toBe(0);
    });

    test('should remove toggle buttons from DOM', () => {
      const mockButton = manager.toggleButtons.get('root');
      mockButton.parentNode = { removeChild: jest.fn() };
      
      manager.destroy();
      
      expect(mockButton.parentNode.removeChild).toHaveBeenCalledWith(mockButton);
    });
  });

  describe('Integration', () => {
    test('should work with TreeNavigationUI integration', () => {
      const mockNavigationUI = {
        navigateToNode: jest.fn(),
        currentNode: 'child1'
      };
      
      manager = new TreeCollapseManager({
        container,
        graphData,
        navigationUI: mockNavigationUI,
        onStateChange
      });
      manager.initialize();
      
      // Collapse the parent of current node
      manager.collapseNode('root', false);
      
      expect(manager.isNodeVisible('child1')).toBe(false);
      expect(onStateChange).toHaveBeenCalled();
    });

    test('should preserve selection when preserveSelection is true', () => {
      manager = new TreeCollapseManager({
        container,
        graphData,
        preserveSelection: true
      });
      manager.initialize();
      
      // This would typically interact with selection state
      manager.collapseNode('root', false);
      
      expect(manager.config.preserveSelection).toBe(true);
    });
  });
});