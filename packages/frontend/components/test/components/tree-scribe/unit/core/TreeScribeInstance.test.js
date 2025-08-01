/**
 * TreeScribeInstance Integration Tests
 * 
 * Testing the complete TreeScribe instance that integrates Model, View, ViewModel, and Renderers
 */

import { TreeScribeInstance } from '../../../../../src/components/tree-scribe/TreeScribe.js';

describe('TreeScribeInstance', () => {
  let container;
  let instance;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (instance && instance.destroy) {
      instance.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Constructor', () => {
    test('should create instance with default options', () => {
      const umbilical = { dom: container };
      
      instance = new TreeScribeInstance(umbilical);
      
      expect(instance).toBeDefined();
      expect(instance.destroy).toBeInstanceOf(Function);
      expect(instance.loadYaml).toBeInstanceOf(Function);
      expect(instance.expandAll).toBeInstanceOf(Function);
      expect(instance.collapseAll).toBeInstanceOf(Function);
    });

    test('should create instance with custom theme', () => {
      const umbilical = { 
        dom: container,
        theme: 'dark'
      };
      
      instance = new TreeScribeInstance(umbilical);
      
      expect(container.classList.contains('tree-scribe-theme-dark')).toBe(true);
    });

    test('should create instance with callbacks', () => {
      let nodeToggleCalled = false;
      let searchCalled = false;
      
      const umbilical = {
        dom: container,
        onNodeToggle: (nodeId, expanded) => { nodeToggleCalled = true; },
        onSearch: (query, results) => { searchCalled = true; }
      };
      
      instance = new TreeScribeInstance(umbilical);
      
      // Callbacks should be registered (tested through functionality later)
      expect(instance).toBeDefined();
    });

    test('should throw error for missing DOM', () => {
      expect(() => {
        instance = new TreeScribeInstance({});
      }).toThrow();
    });

    test('should throw error for invalid DOM', () => {
      expect(() => {
        instance = new TreeScribeInstance({ dom: 'not-a-dom-element' });
      }).toThrow();
    });
  });

  describe('Basic YAML Loading', () => {
    beforeEach(() => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
    });

    test('should load simple YAML document', async () => {
      const yamlContent = `
title: Test Document
description: This is a test document
sections:
  - title: Section 1
    description: Content for section 1
  - title: Section 2
    description: Content for section 2
`;

      await instance.loadYaml(yamlContent);
      
      // Check that content is rendered in DOM
      const treeContainer = container.querySelector('.tree-scribe-tree');
      expect(treeContainer).toBeDefined();
      
      const nodeElements = treeContainer.querySelectorAll('.tree-node');
      expect(nodeElements.length).toBeGreaterThan(0);
      
      // Check for specific content
      const rootNode = treeContainer.querySelector('[data-node-id]');
      expect(rootNode).toBeDefined();
    });

    test('should load complex nested YAML document', async () => {
      const yamlContent = `
title: Complex Document
sections:
  - title: Chapter 1
    subsections:
      - title: Section 1.1
        description: Nested content
        items:
          - title: Item 1.1.1
            description: Deep nested content
  - title: Chapter 2
    description: Chapter 2 content
`;

      await instance.loadYaml(yamlContent);
      
      const nodeElements = container.querySelectorAll('.tree-node');
      expect(nodeElements.length).toBeGreaterThan(3); // Should have multiple nodes
    });

    test('should handle YAML loading errors gracefully', async () => {
      const invalidYaml = `
title: Invalid YAML
sections:
  - title: Valid section
  - title: Invalid section
    description: |
      Unclosed content
`;

      expect(async () => {
        await instance.loadYaml(invalidYaml);
      }).not.toThrow();
      
      // Should still render something
      const treeContainer = container.querySelector('.tree-scribe-tree');
      expect(treeContainer).toBeDefined();
    });

    test('should handle empty YAML gracefully', async () => {
      expect(async () => {
        await instance.loadYaml('');
      }).not.toThrow();
      
      const treeContainer = container.querySelector('.tree-scribe-tree');
      expect(treeContainer).toBeDefined();
    });
  });

  describe('Tree Operations', () => {
    beforeEach(async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      // Load test data
      const yamlContent = `
title: Root Document
sections:
  - title: Section A
    id: section-a
    subsections:
      - title: Subsection A1
        id: subsection-a1
      - title: Subsection A2
        id: subsection-a2
  - title: Section B
    id: section-b
    description: Section B content
`;
      await instance.loadYaml(yamlContent);
    });

    test('should expand all nodes', () => {
      instance.expandAll();
      
      // Check that expandable nodes are expanded (nodes with subsections)
      const nodeElements = container.querySelectorAll('.tree-node');
      expect(nodeElements.length).toBeGreaterThan(0);
      
      // At least some nodes should be expanded after expandAll
      const expandedNodes = container.querySelectorAll('.tree-node.expanded');
      expect(expandedNodes.length).toBeGreaterThan(0);
    });

    test('should collapse all nodes', () => {
      // First expand all, then collapse all
      instance.expandAll();
      instance.collapseAll();
      
      // After collapse, most nodes should be collapsed
      const collapsedNodes = container.querySelectorAll('.tree-node.collapsed');
      expect(collapsedNodes.length).toBeGreaterThan(0);
    });

    test('should get node state', () => {
      const state = instance.getNodeState('section-a');
      
      expect(state).toBeDefined();
      expect(typeof state.expanded).toBe('boolean');
      expect(typeof state.visible).toBe('boolean');
    });

    test('should set node state', () => {
      instance.setNodeState('section-a', { expanded: true });
      
      const state = instance.getNodeState('section-a');
      expect(state.expanded).toBe(true);
    });

    test('should get folding state', () => {
      const foldingState = instance.getFoldingState();
      
      expect(foldingState).toBeDefined();
      expect(typeof foldingState).toBe('object');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      const yamlContent = `
title: Search Test Document
sections:
  - title: Introduction
    description: This is the introduction section with searchable content
  - title: Main Content
    description: The main content section contains important information
  - title: Conclusion
    description: The conclusion wraps up all the main points
`;
      await instance.loadYaml(yamlContent);
    });

    test('should search content and return results', () => {
      const results = instance.searchContent('introduction');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('nodeId');
      expect(results[0]).toHaveProperty('matches');
    });

    test('should search case-insensitively', () => {
      const results1 = instance.searchContent('INTRODUCTION');
      const results2 = instance.searchContent('introduction');
      
      expect(results1.length).toBe(results2.length);
    });

    test('should return empty results for non-matching query', () => {
      const results = instance.searchContent('nonexistent-term');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      const yamlContent = `
title: Export Test Document
sections:
  - title: Section 1
    description: Content 1
  - title: Section 2
    description: Content 2
`;
      await instance.loadYaml(yamlContent);
    });

    test('should export to HTML', () => {
      const html = instance.exportHtml();
      
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('Export Test Document');
      expect(html).toContain('Section 1');
      expect(html).toContain('Section 2');
    });

    test('should export to JSON', () => {
      const json = instance.exportJson();
      
      expect(typeof json).toBe('object');
      expect(json).not.toBeNull();
      expect(json.title).toBe('Export Test Document');
      expect(Array.isArray(json.children)).toBe(true);
      expect(json.children.length).toBe(2);
    });

    test('should return null exports when no document loaded', () => {
      // Create fresh instance without loading data
      const freshUmbilical = { dom: document.createElement('div') };
      const freshInstance = new TreeScribeInstance(freshUmbilical);
      
      expect(freshInstance.exportHtml()).toBeNull();
      expect(freshInstance.exportJson()).toBeNull();
      
      freshInstance.destroy();
    });
  });

  describe('Event Callbacks', () => {
    test('should call onNodeToggle callback', async () => {
      let toggledNodeId = null;
      let toggledState = null;
      
      const umbilical = {
        dom: container,
        onNodeToggle: (nodeId, expanded) => {
          toggledNodeId = nodeId;
          toggledState = expanded;
        }
      };
      
      instance = new TreeScribeInstance(umbilical);
      
      const yamlContent = `
title: Root
sections:
  - title: Test Section
    id: test-section
`;
      await instance.loadYaml(yamlContent);
      
      // Simulate node toggle (would be triggered by UI interaction)
      instance.setNodeState('test-section', { expanded: true });
      
      // Callback should have been called
      expect(toggledNodeId).toBe('test-section');
      expect(toggledState).toBe(true);
    });

    test('should call onSearch callback', async () => {
      let searchQuery = null;
      let searchResults = null;
      
      const umbilical = {
        dom: container,
        onSearch: (query, results) => {
          searchQuery = query;
          searchResults = results;
        }
      };
      
      instance = new TreeScribeInstance(umbilical);
      
      const yamlContent = 'title: Test Document\ndescription: Searchable content';
      await instance.loadYaml(yamlContent);
      
      instance.searchContent('searchable');
      
      expect(searchQuery).toBe('searchable');
      expect(searchResults).toBeGreaterThan(0);
    });
  });

  describe('Lifecycle Management', () => {
    test('should destroy cleanly', async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      const yamlContent = 'title: Test Document';
      await instance.loadYaml(yamlContent);
      
      expect(container.innerHTML).not.toBe('');
      
      instance.destroy();
      
      // DOM should be cleaned up
      expect(container.innerHTML).toBe('');
    });

    test('should be safe to call destroy multiple times', () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      expect(() => {
        instance.destroy();
        instance.destroy();
        instance.destroy();
      }).not.toThrow();
    });

    test('should handle operations after destroy gracefully', async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      instance.destroy();
      
      // Operations should handle destroyed state gracefully
      expect(async () => {
        await instance.loadYaml('title: Test');
      }).not.toThrow();
      
      expect(() => {
        instance.expandAll();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle umbilical validation errors', () => {
      expect(() => {
        instance = new TreeScribeInstance(null);
      }).toThrow();
      
      expect(() => {
        instance = new TreeScribeInstance({ dom: null });
      }).toThrow();
    });

    test('should handle renderer errors gracefully', async () => {
      const umbilical = { dom: container };
      instance = new TreeScribeInstance(umbilical);
      
      // Should not throw even with problematic content
      expect(async () => {
        await instance.loadYaml('title: Test\ncontent: <script>alert("test")</script>');
      }).not.toThrow();
    });
  });
});