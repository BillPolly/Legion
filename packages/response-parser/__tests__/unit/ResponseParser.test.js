/**
 * Unit tests for ResponseParser class
 */

import { jest } from '@jest/globals';
import ResponseParser from '../../src/ResponseParser.js';
import { 
  validateParseResult, 
  createMalformedJsonStrings, 
  createLLMResponseFormats, 
  createEdgeCases,
  measureParseTime 
} from '../utils/test-helpers.js';

describe('ResponseParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ResponseParser();
  });

  describe('constructor', () => {
    test('should initialize with correct patterns', () => {
      expect(parser.patterns).toBeDefined();
      expect(parser.patterns.codeBlock).toBeInstanceOf(RegExp);
      expect(parser.patterns.jsonObject).toBeInstanceOf(RegExp);
      expect(parser.patterns.jsonArray).toBeInstanceOf(RegExp);
      expect(parser.patterns.jsonInText).toBeInstanceOf(RegExp);
    });
  });

  describe('parse method', () => {
    test('should parse valid JSON successfully', () => {
      const validJson = '{"key": "value", "number": 42, "boolean": true}';
      const result = parser.parse(validJson);

      validateParseResult(result);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        key: 'value',
        number: 42,
        boolean: true
      });
      expect(result.error).toBeNull();
    });

    test('should parse valid JSON array successfully', () => {
      const validJsonArray = '[{"id": 1}, {"id": 2}, {"id": 3}]';
      const result = parser.parse(validJsonArray);

      validateParseResult(result);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{id: 1}, {id: 2}, {id: 3}]);
    });

    test('should handle empty input', () => {
      const result = parser.parse('');

      validateParseResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty input or invalid type');
    });

    test('should handle null input', () => {
      const result = parser.parse(null);

      validateParseResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty input or invalid type');
    });

    test('should handle non-string input', () => {
      const result = parser.parse(123);

      validateParseResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty input or invalid type');
    });

    test('should extract JSON from code blocks', () => {
      const formats = createLLMResponseFormats();
      
      const result1 = parser.parse(formats.codeBlock);
      validateParseResult(result1);
      expect(result1.success).toBe(true);
      expect(result1.data.task_completed).toBe(true);

      const result2 = parser.parse(formats.codeBlockNoLang);
      validateParseResult(result2);
      expect(result2.success).toBe(true);
      expect(result2.data.task_completed).toBe(true);
    });

    test('should extract JSON from mixed text', () => {
      const formats = createLLMResponseFormats();
      
      const result1 = parser.parse(formats.withText);
      validateParseResult(result1);
      expect(result1.success).toBe(true);

      const result2 = parser.parse(formats.withKeyword);
      validateParseResult(result2);
      expect(result1.success).toBe(true);
    });

    test('should handle multiple code blocks and choose valid one', () => {
      const formats = createLLMResponseFormats();
      const result = parser.parse(formats.multipleCodeBlocks);

      validateParseResult(result);
      expect(result.success).toBe(true);
      // The parser may return the first valid JSON it finds
      expect(result.data).toBeDefined();
    });

    test('should handle malformed JSON with helpful error messages', () => {
      const malformedStrings = [
        '{"key": "value"', // Missing closing brace
        '{"key": value}', // Unquoted value  
        '{key: "value"}', // Unquoted key
        '{"key": undefined}', // Undefined value
        '{"key": //comment\n"value"}' // Comment in JSON
      ];
      
      malformedStrings.forEach(malformedJson => {
        const result = parser.parse(malformedJson);
        validateParseResult(result);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Failed to parse|No valid JSON found/);
      });
    });

    test('should handle edge cases gracefully', () => {
      const edgeCases = createEdgeCases();
      
      Object.entries(edgeCases).forEach(([caseName, input]) => {
        const result = parser.parse(input);
        validateParseResult(result);
        
        if (caseName === 'deeplyNested' || caseName === 'unicode' || caseName === 'escapedChars' || caseName === 'largeJson') {
          expect(result.success).toBe(true);
        } else if (caseName === 'multipleJsonObjects') {
          // Multiple JSON objects in one string should succeed (parser takes first valid one)
          expect(result.success).toBe(true);
        } else {
          // All other cases should fail (including object, array, null, undefined, etc.)
          expect(result.success).toBe(false);
        }
      });
    });
  });

  describe('tryDirectParse method', () => {
    test('should parse valid JSON directly', () => {
      const result = parser.tryDirectParse('{"test": true}');
      expect(result).toEqual({test: true});
    });

    test('should return null for non-JSON text', () => {
      const result = parser.tryDirectParse('This is not JSON');
      expect(result).toBeNull();
    });

    test('should throw for malformed JSON that looks like JSON', () => {
      expect(() => parser.tryDirectParse('{"test": true')).toThrow();
    });

    test('should handle empty string', () => {
      const result = parser.tryDirectParse('');
      expect(result).toBeNull();
    });

    test('should handle whitespace-only input', () => {
      const result = parser.tryDirectParse('   \n\t   ');
      expect(result).toBeNull();
    });
  });

  describe('extractCodeBlocks method', () => {
    test('should extract single code block', () => {
      const input = '```json\n{"test": true}\n```';
      const blocks = parser.extractCodeBlocks(input);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe('{"test": true}');
    });

    test('should extract multiple code blocks', () => {
      const input = '```\n{"first": true}\n```\nSome text\n```json\n{"second": true}\n```';
      const blocks = parser.extractCodeBlocks(input);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe('{"first": true}');
      expect(blocks[1]).toBe('{"second": true}');
    });

    test('should handle code blocks without language specified', () => {
      const input = '```\n{"test": true}\n```';
      const blocks = parser.extractCodeBlocks(input);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toBe('{"test": true}');
    });

    test('should return empty array when no code blocks found', () => {
      const input = 'Just plain text with no code blocks';
      const blocks = parser.extractCodeBlocks(input);
      
      expect(blocks).toHaveLength(0);
    });

    test('should handle malformed code blocks', () => {
      const input = '```json\n{"test": true}\n``'; // Missing closing backtick
      const blocks = parser.extractCodeBlocks(input);
      
      expect(blocks).toHaveLength(0);
    });
  });

  describe('extractJSON method', () => {
    test('should extract JSON after keyword', () => {
      const input = 'The response is: {"test": true}';
      const result = parser.extractJSON(input);
      
      expect(result).toBe('{"test": true}');
    });

    test('should extract JSON object from mixed text', () => {
      const input = 'Some text {"key": "value"} more text';
      const result = parser.extractJSON(input);
      
      expect(result).toBe('{"key": "value"}');
    });

    test('should extract JSON array from mixed text', () => {
      const input = 'Array data: [1, 2, 3] end';
      const result = parser.extractJSON(input);
      
      expect(result).toBe('[1, 2, 3]');
    });

    test('should return null when no JSON found', () => {
      const input = 'Just plain text with no JSON structures';
      const result = parser.extractJSON(input);
      
      expect(result).toBeNull();
    });

    test('should prioritize keyword-prefixed JSON', () => {
      const input = '{"ignore": true} The result: {"correct": true}';
      const result = parser.extractJSON(input);
      
      expect(result).toBe('{"correct": true}');
    });
  });

  describe('extractFirstCompleteJSON method', () => {
    test('should extract complete JSON object', () => {
      const input = '{"key": "value", "nested": {"inner": true}} extra';
      const result = parser.extractFirstCompleteJSON(input);
      
      expect(result).toBe('{"key": "value", "nested": {"inner": true}}');
    });

    test('should extract complete JSON array', () => {
      const input = '[{"id": 1}, {"id": 2}] remaining text';
      const result = parser.extractFirstCompleteJSON(input);
      
      expect(result).toBe('[{"id": 1}, {"id": 2}]');
    });

    test('should handle nested objects correctly', () => {
      const input = '{"a": {"b": {"c": "deep"}}} end';
      const result = parser.extractFirstCompleteJSON(input);
      
      expect(result).toBe('{"a": {"b": {"c": "deep"}}}');
    });

    test('should handle strings with special characters', () => {
      const input = '{"text": "Quote: \\"hello\\" and backslash: \\\\"}';
      const result = parser.extractFirstCompleteJSON(input);
      
      expect(result).toBe('{"text": "Quote: \\"hello\\" and backslash: \\\\"}');
    });

    test('should return input when no complete JSON found', () => {
      const input = '{"incomplete": true';
      const result = parser.extractFirstCompleteJSON(input);
      
      expect(result).toBe('{"incomplete": true');
    });
  });

  describe('cleanInput method', () => {
    test('should remove code block markers', () => {
      const input = '```json\n{"test": true}\n```';
      const cleaned = parser.cleanInput(input);
      
      expect(cleaned).toBe('{"test": true}');
    });

    test('should extract JSON when not starting with brace', () => {
      const input = 'Result: {"test": true}';
      const cleaned = parser.cleanInput(input);
      
      expect(cleaned).toBe('{"test": true}');
    });

    test('should trim whitespace', () => {
      const input = '   \n{"test": true}\n   ';
      const cleaned = parser.cleanInput(input);
      
      expect(cleaned).toBe('{"test": true}');
    });
  });

  describe('tryParse method', () => {
    test('should parse valid JSON', () => {
      const result = parser.tryParse('{"test": true}');
      expect(result).toEqual({test: true});
    });

    test('should return null for invalid JSON', () => {
      const result = parser.tryParse('{"test": true');
      expect(result).toBeNull();
    });

    test('should return null for empty input', () => {
      const result = parser.tryParse('');
      expect(result).toBeNull();
    });

    test('should return null for null input', () => {
      const result = parser.tryParse(null);
      expect(result).toBeNull();
    });
  });

  describe('performance tests', () => {
    test('should parse simple JSON quickly', () => {
      const simpleJson = '{"key": "value"}';
      const { result, timeMs } = measureParseTime(parser, simpleJson);
      
      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(10); // Should be very fast
    });

    test('should handle large JSON efficiently', () => {
      const largeJson = JSON.stringify({
        data: Array.from({length: 1000}, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10)
        }))
      });
      
      const { result, timeMs } = measureParseTime(parser, largeJson);
      
      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(100); // Should still be reasonably fast
    });

    test('should handle complex extraction without timeout', () => {
      const complexInput = `
        Here's a lot of text before the JSON.
        ${'Lorem ipsum dolor sit amet. '.repeat(100)}
        
        The actual response is:
        \`\`\`json
        {
          "task_completed": true,
          "response": {
            "type": "complex",
            "message": "This is a complex response",
            "data": ${JSON.stringify(Array.from({length: 100}, (_, i) => ({id: i})))}
          }
        }
        \`\`\`
        
        ${'And more text after. '.repeat(50)}
      `;
      
      const { result, timeMs } = measureParseTime(parser, complexInput);
      
      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(50); // Should extract efficiently
    });
  });

  describe('real-world LLM response scenarios', () => {
    test('should handle Claude-style responses', () => {
      const claudeResponse = `I'll help you with that task.

\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "success",
    "message": "Task completed successfully"
  },
  "use_tool": null
}
\`\`\`

The task has been completed as requested.`;
      
      const result = parser.parse(claudeResponse);
      validateParseResult(result);
      expect(result.success).toBe(true);
      expect(result.data.task_completed).toBe(true);
    });

    test('should handle GPT-style responses', () => {
      const gptResponse = `Based on your request, here is the structured response:

{
  "task_completed": true,
  "response": {
    "type": "analysis",
    "message": "Analysis complete"
  }
}

This completes the requested analysis.`;
      
      const result = parser.parse(gptResponse);
      validateParseResult(result);
      expect(result.success).toBe(true);
    });

    test('should handle responses with tool usage', () => {
      const toolResponse = `I need to use a tool for this task.

\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "tool_required",
    "message": "Using calculator tool"
  },
  "use_tool": {
    "identifier": "calculator",
    "function_name": "add",
    "args": [5, 3]
  }
}
\`\`\``;
      
      const result = parser.parse(toolResponse);
      validateParseResult(result);
      expect(result.success).toBe(true);
      expect(result.data.use_tool.identifier).toBe('calculator');
    });

    test('should handle malformed responses gracefully', () => {
      const malformedResponse = `Here's a response but it's broken:

\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "success",
    "message": "Success" // This comment breaks JSON
  }
}
\`\`\``;
      
      const result = parser.parse(malformedResponse);
      validateParseResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Failed to parse|No valid JSON found/);
    });
  });

  describe('regex pattern tests', () => {
    test('codeBlock pattern should match various formats', () => {
      const testCases = [
        '```json\ncontent\n```',
        '```\ncontent\n```',
        '```  \ncontent\n```',
        '```json  \ncontent\n  ```'
      ];
      
      testCases.forEach(testCase => {
        // Reset the regex index since it's global
        parser.patterns.codeBlock.lastIndex = 0;
        const matches = testCase.match(parser.patterns.codeBlock);
        expect(matches).not.toBeNull();
        if (matches && matches[1]) {
          expect(matches[1].trim()).toBe('content');
        }
      });
    });

    test('jsonObject pattern should match objects', () => {
      const testCases = [
        '{"simple": true}',
        '{"nested": {"inner": true}}',
        '{ "spaced" : true }',
        '{"multiline":\n  true}'
      ];
      
      testCases.forEach(testCase => {
        const matches = testCase.match(parser.patterns.jsonObject);
        expect(matches).not.toBeNull();
      });
    });

    test('jsonArray pattern should match arrays', () => {
      const testCases = [
        '[1, 2, 3]',
        '[{"nested": true}]',
        '[ "spaced" ]',
        '[\n  1,\n  2\n]'
      ];
      
      testCases.forEach(testCase => {
        const matches = testCase.match(parser.patterns.jsonArray);
        expect(matches).not.toBeNull();
      });
    });

    test('jsonInText pattern should match keyword prefixed JSON', () => {
      const testCases = [
        'response: {"test": true}',
        'result {"test": true}',
        'output: {"test": true}',
        'json {"test": true}'
      ];
      
      testCases.forEach(testCase => {
        const matches = testCase.match(parser.patterns.jsonInText);
        expect(matches).not.toBeNull();
        expect(matches[1]).toBe('{"test": true}');
      });
    });
  });
});