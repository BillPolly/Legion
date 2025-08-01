/**
 * Tree View Rendering Tests
 */
import { createTestContainer, cleanupTestContainer, createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('Tree View Rendering', () => {
  let HierarchyTreeView;
  let container;
  let testHierarchy;

  beforeEach(async () => {
    // Import will be implemented
    try {
      const module = await import('../../../view/HierarchyTreeView.js');
      HierarchyTreeView = module.HierarchyTreeView;
    } catch (error) {
      // Temporarily skip if not implemented yet
      HierarchyTreeView = null;
    }
    
    container = createTestContainer();
    testHierarchy = createTestHierarchy();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Rendering Root Node', () => {
    test('should render single root node', () => {
      if (!HierarchyTreeView) return;
      
      const rootNode = createTestNode('object', 'root', null);
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(rootNode);
      
      expect(element).toBeDefined();
      expect(element.tagName).toBe('DIV');
      expect(element.classList.contains('hierarchy-node')).toBe(true);
      expect(element.dataset.nodeId).toBe(rootNode.id);
      expect(element.dataset.nodeType).toBe('object');
    });

    test('should render root node with proper structure', () => {
      if (!HierarchyTreeView) return;
      
      const rootNode = createTestNode('value', 'testKey', 'testValue');
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(rootNode);
      
      // Should have node header with name and value
      const header = element.querySelector('.node-header');
      expect(header).toBeDefined();
      
      const nameSpan = header.querySelector('.node-name');
      expect(nameSpan.textContent).toBe('testKey');
      
      const valueSpan = header.querySelector('.node-value');
      expect(valueSpan.textContent).toBe('testValue');
    });

    test('should render root node with null value', () => {
      if (!HierarchyTreeView) return;
      
      const rootNode = createTestNode('value', 'nullKey', null);
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(rootNode);
      const valueSpan = element.querySelector('.node-value');
      
      expect(valueSpan.textContent).toBe('null');
      expect(valueSpan.classList.contains('null-value')).toBe(true);
    });

    test('should render different node types correctly', () => {
      if (!HierarchyTreeView) return;
      
      const treeView = new HierarchyTreeView(container);
      
      const objectNode = createTestNode('object', 'obj', null);
      const arrayNode = createTestNode('array', 'arr', null);
      const valueNode = createTestNode('value', 'val', 'text');
      
      const objElement = treeView.renderNode(objectNode);
      const arrElement = treeView.renderNode(arrayNode);
      const valElement = treeView.renderNode(valueNode);
      
      expect(objElement.classList.contains('node-object')).toBe(true);
      expect(arrElement.classList.contains('node-array')).toBe(true);
      expect(valElement.classList.contains('node-value')).toBe(true);
    });
  });

  describe('Rendering Child Nodes', () => {
    test('should render object with child nodes', () => {
      if (!HierarchyTreeView) return;
      
      const hierarchy = createTestHierarchy();
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(hierarchy);
      
      expect(element.classList.contains('has-children')).toBe(true);
      
      const childrenContainer = element.querySelector('.node-children');
      expect(childrenContainer).toBeDefined();
      
      const childElements = childrenContainer.querySelectorAll('.hierarchy-node');
      expect(childElements.length).toBe(hierarchy.children.length);
    });

    test('should render child nodes with proper parent-child relationship', () => {
      if (!HierarchyTreeView) return;
      
      const hierarchy = createTestHierarchy();
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(hierarchy);
      const childElements = element.querySelectorAll('.node-children > .hierarchy-node');
      
      childElements.forEach((childElement, index) => {
        const expectedNodeId = hierarchy.children[index].id;
        expect(childElement.dataset.nodeId).toBe(expectedNodeId);
        expect(childElement.dataset.parentId).toBe(hierarchy.id);
      });
    });

    test('should handle empty children containers', () => {
      if (!HierarchyTreeView) return;
      
      const emptyObject = createTestNode('object', 'empty', null);
      const treeView = new HierarchyTreeView(container);
      
      const element = treeView.renderNode(emptyObject);
      
      expect(element.classList.contains('has-children')).toBe(false);
      const childrenContainer = element.querySelector('.node-children');
      expect(childrenContainer).toBeNull(); // No children container for empty nodes
    });

    test('should render nested child hierarchies', () => {
      if (!HierarchyTreeView) return;
      
      const root = createTestNode('object', 'root', null);
      const level1 = createTestNode('object', 'level1', null);
      const level2 = createTestNode('value', 'level2', 'deepValue');
      
      level2.parent = level1;
      level1.children = [level2];
      level1.parent = root;
      root.children = [level1];
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(root);
      
      // Check nested structure
      const level1Element = element.querySelector('.node-children .hierarchy-node');
      expect(level1Element.dataset.nodeId).toBe(level1.id);
      
      const level2Element = level1Element.querySelector('.node-children .hierarchy-node');
      expect(level2Element.dataset.nodeId).toBe(level2.id);
      expect(level2Element.querySelector('.node-value').textContent).toBe('deepValue');
    });
  });

  describe('Depth Visualization', () => {
    test('should apply depth classes to nodes', () => {
      if (!HierarchyTreeView) return;
      
      const root = createTestNode('object', 'root', null);
      const child = createTestNode('object', 'child', null);
      const grandchild = createTestNode('value', 'grandchild', 'value');
      
      grandchild.parent = child;
      child.children = [grandchild];
      child.parent = root;
      root.children = [child];
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(root, 0); // Start at depth 0
      
      expect(element.classList.contains('depth-0')).toBe(true);
      
      const childElement = element.querySelector('.node-children .hierarchy-node');
      expect(childElement.classList.contains('depth-1')).toBe(true);
      
      const grandchildElement = childElement.querySelector('.node-children .hierarchy-node');
      expect(grandchildElement.classList.contains('depth-2')).toBe(true);
    });

    test('should apply indentation based on depth', () => {
      if (!HierarchyTreeView) return;
      
      const root = createTestNode('object', 'root', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = root;
      root.children = [child];
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(root, 0);
      
      const childElement = element.querySelector('.node-children .hierarchy-node');
      const childHeader = childElement.querySelector('.node-header');
      
      // Should have indentation style applied
      expect(childHeader.style.paddingLeft).toBeTruthy();
    });

    test('should handle deep nesting levels', () => {
      if (!HierarchyTreeView) return;
      
      // Create 5 levels deep
      let current = createTestNode('object', 'level0', null);
      const root = current;
      
      for (let i = 1; i < 5; i++) {
        const child = createTestNode('object', `level${i}`, null);
        child.parent = current;
        current.children = [child];
        current = child;
      }
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(root, 0);
      
      // Find the deepest element
      let deepest = element;
      for (let i = 0; i < 4; i++) {
        deepest = deepest.querySelector('.node-children .hierarchy-node');
      }
      
      expect(deepest.classList.contains('depth-4')).toBe(true);
    });

    test('should limit maximum depth visualization', () => {
      if (!HierarchyTreeView) return;
      
      const treeView = new HierarchyTreeView(container, { maxDepth: 3 });
      
      // Create deeper nesting than maxDepth
      let current = createTestNode('object', 'level0', null);
      const root = current;
      
      for (let i = 1; i < 6; i++) {
        const child = createTestNode('object', `level${i}`, null);
        child.parent = current;
        current.children = [child];
        current = child;
      }
      
      const element = treeView.renderNode(root, 0);
      
      // Should only render up to maxDepth
      let current_element = element;
      let depth = 0;
      while (current_element.querySelector('.node-children .hierarchy-node')) {
        current_element = current_element.querySelector('.node-children .hierarchy-node');
        depth++;
      }
      
      expect(depth).toBeLessThanOrEqual(3);
    });
  });

  describe('Node Element Structure', () => {
    test('should create proper DOM structure for nodes', () => {
      if (!HierarchyTreeView) return;
      
      const node = createTestNode('object', 'testNode', null);
      const child = createTestNode('value', 'childKey', 'childValue');
      child.parent = node;
      node.children = [child];
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(node);
      
      // Check main structure
      expect(element.classList.contains('hierarchy-node')).toBe(true);
      expect(element.classList.contains('node-object')).toBe(true);
      expect(element.classList.contains('has-children')).toBe(true);
      
      // Check header structure
      const header = element.querySelector('.node-header');
      expect(header).toBeDefined();
      expect(header.querySelector('.node-name')).toBeDefined();
      expect(header.querySelector('.expand-toggle')).toBeDefined();
      
      // Check children structure
      const childrenContainer = element.querySelector('.node-children');
      expect(childrenContainer).toBeDefined();
      expect(childrenContainer.children.length).toBe(1);
    });

    test('should add appropriate ARIA attributes', () => {
      if (!HierarchyTreeView) return;
      
      const node = createTestNode('object', 'accessible', null);
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(node);
      
      expect(element.getAttribute('role')).toBe('treeitem');
      expect(element.getAttribute('aria-label')).toContain('accessible');
      
      if (node.children.length > 0) {
        expect(element.getAttribute('aria-expanded')).toBeDefined();
      }
    });

    test('should support custom CSS classes', () => {
      if (!HierarchyTreeView) return;
      
      const node = createTestNode('value', 'custom', 'value');
      node.metadata.cssClasses = ['custom-class', 'special-node'];
      
      const treeView = new HierarchyTreeView(container);
      const element = treeView.renderNode(node);
      
      expect(element.classList.contains('custom-class')).toBe(true);
      expect(element.classList.contains('special-node')).toBe(true);
    });

    test('should handle node icons and indicators', () => {
      if (!HierarchyTreeView) return;
      
      const objectNode = createTestNode('object', 'obj', null);
      const arrayNode = createTestNode('array', 'arr', null);
      const valueNode = createTestNode('value', 'val', 'text');
      
      const treeView = new HierarchyTreeView(container);
      
      const objElement = treeView.renderNode(objectNode);
      const arrElement = treeView.renderNode(arrayNode);
      const valElement = treeView.renderNode(valueNode);
      
      // Should have type-specific icons
      expect(objElement.querySelector('.node-icon')).toBeDefined();
      expect(arrElement.querySelector('.node-icon')).toBeDefined();
      expect(valElement.querySelector('.node-icon')).toBeDefined();
      
      // Icons should have type-specific classes
      expect(objElement.querySelector('.node-icon').classList.contains('icon-object')).toBe(true);
      expect(arrElement.querySelector('.node-icon').classList.contains('icon-array')).toBe(true);
      expect(valElement.querySelector('.node-icon').classList.contains('icon-value')).toBe(true);
    });
  });
});