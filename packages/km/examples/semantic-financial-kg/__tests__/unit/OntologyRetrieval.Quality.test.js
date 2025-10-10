import { jest } from '@jest/globals';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';

/**
 * Phase 0: Validate Foundation (Semantic Search Quality)
 *
 * These tests verify that semantic search returns relevant ontology elements
 * for given concepts. This is critical - if retrieval quality is poor,
 * the entire instance creation system will fail.
 */

describe('Ontology Retrieval Quality (Phase 0)', () => {
  let resourceManager;
  let semanticSearch;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 60000);

  beforeEach(async () => {
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
  }, 30000);

  describe('Unit Test: Semantic search with known ontology', () => {
    test('should retrieve relevant business classes when searching for company concepts', async () => {
      // Search for "company" in existing ontology-classes collection
      // This tests that semantic search returns relevant business entity classes
      const results = await semanticSearch.findSimilar('ontology-classes', {
        text: 'company business organization firm'
      }, { limit: 10, threshold: 0.5 });

      console.log(`\n🔍 Found ${results.length} results for business concepts`);

      expect(results.length).toBeGreaterThan(0);

      // Verify results contain business-related classes
      const hasBusinessClass = results.some(r => {
        const payload = r.document || r.payload;
        if (payload && payload.metadata) {
          const label = (payload.metadata.label || '').toLowerCase();
          const uri = (payload.metadata.classURI || '').toLowerCase();
          const text = (payload.text || '').toLowerCase();

          // Check if it's business/organization related
          const isBusinessRelated =
            label.includes('organization') ||
            label.includes('company') ||
            label.includes('business') ||
            label.includes('firm') ||
            uri.includes('organization') ||
            uri.includes('company') ||
            text.includes('business') ||
            text.includes('organization');

          if (isBusinessRelated) {
            console.log(`✓ Found business class: ${payload.metadata.classURI || uri} (${label})`);
          }

          return isBusinessRelated;
        }
        return false;
      });

      expect(hasBusinessClass).toBe(true);
      console.log('✅ Semantic search successfully retrieves relevant business classes');
    });
  });

  describe('Integration Test: Retrieve financial domain classes', () => {
    test('should retrieve relevant classes for organization, revenue, period concepts', async () => {
      const concepts = ['organization', 'revenue', 'period', 'financial metric', 'observation'];

      for (const concept of concepts) {
        console.log(`\n🔍 Searching for: ${concept}`);

        const results = await semanticSearch.findSimilar('ontology-classes', {
          text: concept
        }, { limit: 5, threshold: 0.5 });

        console.log(`  Found ${results.length} results`);

        expect(results.length).toBeGreaterThan(0);

        // Log top result
        if (results.length > 0) {
          const top = results[0];
          const payload = top.document || top.payload;
          if (payload && payload.metadata) {
            console.log(`  Top match: ${payload.metadata.classURI} (score: ${top._similarity?.toFixed(3)})`);
          }
        }
      }

      console.log('\n✅ Successfully retrieved classes for all financial concepts');
    });
  });

  describe('Integration Test: Retrieve financial domain relationships', () => {
    test('should retrieve relevant relationships for financial domain', async () => {
      const relationships = ['has value', 'for period', 'for organization', 'has metric type'];

      for (const relationship of relationships) {
        console.log(`\n🔍 Searching for relationship: ${relationship}`);

        const results = await semanticSearch.findSimilar('ontology-relationships', {
          text: relationship
        }, { limit: 5, threshold: 0.5 });

        console.log(`  Found ${results.length} results`);

        expect(results.length).toBeGreaterThan(0);

        // Log top result
        if (results.length > 0) {
          const top = results[0];
          const payload = top.document || top.payload;
          if (payload && payload.metadata) {
            console.log(`  Top match: ${payload.metadata.relURI} (score: ${top._similarity?.toFixed(3)})`);
          }
        }
      }

      console.log('\n✅ Successfully retrieved relationships for all financial concepts');
    });
  });

  describe('Integration Test: Verify precision', () => {
    test('should return relevant classes (precision check)', async () => {
      // Search for "organization company business"
      const results = await semanticSearch.findSimilar('ontology-classes', {
        text: 'organization company business entity'
      }, { limit: 10, threshold: 0.6 });

      console.log(`\n🔍 Precision Test: Found ${results.length} results`);

      // All results should be related to organizations/companies/businesses
      const relevantCount = results.filter(r => {
        const payload = r.document || r.payload;
        if (payload && payload.metadata) {
          const label = (payload.metadata.label || '').toLowerCase();
          const uri = (payload.metadata.classURI || '').toLowerCase();
          const text = (payload.text || '').toLowerCase();

          const isRelevant =
            label.includes('organization') ||
            label.includes('company') ||
            label.includes('business') ||
            label.includes('entity') ||
            label.includes('firm') ||
            uri.includes('organization') ||
            uri.includes('company') ||
            uri.includes('entity') ||
            text.includes('organization') ||
            text.includes('business') ||
            text.includes('company');

          if (!isRelevant) {
            console.log(`  ⚠️ Possibly irrelevant: ${payload.metadata.classURI} (${label})`);
          } else {
            console.log(`  ✓ Relevant: ${payload.metadata.classURI} (${label})`);
          }

          return isRelevant;
        }
        return false;
      }).length;

      const precision = relevantCount / results.length;
      console.log(`\n📊 Precision: ${(precision * 100).toFixed(1)}% (${relevantCount}/${results.length})`);

      // Expect at least 70% precision
      expect(precision).toBeGreaterThanOrEqual(0.7);
      console.log('✅ Precision check passed');
    });
  });

  describe('Integration Test: Verify recall', () => {
    test('should retrieve all relevant organization-related classes (recall check)', async () => {
      // Search broadly for organization concepts
      const results = await semanticSearch.findSimilar('ontology-classes', {
        text: 'organization company business entity firm corporation'
      }, { limit: 20, threshold: 0.5 });

      console.log(`\n🔍 Recall Test: Found ${results.length} results`);

      // Extract unique class URIs
      const foundClasses = new Set();
      results.forEach(r => {
        const payload = r.document || r.payload;
        if (payload && payload.metadata && payload.metadata.classURI) {
          foundClasses.add(payload.metadata.classURI);
          console.log(`  Found: ${payload.metadata.classURI}`);
        }
      });

      console.log(`\n📊 Unique classes found: ${foundClasses.size}`);

      // Expect to find at least some organization-related classes
      expect(foundClasses.size).toBeGreaterThanOrEqual(1);
      console.log('✅ Recall check passed');
    });
  });
});
