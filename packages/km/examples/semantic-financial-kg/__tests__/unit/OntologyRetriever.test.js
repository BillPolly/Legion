import { jest } from '@jest/globals';
import { OntologyRetriever } from '../../src/kg/OntologyRetriever.js';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ConceptExtractor } from '../../src/kg/ConceptExtractor.js';

/**
 * Phase 2: Ontology Retrieval Tests
 */

describe('OntologyRetriever (Phase 2)', () => {
  let resourceManager;
  let semanticSearch;
  let tripleStore;
  let ontologyBuilder;
  let ontologyRetriever;
  let conceptExtractor;
  let llmClient;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Set up ontology (use existing financial ontology from previous tests)
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    tripleStore = new TripleStore();
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: { enabled: false }
    });

    // Create retriever
    ontologyRetriever = new OntologyRetriever({ semanticSearch, tripleStore });
    conceptExtractor = new ConceptExtractor({ llmClient });
  }, 60000);

  test('should retrieve relevant ontology for ConvFinQA concepts', async () => {
    const concepts = {
      entities: ['organization', 'period', 'financial metric', 'observation'],
      relationships: ['for organization', 'for period', 'has value'],
      attributes: ['revenue', 'date', 'amount']
    };

    const ontology = await ontologyRetriever.retrieveRelevantOntology(concepts);

    console.log('\n📊 Retrieved ontology:');
    console.log('  Classes:', ontology.classes.length);
    console.log('  Properties:', ontology.properties.length);
    console.log('  Relationships:', ontology.relationships.length);

    expect(ontology.classes.length).toBeGreaterThan(0);
    expect(ontology.relationships.length).toBeGreaterThan(0);

    console.log('✅ Successfully retrieved relevant ontology subset');
  }, 30000);

  test('should format ontology as text for LLM', async () => {
    const ontology = {
      classes: [
        { uri: 'kg:Organization', label: 'Organization', definition: 'A business entity' }
      ],
      properties: [
        { uri: 'kg:hasRevenue', label: 'has revenue', domain: 'kg:Organization', range: 'xsd:decimal' }
      ],
      relationships: [
        { uri: 'kg:employs', label: 'employs', domain: 'kg:Organization', range: 'kg:Person' }
      ]
    };

    const text = ontologyRetriever.formatOntologyAsText(ontology);

    console.log('\n📄 Formatted ontology:');
    console.log(text);

    expect(text).toContain('CLASSES:');
    expect(text).toContain('kg:Organization');
    expect(text).toContain('DATATYPE PROPERTIES:');
    expect(text).toContain('OBJECT PROPERTIES');

    console.log('✅ Successfully formatted ontology as text');
  });
});
