/**
 * Unit tests for FormatDetector class
 * Tests automatic format detection for LLM responses
 */

import { FormatDetector } from '../../src/FormatDetector.js';

describe('FormatDetector', () => {
  let detector;
  let schema;

  beforeEach(() => {
    schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name']
    };
    detector = new FormatDetector(schema);
  });

  describe('constructor', () => {
    test('should create detector with schema', () => {
      expect(detector).toBeDefined();
      expect(detector.schema).toEqual(schema);
    });

    test('should accept parsing configuration', () => {
      const config = {
        'format-detection': {
          strategies: ['json', 'xml']
        }
      };
      const detectorWithConfig = new FormatDetector(schema, config);
      expect(detectorWithConfig.config).toEqual(config);
    });
  });

  describe('detect', () => {
    test('should detect JSON format', () => {
      const jsonResponse = '{"name": "John", "age": 30}';
      const result = detector.detect(jsonResponse);
      
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect JSON in markdown code block', () => {
      const markdownJsonResponse = `
Here is the response:

\`\`\`json
{"name": "John", "age": 30}
\`\`\`
      `;
      
      const result = detector.detect(markdownJsonResponse);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect XML format', () => {
      const xmlResponse = '<response><name>John</name><age>30</age></response>';
      const result = detector.detect(xmlResponse);
      
      expect(result.format).toBe('xml');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect delimited sections format', () => {
      const delimitedResponse = `
---NAME---
John
---END-NAME---

---AGE---
30
---END-AGE---
      `;
      
      const result = detector.detect(delimitedResponse);
      expect(result.format).toBe('delimited');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect tagged content format', () => {
      const taggedResponse = '<NAME>John</NAME><AGE>30</AGE>';
      const result = detector.detect(taggedResponse);
      
      // May be detected as XML or tagged - both are acceptable
      expect(['tagged', 'xml']).toContain(result.format);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect markdown format', () => {
      const markdownResponse = `
## Name
John

## Age
30
      `;
      
      const result = detector.detect(markdownResponse);
      expect(result.format).toBe('markdown');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should return unknown for unrecognizable format', () => {
      const unrecognizableResponse = 'This is just plain text without any structure';
      const result = detector.detect(unrecognizableResponse);
      
      expect(result.format).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('getConfidenceScores', () => {
    test('should return confidence scores for all formats', () => {
      const jsonResponse = '{"name": "John", "age": 30}';
      const scores = detector.getConfidenceScores(jsonResponse);
      
      expect(scores).toHaveProperty('json');
      expect(scores).toHaveProperty('xml');
      expect(scores).toHaveProperty('delimited');
      expect(scores).toHaveProperty('tagged');
      expect(scores).toHaveProperty('markdown');
      
      expect(scores.json).toBeGreaterThan(0.8);
      expect(scores.xml).toBeLessThan(0.3);
    });

    test('should handle empty or null input', () => {
      const scores = detector.getConfidenceScores('');
      
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('isFormatSupported', () => {
    test('should return true for supported formats', () => {
      expect(detector.isFormatSupported('json')).toBe(true);
      expect(detector.isFormatSupported('xml')).toBe(true);
      expect(detector.isFormatSupported('delimited')).toBe(true);
      expect(detector.isFormatSupported('tagged')).toBe(true);
      expect(detector.isFormatSupported('markdown')).toBe(true);
    });

    test('should return false for unsupported formats', () => {
      expect(detector.isFormatSupported('yaml')).toBe(false);
      expect(detector.isFormatSupported('csv')).toBe(false);
      expect(detector.isFormatSupported('unknown')).toBe(false);
    });
  });

  describe('JSON detection', () => {
    test('should detect simple JSON object', () => {
      const response = '{"key": "value"}';
      const score = detector._detectJSON(response);
      expect(score).toBeGreaterThan(0.9);
    });

    test('should detect JSON array', () => {
      const response = '[{"name": "John"}, {"name": "Jane"}]';
      const score = detector._detectJSON(response);
      expect(score).toBeGreaterThan(0.9);
    });

    test('should handle malformed JSON', () => {
      const response = '{"key": "value"'; // Missing closing brace
      const score = detector._detectJSON(response);
      expect(score).toBeGreaterThan(0.2); // Still looks like JSON
      expect(score).toBeLessThan(0.9);
    });

    test('should detect JSON with extra whitespace', () => {
      const response = '   \n  {"key": "value"}  \n  ';
      const score = detector._detectJSON(response);
      expect(score).toBeGreaterThan(0.5);
    });

    test('should reject non-JSON text', () => {
      const response = 'This is plain text';
      const score = detector._detectJSON(response);
      expect(score).toBeLessThan(0.2);
    });
  });

  describe('XML detection', () => {
    test('should detect well-formed XML', () => {
      const response = '<root><item>value</item></root>';
      const score = detector._detectXML(response);
      expect(score).toBeGreaterThan(0.7);
    });

    test('should detect XML with attributes', () => {
      const response = '<root id="1"><item type="string">value</item></root>';
      const score = detector._detectXML(response);
      expect(score).toBeGreaterThan(0.9);
    });

    test('should handle self-closing tags', () => {
      const response = '<root><item value="test"/></root>';
      const score = detector._detectXML(response);
      expect(score).toBeGreaterThan(0.8);
    });

    test('should detect malformed XML', () => {
      const response = '<root><item>value</root>'; // Mismatched tags
      const score = detector._detectXML(response);
      expect(score).toBeGreaterThan(0.3); // Still looks XML-ish
      expect(score).toBeLessThan(0.7);
    });

    test('should reject non-XML text', () => {
      const response = 'This is plain text with < and > symbols';
      const score = detector._detectXML(response);
      expect(score).toBeLessThan(0.3);
    });
  });

  describe('delimited sections detection', () => {
    test('should detect standard delimited format', () => {
      const response = `
---SECTION1---
content1
---END-SECTION1---

---SECTION2---
content2
---END-SECTION2---
      `;
      const score = detector._detectDelimited(response);
      expect(score).toBeGreaterThan(0.8);
    });

    test('should detect delimited without END markers', () => {
      const response = `
---TITLE---
My Title

---CONTENT---
My Content
      `;
      const score = detector._detectDelimited(response);
      expect(score).toBeGreaterThan(0.7);
    });

    test('should detect custom delimiter patterns', () => {
      const response = `
===FIELD1===
value1
===FIELD2===
value2
      `;
      const score = detector._detectDelimited(response);
      expect(score).toBeGreaterThan(0.6);
    });
  });

  describe('tagged content detection', () => {
    test('should detect simple tagged content', () => {
      const response = '<FIELD1>value1</FIELD1><FIELD2>value2</FIELD2>';
      const score = detector._detectTagged(response);
      expect(score).toBeGreaterThan(0.6);
    });

    test('should detect tagged content with whitespace', () => {
      const response = `
<NAME>John</NAME>
<AGE>30</AGE>
      `;
      const score = detector._detectTagged(response);
      expect(score).toBeGreaterThan(0.7);
    });

    test('should distinguish from XML (simpler structure)', () => {
      const xmlResponse = '<root><child>value</child></root>';
      const taggedResponse = '<FIELD>value</FIELD>';
      
      const xmlScore = detector._detectTagged(xmlResponse);
      const taggedScore = detector._detectTagged(taggedResponse);
      
      expect(taggedScore).toBeGreaterThan(xmlScore);
    });
  });

  describe('markdown detection', () => {
    test('should detect markdown with headers', () => {
      const response = `
# Title
Content

## Section
More content
      `;
      const score = detector._detectMarkdown(response);
      expect(score).toBeGreaterThan(0.5);
    });

    test('should detect markdown with lists', () => {
      const response = `
## Items
- Item 1
- Item 2
- Item 3
      `;
      const score = detector._detectMarkdown(response);
      expect(score).toBeGreaterThan(0.4);
    });

    test('should detect markdown with code blocks', () => {
      const response = `
## Code
\`\`\`javascript
const x = 1;
\`\`\`
      `;
      const score = detector._detectMarkdown(response);
      expect(score).toBeGreaterThan(0.3);
    });
  });
});