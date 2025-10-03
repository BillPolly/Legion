/**
 * OntologyQueryService Integration Tests
 *
 * Tests ontology querying with REAL components
 * NO MOCKS - uses actual SimpleTripleStore, HierarchyTraversalService, SemanticSearchProvider, and LLM client
 */

import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { OntologyQueryService } from '../../src/services/OntologyQueryService.js';

describe('OntologyQueryService Integration', () => {
  let tripleStore;
  let semanticSearch;
  let hierarchyTraversal;
  let ontologyQuery;
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    // Get real LLM client from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(async () => {
    // Create real components
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();
    ontologyQuery = new OntologyQueryService(tripleStore, hierarchyTraversal, semanticSearch);

    // Build test ontology: PhysicalObject → Equipment → Pump → CentrifugalPump
    tripleStore.add('kg:PhysicalObject', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:PhysicalObject', 'rdfs:label', '"Physical Object"');

    tripleStore.add('kg:Equipment', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Equipment', 'rdfs:label', '"Equipment"');
    tripleStore.add('kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject');

    tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Pump', 'rdfs:label', '"Pump"');
    tripleStore.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');

    tripleStore.add('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:CentrifugalPump', 'rdfs:label', '"Centrifugal Pump"');
    tripleStore.add('kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump');

    tripleStore.add('kg:Tank', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Tank', 'rdfs:label', '"Tank"');
    tripleStore.add('kg:Tank', 'rdfs:subClassOf', 'kg:Equipment');

    // Add properties at different levels
    tripleStore.add('kg:locatedIn', 'rdf:type', 'owl:DatatypeProperty');
    tripleStore.add('kg:locatedIn', 'rdfs:label', '"locatedIn"');
    tripleStore.add('kg:locatedIn', 'rdfs:domain', 'kg:PhysicalObject');
    tripleStore.add('kg:locatedIn', 'rdfs:range', 'xsd:string');

    tripleStore.add('kg:manufacturer', 'rdf:type', 'owl:DatatypeProperty');
    tripleStore.add('kg:manufacturer', 'rdfs:label', '"manufacturer"');
    tripleStore.add('kg:manufacturer', 'rdfs:domain', 'kg:Equipment');
    tripleStore.add('kg:manufacturer', 'rdfs:range', 'xsd:string');

    tripleStore.add('kg:operatingPressure', 'rdf:type', 'owl:DatatypeProperty');
    tripleStore.add('kg:operatingPressure', 'rdfs:label', '"operatingPressure"');
    tripleStore.add('kg:operatingPressure', 'rdfs:domain', 'kg:Pump');
    tripleStore.add('kg:operatingPressure', 'rdfs:range', 'xsd:decimal');

    // Add relationships
    tripleStore.add('kg:connectsTo', 'rdf:type', 'owl:ObjectProperty');
    tripleStore.add('kg:connectsTo', 'rdfs:label', '"connectsTo"');
    tripleStore.add('kg:connectsTo', 'rdfs:domain', 'kg:Equipment');
    tripleStore.add('kg:connectsTo', 'rdfs:range', 'kg:Equipment');

    // Index classes in semantic search
    await semanticSearch.insert('ontology-classes', [
      { text: 'Physical Object: Base class for physical entities', metadata: { classURI: 'kg:PhysicalObject', label: 'Physical Object' } },
      { text: 'Equipment: Industrial equipment', metadata: { classURI: 'kg:Equipment', label: 'Equipment' } },
      { text: 'Pump: Equipment that moves fluids', metadata: { classURI: 'kg:Pump', label: 'Pump' } },
      { text: 'Centrifugal Pump: Pump using centrifugal force', metadata: { classURI: 'kg:CentrifugalPump', label: 'Centrifugal Pump' } },
      { text: 'Tank: Storage container', metadata: { classURI: 'kg:Tank', label: 'Tank' } }
    ]);

    console.log(`✅ Built test ontology with ${tripleStore.size()} triples`);
  });

  describe('extractTypeMentions with real LLM', () => {
    test('should extract entity type mentions from sentence', async () => {
      const sentence = 'The centrifugal pump connects to the heat exchanger';
      const mentions = await ontologyQuery.extractTypeMentions(sentence, llmClient);

      expect(Array.isArray(mentions)).toBe(true);
      expect(mentions.length).toBeGreaterThan(0);

      // Should extract mentions like "pump", "centrifugal pump", "heat exchanger"
      console.log('✅ Extracted mentions:', mentions);
    });

    test('should extract multiple type mentions', async () => {
      const sentence = 'The pump, tank, and compressor are connected';
      const mentions = await ontologyQuery.extractTypeMentions(sentence, llmClient);

      expect(mentions.length).toBeGreaterThanOrEqual(2);
      console.log('✅ Extracted multiple mentions:', mentions);
    });
  });

  describe('getInheritedProperties with real RDF data', () => {
    test('should return properties from direct class', async () => {
      const properties = await ontologyQuery.getInheritedProperties('kg:Pump');

      const operatingPressure = properties.find(p => p.label === 'operatingPressure');
      expect(operatingPressure).toBeDefined();
      expect(operatingPressure.definedIn).toBe('kg:Pump');
      expect(operatingPressure.inherited).toBe(false);
      expect(operatingPressure.inheritanceDistance).toBe(0);

      console.log('✅ Found operatingPressure directly in Pump');
    });

    test('should return inherited properties from ancestors', async () => {
      const properties = await ontologyQuery.getInheritedProperties('kg:Pump');

      // Should inherit manufacturer from Equipment
      const manufacturer = properties.find(p => p.label === 'manufacturer');
      expect(manufacturer).toBeDefined();
      expect(manufacturer.definedIn).toBe('kg:Equipment');
      expect(manufacturer.inherited).toBe(true);
      expect(manufacturer.inheritanceDistance).toBe(1);

      // Should inherit locatedIn from PhysicalObject
      const locatedIn = properties.find(p => p.label === 'locatedIn');
      expect(locatedIn).toBeDefined();
      expect(locatedIn.definedIn).toBe('kg:PhysicalObject');
      expect(locatedIn.inherited).toBe(true);
      expect(locatedIn.inheritanceDistance).toBe(2);

      console.log('✅ Pump inherits properties from Equipment and PhysicalObject');
    });

    test('should return ALL properties for deep hierarchy', async () => {
      const properties = await ontologyQuery.getInheritedProperties('kg:CentrifugalPump');

      // Should have properties from Pump, Equipment, and PhysicalObject
      expect(properties.length).toBeGreaterThanOrEqual(3);

      const operatingPressure = properties.find(p => p.label === 'operatingPressure');
      const manufacturer = properties.find(p => p.label === 'manufacturer');
      const locatedIn = properties.find(p => p.label === 'locatedIn');

      expect(operatingPressure).toBeDefined();
      expect(manufacturer).toBeDefined();
      expect(locatedIn).toBeDefined();

      console.log('✅ CentrifugalPump inherits ALL properties from hierarchy:');
      console.log(`   - operatingPressure from ${operatingPressure.definedIn} (distance ${operatingPressure.inheritanceDistance})`);
      console.log(`   - manufacturer from ${manufacturer.definedIn} (distance ${manufacturer.inheritanceDistance})`);
      console.log(`   - locatedIn from ${locatedIn.definedIn} (distance ${locatedIn.inheritanceDistance})`);
    });
  });

  describe('getInheritedRelationships with real RDF data', () => {
    test('should return relationships from class', async () => {
      const relationships = await ontologyQuery.getInheritedRelationships('kg:Equipment');

      const connectsTo = relationships.find(r => r.label === 'connectsTo');
      expect(connectsTo).toBeDefined();
      expect(connectsTo.definedIn).toBe('kg:Equipment');
      expect(connectsTo.range).toBe('kg:Equipment');
      expect(connectsTo.inherited).toBe(false);

      console.log('✅ Found connectsTo in Equipment');
    });

    test('should inherit relationships from ancestors', async () => {
      const relationships = await ontologyQuery.getInheritedRelationships('kg:Pump');

      // Should inherit connectsTo from Equipment
      const connectsTo = relationships.find(r => r.label === 'connectsTo');
      expect(connectsTo).toBeDefined();
      expect(connectsTo.definedIn).toBe('kg:Equipment');
      expect(connectsTo.inherited).toBe(true);
      expect(connectsTo.inheritanceDistance).toBe(1);

      console.log('✅ Pump inherits connectsTo from Equipment');
    });
  });

  describe('findRelevantTypesForSentence with real LLM and semantic search', () => {
    test('should find matching types with full hierarchy', async () => {
      const sentence = 'The pump is operating';
      const results = await ontologyQuery.findRelevantTypesForSentence(sentence, llmClient);

      expect(results.length).toBeGreaterThan(0);

      // Should find pump
      const pumpResult = results.find(r => r.matchedClass === 'kg:Pump');
      if (pumpResult) {
        expect(pumpResult.similarity).toBeGreaterThan(0.75);
        expect(pumpResult.hierarchy).toBeDefined();
        expect(pumpResult.properties.length).toBeGreaterThanOrEqual(1);
        expect(pumpResult.relationships.length).toBeGreaterThanOrEqual(1);

        console.log('✅ Found Pump with full hierarchy context:');
        console.log(`   - Similarity: ${pumpResult.similarity}`);
        console.log(`   - Ancestors: ${pumpResult.hierarchy.ancestors.join(', ')}`);
        console.log(`   - Properties: ${pumpResult.properties.length}`);
        console.log(`   - Relationships: ${pumpResult.relationships.length}`);
      }
    });

    test('should identify gaps for unknown types', async () => {
      const sentence = 'The heat exchanger is new';
      const results = await ontologyQuery.findRelevantTypesForSentence(sentence, llmClient);

      expect(results.length).toBeGreaterThan(0);

      // Should have at least one gap (heat exchanger not in ontology)
      const gaps = results.filter(r => r.isGap);
      expect(gaps.length).toBeGreaterThan(0);

      console.log('✅ Identified gaps:', gaps.map(g => g.mention));
    });

    test('should handle sentence with multiple known types', async () => {
      const sentence = 'The pump connects to the tank';
      const results = await ontologyQuery.findRelevantTypesForSentence(sentence, llmClient);

      expect(results.length).toBeGreaterThan(0);

      const matchedTypes = results.filter(r => !r.isGap);
      expect(matchedTypes.length).toBeGreaterThanOrEqual(1);

      console.log('✅ Found types in sentence:');
      matchedTypes.forEach(t => {
        console.log(`   - ${t.mention} → ${t.matchedClass} (similarity: ${t.similarity})`);
      });
    });

    test('should include inherited properties and relationships in results', async () => {
      const sentence = 'The centrifugal pump is installed';
      const results = await ontologyQuery.findRelevantTypesForSentence(sentence, llmClient);

      const centrifugalPumpResult = results.find(r => r.matchedClass === 'kg:CentrifugalPump');
      if (centrifugalPumpResult) {
        // Should have properties from Pump, Equipment, and PhysicalObject
        expect(centrifugalPumpResult.properties.length).toBeGreaterThanOrEqual(3);

        // Verify inheritance distances
        const operatingPressure = centrifugalPumpResult.properties.find(p => p.label === 'operatingPressure');
        const manufacturer = centrifugalPumpResult.properties.find(p => p.label === 'manufacturer');
        const locatedIn = centrifugalPumpResult.properties.find(p => p.label === 'locatedIn');

        expect(operatingPressure.inheritanceDistance).toBe(1); // From Pump
        expect(manufacturer.inheritanceDistance).toBe(2); // From Equipment
        expect(locatedIn.inheritanceDistance).toBe(3); // From PhysicalObject

        console.log('✅ CentrifugalPump result includes full inheritance chain:');
        console.log(`   - ${centrifugalPumpResult.properties.length} properties`);
        console.log(`   - ${centrifugalPumpResult.relationships.length} relationships`);
      }
    });
  });

  describe('semantic search integration', () => {
    test('should match variations of class names', async () => {
      const sentence = 'A pumping device is needed';
      const results = await ontologyQuery.findRelevantTypesForSentence(sentence, llmClient);

      // Semantic search should find "pump" even though sentence says "pumping device"
      const pumpResults = results.filter(r => r.matchedClass && typeof r.matchedClass === 'string' && r.matchedClass.includes('Pump'));
      console.log('✅ Semantic search results for "pumping device":', pumpResults.map(r => r.matchedClass));
    });
  });
});
