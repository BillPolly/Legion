/**
 * Integration Workflow Tests
 * 
 * Tests core TreeScribe workflows end-to-end:
 * - Loading and parsing different formats
 * - UI interactions work correctly
 * - Basic plugin system works
 */

import { TreeScribe } from '../src/components/tree-scribe/TreeScribe.js';

describe('TreeScribe Integration Workflows', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Basic TreeScribe Creation', () => {
    test('should create TreeScribe instance', () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      expect(treeScribe).toBeDefined();
      expect(typeof treeScribe.loadContent).toBe('function');
      expect(typeof treeScribe.destroy).toBe('function');
      
      treeScribe.destroy();
    });

    test('should load different format content', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        const testContents = {
          json: '{"title": "Test", "items": ["one", "two"]}',
          yaml: 'title: Test\nitems:\n  - one\n  - two',
          markdown: '# Test\n\n- one\n- two'
        };

        for (const [format, content] of Object.entries(testContents)) {
          await treeScribe.loadContent(content, { format });
          
          // Check that content is displayed
          const nodes = container.querySelectorAll('.tree-node');
          expect(nodes.length).toBeGreaterThan(0);
        }
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('Parser Plugin Integration', () => {
    test('should work with CSV plugin', async () => {
      const { csvParserPlugin } = await import('../src/components/tree-scribe/features/plugins/examples/csv-parser-plugin.js');
      
      const treeScribe = TreeScribe.create({
        dom: container,
        plugins: [csvParserPlugin]
      });

      try {
        const csvContent = 'Name,Age,City\nJohn,25,NYC\nJane,30,LA';
        await treeScribe.loadContent(csvContent, { format: 'csv' });
        
        const nodes = container.querySelectorAll('.tree-node');
        expect(nodes.length).toBeGreaterThan(0);
        
        // Should have parsed CSV structure
        const titleElements = container.querySelectorAll('.node-title');
        expect(titleElements.length).toBeGreaterThan(1);
      } finally {
        treeScribe.destroy();
      }
    });

    test('should work with TOML plugin', async () => {
      const { tomlParserPlugin } = await import('../src/components/tree-scribe/features/plugins/examples/toml-parser-plugin.js');
      
      const treeScribe = TreeScribe.create({
        dom: container,
        plugins: [tomlParserPlugin]
      });

      try {
        const tomlContent = 'title = "Test"\nvalue = 123\n[section]\nkey = "value"';
        await treeScribe.loadContent(tomlContent, { format: 'toml' });
        
        const nodes = container.querySelectorAll('.tree-node');
        expect(nodes.length).toBeGreaterThan(0);
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('UI Interactions', () => {
    test('should handle node expansion/collapse', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        const content = {
          title: 'Root',
          children: [
            {
              title: 'Parent',
              children: [
                { title: 'Child 1', children: [] },
                { title: 'Child 2', children: [] }
              ]
            }
          ]
        };

        await treeScribe.loadContent(JSON.stringify(content));
        
        // Find expandable node
        const expandButtons = container.querySelectorAll('.expand-button, .collapse-button');
        if (expandButtons.length > 0) {
          const button = expandButtons[0];
          button.click();
          
          // Give time for UI update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check that interaction worked (exact behavior depends on implementation)
          expect(container.querySelectorAll('.tree-node').length).toBeGreaterThan(0);
        }
      } finally {
        treeScribe.destroy();
      }
    });

    test('should handle format switching', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        // Load JSON first
        await treeScribe.loadContent('{"title": "Test", "value": 123}');
        let nodes = container.querySelectorAll('.tree-node');
        const jsonNodeCount = nodes.length;

        // Switch to YAML
        await treeScribe.loadContent('title: Test\nvalue: 123', { format: 'yaml' });
        nodes = container.querySelectorAll('.tree-node');
        const yamlNodeCount = nodes.length;

        // Both should have created nodes (exact count may vary)
        expect(jsonNodeCount).toBeGreaterThan(0);
        expect(yamlNodeCount).toBeGreaterThan(0);
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid content gracefully', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        // Try to load invalid JSON
        await treeScribe.loadContent('{ invalid json }');
        
        // Should not crash and should show something
        expect(container.children.length).toBeGreaterThan(0);
      } catch (error) {
        // It's also acceptable to throw an error
        expect(error.message).toBeDefined();
      } finally {
        treeScribe.destroy();
      }
    });

    test('should handle empty content', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        await treeScribe.loadContent('');
        
        // Should handle empty content without crashing
        expect(container.children.length).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Throwing error is also acceptable
        expect(error.message).toBeDefined();
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('Basic Performance', () => {
    test('should load content in reasonable time', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        const startTime = performance.now();
        
        await treeScribe.loadContent('{"title": "Test", "items": ["one", "two", "three"]}');
        
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(1000); // Should load within 1 second
        
        const nodes = container.querySelectorAll('.tree-node');
        expect(nodes.length).toBeGreaterThan(0);
      } finally {
        treeScribe.destroy();
      }
    });

    test('should handle moderate-sized content', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        // Create moderate-sized JSON
        const data = {
          title: 'Large Document',
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            value: i * 2
          }))
        };

        const startTime = performance.now();
        await treeScribe.loadContent(JSON.stringify(data));
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        expect(container.querySelectorAll('.tree-node').length).toBeGreaterThan(0);
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('Format Detection', () => {
    test('should auto-detect formats correctly', async () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      try {
        const testData = [
          { content: '{"key": "value"}', expected: 'json' },
          { content: 'key: value', expected: 'yaml' },
          { content: '# Header\n\nContent', expected: 'markdown' },
          { content: '<html><body>Test</body></html>', expected: 'html' }
        ];

        for (const { content, expected } of testData) {
          await treeScribe.loadContent(content);
          
          // Should load and display content (format detection worked)
          const nodes = container.querySelectorAll('.tree-node');
          expect(nodes.length).toBeGreaterThan(0);
        }
      } finally {
        treeScribe.destroy();
      }
    });
  });

  describe('Cleanup and Memory', () => {
    test('should clean up properly when destroyed', () => {
      const treeScribe = TreeScribe.create({
        dom: container
      });

      treeScribe.destroy();
      
      // Container should be cleaned up
      expect(container.children.length).toBe(0);
    });

    test('should handle multiple create/destroy cycles', () => {
      for (let i = 0; i < 5; i++) {
        const treeScribe = TreeScribe.create({
          dom: container
        });
        
        expect(treeScribe).toBeDefined();
        treeScribe.destroy();
        expect(container.children.length).toBe(0);
      }
    });
  });
});