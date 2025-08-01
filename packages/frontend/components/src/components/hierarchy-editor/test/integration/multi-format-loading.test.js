/**
 * Multi-Format Loading Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Multi-Format Loading', () => {
  let container;
  let HierarchyEditor;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import HierarchyEditor
    const editorModule = await import('../../index.js');
    HierarchyEditor = editorModule.HierarchyEditor;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Format Loading and Switching', () => {
    test('should load JSON format correctly', () => {
      const jsonContent = '{"users": [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]}';
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: jsonContent,
        format: 'json'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('json');
      expect(editor.getContent()).toBe(jsonContent);
      
      // Verify tree structure
      const treeData = editor.getTreeData();
      expect(treeData.children).toHaveLength(1); // users property
      expect(treeData.children[0].name).toBe('users');
      expect(treeData.children[0].children).toHaveLength(2); // two users
      
      editor.destroy();
    });

    test('should load XML format correctly', () => {
      const xmlContent = `<?xml version="1.0"?>
<users>
  <user id="1">
    <name>John</name>
    <age>30</age>
  </user>
  <user id="2">
    <name>Jane</name>
    <age>25</age>
  </user>
</users>`;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: xmlContent,
        format: 'xml'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('xml');
      
      // Verify tree structure
      const treeData = editor.getTreeData();
      expect(treeData.children).toBeDefined();
      expect(treeData.children[0].name).toBe('users');
      
      editor.destroy();
    });

    test('should load YAML format correctly', () => {
      const yamlContent = `users:
  - name: John
    age: 30
  - name: Jane
    age: 25
settings:
  theme: dark
  notifications: true`;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: yamlContent,
        format: 'yaml'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('yaml');
      
      // Verify tree structure
      const treeData = editor.getTreeData();
      expect(treeData.children).toHaveLength(2); // users and settings
      
      editor.destroy();
    });

    test('should load Markdown format correctly', () => {
      const markdownContent = `# Project Documentation

## Overview
This is the overview section.

## Features
- Feature 1
- Feature 2
- Feature 3

### Advanced Features
Additional advanced features here.`;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: markdownContent,
        format: 'markdown'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('markdown');
      
      // Verify tree structure
      const treeData = editor.getTreeData();
      expect(treeData.children[0].name).toBe('Project Documentation');
      expect(treeData.children[0].type).toBe('heading');
      
      editor.destroy();
    });
  });

  describe('Format Auto-Detection', () => {
    test('should auto-detect JSON format', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"auto": "detected", "format": "json"}',
        format: 'auto'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('json');
      expect(editor.getDetectedFormat()).toBe('json');
      
      editor.destroy();
    });

    test('should auto-detect XML format', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '<root><auto>detected</auto></root>',
        format: 'auto'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('xml');
      expect(editor.getDetectedFormat()).toBe('xml');
      
      editor.destroy();
    });

    test('should auto-detect YAML format', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: 'auto: detected\nformat: yaml',
        format: 'auto'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('yaml');
      expect(editor.getDetectedFormat()).toBe('yaml');
      
      editor.destroy();
    });

    test('should auto-detect Markdown format', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '# Auto Detected\n\nThis is **markdown** format.',
        format: 'auto'
      });
      
      editor.render();
      
      expect(editor.getFormat()).toBe('markdown');
      expect(editor.getDetectedFormat()).toBe('markdown');
      
      editor.destroy();
    });

    test('should handle ambiguous content detection', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: 'This could be plain text or markdown',
        format: 'auto'
      });
      
      editor.render();
      
      // Should default to a safe format
      expect(['text', 'markdown']).toContain(editor.getFormat());
      
      editor.destroy();
    });
  });

  describe('Dynamic Format Switching', () => {
    test('should switch from JSON to XML format', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"name": "John", "age": 30}',
        format: 'json'
      });
      
      editor.render();
      expect(editor.getFormat()).toBe('json');
      
      // Load new content with different format
      const xmlContent = '<person><name>John</name><age>30</age></person>';
      await editor.loadContent(xmlContent, 'xml');
      
      expect(editor.getFormat()).toBe('xml');
      expect(editor.getContent()).toBe(xmlContent);
      
      editor.destroy();
    });

    test('should preserve view mode during format switch', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Switch to source mode
      await editor.setMode('source');
      expect(editor.getMode()).toBe('source');
      
      // Load different format
      await editor.loadContent('test: true', 'yaml');
      
      // Should remain in source mode
      expect(editor.getMode()).toBe('source');
      expect(editor.getFormat()).toBe('yaml');
      
      editor.destroy();
    });

    test('should handle format conversion errors', async () => {
      const onError = jest.fn();
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"valid": "json"}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Try to load invalid content
      const result = await editor.loadContent('{invalid json}', 'json');
      
      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalled();
      
      // Original content should be preserved
      expect(editor.getContent()).toBe('{"valid": "json"}');
      
      editor.destroy();
    });
  });

  describe('Format-Specific Features', () => {
    test('should handle JSON-specific operations', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"compact":true,"no":"spacing"}',
        format: 'json'
      });
      
      editor.render();
      
      // JSON formatting
      editor.formatContent();
      const formatted = editor.getContent();
      
      expect(formatted).toContain('{\n');
      expect(formatted).toContain('  "compact": true,\n');
      expect(formatted).toContain('  "no": "spacing"\n');
      
      editor.destroy();
    });

    test('should handle XML-specific operations', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '<root><item attr="value">text</item></root>',
        format: 'xml'
      });
      
      editor.render();
      
      // XML should preserve attributes
      const treeData = editor.getTreeData();
      const itemNode = treeData.children[0].children[0];
      
      expect(itemNode.attributes).toBeDefined();
      expect(itemNode.attributes.attr).toBe('value');
      
      editor.destroy();
    });

    test('should handle YAML-specific operations', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: 'list:\n  - item1\n  - item2\nkey: value',
        format: 'yaml'
      });
      
      editor.render();
      
      // YAML should preserve list structure
      const treeData = editor.getTreeData();
      const listNode = treeData.children.find(child => child.name === 'list');
      
      expect(listNode.type).toBe('array');
      expect(listNode.children).toHaveLength(2);
      
      editor.destroy();
    });

    test('should handle Markdown-specific operations', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '# Title\n\n```javascript\nconst code = true;\n```\n\n> Quote here',
        format: 'markdown'
      });
      
      editor.render();
      
      // Markdown should preserve content types
      const treeData = editor.getTreeData();
      const contentNodes = treeData.children[0].children;
      
      const codeNode = contentNodes.find(node => node.metadata?.type === 'code');
      const quoteNode = contentNodes.find(node => node.metadata?.type === 'blockquote');
      
      expect(codeNode).toBeDefined();
      expect(quoteNode).toBeDefined();
      
      editor.destroy();
    });
  });

  describe('Cross-Format Workflows', () => {
    test('should support format transformation workflow', async () => {
      const jsonContent = {
        user: {
          name: "John Doe",
          email: "john@example.com",
          active: true
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(jsonContent),
        format: 'json'
      });
      
      editor.render();
      
      // Work with JSON
      const initialData = editor.getTreeData();
      expect(initialData.children[0].name).toBe('user');
      
      // Manual transformation to XML-like structure
      const xmlContent = `<user>
  <name>John Doe</name>
  <email>john@example.com</email>
  <active>true</active>
</user>`;
      
      await editor.loadContent(xmlContent, 'xml');
      
      // Verify XML loaded correctly
      const xmlData = editor.getTreeData();
      expect(xmlData.children[0].name).toBe('user');
      
      editor.destroy();
    });

    test('should maintain data integrity across format changes', async () => {
      const testData = {
        title: "Test Document",
        sections: ["Introduction", "Main Content", "Conclusion"],
        metadata: {
          author: "Test Author",
          date: "2025-01-31"
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(testData, null, 2),
        format: 'json'
      });
      
      editor.render();
      
      // Verify initial structure
      const jsonTree = editor.getTreeData();
      expect(jsonTree.children).toHaveLength(3); // title, sections, metadata
      
      // Could convert to YAML
      const yamlContent = `title: Test Document
sections:
  - Introduction
  - Main Content
  - Conclusion
metadata:
  author: Test Author
  date: "2025-01-31"`;
      
      await editor.loadContent(yamlContent, 'yaml');
      
      // Verify YAML structure
      const yamlTree = editor.getTreeData();
      expect(yamlTree.children).toHaveLength(3);
      
      editor.destroy();
    });
  });

  describe('Performance with Different Formats', () => {
    test('should handle large JSON files efficiently', () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
          nested: {
            prop1: `value${i}`,
            prop2: i * 2
          }
        }))
      };
      
      const startTime = Date.now();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(largeData),
        format: 'json'
      });
      
      editor.render();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time
      expect(loadTime).toBeLessThan(5000);
      
      // Should be functional
      expect(editor.getTreeData()).toBeDefined();
      
      editor.destroy();
    });

    test('should handle complex nested structures', () => {
      const deeplyNested = {};
      let current = deeplyNested;
      
      // Create deeply nested structure
      for (let i = 0; i < 50; i++) {
        current.level = i;
        current.child = {};
        current = current.child;
      }
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(deeplyNested),
        format: 'json'
      });
      
      editor.render();
      
      // Should handle deep nesting
      const treeData = editor.getTreeData();
      expect(treeData).toBeDefined();
      
      // Expansion should work
      editor.expandAll();
      const expanded = editor.getExpandedNodes();
      expect(expanded.length).toBeGreaterThan(0);
      
      editor.destroy();
    });
  });

  describe('Format Validation and Error Handling', () => {
    test('should validate format on load', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid json content}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      expect(onError).toHaveBeenCalled();
      const errorCall = onError.mock.calls[0][0];
      expect(errorCall.type).toBe('parse-error');
      
      editor.destroy();
    });

    test('should provide format-specific error messages', () => {
      const testCases = [
        {
          format: 'json',
          content: '{"unclosed": "quote}',
          errorPattern: /Unexpected end|unterminated/i
        },
        {
          format: 'xml',
          content: '<unclosed>tag',
          errorPattern: /not well-formed|unclosed/i
        }
      ];
      
      testCases.forEach(({ format, content, errorPattern }) => {
        const onError = jest.fn();
        
        const editor = HierarchyEditor.create({
          dom: container,
          content,
          format,
          onError
        });
        
        editor.render();
        
        expect(onError).toHaveBeenCalled();
        const error = onError.mock.calls[0][0];
        expect(error.message).toMatch(errorPattern);
        
        editor.destroy();
      });
    });

    test('should recover from format errors', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid}',
        format: 'json',
        onError: jest.fn()
      });
      
      editor.render();
      
      // Should still be usable
      editor.setContent('{"valid": true}');
      expect(editor.getContent()).toBe('{"valid": true}');
      
      // Tree should update
      const treeData = editor.getTreeData();
      expect(treeData.children).toHaveLength(1);
      
      editor.destroy();
    });
  });
});