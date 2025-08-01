/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';
import { MVVMTestHelpers } from '../src/components/base/index.js';

describe('ModernTree Component', () => {
  let container;
  let sampleData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    
    // Create hierarchical test data
    sampleData = [
      {
        id: 'root1',
        name: 'Documents',
        children: [
          {
            id: 'folder1',
            name: 'Projects',
            children: [
              { id: 'file1', name: 'project1.txt' },
              { id: 'file2', name: 'project2.txt' }
            ]
          },
          { id: 'file3', name: 'readme.md' }
        ]
      },
      {
        id: 'root2',
        name: 'Pictures',
        children: [
          { id: 'file4', name: 'vacation.jpg' },
          { id: 'file5', name: 'family.png' }
        ]
      },
      { id: 'root3', name: 'Music' }
    ];
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should follow three-mode pattern', () => {
      const protocolResults = MVVMTestHelpers.testUmbilicalProtocol(ModernTree, {
        validUmbilical: { data: sampleData }
      });
      
      expect(protocolResults.introspection.passed).toBe(true);
      expect(protocolResults.instance.passed).toBe(true);
      expect(protocolResults.errors).toHaveLength(0);
    });

    test('should define comprehensive requirements', () => {
      let requirements = null;
      ModernTree.create({
        describe: (reqs) => { requirements = reqs; }
      });
      
      expect(requirements).toBeDefined();
      const reqList = requirements.getAll();
      
      // Check for tree-specific requirements
      expect(reqList.data).toBeDefined();
      expect(reqList.selectable).toBeDefined();
      expect(reqList.expandable).toBeDefined();
      expect(reqList.draggable).toBeDefined();
      expect(reqList.searchable).toBeDefined();
      expect(reqList.onSelectionChange).toBeDefined();
      expect(reqList.onExpansionChange).toBeDefined();
    });

    test('should validate tree-specific capabilities', () => {
      const validResult = ModernTree.create({
        validate: (checks) => checks
      }, { 
        dom: container,
        data: sampleData,
        selectable: 'multiple'
      });
      
      expect(validResult.hasValidData).toBe(true);
      expect(validResult.hasValidSelectable).toBe(true);
      expect(validResult.hasValidCallbacks).toBe(true);
    });
  });

  describe('Component Creation and Initialization', () => {
    test('should create ModernTree instance with minimal config', () => {
      const tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
      
      expect(tree).toBeDefined();
      expect(typeof tree.destroy).toBe('function');
      
      const debug = tree.debug();
      expect(debug.model).toBeDefined();
      expect(debug.view).toBeDefined();
      expect(debug.viewModel).toBeDefined();
      
      tree.destroy();
    });

    test('should create tree with full configuration', () => {
      const callbacks = MVVMTestHelpers.createMockEventHandlers();
      
      const tree = ModernTree.create({
        dom: container,
        data: sampleData,
        theme: 'dark',
        selectable: 'multiple',
        expandable: true,
        draggable: true,
        editable: true,
        searchable: true,
        virtualScrolling: false,
        showIcons: true,
        showLines: true,
        onSelectionChange: callbacks.onSelectionChange,
        onExpansionChange: callbacks.onExpansionChange,
        onNodeEdit: callbacks.onNodeEdit
      });
      
      expect(tree).toBeDefined();
      
      const config = tree.getConfig();
      expect(config.theme).toBe('dark');
      expect(config.selectable).toBe('multiple');
      expect(config.draggable).toBe(true);
      
      tree.destroy();
    });

    test('should render tree structure in DOM', () => {
      const tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
      
      // Check for tree container
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer).toBeTruthy();
      
      // Check for tree nodes
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBeGreaterThan(0);
      
      // Check for root nodes
      const documentsNode = Array.from(treeNodes).find(node => 
        node.textContent.includes('Documents')
      );
      expect(documentsNode).toBeTruthy();
      
      tree.destroy();
    });
  });

  describe('Tree Data Management', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should handle hierarchical data structure', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Check root nodes
      expect(model.getNode('root1')).toBeTruthy();
      expect(model.getNode('root2')).toBeTruthy();
      expect(model.getNode('root3')).toBeTruthy();
      
      // Check children
      expect(model.hasChildren('root1')).toBe(true);
      expect(model.hasChildren('root3')).toBe(false);
      
      const root1Children = model.getNodeChildren('root1');
      expect(root1Children).toContain('folder1');
      expect(root1Children).toContain('file3');
    });

    test('should calculate node depths correctly', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.getNodeDepth('root1')).toBe(0);
      expect(model.getNodeDepth('folder1')).toBe(1);
      expect(model.getNodeDepth('file1')).toBe(2);
    });

    test('should track parent-child relationships', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.getNodeParent('folder1')).toBe('root1');
      expect(model.getNodeParent('file1')).toBe('folder1');
      expect(model.getNodeParent('root1')).toBe(null);
    });

    test('should get node paths from root', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      const file1Path = model.getNodePath('file1');
      expect(file1Path).toEqual(['root1', 'folder1', 'file1']);
    });
  });

  describe('Node Expansion and Collapse', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should expand and collapse nodes', () => {
      // Initially, nodes should be collapsed
      expect(tree.executeCommand('expandNode', { nodeId: 'root1' })).toBe(true);
      
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.isExpanded('root1')).toBe(true);
      
      // Collapse the node
      expect(tree.executeCommand('collapseNode', { nodeId: 'root1' })).toBe(true);
      expect(model.isExpanded('root1')).toBe(false);
    });

    test('should toggle node expansion', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Initial state should be collapsed
      expect(model.isExpanded('root1')).toBe(false);
      
      // Toggle to expand
      tree.executeCommand('toggleNode', { nodeId: 'root1' });
      expect(model.isExpanded('root1')).toBe(true);
      
      // Toggle to collapse
      tree.executeCommand('toggleNode', { nodeId: 'root1' });
      expect(model.isExpanded('root1')).toBe(false);
    });

    test('should expand all nodes', () => {
      tree.executeCommand('expandAll');
      
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.isExpanded('root1')).toBe(true);
      expect(model.isExpanded('root2')).toBe(true);
      expect(model.isExpanded('folder1')).toBe(true);
    });

    test('should collapse all nodes', () => {
      // First expand some nodes
      tree.executeCommand('expandAll');
      
      // Then collapse all
      tree.executeCommand('collapseAll');
      
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.isExpanded('root1')).toBe(false);
      expect(model.isExpanded('root2')).toBe(false);
      expect(model.isExpanded('folder1')).toBe(false);
    });

    test('should expand to specific depth', () => {
      tree.executeCommand('expandToDepth', { depth: 1 });
      
      const debug = tree.debug();
      const model = debug.model;
      
      // Depth 0 nodes (roots) should be expanded
      expect(model.isExpanded('root1')).toBe(true);
      expect(model.isExpanded('root2')).toBe(true);
      
      // Depth 1 nodes should not be expanded (depth 1 means expand nodes at depth 0)
      expect(model.isExpanded('folder1')).toBe(false);
    });
  });

  describe('Node Selection', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData,
        selectable: 'multiple'
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should select and deselect nodes', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Select a node
      tree.executeCommand('selectNode', { nodeId: 'root1' });
      expect(model.isSelected('root1')).toBe(true);
      
      // Deselect the node
      tree.executeCommand('deselectNode', { nodeId: 'root1' });
      expect(model.isSelected('root1')).toBe(false);
    });

    test('should handle multiple selection', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Select multiple nodes
      tree.executeCommand('selectNode', { nodeId: 'root1', extend: true });
      tree.executeCommand('selectNode', { nodeId: 'root2', extend: true });
      
      expect(model.isSelected('root1')).toBe(true);
      expect(model.isSelected('root2')).toBe(true);
      
      const selectedNodes = model.getSelectedNodes();
      expect(selectedNodes).toContain('root1');
      expect(selectedNodes).toContain('root2');
    });

    test('should clear all selections', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Select multiple nodes
      tree.executeCommand('selectNode', { nodeId: 'root1', extend: true });
      tree.executeCommand('selectNode', { nodeId: 'root2', extend: true });
      
      // Clear selection
      tree.executeCommand('clearSelection');
      
      expect(model.getSelectedNodes()).toHaveLength(0);
    });

    test('should get selection through public API', () => {
      tree.executeCommand('selectNode', { nodeId: 'root1' });
      
      const selection = tree.getSelection();
      expect(selection).toHaveLength(1);
      expect(selection[0].id).toBe('root1');
      expect(selection[0].data.name).toBe('Documents');
    });
  });

  describe('Search Functionality', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData,
        searchable: true
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should search nodes by name', async () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Perform search
      const results = model.search('project');
      
      expect(results.length).toBe(2); // project1.txt and project2.txt
      expect(results[0].node.name).toContain('project');
      expect(results[1].node.name).toContain('project');
    });

    test('should highlight search results', async () => {
      const debug = tree.debug();
      const model = debug.model;
      
      model.search('Documents');
      
      expect(model.isSearchResult('root1')).toBe(true);
      expect(model.isSearchResult('root2')).toBe(false);
    });

    test('should clear search results', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Perform search then clear
      model.search('Documents');
      expect(model.isSearchResult('root1')).toBe(true);
      
      model.clearSearch();
      expect(model.isSearchResult('root1')).toBe(false);
    });

    test('should expand ancestors of search results', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Search for deeply nested item
      model.search('project1', { expandResults: true });
      
      // Ancestors should be expanded
      expect(model.isExpanded('root1')).toBe(true);
      expect(model.isExpanded('folder1')).toBe(true);
    });
  });

  describe('Focus and Navigation', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
      
      // Expand some nodes for navigation testing
      tree.executeCommand('expandNode', { nodeId: 'root1' });
      tree.executeCommand('expandNode', { nodeId: 'folder1' });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should set and get focused node', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      tree.executeCommand('focusNode', { nodeId: 'root1' });
      expect(model.getFocusedNode()).toBe('root1');
    });

    test('should navigate between visible nodes', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Focus first node
      tree.executeCommand('focusNode', { nodeId: 'root1' });
      
      // Navigate down
      tree.executeCommand('navigateDown', { fromNode: 'root1' });
      
      // Should focus next visible node (folder1 since root1 is expanded)
      const focusedNode = model.getFocusedNode();
      expect(focusedNode).toBe('folder1');
    });

    test('should navigate to first and last nodes', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Navigate to end
      tree.executeCommand('navigateEnd');
      const lastFocused = model.getFocusedNode();
      
      // Navigate to home
      tree.executeCommand('navigateHome');
      const firstFocused = model.getFocusedNode();
      
      expect(firstFocused).toBe('root1'); // First visible node
      expect(lastFocused).toBeTruthy(); // Last visible node
    });
  });

  describe('State Management', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should export and import tree state', () => {
      const debug = tree.debug();
      const model = debug.model;
      
      // Set up some state
      tree.executeCommand('expandNode', { nodeId: 'root1' });
      tree.executeCommand('selectNode', { nodeId: 'folder1' });
      model.setFocusedNode('file3');
      
      // Export state
      const state = tree.executeCommand('exportState');
      
      expect(state.expandedNodes).toContain('root1');
      expect(state.selectedNodes).toContain('folder1');
      expect(state.focusedNode).toBe('file3');
      
      // Reset state
      tree.executeCommand('collapseAll');
      tree.executeCommand('clearSelection');
      
      // Import state
      tree.executeCommand('importState', { state });
      
      expect(model.isExpanded('root1')).toBe(true);
      expect(model.isSelected('folder1')).toBe(true);
      expect(model.getFocusedNode()).toBe('file3');
    });

    test('should get tree statistics', () => {
      tree.executeCommand('expandAll');
      tree.executeCommand('selectNode', { nodeId: 'root1', extend: true });
      tree.executeCommand('selectNode', { nodeId: 'root2', extend: true });
      
      const stats = tree.getStats();
      
      expect(stats.totalNodes).toBe(8); // All nodes in sample data
      expect(stats.rootNodes).toBe(3);
      expect(stats.selectedNodes).toBe(2);
      expect(stats.expandedNodes).toBeGreaterThan(0);
    });
  });

  describe('Configuration Updates', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData,
        theme: 'light'
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should update configuration dynamically', () => {
      const originalConfig = tree.getConfig();
      expect(originalConfig.theme).toBe('light');
      
      tree.updateConfig({ theme: 'dark' });
      
      const updatedConfig = tree.getConfig();
      expect(updatedConfig.theme).toBe('dark');
      
      // Check that theme was applied to view
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer.classList.contains('theme-dark')).toBe(true);
    });

    test('should update data dynamically', () => {
      const newData = [
        { id: 'new1', name: 'New Root', children: [] }
      ];
      
      tree.updateConfig({ data: newData });
      
      const debug = tree.debug();
      const model = debug.model;
      
      expect(model.getNode('new1')).toBeTruthy();
      expect(model.getNode('root1')).toBeFalsy();
    });
  });

  describe('User Interactions', () => {
    let tree;
    let callbacks;

    beforeEach(() => {
      callbacks = MVVMTestHelpers.createMockEventHandlers();
      
      tree = ModernTree.create({
        dom: container,
        data: sampleData,
        onSelectionChange: callbacks.onSelectionChange,
        onExpansionChange: callbacks.onExpansionChange
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should handle node click interactions', () => {
      // Expand root to make folder visible
      tree.executeCommand('expandNode', { nodeId: 'root1' });
      
      // Find and click a node
      const folderNode = container.querySelector('[data-node-id="folder1"]');
      expect(folderNode).toBeTruthy();
      
      // Simulate click
      folderNode.click();
      
      // Check that selection callback was called
      expect(callbacks.onSelectionChange.callCount).toBeGreaterThan(0);
      
      // Check that node is selected
      const debug = tree.debug();
      const model = debug.model;
      expect(model.isSelected('folder1')).toBe(true);
    });

    test('should handle expand/collapse toggle clicks', () => {
      // Find expand toggle for root1
      const rootNode = container.querySelector('[data-node-id="root1"]');
      const toggle = rootNode.querySelector('.node-toggle');
      
      expect(toggle).toBeTruthy();
      
      // Click toggle to expand
      toggle.click();
      
      // Check that expansion callback was called
      expect(callbacks.onExpansionChange.callCount).toBeGreaterThan(0);
      
      // Check that node is expanded
      const debug = tree.debug();
      const model = debug.model;
      expect(model.isExpanded('root1')).toBe(true);
    });

    test('should handle keyboard navigation', () => {
      // Focus the tree
      container.focus();
      
      // Simulate arrow key navigation
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowDown', 
        bubbles: true 
      });
      
      container.dispatchEvent(keyEvent);
      
      // Should have focused some node
      const debug = tree.debug();
      const model = debug.model;
      expect(model.getFocusedNode()).toBeTruthy();
    });
  });

  describe('Performance and Virtual Scrolling', () => {
    test('should handle large datasets with virtual scrolling', () => {
      // Create large dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: `item_${i}`,
        name: `Item ${i}`,
        children: i % 10 === 0 ? [
          { id: `child_${i}_1`, name: `Child ${i}.1` },
          { id: `child_${i}_2`, name: `Child ${i}.2` }
        ] : undefined
      }));
      
      const tree = ModernTree.create({
        dom: container,
        data: largeData,
        virtualScrolling: true
      });
      
      expect(tree).toBeDefined();
      
      // Should render successfully without performance issues
      const debug = tree.debug();
      const stats = debug.stats;
      expect(stats.model.totalNodes).toBe(1200); // 1000 + 200 children
      
      tree.destroy();
    });
  });

  describe('Accessibility', () => {
    let tree;

    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
    });

    afterEach(() => {
      if (tree) {
        tree.destroy();
      }
    });

    test('should have proper ARIA attributes', () => {
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer.getAttribute('role')).toBe('tree');
      expect(treeContainer.getAttribute('aria-label')).toBeTruthy();
      
      const treeNodes = container.querySelectorAll('.tree-node');
      treeNodes.forEach(node => {
        expect(node.getAttribute('role')).toBe('treeitem');
        expect(node.getAttribute('aria-level')).toBeTruthy();
      });
    });

    test('should have aria-live region for announcements', () => {
      const ariaLive = container.querySelector('[aria-live]');
      expect(ariaLive).toBeTruthy();
      expect(ariaLive.getAttribute('aria-live')).toBe('polite');
    });

    test('should be keyboard navigable', () => {
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer.tabIndex).toBe(0);
      
      // Should handle focus
      treeContainer.focus();
      expect(document.activeElement).toBe(treeContainer);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty data gracefully', () => {
      const tree = ModernTree.create({
        dom: container,
        data: []
      });
      
      expect(tree).toBeDefined();
      
      const debug = tree.debug();
      const stats = debug.stats;
      expect(stats.model.totalNodes).toBe(0);
      
      tree.destroy();
    });

    test('should handle malformed data gracefully', () => {
      const malformedData = [
        { name: 'No ID node' },
        { id: 'valid', name: 'Valid node' },
        { id: 'circular', name: 'Circular', children: [] }
      ];
      
      // Add circular reference
      malformedData[2].children.push(malformedData[2]);
      
      const tree = ModernTree.create({
        dom: container,
        data: malformedData
      });
      
      expect(tree).toBeDefined();
      
      const debug = tree.debug();
      const model = debug.model;
      
      // Should handle validation
      const validation = model.validateTreeStructure();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      tree.destroy();
    });

    test('should cleanup properly on destroy', () => {
      const tree = ModernTree.create({
        dom: container,
        data: sampleData
      });
      
      // Verify tree was created
      expect(container.querySelector('.modern-tree')).toBeTruthy();
      
      tree.destroy();
      
      // Verify cleanup
      expect(container.children.length).toBe(0);
    });
  });
});