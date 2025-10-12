/**
 * Unit tests for RewriteResolver - Phase 1 Question Normalization
 *
 * Tests the RewriteResolver class with mocked LLM responses.
 * Integration tests with real LLM are in RewriteResolver.integration.test.js
 */

import { RewriteResolver } from '../../src/phase1/RewriteResolver.js';
import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema for validation
const schemaPath = join(__dirname, '../../schemas/CanonicalQuestion.schema.json');
const canonicalQuestionSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const validator = createValidator(canonicalQuestionSchema);

// Helper to create mock LLM client
const createMockLLMClient = (mockResponse) => {
  return {
    generate: async (prompt) => {
      if (typeof mockResponse === 'function') {
        return mockResponse(prompt);
      }
      return mockResponse;
    }
  };
};

// Helper to create mock TemplatedPrompt execute response
const createMockTemplatedPrompt = (mockData) => {
  return class MockTemplatedPrompt {
    constructor(config) {
      this.config = config;
      this.maxRetries = config.maxRetries || 3;
    }

    async execute(templateData) {
      if (typeof mockData === 'function') {
        return mockData(templateData);
      }
      return mockData;
    }
  };
};

describe('RewriteResolver', () => {
  describe('Constructor', () => {
    test('should throw if LLM client not provided', () => {
      expect(() => {
        new RewriteResolver();
      }).toThrow('LLM client is required for RewriteResolver');
    });

    test('should throw if LLM client is null', () => {
      expect(() => {
        new RewriteResolver(null);
      }).toThrow('LLM client is required for RewriteResolver');
    });

    test('should create instance with valid LLM client', () => {
      const mockLLM = createMockLLMClient('test');
      const resolver = new RewriteResolver(mockLLM);

      expect(resolver).toBeInstanceOf(RewriteResolver);
      expect(resolver.llmClient).toBe(mockLLM);
      expect(resolver.validator).toBeDefined();
      expect(resolver.templatedPrompt).toBeDefined();
    });

    test('should initialize validator with CanonicalQuestion schema', () => {
      const mockLLM = createMockLLMClient('test');
      const resolver = new RewriteResolver(mockLLM);

      // Validator should be able to validate CanonicalQuestion objects
      const valid = {
        text: 'test question',
        entities: [],
        dates: [],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      const result = resolver.validator.validate(valid);
      expect(result.valid).toBe(true);
    });
  });

  describe('resolve() - Input Validation', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should throw if question is not provided', async () => {
      await expect(resolver.resolve()).rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is empty string', async () => {
      await expect(resolver.resolve('')).rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is only whitespace', async () => {
      await expect(resolver.resolve('   ')).rejects.toThrow('Question must be a non-empty string');
    });

    test('should throw if question is not a string', async () => {
      await expect(resolver.resolve(123)).rejects.toThrow('Question must be a non-empty string');
      await expect(resolver.resolve(null)).rejects.toThrow('Question must be a non-empty string');
      await expect(resolver.resolve({})).rejects.toThrow('Question must be a non-empty string');
      await expect(resolver.resolve([])).rejects.toThrow('Question must be a non-empty string');
    });

    test('should trim whitespace from question', async () => {
      // Mock successful response
      const mockResponse = {
        success: true,
        data: {
          text: 'what is the capital of France?',
          entities: [
            { span: [20, 26], value: 'France', type: 'PLACE', canonical: ':France' }
          ],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.question).toBe('what is the capital of France?');
        return mockResponse;
      };

      await resolver.resolve('  what is the capital of France?  ');
    });
  });

  describe('resolve() - Context Handling', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should pass empty context if not provided', async () => {
      const mockResponse = {
        success: true,
        data: {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.context.previousQuestion).toBe(null);
        expect(data.context.domain).toBe(null);
        expect(data.context.conversationHistory).toBe(null);
        return mockResponse;
      };

      await resolver.resolve('test question');
    });

    test('should pass previousQuestion in context', async () => {
      const mockResponse = {
        success: true,
        data: {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.context.previousQuestion).toBe('what is revenue in 2022?');
        return mockResponse;
      };

      await resolver.resolve('what about 2023?', {
        previousQuestion: 'what is revenue in 2022?'
      });
    });

    test('should pass domain hint in context', async () => {
      const mockResponse = {
        success: true,
        data: {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.context.domain).toBe('finance');
        return mockResponse;
      };

      await resolver.resolve('what is net income?', { domain: 'finance' });
    });

    test('should pass conversation history in context', async () => {
      const mockResponse = {
        success: true,
        data: {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      const history = [
        'what is revenue in 2022?',
        'what about 2023?'
      ];

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.context.conversationHistory).toEqual(history);
        return mockResponse;
      };

      await resolver.resolve('and net income?', { conversationHistory: history });
    });

    test('should include current date in template data', async () => {
      const mockResponse = {
        success: true,
        data: {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        }
      };

      resolver.templatedPrompt.execute = async (data) => {
        expect(data.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        return mockResponse;
      };

      await resolver.resolve('what is revenue today?');
    });
  });

  describe('resolve() - LLM Response Handling', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should return valid CanonicalQuestion on success', async () => {
      const expectedData = {
        text: 'which countries border Germany?',
        entities: [
          { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
        ],
        dates: [],
        units: [],
        wh_role: 'which',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('which countries border Germany?');
      expect(result).toEqual(expectedData);
    });

    test('should throw if LLM call fails', async () => {
      resolver.templatedPrompt.execute = async () => ({
        success: false,
        errors: ['LLM timeout', 'Network error']
      });

      await expect(resolver.resolve('test question'))
        .rejects.toThrow('Failed to resolve question after 3 attempts: LLM timeout; Network error');
    });

    test('should throw if LLM output is invalid', async () => {
      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: {
          text: 'test',
          // Missing required fields
          wh_role: 'what'
        }
      });

      await expect(resolver.resolve('test question'))
        .rejects.toThrow('LLM output validation failed');
    });

    test('should validate output against CanonicalQuestion schema', async () => {
      const validData = {
        text: 'what is the capital of France?',
        entities: [
          { span: [20, 26], value: 'France', type: 'PLACE', canonical: ':France' }
        ],
        dates: [],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: validData
      });

      const result = await resolver.resolve('what is the capital of France?');

      // Should pass validation
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);
    });
  });

  describe('resolve() - Entity Normalization', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should normalize entities with canonical IRIs', async () => {
      const expectedData = {
        text: 'who was the founder of Microsoft?',
        entities: [
          { span: [19, 28], value: 'Microsoft', type: 'ORGANIZATION', canonical: ':Microsoft' }
        ],
        dates: [],
        units: [],
        wh_role: 'who',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('who founded Microsoft?');
      expect(result.entities[0].canonical).toBe(':Microsoft');
      expect(result.entities[0].type).toBe('ORGANIZATION');
    });

    test('should handle multiple entities', async () => {
      const expectedData = {
        text: 'what is the distance between Paris and London?',
        entities: [
          { span: [28, 33], value: 'Paris', type: 'PLACE', canonical: ':Paris' },
          { span: [38, 44], value: 'London', type: 'PLACE', canonical: ':London' }
        ],
        dates: [],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('what is the distance between Paris and London?');
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].canonical).toBe(':Paris');
      expect(result.entities[1].canonical).toBe(':London');
    });
  });

  describe('resolve() - Date Normalization', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should normalize Q3 2023 to ISO date range', async () => {
      const expectedData = {
        text: 'what is revenue in Q3 2023?',
        entities: [
          { span: [8, 15], value: 'revenue', type: 'MEASURE', canonical: ':revenue' }
        ],
        dates: [
          { span: [19, 26], iso: '2023-07-01/2023-09-30' }
        ],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('what is revenue in Q3 2023?');
      expect(result.dates[0].iso).toBe('2023-07-01/2023-09-30');
    });

    test('should normalize year to ISO date range', async () => {
      const expectedData = {
        text: 'what is revenue in 2023?',
        entities: [
          { span: [8, 15], value: 'revenue', type: 'MEASURE', canonical: ':revenue' }
        ],
        dates: [
          { span: [19, 23], iso: '2023-01-01/2023-12-31' }
        ],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('what is revenue in 2023?');
      expect(result.dates[0].iso).toBe('2023-01-01/2023-12-31');
    });
  });

  describe('resolve() - Unit Parsing', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    test('should parse 206k USD to value and unit', async () => {
      const expectedData = {
        text: 'what revenue exceeds 206k USD?',
        entities: [
          { span: [5, 12], value: 'revenue', type: 'MEASURE', canonical: ':revenue' }
        ],
        dates: [],
        units: [
          { span: [21, 29], value: 206000, unit: 'USD' }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('what revenue exceeds 206k USD?');
      expect(result.units[0].value).toBe(206000);
      expect(result.units[0].unit).toBe('USD');
    });

    test('should handle millions in unit parsing', async () => {
      const expectedData = {
        text: 'what revenue exceeds 5 million dollars?',
        entities: [
          { span: [5, 12], value: 'revenue', type: 'MEASURE', canonical: ':revenue' }
        ],
        dates: [],
        units: [
          { span: [21, 38], value: 5000000, unit: 'USD' }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      resolver.templatedPrompt.execute = async () => ({
        success: true,
        data: expectedData
      });

      const result = await resolver.resolve('what revenue exceeds 5 million dollars?');
      expect(result.units[0].value).toBe(5000000);
    });
  });

  describe('Helper Methods', () => {
    let resolver;

    beforeEach(() => {
      const mockLLM = createMockLLMClient('test');
      resolver = new RewriteResolver(mockLLM);
    });

    describe('needsClarification()', () => {
      test('should return false if needs_clarification not set', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        };

        expect(resolver.needsClarification(question)).toBe(false);
      });

      test('should return true if needs_clarification is true', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          needs_clarification: true
        };

        expect(resolver.needsClarification(question)).toBe(true);
      });

      test('should return false if needs_clarification is false', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          needs_clarification: false
        };

        expect(resolver.needsClarification(question)).toBe(false);
      });
    });

    describe('hasAmbiguities()', () => {
      test('should return false if no alternatives', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        };

        expect(resolver.hasAmbiguities(question)).toBe(false);
      });

      test('should return true if alternatives exist', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          alternatives: [
            { text: 'alternative 1', confidence: 0.8 }
          ]
        };

        expect(resolver.hasAmbiguities(question)).toBe(true);
      });

      test('should return false if alternatives is empty array', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          alternatives: []
        };

        expect(resolver.hasAmbiguities(question)).toBe(false);
      });
    });

    describe('getClarificationNeeds()', () => {
      test('should return null if no clarification needed', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        };

        expect(resolver.getClarificationNeeds(question)).toBe(null);
      });

      test('should return missing array if clarification needed', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          needs_clarification: true,
          missing: ['referent for pronoun "it"']
        };

        expect(resolver.getClarificationNeeds(question)).toEqual(['referent for pronoun "it"']);
      });

      test('should return empty array if clarification needed but no missing specified', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          needs_clarification: true
        };

        expect(resolver.getClarificationNeeds(question)).toEqual([]);
      });
    });

    describe('getAlternatives()', () => {
      test('should return null if no alternatives', () => {
        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        };

        expect(resolver.getAlternatives(question)).toBe(null);
      });

      test('should return alternatives array if exist', () => {
        const alternatives = [
          { text: 'interpretation 1', confidence: 0.8 },
          { text: 'interpretation 2', confidence: 0.6 }
        ];

        const question = {
          text: 'test',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en',
          alternatives
        };

        expect(resolver.getAlternatives(question)).toEqual(alternatives);
      });
    });
  });
});
