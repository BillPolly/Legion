/**
 * NodeRenderer Tests
 * 
 * Testing NodeRenderer class for node DOM structure creation, content rendering delegation, and accessibility
 */

import { NodeRenderer } from '../../../../../../src/components/tree-scribe/core/view/NodeRenderer.js';
import { RendererRegistry } from '../../../../../../src/components/tree-scribe/features/rendering/RendererRegistry.js';
import { PlaintextRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/PlaintextRenderer.js';
import { MarkdownRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/MarkdownRenderer.js';
import { YamlRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/YamlRenderer.js';

describe('NodeRenderer', () => {
  let nodeRenderer;
  let registry;
  let container;
  let mockNode;

  beforeEach(() => {
    // Set up renderer registry with built-in renderers
    registry = RendererRegistry.getInstance();
    registry.clear();
    registry.register(new PlaintextRenderer());
    registry.register(new MarkdownRenderer());
    registry.register(new YamlRenderer());

    nodeRenderer = new NodeRenderer(registry);
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create mock node structure
    mockNode = {
      id: 'test-node-1',
      title: 'Test Node',
      content: 'This is test content',
      contentType: 'plaintext',
      depth: 1,
      isLeaf: false,
      expanded: true,
      visible: true,
      children: ['child-1', 'child-2'],
      searchHighlight: false
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    registry.clear();
  });

  describe('Node DOM Structure', () => {
    test('should create complete node DOM structure', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      
      expect(nodeElement).toBeDefined();
      expect(nodeElement.classList.contains('tree-node')).toBe(true);
      expect(nodeElement.getAttribute('data-node-id')).toBe('test-node-1');
      expect(nodeElement.getAttribute('data-depth')).toBe('1');
      
      // Check for required child elements
      expect(nodeElement.querySelector('.node-header')).toBeDefined();
      expect(nodeElement.querySelector('.node-title')).toBeDefined();
      expect(nodeElement.querySelector('.node-content')).toBeDefined();
    });

    test('should create proper header structure with toggle', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const header = nodeElement.querySelector('.node-header');
      
      expect(header).toBeDefined();
      expect(header.querySelector('.node-toggle')).toBeDefined();
      expect(header.querySelector('.node-title')).toBeDefined();
      expect(header.querySelector('.node-meta')).toBeDefined();
      
      const toggle = header.querySelector('.node-toggle');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-controls')).toContain('test-node-1');
    });

    test('should not show toggle for leaf nodes', () => {
      const leafNode = { ...mockNode, isLeaf: true, children: [] };
      const nodeElement = nodeRenderer.renderNode(leafNode, container);
      
      const toggle = nodeElement.querySelector('.node-toggle');
      expect(toggle.style.visibility).toBe('hidden');
    });

    test('should apply correct CSS classes based on node state', () => {
      // Test expanded node
      const expandedNode = { ...mockNode, expanded: true };
      const expandedElement = nodeRenderer.renderNode(expandedNode, container);
      expect(expandedElement.classList.contains('expanded')).toBe(true);
      expect(expandedElement.classList.contains('collapsed')).toBe(false);
      
      // Test collapsed node
      const collapsedNode = { ...mockNode, expanded: false };
      const collapsedElement = nodeRenderer.renderNode(collapsedNode, container);
      expect(collapsedElement.classList.contains('collapsed')).toBe(true);
      expect(collapsedElement.classList.contains('expanded')).toBe(false);
    });

    test('should handle search highlight state', () => {
      const highlightedNode = { ...mockNode, searchHighlight: true };
      const nodeElement = nodeRenderer.renderNode(highlightedNode, container);
      
      expect(nodeElement.classList.contains('search-highlight')).toBe(true);
    });

    test('should apply depth-based indentation', () => {
      const deepNode = { ...mockNode, depth: 5 };
      const nodeElement = nodeRenderer.renderNode(deepNode, container);
      
      expect(nodeElement.getAttribute('data-depth')).toBe('5');
      expect(nodeElement.style.paddingLeft).toBe('100px'); // 20px * 5
    });

    test('should handle invisible nodes', () => {
      const invisibleNode = { ...mockNode, visible: false };
      const nodeElement = nodeRenderer.renderNode(invisibleNode, container);
      
      expect(nodeElement.style.display).toBe('none');
    });
  });

  describe('Content Rendering Delegation', () => {
    test('should delegate plaintext content to PlaintextRenderer', () => {
      const plaintextNode = { 
        ...mockNode, 
        content: 'Simple plaintext content',
        contentType: 'plaintext' 
      };
      
      const nodeElement = nodeRenderer.renderNode(plaintextNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.querySelector('.plaintext-content')).toBeDefined();
      expect(contentDiv.textContent).toContain('Simple plaintext content');
    });

    test('should delegate markdown content to MarkdownRenderer', () => {
      const markdownNode = { 
        ...mockNode, 
        content: '# Markdown Header\n\nThis is **bold** text.',
        contentType: 'markdown' 
      };
      
      const nodeElement = nodeRenderer.renderNode(markdownNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.querySelector('.markdown-content')).toBeDefined();
      expect(contentDiv.innerHTML).toContain('<h1>Markdown Header</h1>');
      expect(contentDiv.innerHTML).toContain('<strong>bold</strong>');
    });

    test('should delegate YAML content to YamlRenderer', () => {
      const yamlObject = {
        title: 'YAML Test',
        properties: {
          setting1: 'value1',
          setting2: 42,
          nested: {
            deep: 'property'
          }
        }
      };
      
      const yamlNode = { 
        ...mockNode, 
        content: yamlObject,
        contentType: 'yaml' 
      };
      
      const nodeElement = nodeRenderer.renderNode(yamlNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.querySelector('.yaml-content')).toBeDefined();
      expect(contentDiv.textContent).toContain('YAML Test');
      expect(contentDiv.textContent).toContain('properties');
    });

    test('should fallback to plaintext for unknown content types', () => {
      const unknownNode = { 
        ...mockNode, 
        content: 'Unknown content type',
        contentType: 'unknown-type' 
      };
      
      // Set plaintext as fallback
      registry.setFallbackRenderer(registry.getRendererByName('PlaintextRenderer'));
      
      const nodeElement = nodeRenderer.renderNode(unknownNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.querySelector('.plaintext-content')).toBeDefined();
    });

    test('should handle empty content gracefully', () => {
      const emptyNode = { 
        ...mockNode, 
        content: '',
        contentType: 'plaintext' 
      };
      
      const nodeElement = nodeRenderer.renderNode(emptyNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.textContent).toContain('No content');
    });

    test('should handle null content gracefully', () => {
      const nullNode = { 
        ...mockNode, 
        content: null,
        contentType: 'plaintext' 
      };
      
      const nodeElement = nodeRenderer.renderNode(nullNode, container);
      const contentDiv = nodeElement.querySelector('.node-content');
      
      expect(contentDiv).toBeDefined();
      expect(contentDiv.textContent).toContain('No content');
    });
  });

  describe('Accessibility Attributes', () => {
    test('should add proper ARIA attributes for navigation', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      
      expect(nodeElement.getAttribute('role')).toBe('treeitem');
      expect(nodeElement.getAttribute('aria-expanded')).toBe('true');
      expect(nodeElement.getAttribute('aria-level')).toBe('2'); // depth + 1 for ARIA
      expect(nodeElement.getAttribute('tabindex')).toBe('0');
    });

    test('should set aria-expanded correctly for collapsed nodes', () => {
      const collapsedNode = { ...mockNode, expanded: false };
      const nodeElement = nodeRenderer.renderNode(collapsedNode, container);
      
      expect(nodeElement.getAttribute('aria-expanded')).toBe('false');
    });

    test('should not set aria-expanded for leaf nodes', () => {
      const leafNode = { ...mockNode, isLeaf: true, children: [] };
      const nodeElement = nodeRenderer.renderNode(leafNode, container);
      
      expect(nodeElement.hasAttribute('aria-expanded')).toBe(false);
    });

    test('should add proper labels for screen readers', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      
      expect(nodeElement.getAttribute('aria-label')).toContain('Test Node');
      expect(nodeElement.getAttribute('aria-label')).toContain('level 2');
      expect(nodeElement.getAttribute('aria-label')).toContain('expanded');
    });

    test('should mark highlighted nodes for screen readers', () => {
      const highlightedNode = { ...mockNode, searchHighlight: true };
      const nodeElement = nodeRenderer.renderNode(highlightedNode, container);
      
      expect(nodeElement.getAttribute('aria-label')).toContain('search result');
    });

    test('should provide keyboard navigation hints', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      expect(toggle.getAttribute('aria-label')).toContain('Collapse'); // Updated expectation
      expect(toggle.getAttribute('title')).toBeDefined();
    });

    test('should associate content with header', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const header = nodeElement.querySelector('.node-header');
      const content = nodeElement.querySelector('.node-content');
      
      const headerId = header.getAttribute('id');
      expect(headerId).toBeDefined();
      expect(content.getAttribute('aria-labelledby')).toBe(headerId);
    });
  });

  describe('Node Update and Re-render', () => {
    test('should update existing node DOM when re-rendered', () => {
      // Initial render
      const nodeElement1 = nodeRenderer.renderNode(mockNode, container);
      const initialTitle = nodeElement1.querySelector('.node-title').textContent;
      
      // Update node data
      const updatedNode = { ...mockNode, title: 'Updated Title' };
      const nodeElement2 = nodeRenderer.renderNode(updatedNode, container);
      
      // Should update in place, not create new element
      expect(nodeElement2).toBe(nodeElement1);
      expect(nodeElement2.querySelector('.node-title').textContent).toBe('Updated Title');
    });

    test('should update expansion state efficiently', () => {
      // Start expanded
      const expandedElement = nodeRenderer.renderNode(mockNode, container);
      expect(expandedElement.classList.contains('expanded')).toBe(true);
      
      // Update to collapsed
      const collapsedNode = { ...mockNode, expanded: false };
      const updatedElement = nodeRenderer.renderNode(collapsedNode, container);
      
      expect(updatedElement).toBe(expandedElement); // Same DOM element
      expect(updatedElement.classList.contains('collapsed')).toBe(true);
      expect(updatedElement.getAttribute('aria-expanded')).toBe('false');
    });

    test('should update content when content type changes', () => {
      // Start with plaintext
      const plaintextElement = nodeRenderer.renderNode(mockNode, container);
      expect(plaintextElement.querySelector('.plaintext-content')).toBeDefined();
      
      // Change to markdown
      const markdownNode = { 
        ...mockNode, 
        content: '# New Markdown',
        contentType: 'markdown' 
      };
      const updatedElement = nodeRenderer.renderNode(markdownNode, container);
      
      expect(updatedElement).toBe(plaintextElement); // Same DOM element
      expect(updatedElement.querySelector('.markdown-content')).toBeDefined();
      expect(updatedElement.querySelector('.plaintext-content')).toBeNull();
    });

    test('should handle visibility changes', () => {
      const visibleElement = nodeRenderer.renderNode(mockNode, container);
      expect(visibleElement.style.display).not.toBe('none');
      
      const invisibleNode = { ...mockNode, visible: false };
      const updatedElement = nodeRenderer.renderNode(invisibleNode, container);
      
      expect(updatedElement).toBe(visibleElement);
      expect(updatedElement.style.display).toBe('none');
    });

    test('should preserve event listeners during updates', () => {
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      // Add custom event listener
      let clickCount = 0;
      toggle.addEventListener('click', () => clickCount++);
      
      // Update node
      const updatedNode = { ...mockNode, title: 'Updated' };
      nodeRenderer.renderNode(updatedNode, container);
      
      // Click should still work
      toggle.click();
      expect(clickCount).toBe(1);
    });
  });

  describe('Event Handling', () => {
    test('should emit toggle events when toggle button is clicked', () => {
      let toggleEventData = null;
      nodeRenderer.on('nodeToggle', (data) => {
        toggleEventData = data;
      });
      
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      toggle.click();
      
      expect(toggleEventData).toBeDefined();
      expect(toggleEventData.nodeId).toBe('test-node-1');
      expect(toggleEventData.expanded).toBe(false); // Should toggle to collapsed
    });

    test('should support multiple event listeners', () => {
      let listener1Called = false;
      let listener2Called = false;
      
      nodeRenderer.on('nodeToggle', () => { listener1Called = true; });
      nodeRenderer.on('nodeToggle', () => { listener2Called = true; });
      
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      toggle.click();
      
      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    test('should support event listener removal', () => {
      let listenerCalled = false;
      
      const removeListener = nodeRenderer.on('nodeToggle', () => {
        listenerCalled = true;
      });
      
      removeListener(); // Remove listener
      
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      toggle.click();
      
      expect(listenerCalled).toBe(false);
    });

    test('should emit content interaction events', () => {
      let contentEventData = null;
      nodeRenderer.on('contentInteraction', (data) => {
        contentEventData = data;
      });
      
      const markdownNode = { 
        ...mockNode, 
        content: '[Click me](http://example.com)',
        contentType: 'markdown' 
      };
      
      const nodeElement = nodeRenderer.renderNode(markdownNode, container);
      const link = nodeElement.querySelector('a');
      
      if (link) {
        link.click();
        
        expect(contentEventData).toBeDefined();
        expect(contentEventData.nodeId).toBe('test-node-1');
        expect(contentEventData.type).toBe('link');
      }
    });
  });

  describe('Performance Optimization', () => {
    test('should reuse DOM elements for same node ID', () => {
      const element1 = nodeRenderer.renderNode(mockNode, container);
      const element2 = nodeRenderer.renderNode(mockNode, container);
      
      expect(element2).toBe(element1); // Same DOM element reference
    });

    test('should clean up old elements when node ID changes', () => {
      const element1 = nodeRenderer.renderNode(mockNode, container);
      
      const newNode = { ...mockNode, id: 'different-id' };
      const element2 = nodeRenderer.renderNode(newNode, container);
      
      expect(element2).not.toBe(element1);
      expect(container.contains(element1)).toBe(false); // Old element removed
      expect(container.contains(element2)).toBe(true);
    });

    test('should handle batch updates efficiently', () => {
      const nodes = [];
      const containers = [];
      
      // Create separate containers for each node to test batch processing
      for (let i = 0; i < 100; i++) {
        nodes.push({
          ...mockNode,
          id: `node-${i}`,
          title: `Node ${i}`,
          content: `Content ${i}`
        });
        
        const nodeContainer = document.createElement('div');
        containers.push(nodeContainer);
        container.appendChild(nodeContainer);
      }
      
      const startTime = Date.now();
      
      nodes.forEach((node, i) => {
        nodeRenderer.renderNode(node, containers[i]);
      });
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
      expect(container.querySelectorAll('.tree-node').length).toBe(100);
    });

    test('should not cause memory leaks with repeated renders', () => {
      for (let i = 0; i < 50; i++) {
        const updatedNode = { ...mockNode, title: `Updated ${i}` };
        nodeRenderer.renderNode(updatedNode, container);
      }
      
      // Should only have one element (no accumulation)
      expect(container.children.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle renderer errors gracefully', () => {
      // Mock a renderer that throws an error
      const faultyRenderer = {
        getName: () => 'FaultyRenderer',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['faulty'],
        getDescription: () => 'Faulty',
        canRender: () => true,
        render: () => { throw new Error('Render failed'); }
      };
      
      registry.register(faultyRenderer);
      
      const faultyNode = { 
        ...mockNode, 
        content: 'Test content',
        contentType: 'faulty' 
      };
      
      expect(() => {
        nodeRenderer.renderNode(faultyNode, container);
      }).not.toThrow();
      
      const nodeElement = container.querySelector('.tree-node');
      expect(nodeElement).toBeDefined();
      expect(nodeElement.querySelector('.error-content')).toBeDefined();
    });

    test('should handle missing node properties', () => {
      const incompleteNode = {
        id: 'incomplete',
        title: 'Incomplete Node'
        // Missing other required properties
      };
      
      expect(() => {
        nodeRenderer.renderNode(incompleteNode, container);
      }).not.toThrow();
      
      const nodeElement = container.querySelector('.tree-node');
      expect(nodeElement).toBeDefined();
    });

    test('should handle invalid container', () => {
      expect(() => {
        nodeRenderer.renderNode(mockNode, null);
      }).toThrow('Container is required');
      
      expect(() => {
        nodeRenderer.renderNode(mockNode, 'not-a-dom-element');
      }).toThrow('Container must be a DOM element');
    });

    test('should handle null or undefined node', () => {
      expect(() => {
        nodeRenderer.renderNode(null, container);
      }).toThrow('Node data is required');
      
      expect(() => {
        nodeRenderer.renderNode(undefined, container);
      }).toThrow('Node data is required');
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      nodeRenderer.renderNode(mockNode, container);
      
      expect(nodeRenderer.destroyed).toBe(false);
      expect(container.children.length).toBe(1);
      
      nodeRenderer.destroy();
      
      expect(nodeRenderer.destroyed).toBe(true);
      expect(container.children.length).toBe(0); // Elements removed
    });

    test('should remove all event listeners on destroy', () => {
      let listenerCalled = false;
      nodeRenderer.on('nodeToggle', () => { listenerCalled = true; });
      
      const nodeElement = nodeRenderer.renderNode(mockNode, container);
      const toggle = nodeElement.querySelector('.node-toggle');
      
      nodeRenderer.destroy();
      
      // Should not call listener after destroy
      toggle.click();
      expect(listenerCalled).toBe(false);
    });

    test('should be safe to call destroy multiple times', () => {
      expect(() => {
        nodeRenderer.destroy();
        nodeRenderer.destroy();
        nodeRenderer.destroy();
      }).not.toThrow();
    });
  });
});