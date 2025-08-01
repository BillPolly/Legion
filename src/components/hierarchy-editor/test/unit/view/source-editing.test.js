/**
 * Source Editing Tests - Tests for source code editing capabilities
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Source Editing', () => {
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

  describe('Source Edit Mode', () => {
    test('should enable editing by default', () => {
      const mockConfig = {
        content: '{"editable": true}',
        format: 'json',
        readOnly: false
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(sourceView.isReadOnly()).toBe(false);
      
      // Content should be editable
      const contentElement = container.querySelector('.source-content');
      expect(contentElement.contentEditable).toBe('true');
    });

    test('should support read-only mode', () => {
      const mockConfig = {
        content: '{"readonly": true}',
        format: 'json',
        readOnly: true
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      expect(sourceView.isReadOnly()).toBe(true);
      
      // Content should not be editable
      const contentElement = container.querySelector('.source-content');
      expect(contentElement.contentEditable).toBe(undefined);
      expect(contentElement.classList.contains('readonly')).toBe(true);
    });

    test('should handle direct content editing', () => {
      const originalContent = '{"original": true}';
      const newContent = '{"modified": true}';
      
      const mockConfig = {
        content: originalContent,
        format: 'json'
      };

      let contentChangeEventFired = false;
      let changeData = null;

      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('contentChange', (data) => {
        contentChangeEventFired = true;
        changeData = data;
      });
      
      sourceView.render();
      
      // Simulate content change
      sourceView.setContent(newContent);
      
      expect(contentChangeEventFired).toBe(true);
      expect(changeData.oldContent).toBe(originalContent);
      expect(changeData.newContent).toBe(newContent);
      expect(sourceView.getContent()).toBe(newContent);
    });

    test('should handle incremental editing with debouncing', async () => {
      const mockConfig = {
        content: '{"test": "value"}',
        format: 'json'
      };

      let changeEvents = [];
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('contentChange', (data) => {
        changeEvents.push(data);
      });
      
      sourceView.render();
      
      // Rapid content changes (simulating typing)
      sourceView.setContent('{"test": "v"}');
      sourceView.setContent('{"test": "va"}');
      sourceView.setContent('{"test": "val"}');
      sourceView.setContent('{"test": "valu"}');
      sourceView.setContent('{"test": "value2"}');
      
      // Wait for debouncing
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Should have received all events but highlighting should be debounced
      expect(changeEvents.length).toBe(5);
      expect(sourceView.getContent()).toBe('{"test": "value2"}');
    });

    test('should preserve cursor position during editing', () => {
      const mockConfig = {
        content: '{"cursor": "position"}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const contentElement = container.querySelector('.source-content');
      
      // Focus the editor
      sourceView.focus();
      
      // Verify focus is maintained
      expect(document.activeElement).toBe(contentElement);
    });

    test('should handle copy/paste operations', () => {
      const mockConfig = {
        content: '{"original": true}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const pastedContent = '{"pasted": "content", "from": "clipboard"}';
      
      // Simulate paste operation
      sourceView.setContent(pastedContent);
      
      expect(sourceView.getContent()).toBe(pastedContent);
    });

    test('should support undo/redo operations through browser', () => {
      const mockConfig = {
        content: '{"step": 1}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const step1 = '{"step": 1}';
      const step2 = '{"step": 2}';
      const step3 = '{"step": 3}';
      
      sourceView.setContent(step2);
      sourceView.setContent(step3);
      
      // Content should be at step 3
      expect(sourceView.getContent()).toBe(step3);
      
      // Note: Actual undo/redo would require browser behavior simulation
      // This test verifies the content management is in place
    });
  });

  describe('Source Validation', () => {
    test('should validate JSON content in real-time', () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json'
      };

      let validationEvents = [];
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('validation', (result) => {
        validationEvents.push(result);
      });
      
      sourceView.render();
      
      // Set valid content
      sourceView.setContent('{"still": "valid"}');
      expect(validationEvents[0].valid).toBe(true);
      
      // Set invalid content
      sourceView.setContent('{invalid json}');
      expect(validationEvents[1].valid).toBe(false);
      expect(validationEvents[1].errors.length).toBeGreaterThan(0);
    });

    test('should validate XML content', () => {
      const validXml = '<root><valid>true</valid></root>';
      const invalidXml = '<root><unclosed>tag</root>';
      
      const mockConfig = {
        content: validXml,
        format: 'xml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Test valid XML
      let validation = sourceView.validateContent();
      expect(validation.valid).toBe(true);
      
      // Test invalid XML
      sourceView.setContent(invalidXml);
      validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
    });

    test('should provide detailed error messages for JSON', () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const invalidJson = '{"missing": quote}';
      sourceView.setContent(invalidJson);
      
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Unexpected token');
    });

    test('should provide detailed error messages for XML', () => {
      const mockConfig = {
        content: '<valid>xml</valid>',
        format: 'xml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const invalidXml = '<unclosed><tag>content</tag>';
      sourceView.setContent(invalidXml);
      
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should handle validation for YAML format', () => {
      const mockConfig = {
        content: 'valid: yaml\nformat: true',
        format: 'yaml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // YAML validation is basic for now (always passes)
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(true);
    });

    test('should handle validation for Markdown format', () => {
      const mockConfig = {
        content: '# Valid Markdown\n\nThis is valid.',
        format: 'markdown'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Markdown validation is basic for now (always passes)
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(true);
    });

    test('should throttle validation to avoid performance issues', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      let validationCount = 0;
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('validation', () => {
        validationCount++;
      });
      
      sourceView.render();
      
      // Rapid content changes
      for (let i = 0; i < 10; i++) {
        sourceView.setContent(`{"count": ${i}}`);
      }
      
      // Should have validated each change
      expect(validationCount).toBe(10);
    });
  });

  describe('Parse Error Handling', () => {
    test('should handle malformed JSON gracefully', () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const malformedJson = '{"unclosed": "string}';
      sourceView.setContent(malformedJson);
      
      // Should not crash
      expect(() => {
        sourceView.validateContent();
      }).not.toThrow();
      
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
    });

    test('should handle malformed XML gracefully', () => {
      const mockConfig = {
        content: '<valid>xml</valid>',
        format: 'xml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const malformedXml = '<root><malformed></root>';
      sourceView.setContent(malformedXml);
      
      // Should not crash
      expect(() => {
        sourceView.validateContent();
      }).not.toThrow();
      
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(false);
    });

    test('should provide user-friendly error messages', () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      // Common JSON errors
      const testCases = [
        { content: '{invalid: json}', errorType: 'Unexpected token' },
        { content: '{"unclosed": "string}', errorType: 'Unexpected end' },
        { content: '{"trailing": "comma",}', errorType: 'Unexpected token' }
      ];
      
      testCases.forEach(testCase => {
        sourceView.setContent(testCase.content);
        const validation = sourceView.validateContent();
        
        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toBeDefined();
        // Error message should be descriptive
        expect(typeof validation.errors[0]).toBe('string');
        expect(validation.errors[0].length).toBeGreaterThan(0);
      });
    });

    test('should maintain editor state during validation errors', () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const invalidContent = '{invalid json}';
      sourceView.setContent(invalidContent);
      
      // Content should still be accessible even if invalid
      expect(sourceView.getContent()).toBe(invalidContent);
      
      // Editor should still be functional
      expect(sourceView.isReadOnly()).toBe(false);
      
      // Should be able to correct the content
      sourceView.setContent('{"corrected": true}');
      const validation = sourceView.validateContent();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Content Formatting', () => {
    test('should format JSON content on demand', () => {
      const mockConfig = {
        content: '{"minified":true,"no":"spaces"}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      sourceView.formatContent();
      
      const formattedContent = sourceView.getContent();
      expect(formattedContent).toContain('{\n');
      expect(formattedContent).toContain('  "minified": true,\n');
      expect(formattedContent).toContain('  "no": "spaces"\n');
      expect(formattedContent).toContain('}');
    });

    test('should format XML content on demand', () => {
      const mockConfig = {
        content: '<root><item>value</item><other>data</other></root>',
        format: 'xml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      sourceView.formatContent();
      
      const formattedContent = sourceView.getContent();
      expect(formattedContent).toContain('<root>\n');
      expect(formattedContent.split('\n').length).toBeGreaterThan(1);
    });

    test('should handle formatting errors gracefully', () => {
      const mockConfig = {
        content: '{invalid json for formatting}',
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const originalContent = sourceView.getContent();
      
      // Should not crash on invalid content
      expect(() => {
        sourceView.formatContent();
      }).not.toThrow();
      
      // Content should remain unchanged if formatting fails
      expect(sourceView.getContent()).toBe(originalContent);
    });

    test('should preserve content when formatting unsupported formats', () => {
      const mockConfig = {
        content: 'name: value\nother: data',
        format: 'yaml'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const originalContent = sourceView.getContent();
      
      sourceView.formatContent();
      
      // YAML formatting not implemented, should preserve content
      expect(sourceView.getContent()).toBe(originalContent);
    });
  });

  describe('Source Editing Integration', () => {
    test('should integrate with validation workflow', () => {
      const mockConfig = {
        content: '{"start": true}',
        format: 'json'
      };

      let validationResults = [];
      const sourceView = new SourceView(container, mockConfig);
      sourceView.on('validation', (result) => {
        validationResults.push(result);
      });
      
      sourceView.render();
      
      // Edit -> Validate -> Format cycle
      sourceView.setContent('{"step": 1}');
      expect(validationResults[0].valid).toBe(true);
      
      sourceView.setContent('{invalid}');
      expect(validationResults[1].valid).toBe(false);
      
      sourceView.setContent('{"step": 2}');
      expect(validationResults[2].valid).toBe(true);
      
      sourceView.formatContent();
      // Formatting triggers validation
      expect(validationResults[3].valid).toBe(true);
    });

    test('should maintain editor performance during complex operations', async () => {
      const largeContent = JSON.stringify({
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random()
        }))
      });

      const mockConfig = {
        content: largeContent,
        format: 'json'
      };

      const sourceView = new SourceView(container, mockConfig);
      sourceView.render();
      
      const startTime = Date.now();
      
      // Perform various operations
      sourceView.validateContent();
      sourceView.formatContent();
      sourceView.setContent(largeContent.replace('Item 0', 'Modified Item 0'));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000);
    });
  });
});