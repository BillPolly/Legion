/**
 * Unit tests for upper-level ontology bootstrap
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { getBootstrapTriples, isPhysicalEntity, isState, isProcess, isTask, inferCategory } from '../../src/bootstrap/upper-level-ontology.js';

describe('Upper-Level Ontology Bootstrap', () => {
  describe('getBootstrapTriples', () => {
    test('should return bootstrap triples', () => {
      const triples = getBootstrapTriples();

      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);

      // Each triple should be [subject, predicate, object]
      for (const triple of triples) {
        expect(Array.isArray(triple)).toBe(true);
        expect(triple.length).toBe(3);
        expect(typeof triple[0]).toBe('string');
        expect(typeof triple[1]).toBe('string');
        expect(typeof triple[2]).toBe('string');
      }
    });

    test('should define Continuant category', () => {
      const triples = getBootstrapTriples();

      const continuantClass = triples.find(t =>
        t[0] === 'kg:Continuant' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(continuantClass).toBeDefined();

      const continuantSubclass = triples.find(t =>
        t[0] === 'kg:Continuant' && t[1] === 'rdfs:subClassOf' && t[2] === 'owl:Thing'
      );

      expect(continuantSubclass).toBeDefined();
    });

    test('should define Occurrent category', () => {
      const triples = getBootstrapTriples();

      const occurrentClass = triples.find(t =>
        t[0] === 'kg:Occurrent' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(occurrentClass).toBeDefined();

      const occurrentSubclass = triples.find(t =>
        t[0] === 'kg:Occurrent' && t[1] === 'rdfs:subClassOf' && t[2] === 'owl:Thing'
      );

      expect(occurrentSubclass).toBeDefined();
    });

    test('should define PhysicalEntity as subclass of Continuant', () => {
      const triples = getBootstrapTriples();

      const physicalEntityClass = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(physicalEntityClass).toBeDefined();

      const physicalEntitySubclass = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'rdfs:subClassOf' && t[2] === 'kg:Continuant'
      );

      expect(physicalEntitySubclass).toBeDefined();
    });

    test('should define State as subclass of Continuant', () => {
      const triples = getBootstrapTriples();

      const stateClass = triples.find(t =>
        t[0] === 'kg:State' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(stateClass).toBeDefined();

      const stateSubclass = triples.find(t =>
        t[0] === 'kg:State' && t[1] === 'rdfs:subClassOf' && t[2] === 'kg:Continuant'
      );

      expect(stateSubclass).toBeDefined();
    });

    test('should define Process as subclass of Occurrent', () => {
      const triples = getBootstrapTriples();

      const processClass = triples.find(t =>
        t[0] === 'kg:Process' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(processClass).toBeDefined();

      const processSubclass = triples.find(t =>
        t[0] === 'kg:Process' && t[1] === 'rdfs:subClassOf' && t[2] === 'kg:Occurrent'
      );

      expect(processSubclass).toBeDefined();
    });

    test('should define Task as subclass of Occurrent', () => {
      const triples = getBootstrapTriples();

      const taskClass = triples.find(t =>
        t[0] === 'kg:Task' && t[1] === 'rdf:type' && t[2] === 'owl:Class'
      );

      expect(taskClass).toBeDefined();

      const taskSubclass = triples.find(t =>
        t[0] === 'kg:Task' && t[1] === 'rdfs:subClassOf' && t[2] === 'kg:Occurrent'
      );

      expect(taskSubclass).toBeDefined();
    });

    test('should define disjointness axioms', () => {
      const triples = getBootstrapTriples();

      // Continuant and Occurrent are disjoint
      const continuantOccurrentDisjoint = triples.find(t =>
        t[0] === 'kg:Continuant' && t[1] === 'owl:disjointWith' && t[2] === 'kg:Occurrent'
      );
      expect(continuantOccurrentDisjoint).toBeDefined();

      // PhysicalEntity and State are disjoint
      const physicalEntityStateDisjoint = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'owl:disjointWith' && t[2] === 'kg:State'
      );
      expect(physicalEntityStateDisjoint).toBeDefined();

      // Process and Task are disjoint
      const processTaskDisjoint = triples.find(t =>
        t[0] === 'kg:Process' && t[1] === 'owl:disjointWith' && t[2] === 'kg:Task'
      );
      expect(processTaskDisjoint).toBeDefined();
    });

    test('should define process-state relationships', () => {
      const triples = getBootstrapTriples();

      // requiresPrecondition
      const requiresPrecondition = triples.find(t =>
        t[0] === 'kg:requiresPrecondition' && t[1] === 'rdf:type' && t[2] === 'owl:ObjectProperty'
      );
      expect(requiresPrecondition).toBeDefined();

      const requiresPreconditionDomain = triples.find(t =>
        t[0] === 'kg:requiresPrecondition' && t[1] === 'rdfs:domain' && t[2] === 'kg:Process'
      );
      expect(requiresPreconditionDomain).toBeDefined();

      const requiresPreconditionRange = triples.find(t =>
        t[0] === 'kg:requiresPrecondition' && t[1] === 'rdfs:range' && t[2] === 'kg:State'
      );
      expect(requiresPreconditionRange).toBeDefined();

      // producesPostcondition
      const producesPostcondition = triples.find(t =>
        t[0] === 'kg:producesPostcondition' && t[1] === 'rdf:type' && t[2] === 'owl:ObjectProperty'
      );
      expect(producesPostcondition).toBeDefined();
    });

    test('should include multi-perspective descriptions (SKOS)', () => {
      const triples = getBootstrapTriples();

      // Check PhysicalEntity has all 4 perspectives
      const physicalEntityDef = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'skos:definition'
      );
      expect(physicalEntityDef).toBeDefined();

      const physicalEntityComment = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'rdfs:comment'
      );
      expect(physicalEntityComment).toBeDefined();

      const physicalEntityScope = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'skos:scopeNote'
      );
      expect(physicalEntityScope).toBeDefined();

      const physicalEntityAlt = triples.find(t =>
        t[0] === 'kg:PhysicalEntity' && t[1] === 'skos:altLabel'
      );
      expect(physicalEntityAlt).toBeDefined();
    });
  });

  describe('Category Inference Helpers', () => {
    // Mock getAncestors function
    const mockGetAncestors = (ontologyType) => {
      const hierarchies = {
        'kg:CentrifugalPump': ['kg:Pump', 'kg:PhysicalEntity', 'kg:Continuant', 'owl:Thing'],
        'kg:Pump': ['kg:PhysicalEntity', 'kg:Continuant', 'owl:Thing'],
        'kg:PhysicalEntity': ['kg:Continuant', 'owl:Thing'],
        'kg:Continuant': ['owl:Thing'],
        'kg:Temperature': ['kg:State', 'kg:Continuant', 'owl:Thing'],
        'kg:State': ['kg:Continuant', 'owl:Thing'],
        'kg:Heating': ['kg:Process', 'kg:Occurrent', 'owl:Thing'],
        'kg:Process': ['kg:Occurrent', 'owl:Thing'],
        'kg:Occurrent': ['owl:Thing'],
        'kg:Maintenance': ['kg:Task', 'kg:Occurrent', 'owl:Thing'],
        'kg:Task': ['kg:Occurrent', 'owl:Thing']
      };

      return hierarchies[ontologyType] || [];
    };

    test('isPhysicalEntity should identify PhysicalEntity descendants', async () => {
      expect(await isPhysicalEntity('kg:CentrifugalPump', mockGetAncestors)).toBe(true);
      expect(await isPhysicalEntity('kg:Pump', mockGetAncestors)).toBe(true);
      expect(await isPhysicalEntity('kg:PhysicalEntity', mockGetAncestors)).toBe(true);

      expect(await isPhysicalEntity('kg:Temperature', mockGetAncestors)).toBe(false);
      expect(await isPhysicalEntity('kg:Heating', mockGetAncestors)).toBe(false);
    });

    test('isState should identify State descendants', async () => {
      expect(await isState('kg:Temperature', mockGetAncestors)).toBe(true);
      expect(await isState('kg:State', mockGetAncestors)).toBe(true);

      expect(await isState('kg:CentrifugalPump', mockGetAncestors)).toBe(false);
      expect(await isState('kg:Heating', mockGetAncestors)).toBe(false);
    });

    test('isProcess should identify Process descendants', async () => {
      expect(await isProcess('kg:Heating', mockGetAncestors)).toBe(true);
      expect(await isProcess('kg:Process', mockGetAncestors)).toBe(true);

      expect(await isProcess('kg:CentrifugalPump', mockGetAncestors)).toBe(false);
      expect(await isProcess('kg:Temperature', mockGetAncestors)).toBe(false);
    });

    test('isTask should identify Task descendants', async () => {
      expect(await isTask('kg:Maintenance', mockGetAncestors)).toBe(true);
      expect(await isTask('kg:Task', mockGetAncestors)).toBe(true);

      expect(await isTask('kg:CentrifugalPump', mockGetAncestors)).toBe(false);
      expect(await isTask('kg:Heating', mockGetAncestors)).toBe(false);
    });

    test('inferCategory should categorize entities correctly', async () => {
      expect(await inferCategory('kg:CentrifugalPump', mockGetAncestors)).toBe('PhysicalEntity');
      expect(await inferCategory('kg:Pump', mockGetAncestors)).toBe('PhysicalEntity');
      expect(await inferCategory('kg:Temperature', mockGetAncestors)).toBe('State');
      expect(await inferCategory('kg:Heating', mockGetAncestors)).toBe('Process');
      expect(await inferCategory('kg:Maintenance', mockGetAncestors)).toBe('Task');

      // Unknown type (not in hierarchy)
      expect(await inferCategory('kg:Unknown', mockGetAncestors)).toBe(null);
    });
  });
});
