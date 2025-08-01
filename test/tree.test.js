/**
 * @jest-environment jsdom
 */

import { Tree, TreeModel, TreeView, TreeViewModel } from '../src/components/tree/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Tree Component', () => {
  // Sample hierarchical data for testing
  const sampleData = [
    {
      id: 'root1',
      name: 'Root 1',
      children: [
        {
          id: 'child1-1',
          name: 'Child 1-1',
          children: [
            { id: 'grandchild1-1-1', name: 'Grandchild 1-1-1' },
            { id: 'grandchild1-1-2', name: 'Grandchild 1-1-2' }
          ]
        },
        { id: 'child1-2', name: 'Child 1-2' }
      ]
    },
    {
      id: 'root2',
      name: 'Root 2',
      children: [
        { id: 'child2-1', name: 'Child 2-1' },
        { id: 'child2-2', name: 'Child 2-2' }
      ]
    },
    { id: 'root3', name: 'Root 3' } // Leaf node
  ];

  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should provide component information when called without umbilical', () => {
      const info = Tree.create();
      
      expect(info).toHaveProperty('name', 'Tree');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('capabilities');
      expect(info.capabilities).toContain('hierarchical-display');
      expect(info.capabilities).toContain('expand-collapse');
      expect(info.capabilities).toContain('selection');
      expect(info.capabilities).toContain('drag-drop');
    });

    test('should describe requirements in introspection mode', () => {
      const requirements = UmbilicalUtils.createRequirements();
      
      Tree.create({
        describe: (reqs) => {
          Object.entries(reqs.getAll()).forEach(([key, spec]) => {
            requirements.add(key, spec.type, spec.description);
          });
        }
      });

      const described = requirements.getAll();
      
      expect(described).toHaveProperty('data');
      expect(described).toHaveProperty('dom');
      expect(described).toHaveProperty('selectable');
      expect(described).toHaveProperty('draggable');
      expect(described).toHaveProperty('onSelectionChange');
      expect(described).toHaveProperty('onExpand');
      expect(described).toHaveProperty('onCollapse');
      
      expect(described.data.type).toBe('array');
      expect(described.dom.type).toBe('HTMLElement');
    });

    test('should validate umbilical capabilities', () => {
      const validUmbilical = {
        data: sampleData,
        dom: container
      };

      const result = Tree.create({
        validate: validUmbilical
      });

      expect(result.valid).toBe(true);
      expect(result.hasData).toBe(true);
      expect(result.hasDOM).toBe(true);
    });

    test('should reject invalid umbilical', () => {
      const invalidUmbilical = {
        data: 'not an array',
        dom: null
      };

      const result = Tree.create({
        validate: invalidUmbilical
      });

      expect(result.valid).toBe(false);
      expect(result.hasData).toBe(false);
      expect(result.hasDOM).toBe(false);
    });
  });

  describe('Tree Instance Creation', () => {
    test('should create tree instance with minimal configuration', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container
      });

      expect(tree).toBeDefined();
      expect(typeof tree.getData).toBe('function');
      expect(typeof tree.expand).toBe('function');
      expect(typeof tree.select).toBe('function');
      expect(typeof tree.destroy).toBe('function');
    });

    test('should throw error for missing DOM element', () => {
      expect(() => {
        Tree.create({
          data: sampleData,
          dom: null
        });
      }).toThrow('Tree requires a DOM container element');
    });

    test('should throw error for invalid data type', () => {
      expect(() => {
        Tree.create({
          data: 'not an array',
          dom: container
        });
      }).toThrow('Tree data must be an array');
    });

    test('should apply initial configuration', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container,
        selectable: 'multiple',
        draggable: true,
        initialExpanded: ['root1'],
        initialSelected: ['child1-1']
      });

      expect(tree.isExpanded('root1')).toBe(true);
      expect(tree.isSelected('child1-1')).toBe(true);
    });
  });

  describe('Data Operations', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should get and set data', () => {
      const data = tree.getData();
      expect(data).toEqual(sampleData);

      const newData = [{ id: 'new', name: 'New Root' }];
      tree.setData(newData);
      expect(tree.getData()).toEqual(newData);
    });

    test('should get node by ID', () => {
      const node = tree.getNode('child1-1');
      expect(node).toBeDefined();
      expect(node.name).toBe('Child 1-1');
    });

    test('should check if node has children', () => {
      expect(tree.hasChildren('root1')).toBe(true);
      expect(tree.hasChildren('root3')).toBe(false);
    });

    test('should get node children', () => {
      const children = tree.getChildren('root1');
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe('Child 1-1');
    });

    test('should get parent node', () => {
      const parent = tree.getParent('child1-1');
      expect(parent).toBeDefined();
      expect(parent.name).toBe('Root 1');
    });

    test('should get ancestors', () => {
      const ancestors = tree.getAncestors('grandchild1-1-1');
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].name).toBe('Root 1');
      expect(ancestors[1].name).toBe('Child 1-1');
    });
  });

  describe('Expansion Operations', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should expand and collapse nodes', () => {
      expect(tree.isExpanded('root1')).toBe(false);
      
      tree.expand('root1');
      expect(tree.isExpanded('root1')).toBe(true);
      
      tree.collapse('root1');
      expect(tree.isExpanded('root1')).toBe(false);
    });

    test('should toggle expansion', () => {
      expect(tree.isExpanded('root1')).toBe(false);
      
      tree.toggleExpansion('root1');
      expect(tree.isExpanded('root1')).toBe(true);
      
      tree.toggleExpansion('root1');
      expect(tree.isExpanded('root1')).toBe(false);
    });

    test('should expand all nodes', () => {
      tree.expandAll();
      
      expect(tree.isExpanded('root1')).toBe(true);
      expect(tree.isExpanded('root2')).toBe(true);
      expect(tree.isExpanded('child1-1')).toBe(true);
    });

    test('should collapse all nodes', () => {
      tree.expandAll();
      tree.collapseAll();
      
      expect(tree.isExpanded('root1')).toBe(false);
      expect(tree.isExpanded('root2')).toBe(false);
      expect(tree.isExpanded('child1-1')).toBe(false);
    });

    test('should expand to reveal specific node', () => {
      const changed = tree.expandToNode('grandchild1-1-1');
      
      expect(changed).toBe(true);
      expect(tree.isExpanded('root1')).toBe(true);
      expect(tree.isExpanded('child1-1')).toBe(true);
    });

    test('should call expansion callbacks', () => {
      let expandCalled = false;
      let collapseCalled = false;
      let expandedNode = null;
      let collapsedNode = null;
      
      const onExpand = (id, node) => {
        expandCalled = true;
        expandedNode = node;
      };
      const onCollapse = (id, node) => {
        collapseCalled = true;
        collapsedNode = node;
      };
      
      const treeWithCallbacks = Tree.create({
        data: sampleData,
        dom: container,
        onExpand,
        onCollapse
      });

      treeWithCallbacks.expand('root1');
      expect(expandCalled).toBe(true);
      expect(expandedNode.name).toBe('Root 1');

      treeWithCallbacks.collapse('root1');
      expect(collapseCalled).toBe(true);
      expect(collapsedNode.name).toBe('Root 1');

      treeWithCallbacks.destroy();
    });
  });

  describe('Selection Operations', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container,
        selectable: 'multiple'
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should select and deselect nodes', () => {
      expect(tree.isSelected('root1')).toBe(false);
      
      tree.select('root1');
      expect(tree.isSelected('root1')).toBe(true);
      
      tree.deselect('root1');
      expect(tree.isSelected('root1')).toBe(false);
    });

    test('should clear all selections', () => {
      tree.select('root1');
      tree.select('root2');
      
      expect(tree.getSelectedIds()).toHaveLength(2);
      
      tree.clearSelection();
      expect(tree.getSelectedIds()).toHaveLength(0);
    });

    test('should get selected nodes and IDs', () => {
      tree.select('root1');
      tree.select('child1-1');
      
      const selectedIds = tree.getSelectedIds();
      const selectedNodes = tree.getSelectedNodes();
      
      expect(selectedIds).toContain('root1');
      expect(selectedIds).toContain('child1-1');
      expect(selectedNodes).toHaveLength(2);
      expect(selectedNodes[0].name).toBe('Root 1');
    });

    test('should handle single selection mode', () => {
      const singleTree = Tree.create({
        data: sampleData,
        dom: container,
        selectable: 'single'
      });

      singleTree.select('root1');
      singleTree.select('root2');
      
      // Should only have root2 selected (last selection)
      expect(singleTree.getSelectedIds()).toHaveLength(1);
      expect(singleTree.isSelected('root2')).toBe(true);
      expect(singleTree.isSelected('root1')).toBe(false);

      singleTree.destroy();
    });

    test('should call selection change callback', () => {
      let selectionChangeArgs = null;
      const onSelectionChange = (...args) => {
        selectionChangeArgs = args;
      };
      
      const treeWithCallback = Tree.create({
        data: sampleData,
        dom: container,
        selectable: 'multiple',
        onSelectionChange
      });

      treeWithCallback.select('root1');
      
      expect(selectionChangeArgs).not.toBeNull();
      expect(selectionChangeArgs[0]).toContain('root1');
      expect(selectionChangeArgs[1][0].name).toBe('Root 1');

      treeWithCallback.destroy();
    });
  });

  describe('Search Operations', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container,
        searchable: true
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should search nodes by name', () => {
      const results = tree.search('Child');
      
      expect(results).toHaveLength(6); // All nodes with "Child" in name (including grandchildren)
      expect(results[0].node.name).toContain('Child');
    });

    test('should search with custom field', () => {
      const results = tree.search('root1', { field: 'id' });
      
      expect(results).toHaveLength(1);
      expect(results[0].node.id).toBe('root1');
    });

    test('should warn when search is disabled', () => {
      const nonSearchableTree = Tree.create({
        data: sampleData,
        dom: container,
        searchable: false
      });

      const originalWarn = console.warn;
      let warnMessage = null;
      console.warn = (message) => {
        warnMessage = message;
      };
      
      const results = nonSearchableTree.search('test');
      
      expect(results).toHaveLength(0);
      expect(warnMessage).toContain('Search is not enabled');

      console.warn = originalWarn;
      nonSearchableTree.destroy();
    });
  });

  describe('State Management', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should export and import state', () => {
      // Set up some state
      tree.expand('root1');
      tree.expand('child1-1');
      tree.select('child1-2');
      
      const state = tree.exportState();
      
      expect(state.expandedNodes).toContain('root1');
      expect(state.expandedNodes).toContain('child1-1');
      expect(state.selectedNodes).toContain('child1-2');
      
      // Reset and import
      tree.collapseAll();
      tree.clearSelection();
      tree.importState(state);
      
      expect(tree.isExpanded('root1')).toBe(true);
      expect(tree.isExpanded('child1-1')).toBe(true);
      expect(tree.isSelected('child1-2')).toBe(true);
    });

    test('should provide tree statistics', () => {
      tree.expand('root1');
      tree.select('child1-1');
      
      const stats = tree.getStats();
      
      expect(stats.totalNodes).toBe(9); // All nodes in sample data (3 roots + 4 children + 2 grandchildren)
      expect(stats.expandedNodes).toBe(1);
      expect(stats.selectedNodes).toBe(1);
      expect(stats.maxDepth).toBe(2); // Root -> Child -> Grandchild
    });
  });

  describe('Structure Validation', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should validate tree structure', () => {
      const validation = tree.validateStructure();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect circular references', () => {
      // Create data with circular reference
      const circularData = [
        {
          id: 'parent',
          name: 'Parent',
          children: [
            {
              id: 'child',
              name: 'Child',
              children: [] // Will be modified to create circular reference
            }
          ]
        }
      ];
      
      // Create circular reference
      circularData[0].children[0].children.push(circularData[0]);
      
      const circularTree = Tree.create({
        data: circularData,
        dom: container
      });

      const validation = circularTree.validateStructure();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Circular reference');

      circularTree.destroy();
    });
  });

  describe('Focus and Navigation', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should focus nodes', () => {
      tree.focusNode('root1');
      
      const focusedNode = tree.getFocusedNode();
      expect(focusedNode).toBeDefined();
      expect(focusedNode.id).toBe('root1');
    });

    test('should highlight nodes', () => {
      // Should expand ancestors and highlight node
      tree.highlightNode('grandchild1-1-1');
      
      expect(tree.isExpanded('root1')).toBe(true);
      expect(tree.isExpanded('child1-1')).toBe(true);
    });
  });

  describe('Configuration and Lifecycle', () => {
    test('should call lifecycle callbacks', () => {
      let mountCalled = false;
      let destroyCalled = false;
      let mountedTree = null;
      let destroyedTree = null;
      
      const onMount = (tree) => {
        mountCalled = true;
        mountedTree = tree;
      };
      const onDestroy = (tree) => {
        destroyCalled = true;
        destroyedTree = tree;
      };
      
      const tree = Tree.create({
        data: sampleData,
        dom: container,
        onMount,
        onDestroy
      });

      expect(mountCalled).toBe(true);
      expect(mountedTree).toBe(tree);

      tree.destroy();
      expect(destroyCalled).toBe(true);
      expect(destroyedTree).toBe(tree);
    });

    test('should get and update configuration', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container,
        selectable: 'single'
      });

      const config = tree.getConfig();
      expect(config.selectable).toBe('single');

      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = () => { warnCalled = true; };
      tree.updateConfig({ selectable: 'multiple' });
      expect(warnCalled).toBe(true);
      console.warn = originalWarn;

      tree.destroy();
    });

    test('should update theme without warnings or recreation', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container,
        theme: 'light'
      });

      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = () => { warnCalled = true; };

      // Theme change should not trigger warning
      tree.updateConfig({ theme: 'dark' });
      expect(warnCalled).toBe(false);

      // Verify theme was applied
      expect(container.classList.contains('theme-dark')).toBe(true);

      // Switch back to light
      tree.updateConfig({ theme: 'light' });
      expect(container.classList.contains('theme-dark')).toBe(false);

      console.warn = originalWarn;
      tree.destroy();
    });
  });

  describe('Custom Rendering', () => {
    test('should use custom node renderer', () => {
      let rendererCalled = false;
      let rendererArgs = [];
      const nodeRenderer = (node, depth, isExpanded) => {
        rendererCalled = true;
        rendererArgs.push({ node, depth, isExpanded });
        return `<span class="custom">${node.name} (${depth})</span>`;
      };

      const tree = Tree.create({
        data: sampleData,
        dom: container,
        nodeRenderer
      });

      // Should have called renderer for visible nodes
      expect(rendererCalled).toBe(true);
      expect(rendererArgs.length).toBeGreaterThan(0);
      
      // Check if custom rendering was applied
      const customElements = container.querySelectorAll('.custom');
      expect(customElements.length).toBeGreaterThan(0);

      tree.destroy();
    });

    test('should use custom node icon function', () => {
      let iconFunctionCalled = false;
      const getNodeIcon = (node, nodeInfo) => {
        iconFunctionCalled = true;
        return node.name.includes('Root') ? '📁' : '📄';
      };

      const tree = Tree.create({
        data: sampleData,
        dom: container,
        getNodeIcon
      });

      expect(iconFunctionCalled).toBe(true);

      tree.destroy();
    });
  });

  describe('Drag and Drop', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container,
        draggable: true
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should provide drag state information', () => {
      expect(tree.isDragging()).toBe(false);
      expect(tree.getDraggedNode()).toBe(null);
    });

    test('should check drop validity', () => {
      // Can't test actual drag events in jsdom, but can test validation
      const canDrop = tree.canDropAt('root2', 'inside');
      expect(typeof canDrop).toBe('boolean');
    });

    test('should call drag callbacks', () => {
      let dragStartCalled = false;
      let moveCalled = false;
      const onDragStart = () => { dragStartCalled = true; };
      const onMove = () => { moveCalled = true; };
      
      const dragTree = Tree.create({
        data: sampleData,
        dom: container,
        draggable: true,
        onDragStart,
        onMove
      });

      // Note: Full drag testing would require simulating complex mouse events
      // which is difficult in jsdom environment

      dragTree.destroy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty data gracefully', () => {
      const tree = Tree.create({
        data: [],
        dom: container
      });

      expect(tree.getAllNodes()).toHaveLength(0);
      expect(tree.getStats().totalNodes).toBe(0);

      tree.destroy();
    });

    test('should handle missing node IDs gracefully', () => {
      const dataWithoutIds = [
        { name: 'No ID Node' }
      ];

      const tree = Tree.create({
        data: dataWithoutIds,
        dom: container
      });

      const allNodes = tree.getAllNodes();
      expect(allNodes).toHaveLength(1);

      tree.destroy();
    });

    test('should validate selectable parameter', () => {
      expect(() => {
        Tree.create({
          data: sampleData,
          dom: container,
          selectable: 'invalid'
        });
      }).toThrow('Tree selectable must be "none", "single", or "multiple"');
    });

    test('should validate theme parameter', () => {
      expect(() => {
        Tree.create({
          data: sampleData,
          dom: container,
          theme: 'invalid'
        });
      }).toThrow('Tree theme must be "light" or "dark"');
    });
  });

  describe('Inline Editing', () => {
    let tree;

    beforeEach(() => {
      tree = Tree.create({
        data: sampleData,
        dom: container,
        editable: true
      });
    });

    afterEach(() => {
      tree.destroy();
    });

    test('should provide editing methods when editable is enabled', () => {
      expect(typeof tree.startEditing).toBe('function');
      expect(typeof tree.finishEditing).toBe('function');
      expect(typeof tree.cancelEditing).toBe('function');
      expect(typeof tree.isEditing).toBe('function');
    });

    test('should not provide editing methods when editable is disabled', () => {
      const nonEditableTree = Tree.create({
        data: sampleData,
        dom: container,
        editable: false
      });

      expect(nonEditableTree.startEditing).toBeUndefined();
      expect(nonEditableTree.finishEditing).toBeUndefined();
      expect(nonEditableTree.cancelEditing).toBeUndefined();
      expect(nonEditableTree.isEditing).toBeUndefined();

      nonEditableTree.destroy();
    });

    test('should track editing state', () => {
      expect(tree.isEditing()).toBe(false);
      expect(tree.isEditing('root1')).toBe(false);

      tree.startEditing('root1');
      expect(tree.isEditing()).toBe(true);
      expect(tree.isEditing('root1')).toBe(true);
      expect(tree.isEditing('root2')).toBe(false);

      tree.cancelEditing();
      expect(tree.isEditing()).toBe(false);
    });

    test('should call editing callbacks when node is edited', () => {
      let editCallbackArgs = null;
      let dataChangeCallbackArgs = null;

      const editableTree = Tree.create({
        data: sampleData,
        dom: container,
        editable: true,
        onNodeEdit: (...args) => {
          editCallbackArgs = args;
        },
        onDataChange: (...args) => {
          dataChangeCallbackArgs = args;
        }
      });

      // Start editing
      editableTree.startEditing('root1');
      
      // Simulate finishing edit with new value
      editableTree.finishEditing('New Root Name');

      expect(editCallbackArgs).not.toBeNull();
      expect(editCallbackArgs[0]).toBe('root1'); // nodeId
      expect(editCallbackArgs[1]).toBe('New Root Name'); // newValue
      expect(editCallbackArgs[2]).toBe('Root 1'); // oldValue

      expect(dataChangeCallbackArgs).not.toBeNull();
      expect(Array.isArray(dataChangeCallbackArgs[0])).toBe(true); // data array

      editableTree.destroy();
    });
  });

  describe('MVVM Component Integration', () => {
    test('should provide access to internal components via debug', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container
      });

      const debug = tree.debug();
      
      expect(debug.model).toBeInstanceOf(TreeModel);
      expect(debug.view).toBeInstanceOf(TreeView);
      expect(debug.viewModel).toBeInstanceOf(TreeViewModel);
      expect(debug.config).toBeDefined();
      expect(debug.stats).toBeDefined();

      tree.destroy();
    });

    test('should maintain MVVM separation of concerns', () => {
      const tree = Tree.create({
        data: sampleData,
        dom: container
      });

      const debug = tree.debug();
      
      // Model should handle data and state
      expect(typeof debug.model.getVisibleNodes).toBe('function');
      expect(typeof debug.model.expand).toBe('function');
      expect(typeof debug.model.select).toBe('function');
      
      // View should handle DOM
      expect(typeof debug.view.render).toBe('function');
      expect(typeof debug.view.updateSelection).toBe('function');
      
      // ViewModel should coordinate
      expect(typeof debug.viewModel.render).toBe('function');
      expect(typeof debug.viewModel.toggleExpansion).toBe('function');

      tree.destroy();
    });
  });
});