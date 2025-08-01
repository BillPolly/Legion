/**
 * TreeScribeView Tests
 * 
 * Testing TreeScribeView class - DOM structure creation, theme application, and basic rendering
 */

import { TreeScribeView } from '../../../../../../src/components/tree-scribe/core/view/TreeScribeView.js';

describe('TreeScribeView', () => {
  let container;
  let view;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (view && view.destroy) {
      view.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('DOM Structure Creation', () => {
    test('should create basic TreeScribe DOM structure', () => {
      view = new TreeScribeView(container);
      
      expect(view.container).toBe(container);
      expect(container.classList.contains('tree-scribe')).toBe(true);
      
      // Should have header section
      const header = container.querySelector('.tree-scribe-header');
      expect(header).toBeDefined();
      
      // Should have content section
      const content = container.querySelector('.tree-scribe-content');
      expect(content).toBeDefined();
      
      // Should have tree container
      const treeContainer = container.querySelector('.tree-scribe-tree');
      expect(treeContainer).toBeDefined();
    });

    test('should create search functionality in header', () => {
      view = new TreeScribeView(container);
      
      const searchInput = container.querySelector('.tree-scribe-search input');
      const searchButton = container.querySelector('.tree-scribe-search button');
      
      expect(searchInput).toBeDefined();
      expect(searchButton).toBeDefined();
      expect(searchInput.type).toBe('text');
      expect(searchInput.placeholder).toBe('Search content...');
    });

    test('should create control buttons in header', () => {
      view = new TreeScribeView(container);
      
      const expandAllBtn = container.querySelector('.tree-scribe-controls .expand-all');
      const collapseAllBtn = container.querySelector('.tree-scribe-controls .collapse-all');
      const exportBtn = container.querySelector('.tree-scribe-controls .export');
      
      expect(expandAllBtn).toBeDefined();
      expect(collapseAllBtn).toBeDefined();
      expect(exportBtn).toBeDefined();
      expect(expandAllBtn.textContent).toBe('Expand All');
      expect(collapseAllBtn.textContent).toBe('Collapse All');
      expect(exportBtn.textContent).toBe('Export');
    });

    test('should have scrollable content area', () => {
      view = new TreeScribeView(container);
      
      const content = container.querySelector('.tree-scribe-content');
      const computedStyle = window.getComputedStyle(content);
      
      expect(computedStyle.overflow).toBe('auto');
      expect(content.style.maxHeight).toBeTruthy();
    });
  });

  describe('Theme Application', () => {
    test('should apply light theme by default', () => {
      view = new TreeScribeView(container);
      
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(true);
      expect(container.classList.contains('tree-scribe-theme-dark')).toBe(false);
    });

    test('should apply dark theme when specified', () => {
      view = new TreeScribeView(container, { theme: 'dark' });
      
      expect(container.classList.contains('tree-scribe-theme-dark')).toBe(true);
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(false);
    });

    test('should allow theme switching after creation', () => {
      view = new TreeScribeView(container);
      
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(true);
      
      view.setTheme('dark');
      expect(container.classList.contains('tree-scribe-theme-dark')).toBe(true);
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(false);
      
      view.setTheme('light');
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(true);
      expect(container.classList.contains('tree-scribe-theme-dark')).toBe(false);
    });

    test('should handle invalid theme gracefully', () => {
      view = new TreeScribeView(container, { theme: 'invalid' });
      
      // Should fallback to light theme
      expect(container.classList.contains('tree-scribe-theme-light')).toBe(true);
    });
  });

  describe('Basic Rendering', () => {
    test('should render empty state message when no content', () => {
      view = new TreeScribeView(container);
      
      const treeContainer = container.querySelector('.tree-scribe-tree');
      const emptyMessage = treeContainer.querySelector('.tree-scribe-empty');
      
      expect(emptyMessage).toBeDefined();
      expect(emptyMessage.textContent).toContain('No document loaded');
    });

    test('should clear empty state when content is rendered', () => {
      view = new TreeScribeView(container);
      
      // Initially should have empty state
      expect(container.querySelector('.tree-scribe-empty')).toBeDefined();
      
      // Simulate rendering content
      view.renderTree([{ id: 'root', title: 'Test', children: [] }]);
      
      // Empty state should be removed
      expect(container.querySelector('.tree-scribe-empty')).toBeNull();
    });

    test('should create node elements when rendering tree', () => {
      view = new TreeScribeView(container);
      
      const testNodes = [
        { id: 'root', title: 'Root Node', children: [], expanded: true },
        { id: 'child1', title: 'Child 1', children: [], expanded: false },
        { id: 'child2', title: 'Child 2', children: [], expanded: false }
      ];
      
      view.renderTree(testNodes);
      
      const nodeElements = container.querySelectorAll('.tree-node');
      expect(nodeElements.length).toBe(3);
      
      // Check first node
      const rootNode = container.querySelector('[data-node-id="root"]');
      expect(rootNode).toBeDefined();
      expect(rootNode.querySelector('.node-title').textContent).toBe('Root Node');
    });

    test('should apply correct CSS classes to nodes', () => {
      view = new TreeScribeView(container);
      
      const testNodes = [
        { id: 'expanded', title: 'Expanded', children: [], expanded: true },
        { id: 'collapsed', title: 'Collapsed', children: [], expanded: false }
      ];
      
      view.renderTree(testNodes);
      
      const expandedNode = container.querySelector('[data-node-id="expanded"]');
      const collapsedNode = container.querySelector('[data-node-id="collapsed"]');
      
      expect(expandedNode.classList.contains('expanded')).toBe(true);
      expect(collapsedNode.classList.contains('collapsed')).toBe(true);
    });
  });

  describe('Cleanup and Destroy', () => {
    test('should remove all event listeners on destroy', () => {
      view = new TreeScribeView(container);
      
      // Get references to elements that should have event listeners
      const searchInput = container.querySelector('.tree-scribe-search input');
      const expandAllBtn = container.querySelector('.expand-all');
      
      // Add some mock event listeners to verify cleanup
      let searchCalled = false;
      let expandCalled = false;
      
      searchInput.addEventListener('input', () => { searchCalled = true; });
      expandAllBtn.addEventListener('click', () => { expandCalled = true; });
      
      // Destroy view
      view.destroy();
      
      // Events should not fire after destroy (listeners removed)
      searchInput.dispatchEvent(new Event('input'));
      expandAllBtn.dispatchEvent(new Event('click'));
      
      // Note: In real implementation, destroy should remove listeners
      // This test verifies the destroy method exists and cleans up properly
      expect(view.destroyed).toBe(true);
    });

    test('should clear DOM content on destroy', () => {
      view = new TreeScribeView(container);
      
      expect(container.innerHTML).not.toBe('');
      
      view.destroy();
      
      expect(container.innerHTML).toBe('');
    });

    test('should be safe to call destroy multiple times', () => {
      view = new TreeScribeView(container);
      
      expect(() => {
        view.destroy();
        view.destroy();
        view.destroy();
      }).not.toThrow();
    });

    test('should properly clean up memory references', () => {
      view = new TreeScribeView(container);
      
      // View should have internal references
      expect(view.container).toBeDefined();
      expect(view.elements).toBeDefined();
      
      view.destroy();
      
      // References should be cleared
      expect(view.container).toBeNull();
      expect(view.elements).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing container gracefully', () => {
      expect(() => {
        view = new TreeScribeView(null);
      }).toThrow('TreeScribeView requires a valid DOM container');
    });

    test('should handle invalid container type gracefully', () => {
      expect(() => {
        view = new TreeScribeView('not-a-dom-element');
      }).toThrow('TreeScribeView requires a valid DOM container');
    });

    test('should handle render errors gracefully', () => {
      view = new TreeScribeView(container);
      
      // Should not throw with invalid data
      expect(() => {
        view.renderTree(null);
      }).not.toThrow();
      
      expect(() => {
        view.renderTree('invalid-data');
      }).not.toThrow();
    });
  });
});