/**
 * Public API Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Public API', () => {
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

  describe('Core Methods', () => {
    test('should implement all documented public methods', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      // Core methods
      expect(typeof editor.render).toBe('function');
      expect(typeof editor.destroy).toBe('function');
      expect(typeof editor.getContent).toBe('function');
      expect(typeof editor.setContent).toBe('function');
      expect(typeof editor.loadContent).toBe('function');
      
      // Mode methods
      expect(typeof editor.setMode).toBe('function');
      expect(typeof editor.getMode).toBe('function');
      
      // Node operations
      expect(typeof editor.selectNode).toBe('function');
      expect(typeof editor.expandNode).toBe('function');
      expect(typeof editor.collapseNode).toBe('function');
      expect(typeof editor.expandAll).toBe('function');
      expect(typeof editor.collapseAll).toBe('function');
      
      // Edit operations
      expect(typeof editor.editNode).toBe('function');
      expect(typeof editor.addNode).toBe('function');
      expect(typeof editor.deleteNode).toBe('function');
      expect(typeof editor.moveNode).toBe('function');
      
      // Event methods
      expect(typeof editor.on).toBe('function');
      expect(typeof editor.off).toBe('function');
      expect(typeof editor.emit).toBe('function');
      
      // Utility methods
      expect(typeof editor.getTreeData).toBe('function');
      expect(typeof editor.validate).toBe('function');
      expect(typeof editor.bulkOperation).toBe('function');
      
      editor.destroy();
    });
    
    test('render() should initialize the component', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      // Before render
      expect(container.querySelector('.hierarchy-editor')).toBeTruthy();
      expect(container.querySelector('.he-tree-view').innerHTML).toBe('');
      
      // After render
      editor.render();
      expect(container.querySelector('.node-content')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('getContent() should return current content as string', () => {
      const initialContent = '{"user": {"name": "John", "age": 30}}';
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: initialContent,
        format: 'json'
      });
      
      editor.render();
      
      expect(editor.getContent()).toBe(initialContent);
      
      // After edit
      editor.editNode('user.name', 'Jane');
      const updatedContent = editor.getContent();
      expect(updatedContent).toContain('"name": "Jane"');
      
      editor.destroy();
    });
    
    test('setContent() should update the entire content', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"old": true}',
        format: 'json'
      });
      
      editor.render();
      
      const newContent = '{"new": true, "data": [1, 2, 3]}';
      editor.setContent(newContent);
      
      expect(editor.getContent()).toBe(newContent);
      
      // UI should update
      const nodes = container.querySelectorAll('.node-content');
      const nodeTexts = Array.from(nodes).map(n => n.textContent);
      expect(nodeTexts).toContain('new');
      expect(nodeTexts).toContain('data');
      
      editor.destroy();
    });
    
    test('loadContent() should load content with format detection', () => {
      const editor = HierarchyEditor.create({
        dom: container
      });
      
      editor.render();
      
      // Load JSON
      editor.loadContent('{"format": "json"}');
      expect(editor.getContent()).toBe('{"format": "json"}');
      
      // Load XML
      editor.loadContent('<root><format>xml</format></root>');
      expect(editor.getContent()).toContain('<format>xml</format>');
      
      // Load YAML
      editor.loadContent('format: yaml\ndata: test');
      expect(editor.getContent()).toContain('format: yaml');
      
      // Load Markdown
      editor.loadContent('# Heading\n\nContent');
      expect(editor.getContent()).toContain('# Heading');
      
      editor.destroy();
    });
    
    test('destroy() should clean up completely', () => {
      const onDestroy = jest.fn();
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onDestroy,
        onChange
      });
      
      editor.render();
      editor.on('custom', () => {});
      
      // Destroy
      editor.destroy();
      
      // DOM should be cleaned
      expect(container.innerHTML).toBe('');
      
      // Callback should be called
      expect(onDestroy).toHaveBeenCalledTimes(1);
      
      // Methods should be safe to call
      expect(() => editor.destroy()).not.toThrow();
      
      // Events should not fire
      editor.editNode('test', false);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
  
  describe('Mode Methods', () => {
    test('setMode() should switch between tree and source', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Initially in tree mode
      expect(editor.getMode()).toBe('tree');
      expect(container.querySelector('.tree-view')).toBeTruthy();
      
      // Switch to source
      const result1 = await editor.setMode('source');
      expect(result1.success).toBe(true);
      expect(editor.getMode()).toBe('source');
      expect(container.querySelector('.source-editor')).toBeTruthy();
      
      // Switch back to tree
      const result2 = await editor.setMode('tree');
      expect(result2.success).toBe(true);
      expect(editor.getMode()).toBe('tree');
      expect(container.querySelector('.tree-view')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('getMode() should return current view mode', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        defaultMode: 'source'
      });
      
      editor.render();
      
      expect(editor.getMode()).toBe('source');
      
      editor.destroy();
    });
  });
  
  describe('Node Operations', () => {
    test('selectNode() should select node by path or ID', () => {
      const onSelect = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"user": {"name": "John", "prefs": {"theme": "dark"}}}',
        format: 'json',
        onSelect
      });
      
      editor.render();
      
      // Select by path
      editor.selectNode('user.name');
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'user.name',
          value: 'John'
        })
      );
      
      // Select by node ID
      const treeData = editor.getTreeData();
      const themeNode = treeData.children[0].children[1].children[0];
      editor.selectNode(themeNode.id);
      
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: themeNode.id,
          value: 'dark'
        })
      );
      
      editor.destroy();
    });
    
    test('expandNode() and collapseNode() should control node state', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child1": 1, "child2": 2}}',
        format: 'json'
      });
      
      editor.render();
      
      // Get parent node element
      const parentEl = container.querySelector('[data-path="parent"]');
      
      // Initially collapsed
      expect(parentEl.classList.contains('expanded')).toBe(false);
      
      // Expand
      editor.expandNode('parent');
      expect(parentEl.classList.contains('expanded')).toBe(true);
      
      // Collapse
      editor.collapseNode('parent');
      expect(parentEl.classList.contains('expanded')).toBe(false);
      
      // Expand recursively
      editor.expandNode('parent', true);
      expect(parentEl.classList.contains('expanded')).toBe(true);
      
      editor.destroy();
    });
    
    test('expandAll() and collapseAll() should affect all nodes', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: `{
          "a": {"b": {"c": 1}},
          "d": {"e": {"f": 2}}
        }`,
        format: 'json'
      });
      
      editor.render();
      
      // Expand all
      editor.expandAll();
      
      const expandedNodes = container.querySelectorAll('.node.expanded');
      expect(expandedNodes.length).toBeGreaterThan(2);
      
      // Collapse all
      editor.collapseAll();
      
      const collapsedNodes = container.querySelectorAll('.node.expanded');
      expect(collapsedNodes.length).toBe(0);
      
      editor.destroy();
    });
  });
  
  describe('Edit Operations', () => {
    test('editNode() should update node value', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"count": 10, "name": "test"}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      // Edit number
      editor.editNode('count', 20);
      expect(JSON.parse(editor.getContent()).count).toBe(20);
      
      // Edit string
      editor.editNode('name', 'updated');
      expect(JSON.parse(editor.getContent()).name).toBe('updated');
      
      expect(onChange).toHaveBeenCalledTimes(2);
      
      editor.destroy();
    });
    
    test('addNode() should add new nodes', () => {
      const onNodeAdd = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": [], "data": {}}',
        format: 'json',
        onNodeAdd
      });
      
      editor.render();
      
      // Add to array
      editor.addNode('items', 'new item');
      editor.addNode('items', { id: 1, name: 'object item' });
      
      // Add to object
      editor.addNode('data', 'value', 'newKey');
      
      const content = JSON.parse(editor.getContent());
      expect(content.items).toHaveLength(2);
      expect(content.items[0]).toBe('new item');
      expect(content.items[1].name).toBe('object item');
      expect(content.data.newKey).toBe('value');
      
      expect(onNodeAdd).toHaveBeenCalledTimes(3);
      
      editor.destroy();
    });
    
    test('deleteNode() should remove nodes', () => {
      const onNodeDelete = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": 2, "c": [1, 2, 3]}',
        format: 'json',
        onNodeDelete
      });
      
      editor.render();
      
      // Delete object property
      editor.deleteNode('b');
      
      // Delete array element
      editor.deleteNode('c.1');
      
      const content = JSON.parse(editor.getContent());
      expect(content.b).toBeUndefined();
      expect(content.c).toEqual([1, 3]);
      
      expect(onNodeDelete).toHaveBeenCalledTimes(2);
      
      editor.destroy();
    });
    
    test('moveNode() should relocate nodes', () => {
      const onNodeMove = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: `{
          "source": ["a", "b", "c"],
          "target": ["x", "y"]
        }`,
        format: 'json',
        onNodeMove
      });
      
      editor.render();
      
      // Move between arrays
      editor.moveNode('source.1', 'target', 1);
      
      const content = JSON.parse(editor.getContent());
      expect(content.source).toEqual(['a', 'c']);
      expect(content.target).toEqual(['x', 'b', 'y']);
      
      expect(onNodeMove).toHaveBeenCalledTimes(1);
      
      editor.destroy();
    });
  });
  
  describe('Event Methods', () => {
    test('on() and off() should manage event listeners', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      // Add listeners
      editor.on('change', listener1);
      editor.on('change', listener2);
      
      // Trigger event
      editor.setContent('{"test": false}');
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      // Remove one listener
      editor.off('change', listener1);
      
      // Trigger again
      editor.setContent('{"test": true}');
      
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
      
      editor.destroy();
    });
    
    test('emit() should trigger custom events', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      const customListener = jest.fn();
      editor.on('customEvent', customListener);
      
      // Emit custom event
      editor.emit('customEvent', {
        customData: 'test',
        timestamp: 12345
      });
      
      expect(customListener).toHaveBeenCalledWith({
        customData: 'test',
        timestamp: 12345
      });
      
      editor.destroy();
    });
  });
  
  describe('Utility Methods', () => {
    test('getTreeData() should return hierarchical structure', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"user": {"name": "John", "age": 30}}',
        format: 'json'
      });
      
      editor.render();
      
      const treeData = editor.getTreeData();
      
      expect(treeData.type).toBe('object');
      expect(treeData.children).toHaveLength(1);
      
      const userNode = treeData.children[0];
      expect(userNode.name).toBe('user');
      expect(userNode.type).toBe('object');
      expect(userNode.children).toHaveLength(2);
      
      const nameNode = userNode.children.find(c => c.name === 'name');
      expect(nameNode.value).toBe('John');
      
      editor.destroy();
    });
    
    test('validate() should check content validity', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Valid content
      const result1 = editor.validate('{"valid": true}');
      expect(result1.valid).toBe(true);
      
      // Invalid JSON
      const result2 = editor.validate('{invalid json}');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeTruthy();
      
      // Valid XML
      const result3 = editor.validate('<root><valid>true</valid></root>', 'xml');
      expect(result3.valid).toBe(true);
      
      editor.destroy();
    });
    
    test('bulkOperation() should batch multiple changes', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": [], "count": 0}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      // Multiple operations in bulk
      editor.bulkOperation(() => {
        editor.addNode('items', 'item1');
        editor.addNode('items', 'item2');
        editor.addNode('items', 'item3');
        editor.editNode('count', 3);
      });
      
      // Should emit only one change event
      expect(onChange).toHaveBeenCalledTimes(1);
      
      const content = JSON.parse(editor.getContent());
      expect(content.items).toHaveLength(3);
      expect(content.count).toBe(3);
      
      editor.destroy();
    });
  });
  
  describe('Configuration Options', () => {
    test('should respect editable configuration', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        editable: false
      });
      
      editor.render();
      
      // Edit operations should be disabled
      const originalContent = editor.getContent();
      
      editor.editNode('test', false);
      editor.addNode('', 'newValue', 'newKey');
      editor.deleteNode('test');
      
      // Content should remain unchanged
      expect(editor.getContent()).toBe(originalContent);
      
      editor.destroy();
    });
    
    test('should respect showToolbar configuration', () => {
      const editor1 = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        showToolbar: true
      });
      
      editor1.render();
      expect(container.querySelector('.he-toolbar')).toBeTruthy();
      editor1.destroy();
      
      const editor2 = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        showToolbar: false
      });
      
      editor2.render();
      expect(container.querySelector('.he-toolbar')).toBeFalsy();
      editor2.destroy();
    });
    
    test('should respect defaultMode configuration', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        defaultMode: 'source'
      });
      
      editor.render();
      
      expect(editor.getMode()).toBe('source');
      expect(container.querySelector('.source-editor')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should support custom validators', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"age": 25}',
        format: 'json',
        validators: {
          age: (value) => {
            if (typeof value !== 'number' || value < 0 || value > 150) {
              return { valid: false, error: 'Age must be between 0 and 150' };
            }
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // Valid edit
      const result1 = editor.editNode('age', 30);
      expect(result1).toBeTruthy();
      expect(JSON.parse(editor.getContent()).age).toBe(30);
      
      // Invalid edit
      const result2 = editor.editNode('age', 200);
      expect(result2).toBeFalsy();
      expect(JSON.parse(editor.getContent()).age).toBe(30); // Unchanged
      
      editor.destroy();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid initial content gracefully', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid json}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parse-error',
          format: 'json'
        })
      );
      
      // Should show error state
      expect(container.querySelector('.error-state')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should recover from errors', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid}',
        format: 'json'
      });
      
      editor.render();
      
      // Load valid content
      editor.loadContent('{"valid": true}');
      
      // Should recover
      expect(container.querySelector('.error-state')).toBeFalsy();
      expect(container.querySelector('.tree-view')).toBeTruthy();
      expect(editor.getContent()).toBe('{"valid": true}');
      
      editor.destroy();
    });
    
    test('should handle operation failures gracefully', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Try to delete non-existent node
      expect(() => editor.deleteNode('nonexistent')).not.toThrow();
      
      // Try to move to invalid location
      expect(() => editor.moveNode('test', 'invalid.path', 0)).not.toThrow();
      
      // Content should remain valid
      expect(editor.getContent()).toBe('{"test": true}');
      
      editor.destroy();
    });
  });
});