/**
 * Component Lifecycle Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('HierarchyEditor Component Lifecycle', () => {
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

  describe('Complete Component Lifecycle', () => {
    test('should handle full lifecycle from creation to destruction', () => {
      // Create with minimal config
      const config = {
        dom: container,
        content: '{"test": true}',
        format: 'json'
      };

      // Creation
      const editor = HierarchyEditor.create(config);
      expect(editor).toBeDefined();
      expect(editor.render).toBeInstanceOf(Function);
      expect(editor.destroy).toBeInstanceOf(Function);
      
      // Rendering
      editor.render();
      expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
      
      // Usage
      const content = editor.getContent();
      expect(content).toBe(config.content);
      
      // Destruction
      editor.destroy();
      expect(container.innerHTML).toBe('');
    });

    test('should handle lifecycle with all configuration options', () => {
      const config = {
        dom: container,
        content: '{"configured": true}',
        format: 'json',
        theme: 'dark',
        readOnly: false,
        showLineNumbers: true,
        expandAll: true,
        onChange: jest.fn(),
        onError: jest.fn(),
        onModeChange: jest.fn()
      };

      const editor = HierarchyEditor.create(config);
      editor.render();
      
      // Verify configuration applied
      expect(container.querySelector('.theme-dark')).toBeTruthy();
      
      // Trigger change
      editor.setContent('{"changed": true}');
      expect(config.onChange).toHaveBeenCalled();
      
      // Clean up
      editor.destroy();
    });

    test('should handle multiple instances independently', () => {
      const container1 = createTestContainer();
      const container2 = createTestContainer();
      
      const editor1 = HierarchyEditor.create({
        dom: container1,
        content: '{"editor": 1}',
        format: 'json'
      });
      
      const editor2 = HierarchyEditor.create({
        dom: container2,
        content: '<editor>2</editor>',
        format: 'xml'
      });
      
      editor1.render();
      editor2.render();
      
      // Should be independent
      expect(editor1.getContent()).toBe('{"editor": 1}');
      expect(editor2.getContent()).toBe('<editor>2</editor>');
      expect(editor1.getFormat()).toBe('json');
      expect(editor2.getFormat()).toBe('xml');
      
      // Destroy one shouldn't affect the other
      editor1.destroy();
      expect(container1.innerHTML).toBe('');
      expect(container2.querySelector('.hierarchy-editor')).toBeTruthy();
      
      editor2.destroy();
      cleanupTestContainer(container1);
      cleanupTestContainer(container2);
    });

    test('should handle re-initialization after destruction', () => {
      const config = {
        dom: container,
        content: '{"initial": true}',
        format: 'json'
      };

      // First instance
      const editor1 = HierarchyEditor.create(config);
      editor1.render();
      expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
      
      editor1.destroy();
      expect(container.innerHTML).toBe('');
      
      // Second instance with same container
      const editor2 = HierarchyEditor.create({
        ...config,
        content: '{"second": true}'
      });
      editor2.render();
      
      expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
      expect(editor2.getContent()).toBe('{"second": true}');
      
      editor2.destroy();
    });
  });

  describe('Memory Management', () => {
    test('should clean up event listeners on destroy', () => {
      const onChange = jest.fn();
      const onError = jest.fn();
      const onModeChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onChange,
        onError,
        onModeChange
      });
      
      editor.render();
      
      // Trigger events
      editor.setContent('{"changed": true}');
      expect(onChange).toHaveBeenCalledTimes(1);
      
      // Destroy
      editor.destroy();
      
      // Events should not fire after destruction
      onChange.mockClear();
      
      // Try to trigger events (should be no-op)
      try {
        editor.setContent('{"after": "destroy"}');
      } catch (e) {
        // Expected - component destroyed
      }
      
      expect(onChange).not.toHaveBeenCalled();
    });

    test('should clean up DOM references', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Store references to DOM elements
      const editorElement = container.querySelector('.hierarchy-editor');
      const treeView = container.querySelector('.hierarchy-tree-view');
      
      expect(editorElement).toBeTruthy();
      expect(treeView).toBeTruthy();
      
      // Destroy
      editor.destroy();
      
      // DOM should be cleaned
      expect(container.querySelector('.hierarchy-editor')).toBeFalsy();
      expect(container.querySelector('.hierarchy-tree-view')).toBeFalsy();
      expect(container.innerHTML).toBe('');
    });

    test('should handle rapid create/destroy cycles', () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const editor = HierarchyEditor.create({
          dom: container,
          content: `{"iteration": ${i}}`,
          format: 'json'
        });
        
        editor.render();
        expect(editor.getContent()).toBe(`{"iteration": ${i}}`);
        
        editor.destroy();
        expect(container.innerHTML).toBe('');
      }
      
      // Should complete without memory issues
      expect(true).toBe(true);
    });
  });

  describe('State Management During Lifecycle', () => {
    test('should preserve state across mode switches', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": "value"}}',
        format: 'json'
      });
      
      editor.render();
      
      // Expand nodes in tree view
      editor.expandAll();
      const expandedBefore = editor.getExpandedNodes();
      
      // Switch to source mode
      await editor.setMode('source');
      expect(editor.getMode()).toBe('source');
      
      // Switch back to tree mode
      await editor.setMode('tree');
      expect(editor.getMode()).toBe('tree');
      
      // Expansion state should be preserved
      const expandedAfter = editor.getExpandedNodes();
      expect(expandedAfter).toEqual(expandedBefore);
      
      editor.destroy();
    });

    test('should maintain content integrity through lifecycle', async () => {
      const originalContent = {
        users: [
          { id: 1, name: "John", active: true },
          { id: 2, name: "Jane", active: false }
        ],
        settings: {
          theme: "dark",
          notifications: true
        }
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(originalContent),
        format: 'json'
      });
      
      editor.render();
      
      // Perform various operations
      editor.expandAll();
      await editor.setMode('source');
      editor.formatContent();
      await editor.setMode('tree');
      
      // Content should remain equivalent
      const finalContent = JSON.parse(editor.getContent());
      expect(finalContent).toEqual(originalContent);
      
      editor.destroy();
    });

    test('should handle state during error conditions', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"valid": true}',
        format: 'json',
        onError: jest.fn()
      });
      
      editor.render();
      
      // Switch to source mode
      await editor.setMode('source');
      
      // Introduce invalid content
      editor.setContent('{invalid json}');
      
      // Try to switch to tree mode (should fail)
      const result = await editor.setMode('tree');
      expect(result.success).toBe(false);
      
      // Should remain in source mode
      expect(editor.getMode()).toBe('source');
      
      // Fix the content
      editor.setContent('{"fixed": true}');
      
      // Now should be able to switch
      const retryResult = await editor.setMode('tree');
      expect(retryResult.success).toBe(true);
      expect(editor.getMode()).toBe('tree');
      
      editor.destroy();
    });
  });

  describe('Component Initialization Patterns', () => {
    test('should support delayed rendering', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"delayed": true}',
        format: 'json'
      });
      
      // Should not render immediately
      expect(container.innerHTML).toBe('');
      
      // Render when ready
      setTimeout(() => {
        editor.render();
        expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
        editor.destroy();
      }, 100);
    });

    test('should support dynamic configuration updates', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"theme": "light"}',
        format: 'json',
        theme: 'light'
      });
      
      editor.render();
      expect(container.querySelector('.theme-light')).toBeTruthy();
      
      // Update theme
      editor.setTheme('dark');
      expect(container.querySelector('.theme-dark')).toBeTruthy();
      expect(container.querySelector('.theme-light')).toBeFalsy();
      
      // Update read-only state
      expect(editor.isReadOnly()).toBe(false);
      editor.setReadOnly(true);
      expect(editor.isReadOnly()).toBe(true);
      
      editor.destroy();
    });

    test('should support content loading patterns', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        format: 'json'
      });
      
      editor.render();
      
      // Should render with empty content
      expect(editor.getContent()).toBe('');
      
      // Load content asynchronously
      const loadContent = async () => {
        // Simulate async content loading
        await new Promise(resolve => setTimeout(resolve, 50));
        return '{"loaded": "async"}';
      };
      
      const content = await loadContent();
      editor.setContent(content);
      
      expect(editor.getContent()).toBe('{"loaded": "async"}');
      
      editor.destroy();
    });
  });

  describe('Error Recovery During Lifecycle', () => {
    test('should recover from render errors', () => {
      const editor = HierarchyEditor.create({
        dom: null, // Invalid DOM
        content: '{"test": true}',
        format: 'json'
      });
      
      // Should not crash
      expect(() => {
        editor.render();
      }).toThrow();
      
      // Should be able to update config and retry
      editor.setContainer(container);
      editor.render();
      
      expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
      
      editor.destroy();
    });

    test('should handle destroy errors gracefully', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Mock internal error during destroy
      const originalDestroy = editor.destroy;
      let destroyCalled = false;
      
      editor.destroy = function() {
        destroyCalled = true;
        // Simulate internal error
        throw new Error('Destroy failed');
      };
      
      // Should not crash the application
      expect(() => {
        editor.destroy();
      }).toThrow();
      
      expect(destroyCalled).toBe(true);
    });

    test('should maintain usability after non-critical errors', () => {
      const onError = jest.fn();
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Trigger non-critical error (e.g., invalid edit)
      editor.setContent('{slightly invalid"}');
      
      // Should still be functional
      editor.setContent('{"valid": "again"}');
      expect(editor.getContent()).toBe('{"valid": "again"}');
      
      editor.destroy();
    });
  });
});