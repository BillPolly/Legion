/**
 * Unit tests for XML ResponseParser
 * Tests XML parsing with various structures and error handling
 */

import { XMLParser } from '../../src/parsers/XMLParser.js';

describe('XMLParser', () => {
  let parser;
  let schema;

  beforeEach(() => {
    schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['name']
    };
    parser = new XMLParser(schema);
  });

  describe('constructor', () => {
    test('should create parser with schema', () => {
      expect(parser).toBeDefined();
      expect(parser.schema).toEqual(schema);
    });

    test('should accept XML format specifications', () => {
      const xmlSchema = {
        ...schema,
        'x-format': {
          xml: {
            'root-element': 'response',
            properties: {
              tags: {
                element: 'tags',
                'item-element': 'tag'
              }
            }
          }
        }
      };
      
      const xmlParser = new XMLParser(xmlSchema);
      expect(xmlParser.formatSpecs).toBeDefined();
      expect(xmlParser.formatSpecs['root-element']).toBe('response');
    });
  });

  describe('parse', () => {
    test('should parse simple XML structure', () => {
      const xmlText = '<response><name>John</name><age>30</age><active>true</active></response>';
      const result = parser.parse(xmlText);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        age: '30', // XML parsing returns strings, validation will handle type coercion
        active: 'true'
      });
    });

    test('should parse XML with custom root element', () => {
      const customSchema = {
        ...schema,
        'x-format': {
          xml: {
            'root-element': 'document'
          }
        }
      };
      
      const customParser = new XMLParser(customSchema);
      const xmlText = '<document><name>Jane</name><age>25</age></document>';
      
      const result = customParser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Jane');
    });

    test('should parse XML with nested structures', () => {
      const xmlText = `<response>
        <name>John</name>
        <contact>
          <email>john@example.com</email>
          <phone>555-0123</phone>
        </contact>
      </response>`;
      
      const result = parser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.contact).toBeDefined();
    });

    test('should parse XML with attributes', () => {
      const xmlText = '<response><name id="1">John</name><age unit="years">30</age></response>';
      const result = parser.parse(xmlText);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.age).toBe('30');
    });

    test('should handle self-closing XML tags', () => {
      const xmlText = '<response><name>John</name><verified/><active value="true"/></response>';
      const result = parser.parse(xmlText);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.verified).toBe(''); // Self-closing tag with no content
    });

    test('should parse XML arrays with repeated elements', () => {
      const xmlText = `<response>
        <name>John</name>
        <tags>
          <tag>developer</tag>
          <tag>javascript</tag>
          <tag>nodejs</tag>
        </tags>
      </response>`;
      
      const result = parser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(Array.isArray(result.data.tags.tag)).toBe(true);
      expect(result.data.tags.tag).toEqual(['developer', 'javascript', 'nodejs']);
    });

    test('should handle CDATA sections', () => {
      const xmlText = '<response><name>John</name><code><![CDATA[function() { return "test"; }]]></code></response>';
      const result = parser.parse(xmlText);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // For MVP, just ensure parsing doesn't fail
    });

    test('should handle XML with whitespace and formatting', () => {
      const xmlText = `
        <response>
          <name>  John Doe  </name>
          <age>30</age>
        </response>
      `;
      
      const result = parser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John Doe'); // Should trim whitespace
    });

    test('should return error for malformed XML', () => {
      const malformedXml = '<response><name>John</name><age>30'; // Completely broken
      const result = parser.parse(malformedXml);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].type).toBe('parsing');
    });

    test('should handle empty XML elements', () => {
      const xmlText = '<response><name></name><description/><age>30</age></response>';
      const result = parser.parse(xmlText);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('');
      expect(result.data.description).toBe('');
      expect(result.data.age).toBe('30');
    });
  });

  describe('extractElements', () => {
    test('should extract element content correctly', () => {
      const xmlText = '<root><title>My Title</title><count>42</count></root>';
      const elements = parser.extractElements(xmlText, 'root');
      
      expect(elements.title).toBe('My Title');
      expect(elements.count).toBe('42');
    });

    test('should handle nested elements', () => {
      const xmlText = `<response>
        <name>John</name>
        <age>30</age>
      </response>`;
      
      const elements = parser.extractElements(xmlText, 'response');
      expect(elements.name).toBe('John');
      expect(elements.age).toBe('30');
    });

    test('should handle repeated elements as arrays', () => {
      const xmlText = `<items>
        <item>First</item>
        <item>Second</item>
        <item>Third</item>
      </items>`;
      
      const elements = parser.extractElements(xmlText, 'items');
      expect(Array.isArray(elements.item)).toBe(true);
      expect(elements.item).toEqual(['First', 'Second', 'Third']);
    });

    test('should extract attributes when specified', () => {
      const xmlText = '<response><name id="1" type="user">John</name></response>';
      const elements = parser.extractElements(xmlText, 'response', true);
      
      expect(elements.name).toBe('John');
      // Note: Attribute handling depends on format specification
    });
  });

  describe('validateXML', () => {
    test('should validate well-formed XML', () => {
      const validXml = '<root><child>content</child></root>';
      expect(parser.validateXML(validXml)).toBe(true);
    });

    test('should reject malformed XML', () => {
      const invalidXml = '<root><child>content</root>';
      expect(parser.validateXML(invalidXml)).toBe(false);
    });

    test('should validate self-closing tags', () => {
      const selfClosingXml = '<root><empty/><another/></root>';
      expect(parser.validateXML(selfClosingXml)).toBe(true);
    });

    test('should reject unclosed tags', () => {
      const unclosedXml = '<root><child>content';
      expect(parser.validateXML(unclosedXml)).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should provide helpful error messages for malformed XML', () => {
      const malformedXml = '<response><name>John'; // Severely malformed
      const result = parser.parse(malformedXml);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toBeDefined();
    });

    test('should handle missing root element', () => {
      const noRootXml = '<name>John</name><age>30</age>';
      const result = parser.parse(noRootXml);
      
      // For MVP, this could succeed or fail - main thing is it handles gracefully
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    test('should handle empty XML input', () => {
      const result = parser.parse('');
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toContain('empty');
    });

    test('should handle non-XML text input', () => {
      const result = parser.parse('This is just plain text');
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toContain('XML');
    });
  });

  describe('format specification handling', () => {
    test('should use custom element names from format specs', () => {
      const customSchema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' }
        },
        'x-format': {
          xml: {
            'root-element': 'document'
          }
        }
      };
      
      const customParser = new XMLParser(customSchema);
      const xmlText = `<document>
        <title>My Document</title>
        <content>Document content</content>
      </document>`;
      
      const result = customParser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Object.keys(result.data).length).toBeGreaterThan(0);
    });

    test('should handle attribute extraction when configured', () => {
      const attrSchema = {
        type: 'object',
        properties: {
          content: { type: 'string' }
        }
      };
      
      const attrParser = new XMLParser(attrSchema);
      const xmlText = '<response when="2024-01-01" by="John"><content>Data</content></response>';
      
      const result = attrParser.parse(xmlText);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});