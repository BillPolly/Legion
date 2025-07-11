/**
 * Test helper utilities for @jsenvoy/response-parser
 */

import { jest } from '@jest/globals';

/**
 * Validates that a parse result matches expected format
 */
export function validateParseResult(result) {
  expect(result).toHaveProperty('success');
  expect(result).toHaveProperty('data');
  expect(result).toHaveProperty('error');
  expect(typeof result.success).toBe('boolean');
  
  if (result.success) {
    expect(result.data).not.toBeNull();
    expect(result.error).toBeNull();
  } else {
    expect(result.error).toBeTruthy();
    expect(typeof result.error).toBe('string');
  }
}

/**
 * Validates that a validation result matches expected format
 */
export function validateValidationResult(result) {
  expect(result).toHaveProperty('valid');
  expect(result).toHaveProperty('errors');
  expect(typeof result.valid).toBe('boolean');
  expect(Array.isArray(result.errors)).toBe(true);
  
  if (!result.valid) {
    expect(result.errors.length).toBeGreaterThan(0);
  }
}

/**
 * Creates a mock tool for testing validation
 */
export function createMockTool(identifier, functions = []) {
  return {
    identifier,
    functions: functions.map(func => ({
      name: func.name || 'test_function',
      description: func.description || 'Test function',
      arguments: func.arguments || []
    }))
  };
}

/**
 * Creates a mock response object for testing
 */
export function createMockResponse(overrides = {}) {
  return {
    task_completed: true,
    response: {
      type: 'text',
      message: 'Test response'
    },
    use_tool: null,
    ...overrides
  };
}

/**
 * Creates a mock tool use object for testing
 */
export function createMockToolUse(overrides = {}) {
  return {
    identifier: 'test_tool',
    function_name: 'test_function',
    args: [],
    ...overrides
  };
}

/**
 * Creates various malformed JSON strings for testing
 */
export function createMalformedJsonStrings() {
  return [
    '{"key": "value",}', // Trailing comma
    "{'key': 'value'}", // Single quotes
    '{"key": value}', // Unquoted value
    '{key: "value"}', // Unquoted key
    '{"key": "value"', // Missing closing brace
    '{"key": "value"}}', // Extra closing brace
    '{"key": "value\n"}', // Unescaped newline
    '{"key": "value\t"}', // Unescaped tab
    '{"key": undefined}', // Undefined value
    '{"key": function() {}}', // Function value
    '{"key": //comment\n"value"}' // Comment in JSON
  ];
}

/**
 * Creates various LLM response formats for testing
 */
export function createLLMResponseFormats() {
  const validJson = '{"task_completed": true, "response": {"type": "text", "message": "Success"}}';
  
  return {
    plain: validJson,
    codeBlock: `\`\`\`json\n${validJson}\n\`\`\``,
    codeBlockNoLang: `\`\`\`\n${validJson}\n\`\`\``,
    withText: `Here is the response:\n${validJson}\nThat was the response.`,
    withMarkdown: `## Response\n\n\`\`\`json\n${validJson}\n\`\`\`\n\nThis is the result.`,
    multipleCodeBlocks: `First block:\n\`\`\`\n{"wrong": true}\n\`\`\`\n\nActual response:\n\`\`\`json\n${validJson}\n\`\`\``,
    nestedJson: `{"outer": ${validJson}}`,
    arrayFormat: `[${validJson}]`,
    withKeyword: `The response is: ${validJson}`,
    withResult: `Result: ${validJson}`,
    withOutput: `Output: ${validJson}`
  };
}

/**
 * Creates test cases for edge cases
 */
export function createEdgeCases() {
  return {
    empty: '',
    null: null,
    undefined: undefined,
    number: 123,
    boolean: true,
    array: [],
    object: {},
    whitespace: '   \n\t   ',
    onlyText: 'This is just text with no JSON',
    malformedCodeBlock: '```json\n{"key": "value"\n```', // Missing closing brace
    emptyCodeBlock: '```json\n\n```',
    multipleJsonObjects: '{"first": true} {"second": true}',
    deeplyNested: '{"a": {"b": {"c": {"d": {"e": "deep"}}}}}',
    largeJson: JSON.stringify({large: 'x'.repeat(10000)}),
    unicode: '{"unicode": "Hello 世界 🌍 café naïve résumé"}',
    escapedChars: '{"escaped": "Line1\\nLine2\\tTab\\\"Quote\\\\Backslash"}'
  };
}

/**
 * Performance test helper
 */
export function measureParseTime(parser, input) {
  const start = performance.now();
  const result = parser.parse(input);
  const end = performance.now();
  
  return {
    result,
    timeMs: end - start
  };
}

/**
 * Creates comprehensive test tools for validation testing
 */
export function createTestTools() {
  return [
    {
      identifier: 'calculator',
      functions: [
        {
          name: 'add',
          description: 'Add two numbers',
          arguments: [
            { name: 'a', type: 'number', required: true },
            { name: 'b', type: 'number', required: true }
          ]
        },
        {
          name: 'multiply',
          description: 'Multiply two numbers',
          arguments: [
            { name: 'x', type: 'number', required: true },
            { name: 'y', type: 'number', required: true }
          ]
        }
      ]
    },
    {
      identifier: 'file_operations',
      functions: [
        {
          name: 'read_file',
          description: 'Read a file',
          arguments: [
            { name: 'path', type: 'string', required: true },
            { name: 'encoding', type: 'string', required: false }
          ]
        },
        {
          name: 'write_file',
          description: 'Write to a file',
          arguments: [
            { name: 'path', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'append', type: 'boolean', required: false }
          ]
        }
      ]
    },
    {
      identifier: 'web_search',
      functions: [
        {
          name: 'search',
          description: 'Search the web',
          arguments: [
            { name: 'query', type: 'string', required: true },
            { name: 'limit', type: 'number', required: false }
          ]
        }
      ]
    }
  ];
}