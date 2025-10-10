import { jest } from '@jest/globals';
import { TextInstanceCreator } from '../../src/kg/TextInstanceCreator.js';
import { ResourceManager } from '@legion/resource-manager';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyRetriever } from '../../src/kg/OntologyRetriever.js';

/**
 * Phase 3: Text Instance Creation Tests
 *
 * Tests that TextInstanceCreator can convert narrative text to RDF instances
 * using a provided ontology.
 */

describe('TextInstanceCreator (Phase 3)', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let ontologyBuilder;
  let ontologyRetriever;
  let textInstanceCreator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Set up ontology infrastructure
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    tripleStore = new TripleStore();
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: { enabled: false }
    });

    ontologyRetriever = new OntologyRetriever({ semanticSearch, tripleStore });

    // Create TextInstanceCreator
    textInstanceCreator = new TextInstanceCreator({
      llmClient,
      tripleStore,
      ontologyRetriever
    });
  }, 60000);

  describe('Unit Tests: Prompt formatting and response parsing', () => {
    test('should format prompt with ontology and text', () => {
      const ontologyText = `CLASSES:
- kg:Organization (Organization)

DATATYPE PROPERTIES:
- kg:hasRevenue (has revenue)
  Domain: kg:Organization
  Range: xsd:decimal`;

      const text = 'Company X has revenue of $1M';

      const prompt = textInstanceCreator.formatPrompt(ontologyText, text);

      expect(prompt).toContain('kg:Organization');
      expect(prompt).toContain('Company X has revenue of $1M');
      expect(prompt).toContain('entities');
      expect(prompt).toContain('relationships');

      console.log('✅ Successfully formatted prompt with ontology and text');
    });

    test('should parse JSON response from LLM', () => {
      const llmResponse = JSON.stringify({
        entities: [
          {
            uri: 'data:CompanyX',
            type: 'kg:Organization',
            label: 'Company X',
            properties: {
              'kg:hasRevenue': '1000000'
            }
          }
        ],
        relationships: []
      });

      const parsed = textInstanceCreator.parseResponse(llmResponse);

      expect(parsed).toHaveProperty('entities');
      expect(parsed).toHaveProperty('relationships');
      expect(parsed.entities.length).toBe(1);
      expect(parsed.entities[0].uri).toBe('data:CompanyX');
      expect(parsed.entities[0].type).toBe('kg:Organization');

      console.log('✅ Successfully parsed JSON response');
    });
  });

  describe('Integration Tests: Create instances from text', () => {
    test('should create instances from simple narrative', async () => {
      const text = 'Acme Corporation has revenue of $500,000 for the year 2023.';

      // Get relevant ontology (simplified - just provide small ontology)
      const ontologyText = `CLASSES:
- kg:Organization (Organization)
  Definition: A business entity

DATATYPE PROPERTIES:
- kg:hasRevenue (has revenue)
  Domain: kg:Organization
  Range: xsd:decimal`;

      const instances = await textInstanceCreator.createInstancesFromText(text, ontologyText);

      console.log('\n📊 Created instances:', JSON.stringify(instances, null, 2));

      expect(instances).toHaveProperty('entities');
      expect(instances.entities.length).toBeGreaterThan(0);

      // Should have at least one organization entity
      const hasOrganization = instances.entities.some(e =>
        e.type && e.type.includes('Organization')
      );
      expect(hasOrganization).toBe(true);

      console.log('✅ Successfully created instances from simple narrative');
    }, 30000);

    test('should verify instances have correct RDF structure', async () => {
      const text = 'TechCo earned $2 million in Q1 2024.';

      const ontologyText = `CLASSES:
- kg:Organization (Organization)

DATATYPE PROPERTIES:
- kg:hasRevenue (has revenue)
  Domain: kg:Organization
  Range: xsd:decimal`;

      const instances = await textInstanceCreator.createInstancesFromText(text, ontologyText);

      console.log('\n📊 Instance structure:', JSON.stringify(instances, null, 2));

      // Verify structure
      expect(instances.entities).toBeDefined();
      expect(Array.isArray(instances.entities)).toBe(true);

      if (instances.entities.length > 0) {
        const entity = instances.entities[0];
        expect(entity).toHaveProperty('uri');
        expect(entity).toHaveProperty('type');
        expect(entity.uri).toBeTruthy();
        expect(entity.type).toBeTruthy();
      }

      console.log('✅ Instances have correct RDF structure');
    }, 30000);

    test('should verify instances are added to triple store', async () => {
      // Clear triple store
      const initialSize = await tripleStore.size();

      const text = 'DataCorp has 100 employees.';

      const ontologyText = `CLASSES:
- kg:Organization (Organization)

DATATYPE PROPERTIES:
- kg:hasEmployeeCount (has employee count)
  Domain: kg:Organization
  Range: xsd:integer`;

      const instances = await textInstanceCreator.createInstancesFromText(text, ontologyText);

      // Add to triple store
      const count = await tripleStore.storeEntityModel(instances);

      console.log(`\n📊 Added ${count} triples to store`);

      const finalSize = await tripleStore.size();
      expect(finalSize).toBeGreaterThan(initialSize);

      // Verify we can query the data
      const orgResults = await tripleStore.query(null, 'rdf:type', null);
      const hasOrg = orgResults.some(triple =>
        triple[2] && triple[2].includes('Organization')
      );
      expect(hasOrg).toBe(true);

      console.log('✅ Instances successfully added to triple store');
    }, 30000);

    test('should create FinancialValue entities from text values (Phase 7)', async () => {
      const text = 'Acme Corporation reported revenue of $1.5 million and a profit margin of 14.2% for Q1 2024.';

      const ontologyText = `CLASSES:
- kg:Organization (Organization)
- kg:FinancialValue (Financial Value)

DATATYPE PROPERTIES:
- kg:hasRevenue (has revenue)
  Domain: kg:Organization
  Range: kg:FinancialValue
- kg:hasMargin (has margin)
  Domain: kg:Organization
  Range: kg:FinancialValue`;

      const instances = await textInstanceCreator.createInstancesFromText(text, ontologyText);

      console.log('\n📊 Phase 7 enhanced instances:', JSON.stringify(instances, null, 2));

      // Should have Organization entity
      const orgEntities = instances.entities.filter(e =>
        e.type && e.type.includes('Organization')
      );
      expect(orgEntities.length).toBeGreaterThan(0);

      // Should have FinancialValue entities (Phase 7)
      const valueEntities = instances.entities.filter(e =>
        e.type === 'kg:FinancialValue'
      );
      expect(valueEntities.length).toBeGreaterThan(0);

      console.log('\n📊 FinancialValue entities created:', valueEntities.length);
      valueEntities.forEach(v => {
        console.log('  -', v.label, ':', v.properties);
      });

      // Verify FinancialValue structure
      if (valueEntities.length > 0) {
        const firstValue = valueEntities[0];
        expect(firstValue.properties['kg:numericValue']).toBeDefined();
        expect(firstValue.properties['kg:actualAmount']).toBeDefined();

        // Check if it's currency or percentage
        const hasCurrency = firstValue.properties['kg:currency'] !== undefined;
        const isPercentage = firstValue.properties['kg:unit'] === 'percentage';
        expect(hasCurrency || isPercentage).toBe(true);
      }

      // Should have relationships linking to FinancialValue entities
      const valueEntityUris = valueEntities.map(v => v.uri);
      const valueRelationships = instances.relationships.filter(r =>
        r.object && valueEntityUris.includes(r.object)
      );
      expect(valueRelationships.length).toBeGreaterThan(0);

      console.log('\n📊 Relationships to FinancialValues:', valueRelationships.length);
      valueRelationships.forEach(r => {
        console.log(`  ${r.subject} --${r.predicate}--> ${r.object}`);
      });

      console.log('✅ FinancialValue entities created from text values (Phase 7)');
    }, 30000);
  });
});
