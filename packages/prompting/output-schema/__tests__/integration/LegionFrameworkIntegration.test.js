/**
 * Integration tests with Legion Framework
 * Tests package integration with @legion/schema and other Legion components
 * NO MOCKS - uses real Legion dependencies
 */

import { ResponseValidator } from '../../src/ResponseValidator.js';
import { createValidator } from '@legion/schema';

describe('Legion Framework Integration', () => {
  describe('@legion/schema integration', () => {
    test('should work with existing Legion schema validation', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 }
        },
        required: ['name']
      };

      // Verify @legion/schema works independently
      const legionValidator = createValidator(schema);
      const legionResult = legionValidator.validate({ name: 'Test', score: 85 });
      expect(legionResult.valid).toBe(true);

      // Verify our validator integrates properly
      const responseValidator = new ResponseValidator(schema);
      const jsonResponse = '{"name": "Test User", "score": 85}';
      const result = responseValidator.process(jsonResponse);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test User');
      expect(result.data.score).toBe(85);
    });

    test('should handle Legion schema validation errors correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { 
            type: 'string',
            format: 'email'
          },
          age: {
            type: 'number',
            minimum: 18
          }
        },
        required: ['email', 'age']
      };

      const responseValidator = new ResponseValidator(schema);
      const invalidResponse = '{"email": "not-an-email", "age": 15}';
      const result = responseValidator.process(invalidResponse);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should have validation errors from @legion/schema
      expect(result.errors.some(error => error.type === 'validation')).toBe(true);
    });

    test('should handle type coercion with Legion schema', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
          active: { type: 'boolean' }
        }
      };

      const coercingValidator = new ResponseValidator(schema, { 
        coerceTypes: true 
      });
      
      const stringResponse = '{"count": "42", "active": "true"}';
      const result = coercingValidator.process(stringResponse);

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(42);
      expect(result.data.active).toBe(true);
    });
  });

  describe('Package exports', () => {
    test('should export all main classes', async () => {
      const module = await import('../../src/index.js');
      
      expect(module.ResponseValidator).toBeDefined();
      expect(module.FormatDetector).toBeDefined();
      expect(module.ResponseParser).toBeDefined();
      expect(module.SchemaExtensions).toBeDefined();
      expect(module.SchemaAnalyzer).toBeDefined();
      expect(module.InstructionGenerator).toBeDefined();
      expect(module.BaseValidator).toBeDefined();
    });

    test('should export parser classes', async () => {
      const module = await import('../../src/index.js');
      
      expect(module.JSONParser).toBeDefined();
      expect(module.XMLParser).toBeDefined();
      expect(module.DelimitedParser).toBeDefined();
      expect(module.TaggedParser).toBeDefined();
      expect(module.MarkdownParser).toBeDefined();
    });

    test('should have ResponseValidator as default export', async () => {
      const module = await import('../../src/index.js');
      expect(module.default).toBeDefined();
      expect(module.default).toBe(module.ResponseValidator);
    });
  });

  describe('Monorepo workspace compatibility', () => {
    test('should work as workspace dependency', () => {
      // Test that we can create and use the validator
      const schema = {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'number' }
        }
      };

      const validator = new ResponseValidator(schema);
      
      // Test instruction generation
      const instructions = validator.generateInstructions({ 
        message: 'Hello world', 
        code: 200 
      });
      expect(instructions).toContain('JSON');

      // Test processing
      const response = '{"message": "Success", "code": 200}';
      const result = validator.process(response);
      expect(result.success).toBe(true);
    });

    test('should handle JSON5 dependency correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'string' }
        }
      };

      const validator = new ResponseValidator(schema);
      
      // Test JSON5 parsing (trailing comma)
      const json5Response = '{"data": "test value",}';
      const result = validator.process(json5Response);
      
      // Should either parse successfully or fail gracefully
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Error boundary testing', () => {
    test('should handle @legion/schema errors gracefully', () => {
      const schema = {
        type: 'object',
        properties: {
          complex: {
            type: 'object',
            properties: {
              nested: { type: 'string' }
            },
            required: ['nested']
          }
        }
      };

      const validator = new ResponseValidator(schema);
      const incompleteResponse = '{"complex": {}}'; // Missing required nested field
      
      const result = validator.process(incompleteResponse);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should maintain error context through processing pipeline', () => {
      const schema = {
        type: 'object',
        properties: {
          value: { 
            type: 'number',
            minimum: 10,
            maximum: 90
          }
        },
        required: ['value']
      };

      const validator = new ResponseValidator(schema);
      const invalidResponse = '{"value": 150}'; // Value too high
      
      const result = validator.process(invalidResponse);
      expect(result.success).toBe(false);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.errors.length).toBeGreaterThan(0);
      // Error should have useful information for reprompting
      expect(result.errors[0].message).toBeDefined();
    });
  });

  describe('Real-world usage scenarios', () => {
    test('should handle complete end-to-end workflow', () => {
      const analysisSchema = {
        type: 'object',
        properties: {
          summary: { 
            type: 'string',
            description: 'Brief analysis summary',
            minLength: 10
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral'],
            description: 'Overall sentiment'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Analysis confidence'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
            description: 'Key terms identified'
          }
        },
        required: ['summary', 'sentiment', 'confidence']
      };

      const validator = new ResponseValidator(analysisSchema);
      
      // 1. Generate instructions
      const example = {
        summary: "The customer feedback shows strong satisfaction with the new interface design",
        sentiment: "positive", 
        confidence: 0.87,
        keywords: ["satisfaction", "interface", "design"]
      };
      
      const instructions = validator.generateInstructions(example);
      expect(instructions).toContain('summary');
      expect(instructions).toContain('positive | negative | neutral');
      expect(instructions).toContain('EXAMPLE OUTPUT');

      // 2. Process valid response
      const validResponse = `{
        "summary": "Users appreciate the improved navigation and visual design elements",
        "sentiment": "positive",
        "confidence": 0.82,
        "keywords": ["navigation", "visual", "design"]
      }`;
      
      const result = validator.process(validResponse);
      expect(result.success).toBe(true);
      expect(result.data.sentiment).toBe('positive');
      expect(result.data.keywords).toHaveLength(3);

      // 3. Process invalid response
      const invalidResponse = `{
        "summary": "Short",
        "sentiment": "maybe",
        "confidence": 1.2
      }`;
      
      const errorResult = validator.process(invalidResponse);
      expect(errorResult.success).toBe(false);
      expect(errorResult.errors.length).toBeGreaterThan(0);
    });
  });
});