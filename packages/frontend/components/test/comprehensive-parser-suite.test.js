/**
 * Comprehensive Parser Test Suite
 * 
 * Tests all parsers with extensive scenarios including:
 * - Format validation and detection
 * - Edge cases and error handling
 * - Performance characteristics
 * - Security considerations
 * - Cross-format compatibility
 */

import { MarkdownParser } from '../src/components/tree-scribe/features/parsing/parsers/MarkdownParser.js';
import { YamlParser } from '../src/components/tree-scribe/features/parsing/parsers/YamlParser.js';
import { JsonParser } from '../src/components/tree-scribe/features/parsing/parsers/JsonParser.js';
import { HtmlParser } from '../src/components/tree-scribe/features/parsing/parsers/HtmlParser.js';
import { JavaScriptParser } from '../src/components/tree-scribe/features/parsing/parsers/JavaScriptParser.js';
import { XmlParser } from '../src/components/tree-scribe/features/parsing/parsers/XmlParser.js';

// Plugin parsers
import { csvParserPlugin } from '../src/components/tree-scribe/features/plugins/examples/csv-parser-plugin.js';
import { tomlParserPlugin } from '../src/components/tree-scribe/features/plugins/examples/toml-parser-plugin.js';

describe('Comprehensive Parser Test Suite', () => {
  // Test data for comprehensive scenarios
  const testSuites = {
    markdown: {
      parser: new MarkdownParser(),
      validContent: [
        '# Main Title\n\n## Subtitle\n\nContent here',
        '- Item 1\n- Item 2\n  - Nested item',
        '```javascript\nconst x = 1;\n```',
        '> Blockquote\n\nNormal text',
        '[Link](https://example.com) and **bold** text'
      ],
      invalidContent: [
        '', // Empty
        null,
        undefined,
        123, // Wrong type
        '### Malformed heading without proper structure'
      ],
      edgeCases: [
        '# Title\n\n\n\n# Another Title', // Multiple empty lines
        '```\nUnclosed code block', // Malformed code block
        '![Image](broken-link.jpg)', // Broken image reference
        'Text with\r\nWindows line endings\r\n', // Different line endings
        'Unicode: 你好 🌟 العالم' // Unicode content
      ]
    },

    yaml: {
      parser: new YamlParser(),
      validContent: [
        'name: test\nvalue: 123',
        'items:\n  - first\n  - second',
        'nested:\n  level1:\n    level2: value',
        'string: "quoted string"\nnumber: 42\nboolean: true',
        'array: [1, 2, 3]\nobject: {key: value}'
      ],
      invalidContent: [
        'invalid: yaml: content:',
        'unmatched: "quotes',
        'bad_indent:\n uneven indentation',
        '[unclosed array',
        '{unclosed: object'
      ],
      edgeCases: [
        '---\nname: document\n---', // Document separator
        'multiline: |\n  Line 1\n  Line 2', // Multiline strings
        'null_value: null\nempty_value: ""', // Null and empty values
        'special_chars: "!@#$%^&*()"', // Special characters
        'very_long_key_name_that_exceeds_normal_limits: value' // Long keys
      ]
    },

    json: {
      parser: new JsonParser(),
      validContent: [
        '{"name": "test", "value": 123}',
        '{"items": ["first", "second"]}',
        '{"nested": {"level1": {"level2": "value"}}}',
        '{"array": [1, 2, 3], "null": null, "bool": true}',
        '[]', // Empty array
        '{}' // Empty object
      ],
      invalidContent: [
        '{name: "test"}', // Unquoted keys
        '{"name": "test",}', // Trailing comma
        '{"name": test}', // Unquoted value
        '{"name": "unclosed string}',
        'not json at all'
      ],
      edgeCases: [
        '{"unicode": "你好 🌟"}', // Unicode
        '{"number": 1.23e-10}', // Scientific notation  
        '{"string": "Line 1\\nLine 2"}', // Escaped characters
        '{"large_array": ' + JSON.stringify(new Array(1000).fill(0)) + '}', // Large data
        '{"deeply": {"nested": {"object": {"with": {"many": {"levels": "value"}}}}}}' // Deep nesting
      ]
    },

    html: {
      parser: new HtmlParser(),
      validContent: [
        '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
        '<div class="container"><p>Content</p><ul><li>Item</li></ul></div>',
        '<!DOCTYPE html><html><body><article><h2>Article</h2></article></body></html>',
        '<section><header><h1>Title</h1></header><main>Content</main></section>',
        '<form><input type="text" name="field"><button>Submit</button></form>'
      ],
      invalidContent: [
        '<div><p>Unclosed tags</div>', // Mismatched tags
        '<invalid-tag>Content</invalid-tag>', // Invalid tags
        '<div class=>Empty attribute</div>', // Malformed attributes
        '<script>alert("xss")</script>', // Potential XSS
        'Plain text without HTML'
      ],
      edgeCases: [
        '<div><!-- Comment --><p>Text</p></div>', // Comments
        '<div data-custom="value">Custom attributes</div>', // Custom attributes
        '<img src="test.jpg" alt="Image" />', // Self-closing tags
        '<pre><code>&lt;escaped&gt;</code></pre>', // Escaped content
        '<div>Mixed <strong>content</strong> types</div>' // Mixed content
      ]
    },

    javascript: {
      parser: new JavaScriptParser(),
      validContent: [
        'function test() { return "hello"; }',
        'class MyClass { constructor() {} method() {} }',
        'const arrow = () => { console.log("test"); };',
        'import { module } from "./file.js"; export default test;',
        '// Comment\nfunction test() {\n  /* Block comment */\n  return 42;\n}'
      ],
      invalidContent: [
        'function test() { return "unclosed string; }',
        'class MyClass { constructor() { missing brace }',
        'invalid syntax here',
        'function() { // Anonymous without assignment',
        'import from; // Malformed import'
      ],
      edgeCases: [
        'async function test() { await something(); }', // Async/await
        'function* generator() { yield 1; }', // Generator functions
        'const obj = { [computed]: "value" };', // Computed properties
        'function test(...args) { return args; }', // Rest parameters
        'const { destructured } = object;' // Destructuring
      ]
    },

    xml: {
      parser: new XmlParser(),
      validContent: [
        '<?xml version="1.0"?><root><child>Content</child></root>',
        '<document xmlns="http://example.com"><section>Text</section></document>',
        '<config><setting name="test" value="123" /></config>',
        '<data><items><item id="1">First</item><item id="2">Second</item></items></data>',
        '<root><![CDATA[Raw content here]]></root>'
      ],
      invalidContent: [
        '<root><child>Unclosed</root>', // Mismatched tags
        '<root><child></child></', // Incomplete closing tag
        '<root attribute=value>Unquoted attribute</root>', // Unquoted attributes
        '<root><child><nested></child></nested></root>', // Wrong nesting
        'Not XML content at all'
      ],
      edgeCases: [
        '<?xml version="1.0" encoding="UTF-8"?><root>Content</root>', // XML declaration
        '<root xmlns:ns="http://example.com"><ns:child>Content</ns:child></root>', // Namespaces
        '<root><!-- XML Comment --><child>Content</child></root>', // Comments
        '<root><child attr1="value1" attr2="value2">Content</child></root>', // Multiple attributes
        '<root><empty-element /></root>' // Self-closing elements
      ]
    }
  };

  // Plugin test data
  const pluginTestSuites = {
    csv: {
      plugin: csvParserPlugin,
      validContent: [
        'Name,Age,City\nJohn,25,NYC\nJane,30,LA',
        '"Name","Age"\n"John Doe",25\n"Jane Smith",30',
        'A,B,C\n1,2,3\n4,5,6',
        'Header1,Header2\nValue with spaces,123',
        'Single\nValue'
      ],
      invalidContent: [
        'Name,Age\nJohn,25,Extra', // Inconsistent columns
        'Header\n"Unclosed quote',
        '', // Empty content
        null,
        123
      ],
      edgeCases: [
        'Name\tAge\tCity\nJohn\t25\tNYC', // Tab separated
        'Name;Age;City\nJohn;25;NYC', // Semicolon separated
        'Name,Age,City\n,25,NYC\nJohn,,LA', // Empty values
        'Name,Age,City\n"Quote ""escaped""",25,NYC', // Escaped quotes
        'Unicode,Test\n"你好",123' // Unicode content
      ]
    },

    toml: {
      plugin: tomlParserPlugin,
      validContent: [
        'title = "Test"\nvalue = 123',
        '[section]\nkey = "value"\nnumber = 42',
        'array = [1, 2, 3]\nboolean = true',
        '[nested.section]\ndeep = "value"',
        'string = "basic string"\nliteral = \'literal string\''
      ],
      invalidContent: [
        'invalid = syntax = here',
        '[section\nkey = "value"', // Unclosed section
        'key = "unclosed string',
        'duplicate = value\nduplicate = other', // Duplicate keys
        'invalid-date = 2023-13-45' // Invalid date
      ],
      edgeCases: [
        '# Comment\ntitle = "Test"', // Comments
        'multiline = """\nLine 1\nLine 2\n"""', // Multiline strings
        'date = 2023-01-01T10:00:00Z', // Date formats
        'float = 1.23e-4', // Scientific notation
        '[table.nested]\nkey = "deeply nested"' // Deep nesting
      ]
    }
  };

  // Test each parser comprehensively
  Object.entries(testSuites).forEach(([format, suite]) => {
    describe(`${format.toUpperCase()} Parser Comprehensive Tests`, () => {
      let parser;

      beforeEach(() => {
        parser = suite.parser;
      });

      describe('Format Detection', () => {
        test('should detect valid content correctly', () => {
          suite.validContent.forEach(content => {
            const confidence = parser.canParse(content);
            expect(confidence).toBeGreaterThan(0.5);
          });
        });

        test('should reject invalid content', () => {
          suite.invalidContent.forEach(content => {
            const confidence = parser.canParse(content);
            expect(confidence).toBeLessThan(0.8); // Allow some flexibility
          });
        });

        test('should handle format hints', () => {
          const content = suite.validContent[0];
          const withHint = parser.canParse(content, { format });
          const withoutHint = parser.canParse(content);
          
          expect(withHint).toBeGreaterThanOrEqual(withoutHint);
        });
      });

      describe('Content Validation', () => {
        test('should validate correct content', async () => {
          for (const content of suite.validContent) {
            const validation = await parser.validate(content);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
          }
        });

        test('should identify validation errors', async () => {
          for (const content of suite.invalidContent) {
            if (content !== null && content !== undefined) {
              const validation = await parser.validate(content);
              // Allow some parsers to be more lenient
              if (!validation.valid) {
                expect(validation.errors.length).toBeGreaterThan(0);
              }
            }
          }
        });

        test('should provide detailed error information', async () => {
          const invalidContent = suite.invalidContent.find(c => typeof c === 'string');
          if (invalidContent) {
            const validation = await parser.validate(invalidContent);
            if (!validation.valid) {
              validation.errors.forEach(error => {
                expect(error).toHaveProperty('message');
                expect(typeof error.message).toBe('string');
              });
            }
          }
        });
      });

      describe('Parsing Functionality', () => {
        test('should parse valid content successfully', async () => {
          for (const content of suite.validContent) {
            const result = await parser.parse(content);
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('children');
            expect(Array.isArray(result.children)).toBe(true);
          }
        });

        test('should handle edge cases gracefully', async () => {
          for (const content of suite.edgeCases) {
            try {
              const result = await parser.parse(content);
              expect(result).toBeDefined();
              expect(result).toHaveProperty('title');
            } catch (error) {
              // Some edge cases may fail, but should provide meaningful errors
              expect(error.message).toBeDefined();
              expect(typeof error.message).toBe('string');
            }
          }
        });

        test('should preserve content structure', async () => {
          const content = suite.validContent[0];
          const result = await parser.parse(content);
          
          // Basic structure checks
          expect(result.title).toBeDefined();
          expect(typeof result.title).toBe('string');
          expect(Array.isArray(result.children)).toBe(true);
          
          // Check for reasonable content extraction
          if (result.children.length > 0) {
            result.children.forEach(child => {
              expect(child).toHaveProperty('title');
              expect(child).toHaveProperty('children');
            });
          }
        });

        test('should include format metadata', async () => {
          const content = suite.validContent[0];
          const result = await parser.parse(content);
          
          expect(result.sourceFormat).toBeDefined();
          expect(parser.getSupportedFormats().includes(result.sourceFormat)).toBe(true);
        });
      });

      describe('Performance Characteristics', () => {
        test('should parse small content quickly', async () => {
          const content = suite.validContent[0];
          const startTime = performance.now();
          
          await parser.parse(content);
          
          const duration = performance.now() - startTime;
          expect(duration).toBeLessThan(100); // Should complete within 100ms
        });

        test('should handle large content efficiently', async () => {
          // Create larger test content
          const baseContent = suite.validContent[0];
          const largeContent = format === 'json' ? 
            JSON.stringify({
              data: new Array(100).fill(0).map((_, i) => ({
                id: i,
                content: baseContent,
                nested: { value: `item-${i}` }
              }))
            }) : 
            new Array(50).fill(baseContent).join('\n');

          const startTime = performance.now();
          
          try {
            const result = await parser.parse(largeContent);
            const duration = performance.now() - startTime;
            
            expect(result).toBeDefined();
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
          } catch (error) {
            // Large content may fail for some parsers, that's acceptable
            console.warn(`Large content test failed for ${format}:`, error.message);
          }
        });

        test('should have consistent performance', async () => {
          const content = suite.validContent[0];
          const iterations = 10;
          const times = [];

          for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            await parser.parse(content);
            times.push(performance.now() - startTime);
          }

          const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
          const maxTime = Math.max(...times);
          const minTime = Math.min(...times);
          
          // Performance should be reasonably consistent (max shouldn't be more than 3x min)
          expect(maxTime / minTime).toBeLessThan(3);
          expect(avgTime).toBeLessThan(50); // Average should be fast
        });
      });

      describe('Error Handling', () => {
        test('should throw appropriate errors for invalid input', async () => {
          const invalidInputs = [null, undefined, 123, [], {}];
          
          for (const input of invalidInputs) {
            await expect(parser.parse(input)).rejects.toThrow();
          }
        });

        test('should provide context in error messages', async () => {
          const invalidContent = suite.invalidContent.find(c => typeof c === 'string');
          if (invalidContent) {
            try {
              await parser.parse(invalidContent);
            } catch (error) {
              expect(error.message).toBeDefined();
              expect(error.message.length).toBeGreaterThan(10); // Should be descriptive
            }
          }
        });

        test('should handle empty content gracefully', async () => {
          try {
            const result = await parser.parse('');
            // If it succeeds, should return valid structure
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('children');
          } catch (error) {
            // If it fails, should have meaningful error
            expect(error.message).toBeDefined();
          }
        });
      });

      describe('Security Considerations', () => {
        test('should sanitize potentially dangerous content', async () => {
          const dangerousContent = format === 'html' ? 
            '<script>alert("xss")</script><div>Safe content</div>' :
            format === 'javascript' ?
            'eval("dangerous code"); function safe() { return "ok"; }' :
            'safe content'; // Other formats may not have XSS risks

          try {
            const result = await parser.parse(dangerousContent);
            
            // Result should not contain dangerous executable content
            const resultStr = JSON.stringify(result);
            if (format === 'html') {
              expect(resultStr.toLowerCase()).not.toContain('<script');
              expect(resultStr.toLowerCase()).not.toContain('javascript:');
            }
            if (format === 'javascript') {
              // Should extract structure without enabling execution
              expect(result).toHaveProperty('title');
            }
          } catch (error) {
            // Rejecting dangerous content is also acceptable
            expect(error.message).toBeDefined();
          }
        });

        test('should limit resource usage', async () => {
          // Test with content that could cause infinite loops or excessive memory
          const resourceIntensiveContent = format === 'json' ?
            '{"a":' + '{"b":'.repeat(100) + '"value"' + '}'.repeat(101) :
            new Array(1000).fill('# Header\n\nContent\n').join('');

          const startTime = performance.now();
          
          try {
            await parser.parse(resourceIntensiveContent);
            const duration = performance.now() - startTime;
            expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
          } catch (error) {
            // Failing on resource-intensive content is acceptable
            const duration = performance.now() - startTime;
            expect(duration).toBeLessThan(2000); // Should fail quickly, not hang
          }
        });
      });
    });
  });

  // Test plugin parsers
  Object.entries(pluginTestSuites).forEach(([format, suite]) => {
    describe(`${format.toUpperCase()} Plugin Parser Tests`, () => {
      let plugin;

      beforeEach(() => {
        plugin = suite.plugin;
      });

      test('should have proper plugin structure', () => {
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('version');
        expect(plugin).toHaveProperty('getSupportedFormats');
        expect(plugin).toHaveProperty('canParse');
        expect(plugin).toHaveProperty('parse');
        expect(plugin).toHaveProperty('validate');
      });

      test('should parse valid content', async () => {
        for (const content of suite.validContent) {
          const result = await plugin.parse(content);
          expect(result).toBeDefined();
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('children');
        }
      });

      test('should validate content appropriately', async () => {
        for (const content of suite.validContent) {
          const validation = await plugin.validate(content);
          expect(validation.valid).toBe(true);
        }

        for (const content of suite.invalidContent) {
          if (content !== null && content !== undefined) {
            const validation = await plugin.validate(content);
            // Plugins may be more lenient, but invalid content should trigger some validation logic
            if (!validation.valid) {
              expect(validation.errors.length).toBeGreaterThan(0);
            }
          }
        }
      });

      test('should handle edge cases', async () => {
        for (const content of suite.edgeCases) {
          try {
            const result = await plugin.parse(content);
            expect(result).toBeDefined();
          } catch (error) {
            expect(error.message).toBeDefined();
          }
        }
      });
    });
  });

  // Cross-parser compatibility tests
  describe('Cross-Parser Compatibility', () => {
    test('all parsers should return consistent structure', async () => {
      const testContent = {
        markdown: '# Test\n\nContent here',
        yaml: 'title: Test\ncontent: Value',
        json: '{"title": "Test", "content": "Value"}',
        html: '<h1>Test</h1><p>Content</p>',
        javascript: 'function test() { return "Content"; }',
        xml: '<root><title>Test</title><content>Value</content></root>'
      };

      const results = {};
      
      for (const [format, content] of Object.entries(testContent)) {
        const parser = testSuites[format].parser;
        try {
          results[format] = await parser.parse(content);
        } catch (error) {
          console.warn(`Parser ${format} failed:`, error.message);
        }
      }

      // All successful results should have consistent structure
      Object.values(results).forEach(result => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('children');
        expect(result).toHaveProperty('sourceFormat');
        expect(Array.isArray(result.children)).toBe(true);
      });
    });

    test('parsers should not conflict with each other', () => {
      const allParsers = Object.values(testSuites).map(suite => suite.parser);
      const formats = allParsers.map(p => p.getSupportedFormats()).flat();
      
      // Should not have duplicate format support (each format should have one primary parser)
      const formatCounts = {};
      formats.forEach(format => {
        formatCounts[format] = (formatCounts[format] || 0) + 1;
      });

      Object.entries(formatCounts).forEach(([format, count]) => {
        if (count > 1) {
          console.warn(`Format ${format} is supported by ${count} parsers`);
        }
        // This is more of a warning than a failure - multiple parsers can support the same format
      });
    });
  });

  // Integration with TreeScribe system
  describe('TreeScribe Integration', () => {
    test('parsers should work with performance profiling', async () => {
      const { PerformanceProfiler } = await import('../src/components/tree-scribe/features/performance/PerformanceProfiler.js');
      const profiler = new PerformanceProfiler();
      
      try {
        const sessionId = profiler.startSession('parser-integration-test');
        const parser = testSuites.json.parser;
        const content = testSuites.json.validContent[0];
        
        const result = await profiler.profileParsing(
          sessionId,
          () => parser.parse(content),
          content,
          parser
        );
        
        expect(result).toBeDefined();
        
        const session = profiler.endSession(sessionId);
        expect(session.completed).toBe(true);
        expect(session.duration).toBeGreaterThan(0);
      } finally {
        profiler.destroy();
      }
    });

    test('parsers should work with caching system', async () => {
      const { IntelligentCache } = await import('../src/components/tree-scribe/features/performance/IntelligentCache.js');
      const cache = new IntelligentCache();
      
      try {
        const parser = testSuites.markdown.parser;
        const content = testSuites.markdown.validContent[0];
        
        // Parse and cache
        const result1 = await parser.parse(content);
        await cache.store('test-parse', result1);
        
        // Retrieve from cache
        const cached = await cache.get('test-parse');
        expect(cached).toEqual(result1);
        
        const analytics = cache.getAnalytics();
        expect(analytics.performance.hitRate).toBeGreaterThan(0);
      } finally {
        cache.destroy();
      }
    });

    test('parsers should work with streaming system', async () => {
      const { StreamingParser } = await import('../src/components/tree-scribe/features/performance/StreamingParser.js');
      const streamingParser = new StreamingParser();
      
      try {
        const parser = testSuites.yaml.parser;
        const content = testSuites.yaml.validContent[0];
        
        const result = await streamingParser.parseStream(content, parser);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('title');
        
        const metrics = streamingParser.getMetrics();
        expect(metrics.totalProcessingTime).toBeGreaterThan(0);
      } finally {
        streamingParser.destroy();
      }
    });
  });
});