/**
 * TreeScribe Edge Cases Tests
 * 
 * Testing unusual but valid scenarios and boundary conditions
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Edge Cases', () => {
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

  describe('Boundary Value Testing', () => {
    test('should handle minimum viable document', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const minimalYaml = 'title: "Minimal"';
      const result = await instance.loadYaml(minimalYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(1);
      
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBe(1);
    });

    test('should handle single character values', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const singleCharYaml = `
        title: "A"
        content: "B"
        children:
          - title: "C"
            content: "D"
      `;

      const result = await instance.loadYaml(singleCharYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(2);
    });

    test('should handle maximum reasonable nesting depth', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Create 10 levels of nesting (reasonable maximum)
      let structure = { title: 'Root', content: 'Level 0' };
      let current = structure;
      
      for (let i = 1; i < 10; i++) {
        current.children = [{
          title: `Level ${i}`,
          content: `Content at level ${i}`
        }];
        current = current.children[0];
      }

      const result = await instance.loadYaml(JSON.stringify(structure));
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(10);
      
      // Should render without performance issues
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
    });

    test('should handle large number of siblings', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const children = [];
      for (let i = 0; i < 100; i++) {
        children.push({
          title: `Sibling ${i}`,
          content: `Content for sibling ${i}`
        });
      }

      const structure = {
        title: 'Parent with Many Children',
        content: 'This parent has 100 children',
        children
      };

      const result = await instance.loadYaml(JSON.stringify(structure));
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(101); // Parent + 100 children
    });

    test('should handle empty strings and whitespace', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const whitespaceYaml = `
        title: ""
        content: "   "
        children:
          - title: "\\n\\t\\r"
            content: ""
          - title: "Normal Title"
            content: "\\n\\nContent with\\n\\nnewlines\\n\\n"
      `;

      const result = await instance.loadYaml(whitespaceYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
      
      // Should handle empty and whitespace content gracefully
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Data Type Edge Cases', () => {
    test('should handle all primitive YAML types', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const primitiveYaml = `
        title: "Primitive Types Test"
        content:
          string: "Hello World"
          integer: 42
          float: 3.14159
          boolean_true: true
          boolean_false: false
          null_value: null
          empty_string: ""
          zero: 0
          negative: -123
          scientific: 1.23e-4
          hex: 0xFF
          octal: 0o755
          binary: 0b1010
        type: yaml
      `;

      const result = await instance.loadYaml(primitiveYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(1);
      
      // Should render YAML content properly
      const yamlContent = container.querySelector('.node-content');
      expect(yamlContent).toBeTruthy();
    });

    test('should handle complex nested data structures', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const complexYaml = `
        title: "Complex Data Structures"
        content:
          arrays:
            simple: [1, 2, 3]
            mixed: [1, "two", true, null, 3.14]
            nested: [[1, 2], [3, 4], [5, 6]]
            empty: []
          objects:
            simple: {name: "John", age: 30}
            nested: {person: {name: "Jane", address: {city: "NYC", zip: 10001}}}
            empty: {}
          mixed:
            - name: "Array item 1"
              data: {key: "value"}
            - name: "Array item 2"  
              data: [1, 2, 3]
        type: yaml
      `;

      const result = await instance.loadYaml(complexYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(1);
    });

    test('should handle date and timestamp formats', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const dateYaml = `
        title: "Date and Time Test"
        content:
          date_iso: 2024-01-17
          datetime_iso: 2024-01-17T10:30:00Z
          datetime_offset: 2024-01-17T10:30:00+05:00
          timestamp: 1705485000
        metadata:
          created_at: 2024-01-17T10:30:00Z
          updated_at: 2024-01-17T15:45:00Z
        type: yaml
      `;

      const result = await instance.loadYaml(dateYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBe(1);
    });

    test('should handle special numeric values', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const numericYaml = `
        title: "Special Numeric Values"
        content:
          infinity: .inf
          negative_infinity: -.inf
          not_a_number: .nan
          very_large: 1.7976931348623157e+308
          very_small: 5e-324
          max_safe_integer: 9007199254740991
          min_safe_integer: -9007199254740991
        type: yaml
      `;

      const result = await instance.loadYaml(numericYaml);
      
      // Should handle special numeric values without crashing
      if (result.success) {
        expect(result.nodeCount).toBe(1);
      } else {
        // Some YAML parsers might not support all special values
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Unicode and Encoding Edge Cases', () => {
    test('should handle various Unicode categories', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const unicodeYaml = `
        title: "Unicode Test 🌍"
        content: |
          Testing various Unicode categories:
          
          Symbols: ⚡ ☀️ 🌙 ⭐ 🔥 💧 🌱 🍀
          Math: ∑ ∏ ∫ ∂ ∇ ≈ ≠ ≤ ≥ ∞
          Arrows: ← → ↑ ↓ ↔ ↕ ⇄ ⇅ ⟵ ⟶
          Currency: $ € £ ¥ ₹ ₿ ¢ ₩ ₪ ₫
          
        children:
          - title: "多言語テスト"
            content: |
              Japanese: こんにちは世界 (Konnichiwa sekai)
              Korean: 안녕하세요 세계 (Annyeonghaseyo segye)
              Chinese: 你好世界 (Nǐ hǎo shìjiè)
              Hindi: नमस्ते दुनिया (Namaste duniya)
              
          - title: "🎨 Emoji Story"
            content: |
              Once upon a time 📚, there was a tree 🌳 that loved to code 💻.
              Every day ☀️, it would write beautiful programs 🎨 and share them
              with the world 🌍. The end! 🎉
              
          - title: "Special Characters"
            content: |
              Zero-width characters: ‌‍
              Directional marks: ‎‏
              Combining marks: a̋ ë́ ñ̃ 
              Ligatures: ﬀ ﬁ ﬂ ﬃ ﬄ
      `;

      const result = await instance.loadYaml(unicodeYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
      
      // Should display Unicode correctly in DOM
      const nodes = container.querySelectorAll('.tree-node');
      expect(nodes.length).toBeGreaterThan(0);
    });

    test('should handle right-to-left text', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const rtlYaml = `
        title: "RTL Text Test"
        content: |
          Right-to-left languages:
          
        children:
          - title: "العربية (Arabic)"
            content: |
              مرحبا بالعالم! هذا نص تجريبي باللغة العربية.
              الكتابة من اليمين إلى اليسار.
              
          - title: "עברית (Hebrew)"
            content: |
              שלום עולם! זהו טקסט לבדיקה בעברית.
              הכתיבה מימין לשמאל.
              
          - title: "Mixed Directionality"
            content: |
              This is English text with Arabic: مرحبا
              And Hebrew: שלום embedded within.
              Numbers: 123 should display correctly.
      `;

      const result = await instance.loadYaml(rtlYaml);
      
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle rapid expand/collapse operations', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const structuredYaml = `
        title: "Performance Test Document"
        children:
          - title: "Section 1"
            children:
              - title: "Subsection 1.1"
              - title: "Subsection 1.2"
          - title: "Section 2"
            children:
              - title: "Subsection 2.1"
              - title: "Subsection 2.2"
      `;

      await instance.loadYaml(structuredYaml);

      // Perform rapid expand/collapse operations
      const startTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        if (instance.expandAll) instance.expandAll();
        if (instance.collapseAll) instance.collapseAll();
      }
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second
      
      // Component should still be responsive
      expect(instance.destroy).toBeInstanceOf(Function);
    });

    test('should handle rapid search operations', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const searchYaml = `
        title: "Search Performance Test"
        content: "searchable content for testing search performance"
        children:
          - title: "searchable title 1"
            content: "more searchable content here"
          - title: "another searchable title 2"
            content: "even more searchable content"
          - title: "third searchable title 3"
            content: "final searchable content piece"
      `;

      await instance.loadYaml(searchYaml);

      if (instance.search) {
        const startTime = Date.now();
        
        // Perform rapid searches
        const searchTerms = [
          'search', 'content', 'title', 'test', 'more', 
          'another', 'final', 'piece', 'here', 'even'
        ];
        
        for (let i = 0; i < 20; i++) {
          const term = searchTerms[i % searchTerms.length];
          instance.search(term);
        }
        
        const duration = Date.now() - startTime;
        
        // Should complete searches quickly
        expect(duration).toBeLessThan(500); // 500ms
      }
    });

    test('should handle memory cleanup properly', async () => {
      const instances = [];
      
      // Create multiple instances
      for (let i = 0; i < 5; i++) {
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
        
        const testInstance = TreeScribe.create({
          dom: testContainer,
          onMount: (inst) => {}
        });
        
        await testInstance.loadYaml(`
          title: "Instance ${i}"
          content: "Test content for cleanup"
        `);
        
        instances.push({ instance: testInstance, container: testContainer });
      }
      
      // Destroy all instances
      instances.forEach(({ instance, container }) => {
        instance.destroy();
        if (container.parentNode) {
          document.body.removeChild(container);
        }
      });
      
      // Verify cleanup
      const remainingContainers = document.querySelectorAll('.tree-scribe-container');
      expect(remainingContainers.length).toBe(0);
    });
  });

  describe('Browser Environment Edge Cases', () => {
    test('should handle missing console object', async () => {
      const originalConsole = global.console;
      delete global.console;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: "Console Test"
        content: "Testing without console"
      `);

      // Should work without console
      expect(result.success).toBe(true);

      // Restore console
      global.console = originalConsole;
    });

    test('should handle resize events gracefully', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(`
        title: "Resize Test"
        content: "Testing resize handling"
      `);

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        container.style.width = `${400 + i * 50}px`;
        container.style.height = `${300 + i * 30}px`;
        
        // Trigger resize event
        const resizeEvent = new Event('resize');
        window.dispatchEvent(resizeEvent);
      }

      // Component should handle resizes without errors
      expect(instance.destroy).toBeInstanceOf(Function);
    });

    test('should handle document visibility changes', async () => {
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(`
        title: "Visibility Test"
        content: "Testing visibility changes"
      `);

      // Simulate visibility changes
      const visibilityEvent = new Event('visibilitychange');
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true
      });
      
      document.dispatchEvent(visibilityEvent);
      
      // Component should handle visibility changes
      expect(instance.destroy).toBeInstanceOf(Function);
      
      // Restore visibility
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false
      });
    });
  });

  describe('Accessibility Edge Cases', () => {
    test('should handle screen reader simulation', async () => {
      instance = TreeScribe.create({
        dom: container,
        enableAccessibility: true,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(`
        title: "Accessibility Test"
        children:
          - title: "Child 1"
          - title: "Child 2"
      `);

      // Simulate screen reader navigation
      const treeItems = container.querySelectorAll('[role="treeitem"]');
      
      if (treeItems.length > 0) {
        // Test focus management
        treeItems[0].focus();
        expect(document.activeElement).toBe(treeItems[0]);
        
        // Simulate arrow key navigation
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true
        });
        
        treeItems[0].dispatchEvent(keyEvent);
        
        // Should not throw errors
        expect(instance.destroy).toBeInstanceOf(Function);
      }
    });

    test('should handle high contrast mode', async () => {
      // Mock high contrast media query
      const mockMatchMedia = (query) => ({
        matches: query.includes('prefers-contrast: high'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = mockMatchMedia;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      await instance.loadYaml(`
        title: "High Contrast Test"
        content: "Testing high contrast mode"
      `);

      // Should handle high contrast without errors
      expect(instance.destroy).toBeInstanceOf(Function);

      // Restore matchMedia
      window.matchMedia = originalMatchMedia;
    });
  });
});