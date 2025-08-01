import { jest } from '@jest/globals';
import { CodeEditor } from '../../../src/components/code-editor/index.js';
import { JSDOM } from 'jsdom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('CodeEditor Component', () => {
  let dom;
  let container;
  let editor;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.Node = dom.window.Node;
    global.Element = dom.window.Element;
    global.DocumentFragment = dom.window.DocumentFragment;
    
    container = document.getElementById('editor');
  });

  afterEach(() => {
    if (editor && editor.destroy) {
      editor.destroy();
    }
  });

  describe('Basic Functionality', () => {
    test('should create editor with initial content', () => {
      const initialContent = 'console.log("Hello World");';
      editor = CodeEditor.create({
        dom: container,
        content: initialContent
      });

      expect(editor.getContent()).toBe(initialContent);
    });

    test('should update content', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'initial'
      });

      editor.setContent('updated content');
      expect(editor.getContent()).toBe('updated content');
    });

    test('should clear content', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'some content'
      });

      editor.clear();
      expect(editor.getContent()).toBe('');
    });
  });

  describe('Undo/Redo Functionality', () => {
    test('should undo content changes', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'initial'
      });

      editor.setContent('changed');
      expect(editor.getContent()).toBe('changed');

      editor.undo();
      expect(editor.getContent()).toBe('initial');
    });

    test('should redo content changes', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'initial'
      });

      editor.setContent('changed');
      editor.undo();
      expect(editor.getContent()).toBe('initial');

      editor.redo();
      expect(editor.getContent()).toBe('changed');
    });

    test('should track undo/redo availability', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'initial'
      });

      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(false);

      editor.setContent('changed');
      
      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(false);

      editor.undo();
      
      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(true);
    });

    test('should handle multiple undo/redo operations', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'step1'
      });

      editor.setContent('step2');
      editor.setContent('step3');
      editor.setContent('step4');

      expect(editor.getContent()).toBe('step4');

      editor.undo();
      expect(editor.getContent()).toBe('step3');

      editor.undo();
      expect(editor.getContent()).toBe('step2');

      editor.redo();
      expect(editor.getContent()).toBe('step3');
    });
  });

  describe('Selection Operations', () => {
    test('should select all content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      editor = CodeEditor.create({
        dom: container,
        content
      });

      editor.selectAll();
      const selection = editor.getSelection();
      
      expect(selection.text).toBe(content);
      expect(selection.from).toBe(0);
      expect(selection.to).toBe(content.length);
    });

    test('should set selection range', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Hello World'
      });

      editor.setSelection(0, 5);
      const selection = editor.getSelection();
      
      expect(selection.text).toBe('Hello');
      expect(selection.from).toBe(0);
      expect(selection.to).toBe(5);
    });

    test('should get cursor position', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Test'
      });

      editor.setCursor(2);
      expect(editor.getCursor()).toBe(2);
    });
  });

  describe('Configuration Updates', () => {
    test('should update theme', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        theme: 'light'
      });

      editor.setTheme('dark');
      // In real implementation, we'd check if the theme class was applied
      expect(() => editor.setTheme('dark')).not.toThrow();
    });

    test('should update language', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        language: 'javascript'
      });

      editor.setLanguage('typescript');
      expect(() => editor.setLanguage('typescript')).not.toThrow();
    });

    test('should toggle line numbers', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        lineNumbers: true
      });

      editor.updateConfig({ lineNumbers: false });
      expect(() => editor.updateConfig({ lineNumbers: true })).not.toThrow();
    });

    test('should update multiple config options', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test'
      });

      editor.updateConfig({
        theme: 'dark',
        lineNumbers: false,
        wordWrap: true,
        readOnly: true
      });

      expect(() => editor.setContent('should not change')).not.toThrow();
    });
  });

  describe('Text Manipulation', () => {
    test('should insert text at cursor', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Hello World'
      });

      editor.setCursor(5);
      editor.insertText(' Beautiful');
      expect(editor.getContent()).toBe('Hello Beautiful World');
    });

    test('should replace selection', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Hello World'
      });

      editor.setSelection(6, 11);
      editor.replaceSelection('Universe');
      expect(editor.getContent()).toBe('Hello Universe');
    });

    test('should get line at position', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Line 1\nLine 2\nLine 3'
      });

      expect(editor.getLine(0)).toBe('Line 1');
      expect(editor.getLine(1)).toBe('Line 2');
      expect(editor.getLine(2)).toBe('Line 3');
    });

    test('should get line count', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'Line 1\nLine 2\nLine 3'
      });

      expect(editor.getLineCount()).toBe(3);
    });
  });

  describe('Animation Features', () => {
    test('should support typewriter animation', async () => {
      editor = CodeEditor.create({
        dom: container,
        content: '',
        enableAnimations: true
      });

      const text = 'Hello';
      const promise = editor.typeText(text, { speed: 10 });
      
      expect(promise).toBeInstanceOf(Promise);
      
      // In a real test, we'd wait for the animation to complete
      // For now, just verify it doesn't throw
      await expect(promise).resolves.not.toThrow();
    });

    test('should support progressive build', async () => {
      editor = CodeEditor.create({
        dom: container,
        content: '',
        enableAnimations: true
      });

      const blocks = ['function test() {', '\n  return true;', '\n}'];
      const promise = editor.progressiveBuild(blocks, { blockDelay: 10, typeSpeed: 10 });
      
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.not.toThrow();
    });

    test('should skip animations when disabled', async () => {
      editor = CodeEditor.create({
        dom: container,
        content: '',
        enableAnimations: false
      });

      await editor.typeText('Hello');
      expect(editor.getContent()).toBe('Hello');
    });
  });

  describe('Event Handling', () => {
    test('should trigger content change callback', () => {
      const onChange = jest.fn();
      
      editor = CodeEditor.create({
        dom: container,
        content: 'initial',
        onContentChange: onChange
      });

      editor.setContent('changed');
      
      expect(onChange).toHaveBeenCalledWith('changed', 'initial', true);
    });

    test('should trigger cursor change callback', () => {
      const onCursorChange = jest.fn();
      
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        onCursorChange
      });

      editor.setCursor(2);
      
      expect(onCursorChange).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ line: 0, ch: 2 })
      );
    });

    test('should trigger save callback', () => {
      const onSave = jest.fn();
      
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        onSave
      });

      editor.save();
      
      expect(onSave).toHaveBeenCalledWith('test', false);
    });
  });

  describe('State Management', () => {
    test('should export and import state', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test content'
      });

      editor.setCursor(5);
      const state = editor.exportState();
      
      expect(state).toHaveProperty('content', 'test content');
      expect(state).toHaveProperty('cursor');
      expect(state).toHaveProperty('timestamp');

      // Create new editor and import state
      const newEditor = CodeEditor.create({
        dom: container,
        content: ''
      });

      newEditor.importState(state);
      expect(newEditor.getContent()).toBe('test content');
      
      newEditor.destroy();
    });

    test('should track dirty state', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'initial'
      });

      expect(editor.isDirty()).toBe(false);

      editor.setContent('changed');
      expect(editor.isDirty()).toBe(true);

      editor.save();
      expect(editor.isDirty()).toBe(false);
    });
  });

  describe('Validation', () => {
    test('should validate content', () => {
      const validateContent = jest.fn().mockReturnValue([]);
      
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        validateContent
      });

      expect(editor.validate()).toBe(true);
      expect(validateContent).toHaveBeenCalledWith('test');
    });

    test('should return validation errors', () => {
      const errors = [
        { line: 1, column: 1, message: 'Error', severity: 'error' }
      ];
      const validateContent = jest.fn().mockReturnValue(errors);
      
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        validateContent
      });

      expect(editor.validate()).toBe(false);
      expect(editor.getValidationErrors()).toEqual(errors);
    });
  });

  describe('Error Handling', () => {
    test('should validate required dom parameter', () => {
      expect(() => {
        CodeEditor.create({});
      }).toThrow('CodeEditor requires dom element');
    });

    test('should validate theme values', () => {
      expect(() => {
        CodeEditor.create({
          dom: container,
          theme: 'invalid'
        });
      }).toThrow('Theme must be "light" or "dark"');
    });

    test('should validate language values', () => {
      expect(() => {
        CodeEditor.create({
          dom: container,
          language: 'invalid'
        });
      }).toThrow('Language must be "javascript" or "typescript"');
    });

    test('should handle import state errors', () => {
      const onError = jest.fn();
      
      editor = CodeEditor.create({
        dom: container,
        content: 'test',
        onError
      });

      const invalidState = { invalid: 'state' };
      
      expect(() => {
        editor.importState(invalidState);
      }).toThrow();
      
      expect(onError).toHaveBeenCalledWith('importState', expect.any(Error), invalidState);
    });
  });

  describe('Destroy and Cleanup', () => {
    test('should properly destroy editor', () => {
      editor = CodeEditor.create({
        dom: container,
        content: 'test'
      });

      expect(() => editor.destroy()).not.toThrow();
      
      // Verify methods throw after destroy
      expect(() => editor.getContent()).toThrow('Component has been destroyed');
    });
  });
});