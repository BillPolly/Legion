/**
 * Source View Tests - Tests for source code display with syntax highlighting
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Source View', () => {
  let container;
  let SourceView;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import SourceView
    const sourceViewModule = await import('../../../view/SourceView.js');
    SourceView = sourceViewModule.SourceView;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Source View Creation', () => {
    test('should create source view with required dependencies', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        readOnly: false
      };

      const sourceView = new SourceView(container, mockConfig);
      
      expect(sourceView).toBeDefined();
      expect(sourceView.dom).toBe(container);
      expect(sourceView.config.content).toBe(mockConfig.content);
      expect(sourceView.config.format).toBe(mockConfig.format);
      expect(sourceView.config.readOnly).toBe(mockConfig.readOnly);
    });

    test('should create read-only source view', () => {
      const mockConfig = {
        content: '<root><test>value</test></root>',
        format: 'xml',
        readOnly: true
      };

      const sourceView = new SourceView(container, mockConfig);
      
      expect(sourceView.config.readOnly).toBe(true);
      expect(sourceView.isReadOnly()).toBe(true);
    });

    test('should default to text format if format not specified', () => {
      const mockConfig = {
        content: 'plain text content'
      };

      const sourceView = new SourceView(container, mockConfig);
      
      expect(sourceView.config.format).toBe('text');
    });
  });

  describe('Source View Rendering', () => {
    test('should render source content in container', () => {
      const content = '{"name": "John", "age": 30}';
      const mockConfig = {
        content: content,
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Should create editor element
      const editorElement = container.querySelector('.source-editor');
      expect(editorElement).toBeTruthy();
      
      // Should contain the content
      expect(sourceView.getContent()).toBe(content);
    });

    test('should render with syntax highlighting for JSON', () => {
      const content = '{"highlighted": true, "number": 42}';
      const mockConfig = {
        content: content,
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Should have syntax highlighting container
      const highlightContainer = container.querySelector('.syntax-highlight');
      expect(highlightContainer).toBeTruthy();
      
      // Should have format-specific class
      expect(container.querySelector('.format-json')).toBeTruthy();
    });

    test('should render with syntax highlighting for XML', () => {
      const content = '<config><setting name="test">value</setting></config>';
      const mockConfig = {
        content: content,
        format: 'xml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const highlightContainer = container.querySelector('.syntax-highlight');
      expect(highlightContainer).toBeTruthy();
      expect(container.querySelector('.format-xml')).toBeTruthy();
    });

    test('should render with syntax highlighting for YAML', () => {
      const content = 'name: John\nage: 30\nactive: true';
      const mockConfig = {
        content: content,
        format: 'yaml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const highlightContainer = container.querySelector('.syntax-highlight');
      expect(highlightContainer).toBeTruthy();
      expect(container.querySelector('.format-yaml')).toBeTruthy();
    });

    test('should render with syntax highlighting for Markdown', () => {
      const content = '# Title\n\nThis is **bold** text with `code`.';
      const mockConfig = {
        content: content,
        format: 'markdown'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const highlightContainer = container.querySelector('.syntax-highlight');
      expect(highlightContainer).toBeTruthy();
      expect(container.querySelector('.format-markdown')).toBeTruthy();
    });

    test('should render without syntax highlighting for unknown format', () => {
      const content = 'plain text content';
      const mockConfig = {
        content: content,
        format: 'text'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const editorElement = container.querySelector('.source-editor');
      expect(editorElement).toBeTruthy();
      expect(container.querySelector('.format-text')).toBeTruthy();
      
      // Should not have syntax highlighting
      expect(container.querySelector('.syntax-highlight')).toBeFalsy();
    });
  });

  describe('Source View Content Management', () => {
    test('should get current content', () => {
      const content = '{"test": "value"}';
      const mockConfig = { content, format: 'json' };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(sourceView.getContent()).toBe(content);
    });

    test('should set new content', () => {
      const initialContent = '{"initial": true}';
      const newContent = '{"updated": true}';
      const mockConfig = { content: initialContent, format: 'json' };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      sourceView.setContent(newContent);
      expect(sourceView.getContent()).toBe(newContent);
    });

    test('should update content and maintain formatting', () => {
      const content = '{"name":"John","age":30}';
      const formattedContent = JSON.stringify(JSON.parse(content), null, 2);
      const mockConfig = { content, format: 'json' };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      sourceView.formatContent();
      expect(sourceView.getContent()).toBe(formattedContent);
    });

    test('should handle content validation', () => {
      const validContent = '{"valid": true}';
      const invalidContent = '{invalid json}';
      const mockConfig = { content: validContent, format: 'json' };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Valid content should validate
      expect(sourceView.validateContent()).toEqual({
        valid: true,
        errors: []
      });
      
      // Invalid content should not validate
      sourceView.setContent(invalidContent);
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Source View Event Handling', () => {
    test('should emit content change events', () => {
      const content = '{"test": true}';
      const mockConfig = { content, format: 'json' };
      
      let changeEventFired = false;
      let changeEventData = null;
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('contentChange', (data) => {
        changeEventFired = true;
        changeEventData = data;
      });
      
      sourceView.render();
      
      const newContent = '{"test": false}';
      sourceView.setContent(newContent);
      
      expect(changeEventFired).toBe(true);
      expect(changeEventData).toEqual({
        oldContent: content,
        newContent: newContent,
        format: 'json'
      });
    });

    test('should emit validation events', () => {
      const mockConfig = { content: '{"valid": true}', format: 'json' };
      
      let validationEventFired = false;
      let validationResult = null;
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('validation', (result) => {
        validationEventFired = true;
        validationResult = result;
      });
      
      sourceView.render();
      sourceView.setContent('{invalid json}');
      
      expect(validationEventFired).toBe(true);
      expect(validationResult.valid).toBe(false);
    });

    test('should handle focus and blur events', () => {
      const mockConfig = { content: '{"test": true}', format: 'json' };
      
      let focusEventFired = false;
      let blurEventFired = false;
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('focus', () => { focusEventFired = true; });
      sourceView.on('blur', () => { blurEventFired = true; });
      
      sourceView.render();
      
      // Simulate focus
      sourceView.focus();
      expect(focusEventFired).toBe(true);
      
      // Simulate blur
      sourceView.blur();
      expect(blurEventFired).toBe(true);
    });
  });

  describe('Source View Configuration', () => {
    test('should support theme configuration', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        theme: 'dark'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(container.querySelector('.theme-dark')).toBeTruthy();
    });

    test('should support line numbers configuration', () => {
      const mockConfig = {
        content: 'line 1\nline 2\nline 3',
        format: 'text',
        showLineNumbers: true
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(container.querySelector('.line-numbers')).toBeTruthy();
    });

    test('should support word wrap configuration', () => {
      const mockConfig = {
        content: 'very long line that should wrap when word wrap is enabled',
        format: 'text',
        wordWrap: true
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(container.querySelector('.word-wrap')).toBeTruthy();
    });

    test('should support font size configuration', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        fontSize: 14
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const editorElement = container.querySelector('.source-editor');
      expect(editorElement.style.fontSize).toBe('14px');
    });
  });

  describe('Source View Cleanup', () => {
    test('should clean up event listeners on destroy', () => {
      const mockConfig = { content: '{"test": true}', format: 'json' };
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Add event listener
      let eventFired = false;
      sourceView.on('contentChange', () => { eventFired = true; });
      
      // Destroy should clean up
      sourceView.destroy();
      
      // Event should not fire after destroy
      sourceView.setContent('{"new": true}');
      expect(eventFired).toBe(false);
    });

    test('should remove DOM elements on destroy', () => {
      const mockConfig = { content: '{"test": true}', format: 'json' };
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(container.querySelector('.source-editor')).toBeTruthy();
      
      sourceView.destroy();
      
      expect(container.querySelector('.source-editor')).toBeFalsy();
    });

    test('should handle multiple destroy calls safely', () => {
      const mockConfig = { content: '{"test": true}', format: 'json' };
      
      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Multiple destroy calls should not error
      expect(() => {
        sourceView.destroy();
        sourceView.destroy();
        sourceView.destroy();
      }).not.toThrow();
    });
  });
});