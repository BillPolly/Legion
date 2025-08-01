/**
 * Syntax Highlighter Tests - Tests for format-specific syntax highlighting
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Syntax Highlighter', () => {
  let container;
  let SyntaxHighlighter;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import SyntaxHighlighter
    const highlighterModule = await import('../../../view/SyntaxHighlighter.js');
    SyntaxHighlighter = highlighterModule.SyntaxHighlighter;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Highlighter Creation', () => {
    test('should create syntax highlighter for JSON', () => {
      const highlighter = new SyntaxHighlighter('json');
      
      expect(highlighter).toBeDefined();
      expect(highlighter.format).toBe('json');
      expect(highlighter.isSupported('json')).toBe(true);
    });

    test('should create syntax highlighter for XML', () => {
      const highlighter = new SyntaxHighlighter('xml');
      
      expect(highlighter.format).toBe('xml');
      expect(highlighter.isSupported('xml')).toBe(true);
    });

    test('should create syntax highlighter for YAML', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      
      expect(highlighter.format).toBe('yaml');
      expect(highlighter.isSupported('yaml')).toBe(true);
    });

    test('should create syntax highlighter for Markdown', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      
      expect(highlighter.format).toBe('markdown');
      expect(highlighter.isSupported('markdown')).toBe(true);
    });

    test('should handle unsupported format gracefully', () => {
      const highlighter = new SyntaxHighlighter('unknown');
      
      expect(highlighter.format).toBe('unknown');
      expect(highlighter.isSupported('unknown')).toBe(false);
    });
  });

  describe('JSON Syntax Highlighting', () => {
    test('should highlight JSON strings', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"name": "John Doe", "age": 30}';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="syntax-string"');
      expect(highlighted).toContain('"name"');
      expect(highlighted).toContain('"John Doe"');
    });

    test('should highlight JSON numbers', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"age": 30, "score": 95.5, "count": 0}';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="syntax-number"');
      expect(highlighted).toContain('30');
      expect(highlighted).toContain('95.5');
      expect(highlighted).toContain('0');
    });

    test('should highlight JSON booleans and null', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"active": true, "deleted": false, "value": null}';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="syntax-boolean"');
      expect(highlighted).toContain('true');
      expect(highlighted).toContain('false');
      expect(highlighted).toContain('class="syntax-null"');
      expect(highlighted).toContain('null');
    });

    test('should highlight JSON structure tokens', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"items": [1, 2, 3], "nested": {"key": "value"}}';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="syntax-brace"');
      expect(highlighted).toContain('class="syntax-bracket"');
      expect(highlighted).toContain('class="syntax-comma"');
      expect(highlighted).toContain('class="syntax-colon"');
    });

    test('should handle malformed JSON gracefully', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{name: "John", age: 30,}'; // Invalid JSON
      
      const highlighted = highlighter.highlight(content);
      
      // Should still attempt highlighting but not crash
      expect(highlighted).toBeDefined();
      expect(typeof highlighted).toBe('string');
    });
  });

  describe('XML Syntax Highlighting', () => {
    test('should highlight XML tags', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<root><user id="1"><name>John</name></user></root>';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-tag"');
      expect(highlighted).toContain('&lt;root&gt;');
      expect(highlighted).toContain('&lt;user');
      expect(highlighted).toContain('&lt;/name&gt;');
    });

    test('should highlight XML attributes', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<user id="123" name="John" active="true" />';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-attribute"');
      expect(highlighted).toContain('id=');
      expect(highlighted).toContain('name=');
      expect(highlighted).toContain('active=');
    });

    test('should highlight XML attribute values', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<config setting="debug" value="true" port="8080" />';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-attribute-value"');
      expect(highlighted).toContain('"debug"');
      expect(highlighted).toContain('"true"');
      expect(highlighted).toContain('"8080"');
    });

    test('should highlight XML text content', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<message>Hello World</message><description>This is content</description>';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-text"');
      expect(highlighted).toContain('Hello World');
      expect(highlighted).toContain('This is content');
    });

    test('should handle XML comments', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<!-- This is a comment --><root>content</root>';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-comment"');
      expect(highlighted).toContain('&lt;!-- This is a comment --&gt;');
    });

    test('should handle XML CDATA sections', () => {
      const highlighter = new SyntaxHighlighter('xml');
      const content = '<script><![CDATA[function() { return true; }]]></script>';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="xml-cdata"');
      expect(highlighted).toContain('&lt;![CDATA[');
      expect(highlighted).toContain(']]&gt;');
    });
  });

  describe('YAML Syntax Highlighting', () => {
    test('should highlight YAML keys', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      const content = 'name: John\nage: 30\nactive: true';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="yaml-key"');
      expect(highlighted).toContain('name:');
      expect(highlighted).toContain('age:');
      expect(highlighted).toContain('active:');
    });

    test('should highlight YAML values', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      const content = 'name: "John Doe"\nage: 30\nactive: true\nscore: 95.5';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="yaml-string"');
      expect(highlighted).toContain('"John Doe"');
      expect(highlighted).toContain('class="yaml-number"');
      expect(highlighted).toContain('30');
      expect(highlighted).toContain('95.5');
      expect(highlighted).toContain('class="yaml-boolean"');
      expect(highlighted).toContain('true');
    });

    test('should highlight YAML lists', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      const content = 'items:\n  - apple\n  - banana\n  - cherry';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="yaml-list-marker"');
      expect(highlighted).toContain('- apple');
      expect(highlighted).toContain('- banana');
      expect(highlighted).toContain('- cherry');
    });

    test('should highlight YAML comments', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      const content = '# Configuration\nname: John  # User name\nage: 30';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="yaml-comment"');
      expect(highlighted).toContain('# Configuration');
      expect(highlighted).toContain('# User name');
    });

    test('should highlight YAML document markers', () => {
      const highlighter = new SyntaxHighlighter('yaml');
      const content = '---\nname: John\n...\n---\nname: Jane';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="yaml-document-marker"');
      expect(highlighted).toContain('---');
      expect(highlighted).toContain('...');
    });
  });

  describe('Markdown Syntax Highlighting', () => {
    test('should highlight Markdown headings', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = '# Main Title\n## Section\n### Subsection';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-heading md-h1"');
      expect(highlighted).toContain('# Main Title');
      expect(highlighted).toContain('class="md-heading md-h2"');
      expect(highlighted).toContain('## Section');
      expect(highlighted).toContain('class="md-heading md-h3"');
      expect(highlighted).toContain('### Subsection');
    });

    test('should highlight Markdown emphasis', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = 'This is **bold** and *italic* text.';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-bold"');
      expect(highlighted).toContain('**bold**');
      expect(highlighted).toContain('class="md-italic"');
      expect(highlighted).toContain('*italic*');
    });

    test('should highlight Markdown code', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = 'Use `console.log()` for debugging.\n\n```javascript\nfunction test() {\n  return true;\n}\n```';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-inline-code"');
      expect(highlighted).toContain('`console.log()`');
      expect(highlighted).toContain('class="md-code-block"');
      expect(highlighted).toContain('```javascript');
    });

    test('should highlight Markdown links', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = 'Visit [Google](https://google.com) for search.';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-link"');
      expect(highlighted).toContain('[Google]');
      expect(highlighted).toContain('(https://google.com)');
    });

    test('should highlight Markdown lists', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = '- Item 1\n- Item 2\n\n1. First\n2. Second';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-list-marker"');
      expect(highlighted).toContain('- Item 1');
      expect(highlighted).toContain('1. First');
      expect(highlighted).toContain('2. Second');
    });

    test('should highlight Markdown blockquotes', () => {
      const highlighter = new SyntaxHighlighter('markdown');
      const content = '> This is a quote\n> with multiple lines';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="md-blockquote"');
      expect(highlighted).toContain('&gt; This is a quote');
      expect(highlighted).toContain('&gt; with multiple lines');
    });
  });

  describe('Highlighter Configuration', () => {
    test('should support custom theme colors', () => {
      const highlighter = new SyntaxHighlighter('json', {
        theme: {
          string: '#ff0000',
          number: '#00ff00',
          boolean: '#0000ff'
        }
      });
      
      const content = '{"name": "John", "age": 30, "active": true}';
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('color: #ff0000');
      expect(highlighted).toContain('color: #00ff00');
      expect(highlighted).toContain('color: #0000ff');
    });

    test('should support line number highlighting', () => {
      const highlighter = new SyntaxHighlighter('json', {
        showLineNumbers: true
      });
      
      const content = '{\n  "name": "John",\n  "age": 30\n}';
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="line-number"');
      expect(highlighted).toContain('1');
      expect(highlighted).toContain('2');
      expect(highlighted).toContain('3');
      expect(highlighted).toContain('4');
    });

    test('should support custom CSS classes', () => {
      const highlighter = new SyntaxHighlighter('json', {
        cssPrefix: 'custom'
      });
      
      const content = '{"test": true}';
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toContain('class="custom-string"');
      expect(highlighted).toContain('class="custom-boolean"');
      expect(highlighted).toContain('class="custom-brace"');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large content efficiently', () => {
      const highlighter = new SyntaxHighlighter('json');
      
      // Generate large JSON content
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key_${i}`] = `value_${i}`;
      }
      const content = JSON.stringify(largeObject, null, 2);
      
      const startTime = Date.now();
      const highlighted = highlighter.highlight(content);
      const endTime = Date.now();
      
      expect(highlighted).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle empty content', () => {
      const highlighter = new SyntaxHighlighter('json');
      
      expect(highlighter.highlight('')).toBe('');
      expect(highlighter.highlight('   ')).toBe('   ');
    });

    test('should handle special characters', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"special": "\\n\\t\\r\\"\\\\", "unicode": "\\u0041"}';
      
      const highlighted = highlighter.highlight(content);
      
      expect(highlighted).toBeDefined();
      expect(highlighted).toContain('special');
      expect(highlighted).toContain('unicode');
    });

    test('should prevent XSS in highlighted output', () => {
      const highlighter = new SyntaxHighlighter('json');
      const content = '{"script": "<script>alert(\\"xss\\")</script>"}';
      
      const highlighted = highlighter.highlight(content);
      
      // Should escape HTML entities
      expect(highlighted).not.toContain('<script>');
      expect(highlighted).toContain('&lt;script&gt;');
    });
  });
});