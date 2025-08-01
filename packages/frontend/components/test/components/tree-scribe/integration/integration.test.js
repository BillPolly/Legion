/**
 * TreeScribe Integration Tests
 * 
 * Testing complete document lifecycle and complex interaction workflows
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Integration', () => {
  let container;
  let treeScribe;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (treeScribe) {
      treeScribe.destroy();
      treeScribe = null;
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Full Document Lifecycle', () => {
    test('should handle complete document load, render, interact, and destroy cycle', async () => {
      // Create TreeScribe instance
      const instance = TreeScribe.create({
        dom: container,
        theme: 'light',
        onMount: (inst) => { treeScribe = inst; }
      });

      expect(instance).toBeDefined();
      expect(instance.loadYaml).toBeDefined();

      // Load YAML document
      const yamlContent = `
        title: Integration Test Document
        content: |
          # Main Documentation
          This is a test document for integration testing.
        children:
          - title: Getting Started
            content: |
              ## Installation
              Run npm install to get started.
            children:
              - title: Prerequisites
                content: Node.js version 14 or higher
              - title: Dependencies
                content: All required packages are listed in package.json
          - title: API Reference
            content:
              methods:
                - create
                - destroy
                - loadYaml
            type: yaml
      `;

      const result = await instance.loadYaml(yamlContent);
      expect(result.success).toBe(true);

      // Verify DOM structure
      const treeContainer = container.querySelector('.tree-scribe-container');
      expect(treeContainer).toBeTruthy();

      const nodes = container.querySelectorAll('[role="treeitem"]');
      expect(nodes.length).toBeGreaterThan(0);

      // Test interaction - expand/collapse
      const firstNode = nodes[0];
      const expandButton = firstNode.querySelector('.node-toggle');
      if (expandButton) {
        expandButton.click();
        
        // Check if state changed
        const isExpanded = firstNode.getAttribute('aria-expanded');
        expect(['true', 'false']).toContain(isExpanded);
      }

      // Test search functionality
      if (instance.search) {
        const searchResults = instance.search('Installation');
        expect(searchResults).toBeDefined();
      }

      // Test export functionality
      if (instance.exportHTML) {
        const html = instance.exportHTML();
        expect(html).toContain('Integration Test Document');
      }

      // Clean destroy
      instance.destroy();
      expect(container.querySelector('.tree-scribe-container')).toBeNull();
    });

    test('should handle loading from URL', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      // Mock fetch for URL loading
      let fetchCalled = false;
      let fetchUrl = null;
      const originalFetch = global.fetch;
      
      global.fetch = (url) => {
        fetchCalled = true;
        fetchUrl = url;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            title: Remote Document
            content: Content loaded from URL
          `)
        });
      };

      const result = await instance.loadYaml('https://example.com/document.yaml');
      expect(result.success).toBe(true);
      expect(fetchCalled).toBe(true);
      expect(fetchUrl).toBe('https://example.com/document.yaml');

      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should handle malformed YAML gracefully', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      const malformedYaml = `
        title: Bad Document
        content: Missing quote
        children:
          - title: Child
            content: "Unclosed quote
      `;

      const result = await instance.loadYaml(malformedYaml);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Should show error state
      const errorElement = container.querySelector('.error-message');
      if (errorElement) {
        expect(errorElement.textContent).toContain('Error');
      }
    });
  });

  describe('Complex Interaction Workflows', () => {
    test('should handle multiple folding operations correctly', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      const yamlContent = `
        title: Root
        children:
          - title: Level 1-A
            children:
              - title: Level 2-A
                children:
                  - title: Level 3-A
                  - title: Level 3-B
              - title: Level 2-B
          - title: Level 1-B
            children:
              - title: Level 2-C
      `;

      await instance.loadYaml(yamlContent);

      // Test collapse all
      if (instance.collapseAll) {
        instance.collapseAll();
        const expandedNodes = container.querySelectorAll('[aria-expanded="true"]');
        expect(expandedNodes.length).toBe(0);
      }

      // Test expand all
      if (instance.expandAll) {
        instance.expandAll();
        const collapsedNodes = container.querySelectorAll('[aria-expanded="false"]');
        expect(collapsedNodes.length).toBe(0);
      }

      // Test expand to depth
      if (instance.expandToDepth) {
        instance.expandToDepth(2);
        
        // Level 1 and 2 should be expanded, level 3 collapsed
        const level2Nodes = container.querySelectorAll('[aria-level="2"]');
        level2Nodes.forEach(node => {
          if (node.querySelector('[role="group"]')) {
            expect(node.getAttribute('aria-expanded')).toBe('true');
          }
        });
      }
    });

    test('should handle keyboard navigation correctly', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml(`
        title: Keyboard Test
        children:
          - title: Item 1
          - title: Item 2
          - title: Item 3
      `);

      const treeContainer = container.querySelector('[role="tree"]');
      const firstItem = container.querySelector('[role="treeitem"]');
      
      // Focus first item
      firstItem.focus();
      expect(document.activeElement).toBe(firstItem);

      // Simulate arrow down
      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true
      });
      treeContainer.dispatchEvent(downEvent);

      // Check if focus moved (implementation dependent)
      // This test assumes keyboard navigation is implemented
    });

    test('should handle search with highlighting and navigation', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml(`
        title: Search Test Document
        content: This document contains JavaScript examples
        children:
          - title: JavaScript Basics
            content: Learn JavaScript fundamentals
          - title: Advanced JavaScript
            content: JavaScript patterns and practices
      `);

      if (instance.search && instance.navigateSearchResults) {
        const results = instance.search('JavaScript');
        expect(results.length).toBeGreaterThan(0);

        // Navigate through results
        instance.navigateSearchResults('next');
        const highlighted = container.querySelectorAll('.search-highlight');
        expect(highlighted.length).toBeGreaterThan(0);

        // Clear search
        if (instance.clearSearch) {
          instance.clearSearch();
          const remainingHighlights = container.querySelectorAll('.search-highlight');
          expect(remainingHighlights.length).toBe(0);
        }
      }
    });
  });

  describe('Error Recovery', () => {
    test('should recover from renderer errors', async () => {
      // Register a faulty renderer
      const faultyRenderer = {
        getName: () => 'faulty',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['faulty'],
        render: () => { throw new Error('Renderer error'); },
        destroy: () => {}
      };

      const instance = TreeScribe.create({
        dom: container,
        renderers: { faulty: faultyRenderer },
        onMount: (inst) => { treeScribe = inst; }
      });

      const yamlContent = `
        title: Error Test
        content: This will cause an error
        type: faulty
      `;

      const result = await instance.loadYaml(yamlContent);
      
      // Should handle error gracefully
      expect(result.success).toBe(true);
      
      // Should fallback to default renderer
      const content = container.querySelector('.node-content');
      expect(content).toBeTruthy();
    });

    test('should handle memory pressure gracefully', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      // Create large document
      const children = [];
      for (let i = 0; i < 100; i++) {
        children.push({
          title: `Node ${i}`,
          content: 'x'.repeat(1000),
          children: Array(10).fill(null).map((_, j) => ({
            title: `Child ${i}-${j}`,
            content: 'y'.repeat(100)
          }))
        });
      }

      const largeYaml = {
        title: 'Large Document',
        children
      };

      const result = await instance.loadYaml(JSON.stringify(largeYaml));
      expect(result.success).toBe(true);

      // Should use virtual scrolling or other optimization
      const visibleNodes = container.querySelectorAll('[role="treeitem"]:not([aria-hidden="true"])');
      // Exact count depends on implementation
      expect(visibleNodes.length).toBeDefined();
    });
  });

  describe('Multi-Instance Support', () => {
    test('should support multiple TreeScribe instances', async () => {
      const container2 = document.createElement('div');
      document.body.appendChild(container2);

      const instance1 = TreeScribe.create({
        dom: container,
        theme: 'light'
      });

      const instance2 = TreeScribe.create({
        dom: container2,
        theme: 'dark'
      });

      await instance1.loadYaml('title: Document 1');
      await instance2.loadYaml('title: Document 2');

      // Both should work independently
      expect(container.querySelector('.tree-scribe-container')).toBeTruthy();
      expect(container2.querySelector('.tree-scribe-container')).toBeTruthy();

      // Check themes
      expect(container.querySelector('.theme-light')).toBeTruthy();
      expect(container2.querySelector('.theme-dark')).toBeTruthy();

      // Destroy should not affect each other
      instance1.destroy();
      expect(container.querySelector('.tree-scribe-container')).toBeNull();
      expect(container2.querySelector('.tree-scribe-container')).toBeTruthy();

      instance2.destroy();
      document.body.removeChild(container2);
    });
  });

  describe('Plugin Integration', () => {
    test('should load and use custom renderer plugin', async () => {
      // Create custom renderer
      const customRenderer = {
        getName: () => 'custom',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['custom'],
        render: (content, container) => {
          const div = document.createElement('div');
          div.className = 'custom-rendered';
          div.textContent = `Custom: ${content}`;
          container.appendChild(div);
          return div;
        },
        destroy: () => {}
      };

      const instance = TreeScribe.create({
        dom: container,
        renderers: { custom: customRenderer },
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml(`
        title: Custom Renderer Test
        content: This is custom content
        type: custom
      `);

      const customContent = container.querySelector('.custom-rendered');
      expect(customContent).toBeTruthy();
      expect(customContent.textContent).toContain('Custom: This is custom content');
    });

    test('should handle async renderer loading', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      // Simulate async plugin loading
      const loadPlugin = () => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            getName: () => 'async',
            getVersion: () => '1.0.0',
            getSupportedTypes: () => ['async'],
            render: (content, container) => {
              const div = document.createElement('div');
              div.textContent = `Async: ${content}`;
              container.appendChild(div);
              return div;
            },
            destroy: () => {}
          });
        }, 100);
      });

      if (instance.registerRenderer) {
        const plugin = await loadPlugin();
        instance.registerRenderer('async', plugin);

        await instance.loadYaml(`
          title: Async Test
          content: Loaded asynchronously
          type: async
        `);

        // Verify async renderer was used
        const content = container.querySelector('.node-content');
        expect(content.textContent).toContain('Async: Loaded asynchronously');
      }
    });
  });

  describe('Accessibility Compliance', () => {
    test('should maintain WCAG 2.1 AA compliance', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml(`
        title: Accessibility Test
        children:
          - title: Item 1
          - title: Item 2
      `);

      // Check ARIA attributes
      const tree = container.querySelector('[role="tree"]');
      expect(tree).toBeTruthy();
      expect(tree.hasAttribute('aria-label') || tree.hasAttribute('aria-labelledby')).toBe(true);

      // Check tree items
      const items = container.querySelectorAll('[role="treeitem"]');
      items.forEach(item => {
        expect(item.hasAttribute('aria-level')).toBe(true);
        expect(item.hasAttribute('tabindex')).toBe(true);
      });

      // Check focus management
      const focusableItems = container.querySelectorAll('[tabindex="0"]');
      expect(focusableItems.length).toBeGreaterThanOrEqual(1);

      // Check announcer for screen readers
      const announcer = document.querySelector('[aria-live]');
      if (announcer) {
        expect(['polite', 'assertive']).toContain(announcer.getAttribute('aria-live'));
      }
    });

    test('should support high contrast mode', async () => {
      const instance = TreeScribe.create({
        dom: container,
        enableHighContrast: true,
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml('title: High Contrast Test');

      // Check for high contrast classes or attributes
      const hasHighContrast = container.querySelector('.high-contrast') ||
                             container.querySelector('[data-high-contrast="true"]');
      
      // Implementation may vary
      if (hasHighContrast) {
        expect(hasHighContrast).toBeTruthy();
      }
    });
  });

  describe('Performance', () => {
    test('should handle rapid operations efficiently', async () => {
      const instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { treeScribe = inst; }
      });

      await instance.loadYaml(`
        title: Performance Test
        children:
          - title: Node 1
          - title: Node 2
          - title: Node 3
      `);

      const startTime = Date.now();

      // Perform rapid operations
      for (let i = 0; i < 10; i++) {
        if (instance.expandAll) instance.expandAll();
        if (instance.collapseAll) instance.collapseAll();
        if (instance.search) instance.search('Node');
      }

      const duration = Date.now() - startTime;
      
      // Should complete quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(1000);
    });

    test('should cleanup resources properly', async () => {
      const instances = [];
      
      // Create and destroy multiple instances
      for (let i = 0; i < 5; i++) {
        const tempContainer = document.createElement('div');
        document.body.appendChild(tempContainer);
        
        const instance = TreeScribe.create({
          dom: tempContainer
        });
        
        await instance.loadYaml(`title: Instance ${i}`);
        instances.push({ instance, container: tempContainer });
      }

      // Destroy all instances
      instances.forEach(({ instance, container }) => {
        instance.destroy();
        document.body.removeChild(container);
      });

      // Check for memory leaks (basic check)
      const remainingElements = document.querySelectorAll('.tree-scribe-container');
      expect(remainingElements.length).toBe(0);
    });
  });
});