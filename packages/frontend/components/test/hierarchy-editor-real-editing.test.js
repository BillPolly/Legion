/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Real Editing Tests', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 100));
  
  test('should render real editor with clickable values', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Should show "Live Editor" not "Mock Editor"
    const editorHeader = container.querySelector('.real-editor');
    expect(editorHeader).toBeTruthy();
    expect(editorHeader.textContent).toContain('Live Editor');
    expect(editorHeader.textContent).toContain('Click values to edit!');
    
    // Should have editable values
    const editableValues = container.querySelectorAll('.editable-value');
    expect(editableValues.length).toBeGreaterThan(0);
    
    // Each editable value should have proper attributes
    editableValues.forEach(value => {
      expect(value.dataset.path).toBeDefined();
      expect(value.dataset.type).toBeDefined();
      expect(value.title).toBe('Click to edit');
      expect(value.style.cursor).toBe('pointer');
    });
    
    demo.destroy();
  });
  
  test('should actually edit values when clicked', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Find an editable value
    const editableValue = container.querySelector('.editable-value[data-type="string"]');
    expect(editableValue).toBeTruthy();
    
    const originalValue = editableValue.textContent;
    
    // Click to start editing
    editableValue.click();
    
    await waitForRender();
    
    // Should create an input field
    const input = editableValue.nextSibling;
    expect(input).toBeTruthy();
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('text');
    
    // Change the value
    const newValue = 'Modified Value';
    input.value = newValue;
    
    // Simulate pressing Enter to save
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(enterEvent);
    
    await waitForRender();
    
    // Should update the display
    const updatedValue = container.querySelector(`.editable-value[data-path="${editableValue.dataset.path}"]`);
    expect(updatedValue.textContent).toContain(newValue);
    
    demo.destroy();
  });
  
  test('should work in source mode with textarea', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Switch to source mode
    const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
    sourceModeBtn.click();
    
    await waitForRender();
    
    // Should have a textarea
    const textarea = container.querySelector('.source-editor');
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe('TEXTAREA');
    
    // Should contain JSON content
    expect(textarea.value).toContain('{');
    expect(textarea.value).toContain('}');
    
    // Should be editable
    const newContent = '{"test": "modified content"}';
    textarea.value = newContent;
    
    // Trigger input event
    const inputEvent = new Event('input');
    textarea.dispatchEvent(inputEvent);
    
    // Switch back to tree mode to see changes
    const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
    treeModeBtn.click();
    
    await waitForRender();
    
    // Should show the modified content
    const treeView = container.querySelector('.tree-view');
    expect(treeView.textContent).toContain('test');
    expect(treeView.textContent).toContain('modified content');
    
    demo.destroy();
  });
  
  test('should handle number and boolean editing', async () => {
    // Load content with numbers and booleans
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load sample content with different types
    const editor = demo.getEditorInstance('basic');
    editor.loadContent('{"count": 42, "enabled": true, "name": "test"}');
    
    await waitForRender();
    
    // Find number field
    const numberValue = container.querySelector('.editable-value[data-type="number"]');
    if (numberValue) {
      numberValue.click();
      await waitForRender();
      
      const numberInput = numberValue.nextSibling;
      expect(numberInput.type).toBe('number');
      
      numberInput.value = '100';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      numberInput.dispatchEvent(enterEvent);
      
      await waitForRender();
      
      // Should update to new number
      const updatedNumber = container.querySelector(`.editable-value[data-path="${numberValue.dataset.path}"]`);
      expect(updatedNumber.textContent).toBe('100');
    }
    
    demo.destroy();
  });
  
  test('should validate JSON and show parse errors', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Switch to source mode and enter invalid JSON
    const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
    sourceModeBtn.click();
    
    await waitForRender();
    
    const textarea = container.querySelector('.source-editor');
    textarea.value = '{"invalid": json}'; // Missing quotes
    textarea.dispatchEvent(new Event('input'));
    
    // Switch back to tree mode
    const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
    treeModeBtn.click();
    
    await waitForRender();
    
    // Should show parse error
    const errorDisplay = container.querySelector('[data-editor-container="basic"]');
    expect(errorDisplay.textContent).toContain('Parse Error');
    
    demo.destroy();
  });
});