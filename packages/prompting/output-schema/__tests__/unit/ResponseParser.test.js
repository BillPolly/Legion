/**
 * Unit tests for ResponseParser factory
 */

import { ResponseParser } from '../../src/ResponseParser.js';

describe('ResponseParser', () => {
  let parser;
  let schema;

  beforeEach(() => {
    schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };
    parser = new ResponseParser(schema);
  });

  test('should create parsers for all formats', () => {
    expect(parser.parsers.json).toBeDefined();
    expect(parser.parsers.xml).toBeDefined();
    expect(parser.parsers.delimited).toBeDefined();
    expect(parser.parsers.tagged).toBeDefined();
    expect(parser.parsers.markdown).toBeDefined();
  });

  test('should parse using specific format', () => {
    const jsonText = '{"name": "John", "age": 30}';
    const result = parser.parse(jsonText, 'json');
    
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('John');
  });

  test('should return error for unsupported format', () => {
    const result = parser.parse('some text', 'unsupported');
    
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('Unsupported format');
  });

  test('should return supported formats', () => {
    const formats = parser.getSupportedFormats();
    expect(formats).toContain('json');
    expect(formats).toContain('xml');
    expect(formats).toContain('delimited');
    expect(formats).toContain('tagged');
    expect(formats).toContain('markdown');
  });
});