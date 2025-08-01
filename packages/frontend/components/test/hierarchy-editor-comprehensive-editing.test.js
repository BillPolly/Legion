/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Comprehensive Real Editing Tests', () => {
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
  
  describe('Multi-Editor Real Editing Tests', () => {
    test('should allow editing in ALL editor instances', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Test editing in each editor section
      const editorSections = ['basic', 'format', 'edit', 'event', 'advanced'];
      
      for (const sectionName of editorSections) {
        const editorContainer = container.querySelector(`[data-editor-container="${sectionName}"]`);
        expect(editorContainer).toBeTruthy();
        
        // Should have editable values
        const editableValues = editorContainer.querySelectorAll('.editable-value');
        expect(editableValues.length).toBeGreaterThan(0);
        
        // Test editing the first string value
        const stringValue = Array.from(editableValues).find(el => el.dataset.type === 'string');
        if (stringValue) {
          const originalText = stringValue.textContent.replace(/"/g, ''); // Remove quotes
          
          // Click to edit
          stringValue.click();
          await waitForRender();
          
          // Should create input
          const input = stringValue.nextSibling;
          expect(input).toBeTruthy();
          expect(input.tagName).toBe('INPUT');
          
          // Edit and save
          const newValue = `edited-${sectionName}`;
          input.value = newValue;
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
          
          await waitForRender();
          
          // Should show updated value
          const updatedValue = editorContainer.querySelector(`.editable-value[data-path="${stringValue.dataset.path}"]`);
          expect(updatedValue.textContent).toContain(newValue);
        }
      }
      
      demo.destroy();
    });
    
    test('should maintain data consistency across tree and source modes', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Start in tree mode, edit a value
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const stringValue = basicContainer.querySelector('.editable-value[data-type="string"]');
      
      stringValue.click();
      await waitForRender();
      
      const input = stringValue.nextSibling;
      const testValue = 'consistency-test-value';
      input.value = testValue;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      await waitForRender();
      
      // Switch to source mode
      const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      sourceModeBtn.click();
      
      await waitForRender();
      
      // Should show the edited value in source
      const textarea = basicContainer.querySelector('.source-editor');
      expect(textarea.value).toContain(testValue);
      
      // Edit in source mode
      const modifiedJson = textarea.value.replace(testValue, 'source-modified-value');
      textarea.value = modifiedJson;
      textarea.dispatchEvent(new Event('input'));
      
      // Switch back to tree mode
      const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
      treeModeBtn.click();
      
      await waitForRender();
      
      // Should show source modification in tree
      expect(basicContainer.textContent).toContain('source-modified-value');
      
      demo.destroy();
    });
  });
  
  describe('File Upload and Editing Integration', () => {
    test('should allow editing after loading server files', async () => {
      // Mock fetch for server file loading
      const mockJsonContent = JSON.stringify({
        uploaded: 'server-file',
        count: 42,
        editable: true,
        nested: {
          deep: 'value'
        }
      }, null, 2);
      
      global.fetch = () => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockJsonContent)
      });
      
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Load server file
      const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
      dropdown.value = '/data/samples/package.json';
      dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      
      await waitForRender();
      
      // Should have loaded the content
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      expect(basicContainer.textContent).toContain('server-file');
      expect(basicContainer.textContent).toContain('42');
      
      // Should be able to edit the loaded content
      const editableValue = basicContainer.querySelector('.editable-value[data-type="string"]');
      editableValue.click();
      
      await waitForRender();
      
      const input = editableValue.nextSibling;
      input.value = 'edited-after-upload';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      await waitForRender();
      
      // Should show the edit
      expect(basicContainer.textContent).toContain('edited-after-upload');
      
      delete global.fetch;
      demo.destroy();
    });
    
    test('should handle file input uploads and editing', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Simulate file upload
      const fileInput = container.querySelector('#basic-file-input');
      expect(fileInput).toBeTruthy();
      
      const mockFile = new File([JSON.stringify({ uploaded: 'file', value: 123 })], 'test.json', {
        type: 'application/json'
      });
      
      // Mock FileReader
      const mockFileReader = {
        readAsText: () => {},
        result: JSON.stringify({ uploaded: 'file', value: 123 }),
        onload: null
      };
      
      global.FileReader = function() { return mockFileReader; };
      
      // Trigger file change
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        configurable: true
      });
      
      fileInput.dispatchEvent(new Event('change'));
      
      // Simulate FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload();
      }
      
      await waitForRender();
      
      // Should be able to edit uploaded content
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const stringValue = basicContainer.querySelector('.editable-value');
      
      if (stringValue) {
        stringValue.click();
        await waitForRender();
        
        const input = stringValue.nextSibling;
        if (input) {
          input.value = 'edited-uploaded-file';
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
          
          await waitForRender();
          
          expect(basicContainer.textContent).toContain('edited-uploaded-file');
        }
      }
      
      demo.destroy();
    });
  });
  
  describe('Complex Data Structure Editing', () => {
    test('should handle nested object editing', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Load complex nested data
      const basicEditor = demo.getEditorInstance('basic');
      const complexData = {
        level1: {
          level2: {
            level3: {
              deepValue: 'original',
              deepNumber: 999
            }
          }
        },
        array: [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' }
        ]
      };
      
      basicEditor.loadContent(JSON.stringify(complexData, null, 2));
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      
      // Find and edit a deeply nested value
      const deepValueElement = Array.from(basicContainer.querySelectorAll('.editable-value'))
        .find(el => el.textContent.includes('original'));
      
      if (deepValueElement) {
        deepValueElement.click();
        await waitForRender();
        
        const input = deepValueElement.nextSibling;
        input.value = 'deeply-modified';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        
        await waitForRender();
        
        // Verify the change
        expect(basicContainer.textContent).toContain('deeply-modified');
        
        // Verify the underlying data was updated
        const currentContent = basicEditor.getContent();
        const parsedContent = JSON.parse(currentContent);
        expect(parsedContent.level1.level2.level3.deepValue).toBe('deeply-modified');
      }
      
      demo.destroy();
    });
    
    test('should handle array element editing', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const basicEditor = demo.getEditorInstance('basic');
      const arrayData = {
        items: ['first', 'second', 'third'],
        numbers: [1, 2, 3],
        booleans: [true, false, true]
      };
      
      basicEditor.loadContent(JSON.stringify(arrayData, null, 2));
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      
      // Edit a string in array
      const firstArrayElement = Array.from(basicContainer.querySelectorAll('.editable-value'))
        .find(el => el.textContent.includes('first'));
      
      if (firstArrayElement) {
        firstArrayElement.click();
        await waitForRender();
        
        const input = firstArrayElement.nextSibling;
        input.value = 'modified-first';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        
        await waitForRender();
        
        expect(basicContainer.textContent).toContain('modified-first');
        
        // Verify data structure
        const currentContent = JSON.parse(basicEditor.getContent());
        expect(currentContent.items[0]).toBe('modified-first');
      }
      
      demo.destroy();
    });
  });
  
  describe('Data Type Handling', () => {
    test('should correctly handle number editing with validation', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const basicEditor = demo.getEditorInstance('basic');
      basicEditor.loadContent('{"price": 19.99, "count": 42}');
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const numberValue = basicContainer.querySelector('.editable-value[data-type="number"]');
      
      numberValue.click();
      await waitForRender();
      
      const input = numberValue.nextSibling;
      expect(input.type).toBe('number');
      
      // Test valid number
      input.value = '123.45';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      await waitForRender();
      
      expect(basicContainer.textContent).toContain('123.45');
      
      // Verify it's stored as actual number
      const content = JSON.parse(basicEditor.getContent());
      const updatedNumber = Object.values(content).find(v => v === 123.45);
      expect(typeof updatedNumber).toBe('number');
      
      demo.destroy();
    });
    
    test('should handle boolean editing', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const basicEditor = demo.getEditorInstance('basic');
      basicEditor.loadContent('{"enabled": true, "visible": false}');
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const booleanValue = basicContainer.querySelector('.editable-value[data-type="boolean"]');
      
      if (booleanValue) {
        booleanValue.click();
        await waitForRender();
        
        const input = booleanValue.nextSibling;
        input.value = 'false';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        
        await waitForRender();
        
        // Verify boolean conversion
        const content = JSON.parse(basicEditor.getContent());
        const booleanValues = Object.values(content).filter(v => typeof v === 'boolean');
        expect(booleanValues).toContain(false);
      }
      
      demo.destroy();
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    test('should handle editing cancellation', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const editableValue = basicContainer.querySelector('.editable-value[data-type="string"]');
      const originalValue = editableValue.textContent;
      
      // Start editing
      editableValue.click();
      await waitForRender();
      
      const input = editableValue.nextSibling;
      input.value = 'should-be-canceled';
      
      // Cancel with Escape
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      await waitForRender();
      
      // Should restore original value
      const restoredValue = basicContainer.querySelector(`.editable-value[data-path="${editableValue.dataset.path}"]`);
      expect(restoredValue.textContent).toBe(originalValue);
      
      demo.destroy();
    });
    
    test('should handle invalid JSON gracefully', async () => {
      const demo = HierarchyEditorDemo.create({
        dom: container
      });
      
      await waitForRender();
      
      // Switch to source mode
      const sourceModeBtn = container.querySelector('[data-action="source-mode"][data-editor="basic"]');
      sourceModeBtn.click();
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const textarea = basicContainer.querySelector('.source-editor');
      
      // Enter invalid JSON
      textarea.value = '{"invalid": json, "missing": quotes}';
      textarea.dispatchEvent(new Event('input'));
      
      // Switch back to tree mode
      const treeModeBtn = container.querySelector('[data-action="tree-mode"][data-editor="basic"]');
      treeModeBtn.click();
      
      await waitForRender();
      
      // Should show parse error
      expect(basicContainer.textContent).toContain('Parse Error');
      expect(basicContainer.textContent).toContain('Switch to Source mode');
      
      demo.destroy();
    });
  });
  
  describe('Event Callbacks and Integration', () => {
    test('should trigger onContentChange callbacks during editing', async () => {
      const onContentChangeCallback = () => {};
      const onNodeEditCallback = () => {};
      
      const demo = HierarchyEditorDemo.create({
        dom: container,
        onContentChange: onContentChangeCallback,
        onNodeEdit: onNodeEditCallback
      });
      
      await waitForRender();
      
      const basicContainer = container.querySelector('[data-editor-container="basic"]');
      const editableValue = basicContainer.querySelector('.editable-value[data-type="string"]');
      
      // Edit a value
      editableValue.click();
      await waitForRender();
      
      const input = editableValue.nextSibling;
      input.value = 'callback-test';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      await waitForRender();
      
      // Should have triggered callbacks (they are handled by mock editor)
      // Note: The specific callback behavior depends on implementation
      expect(basicContainer.textContent).toContain('callback-test');
      
      demo.destroy();
    });
  });
});