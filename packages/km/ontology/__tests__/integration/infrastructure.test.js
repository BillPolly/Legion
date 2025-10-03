/**
 * Infrastructure Verification Tests
 *
 * Verifies all external dependencies are available and working:
 * - ResourceManager provides LLM client
 * - SimpleTripleStore can add/query RDF triples
 * - SemanticSearchProvider can insert/search
 *
 * NO MOCKS - these are real integration tests
 */

import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';

describe('Infrastructure Verification', () => {
  let resourceManager;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager initialized');
  }, 30000);

  describe('ResourceManager - LLM Client', () => {
    test('should provide LLM client with required methods', async () => {
      const llmClient = await resourceManager.get('llmClient');

      expect(llmClient).toBeDefined();
      expect(llmClient).not.toBeNull();
      expect(typeof llmClient.request).toBe('function');
      expect(typeof llmClient.complete).toBe('function');

      console.log('✅ LLM client available from ResourceManager');
      console.log('   - has request() method');
      console.log('   - has complete() method');
    });
  });

  describe('SimpleTripleStore - RDF Operations', () => {
    test('should add and query RDF triples', () => {
      const store = new SimpleTripleStore();

      // Add some RDF triples
      store.add('kg:Pump', 'rdf:type', 'owl:Class');
      store.add('kg:Pump', 'rdfs:label', '"Pump"');
      store.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');

      // Query for all triples about kg:Pump
      const results = store.query('kg:Pump', null, null);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
      expect(results).toContainEqual(['kg:Pump', 'rdf:type', 'owl:Class']);
      expect(results).toContainEqual(['kg:Pump', 'rdfs:label', '"Pump"']);
      expect(results).toContainEqual(['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']);

      console.log('✅ SimpleTripleStore adds and queries triples correctly');
    });

    test('should query with wildcards', () => {
      const store = new SimpleTripleStore();

      store.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');
      store.add('kg:Tank', 'rdfs:subClassOf', 'kg:Equipment');
      store.add('kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject');

      // Query for all subclass relationships
      const subclassTriples = store.query(null, 'rdfs:subClassOf', null);

      expect(subclassTriples.length).toBe(3);

      // Query for all children of Equipment
      const equipmentChildren = store.query(null, 'rdfs:subClassOf', 'kg:Equipment');

      expect(equipmentChildren.length).toBe(2);
      expect(equipmentChildren).toContainEqual(['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']);
      expect(equipmentChildren).toContainEqual(['kg:Tank', 'rdfs:subClassOf', 'kg:Equipment']);

      console.log('✅ SimpleTripleStore wildcard queries work correctly');
    });

    test('should express rdfs:subClassOf relationships', () => {
      const store = new SimpleTripleStore();

      // Build a hierarchy: PhysicalObject -> Equipment -> Pump -> CentrifugalPump
      store.add('kg:PhysicalObject', 'rdf:type', 'owl:Class');
      store.add('kg:Equipment', 'rdf:type', 'owl:Class');
      store.add('kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject');
      store.add('kg:Pump', 'rdf:type', 'owl:Class');
      store.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');
      store.add('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
      store.add('kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump');

      // Verify hierarchy by querying
      const pumpParents = store.query('kg:Pump', 'rdfs:subClassOf', null);
      expect(pumpParents).toContainEqual(['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']);

      const centrifugalPumpParents = store.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
      expect(centrifugalPumpParents).toContainEqual(['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']);

      console.log('✅ SimpleTripleStore expresses rdfs:subClassOf relationships correctly');
    });

    test('should express rdfs:subPropertyOf for relationship specialization', () => {
      const store = new SimpleTripleStore();

      // Base relationship
      store.add('kg:connectsTo', 'rdf:type', 'owl:ObjectProperty');
      store.add('kg:connectsTo', 'rdfs:domain', 'kg:Equipment');
      store.add('kg:connectsTo', 'rdfs:range', 'kg:Equipment');

      // Specialized relationship
      store.add('kg:pumpConnectsToTank', 'rdf:type', 'owl:ObjectProperty');
      store.add('kg:pumpConnectsToTank', 'rdfs:subPropertyOf', 'kg:connectsTo');
      store.add('kg:pumpConnectsToTank', 'rdfs:domain', 'kg:Pump');
      store.add('kg:pumpConnectsToTank', 'rdfs:range', 'kg:Tank');

      // Verify specialization
      const specialization = store.query('kg:pumpConnectsToTank', 'rdfs:subPropertyOf', null);
      expect(specialization).toContainEqual(['kg:pumpConnectsToTank', 'rdfs:subPropertyOf', 'kg:connectsTo']);

      console.log('✅ SimpleTripleStore expresses rdfs:subPropertyOf relationships correctly');
    });
  });

  describe('SemanticSearchProvider - Vector Search', () => {
    let semanticSearch;
    const testCollection = 'test-ontology-infrastructure';

    beforeAll(async () => {
      // Create semantic search provider
      semanticSearch = await SemanticSearchProvider.create(resourceManager);
      await semanticSearch.connect();

      console.log('✅ SemanticSearchProvider created and connected');
    }, 30000);

    test('should insert and search documents', async () => {
      // Insert test documents
      await semanticSearch.insert(testCollection, [
        { text: 'Pump: Equipment that moves fluids', metadata: { classURI: 'kg:Pump', label: 'Pump' } },
        { text: 'Tank: Storage vessel for liquids', metadata: { classURI: 'kg:Tank', label: 'Tank' } },
        { text: 'Compressor: Equipment that compresses gases', metadata: { classURI: 'kg:Compressor', label: 'Compressor' } }
      ]);

      // Search for similar concept
      const results = await semanticSearch.semanticSearch(testCollection, 'fluid pump', { limit: 3 });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Verify search works - results should have similarity scores
      const topResult = results[0];
      expect(topResult._similarity).toBeDefined();
      expect(topResult._similarity).toBeGreaterThan(0);

      console.log('✅ SemanticSearchProvider inserts and searches correctly');
      console.log(`   Found result with similarity ${topResult._similarity?.toFixed(3)}`);
      console.log(`   Result structure:`, Object.keys(topResult));
    });

    test('should find similar types with reasonable similarity scores', async () => {
      // Search with exact match
      const results = await semanticSearch.semanticSearch(testCollection, 'compressor machine', { limit: 1 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._similarity).toBeGreaterThan(0.5); // Reasonable threshold

      console.log('✅ SemanticSearchProvider finds similar concepts');
      console.log(`   Similarity score: ${results[0]._similarity?.toFixed(3)}`);
    });
  });
});
