import { jest } from '@jest/globals';
import { InstanceBuilder } from '../../src/kg/InstanceBuilder.js';
import { ResourceManager } from '@legion/resource-manager';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '@legion/ontology';

/**
 * Phase 6: Full Pipeline Integration Tests
 *
 * Tests the complete InstanceBuilder system end-to-end,
 * integrating all components into a cohesive pipeline.
 */

describe('InstanceBuilder - Full Pipeline Integration (Phase 6)', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let ontologyBuilder;
  let instanceBuilder;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Set up infrastructure
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    tripleStore = new TripleStore();
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: { enabled: false }
    });

    // Create InstanceBuilder with all dependencies
    instanceBuilder = new InstanceBuilder({
      tripleStore,
      ontologyBuilder,
      llmClient,
      semanticSearch
    });
  }, 60000);

  describe('Integration Tests: Full pipeline with various data types', () => {
    test('should process text-only data through full pipeline', async () => {
      const data = {
        text: 'Acme Corporation reported revenue of $1 million for the year 2023. The company has 50 employees.'
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Text-only pipeline results:', JSON.stringify(results, null, 2));

      expect(results).toHaveProperty('text');
      expect(results.text).toHaveProperty('entities');
      expect(results.text.entities.length).toBeGreaterThan(0);

      expect(results).toHaveProperty('validation');
      expect(results.validation).toHaveProperty('similarity');

      console.log('✅ Text-only pipeline completed successfully');
    }, 60000);

    test('should process table-only data through full pipeline', async () => {
      const data = {
        table: {
          headers: ['Company', 'Q1 Revenue', 'Q2 Revenue'],
          rows: [
            ['Acme Corp', '100000', '120000'],
            ['Tech Inc', '150000', '160000']
          ]
        }
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Table-only pipeline results:', JSON.stringify(results, null, 2));

      expect(results).toHaveProperty('table');
      expect(results.table).toHaveProperty('entities');
      expect(results.table.entities.length).toBeGreaterThan(0);

      // Should create various entity types (organizations, metrics, observations)
      // The LLM may use different type names, so just verify entities were created
      expect(results.table.entities.length).toBeGreaterThan(2);

      console.log('✅ Table-only pipeline completed successfully');
    }, 60000);

    test('should process mixed data (text + table) through full pipeline', async () => {
      const data = {
        preText: 'The following table shows quarterly revenue for major tech companies.',
        table: {
          headers: ['Company', 'Q1 Revenue'],
          rows: [
            ['DataCorp', '500000']
          ]
        },
        postText: 'All figures are in US dollars.'
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Mixed data pipeline results:', JSON.stringify(results, null, 2));

      expect(results).toHaveProperty('preText');
      expect(results).toHaveProperty('table');
      expect(results).toHaveProperty('postText');
      expect(results).toHaveProperty('validation');

      // All sections should have entities
      if (results.preText) {
        expect(results.preText.entities).toBeDefined();
      }
      expect(results.table.entities.length).toBeGreaterThan(0);
      if (results.postText) {
        expect(results.postText.entities).toBeDefined();
      }

      console.log('✅ Mixed data pipeline completed successfully');
    }, 90000);
  });

  describe('Integration Tests: Validation in results', () => {
    test('should include validation results in return value', async () => {
      const data = {
        text: 'TechCo has revenue of $750,000.'
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Results with validation:', JSON.stringify(results.validation, null, 2));

      expect(results).toHaveProperty('validation');
      expect(results.validation).toHaveProperty('similarity');
      expect(results.validation).toHaveProperty('complete');
      expect(results.validation).toHaveProperty('sourceText');
      expect(results.validation).toHaveProperty('generatedText');

      expect(typeof results.validation.similarity).toBe('number');
      expect(typeof results.validation.complete).toBe('boolean');

      console.log('✅ Validation results included correctly');
    }, 60000);

    test('should validate coverage against source data', async () => {
      const data = {
        text: 'Acme Corporation reported revenue of $1M in 2023.'
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Coverage validation:');
      console.log(`  Source: ${results.validation.sourceText}`);
      console.log(`  Generated: ${results.validation.generatedText}`);
      console.log(`  Similarity: ${results.validation.similarity}`);
      console.log(`  Complete: ${results.validation.complete}`);

      // Generated text should mention key information
      const generatedLower = results.validation.generatedText.toLowerCase();
      const mentionsAcme = generatedLower.includes('acme');
      const mentionsRevenue = generatedLower.includes('revenue') ||
                              generatedLower.includes('1') ||
                              generatedLower.includes('million');

      expect(mentionsAcme || mentionsRevenue).toBe(true);

      console.log('✅ Coverage validation working correctly');
    }, 60000);
  });

  describe('Integration Tests: End-to-end functionality', () => {
    test('should execute complete pipeline from data to validated KG', async () => {
      const data = {
        text: 'In Q1 2024, NewCorp achieved $2 million in revenue and hired 25 new employees.'
      };

      const results = await instanceBuilder.createInstances(data);

      console.log('\n📊 Complete pipeline execution:');
      console.log('  Entities created:', results.text.entities.length);
      console.log('  Relationships created:', results.text.relationships.length);
      console.log('  Validation similarity:', results.validation.similarity);
      console.log('  Coverage complete:', results.validation.complete);

      // Verify all phases executed
      expect(results.text).toBeDefined();
      expect(results.text.entities.length).toBeGreaterThan(0);
      expect(results.validation).toBeDefined();
      expect(results.validation.similarity).toBeGreaterThan(0);

      // Verify instances were added to triple store
      const storeSize = await tripleStore.size();
      expect(storeSize).toBeGreaterThan(0);

      console.log('✅ Complete pipeline executed successfully');
    }, 60000);
  });
});
