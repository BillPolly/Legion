/**
 * Inline Editing Tests
 */
import { createTestContainer, cleanupTestContainer, createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('Inline Editing', () => {
  let HierarchyTreeView;
  let container;
  let treeView;
  let testNode;

  beforeEach(async () => {
    const module = await import('../../../view/HierarchyTreeView.js');
    HierarchyTreeView = module.HierarchyTreeView;
    
    container = createTestContainer();
    treeView = new HierarchyTreeView(container);
    testNode = createTestNode('value', 'testKey', 'testValue');
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Edit Mode Activation', () => {
    test('should enter edit mode on double-click', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      const valueSpan = element.querySelector('.node-value');
      expect(valueSpan.textContent).toBe('testValue');
      
      // Simulate double-click
      const doubleClickEvent = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true
      });
      valueSpan.dispatchEvent(doubleClickEvent);
      
      // Should create inline editor
      const editor = element.querySelector('.inline-editor');
      expect(editor).toBeDefined();
      expect(editor.tagName).toBe('INPUT');
      expect(editor.value).toBe('testValue');
    });

    test('should focus and select text in edit mode', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      treeView.startInlineEdit(testNode.id, element);
      
      const editor = element.querySelector('.inline-editor');
      expect(editor).toBeDefined();
      expect(document.activeElement).toBe(editor);
      expect(editor.selectionStart).toBe(0);
      expect(editor.selectionEnd).toBe(editor.value.length);
    });

    test('should handle edit mode for different value types', () => {
      const stringNode = createTestNode('value', 'str', 'hello');
      const numberNode = createTestNode('value', 'num', 42);
      const booleanNode = createTestNode('value', 'bool', true);
      const nullNode = createTestNode('value', 'null', null);
      
      const stringElement = treeView.renderNode(stringNode);
      const numberElement = treeView.renderNode(numberNode);
      const booleanElement = treeView.renderNode(booleanNode);
      const nullElement = treeView.renderNode(nullNode);
      
      container.appendChild(stringElement);
      container.appendChild(numberElement);
      container.appendChild(booleanElement);
      container.appendChild(nullElement);
      
      // Test string editing
      treeView.startInlineEdit(stringNode.id, stringElement);
      let editor = stringElement.querySelector('.inline-editor');
      expect(editor.value).toBe('hello');
      treeView.cancelEdit(stringNode.id, 'hello');
      
      // Test number editing
      treeView.startInlineEdit(numberNode.id, numberElement);
      editor = numberElement.querySelector('.inline-editor');
      expect(editor.value).toBe('42');
      treeView.cancelEdit(numberNode.id, '42');
      
      // Test boolean editing
      treeView.startInlineEdit(booleanNode.id, booleanElement);
      editor = booleanElement.querySelector('.inline-editor');
      expect(editor.value).toBe('true');
      treeView.cancelEdit(booleanNode.id, 'true');
      
      // Test null editing
      treeView.startInlineEdit(nullNode.id, nullElement);
      editor = nullElement.querySelector('.inline-editor');
      expect(editor.value).toBe('null');
      treeView.cancelEdit(nullNode.id, 'null');
    });

    test('should prevent edit mode for non-value nodes', () => {
      const objectNode = createTestNode('object', 'obj', null);
      const arrayNode = createTestNode('array', 'arr', null);
      
      const objectElement = treeView.renderNode(objectNode);
      const arrayElement = treeView.renderNode(arrayNode);
      
      container.appendChild(objectElement);
      container.appendChild(arrayElement);
      
      // Try to start edit mode on object node
      const result1 = treeView.startInlineEdit(objectNode.id, objectElement);
      expect(result1).toBe(false);
      expect(objectElement.querySelector('.inline-editor')).toBeNull();
      
      // Try to start edit mode on array node
      const result2 = treeView.startInlineEdit(arrayNode.id, arrayElement);
      expect(result2).toBe(false);
      expect(arrayElement.querySelector('.inline-editor')).toBeNull();
    });

    test('should handle edit UI creation properly', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      const originalValueSpan = element.querySelector('.node-value');
      const originalText = originalValueSpan.textContent;
      
      treeView.startInlineEdit(testNode.id, element);
      
      // Original value span should be replaced
      expect(element.querySelector('.node-value')).toBeNull();
      
      // Editor should be present
      const editor = element.querySelector('.inline-editor');
      expect(editor).toBeDefined();
      expect(editor.value).toBe(originalText);
      expect(editor.type).toBe('text');
    });

    test('should prevent multiple simultaneous edits', () => {
      const node1 = createTestNode('value', 'key1', 'value1');
      const node2 = createTestNode('value', 'key2', 'value2');
      
      const element1 = treeView.renderNode(node1);
      const element2 = treeView.renderNode(node2);
      
      container.appendChild(element1);
      container.appendChild(element2);
      
      // Start edit on first node
      treeView.startInlineEdit(node1.id, element1);
      expect(element1.querySelector('.inline-editor')).toBeDefined();
      
      // Try to start edit on second node
      const result = treeView.startInlineEdit(node2.id, element2);
      expect(result).toBe(false);
      expect(element2.querySelector('.inline-editor')).toBeNull();
      
      // First editor should still exist
      expect(element1.querySelector('.inline-editor')).toBeDefined();
    });
  });

  describe('Edit Operations', () => {
    test('should commit edit on Enter key', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let emittedData = null;
      treeView.on('nodeValueChanged', (data) => {
        emittedData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      // Change value and press Enter
      editor.value = 'newValue';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      // Should emit change event
      expect(emittedData).toBeDefined();
      expect(emittedData.nodeId).toBe(testNode.id);
      expect(emittedData.oldValue).toBe('testValue');
      expect(emittedData.newValue).toBe('newValue');
    });

    test('should cancel edit on Escape key', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let emittedData = null;
      treeView.on('nodeValueChanged', (data) => {
        emittedData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      // Change value and press Escape
      editor.value = 'cancelledValue';
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      editor.dispatchEvent(escapeEvent);
      
      // Should not emit change event
      expect(emittedData).toBeNull();
      
      // Should restore original value
      const valueSpan = element.querySelector('.node-value');
      expect(valueSpan.textContent).toBe('testValue');
    });

    test('should commit edit on blur', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let emittedData = null;
      treeView.on('nodeValueChanged', (data) => {
        emittedData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      // Change value and blur
      editor.value = 'blurredValue';
      const blurEvent = new FocusEvent('blur', {
        bubbles: true
      });
      editor.dispatchEvent(blurEvent);
      
      // Should emit change event
      expect(emittedData).toBeDefined();
      expect(emittedData.nodeId).toBe(testNode.id);
      expect(emittedData.newValue).toBe('blurredValue');
    });

    test('should validate edit values', () => {
      const numberNode = createTestNode('value', 'num', 42);
      const element = treeView.renderNode(numberNode);
      container.appendChild(element);
      
      let emittedData = null;
      treeView.on('nodeValueChanged', (data) => {
        emittedData = data;
      });
      
      treeView.startInlineEdit(numberNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      // Try to set invalid number
      editor.value = 'not-a-number';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      // Should still emit event but with validation info
      expect(emittedData).toBeDefined();
      expect(emittedData.nodeId).toBe(numberNode.id);
      expect(emittedData.newValue).toBe('not-a-number');
      expect(emittedData.valid).toBe(false);
    });

    test('should handle empty values', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let emittedData = null;
      treeView.on('nodeValueChanged', (data) => {
        emittedData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      // Set empty value
      editor.value = '';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      // Should emit change event
      expect(emittedData).toBeDefined();
      expect(emittedData.newValue).toBe('');
    });
  });

  describe('Edit Event Flow', () => {
    test('should emit edit start event', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let startEventData = null;
      treeView.on('editStart', (data) => {
        startEventData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      
      expect(startEventData).toBeDefined();
      expect(startEventData.nodeId).toBe(testNode.id);
      expect(startEventData.originalValue).toBe('testValue');
    });

    test('should emit edit end event on commit', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let endEventData = null;
      treeView.on('editEnd', (data) => {
        endEventData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      editor.value = 'newValue';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      expect(endEventData).toBeDefined();
      expect(endEventData.nodeId).toBe(testNode.id);
      expect(endEventData.committed).toBe(true);
    });

    test('should emit edit end event on cancel', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let endEventData = null;
      treeView.on('editEnd', (data) => {
        endEventData = data;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      editor.dispatchEvent(escapeEvent);
      
      expect(endEventData).toBeDefined();
      expect(endEventData.nodeId).toBe(testNode.id);
      expect(endEventData.committed).toBe(false);
    });

    test('should maintain edit state tracking', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      // Initially not editing
      expect(treeView.isEditing()).toBe(false);
      expect(treeView.getEditingNodeId()).toBeNull();
      
      // Start editing
      treeView.startInlineEdit(testNode.id, element);
      expect(treeView.isEditing()).toBe(true);
      expect(treeView.getEditingNodeId()).toBe(testNode.id);
      
      // End editing
      const editor = element.querySelector('.inline-editor');
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      expect(treeView.isEditing()).toBe(false);
      expect(treeView.getEditingNodeId()).toBeNull();
    });

    test('should handle model updates from edits', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      let updateEventData = null;
      treeView.on('nodeValueChanged', (data) => {
        updateEventData = data;
        // Simulate model update
        testNode.value = data.newValue;
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      editor.value = 'updatedValue';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      // Check that model was updated
      expect(testNode.value).toBe('updatedValue');
      expect(updateEventData.newValue).toBe('updatedValue');
    });

    test('should synchronize view after edit', () => {
      const element = treeView.renderNode(testNode);
      container.appendChild(element);
      
      treeView.on('nodeValueChanged', (data) => {
        // Simulate model update and view refresh
        testNode.value = data.newValue;
        treeView.refreshNode(testNode.id, element);
      });
      
      treeView.startInlineEdit(testNode.id, element);
      const editor = element.querySelector('.inline-editor');
      
      editor.value = 'syncedValue';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      editor.dispatchEvent(enterEvent);
      
      // Check that view shows updated value
      const valueSpan = element.querySelector('.node-value');
      expect(valueSpan.textContent).toBe('syncedValue');
    });
  });
});