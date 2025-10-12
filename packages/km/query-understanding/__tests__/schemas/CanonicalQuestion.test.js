import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema
const schemaPath = join(__dirname, '../../schemas/CanonicalQuestion.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

describe('CanonicalQuestion Schema Validation', () => {
  let validator;

  beforeEach(() => {
    validator = createValidator(schema);
  });

  describe('Valid inputs', () => {
    test('should validate minimal valid question', () => {
      const question = {
        text: 'what is the capital of France?',
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate question with entities', () => {
      const question = {
        text: 'what countries border Germany?',
        entities: [
          {
            span: [23, 30],
            value: 'Germany',
            type: 'PLACE',
            canonical: ':Germany'
          }
        ],
        dates: [],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate question with dates', () => {
      const question = {
        text: 'what is net cash from operating activities in 2008?',
        entities: [],
        dates: [
          {
            span: [47, 51],
            iso: '2008-01-01/2008-12-31'
          }
        ],
        units: [],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate question with units', () => {
      const question = {
        text: 'what revenue exceeds 206k USD?',
        entities: [],
        dates: [],
        units: [
          {
            span: [24, 30],
            value: 206000,
            unit: 'USD'
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate question with null unit', () => {
      const question = {
        text: 'what values exceed 5 million?',
        entities: [],
        dates: [],
        units: [
          {
            span: [19, 29],
            value: 5000000,
            unit: null
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate all WH-role types', () => {
      const whRoles = ['what', 'which', 'who', 'where', 'when', 'how-many', 'how-much', 'why', 'how', 'yn'];

      whRoles.forEach(whRole => {
        const question = {
          text: 'test question',
          wh_role: whRole,
          lang: 'en'
        };

        const result = validator.validate(question);
        expect(result.valid).toBe(true);
      });
    });

    test('should validate question with needs_clarification', () => {
      const question = {
        text: 'what about it?',
        wh_role: 'what',
        lang: 'en',
        needs_clarification: true,
        missing: ['pronoun referent']
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });

    test('should validate question with alternatives', () => {
      const question = {
        text: 'what is the bank balance?',
        wh_role: 'what',
        lang: 'en',
        alternatives: [
          { text: 'what is the financial institution balance?', confidence: 0.8 },
          { text: 'what is the river bank balance?', confidence: 0.6 }
        ]
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid inputs', () => {
    test('should reject question without text', () => {
      const question = {
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should reject question without wh_role', () => {
      const question = {
        text: 'what is the capital?',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject question without lang', () => {
      const question = {
        text: 'what is the capital?',
        wh_role: 'what'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject empty text', () => {
      const question = {
        text: '',
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid wh_role', () => {
      const question = {
        text: 'test question',
        wh_role: 'invalid',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid lang format', () => {
      const question = {
        text: 'test question',
        wh_role: 'what',
        lang: 'english'  // Should be 2-letter code
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject entity without canonical IRI prefix', () => {
      const question = {
        text: 'test',
        entities: [
          {
            span: [0, 4],
            value: 'test',
            type: 'PLACE',
            canonical: 'NoColonPrefix'  // Missing : prefix
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject entity with invalid span length', () => {
      const question = {
        text: 'test',
        entities: [
          {
            span: [0],  // Should be exactly 2 items
            value: 'test',
            type: 'PLACE'
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject entity with negative span offset', () => {
      const question = {
        text: 'test',
        entities: [
          {
            span: [-1, 4],  // Negative offset
            value: 'test',
            type: 'PLACE'
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject date with invalid ISO format', () => {
      const question = {
        text: 'test',
        dates: [
          {
            span: [0, 4],
            iso: 'not-a-date'
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject unit with non-numeric value', () => {
      const question = {
        text: 'test',
        units: [
          {
            span: [0, 4],
            value: 'not-a-number',
            unit: 'USD'
          }
        ],
        wh_role: 'what',
        lang: 'en'
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject alternative with confidence outside range', () => {
      const question = {
        text: 'test',
        wh_role: 'what',
        lang: 'en',
        alternatives: [
          { text: 'alt', confidence: 1.5 }  // > 1.0
        ]
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });

    test('should reject alternative with negative confidence', () => {
      const question = {
        text: 'test',
        wh_role: 'what',
        lang: 'en',
        alternatives: [
          { text: 'alt', confidence: -0.5 }  // < 0
        ]
      };

      const result = validator.validate(question);
      expect(result.valid).toBe(false);
    });
  });

  describe('FAIL FAST behavior', () => {
    test('should throw on invalid data when using parse', () => {
      const invalidQuestion = {
        text: 'test',
        // Missing required fields
      };

      expect(() => {
        validator.schema.parse(invalidQuestion);
      }).toThrow();
    });
  });
});
