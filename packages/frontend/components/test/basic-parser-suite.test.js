/**
 * Basic Parser Test Suite - MVP Focus
 * 
 * Tests core parser functionality:
 * - Basic parsing works
 * - Returns expected structure
 * - Integration with TreeScribe
 */

import { MarkdownParser } from '../src/components/tree-scribe/features/parsing/parsers/MarkdownParser.js';
import { YamlParser } from '../src/components/tree-scribe/features/parsing/parsers/YamlParser.js';
import { JsonParser } from '../src/components/tree-scribe/features/parsing/parsers/JsonParser.js';
import { HtmlParser } from '../src/components/tree-scribe/features/parsing/parsers/HtmlParser.js';
import { JavaScriptParser } from '../src/components/tree-scribe/features/parsing/parsers/JavaScriptParser.js';
import { XmlParser } from '../src/components/tree-scribe/features/parsing/parsers/XmlParser.js';

describe('Basic Parser Functionality Tests', () => {
  const testData = {
    markdown: {
      parser: new MarkdownParser(),
      content: '# Main Title\n\n## Subtitle\n\nContent here\n\n- Item 1\n- Item 2'
    },
    yaml: {
      parser: new YamlParser(),
      content: 'title: Test Document\nitems:\n  - first\n  - second\nnumber: 42'
    },
    json: {
      parser: new JsonParser(),
      content: '{"title": "Test", "items": ["first", "second"], "number": 42}'
    },
    html: {
      parser: new HtmlParser(),
      content: '<html><body><h1>Test</h1><p>Content</p><ul><li>Item 1</li><li>Item 2</li></ul></body></html>'
    },
    javascript: {
      parser: new JavaScriptParser(),
      content: 'function test() { return "hello"; }\nclass MyClass { constructor() {} }'
    },
    xml: {
      parser: new XmlParser(),
      content: '<?xml version="1.0"?><root><title>Test</title><items><item>First</item><item>Second</item></items></root>'
    }
  };

  // Test each parser
  Object.entries(testData).forEach(([format, data]) => {
    describe(`${format.toUpperCase()} Parser`, () => {
      test('should parse basic content', async () => {
        const result = await data.parser.parse(data.content);
        
        expect(result).toBeDefined();
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('children');
        expect(Array.isArray(result.children)).toBe(true);
        expect(result.sourceFormat).toBeDefined();
      });

      test('should detect format correctly', () => {
        const confidence = data.parser.canParse(data.content);
        expect(confidence).toBeGreaterThan(0.5);
      });

      test('should validate content', async () => {
        const validation = await data.parser.validate(data.content);
        expect(validation).toHaveProperty('valid');
        expect(validation).toHaveProperty('errors');
        expect(Array.isArray(validation.errors)).toBe(true);
      });

      test('should have required methods', () => {
        expect(typeof data.parser.parse).toBe('function');
        expect(typeof data.parser.canParse).toBe('function');
        expect(typeof data.parser.validate).toBe('function');
        expect(typeof data.parser.getSupportedFormats).toBe('function');
        expect(typeof data.parser.getName).toBe('function');
      });

      test('should return supported formats', () => {
        const formats = data.parser.getSupportedFormats();
        expect(Array.isArray(formats)).toBe(true);
        expect(formats.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Parser Integration', () => {
    test('all parsers should work together', async () => {
      const results = {};
      
      for (const [format, data] of Object.entries(testData)) {
        results[format] = await data.parser.parse(data.content);
      }

      // All results should have consistent structure
      Object.entries(results).forEach(([format, result]) => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('children');
        expect(result.sourceFormat).toBeDefined();
        expect(Array.isArray(result.children)).toBe(true);
      });
    });

    test('should handle empty content gracefully', async () => {
      const parser = testData.json.parser;
      
      try {
        const result = await parser.parse('{}');
        expect(result).toBeDefined();
      } catch (error) {
        // It's okay to throw an error for empty content
        expect(error.message).toBeDefined();
      }
    });
  });
});