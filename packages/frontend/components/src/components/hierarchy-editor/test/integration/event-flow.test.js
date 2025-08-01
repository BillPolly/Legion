/**
 * Event Flow Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Event Flow', () => {
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

  describe('Basic Event Emission', () => {
    test('should emit mount event on render', () => {
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

    test('should emit destroy event on cleanup', () => {
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

    test('should emit change events for content modifications', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"initial": true}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      // Tree edit
      editor.editNode('initial', false);
      
      expect(onChange).toHaveBeenCalledWith({
        content: '{"initial": false}',
        previousContent: '{"initial": true}',
        source: 'tree-edit',
        format: 'json'
      });
      
      editor.destroy();
    });

    test('should emit error events for invalid operations', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid json}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      expect(onError).toHaveBeenCalledWith({
        type: 'parse-error',
        message: expect.stringContaining('Invalid'),
        format: 'json',
        content: '{invalid json}'
      });
      
      editor.destroy();
    });
  });

  describe('Edit Event Sequence', () => {
    test('should emit events in correct order during edit', () => {
      const events = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "original"}',
        format: 'json',
        onEditStart: (e) => events.push({ type: 'editStart', ...e }),
        onEditValidate: (e) => events.push({ type: 'editValidate', ...e }),
        onEditCommit: (e) => events.push({ type: 'editCommit', ...e }),
        onEditEnd: (e) => events.push({ type: 'editEnd', ...e }),
        onChange: (e) => events.push({ type: 'change', ...e })
      });
      
      editor.render();
      
      // Perform edit
      editor.editNode('value', 'updated');
      
      // Verify event sequence
      expect(events[0].type).toBe('editStart');
      expect(events[0].path).toBe('value');
      expect(events[0].currentValue).toBe('original');
      
      expect(events[1].type).toBe('editValidate');
      expect(events[1].newValue).toBe('updated');
      expect(events[1].valid).toBe(true);
      
      expect(events[2].type).toBe('editCommit');
      expect(events[2].oldValue).toBe('original');
      expect(events[2].newValue).toBe('updated');
      
      expect(events[3].type).toBe('change');
      expect(events[3].source).toBe('tree-edit');
      
      expect(events[4].type).toBe('editEnd');
      expect(events[4].committed).toBe(true);
      
      editor.destroy();
    });

    test('should emit cancel event for aborted edits', () => {
      const events = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "original"}',
        format: 'json',
        onEditStart: (e) => events.push({ type: 'editStart', ...e }),
        onEditCancel: (e) => events.push({ type: 'editCancel', ...e }),
        onEditEnd: (e) => events.push({ type: 'editEnd', ...e })
      });
      
      editor.render();
      
      // Start and cancel edit
      editor.startInlineEdit('value');
      editor.cancelEdit();
      
      expect(events[0].type).toBe('editStart');
      expect(events[1].type).toBe('editCancel');
      expect(events[1].reason).toBe('user-cancelled');
      expect(events[2].type).toBe('editEnd');
      expect(events[2].committed).toBe(false);
      
      editor.destroy();
    });

    test('should emit validation failure events', () => {
      const onEditValidate = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"number": 42}',
        format: 'json',
        onEditValidate,
        validators: {
          number: (value) => {
            if (typeof value !== 'number') {
              return { valid: false, error: 'Must be a number' };
            }
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // Try invalid edit
      editor.editNode('number', 'not-a-number');
      
      expect(onEditValidate).toHaveBeenCalledWith({
        path: 'number',
        newValue: 'not-a-number',
        valid: false,
        error: 'Must be a number'
      });
      
      editor.destroy();
    });
  });

  describe('Mode Change Events', () => {
    test('should emit events during mode transitions', async () => {
      const events = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onModeChange: (e) => events.push({ type: 'modeChange', ...e }),
        onBeforeModeChange: (e) => events.push({ type: 'beforeModeChange', ...e })
      });
      
      editor.render();
      
      // Switch to source mode
      await editor.setMode('source');
      
      expect(events[0].type).toBe('beforeModeChange');
      expect(events[0].fromMode).toBe('tree');
      expect(events[0].toMode).toBe('source');
      
      expect(events[1].type).toBe('modeChange');
      expect(events[1].fromMode).toBe('tree');
      expect(events[1].toMode).toBe('source');
      
      editor.destroy();
    });

    test('should allow mode change cancellation', async () => {
      let allowModeChange = false;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onBeforeModeChange: (e) => {
          if (!allowModeChange) {
            e.preventDefault();
          }
        }
      });
      
      editor.render();
      
      // Try to switch (should be prevented)
      const result1 = await editor.setMode('source');
      expect(result1.success).toBe(false);
      expect(editor.getMode()).toBe('tree');
      
      // Allow and retry
      allowModeChange = true;
      const result2 = await editor.setMode('source');
      expect(result2.success).toBe(true);
      expect(editor.getMode()).toBe('source');
      
      editor.destroy();
    });
  });

  describe('Selection and Navigation Events', () => {
    test('should emit selection events', () => {
      const onSelect = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": 2, "c": 3}',
        format: 'json',
        onSelect
      });
      
      editor.render();
      
      // Select node
      editor.selectNode('b');
      
      expect(onSelect).toHaveBeenCalledWith({
        nodeId: 'b',
        path: 'b',
        value: 2,
        previousSelection: null
      });
      
      // Select different node
      editor.selectNode('c');
      
      expect(onSelect).toHaveBeenCalledWith({
        nodeId: 'c',
        path: 'c',
        value: 3,
        previousSelection: 'b'
      });
      
      editor.destroy();
    });

    test('should emit expand/collapse events', () => {
      const onExpand = jest.fn();
      const onCollapse = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": "value"}}',
        format: 'json',
        onExpand,
        onCollapse
      });
      
      editor.render();
      
      // Expand node
      editor.expandNode('parent');
      
      expect(onExpand).toHaveBeenCalledWith({
        nodeId: 'parent',
        path: 'parent',
        recursive: false
      });
      
      // Collapse node
      editor.collapseNode('parent');
      
      expect(onCollapse).toHaveBeenCalledWith({
        nodeId: 'parent',
        path: 'parent'
      });
      
      editor.destroy();
    });

    test('should emit navigation events', () => {
      const onNavigate = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": [1, 2, 3]}',
        format: 'json',
        onNavigate
      });
      
      editor.render();
      
      // Navigate with keyboard
      editor.navigate('down');
      
      expect(onNavigate).toHaveBeenCalledWith({
        direction: 'down',
        from: expect.any(String),
        to: expect.any(String)
      });
      
      editor.destroy();
    });
  });

  describe('Structural Change Events', () => {
    test('should emit events for node additions', () => {
      const onNodeAdd = jest.fn();
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": []}',
        format: 'json',
        onNodeAdd,
        onChange
      });
      
      editor.render();
      
      // Add node
      editor.addNode('items', 'new item');
      
      expect(onNodeAdd).toHaveBeenCalledWith({
        parentPath: 'items',
        index: 0,
        value: 'new item',
        nodeId: expect.any(String)
      });
      
      expect(onChange).toHaveBeenCalledWith({
        content: '{"items": ["new item"]}',
        source: 'node-add',
        format: 'json'
      });
      
      editor.destroy();
    });

    test('should emit events for node deletions', () => {
      const onNodeDelete = jest.fn();
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": ["a", "b", "c"]}',
        format: 'json',
        onNodeDelete,
        onChange
      });
      
      editor.render();
      
      // Delete node
      editor.deleteNode('items.1');
      
      expect(onNodeDelete).toHaveBeenCalledWith({
        path: 'items.1',
        value: 'b',
        parentPath: 'items',
        index: 1
      });
      
      expect(onChange).toHaveBeenCalledWith({
        content: '{"items": ["a", "c"]}',
        source: 'node-delete',
        format: 'json'
      });
      
      editor.destroy();
    });

    test('should emit events for node movements', () => {
      const onNodeMove = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": ["a", "b", "c"]}',
        format: 'json',
        onNodeMove
      });
      
      editor.render();
      
      // Move node
      editor.moveNode('items.2', 'items', 0);
      
      expect(onNodeMove).toHaveBeenCalledWith({
        fromPath: 'items.2',
        toPath: 'items',
        toIndex: 0,
        value: 'c'
      });
      
      editor.destroy();
    });
  });

  describe('Event Bubbling and Propagation', () => {
    test('should support event listener removal', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Add listener
      editor.on('change', onChange);
      
      // Trigger change
      editor.editNode('test', false);
      expect(onChange).toHaveBeenCalledTimes(1);
      
      // Remove listener
      editor.off('change', onChange);
      
      // Trigger another change
      editor.editNode('test', true);
      expect(onChange).toHaveBeenCalledTimes(1); // Still 1
      
      editor.destroy();
    });

    test('should handle multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      editor.on('change', listener1);
      editor.on('change', listener2);
      editor.on('change', listener3);
      
      // All listeners should be called
      editor.setContent('{"test": false}');
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
      
      editor.destroy();
    });

    test('should stop propagation when requested', () => {
      const firstListener = jest.fn((e) => {
        e.stopPropagation();
      });
      const secondListener = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      editor.on('select', firstListener);
      editor.on('select', secondListener);
      
      editor.selectNode('test');
      
      expect(firstListener).toHaveBeenCalled();
      expect(secondListener).not.toHaveBeenCalled();
      
      editor.destroy();
    });
  });

  describe('Custom Event Support', () => {
    test('should support custom event emission', () => {
      const onCustom = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Listen for custom event
      editor.on('custom-event', onCustom);
      
      // Emit custom event
      editor.emit('custom-event', {
        customData: 'test',
        timestamp: Date.now()
      });
      
      expect(onCustom).toHaveBeenCalledWith({
        customData: 'test',
        timestamp: expect.any(Number)
      });
      
      editor.destroy();
    });

    test('should support event namespacing', () => {
      const events = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Namespaced listeners
      editor.on('edit:start', (e) => events.push({ type: 'edit:start', ...e }));
      editor.on('edit:validate', (e) => events.push({ type: 'edit:validate', ...e }));
      editor.on('edit:commit', (e) => events.push({ type: 'edit:commit', ...e }));
      
      // Trigger edit flow
      editor.editNode('test', false);
      
      // Should have namespaced events
      expect(events.some(e => e.type === 'edit:start')).toBe(true);
      expect(events.some(e => e.type === 'edit:validate')).toBe(true);
      expect(events.some(e => e.type === 'edit:commit')).toBe(true);
      
      editor.destroy();
    });
  });

  describe('Event Performance', () => {
    test('should handle high-frequency events efficiently', () => {
      let eventCount = 0;
      const onChange = () => eventCount++;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"counter": 0}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      const startTime = Date.now();
      
      // Rapid updates
      for (let i = 0; i < 100; i++) {
        editor.editNode('counter', i);
      }
      
      const duration = Date.now() - startTime;
      
      expect(eventCount).toBe(100);
      expect(duration).toBeLessThan(1000); // Should be fast
      
      editor.destroy();
    });

    test('should debounce appropriate events', async () => {
      let validationCount = 0;
      const onValidation = () => validationCount++;
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onValidation
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Rapid source edits
      for (let i = 0; i < 10; i++) {
        editor.setContent(`{"test": ${i}}`);
      }
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Validation should be debounced
      expect(validationCount).toBeLessThan(10);
      
      editor.destroy();
    });
  });
});