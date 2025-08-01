/**
 * Event Callbacks Integration Tests
 */
import { createTestContainer, cleanupTestContainer, waitForUpdate } from '../test-helpers.js';

describe('Event Callbacks', () => {
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

  describe('Lifecycle Callbacks', () => {
    test('onMount should be called when component is rendered', () => {
      const onMount = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onMount
      });
      
      expect(onMount).not.toHaveBeenCalled();
      
      editor.render();
      
      expect(onMount).toHaveBeenCalledTimes(1);
      expect(onMount).toHaveBeenCalledWith({
        instance: editor,
        format: 'json',
        mode: 'tree'
      });
      
      editor.destroy();
    });
    
    test('onDestroy should be called when component is destroyed', () => {
      const onDestroy = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onDestroy
      });
      
      editor.render();
      expect(onDestroy).not.toHaveBeenCalled();
      
      editor.destroy();
      
      expect(onDestroy).toHaveBeenCalledTimes(1);
      expect(onDestroy).toHaveBeenCalledWith({
        instance: editor
      });
    });
    
    test('onReady should be called when component is fully initialized', async () => {
      const onReady = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onReady
      });
      
      editor.render();
      
      await waitForUpdate();
      
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(onReady).toHaveBeenCalledWith({
        instance: editor,
        nodeCount: expect.any(Number),
        format: 'json'
      });
      
      editor.destroy();
    });
  });
  
  describe('Content Change Callbacks', () => {
    test('onContentChange should be called for all content modifications', () => {
      const onContentChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "initial"}',
        format: 'json',
        onContentChange
      });
      
      editor.render();
      
      // Edit node
      editor.editNode('value', 'updated');
      
      expect(onContentChange).toHaveBeenCalledWith({
        content: '{"value": "updated"}',
        previousContent: '{"value": "initial"}',
        source: 'tree-edit',
        format: 'json'
      });
      
      // Set content
      editor.setContent('{"value": "new"}');
      
      expect(onContentChange).toHaveBeenCalledWith({
        content: '{"value": "new"}',
        previousContent: '{"value": "updated"}',
        source: 'set-content',
        format: 'json'
      });
      
      editor.destroy();
    });
    
    test('onChange should be called with detailed change information', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": [1, 2, 3]}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      // Add node
      editor.addNode('items', 4);
      
      expect(onChange).toHaveBeenCalledWith({
        type: 'add',
        path: 'items',
        value: 4,
        index: 3,
        content: expect.stringContaining('[1, 2, 3, 4]')
      });
      
      onChange.mockClear();
      
      // Delete node
      editor.deleteNode('items.1');
      
      expect(onChange).toHaveBeenCalledWith({
        type: 'delete',
        path: 'items.1',
        oldValue: 2,
        content: expect.stringContaining('[1, 3, 4]')
      });
      
      editor.destroy();
    });
    
    test('onBeforeChange should allow change prevention', () => {
      let allowChange = true;
      const onBeforeChange = jest.fn((event) => {
        if (!allowChange) {
          event.preventDefault();
        }
      });
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "initial"}',
        format: 'json',
        onBeforeChange
      });
      
      editor.render();
      
      // Allow change
      editor.editNode('value', 'allowed');
      expect(editor.getContent()).toContain('"allowed"');
      
      // Prevent change
      allowChange = false;
      editor.editNode('value', 'prevented');
      expect(editor.getContent()).toContain('"allowed"'); // Unchanged
      
      editor.destroy();
    });
  });
  
  describe('Edit Operation Callbacks', () => {
    test('onNodeEdit should provide edit details', () => {
      const onNodeEdit = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"user": {"name": "John", "age": 30}}',
        format: 'json',
        onNodeEdit
      });
      
      editor.render();
      
      editor.editNode('user.name', 'Jane');
      
      expect(onNodeEdit).toHaveBeenCalledWith({
        path: 'user.name',
        oldValue: 'John',
        newValue: 'Jane',
        nodeId: expect.any(String),
        parentPath: 'user'
      });
      
      editor.destroy();
    });
    
    test('onEditStart and onEditEnd should bracket edit operations', () => {
      const events = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "test"}',
        format: 'json',
        onEditStart: (e) => events.push({ type: 'start', ...e }),
        onEditEnd: (e) => events.push({ type: 'end', ...e })
      });
      
      editor.render();
      
      editor.editNode('value', 'updated');
      
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        type: 'start',
        path: 'value',
        currentValue: 'test',
        mode: 'inline'
      });
      expect(events[1]).toEqual({
        type: 'end',
        path: 'value',
        committed: true,
        newValue: 'updated'
      });
      
      editor.destroy();
    });
    
    test('onEditCancel should be called for cancelled edits', () => {
      const onEditCancel = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "original"}',
        format: 'json',
        onEditCancel
      });
      
      editor.render();
      
      // Start inline edit
      editor.startInlineEdit('value');
      
      // Cancel it
      editor.cancelEdit();
      
      expect(onEditCancel).toHaveBeenCalledWith({
        path: 'value',
        originalValue: 'original',
        reason: 'user-cancelled'
      });
      
      editor.destroy();
    });
  });
  
  describe('Structural Change Callbacks', () => {
    test('onNodeAdd should provide addition details', () => {
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
      
      expect(onNodeAdd).toHaveBeenCalledWith({
        parentPath: 'items',
        value: 'new item',
        index: 0,
        nodeId: expect.any(String),
        parentType: 'array'
      });
      
      onNodeAdd.mockClear();
      
      // Add to object
      editor.addNode('data', 'value', 'key');
      
      expect(onNodeAdd).toHaveBeenCalledWith({
        parentPath: 'data',
        value: 'value',
        key: 'key',
        nodeId: expect.any(String),
        parentType: 'object'
      });
      
      editor.destroy();
    });
    
    test('onNodeRemove should provide removal details', () => {
      const onNodeRemove = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": {"c": 2}}',
        format: 'json',
        onNodeRemove
      });
      
      editor.render();
      
      editor.deleteNode('b');
      
      expect(onNodeRemove).toHaveBeenCalledWith({
        path: 'b',
        value: { c: 2 },
        parentPath: '',
        hadChildren: true
      });
      
      editor.destroy();
    });
    
    test('onNodeMove should provide movement details', () => {
      const onNodeMove = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"source": ["a", "b"], "target": ["x"]}',
        format: 'json',
        onNodeMove
      });
      
      editor.render();
      
      editor.moveNode('source.1', 'target', 0);
      
      expect(onNodeMove).toHaveBeenCalledWith({
        fromPath: 'source.1',
        toPath: 'target',
        toIndex: 0,
        value: 'b',
        fromParent: 'source',
        toParent: 'target'
      });
      
      editor.destroy();
    });
  });
  
  describe('Validation Callbacks', () => {
    test('onValidation should be called for validation events', () => {
      const onValidation = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"age": 25}',
        format: 'json',
        onValidation,
        validators: {
          age: (value) => {
            if (value < 0) return { valid: false, error: 'Age must be positive' };
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // Valid edit
      editor.editNode('age', 30);
      
      expect(onValidation).toHaveBeenCalledWith({
        path: 'age',
        value: 30,
        valid: true
      });
      
      onValidation.mockClear();
      
      // Invalid edit
      editor.editNode('age', -5);
      
      expect(onValidation).toHaveBeenCalledWith({
        path: 'age',
        value: -5,
        valid: false,
        error: 'Age must be positive'
      });
      
      editor.destroy();
    });
    
    test('onValidationError should be called for errors', () => {
      const onValidationError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onValidationError
      });
      
      editor.render();
      
      // Load invalid content
      editor.loadContent('{invalid json}');
      
      expect(onValidationError).toHaveBeenCalledWith({
        type: 'parse-error',
        content: '{invalid json}',
        format: 'json',
        error: expect.any(Error)
      });
      
      editor.destroy();
    });
  });
  
  describe('Navigation Callbacks', () => {
    test('onSelect should be called when nodes are selected', () => {
      const onSelect = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": 2, "c": 3}',
        format: 'json',
        onSelect
      });
      
      editor.render();
      
      editor.selectNode('b');
      
      expect(onSelect).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        path: 'b',
        value: 2,
        previousSelection: null
      });
      
      onSelect.mockClear();
      
      editor.selectNode('c');
      
      expect(onSelect).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        path: 'c',
        value: 3,
        previousSelection: expect.objectContaining({ path: 'b' })
      });
      
      editor.destroy();
    });
    
    test('onExpand and onCollapse should track node state', () => {
      const onExpand = jest.fn();
      const onCollapse = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": {"grandchild": true}}}',
        format: 'json',
        onExpand,
        onCollapse
      });
      
      editor.render();
      
      // Expand
      editor.expandNode('parent');
      
      expect(onExpand).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        path: 'parent',
        recursive: false,
        childCount: 1
      });
      
      // Expand recursively
      editor.expandNode('parent', true);
      
      expect(onExpand).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        path: 'parent',
        recursive: true,
        childCount: 1
      });
      
      // Collapse
      editor.collapseNode('parent');
      
      expect(onCollapse).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        path: 'parent'
      });
      
      editor.destroy();
    });
    
    test('onNavigate should track keyboard navigation', () => {
      const onNavigate = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": 2, "c": 3}',
        format: 'json',
        onNavigate
      });
      
      editor.render();
      editor.selectNode('a');
      
      // Navigate down
      const downEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true
      });
      container.dispatchEvent(downEvent);
      
      expect(onNavigate).toHaveBeenCalledWith({
        direction: 'down',
        from: expect.objectContaining({ path: 'a' }),
        to: expect.objectContaining({ path: 'b' }),
        method: 'keyboard'
      });
      
      editor.destroy();
    });
  });
  
  describe('Mode Change Callbacks', () => {
    test('onModeChange should track view mode switches', async () => {
      const onModeChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onModeChange
      });
      
      editor.render();
      
      await editor.setMode('source');
      
      expect(onModeChange).toHaveBeenCalledWith({
        fromMode: 'tree',
        toMode: 'source',
        format: 'json'
      });
      
      onModeChange.mockClear();
      
      await editor.setMode('tree');
      
      expect(onModeChange).toHaveBeenCalledWith({
        fromMode: 'source',
        toMode: 'tree',
        format: 'json'
      });
      
      editor.destroy();
    });
    
    test('onBeforeModeChange should allow prevention', async () => {
      let allowChange = true;
      const onBeforeModeChange = jest.fn((event) => {
        if (!allowChange) {
          event.preventDefault();
        }
      });
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onBeforeModeChange
      });
      
      editor.render();
      
      // Allow change
      const result1 = await editor.setMode('source');
      expect(result1.success).toBe(true);
      expect(editor.getMode()).toBe('source');
      
      // Prevent change
      allowChange = false;
      const result2 = await editor.setMode('tree');
      expect(result2.success).toBe(false);
      expect(editor.getMode()).toBe('source'); // Still source
      
      editor.destroy();
    });
  });
  
  describe('Format Change Callbacks', () => {
    test('onFormatChange should track format switches', () => {
      const onFormatChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onFormatChange
      });
      
      editor.render();
      
      // Load XML
      editor.loadContent('<root><test>true</test></root>');
      
      expect(onFormatChange).toHaveBeenCalledWith({
        fromFormat: 'json',
        toFormat: 'xml',
        content: expect.stringContaining('<test>true</test>')
      });
      
      editor.destroy();
    });
    
    test('onFormatDetected should be called for auto-detection', () => {
      const onFormatDetected = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        onFormatDetected
      });
      
      editor.render();
      
      // Load content without specifying format
      editor.loadContent('key: value\nlist:\n  - item1\n  - item2');
      
      expect(onFormatDetected).toHaveBeenCalledWith({
        format: 'yaml',
        confidence: expect.any(Number),
        content: expect.stringContaining('key: value')
      });
      
      editor.destroy();
    });
  });
  
  describe('Error Callbacks', () => {
    test('onError should handle various error types', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Parse error
      editor.loadContent('{invalid}');
      
      expect(onError).toHaveBeenCalledWith({
        type: 'parse-error',
        format: 'json',
        content: '{invalid}',
        error: expect.any(Error),
        recoverable: true
      });
      
      onError.mockClear();
      
      // Operation error
      editor.deleteNode('nonexistent.path');
      
      expect(onError).toHaveBeenCalledWith({
        type: 'operation-error',
        operation: 'delete',
        path: 'nonexistent.path',
        error: expect.any(Error),
        recoverable: true
      });
      
      editor.destroy();
    });
    
    test('onRecovery should be called when recovering from errors', () => {
      const onRecovery = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid}',
        format: 'json',
        onRecovery
      });
      
      editor.render();
      
      // Load valid content to recover
      editor.loadContent('{"valid": true}');
      
      expect(onRecovery).toHaveBeenCalledWith({
        fromError: 'parse-error',
        newContent: '{"valid": true}',
        newFormat: 'json'
      });
      
      editor.destroy();
    });
  });
  
  describe('Performance Callbacks', () => {
    test('onRenderComplete should provide performance metrics', async () => {
      const onRenderComplete = jest.fn();
      
      const largeData = {};
      for (let i = 0; i < 100; i++) {
        largeData[`item_${i}`] = { value: i };
      }
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify(largeData),
        format: 'json',
        onRenderComplete
      });
      
      editor.render();
      
      await waitForUpdate();
      
      expect(onRenderComplete).toHaveBeenCalledWith({
        nodeCount: expect.any(Number),
        renderTime: expect.any(Number),
        mode: 'tree',
        format: 'json'
      });
      
      editor.destroy();
    });
    
    test('onSlowOperation should warn about performance', async () => {
      const onSlowOperation = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onSlowOperation,
        slowOperationThreshold: 100 // 100ms
      });
      
      editor.render();
      
      // Simulate slow operation
      editor.bulkOperation(() => {
        // Add many nodes
        for (let i = 0; i < 1000; i++) {
          editor.addNode('', i, `key_${i}`);
        }
      });
      
      await waitForUpdate();
      
      expect(onSlowOperation).toHaveBeenCalledWith({
        operation: 'bulk-operation',
        duration: expect.any(Number),
        itemCount: 1000
      });
      
      editor.destroy();
    });
  });
  
  describe('Custom Event Callbacks', () => {
    test('should support custom event emission and handling', () => {
      const onCustomEvent = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Register custom event handler
      editor.on('customEvent', onCustomEvent);
      
      // Emit custom event
      editor.emit('customEvent', {
        customData: 'test',
        timestamp: Date.now()
      });
      
      expect(onCustomEvent).toHaveBeenCalledWith({
        customData: 'test',
        timestamp: expect.any(Number)
      });
      
      editor.destroy();
    });
    
    test('should support wildcard event listeners', () => {
      const events = [];
      const wildcardListener = (eventName, data) => {
        events.push({ eventName, data });
      };
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Register wildcard listener
      editor.on('*', wildcardListener);
      
      // Various operations
      editor.editNode('test', false);
      editor.addNode('', 'new', 'key');
      
      // Should capture all events
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.eventName === 'change')).toBe(true);
      expect(events.some(e => e.eventName === 'nodeAdd')).toBe(true);
      
      editor.destroy();
    });
  });
});