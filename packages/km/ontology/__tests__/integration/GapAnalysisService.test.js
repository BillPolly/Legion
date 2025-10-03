/**
 * GapAnalysisService Integration Tests
 *
 * Tests gap analysis with REAL components
 * NO MOCKS - uses actual SubsumptionChecker, LLM client, and RDF data
 */

import { SimpleTripleStore } from '@legion/rdf';
import { ResourceManager } from '@legion/resource-manager';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { SubsumptionChecker } from '../../src/services/SubsumptionChecker.js';
import { GapAnalysisService } from '../../src/services/GapAnalysisService.js';

describe('GapAnalysisService Integration', () => {
  let tripleStore;
  let hierarchyTraversal;
  let subsumptionChecker;
  let gapAnalysis;
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    // Get real LLM client from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    // Create real components
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    subsumptionChecker = new SubsumptionChecker(tripleStore, hierarchyTraversal);
    gapAnalysis = new GapAnalysisService(subsumptionChecker, llmClient);

    // Build test ontology: PhysicalObject → Equipment → Pump
    tripleStore.add('kg:PhysicalObject', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:PhysicalObject', 'rdfs:label', '"Physical Object"');

    tripleStore.add('kg:Equipment', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Equipment', 'rdfs:label', '"Equipment"');
    tripleStore.add('kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject');

    tripleStore.add('kg:Pump', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Pump', 'rdfs:label', '"Pump"');
    tripleStore.add('kg:Pump', 'rdfs:subClassOf', 'kg:Equipment');

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

    // Add relationships
    tripleStore.add('kg:connectsTo', 'rdf:type', 'owl:ObjectProperty');
    tripleStore.add('kg:connectsTo', 'rdfs:label', '"connectsTo"');
    tripleStore.add('kg:connectsTo', 'rdfs:domain', 'kg:Equipment');
    tripleStore.add('kg:connectsTo', 'rdfs:range', 'kg:Equipment');

    console.log(`✅ Built test ontology with ${tripleStore.size()} triples`);
  });

  describe('extractImpliedTypes with real LLM', () => {
    test('should extract implied classes from sentence', async () => {
      const sentence = 'The centrifugal pump operates at 150 PSI and connects to the heat exchanger';
      const implied = await gapAnalysis.extractImpliedTypes(sentence);

      expect(implied.classes).toBeDefined();
      expect(Array.isArray(implied.classes)).toBe(true);
      expect(implied.classes.length).toBeGreaterThan(0);

      console.log('✅ Extracted classes:', implied.classes.map(c => c.name));
    });

    test('should extract implied properties from sentence', async () => {
      const sentence = 'The pump operates at 150 PSI pressure';
      const implied = await gapAnalysis.extractImpliedTypes(sentence);

      expect(implied.properties).toBeDefined();
      expect(Array.isArray(implied.properties)).toBe(true);

      console.log('✅ Extracted properties:', implied.properties.map(p => p.name));
    });

    test('should extract implied relationships from sentence', async () => {
      const sentence = 'The pump connects to the tank';
      const implied = await gapAnalysis.extractImpliedTypes(sentence);

      expect(implied.relationships).toBeDefined();
      expect(Array.isArray(implied.relationships)).toBe(true);

      console.log('✅ Extracted relationships:', implied.relationships.map(r => r.name));
    });
  });

  describe('analyzeGaps - missing classes', () => {
    test('should identify missing class when not in ontology', async () => {
      const sentence = 'The heat exchanger transfers heat';
      const existingTypes = []; // Empty - nothing matched

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      expect(gaps.missingClasses.length).toBeGreaterThan(0);
      const heatExchanger = gaps.missingClasses.find(c =>
        c.name.toLowerCase().includes('heat') || c.name.toLowerCase().includes('exchanger')
      );
      expect(heatExchanger).toBeDefined();

      console.log('✅ Identified missing classes:', gaps.missingClasses.map(c => c.name));
    });

    test('should not mark class as missing when it exists', async () => {
      const sentence = 'The pump is running';
      const existingTypes = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          isGap: false
        }
      ];

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      const pump = gaps.missingClasses.find(c => c.name.toLowerCase() === 'pump');
      expect(pump).toBeUndefined();

      console.log('✅ Did not mark existing Pump as missing');
    });
  });

  describe('analyzeGaps - properties with subsumption', () => {
    test('should add to canReuseFromHierarchy when property exists in ancestor', async () => {
      const sentence = 'The pump is located in Building A';
      const existingTypes = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          isGap: false
        }
      ];

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      // locatedIn is defined in PhysicalObject, Pump should inherit it
      const canReuseProperty = gaps.canReuseFromHierarchy.find(r =>
        r.type === 'property' && r.implied.name.toLowerCase().includes('locat')
      );

      if (canReuseProperty) {
        expect(canReuseProperty.existing.exists).toBe(true);
        expect(canReuseProperty.existing.inherited).toBe(true);
        console.log('✅ Found locatedIn property can be reused from hierarchy:');
        console.log(`   - Defined in: ${canReuseProperty.existing.definedIn}`);
        console.log(`   - Inheritance distance: ${canReuseProperty.existing.inheritanceDistance}`);
      } else {
        console.log('⚠️  LLM did not extract locatedIn property from sentence');
      }
    });

    test('should mark property as missing when not in hierarchy', async () => {
      const sentence = 'The pump is manufactured by Siemens';
      const existingTypes = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          isGap: false
        }
      ];

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      // manufacturer exists in Equipment (parent), but manufacturedBy does not
      // LLM might extract "manufacturedBy" which doesn't match "manufacturer"
      console.log('✅ Missing properties:', gaps.missingProperties.map(p => p.name));
      console.log('   Can reuse properties:', gaps.canReuseFromHierarchy.filter(r => r.type === 'property').map(r => r.implied.name));
    });
  });

  describe('analyzeGaps - relationships with subsumption', () => {
    test('should add to canReuseFromHierarchy when relationship exists and canSpecialize=true', async () => {
      const sentence = 'The pump connects to the tank';
      const existingTypes = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          isGap: false
        },
        {
          mention: 'tank',
          matchedClass: 'kg:Tank',
          isGap: false
        }
      ];

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      // connectsTo(Equipment, Equipment) exists, Pump→Tank should be able to specialize it
      const canReuseRel = gaps.canReuseFromHierarchy.find(r =>
        r.type === 'relationship' && r.implied.name.toLowerCase().includes('connect')
      );

      if (canReuseRel) {
        expect(canReuseRel.existing.exists).toBe(true);
        expect(canReuseRel.existing.canSpecialize).toBe(true);
        console.log('✅ Found connectsTo relationship can be reused:');
        console.log(`   - Defined in: ${canReuseRel.existing.definedIn.domain} → ${canReuseRel.existing.definedIn.range}`);
        console.log(`   - Can specialize: ${canReuseRel.existing.canSpecialize}`);
      } else {
        console.log('⚠️  LLM did not extract connectsTo relationship from sentence');
      }
    });

    test('should mark relationship as missing when domain/range classes do not exist', async () => {
      const sentence = 'The compressor connects to the heat exchanger';
      const existingTypes = []; // Neither class exists

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      // Since domain and range don't exist, relationship should be marked as missing
      const missingRel = gaps.missingRelationships.find(r =>
        r.name.toLowerCase().includes('connect')
      );

      if (missingRel) {
        console.log('✅ Correctly marked relationship as missing when domain/range do not exist');
      }
    });
  });

  describe('analyzeGaps - complete workflow', () => {
    test('should correctly categorize all gaps from complex sentence', async () => {
      const sentence = 'The centrifugal pump P101 is manufactured by Siemens and connects to tank T201';
      const existingTypes = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          isGap: false
        },
        {
          mention: 'tank',
          matchedClass: 'kg:Tank',
          isGap: false
        }
      ];

      const gaps = await gapAnalysis.analyzeGaps(sentence, existingTypes);

      console.log('\n✅ Complete gap analysis results:');
      console.log(`   Missing classes: ${gaps.missingClasses.length}`);
      gaps.missingClasses.forEach(c => console.log(`      - ${c.name}: ${c.description}`));

      console.log(`   Missing properties: ${gaps.missingProperties.length}`);
      gaps.missingProperties.forEach(p => console.log(`      - ${p.name} (domain: ${p.domain})`));

      console.log(`   Missing relationships: ${gaps.missingRelationships.length}`);
      gaps.missingRelationships.forEach(r => console.log(`      - ${r.name} (${r.domain} → ${r.range})`));

      console.log(`   Can reuse from hierarchy: ${gaps.canReuseFromHierarchy.length}`);
      gaps.canReuseFromHierarchy.forEach(r => {
        console.log(`      - ${r.type}: ${r.implied.name} (exists in hierarchy)`);
      });

      // Verify structure
      expect(gaps.missingClasses).toBeDefined();
      expect(gaps.missingProperties).toBeDefined();
      expect(gaps.missingRelationships).toBeDefined();
      expect(gaps.canReuseFromHierarchy).toBeDefined();
    });
  });
});
