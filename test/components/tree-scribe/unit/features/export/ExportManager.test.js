/**
 * ExportManager Tests
 * 
 * Testing export functionality for TreeScribe
 */

import { ExportManager } from '../../../../../../src/components/tree-scribe/features/export/ExportManager.js';

describe('ExportManager', () => {
  let manager;
  let mockTree;

  beforeEach(() => {
    manager = new ExportManager();
    
    // Create mock tree structure
    mockTree = {
      root: {
        id: 'root',
        title: 'Documentation',
        content: 'Root documentation',
        type: 'plaintext',
        children: [
          {
            id: 'child1',
            title: 'Getting Started',
            content: '# Getting Started\n\nWelcome to the documentation!',
            type: 'markdown',
            children: [
              {
                id: 'grandchild1',
                title: 'Installation',
                content: 'Run `npm install` to get started.',
                type: 'plaintext',
                children: []
              }
            ]
          },
          {
            id: 'child2',
            title: 'API Reference',
            content: { methods: ['create', 'destroy'], version: '1.0.0' },
            type: 'yaml',
            children: []
          }
        ]
      },
      getNodeById: function(id) {
        const findNode = (node) => {
          if (node.id === id) return node;
          for (const child of node.children || []) {
            const found = findNode(child);
            if (found) return found;
          }
          return null;
        };
        return findNode(this.root);
      }
    };
  });

  afterEach(() => {
    if (manager && !manager.destroyed) {
      manager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(manager.destroyed).toBe(false);
      expect(manager.options.includeMetadata).toBe(true);
      expect(manager.options.includeStyles).toBe(true);
      expect(manager.options.prettyPrint).toBe(true);
    });

    test('should accept custom options', () => {
      const customManager = new ExportManager({
        includeMetadata: false,
        includeStyles: false,
        prettyPrint: false
      });
      
      expect(customManager.options.includeMetadata).toBe(false);
      expect(customManager.options.includeStyles).toBe(false);
      expect(customManager.options.prettyPrint).toBe(false);
      
      customManager.destroy();
    });
  });

  describe('HTML Export', () => {
    test('should export tree as HTML', () => {
      const html = manager.exportHTML(mockTree);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('Documentation');
    });

    test('should include tree structure in HTML', () => {
      const html = manager.exportHTML(mockTree);
      
      expect(html).toContain('Getting Started');
      expect(html).toContain('Installation');
      expect(html).toContain('API Reference');
    });

    test('should preserve content types in HTML', () => {
      const html = manager.exportHTML(mockTree);
      
      // Markdown should be rendered
      expect(html).toContain('<h1>Getting Started</h1>');
      expect(html).toContain('Welcome to the documentation!');
      
      // Plaintext with backticks should be rendered as-is
      expect(html).toContain('Run `npm install` to get started.');
    });

    test('should include metadata when enabled', () => {
      const html = manager.exportHTML(mockTree);
      
      expect(html).toContain('data-node-id="root"');
      expect(html).toContain('data-node-type="plaintext"');
    });

    test('should exclude metadata when disabled', () => {
      manager.options.includeMetadata = false;
      const html = manager.exportHTML(mockTree);
      
      expect(html).not.toContain('data-node-id');
      expect(html).not.toContain('data-node-type');
    });

    test('should include styles when enabled', () => {
      const html = manager.exportHTML(mockTree);
      
      expect(html).toContain('<style>');
      expect(html).toContain('.tree-node');
      expect(html).toContain('.tree-content');
    });

    test('should exclude styles when disabled', () => {
      manager.options.includeStyles = false;
      const html = manager.exportHTML(mockTree);
      
      expect(html).not.toContain('<style>');
    });

    test('should handle empty tree', () => {
      const emptyTree = { root: null };
      const html = manager.exportHTML(emptyTree);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('No content to export');
    });

    test('should export selected nodes only', () => {
      const selectedIds = ['root', 'child1', 'grandchild1'];
      const html = manager.exportHTML(mockTree, { selectedIds });
      
      expect(html).toContain('Documentation');
      expect(html).toContain('Getting Started');
      expect(html).toContain('Installation');
      expect(html).not.toContain('API Reference');
    });

    test('should include custom CSS classes', () => {
      const html = manager.exportHTML(mockTree, {
        cssClasses: {
          root: 'custom-root',
          node: 'custom-node'
        }
      });
      
      expect(html).toContain('custom-root');
      expect(html).toContain('custom-node');
    });

    test('should export with custom title', () => {
      const html = manager.exportHTML(mockTree, {
        title: 'My Documentation Export'
      });
      
      expect(html).toContain('<title>My Documentation Export</title>');
    });

    test('should minify HTML when pretty print is disabled', () => {
      manager.options.prettyPrint = false;
      const html = manager.exportHTML(mockTree);
      
      // Should not have excessive whitespace
      expect(html).not.toMatch(/\n\s{4,}/);
    });
  });

  describe('JSON Export', () => {
    test('should export tree as JSON', () => {
      const json = manager.exportJSON(mockTree);
      const parsed = JSON.parse(json);
      
      expect(parsed.root).toBeDefined();
      expect(parsed.root.id).toBe('root');
      expect(parsed.root.title).toBe('Documentation');
    });

    test('should preserve tree structure in JSON', () => {
      const json = manager.exportJSON(mockTree);
      const parsed = JSON.parse(json);
      
      expect(parsed.root.children).toHaveLength(2);
      expect(parsed.root.children[0].title).toBe('Getting Started');
      expect(parsed.root.children[0].children[0].title).toBe('Installation');
    });

    test('should include metadata when enabled', () => {
      const json = manager.exportJSON(mockTree);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.exportDate).toBeDefined();
      expect(parsed.metadata.nodeCount).toBe(4);
      expect(parsed.metadata.version).toBeDefined();
    });

    test('should exclude metadata when disabled', () => {
      manager.options.includeMetadata = false;
      const json = manager.exportJSON(mockTree);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata).toBeUndefined();
    });

    test('should export selected nodes only', () => {
      const selectedIds = ['child1', 'grandchild1'];
      const json = manager.exportJSON(mockTree, { selectedIds });
      const parsed = JSON.parse(json);
      
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.nodes.find(n => n.id === 'child1')).toBeDefined();
      expect(parsed.nodes.find(n => n.id === 'child2')).toBeUndefined();
    });

    test('should include node statistics', () => {
      const json = manager.exportJSON(mockTree, { includeStats: true });
      const parsed = JSON.parse(json);
      
      expect(parsed.statistics).toBeDefined();
      expect(parsed.statistics.totalNodes).toBe(4);
      expect(parsed.statistics.nodesByType).toBeDefined();
      expect(parsed.statistics.nodesByType.plaintext).toBe(2);
      expect(parsed.statistics.nodesByType.markdown).toBe(1);
      expect(parsed.statistics.nodesByType.yaml).toBe(1);
    });

    test('should prettify JSON when enabled', () => {
      const json = manager.exportJSON(mockTree);
      
      // Should have indentation
      expect(json).toMatch(/\n\s{2,}/);
    });

    test('should minify JSON when pretty print is disabled', () => {
      manager.options.prettyPrint = false;
      const json = manager.exportJSON(mockTree);
      
      // Should not have unnecessary whitespace
      expect(json).not.toMatch(/\n/);
    });

    test('should handle circular references', () => {
      // Create circular reference
      const circularTree = {
        root: { id: 'root', title: 'Root' }
      };
      circularTree.root.parent = circularTree.root;
      
      expect(() => {
        manager.exportJSON(circularTree);
      }).not.toThrow();
    });

    test('should export with custom replacer', () => {
      const replacer = (key, value) => {
        if (key === 'content' && typeof value === 'object') {
          return JSON.stringify(value);
        }
        return value;
      };
      
      const json = manager.exportJSON(mockTree, { replacer });
      const parsed = JSON.parse(json);
      
      // YAML content should be stringified
      const apiNode = parsed.root.children[1];
      expect(typeof apiNode.content).toBe('string');
    });
  });

  describe('Export Formats', () => {
    test('should support markdown export format', () => {
      const markdown = manager.exportMarkdown(mockTree);
      
      expect(markdown).toContain('# Documentation');
      expect(markdown).toContain('## Getting Started');
      expect(markdown).toContain('### Installation');
      expect(markdown).toContain('## API Reference');
    });

    test('should preserve markdown content in markdown export', () => {
      const markdown = manager.exportMarkdown(mockTree);
      
      expect(markdown).toContain('Welcome to the documentation!');
      expect(markdown).toContain('`npm install`');
    });

    test('should convert non-markdown content in markdown export', () => {
      const markdown = manager.exportMarkdown(mockTree);
      
      // YAML should be converted to code block
      expect(markdown).toContain('```yaml');
      expect(markdown).toContain('- create');
      expect(markdown).toContain('- destroy');
    });

    test('should support plain text export format', () => {
      const text = manager.exportText(mockTree);
      
      expect(text).toContain('Documentation');
      expect(text).toContain('Getting Started');
      expect(text).toContain('Installation');
      expect(text).toContain('API Reference');
    });

    test('should include indentation in text export', () => {
      const text = manager.exportText(mockTree);
      
      expect(text).toMatch(/^Documentation/m);
      expect(text).toMatch(/^  Getting Started/m);
      expect(text).toMatch(/^    Installation/m);
    });

    test('should strip HTML from text export', () => {
      const treeWithHTML = {
        root: {
          id: 'root',
          title: 'Root',
          content: '<p>This is <strong>HTML</strong> content</p>',
          children: []
        }
      };
      
      const text = manager.exportText(treeWithHTML);
      
      expect(text).toContain('This is HTML content');
      expect(text).not.toContain('<p>');
      expect(text).not.toContain('<strong>');
    });
  });

  describe('Export Options', () => {
    test('should filter nodes by type', () => {
      const html = manager.exportHTML(mockTree, {
        filterTypes: ['markdown', 'yaml']
      });
      
      expect(html).toContain('Getting Started');
      expect(html).toContain('API Reference');
      expect(html).not.toContain('Documentation'); // root is plaintext
      expect(html).not.toContain('Installation'); // plaintext
    });

    test('should filter nodes by depth', () => {
      const html = manager.exportHTML(mockTree, {
        maxDepth: 1
      });
      
      expect(html).toContain('Documentation');
      expect(html).toContain('Getting Started');
      expect(html).toContain('API Reference');
      expect(html).not.toContain('Installation'); // depth 2, exceeds maxDepth of 1
    });

    test('should transform node content', () => {
      const transformer = (node) => {
        if (node.type === 'markdown') {
          return {
            ...node,
            content: node.content.toUpperCase()
          };
        }
        return node;
      };
      
      const html = manager.exportHTML(mockTree, { transformer });
      
      expect(html).toContain('<h1>GETTING STARTED</h1>');
      expect(html).toContain('WELCOME TO THE DOCUMENTATION!');
    });

    test('should exclude empty nodes when configured', () => {
      const treeWithEmpty = {
        root: {
          id: 'root',
          title: 'Root',
          content: 'Content',
          children: [
            { id: 'empty', title: 'Empty', content: '', children: [] },
            { id: 'full', title: 'Full', content: 'Has content', children: [] }
          ]
        }
      };
      
      const html = manager.exportHTML(treeWithEmpty, {
        excludeEmpty: true
      });
      
      expect(html).toContain('Full');
      expect(html).not.toContain('Empty');
    });
  });

  describe('File Download', () => {
    test('should trigger HTML download', () => {
      // Mock document.createElement and click
      let clicked = false;
      const mockAnchor = {
        href: '',
        download: '',
        click: () => { clicked = true; },
        remove: () => {}
      };
      
      const originalCreateElement = document.createElement;
      const originalAppendChild = document.body.appendChild;
      
      document.createElement = (tag) => {
        if (tag === 'a') return mockAnchor;
        return originalCreateElement.call(document, tag);
      };
      document.body.appendChild = () => {};
      
      manager.downloadHTML(mockTree, 'export.html');
      
      expect(mockAnchor.download).toBe('export.html');
      expect(mockAnchor.href).toContain('data:text/html');
      expect(clicked).toBe(true);
      
      // Restore mocks
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
    });

    test('should trigger JSON download', () => {
      // Mock document.createElement and click
      let clicked = false;
      const mockAnchor = {
        href: '',
        download: '',
        click: () => { clicked = true; },
        remove: () => {}
      };
      
      const originalCreateElement = document.createElement;
      const originalAppendChild = document.body.appendChild;
      
      document.createElement = (tag) => {
        if (tag === 'a') return mockAnchor;
        return originalCreateElement.call(document, tag);
      };
      document.body.appendChild = () => {};
      
      manager.downloadJSON(mockTree, 'export.json');
      
      expect(mockAnchor.download).toBe('export.json');
      expect(mockAnchor.href).toContain('data:application/json');
      expect(clicked).toBe(true);
      
      // Restore mocks
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
    });

    test('should generate default filename with timestamp', () => {
      let clicked = false;
      const mockAnchor = {
        href: '',
        download: '',
        click: () => { clicked = true; },
        remove: () => {}
      };
      
      const originalCreateElement = document.createElement;
      const originalAppendChild = document.body.appendChild;
      
      document.createElement = (tag) => {
        if (tag === 'a') return mockAnchor;
        return originalCreateElement.call(document, tag);
      };
      document.body.appendChild = () => {};
      
      manager.downloadHTML(mockTree);
      
      expect(mockAnchor.download).toMatch(/tree-export-\d{4}-\d{2}-\d{2}\.html/);
      
      // Restore mocks
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
    });
  });

  describe('Content Rendering', () => {
    test('should use custom renderers for content types', () => {
      const customRenderer = {
        markdown: (content) => `<div class="custom-markdown">${content}</div>`,
        yaml: (content) => `<pre class="custom-yaml">${JSON.stringify(content)}</pre>`
      };
      
      const html = manager.exportHTML(mockTree, { renderers: customRenderer });
      
      expect(html).toContain('custom-markdown');
      expect(html).toContain('custom-yaml');
    });

    test('should handle renderer errors gracefully', () => {
      const faultyRenderer = {
        markdown: () => { throw new Error('Renderer error'); }
      };
      
      const html = manager.exportHTML(mockTree, { renderers: faultyRenderer });
      
      // Should fallback to default rendering
      expect(html).toContain('Getting Started');
      expect(html).not.toContain('Renderer error');
    });

    test('should escape HTML in plaintext content', () => {
      const treeWithHTML = {
        root: {
          id: 'root',
          title: 'Root',
          content: '<script>alert("XSS")</script>',
          type: 'plaintext',
          children: []
        }
      };
      
      const html = manager.exportHTML(treeWithHTML);
      
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });

  describe('Performance', () => {
    test('should handle large trees efficiently', () => {
      // Create large tree
      const largeTree = {
        root: {
          id: 'root',
          title: 'Root',
          content: 'Root content',
          children: []
        }
      };
      
      // Add 1000 nodes
      for (let i = 0; i < 1000; i++) {
        largeTree.root.children.push({
          id: `node-${i}`,
          title: `Node ${i}`,
          content: `Content for node ${i}`,
          children: []
        });
      }
      
      const start = Date.now();
      const html = manager.exportHTML(largeTree);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(html).toContain('Node 999');
    });

    test('should stream large exports', (done) => {
      const largeTree = {
        root: {
          id: 'root',
          title: 'Root',
          children: Array(100).fill(null).map((_, i) => ({
            id: `node-${i}`,
            title: `Node ${i}`,
            content: 'x'.repeat(10000), // Large content
            children: []
          }))
        }
      };
      
      const chunks = [];
      
      manager.exportHTMLStream(largeTree, {
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: () => {
          expect(chunks.length).toBeGreaterThan(1);
          expect(chunks.join('')).toContain('Node 99');
          done();
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle null tree gracefully', () => {
      expect(() => {
        manager.exportHTML(null);
      }).not.toThrow();
      
      const html = manager.exportHTML(null);
      expect(html).toContain('No content to export');
    });

    test('should handle malformed tree structure', () => {
      const malformedTree = {
        root: {
          id: 'root',
          title: 'Root',
          children: 'not-an-array' // Invalid
        }
      };
      
      expect(() => {
        manager.exportHTML(malformedTree);
      }).not.toThrow();
    });

    test('should provide error callbacks', (done) => {
      const faultyTree = {
        get root() {
          throw new Error('Tree access error');
        }
      };
      
      manager.exportHTML(faultyTree, {
        onError: (error) => {
          expect(error.message).toContain('Tree access error');
          done();
        }
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      manager.destroy();
      
      expect(manager.destroyed).toBe(true);
      
      // Should not throw when called after destroy
      expect(() => {
        manager.exportHTML(mockTree);
      }).not.toThrow();
    });

    test('should cancel ongoing exports on destroy', (done) => {
      let completed = false;
      
      manager.exportHTMLStream(mockTree, {
        onComplete: () => {
          completed = true;
        }
      });
      
      manager.destroy();
      
      setTimeout(() => {
        expect(completed).toBe(false);
        done();
      }, 100);
    });
  });
});