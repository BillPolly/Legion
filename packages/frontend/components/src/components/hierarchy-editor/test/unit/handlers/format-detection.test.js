/**
 * Format Detection Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Format Detection', () => {
  let JsonHandler, XmlHandler, YamlHandler, MarkdownHandler;
  let jsonHandler, xmlHandler, yamlHandler, markdownHandler;

  beforeEach(async () => {
    const jsonModule = await import('../../../handlers/JsonHandler.js');
    const xmlModule = await import('../../../handlers/XmlHandler.js');
    const yamlModule = await import('../../../handlers/YamlHandler.js');
    const markdownModule = await import('../../../handlers/MarkdownHandler.js');
    
    JsonHandler = jsonModule.JsonHandler;
    XmlHandler = xmlModule.XmlHandler;
    YamlHandler = yamlModule.YamlHandler;
    MarkdownHandler = markdownModule.MarkdownHandler;
    
    jsonHandler = new JsonHandler();
    xmlHandler = new XmlHandler();
    yamlHandler = new YamlHandler();
    markdownHandler = new MarkdownHandler();
  });

  describe('JSON Detection', () => {
    test('should detect valid JSON objects', () => {
      const samples = [
        '{"name": "John", "age": 30}',
        '{\n  "user": {\n    "id": 123,\n    "active": true\n  }\n}',
        '{"items": [1, 2, 3, 4, 5]}',
        '{}',
        '{"string": "value", "number": 42, "boolean": true, "null": null}'
      ];
      
      samples.forEach(sample => {
        expect(jsonHandler.detect(sample)).toBe(true);
        expect(xmlHandler.detect(sample)).toBe(false);
        expect(yamlHandler.detect(sample)).toBe(false);
        expect(markdownHandler.detect(sample)).toBe(false);
      });
    });

    test('should detect valid JSON arrays', () => {
      const samples = [
        '[1, 2, 3, 4, 5]',
        '["apple", "banana", "cherry"]',
        '[{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]',
        '[]',
        '[true, false, null, 42, "string"]'
      ];
      
      samples.forEach(sample => {
        expect(jsonHandler.detect(sample)).toBe(true);
        expect(xmlHandler.detect(sample)).toBe(false);
        expect(yamlHandler.detect(sample)).toBe(false);
        expect(markdownHandler.detect(sample)).toBe(false);
      });
    });

    test('should not detect invalid JSON', () => {
      const samples = [
        '{name: "John"}', // Unquoted key
        "{'name': 'John'}", // Single quotes
        '{name: "John", age: 30,}', // Trailing comma
        'undefined',
        'function() { return true; }',
        '// Comment\n{"valid": true}'
      ];
      
      samples.forEach(sample => {
        expect(jsonHandler.detect(sample)).toBe(false);
      });
    });
  });

  describe('XML Detection', () => {
    test('should detect valid XML documents', () => {
      const samples = [
        '<root><child>value</child></root>',
        '<?xml version="1.0"?><document><item id="1">Content</item></document>',
        '<config>\n  <setting name="debug">true</setting>\n  <setting name="port">8080</setting>\n</config>',
        '<self-closing-tag />',
        '<namespace:element xmlns:namespace="http://example.com">content</namespace:element>'
      ];
      
      samples.forEach(sample => {
        expect(xmlHandler.detect(sample)).toBe(true);
        expect(jsonHandler.detect(sample)).toBe(false);
        expect(yamlHandler.detect(sample)).toBe(false);
        expect(markdownHandler.detect(sample)).toBe(false);
      });
    });

    test('should not detect HTML as XML', () => {
      const htmlSamples = [
        '<html><head><title>Page</title></head><body><p>Content</p></body></html>',
        '<div class="container"><span>Text</span></div>',
        '<img src="image.jpg" alt="Image" />',
        '<a href="http://example.com">Link</a>'
      ];
      
      htmlSamples.forEach(sample => {
        expect(xmlHandler.detect(sample)).toBe(false);
      });
    });

    test('should not detect malformed XML', () => {
      const samples = [
        '<unclosed>content',
        '<root><child>content</root>', // Mismatched tags
        '< invalid-start>content</invalid-start>',
        'This is not XML at all'
      ];
      
      samples.forEach(sample => {
        expect(xmlHandler.detect(sample)).toBe(false);
      });
    });
  });

  describe('YAML Detection', () => {
    test('should detect valid YAML documents', () => {
      const samples = [
        'name: John Doe\nage: 30\nactive: true',
        '---\nuser:\n  name: John\n  settings:\n    theme: dark\n    notifications: true',
        'items:\n  - apple\n  - banana\n  - cherry',
        'config:\n    server:\n        host: localhost\n        port: 8080\n    database:\n        host: db.example.com',
        '# Comment\nkey: value\n# Another comment\nother: value'
      ];
      
      samples.forEach(sample => {
        expect(yamlHandler.detect(sample)).toBe(true);
        expect(jsonHandler.detect(sample)).toBe(false);
        expect(xmlHandler.detect(sample)).toBe(false);
        expect(markdownHandler.detect(sample)).toBe(false);
      });
    });

    test('should detect YAML with document markers', () => {
      const samples = [
        '---\nname: value\n...',
        '---\nconfig:\n  setting: true\n---\nother_doc:\n  setting: false',
        '---\n# Document with just comments\n# and values\nkey: value'
      ];
      
      samples.forEach(sample => {
        expect(yamlHandler.detect(sample)).toBe(true);
      });
    });

    test('should not detect non-YAML content', () => {
      const samples = [
        'This is just plain text without structure',
        'function test() { return true; }',
        '<xml>This looks like XML</xml>',
        '{"json": "object"}'
      ];
      
      samples.forEach(sample => {
        expect(yamlHandler.detect(sample)).toBe(false);
      });
    });
  });

  describe('Markdown Detection', () => {
    test('should detect valid Markdown documents', () => {
      const samples = [
        '# Main Heading\n\nThis is a paragraph.\n\n## Subheading\n\nAnother paragraph.',
        '## Section\n\n- List item 1\n- List item 2\n- List item 3',
        '# Title\n\nParagraph with **bold** and *italic* text.\n\n```javascript\nfunction() {\n  return true;\n}\n```',
        'Heading\n=======\n\nSubheading\n----------\n\nContent here.',
        '> This is a blockquote\n> with multiple lines\n\nRegular paragraph.'
      ];
      
      samples.forEach(sample => {
        expect(markdownHandler.detect(sample)).toBe(true);
        expect(jsonHandler.detect(sample)).toBe(false);
        expect(xmlHandler.detect(sample)).toBe(false);
        expect(yamlHandler.detect(sample)).toBe(false);
      });
    });

    test('should detect Markdown with various features', () => {
      const samples = [
        '# Heading\n\n[Link](http://example.com) and `inline code`.',
        '- [ ] Todo item\n- [x] Completed item',
        '| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |',
        '![Image](image.jpg)\n\nCaption text.',
        '***\n\nHorizontal rule above.'
      ];
      
      samples.forEach(sample => {
        expect(markdownHandler.detect(sample)).toBe(true);
      });
    });

    test('should not detect plain text as Markdown', () => {
      const samples = [
        'This is just plain text without any markdown features.',
        'A simple sentence. Another sentence. No special formatting.',
        'name: value\nother: setting', // Looks like YAML
        '{"key": "value"}' // Looks like JSON
      ];
      
      samples.forEach(sample => {
        expect(markdownHandler.detect(sample)).toBe(false);
      });
    });
  });

  describe('Ambiguous Content Detection', () => {
    test('should handle content that could be multiple formats', () => {
      // Content that might look like YAML but is actually Markdown
      const yamlLikeMarkdown = '# Configuration\n\nserver:\n  This is not YAML, it\'s a paragraph about server.';
      
      expect(markdownHandler.detect(yamlLikeMarkdown)).toBe(true);
      expect(yamlHandler.detect(yamlLikeMarkdown)).toBe(true); // Both might detect it
      
      // But Markdown should have stronger signals due to heading
      const markdownScore = countMarkdownFeatures(yamlLikeMarkdown);
      const yamlScore = countYamlFeatures(yamlLikeMarkdown);
      expect(markdownScore).toBeGreaterThan(yamlScore);
    });

    test('should handle edge cases', () => {
      const edgeCases = [
        '', // Empty string
        '   \n\n  \t  ', // Only whitespace
        '123', // Just a number
        'true', // Just a boolean
        'null', // Just null
        '// Comment only'
      ];
      
      edgeCases.forEach(sample => {
        // Most handlers should reject these
        const detections = [
          jsonHandler.detect(sample),
          xmlHandler.detect(sample),
          yamlHandler.detect(sample),
          markdownHandler.detect(sample)
        ];
        
        // At most one format should claim it (and most should reject)
        const positiveDetections = detections.filter(d => d).length;
        expect(positiveDetections).toBeLessThanOrEqual(1);
      });
    });

    test('should handle mixed content scenarios', () => {
      // JSON embedded in Markdown
      const jsonInMarkdown = '# API Response\n\nThe API returns:\n\n```json\n{"status": "success", "data": []}\n```\n\nThis is the format.';
      
      expect(markdownHandler.detect(jsonInMarkdown)).toBe(true);
      expect(jsonHandler.detect(jsonInMarkdown)).toBe(false); // Should not detect as pure JSON
      
      // YAML embedded in Markdown
      const yamlInMarkdown = '# Configuration\n\nExample config:\n\n```yaml\nserver:\n  port: 8080\n  host: localhost\n```';
      
      expect(markdownHandler.detect(yamlInMarkdown)).toBe(true);
      expect(yamlHandler.detect(yamlInMarkdown)).toBe(false); // Should not detect as pure YAML
    });

    test('should prioritize format specificity', () => {
      // Valid JSON should be detected as JSON, not as text that happens to contain JSON-like features
      const validJson = '{\n  "users": [\n    {"name": "John", "age": 30},\n    {"name": "Jane", "age": 25}\n  ]\n}';
      
      expect(jsonHandler.detect(validJson)).toBe(true);
      expect(xmlHandler.detect(validJson)).toBe(false);
      expect(yamlHandler.detect(validJson)).toBe(false);
      expect(markdownHandler.detect(validJson)).toBe(false);
      
      // Valid XML should be detected as XML
      const validXml = '<?xml version="1.0"?>\n<users>\n  <user name="John" age="30" />\n  <user name="Jane" age="25" />\n</users>';
      
      expect(xmlHandler.detect(validXml)).toBe(true);
      expect(jsonHandler.detect(validXml)).toBe(false);
      expect(yamlHandler.detect(validXml)).toBe(false);
      expect(markdownHandler.detect(validXml)).toBe(false);
    });
  });

  describe('Format Detection Integration', () => {
    test('should provide consistent detection across handlers', () => {
      const testCases = [
        {
          content: '{"test": true}',
          expected: 'json'
        },
        {
          content: '<root><test>true</test></root>',
          expected: 'xml'
        },
        {
          content: 'test: true\nother: false',
          expected: 'yaml'
        },
        {
          content: '# Test\n\nThis is a test document.',
          expected: 'markdown'
        }
      ];
      
      testCases.forEach(({ content, expected }) => {
        const detections = {
          json: jsonHandler.detect(content),
          xml: xmlHandler.detect(content),
          yaml: yamlHandler.detect(content),
          markdown: markdownHandler.detect(content)
        };
        
        expect(detections[expected]).toBe(true);
        
        // Other formats should not detect it
        Object.keys(detections).forEach(format => {
          if (format !== expected) {
            expect(detections[format]).toBe(false);
          }
        });
      });
    });

    test('should handle format validation consistency', () => {
      const testCases = [
        {
          content: '{"valid": "json"}',
          handler: jsonHandler
        },
        {
          content: '<valid>xml</valid>',
          handler: xmlHandler
        },
        {
          content: 'valid: yaml',
          handler: yamlHandler
        },
        {
          content: '# Valid Markdown',
          handler: markdownHandler
        }
      ];
      
      testCases.forEach(({ content, handler }) => {
        // If detected, should also validate
        if (handler.detect(content)) {
          const validation = handler.validate(content);
          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        }
      });
    });
  });

  // Helper functions for scoring
  function countMarkdownFeatures(content) {
    let score = 0;
    if (/^#{1,6}\s+/.test(content)) score += 2;
    if (/^\s*[-*+]\s/.test(content)) score += 1;
    if (/\*\*[^*]+\*\*/.test(content)) score += 1;
    if (/\[[^\]]+\]\([^)]+\)/.test(content)) score += 1;
    if (/```/.test(content)) score += 2;
    return score;
  }

  function countYamlFeatures(content) {
    let score = 0;
    if (/^\w+:\s/.test(content)) score += 1;
    if (/^\s+\w+:\s/.test(content)) score += 1;
    if (/^\s*-\s/.test(content)) score += 1;
    if (/^---/.test(content)) score += 2;
    return score;
  }
});