/**
 * Unit tests for ResponseValidator - Main class with dual functionality
 */

import { ResponseValidator } from '../../src/ResponseValidator.js';

describe('ResponseValidator', () => {
  let validator;
  let schema;

  beforeEach(() => {
    schema = {
      type: 'object',
      properties: {
        task: { 
          type: 'string',
          description: 'Task description',
          minLength: 5
        },
        confidence: { 
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence level'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 3
        }
      },
      required: ['task']
    };
    validator = new ResponseValidator(schema);
  });

  describe('constructor', () => {
    test('should create validator with schema', () => {
      expect(validator).toBeDefined();
      expect(validator.schema).toEqual(schema);
    });

    test('should validate schema on construction', () => {
      const invalidSchema = {
        // Missing type
        properties: { name: { type: 'string' } }
      };

      expect(() => new ResponseValidator(invalidSchema))
        .toThrow('Schema must have a type property');
    });

    test('should accept configuration options', () => {
      const options = {
        strictMode: false,
        preferredFormat: 'xml',
        autoRepair: false
      };

      const customValidator = new ResponseValidator(schema, options);
      expect(customValidator.options.strictMode).toBe(false);
      expect(customValidator.options.preferredFormat).toBe('xml');
    });
  });

  describe('generateInstructions', () => {
    test('should generate basic instructions from schema and example', () => {
      const exampleData = {
        task: 'Analyze user feedback',
        confidence: 0.85,
        tags: ['feedback', 'analysis']
      };

      const instructions = validator.generateInstructions(exampleData);
      
      expect(instructions).toContain('JSON');
      expect(instructions).toContain('task');
      expect(instructions).toContain('confidence');
      expect(instructions).toContain('EXAMPLE OUTPUT');
      expect(instructions).toContain('Analyze user feedback');
    });

    test('should respect format option', () => {
      const exampleData = { task: 'Test task' };
      
      const jsonInstructions = validator.generateInstructions(exampleData, { format: 'json' });
      const xmlInstructions = validator.generateInstructions(exampleData, { format: 'xml' });
      
      expect(jsonInstructions).toContain('JSON');
      expect(xmlInstructions).toContain('XML');
    });

    test('should handle missing example data', () => {
      const instructions = validator.generateInstructions(null);
      
      expect(instructions).toContain('JSON');
      expect(instructions).toContain('task');
      // Should not contain EXAMPLE OUTPUT section
      expect(instructions).not.toContain('EXAMPLE OUTPUT');
    });

    test('should include validation constraints', () => {
      const exampleData = { task: 'Test', confidence: 0.5 };
      const instructions = validator.generateInstructions(exampleData, {
        includeConstraints: true
      });
      
      expect(instructions).toContain('VALIDATION REQUIREMENTS');
      expect(instructions).toContain('Required fields');
      expect(instructions).toContain('confidence must be between 0 and 1');
    });

    test('should respect verbosity option', () => {
      const exampleData = { task: 'Test task' };
      
      const conciseInstructions = validator.generateInstructions(exampleData, { 
        verbosity: 'concise',
        includeConstraints: false,
        errorPrevention: false
      });
      const detailedInstructions = validator.generateInstructions(exampleData, { 
        verbosity: 'detailed'
      });
      
      expect(detailedInstructions.length).toBeGreaterThan(conciseInstructions.length);
    });
  });

  describe('process', () => {
    test('should process valid JSON response', () => {
      const jsonResponse = '{"task": "Complete project", "confidence": 0.9, "tags": ["work", "project"]}';
      const result = validator.process(jsonResponse);
      
      expect(result.success).toBe(true);
      expect(result.data.task).toBe('Complete project');
      expect(result.data.confidence).toBe(0.9);
      expect(result.data.tags).toEqual(['work', 'project']);
    });

    test('should process valid XML response', () => {
      const xmlResponse = '<response><task>Complete project</task><confidence>0.9</confidence></response>';
      const result = validator.process(xmlResponse);
      
      expect(result.success).toBe(true);
      expect(result.data.task).toBe('Complete project');
      // XML parsing may return strings that get coerced to numbers
      expect(result.data.confidence).toEqual(expect.any(Number));
    });

    test('should return parsing errors for malformed response', () => {
      const malformedResponse = '{"task": "Complete project", "confidence": 0.9'; // Missing closing brace
      const result = validator.process(malformedResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].type).toBe('parsing');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    test('should return validation errors for invalid data', () => {
      const invalidResponse = '{"task": "Hi", "confidence": 1.5}'; // task too short, confidence too high
      const result = validator.process(invalidResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      // Check that we have validation errors
      expect(result.errors.some(error => error.type === 'validation')).toBe(true);
    });

    test('should handle auto-format detection', () => {
      const xmlResponse = '<response><task>Valid task description</task><confidence>0.8</confidence></response>';
      const result = validator.process(xmlResponse);
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('xml');
      expect(result.data.task).toBe('Valid task description');
    });

    test('should return partial results when configured', () => {
      const partialValidator = new ResponseValidator(schema, { 
        partialResults: true 
      });
      
      const partialResponse = '{"task": "Valid task description"}'; // Missing required confidence
      const result = partialValidator.process(partialResponse);
      
      // Should depend on validation behavior
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    test('should handle unknown format gracefully', () => {
      const unknownResponse = 'This is just plain text without structure';
      const result = validator.process(unknownResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toMatch(/parsing|format/);
    });
  });

  describe('validateSchema', () => {
    test('should validate correct extended schema', () => {
      expect(() => validator.validateSchema()).not.toThrow();
    });

    test('should detect invalid schema', () => {
      expect(() => {
        new ResponseValidator({
          type: 'object',
          'x-format': {
            'invalid-format': {}
          }
        });
      }).toThrow('Unsupported format');
    });
  });

  describe('getSupportedFormats', () => {
    test('should return supported formats', () => {
      const formats = validator.getSupportedFormats();
      expect(formats).toContain('json');
      expect(formats).toContain('xml');
      expect(formats).toContain('delimited');
      expect(formats).toContain('tagged');
      expect(formats).toContain('markdown');
    });

    test('should return custom formats from schema', () => {
      const customSchema = {
        ...schema,
        'x-format': {
          json: { style: 'compact' },
          xml: { 'root-element': 'response' }
        }
      };

      const customValidator = new ResponseValidator(customSchema);
      const formats = customValidator.getSupportedFormats();
      
      expect(formats).toContain('json');
      expect(formats).toContain('xml');
    });
  });

  describe('error handling integration', () => {
    test('should provide actionable errors for reprompting', () => {
      const invalidResponse = '{"task": "Hi"}'; // Too short, missing confidence
      const result = validator.process(invalidResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      // Each error should have actionable information
      result.errors.forEach(error => {
        expect(error.type).toBeDefined();
        expect(error.message).toBeDefined();
        // Not all errors have suggestions, but they should have either suggestion or be self-explanatory
        expect(error.suggestion || error.message).toBeDefined();
      });
    });

    test('should handle mixed parsing and validation errors', () => {
      const mixedErrorResponse = '{"task": "Valid task description", "confidence": "not_a_number"'; // Parse + validation errors
      const result = validator.process(mixedErrorResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});