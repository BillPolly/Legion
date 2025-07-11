const ResponseParser = require('../../src/response-parser/ResponseParser');

describe('ResponseParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ResponseParser();
  });

  describe('parse()', () => {
    describe('valid JSON', () => {
      it('should parse standard JSON', () => {
        const input = '{"key": "value", "number": 123}';
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
        expect(result.error).toBeNull();
      });

      it('should parse JSON with arrays', () => {
        const input = '{"items": [1, 2, 3], "nested": {"a": "b"}}';
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.items).toEqual([1, 2, 3]);
        expect(result.data.nested).toEqual({ a: 'b' });
      });
    });

    describe('JSON5 features', () => {
      it('should parse unquoted keys', () => {
        const input = '{key: "value", number: 123}';
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });

      it('should parse trailing commas', () => {
        const input = '{"key": "value", "number": 123,}';
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });

      it('should parse single quotes', () => {
        const input = "{'key': 'value', 'number': 123}";
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });

      it('should parse comments', () => {
        const input = `{
          // This is a comment
          "key": "value", // inline comment
          /* block comment */
          "number": 123
        }`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });
    });

    describe('code block extraction', () => {
      it('should extract JSON from markdown code blocks', () => {
        const input = `Here's the response:
\`\`\`json
{"key": "value", "number": 123}
\`\`\``;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });

      it('should extract JSON from generic code blocks', () => {
        const input = `\`\`\`
{"key": "value", "number": 123}
\`\`\``;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value', number: 123 });
      });

      it('should handle multiple code blocks and take the first JSON', () => {
        const input = `First block:
\`\`\`python
print("hello")
\`\`\`
Second block:
\`\`\`json
{"key": "value"}
\`\`\``;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ key: 'value' });
      });
    });

    describe('mixed content extraction', () => {
      it('should extract JSON from text with preamble', () => {
        const input = `I'll help you with that calculation.
{"task_completed": true, "response": {"type": "string", "message": "The result is 42"}}`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.task_completed).toBe(true);
        expect(result.data.response.message).toBe('The result is 42');
      });

      it('should extract JSON from text with postamble', () => {
        const input = `{"task_completed": true, "response": {"type": "string", "message": "Done"}}
That should solve your problem!`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.task_completed).toBe(true);
      });

      it('should find JSON in middle of text', () => {
        const input = `Let me process that for you.
The response is:
{"status": "ok", "value": 123}
I hope that helps!`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ status: 'ok', value: 123 });
      });
    });

    describe('error handling', () => {
      it('should handle malformed JSON', () => {
        const input = '{"key": "value", "number": }';
        const result = parser.parse(input);
        
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.error).toContain('Failed to parse');
      });

      it('should handle empty input', () => {
        const result = parser.parse('');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Empty input');
      });

      it('should handle non-JSON input', () => {
        const input = 'This is just plain text with no JSON';
        const result = parser.parse(input);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('No valid JSON found');
      });

      it('should handle incomplete JSON objects', () => {
        const input = '{"key": "value"';
        const result = parser.parse(input);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to parse');
      });
    });

    describe('complex scenarios', () => {
      it('should handle nested objects with mixed quotes', () => {
        const input = `{
          task_completed: true,
          'response': {
            "type": 'string',
            message: "Result is 42"
          },
          use_tool: null
        }`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.task_completed).toBe(true);
        expect(result.data.response.message).toBe('Result is 42');
      });

      it('should handle arrays with trailing commas', () => {
        const input = `{
          "args": ["arg1", "arg2",],
          "values": [1, 2, 3,]
        }`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.args).toEqual(['arg1', 'arg2']);
        expect(result.data.values).toEqual([1, 2, 3]);
      });

      it('should extract JSON with special characters', () => {
        const input = `The JSON response:
{"message": "Line 1\\nLine 2", "path": "C:\\\\Users\\\\test"}`;
        const result = parser.parse(input);
        
        expect(result.success).toBe(true);
        expect(result.data.message).toBe('Line 1\nLine 2');
        expect(result.data.path).toBe('C:\\Users\\test');
      });
    });

    describe('extractJSON()', () => {
      it('should extract first valid JSON object', () => {
        const input = 'Some text {"first": 1} more text {"second": 2}';
        const result = parser.extractJSON(input);
        
        expect(result).toBe('{"first": 1}');
      });

      it('should extract JSON from code block', () => {
        const input = '```json\n{"key": "value"}\n```';
        const result = parser.extractJSON(input);
        
        expect(result).toBe('{"key": "value"}');
      });

      it('should return null for no JSON', () => {
        const input = 'No JSON here';
        const result = parser.extractJSON(input);
        
        expect(result).toBeNull();
      });
    });

    describe('cleanCodeBlocks()', () => {
      it('should remove markdown code blocks', () => {
        const input = '```json\n{"key": "value"}\n```';
        const result = parser.cleanCodeBlocks(input);
        
        expect(result).toBe('{"key": "value"}');
      });

      it('should handle multiple code blocks', () => {
        const input = 'Text ```code1``` more ```code2``` end';
        const result = parser.cleanCodeBlocks(input);
        
        expect(result).toBe('Text code1 more code2 end');
      });

      it('should preserve non-code-block content', () => {
        const input = 'Normal text without code blocks';
        const result = parser.cleanCodeBlocks(input);
        
        expect(result).toBe(input);
      });
    });
  });

  describe('tryParse()', () => {
    it('should not throw on invalid JSON', () => {
      expect(() => parser.tryParse('invalid')).not.toThrow();
      expect(parser.tryParse('invalid')).toBeNull();
    });

    it('should return parsed object for valid JSON', () => {
      const result = parser.tryParse('{"valid": true}');
      expect(result).toEqual({ valid: true });
    });
  });
});