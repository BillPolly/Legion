/**
 * Unit tests for TreeNavigationUI component
 * Tests interactive tree navigation controls
 */

import { jest } from '@jest/globals';
import { TreeNavigationUI } from '../../../../src/renderers/diagram/ui/TreeNavigationUI.js';

// Mock DOM environment
const createMockContainer = () => {
  const container = {
    innerHTML: '',
    className: '',
    tabIndex: 0,
    appendChild: jest.fn(),
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
        type: '',
        value: '',
        placeholder: '',
        disabled: false,
        style: {},
        width: 200,
        height: 150,
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          toggle: jest.fn(),
          contains: jest.fn()
        },
        getContext: jest.fn(() => ({
          clearRect: jest.fn(),
          fillRect: jest.fn(),
          fillText: jest.fn(),
          fillStyle: '',
          font: ''
        }))
      };
      
      return element;
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  // Mock window
  global.window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  // Mock performance
  global.performance = {
    now: jest.fn(() => Date.now())
  };
  
  // Mock animation frame
  global.cancelAnimationFrame = jest.fn();
  
  return container;
};

const createSampleGraphData = () => ({
  nodes: [
    { id: 'root', label: 'Root Node' },
    { id: 'child1', label: 'Child 1' },
    { id: 'child2', label: 'Child 2' },
    { id: 'child3', label: 'Child 3' },
    { id: 'grandchild1', label: 'Grandchild 1' },
    { id: 'grandchild2', label: 'Grandchild 2' },
    { id: 'isolated', label: 'Isolated Node' }
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'child1' },
    { id: 'e2', source: 'root', target: 'child2' },
    { id: 'e3', source: 'root', target: 'child3' },
    { id: 'e4', source: 'child1', target: 'grandchild1' },
    { id: 'e5', source: 'child1', target: 'grandchild2' }
  ]
});

describe('TreeNavigationUI', () => {
  let ui;
  let container;
  let graphData;
  let onNodeSelect;
  let onNavigationChange;

  beforeEach(() => {
    container = createMockContainer();
    graphData = createSampleGraphData();
    onNodeSelect = jest.fn();
    onNavigationChange = jest.fn();
  });

  afterEach(() => {
    if (ui) {
      ui.destroy();
      ui = null;
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create UI instance with default config', () => {
      ui = new TreeNavigationUI({ container, graphData });
      
      expect(ui).toBeDefined();
      expect(ui.config.container).toBe(container);
      expect(ui.config.theme).toBe('light');
      expect(ui.config.showBreadcrumbs).toBe(true);
      expect(ui.config.showMinimap).toBe(true);
      expect(ui.config.enableKeyboardNav).toBe(true);
    });

    test('should accept custom configuration', () => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        onNodeSelect,
        onNavigationChange,
        theme: 'dark',
        showBreadcrumbs: false,
        showMinimap: false,
        enableKeyboardNav: false
      });

      expect(ui.config.onNodeSelect).toBe(onNodeSelect);
      expect(ui.config.onNavigationChange).toBe(onNavigationChange);
      expect(ui.config.theme).toBe('dark');
      expect(ui.config.showBreadcrumbs).toBe(false);
      expect(ui.config.showMinimap).toBe(false);
      expect(ui.config.enableKeyboardNav).toBe(false);
    });

    test('should throw error without container', () => {
      ui = new TreeNavigationUI({ graphData });
      
      expect(() => ui.initialize()).toThrow('TreeNavigationUI requires a container element');
    });

    test('should initialize successfully with container', () => {
      ui = new TreeNavigationUI({ container, graphData });
      
      expect(() => ui.initialize()).not.toThrow();
      expect(container.className).toBe('tree-navigation-ui');
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Tree Structure Building', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
    });

    test('should build node map correctly', () => {
      expect(ui.nodeMap.size).toBe(7);
      expect(ui.nodeMap.has('root')).toBe(true);
      expect(ui.nodeMap.has('child1')).toBe(true);
      expect(ui.nodeMap.has('isolated')).toBe(true);
    });

    test('should build parent-child relationships', () => {
      expect(ui.parentMap.get('child1')).toBe('root');
      expect(ui.parentMap.get('child2')).toBe('root');
      expect(ui.parentMap.get('grandchild1')).toBe('child1');
      expect(ui.parentMap.has('root')).toBe(false); // root has no parent
      expect(ui.parentMap.has('isolated')).toBe(false); // isolated has no parent
    });

    test('should build children relationships', () => {
      const rootChildren = ui.childrenMap.get('root');
      expect(rootChildren).toEqual(expect.arrayContaining(['child1', 'child2', 'child3']));
      
      const child1Children = ui.childrenMap.get('child1');
      expect(child1Children).toEqual(expect.arrayContaining(['grandchild1', 'grandchild2']));
      
      const isolatedChildren = ui.childrenMap.get('isolated');
      expect(isolatedChildren).toEqual([]);
    });

    test('should build sibling relationships', () => {
      const child1Siblings = ui.siblingMap.get('child1');
      expect(child1Siblings.all).toEqual(expect.arrayContaining(['child2', 'child3']));
      expect(child1Siblings.next).toBe('child2');
      expect(child1Siblings.prev).toBe(null);
      
      const child2Siblings = ui.siblingMap.get('child2');
      expect(child2Siblings.prev).toBe('child1');
      expect(child2Siblings.next).toBe('child3');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        onNodeSelect,
        onNavigationChange
      });
      ui.initialize();
    });

    test('should navigate to node', () => {
      const result = ui.navigateToNode('child1');
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('child1');
      expect(ui.navigationHistory).toEqual(['child1']);
      expect(ui.historyIndex).toBe(0);
      expect(onNodeSelect).toHaveBeenCalledWith('child1', expect.any(Object));
      expect(onNavigationChange).toHaveBeenCalledWith({
        currentNode: 'child1',
        previousNode: null,
        action: 'navigate'
      });
    });

    test('should not navigate to non-existent node', () => {
      const result = ui.navigateToNode('nonexistent');
      
      expect(result).toBe(false);
      expect(ui.currentNode).toBe(null);
      expect(ui.navigationHistory).toEqual([]);
    });

    test('should navigate to parent', () => {
      ui.navigateToNode('child1', false);
      
      const result = ui.navigateToParent();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('root');
    });

    test('should not navigate to parent if no parent exists', () => {
      ui.navigateToNode('root', false);
      
      const result = ui.navigateToParent();
      
      expect(result).toBe(false);
      expect(ui.currentNode).toBe('root');
    });

    test('should navigate to first child', () => {
      ui.navigateToNode('root', false);
      
      const result = ui.navigateToFirstChild();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('child1'); // First child
    });

    test('should not navigate to child if no children exist', () => {
      ui.navigateToNode('grandchild1', false);
      
      const result = ui.navigateToFirstChild();
      
      expect(result).toBe(false);
      expect(ui.currentNode).toBe('grandchild1');
    });

    test('should navigate to next sibling', () => {
      ui.navigateToNode('child1', false);
      
      const result = ui.navigateToNextSibling();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('child2');
    });

    test('should navigate to previous sibling', () => {
      ui.navigateToNode('child2', false);
      
      const result = ui.navigateToPreviousSibling();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('child1');
    });

    test('should navigate to root', () => {
      ui.navigateToNode('grandchild1', false);
      
      const result = ui.navigateToRoot();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('root');
    });
  });

  describe('History Navigation', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
      
      // Build some navigation history
      ui.navigateToNode('root', true);
      ui.navigateToNode('child1', true);
      ui.navigateToNode('grandchild1', true);
    });

    test('should navigate back in history', () => {
      expect(ui.currentNode).toBe('grandchild1');
      expect(ui.historyIndex).toBe(2);
      
      const result = ui.navigateBack();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('child1');
      expect(ui.historyIndex).toBe(1);
    });

    test('should navigate forward in history', () => {
      ui.navigateBack(); // Go back to child1
      
      const result = ui.navigateForward();
      
      expect(result).toBe(true);
      expect(ui.currentNode).toBe('grandchild1');
      expect(ui.historyIndex).toBe(2);
    });

    test('should not navigate back beyond history start', () => {
      ui.navigateBack(); // Go to child1
      ui.navigateBack(); // Go to root
      
      const result = ui.navigateBack(); // Try to go further back
      
      expect(result).toBe(false);
      expect(ui.currentNode).toBe('root');
      expect(ui.historyIndex).toBe(0);
    });

    test('should not navigate forward beyond history end', () => {
      const result = ui.navigateForward();
      
      expect(result).toBe(false);
      expect(ui.currentNode).toBe('grandchild1');
      expect(ui.historyIndex).toBe(2);
    });
  });

  describe('Path Finding', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
    });

    test('should find path between related nodes', () => {
      const path = ui.findPath('grandchild1', 'child2');
      
      expect(path).toEqual(['grandchild1', 'child1', 'root', 'child2']);
    });

    test('should find path to self', () => {
      const path = ui.findPath('child1', 'child1');
      
      expect(path).toEqual(['child1']);
    });

    test('should return empty path for non-existent nodes', () => {
      const path = ui.findPath('nonexistent1', 'nonexistent2');
      
      expect(path).toEqual([]);
    });

    test('should find path between isolated nodes', () => {
      // Both isolated nodes (no connection)
      const path = ui.findPath('isolated', 'root');
      
      expect(path).toEqual([]);
    });
  });

  describe('Tree Traversal', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
    });

    test('should traverse DFS in pre-order', () => {
      const visitedNodes = [];
      const visitor = (node, nodeId) => visitedNodes.push(nodeId);
      
      ui.traverseDFS('root', visitor, 'pre');
      
      expect(visitedNodes).toEqual([
        'root',
        'child1',
        'grandchild1',
        'grandchild2',
        'child2',
        'child3'
      ]);
    });

    test('should traverse DFS in post-order', () => {
      const visitedNodes = [];
      const visitor = (node, nodeId) => visitedNodes.push(nodeId);
      
      ui.traverseDFS('root', visitor, 'post');
      
      expect(visitedNodes).toEqual([
        'grandchild1',
        'grandchild2',
        'child1',
        'child2',
        'child3',
        'root'
      ]);
    });

    test('should traverse BFS', () => {
      const visitedNodes = [];
      const visitor = (node, nodeId) => visitedNodes.push(nodeId);
      
      ui.traverseBFS('root', visitor);
      
      expect(visitedNodes).toEqual([
        'root',
        'child1',
        'child2',
        'child3',
        'grandchild1',
        'grandchild2'
      ]);
    });

    test('should handle traversal from non-existent node', () => {
      const visitedNodes = [];
      const visitor = (node, nodeId) => visitedNodes.push(nodeId);
      
      ui.traverseDFS('nonexistent', visitor);
      
      expect(visitedNodes).toEqual([]);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
      
      // Mock search UI elements
      const mockSearchInput = {
        value: '',
        addEventListener: jest.fn()
      };
      const mockSearchResults = {
        innerHTML: '',
        style: { display: 'none' },
        appendChild: jest.fn()
      };
      
      ui.toolbar = {
        querySelector: jest.fn((selector) => {
          if (selector === '.tree-nav-search-results') return mockSearchResults;
          return mockSearchInput;
        })
      };
    });

    test('should find nodes by exact match', () => {
      const results = [];
      const lowerQuery = 'child 1';
      
      ui.nodeMap.forEach((node, nodeId) => {
        const nodeLabel = node.label || nodeId;
        if (nodeLabel.toLowerCase().includes(lowerQuery)) {
          results.push({ id: nodeId, node, relevance: 100 });
        }
      });
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('child1');
    });

    test('should calculate relevance scores correctly', () => {
      const exactMatch = ui._calculateRelevance('Child 1', 'Child 1');
      const prefixMatch = ui._calculateRelevance('Child 123', 'Child');
      const containsMatch = ui._calculateRelevance('My Child Node', 'Child');
      
      expect(exactMatch).toBe(100);
      expect(prefixMatch).toBe(90);
      expect(containsMatch).toBe(70);
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        enableKeyboardNav: true
      });
      ui.initialize();
      ui.navigateToNode('child2', false); // Set current node
    });

    test('should handle arrow up for parent navigation', () => {
      const event = { key: 'ArrowUp', ctrlKey: true, preventDefault: jest.fn() };
      
      ui.keyboardHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ui.currentNode).toBe('root');
    });

    test('should handle arrow down for child navigation', () => {
      ui.navigateToNode('root', false);
      const event = { key: 'ArrowDown', ctrlKey: true, preventDefault: jest.fn() };
      
      ui.keyboardHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ui.currentNode).toBe('child1'); // First child
    });

    test('should handle arrow left for previous sibling', () => {
      const event = { key: 'ArrowLeft', ctrlKey: false, preventDefault: jest.fn() };
      
      ui.keyboardHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ui.currentNode).toBe('child1');
    });

    test('should handle arrow right for next sibling', () => {
      const event = { key: 'ArrowRight', ctrlKey: false, preventDefault: jest.fn() };
      
      ui.keyboardHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ui.currentNode).toBe('child3');
    });

    test('should handle Home key for root navigation', () => {
      const event = { key: 'Home', preventDefault: jest.fn() };
      
      ui.keyboardHandler(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ui.currentNode).toBe('root');
    });

    test('should handle Escape for clearing selection', () => {
      ui.selectedNodes.add('child1');
      ui.selectedNodes.add('child2');
      
      const event = { key: 'Escape', preventDefault: jest.fn() };
      ui.keyboardHandler(event);
      
      expect(ui.selectedNodes.size).toBe(0);
    });
  });

  describe('UI Updates', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        showBreadcrumbs: true
      });
      ui.initialize();
      
      // Mock UI elements
      ui.breadcrumbs = {
        innerHTML: '',
        appendChild: jest.fn()
      };
      ui.nodeInfo = { innerHTML: '' };
      ui.toolbar = {
        querySelector: jest.fn(() => ({ disabled: false }))
      };
    });

    test('should update breadcrumbs correctly', () => {
      ui.navigateToNode('grandchild1', false);
      
      ui._updateBreadcrumbs();
      
      // Should show path: root › child1 › grandchild1
      expect(ui.breadcrumbs.appendChild).toHaveBeenCalled();
    });

    test('should update node info correctly', () => {
      ui.navigateToNode('child1', false);
      
      ui._updateNodeInfo();
      
      expect(ui.nodeInfo.innerHTML).toContain('child1');
      expect(ui.nodeInfo.innerHTML).toContain('Children');
      expect(ui.nodeInfo.innerHTML).toContain('2'); // child1 has 2 children
    });

    test('should update toolbar state correctly', () => {
      ui.navigateToNode('child1', false);
      const mockButton = { disabled: false };
      ui.toolbar.querySelector = jest.fn(() => mockButton);
      
      ui._updateToolbarState();
      
      expect(ui.toolbar.querySelector).toHaveBeenCalledWith('.tree-nav-parent');
    });
  });

  describe('Data Updates', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
      ui.navigateToNode('child1', false);
    });

    test('should update graph data successfully', () => {
      const newGraphData = {
        nodes: [
          { id: 'newRoot', label: 'New Root' },
          { id: 'newChild', label: 'New Child' }
        ],
        edges: [
          { id: 'e1', source: 'newRoot', target: 'newChild' }
        ]
      };
      
      ui.updateGraphData(newGraphData);
      
      expect(ui.nodeMap.size).toBe(2);
      expect(ui.nodeMap.has('newRoot')).toBe(true);
      expect(ui.nodeMap.has('child1')).toBe(false); // Old node gone
      expect(ui.currentNode).toBe(null); // Reset because old node gone
    });

    test('should preserve current node if still exists', () => {
      const updatedGraphData = {
        ...graphData,
        nodes: [...graphData.nodes, { id: 'newNode', label: 'New Node' }]
      };
      
      ui.updateGraphData(updatedGraphData);
      
      expect(ui.currentNode).toBe('child1'); // Should still be current
      expect(ui.nodeMap.has('newNode')).toBe(true);
    });
  });

  describe('Expansion/Collapse', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        onNavigationChange
      });
      ui.initialize();
    });

    test('should trigger expand all', () => {
      ui.expandAll();
      
      expect(onNavigationChange).toHaveBeenCalledWith({
        action: 'expandAll'
      });
    });

    test('should trigger collapse all', () => {
      ui.collapseAll();
      
      expect(onNavigationChange).toHaveBeenCalledWith({
        action: 'collapseAll'
      });
    });

    test('should toggle node expansion', () => {
      ui.toggleNodeExpansion('child1');
      
      expect(onNavigationChange).toHaveBeenCalledWith({
        action: 'toggleExpansion',
        nodeId: 'child1'
      });
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      ui = new TreeNavigationUI({
        container,
        graphData,
        enableKeyboardNav: true
      });
      ui.initialize();
    });

    test('should destroy cleanly', () => {
      ui.animationId = 123;
      
      ui.destroy();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(container.innerHTML).toBe('');
      expect(ui.nodeMap.size).toBe(0);
      expect(ui.selectedNodes.size).toBe(0);
      expect(ui.navigationHistory).toEqual([]);
    });

    test('should remove keyboard listener', () => {
      const removeListener = jest.spyOn(container, 'removeEventListener');
      
      ui.destroy();
      
      expect(removeListener).toHaveBeenCalledWith('keydown', ui.keyboardHandler);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing container gracefully', () => {
      ui = new TreeNavigationUI({ graphData });
      
      expect(() => ui.initialize()).toThrow();
    });

    test('should handle empty graph data', () => {
      ui = new TreeNavigationUI({
        container,
        graphData: { nodes: [], edges: [] }
      });
      
      expect(() => ui.initialize()).not.toThrow();
      expect(ui.nodeMap.size).toBe(0);
    });

    test('should handle navigation without current node', () => {
      ui = new TreeNavigationUI({ container, graphData });
      ui.initialize();
      
      expect(ui.navigateToParent()).toBe(false);
      expect(ui.navigateToFirstChild()).toBe(false);
      expect(ui.navigateToPreviousSibling()).toBe(false);
      expect(ui.navigateToNextSibling()).toBe(false);
    });
  });
});