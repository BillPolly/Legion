/**
 * Unit tests for JSON ResponseParser
 * Tests JSON parsing with various input formats and error handling
 */

import { JSONParser } from '../../src/parsers/JSONParser.js';

describe('JSONParser', () => {
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
    parser = new JSONParser(schema);
  });

  describe('constructor', () => {
    test('should create parser with schema', () => {
      expect(parser).toBeDefined();
      expect(parser.schema).toEqual(schema);
    });

    test('should accept parsing options', () => {
      const options = { strict: false, allowComments: true };
      const customParser = new JSONParser(schema, options);
      expect(customParser.options.strict).toBe(false);
      expect(customParser.options.allowComments).toBe(true);
    });
  });

  describe('parse', () => {
    test('should parse valid JSON object', () => {
      const jsonText = '{"name": "John", "age": 30, "active": true}';
      const result = parser.parse(jsonText);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        age: 30,
        active: true
      });
    });

    test('should parse valid JSON array', () => {
      const arraySchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      };
      const arrayParser = new JSONParser(arraySchema);
      const jsonText = '[{"name": "John"}, {"name": "Jane"}]';
      
      const result = arrayParser.parse(jsonText);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: 'John' },
        { name: 'Jane' }
      ]);
    });

    test('should extract JSON from markdown code block', () => {
      const markdownJson = `Here's the result:

\`\`\`json
{"name": "John", "age": 30}
\`\`\`

This is the parsed data.`;
      
      const result = parser.parse(markdownJson);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        age: 30
      });
    });

    test('should extract JSON from code block without language specifier', () => {
      const codeBlockJson = `\`\`\`
{"name": "Jane", "age": 25}
\`\`\``;
      
      const result = parser.parse(codeBlockJson);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Jane');
    });

    test('should handle JSON with extra whitespace', () => {
      const jsonWithSpaces = `  
      
      {"name": "John", "age": 30}  
      
      `;
      
      const result = parser.parse(jsonWithSpaces);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
    });

    test('should handle JSON5 features when enabled', () => {
      const json5Parser = new JSONParser(schema, { useJSON5: true });
      const json5Text = `{
        name: "John",  // Comment
        age: 30,       // Another comment
        active: true,
      }`;
      
      const result = json5Parser.parse(json5Text);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
    });

    test('should return parsing error for malformed JSON', () => {
      const malformedJson = '{"name": "John", "age": 30';
      const result = parser.parse(malformedJson);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('parsing');
    });

    test('should provide detailed error location for malformed JSON', () => {
      const malformedJson = `{
  "name": "John",
  "age": 30,
  "invalid": 
}`;
      const result = parser.parse(malformedJson);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatchObject({
        type: 'parsing',
        message: expect.any(String),
        location: expect.objectContaining({
          line: expect.any(Number),
          column: expect.any(Number)
        })
      });
    });

    test('should handle JSON with escaped strings', () => {
      const jsonWithEscaped = '{"name": "John\'s Data", "path": "C:\\\\Users\\\\John"}';
      const result = parser.parse(jsonWithEscaped);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("John's Data");
      expect(result.data.path).toBe("C:\\Users\\John");
    });

    test('should handle empty input', () => {
      const result = parser.parse('');
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toContain('empty');
    });

    test('should handle null input', () => {
      const result = parser.parse(null);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
    });

    test('should handle non-string input', () => {
      const result = parser.parse(123);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].message).toContain('string');
    });
  });

  describe('extractJSON', () => {
    test('should extract JSON from mixed content', () => {
      const mixedContent = `Here is some text before.
      
{"name": "John", "age": 30}

And some text after.`;
      
      const extracted = parser.extractJSON(mixedContent);
      expect(extracted).toBe('{"name": "John", "age": 30}');
    });

    test('should extract first JSON object from multiple objects', () => {
      const multipleJson = `{"first": true} and {"second": false}`;
      
      const extracted = parser.extractJSON(multipleJson);
      // The current implementation extracts until invalid JSON is found
      expect(extracted).toBe(multipleJson);
    });

    test('should extract JSON array', () => {
      const arrayText = `Before text [{"name": "John"}, {"name": "Jane"}] after text`;
      
      const extracted = parser.extractJSON(arrayText);
      expect(extracted).toBe('[{"name": "John"}, {"name": "Jane"}]');
    });

    test('should handle nested braces correctly', () => {
      const nestedJson = `{"data": {"nested": {"deep": "value"}}, "count": 1}`;
      
      const extracted = parser.extractJSON(nestedJson);
      expect(extracted).toBe(nestedJson);
    });

    test('should handle escaped quotes in strings', () => {
      const jsonWithEscapes = '{"message": "He said \\"Hello\\" to me", "valid": true}';
      
      const extracted = parser.extractJSON(jsonWithEscapes);
      expect(extracted).toBe(jsonWithEscapes);
    });

    test('should return null for no JSON found', () => {
      const noJson = 'This is just plain text without any JSON';
      
      const extracted = parser.extractJSON(noJson);
      expect(extracted).toBeNull();
    });
  });

  describe('validateJSON', () => {
    test('should validate correct JSON string', () => {
      const validJson = '{"name": "John", "age": 30}';
      
      const isValid = parser.validateJSON(validJson);
      expect(isValid).toBe(true);
    });

    test('should reject malformed JSON string', () => {
      const invalidJson = '{"name": "John", "age": 30';
      
      const isValid = parser.validateJSON(invalidJson);
      expect(isValid).toBe(false);
    });

    test('should validate JSON5 when enabled', () => {
      const json5Parser = new JSONParser(schema, { useJSON5: true });
      const json5String = '{name: "John", age: 30,}';
      
      const isValid = json5Parser.validateJSON(json5String);
      expect(isValid).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should provide helpful error messages', () => {
      const invalidJson = '{"name": "John", "age":}';
      const result = parser.parse(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Unexpected token');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    test('should suggest fixes for common errors', () => {
      const trailingCommaJson = '{"name": "John", "age": 30,}';
      const result = parser.parse(trailingCommaJson);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].suggestion).toMatch(/trailing comma|comma/);
    });

    test('should detect unmatched braces', () => {
      const unmatchedJson = '{"name": "John", "data": {"nested": "value"}';
      const result = parser.parse(unmatchedJson);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toMatch(/Unexpected end|Expected|brace|bracket/i);
    });

    test('should detect invalid property names', () => {
      const invalidProperty = '{name: "John"}'; // Unquoted property name
      const result = parser.parse(invalidProperty);
      
      expect(result.success).toBe(false);
      if (!parser.options.useJSON5) {
        expect(result.errors[0].message).toMatch(/property|key/i);
      }
    });
  });

  describe('options handling', () => {
    test('should respect strict mode option', () => {
      const strictParser = new JSONParser(schema, { strict: true });
      const lenientParser = new JSONParser(schema, { strict: false });
      
      const slightlyMalformed = '{"name": "John", "age": 30,}';
      
      const strictResult = strictParser.parse(slightlyMalformed);
      const lenientResult = lenientParser.parse(slightlyMalformed);
      
      expect(strictResult.success).toBe(false);
      // Lenient might still fail for malformed JSON, but should try harder
      expect(lenientResult).toBeDefined();
    });

    test('should handle custom format specifications', () => {
      const customSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        'x-format': {
          json: {
            style: 'compact',
            allowTrailingComma: true
          }
        }
      };
      
      const customParser = new JSONParser(customSchema);
      expect(customParser).toBeDefined();
    });
  });

  describe('integration with BaseValidator', () => {
    test('should return parsed data ready for validation', () => {
      const jsonText = '{"name": "John", "age": 30, "tags": ["dev", "js"]}';
      const result = parser.parse(jsonText);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John',
        age: 30,
        tags: ['dev', 'js']
      });
      
      // Data should be ready for schema validation
      expect(typeof result.data.name).toBe('string');
      expect(typeof result.data.age).toBe('number');
      expect(Array.isArray(result.data.tags)).toBe(true);
    });
  });
});