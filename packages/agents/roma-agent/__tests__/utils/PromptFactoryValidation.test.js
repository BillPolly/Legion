/**
 * Tests for PromptFactory example validation
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import PromptFactory from '../../src/utils/PromptFactory.js';
import { ResourceManager } from '@legion/resource-manager';

describe('PromptFactory Example Validation', () => {
  let mockLLMClient;
  
  beforeAll(() => {
    // Create a mock LLM client
    mockLLMClient = {
      complete: async (prompt) => 'mock response'
    };
  });

  describe('Example requirement enforcement', () => {
    test('should throw error when no examples provided', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            result: { type: 'string' }
          },
          required: ['result']
        }
        // No examples!
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow('Examples are REQUIRED!');
    });

    test('should throw error when examples is not an array', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            result: { type: 'string' }
          },
          required: ['result']
        },
        examples: 'not an array'
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow('Examples are REQUIRED!');
    });

    test('should throw error when examples array is empty', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            result: { type: 'string' }
          },
          required: ['result']
        },
        examples: []
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow('Examples array cannot be empty!');
    });
  });

  describe('Example schema validation', () => {
    test('should throw error when example does not match schema', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            active: { type: 'boolean' }
          },
          required: ['name', 'age']
        },
        examples: [
          {
            name: 'John',
            // Missing required field 'age'
            active: true
          }
        ]
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow(/Example 1 does not match the response schema/);
    });

    test('should throw error when example has wrong type', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            items: { 
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['count']
        },
        examples: [
          {
            count: 'not a number', // Wrong type
            items: ['valid', 'array']
          }
        ]
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow(/Example 1 does not match the response schema/);
    });

    test('should accept valid examples that match schema', () => {
      const promptData = {
        template: 'Test prompt {{variable}}',
        responseSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['name', 'age']
        },
        examples: [
          {
            name: 'Alice',
            age: 30,
            tags: ['developer', 'leader']
          },
          {
            name: 'Bob',
            age: 25,
            tags: []
          }
        ]
      };

      // Should not throw
      const prompt = PromptFactory.createPrompt(promptData, mockLLMClient);
      expect(prompt).toBeDefined();
    });
  });

  describe('validatePromptData method', () => {
    test('should validate complete prompt data with examples', () => {
      const promptData = {
        template: 'Generate {{type}} code',
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        },
        examples: [
          { code: 'console.log("Hello");' }
        ]
      };

      const isValid = PromptFactory.validatePromptData(promptData);
      expect(isValid).toBe(true);
    });

    test('should throw when prompt data missing examples', () => {
      const promptData = {
        template: 'Generate {{type}} code',
        responseSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        }
        // No examples
      };

      expect(() => {
        PromptFactory.validatePromptData(promptData);
      }).toThrow('must have a non-empty examples array');
    });
  });

  describe('createPromptData helper', () => {
    test('should throw when no examples provided to createPromptData', () => {
      expect(() => {
        PromptFactory.createPromptData(
          'Test template',
          { result: { type: 'string' } },
          ['result']
          // No examples!
        );
      }).toThrow('Examples are REQUIRED when creating prompt data');
    });

    test('should create valid prompt data with examples', () => {
      const promptData = PromptFactory.createPromptData(
        'Test template',
        { result: { type: 'string' } },
        ['result'],
        [{ result: 'example output' }]
      );

      expect(promptData.template).toBe('Test template');
      expect(promptData.responseSchema).toBeDefined();
      expect(promptData.examples).toHaveLength(1);
      expect(promptData.examples[0].result).toBe('example output');
    });

    test('should support output format specification', () => {
      const promptData = PromptFactory.createPromptData(
        'Generate code',
        {
          code: { type: 'string' },
          explanation: { type: 'string' }
        },
        ['code'],
        [{ code: 'function test() {}', explanation: 'Test function' }],
        'delimited'  // Specify delimited format
      );

      expect(promptData.responseSchema['x-output-format']).toBe('delimited');
    });
  });

  describe('Complex schema validation', () => {
    test('should validate nested object examples', () => {
      const promptData = {
        template: 'Analyze {{input}}',
        responseSchema: {
          type: 'object',
          properties: {
            analysis: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                score: { type: 'number', minimum: 0, maximum: 100 }
              },
              required: ['summary', 'score']
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 3
            }
          },
          required: ['analysis']
        },
        examples: [
          {
            analysis: {
              summary: 'Good code quality',
              score: 85
            },
            recommendations: ['Add tests', 'Improve documentation']
          }
        ]
      };

      // Should not throw
      const prompt = PromptFactory.createPrompt(promptData, mockLLMClient);
      expect(prompt).toBeDefined();
    });

    test('should catch validation errors in nested structures', () => {
      const promptData = {
        template: 'Analyze {{input}}',
        responseSchema: {
          type: 'object',
          properties: {
            analysis: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                score: { type: 'number', minimum: 0, maximum: 100 }
              },
              required: ['summary', 'score']
            }
          },
          required: ['analysis']
        },
        examples: [
          {
            analysis: {
              summary: 'Good code quality',
              score: 150  // Exceeds maximum
            }
          }
        ]
      };

      expect(() => {
        PromptFactory.createPrompt(promptData, mockLLMClient);
      }).toThrow(/Example 1 does not match the response schema/);
    });
  });
});