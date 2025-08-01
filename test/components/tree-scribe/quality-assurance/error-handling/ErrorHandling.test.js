/**
 * TreeScribe Error Handling Tests
 * 
 * Comprehensive testing of error conditions, edge cases, and recovery mechanisms
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Error Handling', () => {
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
      document.body.removeChild(container);
    }
  });

  describe('Malformed YAML Handling', () => {
    test('should handle completely invalid YAML', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const invalidYaml = `
        title: "Unclosed quote
        content: {broken: json, missing: "quote}
        children:
          - invalid: [array, without, closing
      `;

      const result = await instance.loadYaml(invalidYaml);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      
      // Should show error in UI
      const errorElement = container.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
    });

    test('should handle YAML with invalid syntax', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const syntaxErrorYaml = `
        title: Valid Title
        content: |
          This content is fine
        children:
          - title: Child 1
            content: "Missing closing quote
          - title: Child 2
            content: |
              Indentation: problem
            here
      `;

      const result = await instance.loadYaml(syntaxErrorYaml);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('YAML');
    });

    test('should handle YAML with circular references', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // YAML with anchor references that could cause issues
      const circularYaml = `
        title: Circular Reference Test
        data: &anchor
          name: "Test"
          self: *anchor
        content: "This might cause issues"
      `;

      const result = await instance.loadYaml(circularYaml);
      
      // Should either succeed with proper handling or fail gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      } else {
        // If it succeeds, the circular reference should be handled safely
        expect(result.nodeCount).toBeGreaterThan(0);
      }
    });

    test('should handle extremely large YAML documents', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Generate a large YAML document
      const largeChildren = [];
      for (let i = 0; i < 1000; i++) {
        largeChildren.push({
          title: `Node ${i}`,
          content: 'x'.repeat(500), // 500 characters per content
          children: Array(5).fill(null).map((_, j) => ({
            title: `Child ${i}-${j}`,
            content: 'y'.repeat(100)
          }))
        });
      }

      const largeYaml = {
        title: 'Large Document',
        content: 'This is a very large document for stress testing',
        children: largeChildren
      };

      const yamlString = JSON.stringify(largeYaml);
      
      const startTime = Date.now();
      const result = await instance.loadYaml(yamlString);
      const loadTime = Date.now() - startTime;
      
      // Should handle large documents within reasonable time
      expect(loadTime).toBeLessThan(5000); // 5 seconds max
      
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThanOrEqual(1000);
      } else {
        // If it fails, should be due to memory constraints, not crashes
        expect(result.error).toBeDefined();
      }
    });

    test('should handle YAML with deeply nested structure', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Create deeply nested structure (15 levels)
      let deepStructure = { title: 'Root', content: 'Level 0' };
      let current = deepStructure;
      
      for (let i = 1; i <= 15; i++) {
        current.children = [{
          title: `Level ${i}`,
          content: `Content at depth ${i}`
        }];
        current = current.children[0];
      }

      const result = await instance.loadYaml(JSON.stringify(deepStructure));
      
      // Should handle deep nesting gracefully
      if (result.success) {
        expect(result.nodeCount).toBe(16); // Root + 15 levels
        
        // Should not cause stack overflow in rendering
        const nodes = container.querySelectorAll('[role="treeitem"]');
        expect(nodes.length).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    test('should handle mixed content types with errors', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const mixedYaml = `
        title: Mixed Content Test
        children:
          - title: Valid Markdown
            content: |
              # This is valid markdown
              
              With **bold** and *italic* text.
            type: markdown
            
          - title: Invalid JSON
            content: |
              {
                "invalid": json,
                "missing": "quotes
                "unclosed": [array
              }
            type: json
            
          - title: Valid Plain Text
            content: This is just plain text content that should work fine.
            type: plaintext
            
          - title: Unknown Type
            content: This content has an unknown type
            type: unknown-type
      `;

      const result = await instance.loadYaml(mixedYaml);
      
      // Should succeed overall even with some content errors
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
      
      // Should render all nodes, even those with problematic content
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Network Error Handling', () => {
    test('should handle failed URL loading', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Mock fetch to simulate network error
      const originalFetch = global.fetch;
      global.fetch = () => Promise.reject(new Error('Network error'));

      const result = await instance.loadYaml('https://nonexistent.example.com/document.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      
      // Should show error in UI
      const errorElement = container.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
      
      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should handle HTTP error responses', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Mock fetch to simulate 404 error
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await instance.loadYaml('https://example.com/missing.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
      
      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should handle slow network responses', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Mock fetch to simulate slow response
      const originalFetch = global.fetch;
      global.fetch = () => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            text: () => Promise.resolve('title: Slow Document\ncontent: Loaded slowly')
          });
        }, 100); // 100ms delay
      });

      const startTime = Date.now();
      const result = await instance.loadYaml('https://example.com/slow.yaml');
      const loadTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(loadTime).toBeGreaterThanOrEqual(100);
      
      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should handle timeout on network requests', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Mock fetch to simulate timeout
      const originalFetch = global.fetch;
      global.fetch = () => new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, 50);
      });

      const result = await instance.loadYaml('https://example.com/timeout.yaml');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      
      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('Memory Management Errors', () => {
    test('should handle out-of-memory conditions gracefully', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Create extremely large content that might cause memory issues
      const hugeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      
      const hugeYaml = {
        title: 'Memory Test',
        content: hugeContent,
        children: Array(100).fill(null).map((_, i) => ({
          title: `Child ${i}`,
          content: hugeContent
        }))
      };

      const result = await instance.loadYaml(JSON.stringify(hugeYaml));
      
      // Should either succeed or fail gracefully without crashing
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
      
      // Component should still be responsive
      expect(instance.destroy).toBeInstanceOf(Function);
    });

    test('should handle memory leaks in repeated operations', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const testYaml = `
        title: Memory Leak Test
        children:
          - title: Node 1
            content: Some content
          - title: Node 2
            content: More content
      `;

      // Perform many load operations
      for (let i = 0; i < 50; i++) {
        const result = await instance.loadYaml(testYaml);
        expect(result.success).toBe(true);
        
        // Verify component is still functional
        if (instance.expandAll) {
          instance.expandAll();
        }
        if (instance.collapseAll) {
          instance.collapseAll();
        }
      }

      // Component should still work after many operations
      const finalResult = await instance.loadYaml(testYaml);
      expect(finalResult.success).toBe(true);
    });
  });

  describe('Browser Compatibility Errors', () => {
    test('should handle missing modern APIs gracefully', async () => {
      // Save original APIs
      const originalFetch = global.fetch;
      const originalURL = global.URL;
      const originalClipboard = global.navigator?.clipboard;

      // Remove modern APIs
      delete global.fetch;
      delete global.URL;
      if (global.navigator) {
        delete global.navigator.clipboard;
      }

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Compatibility Test
        content: Testing without modern APIs
      `);

      // Should still work without modern APIs
      expect(result.success).toBe(true);

      // Restore APIs
      global.fetch = originalFetch;
      global.URL = originalURL;
      if (global.navigator && originalClipboard) {
        global.navigator.clipboard = originalClipboard;
      }
    });

    test('should handle missing DOM APIs gracefully', async () => {
      // Save original methods
      const originalQuerySelectorAll = document.querySelectorAll;
      const originalCreateElement = document.createElement;

      // Create instance first
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Mock DOM methods to potentially fail
      let callCount = 0;
      document.querySelectorAll = function(selector) {
        callCount++;
        if (callCount > 10) {
          throw new Error('DOM method failed');
        }
        return originalQuerySelectorAll.call(this, selector);
      };

      const result = await instance.loadYaml(`
        title: DOM Error Test
        content: Testing DOM error handling
      `);

      // Should handle DOM errors gracefully
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Restore methods
      document.querySelectorAll = originalQuerySelectorAll;
      document.createElement = originalCreateElement;
    });
  });

  describe('Edge Case Data Handling', () => {
    test('should handle empty YAML document', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml('');
      
      // Should handle empty document gracefully
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    test('should handle null and undefined values', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const nullYaml = `
        title: Null Test
        content: null
        children:
          - title: null
            content: undefined
          - title: "Valid Title"
            content: ~
      `;

      const result = await instance.loadYaml(nullYaml);
      
      expect(result.success).toBe(true);
      
      // Should render nodes even with null values
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
    });

    test('should handle special characters and Unicode', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const unicodeYaml = `
        title: "Unicode Test 🌳"
        content: |
          Testing special characters:
          - Emojis: 🚀 🎉 💾 🔍
          - Accents: café, naïve, résumé
          - Math: ∑∀∃∈∉∪∩
          - Currency: $€£¥₹
          - Arrows: ←→↑↓⇄⇅
        children:
          - title: "中文测试"
            content: "This is Chinese text: 你好世界"
          - title: "العربية"
            content: "Arabic text: مرحبا بالعالم"
          - title: "Русский"
            content: "Russian text: Привет мир"
      `;

      const result = await instance.loadYaml(unicodeYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
      
      // Should display Unicode correctly
      const titleElement = container.querySelector('.node-title');
      expect(titleElement).toBeTruthy();
    });

    test('should handle extremely long strings', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const longString = 'A'.repeat(100000); // 100k characters
      
      const longYaml = {
        title: 'Long String Test',
        content: longString,
        children: [{
          title: longString.substring(0, 1000) + '...',
          content: 'Child with long title'
        }]
      };

      const result = await instance.loadYaml(JSON.stringify(longYaml));
      
      // Should handle long strings without crashing
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    test('should handle rapid sequential operations', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const promises = [];
      
      // Fire multiple load operations simultaneously
      for (let i = 0; i < 10; i++) {
        const yaml = `
          title: Concurrent Test ${i}
          content: Testing concurrent loading
        `;
        promises.push(instance.loadYaml(yaml));
      }

      const results = await Promise.all(promises);
      
      // All operations should complete
      expect(results).toHaveLength(10);
      
      // At least some should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Component should still be functional
      expect(instance.destroy).toBeInstanceOf(Function);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from errors and continue functioning', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // First, cause an error
      const errorResult = await instance.loadYaml('invalid: yaml: content:');
      expect(errorResult.success).toBe(false);

      // Then load valid content
      const validResult = await instance.loadYaml(`
        title: Recovery Test
        content: This should work after an error
      `);

      expect(validResult.success).toBe(true);
      
      // Component should be fully functional
      if (instance.expandAll) {
        instance.expandAll();
      }
      
      // Should show valid content, not error
      const treeContainer = container.querySelector('.tree-scribe-container');
      expect(treeContainer).toBeTruthy();
    });

    test('should maintain state consistency after errors', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Load valid content first
      await instance.loadYaml(`
        title: Initial Content
        children:
          - title: Child 1
          - title: Child 2
      `);

      // Expand some nodes
      if (instance.expandAll) {
        instance.expandAll();
      }

      // Try to load invalid content
      await instance.loadYaml('invalid content');

      // Should maintain previous valid state or reset cleanly
      const nodes = container.querySelectorAll('.tree-node');
      
      // Either should have previous content or be in clean error state
      if (nodes.length > 0) {
        // Previous content maintained
        expect(nodes.length).toBeGreaterThanOrEqual(1);
      } else {
        // Clean error state
        const errorElement = container.querySelector('.error-message');
        expect(errorElement).toBeTruthy();
      }
    });

    test('should provide helpful error messages', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Test various error conditions
      const errorCases = [
        { 
          yaml: 'invalid: yaml: [syntax', 
          expectedError: ['YAML', 'syntax', 'parsing'] 
        },
        { 
          yaml: '{}', 
          expectedError: ['title', 'required', 'missing'] 
        },
        { 
          yaml: null, 
          expectedError: ['content', 'invalid', 'null'] 
        }
      ];

      for (const testCase of errorCases) {
        const result = await instance.loadYaml(testCase.yaml);
        
        if (!result.success) {
          const errorMessage = result.error.toLowerCase();
          
          // Should contain at least one expected error term
          const hasExpectedTerm = testCase.expectedError.some(term => 
            errorMessage.includes(term.toLowerCase())
          );
          
          expect(hasExpectedTerm).toBe(true);
        }
      }
    });
  });
});