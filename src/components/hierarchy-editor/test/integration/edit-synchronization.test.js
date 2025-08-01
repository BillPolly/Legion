/**
 * Edit Synchronization Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Edit Synchronization', () => {
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

  describe('Tree to Model Synchronization', () => {
    test('should sync tree edits to data model', () => {
      const initialContent = '{"user": {"name": "John", "age": 30}}';
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: initialContent,
        format: 'json'
      });
      
      editor.render();
      
      // Edit a value in tree
      editor.editNode('user.name', 'Jane');
      
      // Model should be updated
      const updatedContent = JSON.parse(editor.getContent());
      expect(updatedContent.user.name).toBe('Jane');
      expect(updatedContent.user.age).toBe(30);
      
      editor.destroy();
    });

    test('should sync node additions to model', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"users": []}',
        format: 'json'
      });
      
      editor.render();
      
      // Add new item to array
      editor.addNode('users', { name: 'New User', id: 1 });
      
      const content = JSON.parse(editor.getContent());
      expect(content.users).toHaveLength(1);
      expect(content.users[0].name).toBe('New User');
      
      editor.destroy();
    });

    test('should sync node deletions to model', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": ["a", "b", "c"]}',
        format: 'json'
      });
      
      editor.render();
      
      // Delete middle item
      editor.deleteNode('items.1');
      
      const content = JSON.parse(editor.getContent());
      expect(content.items).toEqual(['a', 'c']);
      
      editor.destroy();
    });

    test('should sync node movements to model', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"sections": [{"id": 1}, {"id": 2}, {"id": 3}]}',
        format: 'json'
      });
      
      editor.render();
      
      // Move last item to first position
      editor.moveNode('sections.2', 'sections', 0);
      
      const content = JSON.parse(editor.getContent());
      expect(content.sections[0].id).toBe(3);
      expect(content.sections[1].id).toBe(1);
      expect(content.sections[2].id).toBe(2);
      
      editor.destroy();
    });
  });

  describe('Source to Model Synchronization', () => {
    test('should sync source edits to data model', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"original": true}',
        format: 'json'
      });
      
      editor.render();
      
      // Switch to source mode
      await editor.setMode('source');
      
      // Edit in source
      editor.setContent('{"modified": true, "added": "value"}');
      
      // Switch back to tree
      await editor.setMode('tree');
      
      // Tree should reflect changes
      const treeData = editor.getTreeData();
      const nodeNames = treeData.children.map(child => child.name);
      expect(nodeNames).toContain('modified');
      expect(nodeNames).toContain('added');
      
      editor.destroy();
    });

    test('should handle incremental source edits', async () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"count": 0}',
        format: 'json',
        onChange
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Simulate typing
      editor.setContent('{"count": 1}');
      editor.setContent('{"count": 12}');
      editor.setContent('{"count": 123}');
      
      // All changes should be tracked
      expect(onChange).toHaveBeenCalledTimes(3);
      
      editor.destroy();
    });

    test('should validate source edits before sync', async () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"valid": true}',
        format: 'json',
        onError
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Make invalid edit
      editor.setContent('{invalid json}');
      
      // Try to switch to tree mode
      const result = await editor.setMode('tree');
      
      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalled();
      
      editor.destroy();
    });
  });

  describe('Bidirectional Synchronization', () => {
    test('should maintain consistency during rapid mode switches', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": {"nested": {"value": 42}}}',
        format: 'json'
      });
      
      editor.render();
      
      // Rapid mode switches
      for (let i = 0; i < 5; i++) {
        await editor.setMode('source');
        await editor.setMode('tree');
      }
      
      // Content should remain unchanged
      const finalContent = editor.getContent();
      expect(finalContent).toBe('{"test": {"nested": {"value": 42}}}');
      
      editor.destroy();
    });

    test('should sync edits across modes', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": [1, 2, 3]}',
        format: 'json'
      });
      
      editor.render();
      
      // Edit in tree mode
      editor.editNode('items.0', 10);
      
      // Switch to source mode
      await editor.setMode('source');
      
      // Verify change is visible
      let sourceContent = editor.getContent();
      expect(sourceContent).toContain('"items": [10, 2, 3]');
      
      // Edit in source mode
      editor.setContent('{"items": [10, 20, 3]}');
      
      // Switch back to tree
      await editor.setMode('tree');
      
      // Verify both changes
      const content = JSON.parse(editor.getContent());
      expect(content.items).toEqual([10, 20, 3]);
      
      editor.destroy();
    });

    test('should handle concurrent edits gracefully', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"counter": 0}',
        format: 'json'
      });
      
      editor.render();
      
      // Start editing in tree
      const editPromise = editor.editNode('counter', 1);
      
      // Immediately switch to source
      await editor.setMode('source');
      
      // Edit in source
      editor.setContent('{"counter": 2}');
      
      // Complete tree edit (should be ignored/cancelled)
      await editPromise;
      
      // Final value should be from source
      expect(editor.getContent()).toBe('{"counter": 2}');
      
      editor.destroy();
    });
  });

  describe('Event Flow During Synchronization', () => {
    test('should emit correct events during tree edit sync', () => {
      const events = [];
      const onChange = (data) => events.push({ type: 'change', data });
      const onEdit = (data) => events.push({ type: 'edit', data });
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"value": "initial"}',
        format: 'json',
        onChange,
        onEdit
      });
      
      editor.render();
      
      // Perform edit
      editor.editNode('value', 'updated');
      
      // Should have edit event followed by change event
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('edit');
      expect(events[0].data.path).toBe('value');
      expect(events[0].data.newValue).toBe('updated');
      expect(events[1].type).toBe('change');
      expect(events[1].data.content).toContain('"value": "updated"');
      
      editor.destroy();
    });

    test('should emit validation events during source sync', async () => {
      const validationEvents = [];
      const onValidation = (result) => validationEvents.push(result);
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"valid": true}',
        format: 'json',
        onValidation
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Valid edit
      editor.setContent('{"still": "valid"}');
      expect(validationEvents[0].valid).toBe(true);
      
      // Invalid edit
      editor.setContent('{invalid}');
      expect(validationEvents[1].valid).toBe(false);
      
      editor.destroy();
    });

    test('should batch events during bulk operations', () => {
      const onChange = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": []}',
        format: 'json',
        onChange
      });
      
      editor.render();
      
      // Bulk add operation
      editor.bulkOperation(() => {
        for (let i = 0; i < 5; i++) {
          editor.addNode('items', `item${i}`);
        }
      });
      
      // Should emit single change event
      expect(onChange).toHaveBeenCalledTimes(1);
      
      const content = JSON.parse(editor.getContent());
      expect(content.items).toHaveLength(5);
      
      editor.destroy();
    });
  });

  describe('Synchronization with Different Formats', () => {
    test('should sync XML attribute edits', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '<user id="123" active="true"><name>John</name></user>',
        format: 'xml'
      });
      
      editor.render();
      
      // Edit attribute
      editor.editAttribute('user', 'active', 'false');
      
      const content = editor.getContent();
      expect(content).toContain('active="false"');
      expect(content).toContain('id="123"'); // Other attributes preserved
      
      editor.destroy();
    });

    test('should sync YAML structure changes', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: 'users:\n  - name: John\n    age: 30',
        format: 'yaml'
      });
      
      editor.render();
      
      // Add new user
      editor.addNode('users', { name: 'Jane', age: 25 });
      
      const content = editor.getContent();
      expect(content).toContain('name: Jane');
      expect(content).toContain('age: 25');
      
      editor.destroy();
    });

    test('should sync Markdown heading changes', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '# Original Title\n\nContent here.',
        format: 'markdown'
      });
      
      editor.render();
      
      // Edit heading
      const headingNode = editor.getTreeData().children[0];
      editor.editNode(headingNode.id, 'Updated Title');
      
      const content = editor.getContent();
      expect(content).toContain('# Updated Title');
      expect(content).toContain('Content here.');
      
      editor.destroy();
    });
  });

  describe('Conflict Resolution', () => {
    test('should handle edit conflicts gracefully', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"shared": "value"}',
        format: 'json'
      });
      
      editor.render();
      
      // Start tree edit
      const treeEdit = editor.startInlineEdit('shared');
      
      // Switch to source before completing edit
      await editor.setMode('source');
      
      // Source wins - tree edit should be cancelled
      editor.setContent('{"shared": "source-value"}');
      
      await editor.setMode('tree');
      
      const content = JSON.parse(editor.getContent());
      expect(content.shared).toBe('source-value');
      
      editor.destroy();
    });

    test('should preserve valid edits during error recovery', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"a": 1, "b": 2}',
        format: 'json'
      });
      
      editor.render();
      
      // Valid edit
      editor.editNode('a', 10);
      
      // Switch to source
      await editor.setMode('source');
      
      // Make partially invalid edit
      editor.setContent('{"a": 10, "b": 2, invalid}');
      
      // Try to switch back (should fail)
      const result = await editor.setMode('tree');
      expect(result.success).toBe(false);
      
      // Fix the error
      editor.setContent('{"a": 10, "b": 2, "c": 3}');
      
      // Now switch should work
      await editor.setMode('tree');
      
      // Original edit should be preserved
      const content = JSON.parse(editor.getContent());
      expect(content.a).toBe(10);
      expect(content.c).toBe(3);
      
      editor.destroy();
    });
  });

  describe('Performance During Synchronization', () => {
    test('should handle large data synchronization efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`
      }));
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: JSON.stringify({ items: largeArray }),
        format: 'json'
      });
      
      editor.render();
      
      const startTime = Date.now();
      
      // Edit multiple items
      editor.editNode('items.0.value', 'updated-0');
      editor.editNode('items.500.value', 'updated-500');
      editor.editNode('items.999.value', 'updated-999');
      
      const duration = Date.now() - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000);
      
      // Verify edits
      const content = JSON.parse(editor.getContent());
      expect(content.items[0].value).toBe('updated-0');
      expect(content.items[500].value).toBe('updated-500');
      expect(content.items[999].value).toBe('updated-999');
      
      editor.destroy();
    });

    test('should optimize bulk synchronization', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"items": []}',
        format: 'json'
      });
      
      editor.render();
      
      const startTime = Date.now();
      
      // Bulk operation
      editor.bulkOperation(() => {
        for (let i = 0; i < 100; i++) {
          editor.addNode('items', { id: i, name: `Item ${i}` });
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Should be faster than individual operations
      expect(duration).toBeLessThan(500);
      
      const content = JSON.parse(editor.getContent());
      expect(content.items).toHaveLength(100);
      
      editor.destroy();
    });
  });
});