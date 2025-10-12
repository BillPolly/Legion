/**
 * Integration tests for RewriteResolver with real LLM
 *
 * Tests Phase 1 question normalization with actual LLM client.
 * NO MOCKS - tests real end-to-end behavior.
 */

import { RewriteResolver } from '../../src/phase1/RewriteResolver.js';
import { ResourceManager } from '@legion/resource-manager';
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

describe('RewriteResolver Integration Tests', () => {
  let resourceManager;
  let llmClient;
  let resolver;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLM client not available - required for integration tests');
    }

    resolver = new RewriteResolver(llmClient);
  }, 120000);

  // Add delay between tests to avoid rate limiting
  // ZAI API has strict rate limits - wait 10 seconds between each test
  afterEach(async () => {
    console.log('Waiting 10 seconds to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
  });

  describe('Basic Question Normalization', () => {
    test('should normalize simple geography question', async () => {
      const result = await resolver.resolve('Which countries border Germany?');

      // Validate schema
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Check basic structure
      expect(result.text).toBe('which countries border Germany?');
      expect(result.wh_role).toBe('which');
      expect(result.lang).toBe('en');

      // Should identify Germany as entity
      expect(result.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: 'Germany',
            type: 'PLACE'
          })
        ])
      );

      // Should have canonical IRI
      expect(result.entities[0].canonical).toMatch(/Germany/i);

      // Should have span
      expect(result.entities[0].span).toHaveLength(2);
      expect(result.entities[0].span[0]).toBeGreaterThanOrEqual(0);
      expect(result.entities[0].span[1]).toBeGreaterThan(result.entities[0].span[0]);
    }, 120000); // Increased timeout for rate limit retries

    test('should normalize finance question with entity', async () => {
      const result = await resolver.resolve('What is the revenue of Microsoft?');

      // Validate schema
      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      expect(result.wh_role).toBe('what');
      expect(result.lang).toBe('en');

      // Should identify both revenue (MEASURE) and Microsoft (ORGANIZATION)
      expect(result.entities.length).toBeGreaterThanOrEqual(1);

      const msEntity = result.entities.find(e => e.value.toLowerCase().includes('microsoft'));
      expect(msEntity).toBeDefined();
      expect(msEntity.type).toBe('ORGANIZATION');
    }, 120000); // Increased timeout for rate limit retries
  });

  describe('Date Normalization', () => {
    test('should normalize year to ISO date range', async () => {
      const result = await resolver.resolve('What is revenue in 2023?');

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should identify date
      expect(result.dates).toHaveLength(1);
      expect(result.dates[0].iso).toBe('2023-01-01/2023-12-31');

      // Should have span
      expect(result.dates[0].span).toHaveLength(2);
    }, 120000);

    test('should normalize Q3 2023 to ISO date range', async () => {
      const result = await resolver.resolve('What is revenue in Q3 2023?');

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should identify date
      expect(result.dates).toHaveLength(1);
      expect(result.dates[0].iso).toBe('2023-07-01/2023-09-30');

      // Should have span
      expect(result.dates[0].span).toHaveLength(2);
    }, 120000);
  });

  describe('Unit Parsing', () => {
    test('should parse 206k USD to numeric value and unit', async () => {
      const result = await resolver.resolve('What revenue exceeds 206k USD?');

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should identify unit
      expect(result.units).toHaveLength(1);
      expect(result.units[0].value).toBe(206000);
      expect(result.units[0].unit).toBe('USD');

      // Should have span
      expect(result.units[0].span).toHaveLength(2);
    }, 120000);

    test('should parse 5 million dollars', async () => {
      const result = await resolver.resolve('What revenue exceeds 5 million dollars?');

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should identify unit
      expect(result.units).toHaveLength(1);
      expect(result.units[0].value).toBe(5000000);
      expect(result.units[0].unit).toMatch(/USD|dollars/i);

      // Should have span
      expect(result.units[0].span).toHaveLength(2);
    }, 120000);
  });

  describe('Reference Resolution with Context', () => {
    test('should resolve ellipsis with previous question context', async () => {
      const result = await resolver.resolve('what about in 2008?', {
        previousQuestion: 'what is net cash from operating activities in 2007?'
      });

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should expand ellipsis to full question
      expect(result.text).toContain('net cash from operating activities');
      expect(result.text).toContain('2008');

      // Should identify measure entity
      const measureEntity = result.entities.find(e =>
        e.value.toLowerCase().includes('net cash') ||
        e.type === 'MEASURE'
      );
      expect(measureEntity).toBeDefined();

      // Should identify date
      expect(result.dates).toHaveLength(1);
      expect(result.dates[0].iso).toContain('2008');
    }, 120000);

    test('should use domain hint for disambiguation', async () => {
      const result = await resolver.resolve('What is net income?', {
        domain: 'finance'
      });

      const validation = validator.validate(result);
      expect(validation.valid).toBe(true);

      // Should identify net income as financial measure
      const measureEntity = result.entities.find(e =>
        e.value.toLowerCase().includes('net income') ||
        e.type === 'MEASURE'
      );
      expect(measureEntity).toBeDefined();
    }, 120000);
  });

  describe('WH-role Identification', () => {
    test('should identify what question', async () => {
      const result = await resolver.resolve('What is the capital of France?');
      expect(result.wh_role).toBe('what');
    }, 120000);

    test('should identify which question', async () => {
      const result = await resolver.resolve('Which countries are in Europe?');
      expect(result.wh_role).toBe('which');
    }, 120000);

    test('should identify who question', async () => {
      const result = await resolver.resolve('Who founded Microsoft?');
      expect(result.wh_role).toBe('who');
    }, 120000);

    test('should identify where question', async () => {
      const result = await resolver.resolve('Where is the Eiffel Tower?');
      expect(result.wh_role).toBe('where');
    }, 120000);

    test('should identify when question', async () => {
      const result = await resolver.resolve('When was Ada Lovelace born?');
      expect(result.wh_role).toBe('when');
    }, 120000);

    test('should identify how-many question', async () => {
      const result = await resolver.resolve('How many countries are in Europe?');
      expect(result.wh_role).toBe('how-many');
    }, 120000);
  });

  describe('Schema Validation', () => {
    test('all outputs should validate against CanonicalQuestion schema', async () => {
      // Reduced to 3 questions to keep test duration manageable
      const questions = [
        'What is the capital of France?',
        'Which countries border Germany?',
        'What is revenue in 2023?'
      ];

      for (const question of questions) {
        const result = await resolver.resolve(question);
        const validation = validator.validate(result);

        if (!validation.valid) {
          console.error(`Validation failed for question: ${question}`);
          console.error('Result:', JSON.stringify(result, null, 2));
          console.error('Errors:', validation.errors);
        }

        expect(validation.valid).toBe(true);

        // Add delay between questions in the loop
        if (questions.indexOf(question) < questions.length - 1) {
          console.log('Waiting 5 seconds before next question in batch...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }, 180000);
  });

  describe('Helper Methods', () => {
    test('needsClarification should work with real LLM output', async () => {
      const result = await resolver.resolve('What is it?');

      // This should likely need clarification (no referent for "it")
      // But depends on LLM response
      const needsClarification = resolver.needsClarification(result);
      expect(typeof needsClarification).toBe('boolean');
    }, 120000);

    test('hasAmbiguities should work with real LLM output', async () => {
      const result = await resolver.resolve('What is the capital?');

      // This might have ambiguities (capital of what?)
      // But depends on LLM response
      const hasAmbiguities = resolver.hasAmbiguities(result);
      expect(typeof hasAmbiguities).toBe('boolean');
    }, 120000);
  });
});
