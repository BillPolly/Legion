/**
 * Error Handling Integration Tests
 */
import { createTestContainer, cleanupTestContainer } from '../test-helpers.js';

describe('Error Handling', () => {
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

  describe('Invalid Input Handling', () => {
    test('should handle invalid initial content gracefully', () => {
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
        content: '{invalid json}',
        error: expect.any(Error),
        recoverable: true
      });
      
      // Should show error state
      expect(container.querySelector('.error-state')).toBeTruthy();
      expect(container.querySelector('.error-message')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should handle null/undefined content', () => {
      const editor1 = HierarchyEditor.create({
        dom: container,
        content: null,
        format: 'json'
      });
      
      editor1.render();
      
      // Should show empty state
      expect(container.querySelector('.empty-state')).toBeTruthy();
      
      editor1.destroy();
      
      const editor2 = HierarchyEditor.create({
        dom: container,
        content: undefined,
        format: 'json'
      });
      
      editor2.render();
      
      // Should show empty state
      expect(container.querySelector('.empty-state')).toBeTruthy();
      
      editor2.destroy();
    });
    
    test('should handle invalid format specifications', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'invalid-format',
        onError
      });
      
      editor.render();
      
      expect(onError).toHaveBeenCalledWith({
        type: 'format-error',
        message: expect.stringContaining('Unsupported format'),
        format: 'invalid-format',
        supportedFormats: ['json', 'xml', 'yaml', 'markdown']
      });
      
      editor.destroy();
    });
    
    test('should handle corrupt data structures', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"circular": null}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Create circular reference
      const data = JSON.parse(editor.getContent());
      data.circular = data;
      
      // Try to set circular data
      expect(() => editor.setContent(data)).not.toThrow();
      
      expect(onError).toHaveBeenCalledWith({
        type: 'data-error',
        message: expect.stringContaining('circular'),
        recoverable: true
      });
      
      editor.destroy();
    });
  });
  
  describe('Parse Error Recovery', () => {
    test('should recover from JSON parse errors', () => {
      const onError = jest.fn();
      const onRecovery = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{broken: json}',
        format: 'json',
        onError,
        onRecovery
      });
      
      editor.render();
      
      // Should be in error state
      expect(container.querySelector('.error-state')).toBeTruthy();
      
      // Load valid content
      editor.loadContent('{"valid": true}');
      
      // Should recover
      expect(container.querySelector('.error-state')).toBeFalsy();
      expect(container.querySelector('.tree-view')).toBeTruthy();
      
      expect(onRecovery).toHaveBeenCalledWith({
        fromError: 'parse-error',
        newContent: '{"valid": true}',
        newFormat: 'json'
      });
      
      editor.destroy();
    });
    
    test('should recover from XML parse errors', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '<invalid><xml',
        format: 'xml'
      });
      
      editor.render();
      
      // Should show error
      expect(container.querySelector('.error-state')).toBeTruthy();
      
      // Load valid XML
      editor.loadContent('<root><valid>true</valid></root>');
      
      // Should recover
      expect(container.querySelector('.tree-view')).toBeTruthy();
      expect(editor.getContent()).toContain('<valid>true</valid>');
      
      editor.destroy();
    });
    
    test('should recover from YAML parse errors', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: 'invalid:\n  - yaml\n  bad indentation',
        format: 'yaml'
      });
      
      editor.render();
      
      // Should show error
      expect(container.querySelector('.error-state')).toBeTruthy();
      
      // Load valid YAML
      editor.loadContent('valid:\n  - yaml\n  - content');
      
      // Should recover
      expect(container.querySelector('.tree-view')).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should provide error suggestions', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"key": "value",}', // Trailing comma
        format: 'json',
        showErrorSuggestions: true
      });
      
      editor.render();
      
      const errorEl = container.querySelector('.error-state');
      const suggestion = errorEl.querySelector('.error-suggestion');
      
      expect(suggestion).toBeTruthy();
      expect(suggestion.textContent).toContain('trailing comma');
      
      editor.destroy();
    });
  });
  
  describe('Edit Validation Errors', () => {
    test('should handle validation errors during edit', () => {
      const onValidationError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"age": 25, "email": "test@example.com"}',
        format: 'json',
        onValidationError,
        validators: {
          age: (value) => {
            if (typeof value !== 'number' || value < 0) {
              return { valid: false, error: 'Age must be a positive number' };
            }
            return { valid: true };
          },
          email: (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              return { valid: false, error: 'Invalid email format' };
            }
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // Invalid age
      const result1 = editor.editNode('age', 'not a number');
      expect(result1).toBe(false);
      
      expect(onValidationError).toHaveBeenCalledWith({
        path: 'age',
        value: 'not a number',
        error: 'Age must be a positive number',
        validator: 'age'
      });
      
      // Invalid email
      const result2 = editor.editNode('email', 'invalid-email');
      expect(result2).toBe(false);
      
      expect(onValidationError).toHaveBeenCalledWith({
        path: 'email',
        value: 'invalid-email',
        error: 'Invalid email format',
        validator: 'email'
      });
      
      // Content should remain unchanged
      const content = JSON.parse(editor.getContent());
      expect(content.age).toBe(25);
      expect(content.email).toBe('test@example.com');
      
      editor.destroy();
    });
    
    test('should show inline validation errors', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"url": "https://example.com"}',
        format: 'json',
        showInlineErrors: true,
        validators: {
          url: (value) => {
            try {
              new URL(value);
              return { valid: true };
            } catch {
              return { valid: false, error: 'Invalid URL' };
            }
          }
        }
      });
      
      editor.render();
      
      // Start inline edit
      editor.startInlineEdit('url');
      
      // Enter invalid URL
      const inputEl = container.querySelector('.inline-editor input');
      inputEl.value = 'not-a-url';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Should show inline error
      const errorEl = container.querySelector('.inline-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toBe('Invalid URL');
      
      editor.destroy();
    });
    
    test('should handle async validators', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"username": "john"}',
        format: 'json',
        validators: {
          username: async (value) => {
            // Simulate API check
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (value === 'taken') {
              return { valid: false, error: 'Username already taken' };
            }
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // Valid username
      const result1 = await editor.editNode('username', 'available');
      expect(result1).toBe(true);
      
      // Taken username
      const result2 = await editor.editNode('username', 'taken');
      expect(result2).toBe(false);
      
      // Should show loading state during async validation
      editor.startInlineEdit('username');
      const inputEl = container.querySelector('.inline-editor input');
      inputEl.value = 'checking';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Should show loading indicator
      expect(container.querySelector('.validation-loading')).toBeTruthy();
      
      editor.destroy();
    });
  });
  
  describe('Operation Error Handling', () => {
    test('should handle node addition errors', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"readOnly": [1, 2, 3]}',
        format: 'json',
        onError,
        validators: {
          readOnly: () => ({ valid: false, error: 'This array is read-only' })
        }
      });
      
      editor.render();
      
      // Try to add to read-only array
      const result = editor.addNode('readOnly', 4);
      expect(result).toBe(false);
      
      expect(onError).toHaveBeenCalledWith({
        type: 'operation-error',
        operation: 'add',
        path: 'readOnly',
        error: expect.objectContaining({ message: 'This array is read-only' }),
        recoverable: true
      });
      
      editor.destroy();
    });
    
    test('should handle node deletion errors', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"required": "value", "optional": "value"}',
        format: 'json',
        onError,
        requiredPaths: ['required']
      });
      
      editor.render();
      
      // Try to delete required node
      const result = editor.deleteNode('required');
      expect(result).toBe(false);
      
      expect(onError).toHaveBeenCalledWith({
        type: 'operation-error',
        operation: 'delete',
        path: 'required',
        error: expect.objectContaining({ message: expect.stringContaining('required') }),
        recoverable: true
      });
      
      // Optional node should be deletable
      const result2 = editor.deleteNode('optional');
      expect(result2).toBe(true);
      
      editor.destroy();
    });
    
    test('should handle move operation errors', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"source": ["item"], "target": null}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Try to move to null target
      const result = editor.moveNode('source.0', 'target', 0);
      expect(result).toBe(false);
      
      expect(onError).toHaveBeenCalledWith({
        type: 'operation-error',
        operation: 'move',
        fromPath: 'source.0',
        toPath: 'target',
        error: expect.any(Error),
        recoverable: true
      });
      
      editor.destroy();
    });
    
    test('should handle circular reference prevention', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"parent": {"child": {"grandchild": {}}}}',
        format: 'json',
        onError
      });
      
      editor.render();
      
      // Try to move parent into its own child
      const result = editor.moveNode('parent', 'parent.child', 0);
      expect(result).toBe(false);
      
      expect(onError).toHaveBeenCalledWith({
        type: 'operation-error',
        operation: 'move',
        error: expect.objectContaining({ message: expect.stringContaining('circular') }),
        recoverable: true
      });
      
      editor.destroy();
    });
  });
  
  describe('Source Mode Error Handling', () => {
    test('should handle source validation errors', async () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"valid": true}',
        format: 'json',
        onError
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Enter invalid JSON
      editor.setContent('{invalid json}');
      
      // Should show error indicator
      expect(container.querySelector('.source-error')).toBeTruthy();
      
      // Try to switch to tree mode
      const result = await editor.setMode('tree');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      expect(onError).toHaveBeenCalledWith({
        type: 'mode-switch-error',
        fromMode: 'source',
        toMode: 'tree',
        reason: 'invalid-content',
        error: expect.any(Error)
      });
      
      editor.destroy();
    });
    
    test('should provide real-time syntax error feedback', async () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        realtimeValidation: true
      });
      
      editor.render();
      await editor.setMode('source');
      
      // Type invalid JSON
      const sourceEl = container.querySelector('.source-editor [contenteditable]');
      sourceEl.textContent = '{"test": true,}'; // Trailing comma
      sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Should show error marker
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errorMarker = container.querySelector('.syntax-error-marker');
      expect(errorMarker).toBeTruthy();
      
      editor.destroy();
    });
    
    test('should handle format conversion errors', async () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '<root><binary>�����</binary></root>',
        format: 'xml',
        onError
      });
      
      editor.render();
      
      // Try to convert to JSON (binary data might cause issues)
      editor.convertTo('json');
      
      expect(onError).toHaveBeenCalledWith({
        type: 'conversion-error',
        fromFormat: 'xml',
        toFormat: 'json',
        error: expect.any(Error),
        recoverable: true
      });
      
      editor.destroy();
    });
  });
  
  describe('Error State Management', () => {
    test('should maintain error history', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        trackErrors: true
      });
      
      editor.render();
      
      // Generate multiple errors
      editor.loadContent('{invalid1}');
      editor.loadContent('{invalid2}');
      editor.loadContent('{"valid": true}');
      editor.editNode('nonexistent', 'value');
      
      const errorHistory = editor.getErrorHistory();
      expect(errorHistory).toHaveLength(3);
      expect(errorHistory[0].type).toBe('parse-error');
      expect(errorHistory[1].type).toBe('parse-error');
      expect(errorHistory[2].type).toBe('operation-error');
      
      editor.destroy();
    });
    
    test('should support error retry functionality', () => {
      let attemptCount = 0;
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError,
        validators: {
          test: () => {
            attemptCount++;
            if (attemptCount < 3) {
              return { valid: false, error: 'Temporary failure' };
            }
            return { valid: true };
          }
        }
      });
      
      editor.render();
      
      // First attempt fails
      editor.editNode('test', 'value');
      expect(onError).toHaveBeenCalledTimes(1);
      
      // Retry
      editor.retry();
      expect(onError).toHaveBeenCalledTimes(2);
      
      // Third attempt succeeds
      editor.retry();
      expect(editor.getContent()).toContain('"test": "value"');
      
      editor.destroy();
    });
    
    test('should clear errors on successful operations', () => {
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{invalid}',
        format: 'json'
      });
      
      editor.render();
      
      // Should show error
      expect(container.querySelector('.error-state')).toBeTruthy();
      
      // Load valid content
      editor.loadContent('{"valid": true}');
      
      // Error should be cleared
      expect(container.querySelector('.error-state')).toBeFalsy();
      expect(editor.hasErrors()).toBe(false);
      
      editor.destroy();
    });
  });
  
  describe('Error Boundaries', () => {
    test('should contain component errors', () => {
      const onError = jest.fn();
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError,
        plugins: [{
          name: 'error-plugin',
          init: () => {
            throw new Error('Plugin error');
          }
        }]
      });
      
      // Should not throw
      expect(() => editor.render()).not.toThrow();
      
      expect(onError).toHaveBeenCalledWith({
        type: 'plugin-error',
        plugin: 'error-plugin',
        error: expect.any(Error),
        contained: true
      });
      
      // Component should still be functional
      expect(editor.getContent()).toBe('{"test": true}');
      
      editor.destroy();
    });
    
    test('should handle render errors gracefully', () => {
      const onError = jest.fn();
      
      // Create editor with problematic theme
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError,
        theme: 'non-existent-theme'
      });
      
      // Should not throw
      expect(() => editor.render()).not.toThrow();
      
      // Should fall back to default theme
      const editorEl = container.querySelector('.hierarchy-editor');
      expect(editorEl.classList.contains('theme-light')).toBe(true);
      
      editor.destroy();
    });
  });
  
  describe('Error Reporting', () => {
    test('should provide detailed error information', () => {
      const errors = [];
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        onError: (error) => errors.push(error)
      });
      
      editor.render();
      
      // Cause various errors
      editor.loadContent('{invalid}');
      
      const error = errors[0];
      expect(error).toMatchObject({
        type: 'parse-error',
        timestamp: expect.any(Number),
        format: 'json',
        content: '{invalid}',
        error: expect.objectContaining({
          message: expect.any(String),
          stack: expect.any(String)
        }),
        context: expect.objectContaining({
          mode: 'tree',
          nodeCount: expect.any(Number)
        })
      });
      
      editor.destroy();
    });
    
    test('should support custom error handlers', () => {
      const customHandler = jest.fn((error) => {
        // Custom error processing
        console.error('Custom handler:', error);
        return { handled: true };
      });
      
      const editor = HierarchyEditor.create({
        dom: container,
        content: '{"test": true}',
        format: 'json',
        errorHandler: customHandler
      });
      
      editor.render();
      
      // Trigger error
      editor.deleteNode('nonexistent');
      
      expect(customHandler).toHaveBeenCalled();
      
      editor.destroy();
    });
  });
});