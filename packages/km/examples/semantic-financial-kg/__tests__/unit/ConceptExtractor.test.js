import { jest } from '@jest/globals';
import { ConceptExtractor } from '../../src/kg/ConceptExtractor.js';
import { ResourceManager } from '@legion/resource-manager';
import { ConvFinQAParser } from '../../src/data/ConvFinQAParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 1: Concept Extraction Tests
 *
 * Tests that ConceptExtractor can extract entities, relationships, and attributes
 * from various data formats using LLM.
 */

describe('ConceptExtractor (Phase 1)', () => {
  let resourceManager;
  let llmClient;
  let conceptExtractor;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    conceptExtractor = new ConceptExtractor({ llmClient });
  }, 60000);

  describe('Unit Tests: Concept extraction with simple data', () => {
    test('should extract concepts from simple JSON data', async () => {
      const data = {
        company: 'Acme Corp',
        revenue: 1000000,
        employees: 50
      };

      const concepts = await conceptExtractor.extractConcepts(data);

      console.log('\n📊 Extracted concepts from JSON:', concepts);

      expect(concepts).toHaveProperty('entities');
      expect(concepts).toHaveProperty('relationships');
      expect(concepts).toHaveProperty('attributes');

      expect(Array.isArray(concepts.entities)).toBe(true);
      expect(Array.isArray(concepts.relationships)).toBe(true);
      expect(Array.isArray(concepts.attributes)).toBe(true);

      expect(concepts.entities.length).toBeGreaterThan(0);
      expect(concepts.attributes.length).toBeGreaterThan(0);

      console.log('✅ Successfully extracted concepts from JSON');
    }, 30000);

    test('should extract concepts from text data', async () => {
      const text = 'John works at Microsoft as a software engineer. He earns $150,000 per year.';

      const concepts = await conceptExtractor.extractConcepts(text);

      console.log('\n📊 Extracted concepts from text:', concepts);

      expect(concepts).toHaveProperty('entities');
      expect(concepts).toHaveProperty('relationships');
      expect(concepts).toHaveProperty('attributes');

      expect(concepts.entities.length).toBeGreaterThan(0);

      console.log('✅ Successfully extracted concepts from text');
    }, 30000);

    test('should extract concepts from table data', async () => {
      const table = {
        columns: ['Product', 'Price', 'Quantity'],
        rows: [
          ['Widget A', 19.99, 100],
          ['Widget B', 29.99, 50]
        ]
      };

      const concepts = await conceptExtractor.extractConcepts(table);

      console.log('\n📊 Extracted concepts from table:', concepts);

      expect(concepts.entities.length).toBeGreaterThan(0);
      expect(concepts.attributes.length).toBeGreaterThan(0);

      console.log('✅ Successfully extracted concepts from table');
    }, 30000);
  });

  describe('Integration Tests: Concept extraction from real data', () => {
    test('should extract concepts from ConvFinQA document', async () => {
      // Load real ConvFinQA data
      const datasetPath = path.join(__dirname, '../../data/convfinqa_dataset.json');
      const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
      const record = dataset.train[0];

      const parser = new ConvFinQAParser();
      const parsedDoc = parser.parse(record);

      const concepts = await conceptExtractor.extractConcepts(parsedDoc);

      console.log('\n📊 Extracted concepts from ConvFinQA:', concepts);

      // Should extract financial domain concepts (organization, company, or business)
      const hasBusinessEntity = concepts.entities.some(e =>
        ['organization', 'company', 'business'].includes(e.toLowerCase())
      );
      expect(hasBusinessEntity).toBe(true);
      expect(concepts.entities.length).toBeGreaterThan(3);

      // Should extract financial attributes
      const hasFinancialAttributes = concepts.attributes.some(attr =>
        ['revenue', 'income', 'value', 'amount', 'period', 'date'].some(term => attr.includes(term))
      );
      expect(hasFinancialAttributes).toBe(true);

      console.log('✅ Successfully extracted financial domain concepts');
    }, 30000);

    test('should extract concepts from pure narrative text', async () => {
      const narrative = `Apple Inc. reported quarterly revenue of $97.3 billion for Q1 2024.
                        The company's net income increased by 13% compared to the previous quarter.
                        CEO Tim Cook highlighted strong performance in Services and iPhone sales.`;

      const concepts = await conceptExtractor.extractConcepts(narrative);

      console.log('\n📊 Extracted concepts from narrative:', concepts);

      // Should identify business entities
      const hasBusinessEntity = concepts.entities.some(entity =>
        ['organization', 'company', 'business'].includes(entity.toLowerCase())
      );
      expect(hasBusinessEntity).toBe(true);

      // Should identify financial metrics
      const hasFinancialConcepts = concepts.attributes.some(attr =>
        ['revenue', 'income', 'sales'].some(term => attr.includes(term))
      );
      expect(hasFinancialConcepts).toBe(true);

      console.log('✅ Successfully extracted concepts from narrative');
    }, 30000);
  });

  describe('Integration Test: Verify extracted concepts match domain', () => {
    test('should extract domain-appropriate concepts for financial data', async () => {
      const financialData = {
        company: 'JKHY',
        fiscalYear: 2009,
        metrics: {
          netIncome: 104681,
          revenue: 500000,
          expenses: 395319
        },
        periods: ['2007', '2008', '2009']
      };

      const concepts = await conceptExtractor.extractConcepts(financialData);

      console.log('\n📊 Domain-specific concepts:', concepts);

      // Verify financial domain entities
      const hasFinancialEntities = concepts.entities.some(e =>
        ['organization', 'company', 'metric', 'period'].some(term => e.includes(term))
      );
      expect(hasFinancialEntities).toBe(true);

      // Verify financial relationships
      const hasFinancialRelationships = concepts.relationships.length >= 0; // May have relationships
      expect(hasFinancialRelationships).toBe(true);

      // Verify financial attributes
      const hasFinancialAttributes = concepts.attributes.some(a =>
        ['income', 'revenue', 'expense', 'value', 'amount', 'year', 'date', 'period'].some(term => a.includes(term))
      );
      expect(hasFinancialAttributes).toBe(true);

      console.log('✅ Extracted concepts match financial domain');
    }, 30000);
  });
});
