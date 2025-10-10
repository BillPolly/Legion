import { jest } from '@jest/globals';
import { KGToTextGenerator } from '../../src/kg/KGToTextGenerator.js';
import { SemanticValidator } from '../../src/kg/SemanticValidator.js';
import { ResourceManager } from '@legion/resource-manager';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';

/**
 * Phase 5: Validation System Tests
 *
 * Tests KG → Text generation and semantic validation to ensure
 * knowledge graphs capture all source information.
 */

describe('Validation System (Phase 5)', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let kgGenerator;
  let validator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    tripleStore = new TripleStore();

    kgGenerator = new KGToTextGenerator({ llmClient, tripleStore });
    validator = new SemanticValidator({ semanticSearch });
  }, 60000);

  describe('Unit Tests: KG to Text Generation', () => {
    test('should build graph view from instances', () => {
      const instances = {
        entities: [
          {
            uri: 'data:AcmeCorp',
            type: 'kg:Organization',
            label: 'Acme Corporation',
            properties: {
              'kg:hasRevenue': '1000000'
            }
          }
        ],
        relationships: []
      };

      const graphView = kgGenerator.buildGraphView(instances);

      console.log('\n📊 Graph view:', graphView);

      expect(graphView).toContain('Acme Corporation');
      expect(graphView).toContain('kg:Organization');
      expect(graphView).toContain('1000000');

      console.log('✅ Successfully built graph view from instances');
    });

    test('should format instances for text generation', () => {
      const instances = {
        entities: [
          {
            uri: 'data:AcmeCorp',
            type: 'kg:Organization',
            label: 'Acme Corp',
            properties: {}
          },
          {
            uri: 'data:Obs1',
            type: 'kg:Observation',
            label: 'Revenue observation',
            properties: {
              'kg:hasValue': '500000'
            }
          }
        ],
        relationships: [
          {
            subject: 'data:Obs1',
            predicate: 'kg:forOrganization',
            object: 'data:AcmeCorp'
          }
        ]
      };

      const formatted = kgGenerator.formatInstancesForPrompt(instances);

      expect(formatted).toContain('Acme Corp');
      expect(formatted).toContain('Observation');
      expect(formatted).toContain('forOrganization');

      console.log('✅ Successfully formatted instances for text generation');
    });
  });

  describe('Integration Tests: Text Generation from KG', () => {
    test('should generate text from simple knowledge graph', async () => {
      const instances = {
        entities: [
          {
            uri: 'data:AcmeCorp',
            type: 'kg:Organization',
            label: 'Acme Corporation',
            properties: {
              'kg:hasRevenue': '1000000'
            }
          }
        ],
        relationships: []
      };

      const generatedText = await kgGenerator.generateText(instances);

      console.log('\n📄 Generated text:', generatedText);

      expect(generatedText).toBeTruthy();
      expect(typeof generatedText).toBe('string');
      expect(generatedText.length).toBeGreaterThan(10);

      // Should mention the organization
      const mentionsOrg = generatedText.toLowerCase().includes('acme');
      expect(mentionsOrg).toBe(true);

      console.log('✅ Successfully generated text from knowledge graph');
    }, 30000);

    test('should generate text capturing observations', async () => {
      const instances = {
        entities: [
          {
            uri: 'data:TechCo',
            type: 'kg:Organization',
            label: 'TechCo',
            properties: {}
          },
          {
            uri: 'data:RevenueMetric',
            type: 'kg:FinancialMetric',
            label: 'Revenue',
            properties: {}
          },
          {
            uri: 'data:Obs1',
            type: 'kg:Observation',
            label: 'TechCo Revenue',
            properties: {
              'kg:hasValue': '2000000'
            }
          }
        ],
        relationships: [
          {
            subject: 'data:Obs1',
            predicate: 'kg:forOrganization',
            object: 'data:TechCo'
          },
          {
            subject: 'data:Obs1',
            predicate: 'kg:hasMetric',
            object: 'data:RevenueMetric'
          }
        ]
      };

      const generatedText = await kgGenerator.generateText(instances);

      console.log('\n📄 Generated text with observations:', generatedText);

      // Should mention the company and value
      const mentionsCo = generatedText.toLowerCase().includes('techco');
      const mentionsRevenue = generatedText.toLowerCase().includes('revenue') ||
                              generatedText.includes('2000000') ||
                              generatedText.includes('2,000,000');

      expect(mentionsCo).toBe(true);
      expect(mentionsRevenue).toBe(true);

      console.log('✅ Generated text captures observations correctly');
    }, 30000);
  });

  describe('Unit Tests: Semantic Validation', () => {
    test('should calculate semantic similarity between texts', async () => {
      const text1 = 'Acme Corporation has revenue of $1 million.';
      const text2 = 'Acme Corp earned $1M in revenue.';

      const similarity = await validator.calculateSimilarity(text1, text2);

      console.log(`\n📊 Semantic similarity: ${similarity}`);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
      // Similar sentences should have high similarity
      expect(similarity).toBeGreaterThan(0.7);

      console.log('✅ Successfully calculated semantic similarity');
    }, 30000);
  });

  describe('Integration Tests: Coverage Validation', () => {
    test('should validate high coverage when KG is complete', async () => {
      const sourceText = 'Acme Corporation reported revenue of $500,000 for the year 2023.';

      // Generate KG text that captures same information
      const kgText = 'Acme Corporation has revenue of $500,000 in 2023.';

      const result = await validator.validateCoverage(sourceText, kgText);

      console.log('\n📊 Coverage validation (complete):', result);

      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('complete');
      expect(result.similarity).toBeGreaterThan(0.8);
      expect(result.complete).toBe(true);

      console.log('✅ High coverage validated correctly');
    }, 30000);

    test('should detect low coverage when KG is incomplete', async () => {
      const sourceText = 'Acme Corporation reported revenue of $500,000, net income of $100,000, and employed 50 people in 2023.';

      // KG text missing employee information
      const kgText = 'Acme Corporation has revenue of $500,000 and net income of $100,000.';

      const result = await validator.validateCoverage(sourceText, kgText);

      console.log('\n📊 Coverage validation (incomplete):', result);

      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('complete');
      // Should detect the gap (lower similarity)
      expect(result.similarity).toBeLessThan(1.0);

      console.log('✅ Low coverage detected correctly');
    }, 30000);

    test('should perform end-to-end validation', async () => {
      // Source text
      const sourceText = 'DataCorp achieved $750,000 in revenue for Q1 2024.';

      // Create instances
      const instances = {
        entities: [
          {
            uri: 'data:DataCorp',
            type: 'kg:Organization',
            label: 'DataCorp',
            properties: {}
          },
          {
            uri: 'data:RevenueMetric',
            type: 'kg:FinancialMetric',
            label: 'Revenue',
            properties: {}
          },
          {
            uri: 'data:Obs1',
            type: 'kg:Observation',
            label: 'DataCorp Q1 2024 Revenue',
            properties: {
              'kg:hasValue': '750000'
            }
          }
        ],
        relationships: [
          {
            subject: 'data:Obs1',
            predicate: 'kg:forOrganization',
            object: 'data:DataCorp'
          },
          {
            subject: 'data:Obs1',
            predicate: 'kg:hasMetric',
            object: 'data:RevenueMetric'
          }
        ]
      };

      // Generate text from KG
      const generatedText = await kgGenerator.generateText(instances);
      console.log('\n📄 Generated text:', generatedText);

      // Validate coverage
      const result = await validator.validateCoverage(sourceText, generatedText);
      console.log('📊 Validation result:', result);

      expect(result.similarity).toBeGreaterThan(0.7);

      console.log('✅ End-to-end validation completed successfully');
    }, 45000);
  });
});
