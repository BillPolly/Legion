/**
 * Format Switching Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Format Switching', () => {
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

  describe('Format Auto-Detection Logic', () => {
    test('should create format detection utility', () => {
      const FormatDetector = {
        detectFormat(content) {
          const handlers = [
            { name: 'json', handler: jsonHandler },
            { name: 'xml', handler: xmlHandler },
            { name: 'yaml', handler: yamlHandler },
            { name: 'markdown', handler: markdownHandler }
          ];
          
          for (const { name, handler } of handlers) {
            if (handler.detect(content)) {
              return name;
            }
          }
          
          return 'unknown';
        },
        
        getAllDetections(content) {
          return {
            json: jsonHandler.detect(content),
            xml: xmlHandler.detect(content),
            yaml: yamlHandler.detect(content),
            markdown: markdownHandler.detect(content)
          };
        }
      };
      
      expect(FormatDetector.detectFormat('{"test": true}')).toBe('json');
      expect(FormatDetector.detectFormat('<test>true</test>')).toBe('xml');
      expect(FormatDetector.detectFormat('test: true')).toBe('yaml');
      expect(FormatDetector.detectFormat('# Test')).toBe('markdown');
      expect(FormatDetector.detectFormat('plain text')).toBe('unknown');
    });

    test('should handle detection priority', () => {
      const FormatDetector = {
        detectFormatWithPriority(content) {
          // Priority order: JSON (most specific) -> XML -> YAML -> Markdown (most general)
          const handlers = [
            { name: 'json', handler: jsonHandler, priority: 4 },
            { name: 'xml', handler: xmlHandler, priority: 3 },
            { name: 'yaml', handler: yamlHandler, priority: 2 },
            { name: 'markdown', handler: markdownHandler, priority: 1 }
          ];
          
          const detections = handlers
            .filter(({ handler }) => handler.detect(content))
            .sort((a, b) => b.priority - a.priority);
          
          return detections.length > 0 ? detections[0].name : 'unknown';
        }
      };
      
      // JSON should win over others when ambiguous
      const jsonLike = '{"key": "value"}';
      expect(FormatDetector.detectFormatWithPriority(jsonLike)).toBe('json');
      
      // XML should win over YAML/Markdown when ambiguous
      const xmlLike = '<config><setting>value</setting></config>';
      expect(FormatDetector.detectFormatWithPriority(xmlLike)).toBe('xml');
    });
  });

  describe('Ambiguous Content Handling', () => {
    test('should handle content that could be multiple formats', () => {
      const ambiguousCases = [
        {
          content: 'title: "My Document"\nauthor: "John Doe"',
          possibleFormats: ['yaml'], // Could be YAML front matter or YAML document
          preferredFormat: 'yaml'
        },
        {
          content: '# Configuration\n\nserver: localhost\nport: 8080',
          possibleFormats: ['markdown', 'yaml'], // Has heading but also key-value pairs
          preferredFormat: 'markdown' // Heading suggests Markdown
        },
        {
          content: '- item 1\n- item 2\n- item 3',
          possibleFormats: ['yaml', 'markdown'], // Could be YAML array or Markdown list
          preferredFormat: 'yaml' // More likely YAML syntax
        }
      ];
      
      ambiguousCases.forEach(({ content, possibleFormats, preferredFormat }) => {
        const detections = {
          json: jsonHandler.detect(content),
          xml: xmlHandler.detect(content),
          yaml: yamlHandler.detect(content),
          markdown: markdownHandler.detect(content)
        };
        
        // Check that at least the expected formats detect it
        possibleFormats.forEach(format => {
          expect(detections[format]).toBe(true);
        });
        
        // Preferred format should be detected
        expect(detections[preferredFormat]).toBe(true);
      });
    });

    test('should handle edge cases in detection', () => {
      const edgeCases = [
        {
          content: '', // Empty content
          expectAllFalse: true
        },
        {
          content: '   \n\n   ', // Whitespace only
          expectAllFalse: true
        },
        {
          content: '42', // Just a number
          expectAllFalse: true
        },
        {
          content: 'hello world', // Plain text
          expectAllFalse: true
        },
        {
          content: '# ', // Incomplete heading
          expectAllFalse: true
        }
      ];
      
      edgeCases.forEach(({ content, expectAllFalse }) => {
        const detections = [
          jsonHandler.detect(content),
          xmlHandler.detect(content),
          yamlHandler.detect(content),
          markdownHandler.detect(content)
        ];
        
        if (expectAllFalse) {
          expect(detections.every(d => d === false)).toBe(true);
        }
      });
    });
  });

  describe('Format Conversion Testing', () => {
    test('should test format conversion workflows', () => {
      const testData = {
        json: '{"name": "John", "age": 30, "skills": ["JavaScript", "Python"]}',
        yaml: 'name: John\nage: 30\nskills:\n  - JavaScript\n  - Python',
        markdown: '# User Profile\n\n**Name:** John  \n**Age:** 30  \n**Skills:**\n- JavaScript\n- Python'
      };
      
      // Test that each format parses correctly
      expect(() => jsonHandler.parse(testData.json)).not.toThrow();
      expect(() => yamlHandler.parse(testData.yaml)).not.toThrow();
      expect(() => markdownHandler.parse(testData.markdown)).not.toThrow();
      
      // Test that detection works correctly
      expect(jsonHandler.detect(testData.json)).toBe(true);
      expect(yamlHandler.detect(testData.yaml)).toBe(true);
      expect(markdownHandler.detect(testData.markdown)).toBe(true);
      
      // Test that wrong formats don't detect
      expect(jsonHandler.detect(testData.yaml)).toBe(false);
      expect(yamlHandler.detect(testData.json)).toBe(false);
      expect(markdownHandler.detect(testData.json)).toBe(false);
    });

    test('should handle format validation', () => {
      const validSamples = {
        json: '{"valid": true, "number": 42}',
        xml: '<valid><number>42</number></valid>',
        yaml: 'valid: true\nnumber: 42',
        markdown: '# Valid\n\nNumber: 42'
      };
      
      const invalidSamples = {
        json: '{invalid: json}',
        xml: '<invalid><unclosed>xml</invalid>',
        yaml: 'invalid:\n  yaml: content:\n  more', // Invalid indentation
        markdown: '' // Empty is not necessarily invalid for markdown
      };
      
      // Valid samples should validate
      Object.entries(validSamples).forEach(([format, content]) => {
        const handler = { json: jsonHandler, xml: xmlHandler, yaml: yamlHandler, markdown: markdownHandler }[format];
        const validation = handler.validate(content);
        expect(validation.valid).toBe(true);
      });
      
      // Invalid samples should not validate (except empty markdown)
      Object.entries(invalidSamples).forEach(([format, content]) => {
        if (format === 'markdown' && content === '') return; // Skip empty markdown
        
        const handler = { json: jsonHandler, xml: xmlHandler, yaml: yamlHandler, markdown: markdownHandler }[format];
        const validation = handler.validate(content);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Format Metadata', () => {
    test('should provide format metadata', () => {
      const handlers = [
        { name: 'json', handler: jsonHandler },
        { name: 'xml', handler: xmlHandler },
        { name: 'yaml', handler: yamlHandler },
        { name: 'markdown', handler: markdownHandler }
      ];
      
      handlers.forEach(({ name, handler }) => {
        const metadata = handler.getMetadata();
        
        expect(metadata).toBeDefined();
        expect(metadata.format).toBe(name);
        expect(metadata.mimeType).toBeDefined();
        expect(metadata.fileExtensions).toBeDefined();
        expect(Array.isArray(metadata.fileExtensions)).toBe(true);
        expect(metadata.fileExtensions.length).toBeGreaterThan(0);
      });
    });

    test('should have correct file extensions', () => {
      expect(jsonHandler.getMetadata().fileExtensions).toContain('.json');
      expect(xmlHandler.getMetadata().fileExtensions).toContain('.xml');
      expect(yamlHandler.getMetadata().fileExtensions).toContain('.yaml');
      expect(yamlHandler.getMetadata().fileExtensions).toContain('.yml');
      expect(markdownHandler.getMetadata().fileExtensions).toContain('.md');
      expect(markdownHandler.getMetadata().fileExtensions).toContain('.markdown');
    });

    test('should have correct MIME types', () => {
      expect(jsonHandler.getMetadata().mimeType).toBe('application/json');
      expect(xmlHandler.getMetadata().mimeType).toBe('application/xml');
      expect(yamlHandler.getMetadata().mimeType).toBe('application/x-yaml');
      expect(markdownHandler.getMetadata().mimeType).toBe('text/markdown');
    });
  });

  describe('Format Detection Performance', () => {
    test('should handle large content efficiently', () => {
      // Generate large content for each format
      const largeJson = JSON.stringify({
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random()
        }))
      });
      
      const largeYaml = Array.from({ length: 1000 }, (_, i) => 
        `item_${i}:\n  id: ${i}\n  name: Item ${i}\n  value: ${Math.random()}`
      ).join('\n');
      
      const largeMarkdown = '# Large Document\n\n' + 
        Array.from({ length: 1000 }, (_, i) => 
          `## Section ${i}\n\nContent for section ${i}.\n`
        ).join('\n');
      
      // Detection should complete quickly
      const startTime = Date.now();
      
      expect(jsonHandler.detect(largeJson)).toBe(true);
      expect(yamlHandler.detect(largeYaml)).toBe(true);
      expect(markdownHandler.detect(largeMarkdown)).toBe(true);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should limit detection scope for performance', () => {
      // Very large content - detection should still be fast by only checking first part
      const veryLargeContent = '# Heading\n\n' + 'Content line.\n'.repeat(10000);
      
      const startTime = Date.now();
      const isMarkdown = markdownHandler.detect(veryLargeContent);
      const endTime = Date.now();
      
      expect(isMarkdown).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast due to early detection
    });
  });
});