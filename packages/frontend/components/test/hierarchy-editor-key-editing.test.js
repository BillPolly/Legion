/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Key Editing Tests', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = '800px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 150));
  
  test('should show actual key name when editing keys', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load test data with a specific key
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "originalKey": "some value",
      "anotherKey": {
        "nestedKey": "nested value"
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Find an editable key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="originalKey"]');
    expect(editableKey).toBeTruthy();
    expect(editableKey.textContent).toContain('originalKey');
    
    // Click to edit the key
    editableKey.click();
    await waitForRender();
    
    // Should create input with the key name, not the value
    const input = editableKey.nextSibling;
    expect(input).toBeTruthy();
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('originalKey'); // Should be key name, not "some value"
    
    demo.destroy();
  });
  
  test('should rename top-level key correctly', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "oldName": "test value",
      "keepThis": "unchanged"
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Edit the key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="oldName"]');
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    input.value = 'newName';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check the updated JSON structure
    const updatedContent = JSON.parse(basicEditor.getContent());
    expect(updatedContent).toEqual({
      "newName": "test value",
      "keepThis": "unchanged"
    });
    
    // Should not have the old key
    expect(updatedContent.oldName).toBeUndefined();
    
    demo.destroy();
  });
  
  test('should rename nested key correctly', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "parent": {
        "oldNestedKey": "nested value",
        "siblingKey": "sibling value"
      },
      "topLevel": "top value"
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Edit the nested key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="parent.oldNestedKey"]');
    expect(editableKey).toBeTruthy();
    
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    expect(input.value).toBe('oldNestedKey');
    
    input.value = 'newNestedKey';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check the updated JSON structure
    const updatedContent = JSON.parse(basicEditor.getContent());
    expect(updatedContent).toEqual({
      "parent": {
        "newNestedKey": "nested value",
        "siblingKey": "sibling value"
      },
      "topLevel": "top value"
    });
    
    // Should not have the old key
    expect(updatedContent.parent.oldNestedKey).toBeUndefined();
    
    demo.destroy();
  });
  
  test('should preserve key order when renaming', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "first": "1",
      "second": "2", 
      "third": "3",
      "fourth": "4"
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Rename the second key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="second"]');
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    input.value = 'renamedSecond';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check that key order is preserved
    const updatedContent = JSON.parse(basicEditor.getContent());
    const keys = Object.keys(updatedContent);
    expect(keys).toEqual(['first', 'renamedSecond', 'third', 'fourth']);
    
    // Values should be correct
    expect(updatedContent.renamedSecond).toBe('2');
    
    demo.destroy();
  });
  
  test('should handle deeply nested key renaming', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "level1": {
        "level2": {
          "level3": {
            "deepKey": "deep value",
            "anotherDeep": "another deep"
          }
        }
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Rename deeply nested key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="level1.level2.level3.deepKey"]');
    expect(editableKey).toBeTruthy();
    
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    expect(input.value).toBe('deepKey');
    
    input.value = 'superDeepKey';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check the updated structure
    const updatedContent = JSON.parse(basicEditor.getContent());
    expect(updatedContent.level1.level2.level3.superDeepKey).toBe('deep value');
    expect(updatedContent.level1.level2.level3.deepKey).toBeUndefined();
    expect(updatedContent.level1.level2.level3.anotherDeep).toBe('another deep');
    
    demo.destroy();
  });
  
  test('should prevent renaming to existing key name', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "existingKey": "existing value",
      "targetKey": "target value"
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Try to rename targetKey to existingKey
    const editableKey = basicContainer.querySelector('.editable-key[data-path="targetKey"]');
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    input.value = 'existingKey';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Should not have changed - both keys should still exist
    const updatedContent = JSON.parse(basicEditor.getContent());
    expect(updatedContent.existingKey).toBe('existing value');
    expect(updatedContent.targetKey).toBe('target value');
    
    demo.destroy();
  });
  
  test('should handle array index paths correctly', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "items": [
        { "oldKey": "array value" },
        { "normalKey": "normal value" }
      ]
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Find the key inside the array
    const editableKey = basicContainer.querySelector('.editable-key[data-path="items[0].oldKey"]');
    expect(editableKey).toBeTruthy();
    
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    expect(input.value).toBe('oldKey');
    
    input.value = 'newArrayKey';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check the updated structure
    const updatedContent = JSON.parse(basicEditor.getContent());
    expect(updatedContent.items[0].newArrayKey).toBe('array value');
    expect(updatedContent.items[0].oldKey).toBeUndefined();
    expect(updatedContent.items[1].normalKey).toBe('normal value');
    
    demo.destroy();
  });
  
  test('should update visual display after key rename', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "visualTest": "check display update"
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Rename the key
    const editableKey = basicContainer.querySelector('.editable-key[data-path="visualTest"]');
    editableKey.click();
    await waitForRender();
    
    const input = editableKey.nextSibling;
    input.value = 'renamedVisualTest';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // Check that the display was updated
    const renamedKey = basicContainer.querySelector('.editable-key[data-path="renamedVisualTest"]');
    expect(renamedKey).toBeTruthy();
    expect(renamedKey.textContent).toContain('renamedVisualTest');
    
    // Old key should no longer exist in DOM
    const oldKey = basicContainer.querySelector('.editable-key[data-path="visualTest"]');
    expect(oldKey).toBeFalsy();
    
    demo.destroy();
  });
});