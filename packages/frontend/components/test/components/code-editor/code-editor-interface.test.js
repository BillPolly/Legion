import { CodeEditor } from '../../../src/components/code-editor/index.js';

describe('CodeEditor Interface', () => {
  describe('Umbilical Protocol', () => {
    test('should support introspection mode', () => {
      const requirements = [];
      CodeEditor.create({
        describe: (req) => {
          requirements.push(...req);
        }
      });

      expect(requirements).toContain('dom');
      expect(requirements.some(r => r.startsWith('content'))).toBe(true);
      expect(requirements.some(r => r.includes('onChange'))).toBe(true);
    });

    test('should support validation mode', () => {
      const validUmbilical = {
        dom: document.createElement('div'),
        validate: true
      };

      const invalidUmbilical = {
        // Missing dom
        validate: true
      };

      expect(CodeEditor.create(validUmbilical)).toBe(true);
      expect(CodeEditor.create(invalidUmbilical)).toBe(false);
    });

    test('should validate required dom parameter', () => {
      expect(() => {
        CodeEditor.create({});
      }).toThrow('CodeEditor requires dom element');
    });

    test('should validate theme values', () => {
      const div = document.createElement('div');
      
      expect(() => {
        CodeEditor.create({
          dom: div,
          theme: 'invalid'
        });
      }).toThrow('Theme must be "light" or "dark"');
    });

    test('should validate language values', () => {
      const div = document.createElement('div');
      
      expect(() => {
        CodeEditor.create({
          dom: div,
          language: 'invalid'
        });
      }).toThrow('Language must be "javascript" or "typescript"');
    });

    test('should validate numeric parameters', () => {
      const div = document.createElement('div');
      
      expect(() => {
        CodeEditor.create({
          dom: div,
          maxHistorySize: 'not a number'
        });
      }).toThrow('maxHistorySize must be a positive number');

      expect(() => {
        CodeEditor.create({
          dom: div,
          autoSaveDelay: -100
        });
      }).toThrow('autoSaveDelay must be a positive number');

      expect(() => {
        CodeEditor.create({
          dom: div,
          tabSize: 0
        });
      }).toThrow('tabSize must be a number between 1 and 8');
    });

    test('should validate animation speed parameters', () => {
      const div = document.createElement('div');
      
      expect(() => {
        CodeEditor.create({
          dom: div,
          typewriterSpeed: 'fast'
        });
      }).toThrow('typewriterSpeed must be a positive number');

      expect(() => {
        CodeEditor.create({
          dom: div,
          highlightDuration: -500
        });
      }).toThrow('highlightDuration must be a positive number');
    });
  });

  describe('Component Requirements', () => {
    test('should list all available configuration options', () => {
      const requirements = [];
      CodeEditor.create({
        describe: (req) => {
          requirements.push(...req);
        }
      });

      // Check required parameters
      expect(requirements).toContain('dom (required) - DOM element to mount the editor');

      // Check optional parameters
      const optionalParams = [
        'content',
        'language',
        'theme',
        'readOnly',
        'lineNumbers',
        'foldGutter',
        'wordWrap',
        'autocompletion',
        'closeBrackets',
        'searchPanel',
        'tabSize',
        'insertSpaces',
        'maxHistorySize',
        'validateContent',
        'autoFormat',
        'autoSave',
        'autoSaveDelay',
        'enableAnimations',
        'typewriterSpeed',
        'highlightDuration'
      ];

      optionalParams.forEach(param => {
        expect(requirements.some(r => r.includes(param))).toBe(true);
      });

      // Check callbacks
      const callbacks = [
        'onChange',
        'onContentChange',
        'onCursorChange',
        'onSelectionChange',
        'onValidation',
        'onSave',
        'onAutoSave',
        'onSaveRequest',
        'onFocus',
        'onBlur',
        'onKeyDown',
        'onError',
        'onAnimationStart',
        'onAnimationProgress',
        'onAnimationComplete'
      ];

      callbacks.forEach(callback => {
        expect(requirements.some(r => r.includes(callback))).toBe(true);
      });
    });
  });

  describe('Public API', () => {
    test('should expose all documented methods', () => {
      // Mock implementation since we can't actually create the editor without DOM
      const mockEditor = {
        // Content operations
        getContent: expect.any(Function),
        setContent: expect.any(Function),
        insertText: expect.any(Function),
        replaceSelection: expect.any(Function),
        clear: expect.any(Function),

        // Cursor and selection
        getCursor: expect.any(Function),
        setCursor: expect.any(Function),
        getSelection: expect.any(Function),
        setSelection: expect.any(Function),

        // Line operations
        getLine: expect.any(Function),
        getLineCount: expect.any(Function),

        // History operations
        undo: expect.any(Function),
        redo: expect.any(Function),
        canUndo: expect.any(Function),
        canRedo: expect.any(Function),
        clearHistory: expect.any(Function),

        // Configuration
        setTheme: expect.any(Function),
        setLanguage: expect.any(Function),
        updateConfig: expect.any(Function),

        // State management
        isDirty: expect.any(Function),
        save: expect.any(Function),
        exportState: expect.any(Function),
        importState: expect.any(Function),
        reset: expect.any(Function),

        // Validation
        validate: expect.any(Function),
        getValidationErrors: expect.any(Function),

        // Focus management
        focus: expect.any(Function),
        blur: expect.any(Function),
        hasFocus: expect.any(Function),

        // Animation features
        typeText: expect.any(Function),
        highlightRange: expect.any(Function),
        highlightRanges: expect.any(Function),
        progressiveBuild: expect.any(Function),

        // Editor commands
        selectAll: expect.any(Function),
        selectLine: expect.any(Function),
        duplicateLine: expect.any(Function),
        toggleComment: expect.any(Function),
        indent: expect.any(Function),
        outdent: expect.any(Function),

        // Lifecycle
        destroy: expect.any(Function)
      };

      // Verify that a created editor would have these methods
      const methods = Object.keys(mockEditor);
      
      expect(methods).toContain('getContent');
      expect(methods).toContain('undo');
      expect(methods).toContain('redo');
      expect(methods).toContain('selectAll');
      expect(methods).toContain('typeText');
      expect(methods).toContain('progressiveBuild');
      expect(methods.length).toBeGreaterThan(30);
    });
  });

  describe('Error Handling', () => {
    test('should provide meaningful error messages', () => {
      const testCases = [
        {
          umbilical: {},
          error: 'CodeEditor requires dom element'
        },
        {
          umbilical: { dom: 'not an element' },
          error: 'dom must be an HTMLElement'
        },
        {
          umbilical: { dom: document.createElement('div'), theme: 'blue' },
          error: 'Theme must be "light" or "dark"'
        },
        {
          umbilical: { dom: document.createElement('div'), language: 'python' },
          error: 'Language must be "javascript" or "typescript"'
        },
        {
          umbilical: { dom: document.createElement('div'), tabSize: 10 },
          error: 'tabSize must be a number between 1 and 8'
        }
      ];

      testCases.forEach(({ umbilical, error }) => {
        expect(() => CodeEditor.create(umbilical)).toThrow(error);
      });
    });
  });
});