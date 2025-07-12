import { RobustJsonParser } from '../src/utils/RobustJsonParser';

describe('RobustJsonParser', () => {
  describe('parseFromText', () => {
    describe('Basic JSON parsing', () => {
      it('should parse valid JSON object', () => {
        const text = '{"name": "test", "value": 123}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should parse valid JSON array', () => {
        const text = '["item1", "item2", "item3"]';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual(['item1', 'item2', 'item3']);
      });

      it('should parse nested JSON objects', () => {
        const text = '{"user": {"name": "John", "age": 30}, "active": true}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          user: { name: 'John', age: 30 },
          active: true
        });
      });
    });

    describe('JSON5 features', () => {
      it('should parse JSON with trailing commas', () => {
        const text = '{"name": "test", "value": 123,}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should parse JSON with single quotes', () => {
        const text = "{'name': 'test', 'value': 123}";
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should parse JSON with comments', () => {
        const text = `{
          // This is a comment
          "name": "test",
          /* Multi-line comment */
          "value": 123
        }`;
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should parse JSON with unquoted keys', () => {
        const text = '{name: "test", value: 123}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should parse JSON with mixed quoted and unquoted keys', () => {
        const text = '{name: "test", "value": 123, count: 5}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123, count: 5 });
      });

      it('should parse JSON with unquoted keys and arrays', () => {
        const text = '{subtasks: ["task1", "task2"], count: 2}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ subtasks: ['task1', 'task2'], count: 2 });
      });

      it('should parse JSON with unquoted keys in nested objects', () => {
        const text = '{user: {name: "John", age: 30}, active: true}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          user: { name: 'John', age: 30 },
          active: true
        });
      });
    });

    describe('Text cleaning', () => {
      it('should remove markdown code blocks', () => {
        const text = '```json\n{"name": "test"}\n```';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test' });
      });

      it('should remove generic code blocks', () => {
        const text = '```\n{"name": "test"}\n```';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test' });
      });

      it('should remove common prefixes', () => {
        const prefixes = [
          "Here's the JSON: ",
          "Here is the response: ",
          "The JSON is: ",
          "Response: ",
          "Answer: "
        ];

        prefixes.forEach(prefix => {
          const text = prefix + '{"name": "test"}';
          const result = RobustJsonParser.parseFromText(text);
          expect(result).toEqual({ name: 'test' });
        });
      });

      it('should handle HTML entities', () => {
        const text = '{&quot;name&quot;: &quot;test&quot;, &quot;value&quot;: 123}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should normalize line endings', () => {
        const text = '{\r\n"name": "test",\r"value": 123\n}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });
    });

    describe('JSON extraction from mixed content', () => {
      it('should extract JSON from text with extra content before', () => {
        const text = 'Here is the response you requested: {"name": "test", "value": 123}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should extract JSON from text with extra content after', () => {
        const text = '{"name": "test", "value": 123} This is additional text that should be ignored.';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should extract JSON from text with content before and after', () => {
        const text = 'The result is: {"name": "test", "value": 123} Hope this helps!';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({ name: 'test', value: 123 });
      });

      it('should extract JSON array from mixed content', () => {
        const text = 'Here are the items: ["item1", "item2", "item3"] as requested.';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual(['item1', 'item2', 'item3']);
      });
    });

    describe('Complex LLM response scenarios', () => {
      it('should handle typical LLM response with explanation', () => {
        const text = `I'll provide the JSON response for the task decomposition:

\`\`\`json
{
  "subtasks": [
    "pipe_installation",
    "fixture_repair", 
    "drain_cleaning",
    "leak_detection"
  ]
}
\`\`\`

This breakdown covers the main areas of domestic plumbing work.`;

        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          subtasks: [
            'pipe_installation',
            'fixture_repair',
            'drain_cleaning',
            'leak_detection'
          ]
        });
      });

      it('should handle JSON with truncated response', () => {
        const text = `{
  "subtasks": [
    "fixture_installation",
    "pipe_repair",
    "drain_maintenance"
  ]
}

Note: This response was truncated...`;

        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          subtasks: [
            'fixture_installation',
            'pipe_repair',
            'drain_maintenance'
          ]
        });
      });

      it('should handle malformed JSON with missing closing brace', () => {
        const text = `{
  "subtasks": [
    "task1",
    "task2"
  ]`;

        // Our robust parser might extract the valid array part or fail gracefully
        // Let's test what actually happens
        try {
          const result = RobustJsonParser.parseFromText(text);
          // If it succeeds, it should extract the array
          expect(Array.isArray(result)).toBe(true);
        } catch (error) {
          // If it fails, that's also acceptable for malformed JSON
          expect((error as Error).message).toContain('Failed to parse JSON from text');
        }
      });

      it('should handle JSON with extra commas and formatting issues', () => {
        const text = `{
  "subtasks": [
    "task1",
    "task2",
    "task3",
  ],
}`;

        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          subtasks: ['task1', 'task2', 'task3']
        });
      });
    });

    describe('Balanced brace extraction', () => {
      it('should extract properly balanced JSON with nested objects', () => {
        const text = 'Result: {"outer": {"inner": {"deep": "value"}}, "other": "data"} End.';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          outer: { inner: { deep: 'value' } },
          other: 'data'
        });
      });

      it('should extract properly balanced JSON with nested arrays', () => {
        const text = 'Data: {"items": [["a", "b"], ["c", "d"]], "count": 4} Done.';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          items: [['a', 'b'], ['c', 'd']],
          count: 4
        });
      });

      it('should handle strings containing braces', () => {
        const text = '{"message": "Use {braces} in strings", "valid": true}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          message: 'Use {braces} in strings',
          valid: true
        });
      });

      it('should handle escaped quotes in strings', () => {
        const text = '{"message": "She said \\"Hello\\" to me", "valid": true}';
        const result = RobustJsonParser.parseFromText(text);
        expect(result).toEqual({
          message: 'She said "Hello" to me',
          valid: true
        });
      });
    });

    describe('Error handling', () => {
      it('should throw error for empty input', () => {
        expect(() => RobustJsonParser.parseFromText('')).toThrow('Input text is empty or not a string');
      });

      it('should throw error for null input', () => {
        // @ts-ignore - Testing invalid input
        expect(() => RobustJsonParser.parseFromText(null)).toThrow('Input text is empty or not a string');
      });

      it('should throw error for non-string input', () => {
        // @ts-ignore - Testing invalid input
        expect(() => RobustJsonParser.parseFromText(123)).toThrow('Input text is empty or not a string');
      });

      it('should throw error for text with no JSON', () => {
        const text = 'This is just plain text with no JSON content at all.';
        expect(() => RobustJsonParser.parseFromText(text)).toThrow('Failed to parse JSON from text');
      });

      it('should throw error for completely malformed JSON', () => {
        const text = '{this is not valid json at all}';
        expect(() => RobustJsonParser.parseFromText(text)).toThrow('Failed to parse JSON from text');
      });
    });
  });

  describe('validateStructure', () => {
    it('should validate object with all expected keys', () => {
      const obj = { name: 'test', value: 123, active: true };
      const result = RobustJsonParser.validateStructure(obj, ['name', 'value']);
      expect(result).toBe(true);
    });

    it('should fail validation for object missing keys', () => {
      const obj = { name: 'test' };
      const result = RobustJsonParser.validateStructure(obj, ['name', 'value']);
      expect(result).toBe(false);
    });

    it('should fail validation for non-object input', () => {
      const result = RobustJsonParser.validateStructure('not an object', ['key']);
      expect(result).toBe(false);
    });

    it('should fail validation for null input', () => {
      const result = RobustJsonParser.validateStructure(null, ['key']);
      expect(result).toBe(false);
    });

    it('should pass validation for empty key list', () => {
      const obj = { name: 'test' };
      const result = RobustJsonParser.validateStructure(obj, []);
      expect(result).toBe(true);
    });
  });

  describe('parseAndValidate', () => {
    it('should parse and validate successfully', () => {
      const text = '{"subtasks": ["task1", "task2"], "count": 2}';
      const result = RobustJsonParser.parseAndValidate(text, ['subtasks']);
      expect(result).toEqual({
        subtasks: ['task1', 'task2'],
        count: 2
      });
    });

    it('should throw error when validation fails', () => {
      const text = '{"name": "test"}';
      expect(() => {
        RobustJsonParser.parseAndValidate(text, ['subtasks']);
      }).toThrow('Parsed JSON missing expected keys: subtasks');
    });

    it('should throw error when parsing fails', () => {
      const text = 'invalid json';
      expect(() => {
        RobustJsonParser.parseAndValidate(text, ['subtasks']);
      }).toThrow('Failed to parse JSON from text');
    });
  });

  describe('Real-world LLM response examples', () => {
    it('should handle Claude-style response with explanation', () => {
      const text = `I'll break down the domestic plumbing tasks into comprehensive subtasks:

\`\`\`json
{
  "subtasks": [
    "fixture_installation",
    "pipe_installation", 
    "drain_cleaning",
    "leak_detection",
    "water_heater_service",
    "emergency_repairs"
  ]
}
\`\`\`

These subtasks cover all major aspects of domestic plumbing work, from installation to emergency services.`;

      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({
        subtasks: [
          'fixture_installation',
          'pipe_installation',
          'drain_cleaning',
          'leak_detection',
          'water_heater_service',
          'emergency_repairs'
        ]
      });
    });

    it('should handle GPT-style response with formatting', () => {
      const text = `Here's the JSON response for the task decomposition:

{
  "subtasks": [
    "electrical_wiring",
    "outlet_installation",
    "fixture_installation",
    "panel_upgrades",
    "safety_inspections"
  ]
}

This breakdown provides a comprehensive view of electrical work categories.`;

      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({
        subtasks: [
          'electrical_wiring',
          'outlet_installation',
          'fixture_installation',
          'panel_upgrades',
          'safety_inspections'
        ]
      });
    });

    it('should handle response with extra whitespace and formatting', () => {
      const text = `


      {
        "subtasks": [
          "carpentry_framing",
          "cabinet_installation",
          "trim_work",
          "door_installation",
          "window_installation"
        ]
      }


      `;

      const result = RobustJsonParser.parseFromText(text);
      expect(result).toEqual({
        subtasks: [
          'carpentry_framing',
          'cabinet_installation',
          'trim_work',
          'door_installation',
          'window_installation'
        ]
      });
    });
  });
});
