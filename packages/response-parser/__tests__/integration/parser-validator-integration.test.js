/**
 * Integration tests for ResponseParser and ResponseValidator working together
 */

import { jest } from '@jest/globals';
import ResponseParser from '../../src/ResponseParser.js';
import ResponseValidator from '../../src/ResponseValidator.js';
import { 
  validateParseResult, 
  validateValidationResult,
  createTestTools,
  createLLMResponseFormats 
} from '../utils/test-helpers.js';

describe('ResponseParser and ResponseValidator Integration', () => {
  let parser;
  let validator;
  let mockTools;

  beforeEach(() => {
    parser = new ResponseParser();
    mockTools = createTestTools();
    validator = new ResponseValidator(mockTools);
  });

  describe('complete parse and validation workflow', () => {
    test('should parse and validate a complete successful response', () => {
      const llmResponse = `I'll complete this task for you.

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

      // Parse the response
      const parseResult = parser.parse(llmResponse);
      validateParseResult(parseResult);
      expect(parseResult.success).toBe(true);

      // Validate the parsed response
      const validationResult = validator.validateResponse(parseResult.data);
      validateValidationResult(validationResult);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    test('should parse and validate a response with tool usage', () => {
      const llmResponse = `I need to use the calculator to solve this.

\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "tool_required",
    "message": "Using calculator to add numbers"
  },
  "use_tool": {
    "identifier": "calculator",
    "function_name": "add",
    "args": [15, 25]
  }
}
\`\`\``;

      // Parse the response
      const parseResult = parser.parse(llmResponse);
      validateParseResult(parseResult);
      expect(parseResult.success).toBe(true);

      // Validate the parsed response
      const validationResult = validator.validateResponse(parseResult.data);
      validateValidationResult(validationResult);
      expect(validationResult.valid).toBe(true);
      
      // Verify tool usage details
      expect(parseResult.data.use_tool.identifier).toBe('calculator');
      expect(parseResult.data.use_tool.function_name).toBe('add');
      expect(parseResult.data.use_tool.args).toEqual([15, 25]);
    });

    test('should handle file operation with validation', () => {
      const llmResponse = `I'll read the file you specified.

{
  "task_completed": false,
  "response": {
    "type": "file_operation",
    "message": "Reading the specified file"
  },
  "use_tool": {
    "identifier": "file_operations",
    "function_name": "read_file",
    "args": ["/path/to/document.txt", "utf8"]
  }
}`;

      const parseResult = parser.parse(llmResponse);
      validateParseResult(parseResult);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      validateValidationResult(validationResult);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle web search with validation', () => {
      const llmResponse = `Let me search for that information.

\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "search",
    "message": "Searching for information about AI"
  },
  "use_tool": {
    "identifier": "web_search",
    "function_name": "search",
    "args": ["artificial intelligence trends 2024", 10]
  }
}
\`\`\``;

      const parseResult = parser.parse(llmResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
    });
  });

  describe('error handling and recovery', () => {
    test('should handle parse failure gracefully', () => {
      const malformedResponse = `Here's a broken response:

\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "success",
    "message": "Success" // This comment breaks JSON
  }
}
\`\`\``;

      const parseResult = parser.parse(malformedResponse);
      validateParseResult(parseResult);
      expect(parseResult.success).toBe(false);
      expect(parseResult.error).toMatch(/Failed to parse|No valid JSON found/);

      // Should not attempt validation on failed parse
      expect(parseResult.data).toBeNull();
    });

    test('should handle validation failure after successful parse', () => {
      const invalidResponse = `\`\`\`json
{
  "task_completed": "yes",
  "response": {
    "type": "success"
  },
  "use_tool": {
    "identifier": "unknown_tool",
    "function_name": "unknown_function",
    "args": []
  }
}
\`\`\``;

      // Parse should succeed
      const parseResult = parser.parse(invalidResponse);
      expect(parseResult.success).toBe(true);

      // Validation should fail
      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    test('should provide actionable error messages', () => {
      const responseWithErrors = `\`\`\`json
{
  "task_completed": "true",
  "response": {
    "type": "error"
  },
  "use_tool": {
    "identifier": "calcuator",
    "function_name": "ad",
    "args": [5]
  }
}
\`\`\``;

      const parseResult = parser.parse(responseWithErrors);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(false);
      
      // Should provide specific error messages
      const errorMessages = validationResult.errors.join(' ');
      expect(errorMessages).toContain('task_completed must be a boolean');
      expect(errorMessages).toContain('response.message is required');
    });
  });

  describe('fuzzy matching and suggestions', () => {
    test('should provide suggestions for typos in tool names', () => {
      const responseWithTypo = `\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "tool_use",
    "message": "Using calculator"
  },
  "use_tool": {
    "identifier": "calcuator",
    "function_name": "add",
    "args": [5, 3]
  }
}
\`\`\``;

      const parseResult = parser.parse(responseWithTypo);
      expect(parseResult.success).toBe(true);

      const toolValidation = validator.validateToolUse(parseResult.data.use_tool);
      expect(toolValidation.valid).toBe(false);
      expect(toolValidation.suggestions).toBeDefined();
      expect(toolValidation.suggestions.tool).toBe('calculator');
    });

    test('should provide suggestions for typos in function names', () => {
      const responseWithFunctionTypo = `\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "tool_use",
    "message": "Using calculator"
  },
  "use_tool": {
    "identifier": "calculator",
    "function_name": "multipy",
    "args": [5, 3]
  }
}
\`\`\``;

      const parseResult = parser.parse(responseWithFunctionTypo);
      expect(parseResult.success).toBe(true);

      const toolValidation = validator.validateToolUse(parseResult.data.use_tool);
      expect(toolValidation.valid).toBe(false);
      expect(toolValidation.suggestions).toBeDefined();
      expect(toolValidation.suggestions.function).toBe('multiply');
    });
  });

  describe('performance and stress testing', () => {
    test('should handle large responses efficiently', () => {
      const largeData = Array.from({length: 1000}, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`.repeat(10)
      }));

      const largeResponse = `\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "success",
    "message": "Generated large dataset",
    "data": ${JSON.stringify(largeData)}
  },
  "use_tool": null
}
\`\`\``;

      const startTime = performance.now();
      
      const parseResult = parser.parse(largeResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100); // 100ms
    });

    test('should handle multiple tool uses in sequence', () => {
      const responses = [
        {
          input: `\`\`\`json
{
  "task_completed": false,
  "response": {"type": "step1", "message": "First calculation"},
  "use_tool": {"identifier": "calculator", "function_name": "add", "args": [5, 3]}
}
\`\`\``,
          expectedValid: true
        },
        {
          input: `\`\`\`json
{
  "task_completed": false,
  "response": {"type": "step2", "message": "Second calculation"},
  "use_tool": {"identifier": "calculator", "function_name": "multiply", "args": [8, 2]}
}
\`\`\``,
          expectedValid: true
        },
        {
          input: `\`\`\`json
{
  "task_completed": true,
  "response": {"type": "completion", "message": "Final result: 16"},
  "use_tool": null
}
\`\`\``,
          expectedValid: true
        }
      ];

      responses.forEach(({ input, expectedValid }, index) => {
        const parseResult = parser.parse(input);
        expect(parseResult.success).toBe(true);

        const validationResult = validator.validateResponse(parseResult.data);
        expect(validationResult.valid).toBe(expectedValid);
      });
    });
  });

  describe('real-world LLM response patterns', () => {
    test('should handle Claude-style verbose responses', () => {
      const claudeResponse = `I understand you want me to perform a calculation. Let me use the calculator tool to add those numbers for you.

\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "tool_use", 
    "message": "I'll add 15 and 25 using the calculator tool"
  },
  "use_tool": {
    "identifier": "calculator",
    "function_name": "add", 
    "args": [15, 25]
  }
}
\`\`\`

I'll use the calculator tool to perform this addition for you.`;

      const parseResult = parser.parse(claudeResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle GPT-style concise responses', () => {
      const gptResponse = `{
  "task_completed": true,
  "response": {
    "type": "completion",
    "message": "Sum calculated: 40"
  },
  "use_tool": null
}`;

      const parseResult = parser.parse(gptResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle responses with markdown formatting', () => {
      const markdownResponse = `## Task Completion

I'll help you with that calculation.

### Tool Usage

\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "calculation",
    "message": "Performing addition operation"
  },
  "use_tool": {
    "identifier": "calculator",
    "function_name": "add",
    "args": [42, 58]
  }
}
\`\`\`

### Next Steps

The calculator will provide the sum of these numbers.`;

      const parseResult = parser.parse(markdownResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
    });
  });

  describe('edge cases in integration', () => {
    test('should handle empty tool args correctly', () => {
      const responseWithEmptyArgs = `\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "completion",
    "message": "Task completed"
  },
  "use_tool": null
}
\`\`\``;

      const parseResult = parser.parse(responseWithEmptyArgs);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle unicode and special characters', () => {
      const unicodeResponse = `\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "success",
    "message": "Hello 世界 🌍 café naïve résumé"
  },
  "use_tool": null
}
\`\`\``;

      const parseResult = parser.parse(unicodeResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
      
      expect(parseResult.data.response.message).toBe("Hello 世界 🌍 café naïve résumé");
    });

    test('should handle nested JSON structures', () => {
      const nestedResponse = `\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "data",
    "message": "Processed data",
    "metadata": {
      "processing_time": 1.23,
      "records_processed": 100,
      "status": {
        "success": true,
        "warnings": []
      }
    }
  },
  "use_tool": null
}
\`\`\``;

      const parseResult = parser.parse(nestedResponse);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validateResponse(parseResult.data);
      expect(validationResult.valid).toBe(true);
      
      expect(parseResult.data.response.metadata.status.success).toBe(true);
    });
  });

  describe('comprehensive workflow simulation', () => {
    test('should handle a complete agent conversation flow', () => {
      const conversationSteps = [
        {
          name: 'Initial tool use',
          response: `\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "search",
    "message": "Searching for information"
  },
  "use_tool": {
    "identifier": "web_search",
    "function_name": "search",
    "args": ["machine learning basics"]
  }
}
\`\`\``,
          expectValid: true
        },
        {
          name: 'Follow-up file operation',
          response: `\`\`\`json
{
  "task_completed": false,
  "response": {
    "type": "file_operation",
    "message": "Saving search results"
  },
  "use_tool": {
    "identifier": "file_operations",
    "function_name": "write_file",
    "args": ["/tmp/search_results.txt", "Search results content"]
  }
}
\`\`\``,
          expectValid: true
        },
        {
          name: 'Final completion',
          response: `\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "completion",
    "message": "Task completed. Search results have been saved to /tmp/search_results.txt"
  },
  "use_tool": null
}
\`\`\``,
          expectValid: true
        }
      ];

      conversationSteps.forEach(({ name, response, expectValid }) => {
        const parseResult = parser.parse(response);
        expect(parseResult.success).toBe(true);

        const validationResult = validator.validateResponse(parseResult.data);
        expect(validationResult.valid).toBe(expectValid);
      });
    });
  });
});