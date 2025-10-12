/**
 * Integration tests for NPVPParser with real LLM
 *
 * Tests Phase 2 NP/VP parsing with actual LLM client.
 * NO MOCKS - tests real end-to-end behavior.
 */

import { NPVPParser } from '../../src/phase2/NPVPParser.js';
import { ResourceManager } from '@legion/resource-manager';
import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema for validation
const schemaPath = join(__dirname, '../../schemas/NPVP_AST.schema.json');
const npvpSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const validator = createValidator(npvpSchema);

describe('NPVPParser Integration Tests', () => {
  let resourceManager;
  let llmClient;
  let parser;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLM client not available - required for integration tests');
    }

    parser = new NPVPParser(llmClient);
    await parser.initialize();
  }, 120000);

  // Add delay between tests to avoid rate limiting
  afterEach(async () => {
    console.log('Waiting 10 seconds to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  describe('Simple Questions', () => {
    test('should parse simple geography question', async () => {
      const canonical = {
        text: 'which countries border Germany?',
        wh_role: 'which',
        entities: [{ span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }],
        dates: [],
        units: [],
        lang: 'en'
      };

      const ast = await parser.parse(canonical);

      // Validate schema
      const validation = validator.validate(ast);
      expect(validation.valid).toBe(true);

      // Check structure
      expect(ast.S).toBeDefined();
      expect(ast.S.NP.Det).toBe('which');
      expect(ast.S.NP.Head).toBe('countries');
      expect(ast.S.VP.Verb).toBe('border');
      expect(ast.S.Force).toBe('ask');
    }, 120000);

    test('should parse "what" question with copula', async () => {
      const canonical = {
        text: 'what is the capital of France?',
        wh_role: 'what',
        entities: [{ span: [23, 29], value: 'France', type: 'PLACE', canonical: ':France' }],
        dates: [],
        units: [],
        lang: 'en'
      };

      const ast = await parser.parse(canonical);

      const validation = validator.validate(ast);
      expect(validation.valid).toBe(true);

      expect(ast.S.NP.Det).toBe('what');
      expect(ast.S.NP.Head).toBe('capital');
      expect(ast.S.VP.Verb).toBe('be');
    }, 120000);
  });

  describe('Questions with Temporal Modifiers', () => {
    test('should parse question with year modifier', async () => {
      const canonical = {
        text: 'what is revenue in 2023?',
        wh_role: 'what',
        entities: [{ span: [8, 15], value: 'revenue', type: 'MEASURE', canonical: ':revenue' }],
        dates: [{ span: [19, 23], iso: '2023-01-01/2023-12-31' }],
        units: [],
        lang: 'en'
      };

      const ast = await parser.parse(canonical);

      const validation = validator.validate(ast);
      expect(validation.valid).toBe(true);

      expect(ast.S.NP.Head).toBe('revenue');
      // Should have PP modifier for "in 2023"
      expect(ast.S.NP.Mods).toEqual(
        expect.arrayContaining([
          expect.arrayContaining(['pp', 'in'])
        ])
      );
    }, 120000);
  });

  describe('Schema Validation', () => {
    test('parser output should always validate against schema', async () => {
      const questions = [
        {
          text: 'which countries are in Europe?',
          wh_role: 'which',
          entities: [{ span: [23, 29], value: 'Europe', type: 'PLACE', canonical: ':Europe' }],
          dates: [],
          units: [],
          lang: 'en'
        }
      ];

      for (const canonical of questions) {
        const ast = await parser.parse(canonical);
        const validation = validator.validate(ast);

        if (!validation.valid) {
          console.error(`Validation failed for: ${canonical.text}`);
          console.error('AST:', JSON.stringify(ast, null, 2));
          console.error('Errors:', validation.errors);
        }

        expect(validation.valid).toBe(true);

        // Wait between questions in loop
        if (questions.indexOf(canonical) < questions.length - 1) {
          console.log('Waiting 5 seconds before next question...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }, 180000);
  });
});
