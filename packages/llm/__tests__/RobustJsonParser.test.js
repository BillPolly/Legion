import { RobustJsonParser } from '../src/utils/RobustJsonParser.js';

describe('RobustJsonParser', () => {
  describe('parseFromText', () => {
    test('parses clean JSON object', () => {
      const text = '{"name": "John", "age": 30}';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({ name: "John", age: 30 });
    });

    test('parses clean JSON array', () => {
      const text = '[{"id": 1}, {"id": 2}]';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('extracts JSON from text with extra content', () => {
      const text = 'Here is the JSON: {"status": "success"} and that\'s it.';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({ status: "success" });
    });

    test('extracts JSON from code block', () => {
      const text = '```json\n{"name": "test"}\n```';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({ name: "test" });
    });

    test('extracts JSON from generic code block', () => {
      const text = '```\n{"result": true}\n```';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({ result: true });
    });

    test('handles JSON5 syntax with trailing commas', () => {
      const text = '{"name": "John", "age": 30,}';
      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({ name: "John", age: 30 });
    });

    test('throws error for invalid input', () => {
      expect(() => RobustJsonParser.parseFromText('')).toThrow();
      expect(() => RobustJsonParser.parseFromText(null)).toThrow();
      expect(() => RobustJsonParser.parseFromText('just text no json')).toThrow();
    });
  });

  describe('cleanText', () => {
    test('removes markdown formatting', () => {
      const text = '```json\n{"test": true}\n```';
      const cleaned = RobustJsonParser.cleanText(text);
      expect(cleaned).toBe('{"test": true}');
    });

    test('removes common prefixes', () => {
      const text = 'Here is the JSON: {"test": true}';
      const cleaned = RobustJsonParser.cleanText(text);
      expect(cleaned).toBe('the JSON: {"test": true}'); // "here is" gets removed, not "the json"
    });

    test('removes HTML entities', () => {
      const text = '{&quot;name&quot;: &quot;test&quot;}';
      const cleaned = RobustJsonParser.cleanText(text);
      expect(cleaned).toBe('{"name": "test"}');
    });
  });

  describe('extractJsonObject', () => {
    test('extracts valid JSON object', () => {
      const text = 'Some text {"key": "value"} more text';
      const result = RobustJsonParser.extractJsonObject(text);
      expect(result).toBe('{"key": "value"}');
    });

    test('extracts balanced nested object', () => {
      const text = 'Text {"outer": {"inner": "value"}} text';
      const result = RobustJsonParser.extractJsonObject(text);
      expect(result).toBe('{"outer": {"inner": "value"}}');
    });

    test('returns null for no JSON object', () => {
      const text = 'No JSON here at all';
      const result = RobustJsonParser.extractJsonObject(text);
      expect(result).toBeNull();
    });
  });

  describe('extractJsonArray', () => {
    test('extracts valid JSON array', () => {
      const text = 'Some text [{"id": 1}, {"id": 2}] more text';
      const result = RobustJsonParser.extractJsonArray(text);
      expect(result).toBe('[{"id": 1}, {"id": 2}]');
    });

    test('extracts balanced nested array', () => {
      const text = 'Text [[1, 2], [3, 4]] text';
      const result = RobustJsonParser.extractJsonArray(text);
      expect(result).toBe('[[1, 2], [3, 4]]');
    });

    test('returns null for no JSON array', () => {
      const text = 'No JSON array here';
      const result = RobustJsonParser.extractJsonArray(text);
      expect(result).toBeNull();
    });
  });

  describe('balanceJsonBraces', () => {
    test('balances nested braces correctly', () => {
      const text = '{"a": {"b": "c"}} extra';
      const result = RobustJsonParser.balanceJsonBraces(text, '{', '}');
      expect(result).toBe('{"a": {"b": "c"}}');
    });

    test('handles strings with escaped quotes', () => {
      const text = '{"text": "He said \\"hello\\""}';
      const result = RobustJsonParser.balanceJsonBraces(text, '{', '}');
      expect(result).toBe('{"text": "He said \\"hello\\""}');
    });

    test('ignores braces inside strings', () => {
      const text = '{"message": "This { is } in string"}';
      const result = RobustJsonParser.balanceJsonBraces(text, '{', '}');
      expect(result).toBe('{"message": "This { is } in string"}');
    });
  });

  describe('validateStructure', () => {
    test('validates object has expected keys', () => {
      const obj = { name: "John", age: 30, city: "NYC" };
      expect(RobustJsonParser.validateStructure(obj, ['name', 'age'])).toBe(true);
      expect(RobustJsonParser.validateStructure(obj, ['name', 'missing'])).toBe(false);
    });

    test('returns false for non-objects', () => {
      expect(RobustJsonParser.validateStructure(null, ['key'])).toBe(false);
      expect(RobustJsonParser.validateStructure("string", ['key'])).toBe(false);
      expect(RobustJsonParser.validateStructure(123, ['key'])).toBe(false);
    });
  });

  describe('parseAndValidate', () => {
    test('parses and validates successfully', () => {
      const text = '{"name": "John", "age": 30}';
      const result = RobustJsonParser.parseAndValidate(text, ['name', 'age']);
      expect(result).toEqual({ name: "John", age: 30 });
    });

    test('throws error for missing expected keys', () => {
      const text = '{"name": "John"}';
      expect(() => {
        RobustJsonParser.parseAndValidate(text, ['name', 'age']);
      }).toThrow('Parsed JSON missing expected keys: name, age');
    });
  });
});