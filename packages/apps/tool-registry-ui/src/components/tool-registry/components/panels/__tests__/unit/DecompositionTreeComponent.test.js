/**
 * Unit tests for DecompositionTreeComponent
 * Tests tree data structure, rendering, and interactions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

describe('DecompositionTreeComponent', () => {
  let mockUmbilical;
  let mockContainer;
  let component;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Create mock umbilical
    mockUmbilical = {
      dom: mockContainer,
      onNodeSelect: jest.fn(),
      onNodeExpand: jest.fn(),
      onNodeCollapse: jest.fn(),
      onNodeHover: jest.fn(),
      onComplexityChange: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('Tree Data Structure', () => {
    it('should initialize with empty tree', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const tree = component.getTree();
      expect(tree).toBeNull();
    });

    it('should set tree data', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Build REST API',
        complexity: 'COMPLEX',
        children: [
          { id: 'task1', description: 'Setup server', complexity: 'SIMPLE' },
          { id: 'task2', description: 'Create endpoints', complexity: 'COMPLEX' }
        ]
      };

      component.setTree(treeData);
      expect(component.getTree()).toEqual(treeData);
    });

    it('should find node by id', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Main task',
        children: [
          { id: 'task1', description: 'Subtask 1' },
          { 
            id: 'task2', 
            description: 'Subtask 2',
            children: [
              { id: 'task2.1', description: 'Sub-subtask' }
            ]
          }
        ]
      };

      component.setTree(treeData);
      
      const node = component.findNode('task2.1');
      expect(node).toEqual({ id: 'task2.1', description: 'Sub-subtask' });
    });

    it('should calculate tree depth', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { 
            id: 'level1',
            children: [
              { 
                id: 'level2',
                children: [
                  { id: 'level3' }
                ]
              }
            ]
          }
        ]
      };

      component.setTree(treeData);
      expect(component.getTreeDepth()).toBe(4);
    });

    it('should count total nodes', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { id: 'task1' },
          { 
            id: 'task2',
            children: [
              { id: 'task2.1' },
              { id: 'task2.2' }
            ]
          },
          { id: 'task3' }
        ]
      };

      component.setTree(treeData);
      expect(component.getNodeCount()).toBe(6);
    });

    it('should get nodes by complexity', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        complexity: 'COMPLEX',
        children: [
          { id: 'task1', complexity: 'SIMPLE' },
          { id: 'task2', complexity: 'COMPLEX' },
          { id: 'task3', complexity: 'SIMPLE' }
        ]
      };

      component.setTree(treeData);
      
      const simpleNodes = component.getNodesByComplexity('SIMPLE');
      expect(simpleNodes).toHaveLength(2);
      expect(simpleNodes.map(n => n.id)).toEqual(['task1', 'task3']);
    });

    it('should get leaf nodes', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { id: 'task1' },
          { 
            id: 'task2',
            children: [
              { id: 'task2.1' }
            ]
          }
        ]
      };

      component.setTree(treeData);
      
      const leafNodes = component.getLeafNodes();
      expect(leafNodes).toHaveLength(2);
      expect(leafNodes.map(n => n.id)).toEqual(['task1', 'task2.1']);
    });
  });

  describe('Tree Rendering', () => {
    it('should render empty state', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const emptyState = mockContainer.querySelector('.empty-tree');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No decomposition available');
    });

    it('should render tree nodes', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Main task',
        children: [
          { id: 'task1', description: 'Subtask 1' },
          { id: 'task2', description: 'Subtask 2' }
        ]
      };

      component.setTree(treeData);
      
      const nodes = mockContainer.querySelectorAll('.tree-node');
      expect(nodes.length).toBe(3);
    });

    it('should render node descriptions', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Build API Service'
      };

      component.setTree(treeData);
      
      const nodeDesc = mockContainer.querySelector('.node-description');
      expect(nodeDesc.textContent).toBe('Build API Service');
    });

    it('should render complexity badges', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Task',
        complexity: 'COMPLEX'
      };

      component.setTree(treeData);
      
      const badge = mockContainer.querySelector('.complexity-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('COMPLEX');
      expect(badge.classList.contains('complex')).toBe(true);
    });

    it('should render expand/collapse icons', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [{ id: 'child' }]
      };

      component.setTree(treeData);
      
      const expandIcon = mockContainer.querySelector('.expand-icon');
      expect(expandIcon).toBeTruthy();
    });

    it('should apply indentation levels', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { 
            id: 'level1',
            children: [
              { id: 'level2' }
            ]
          }
        ]
      };

      component.setTree(treeData);
      
      const level0 = mockContainer.querySelector('[data-node-id="root"]');
      const level1 = mockContainer.querySelector('[data-node-id="level1"]');
      const level2 = mockContainer.querySelector('[data-node-id="level2"]');
      
      expect(level0.classList.contains('level-0')).toBe(true);
      expect(level1.classList.contains('level-1')).toBe(true);
      expect(level2.classList.contains('level-2')).toBe(true);
    });

    it('should show node count summary', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { id: 'task1' },
          { id: 'task2' },
          { id: 'task3' }
        ]
      };

      component.setTree(treeData);
      
      const summary = mockContainer.querySelector('.tree-summary');
      expect(summary.textContent).toContain('4 tasks');
    });
  });

  describe('Node Interactions', () => {
    it('should handle node selection', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Main task'
      };

      component.setTree(treeData);
      
      const node = mockContainer.querySelector('[data-node-id="root"]');
      node.click();
      
      expect(node.classList.contains('selected')).toBe(true);
      expect(mockUmbilical.onNodeSelect).toHaveBeenCalledWith({
        id: 'root',
        description: 'Main task'
      });
    });

    it('should handle node expansion', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [{ id: 'child' }]
      };

      component.setTree(treeData);
      
      const expandIcon = mockContainer.querySelector('.expand-icon');
      expandIcon.click();
      
      const node = mockContainer.querySelector('[data-node-id="root"]');
      expect(node.classList.contains('collapsed')).toBe(true);
      expect(mockUmbilical.onNodeCollapse).toHaveBeenCalledWith('root');
    });

    it('should handle node collapse', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [{ id: 'child' }]
      };

      component.setTree(treeData);
      component.collapseNode('root');
      
      const expandIcon = mockContainer.querySelector('.expand-icon');
      expandIcon.click();
      
      const node = mockContainer.querySelector('[data-node-id="root"]');
      expect(node.classList.contains('collapsed')).toBe(false);
      expect(mockUmbilical.onNodeExpand).toHaveBeenCalledWith('root');
    });

    it('should handle node hover', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Task'
      };

      component.setTree(treeData);
      
      const node = mockContainer.querySelector('[data-node-id="root"]');
      node.dispatchEvent(new MouseEvent('mouseenter'));
      
      expect(mockUmbilical.onNodeHover).toHaveBeenCalledWith({
        id: 'root',
        description: 'Task'
      });
    });

    it('should expand/collapse all nodes', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { 
            id: 'task1',
            children: [{ id: 'subtask' }]
          }
        ]
      };

      component.setTree(treeData);
      component.collapseAll();
      
      const nodes = mockContainer.querySelectorAll('.tree-node.collapsed');
      expect(nodes.length).toBe(2); // root and task1
      
      component.expandAll();
      const collapsedNodes = mockContainer.querySelectorAll('.tree-node.collapsed');
      expect(collapsedNodes.length).toBe(0);
    });

    it('should highlight nodes by complexity', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        complexity: 'COMPLEX',
        children: [
          { id: 'task1', complexity: 'SIMPLE' },
          { id: 'task2', complexity: 'COMPLEX' }
        ]
      };

      component.setTree(treeData);
      component.highlightComplexity('COMPLEX');
      
      const highlighted = mockContainer.querySelectorAll('.highlighted');
      expect(highlighted.length).toBe(2);
    });

    it('should clear selection', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root'
      };

      component.setTree(treeData);
      component.selectNode('root');
      component.clearSelection();
      
      const selected = mockContainer.querySelectorAll('.selected');
      expect(selected.length).toBe(0);
    });
  });

  describe('Tree Updates', () => {
    it('should update node description', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Original'
      };

      component.setTree(treeData);
      component.updateNode('root', { description: 'Updated' });
      
      const nodeDesc = mockContainer.querySelector('.node-description');
      expect(nodeDesc.textContent).toBe('Updated');
    });

    it('should update node complexity', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        complexity: 'SIMPLE'
      };

      component.setTree(treeData);
      component.updateNode('root', { complexity: 'COMPLEX' });
      
      const badge = mockContainer.querySelector('.complexity-badge');
      expect(badge.textContent).toBe('COMPLEX');
      expect(mockUmbilical.onComplexityChange).toHaveBeenCalledWith('root', 'COMPLEX');
    });

    it('should add child node', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: []
      };

      component.setTree(treeData);
      component.addChildNode('root', {
        id: 'new-child',
        description: 'New task'
      });
      
      const nodes = mockContainer.querySelectorAll('.tree-node');
      expect(nodes.length).toBe(2);
      
      const newNode = mockContainer.querySelector('[data-node-id="new-child"]');
      expect(newNode).toBeTruthy();
    });

    it('should remove node', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { id: 'task1' },
          { id: 'task2' }
        ]
      };

      component.setTree(treeData);
      component.removeNode('task1');
      
      const nodes = mockContainer.querySelectorAll('.tree-node');
      expect(nodes.length).toBe(2); // root and task2
      
      const removedNode = mockContainer.querySelector('[data-node-id="task1"]');
      expect(removedNode).toBeFalsy();
    });
  });

  describe('Tree Filtering', () => {
    it('should filter nodes by search term', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        description: 'Main',
        children: [
          { id: 'task1', description: 'Setup database' },
          { id: 'task2', description: 'Create API' },
          { id: 'task3', description: 'Setup server' }
        ]
      };

      component.setTree(treeData);
      component.filterNodes('Setup');
      
      const visibleNodes = mockContainer.querySelectorAll('.tree-node:not(.filtered)');
      expect(visibleNodes.length).toBe(3); // root, task1, task3
    });

    it('should clear filter', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { id: 'task1' },
          { id: 'task2' }
        ]
      };

      component.setTree(treeData);
      component.filterNodes('task1');
      component.clearFilter();
      
      const filteredNodes = mockContainer.querySelectorAll('.filtered');
      expect(filteredNodes.length).toBe(0);
    });
  });

  describe('Tree Statistics', () => {
    it('should calculate complexity distribution', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        complexity: 'COMPLEX',
        children: [
          { id: 'task1', complexity: 'SIMPLE' },
          { id: 'task2', complexity: 'SIMPLE' },
          { id: 'task3', complexity: 'COMPLEX' }
        ]
      };

      component.setTree(treeData);
      
      const stats = component.getComplexityStats();
      expect(stats).toEqual({
        SIMPLE: 2,
        COMPLEX: 2,
        total: 4
      });
    });

    it('should get tree path to node', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      const treeData = {
        id: 'root',
        children: [
          { 
            id: 'task1',
            children: [
              { id: 'subtask' }
            ]
          }
        ]
      };

      component.setTree(treeData);
      
      const path = component.getNodePath('subtask');
      expect(path).toEqual(['root', 'task1', 'subtask']);
    });
  });

  describe('Integration', () => {
    it('should expose API through onMount', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      expect(mockUmbilical.onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          setTree: expect.any(Function),
          getTree: expect.any(Function),
          findNode: expect.any(Function),
          selectNode: expect.any(Function),
          expandNode: expect.any(Function),
          collapseNode: expect.any(Function),
          expandAll: expect.any(Function),
          collapseAll: expect.any(Function)
        })
      );
    });

    it('should clean up on destroy', async () => {
      const { DecompositionTreeComponent } = await import('../../DecompositionTreeComponent.js');
      component = await DecompositionTreeComponent.create(mockUmbilical);

      component.destroy();
      
      expect(mockUmbilical.onDestroy).toHaveBeenCalled();
      expect(mockContainer.innerHTML).toBe('');
    });
  });
});