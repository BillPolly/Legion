import { OntologyVerifier } from '../../src/ontology/OntologyVerifier.js';

describe('OntologyVerifier', () => {
  let verifier;

  beforeEach(async () => {
    verifier = new OntologyVerifier();
    await verifier.initialize();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const v = new OntologyVerifier();
      await v.initialize();
      expect(v.initialized).toBe(true);
      expect(v.solver).toBeDefined();
      expect(v.encoder).toBeDefined();
    });

    test('should not reinitialize if already initialized', async () => {
      const v = new OntologyVerifier();
      await v.initialize();
      const solver1 = v.solver;
      await v.initialize();
      const solver2 = v.solver;
      expect(solver1).toBe(solver2);
    });
  });

  describe('verifyConsistency', () => {
    test('should verify consistent ontology', async () => {
      const triples = [
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:Occurrent', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect inconsistent ontology', async () => {
      const triples = [
        ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent'],
        ['kg:Pump', 'rdf:type', 'kg:Continuant'],
        ['kg:Pump', 'rdf:type', 'kg:Occurrent']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should handle empty ontology', async () => {
      const result = await verifier.verifyConsistency([]);

      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should verify bootstrap ontology consistency', async () => {
      const bootstrapTriples = [
        // Top-level categories
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:Occurrent', 'rdf:type', 'owl:Class'],
        ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent'],

        // Subcategories
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:State', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent'],
        ['kg:Task', 'rdfs:subClassOf', 'kg:Occurrent'],

        // Disjointness within categories
        ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],
        ['kg:Process', 'owl:disjointWith', 'kg:Task']
      ];

      const result = await verifier.verifyConsistency(bootstrapTriples);

      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('checkAddition', () => {
    test('should accept valid additions', async () => {
      const existing = [
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant']
      ];

      const newTriples = [
        ['kg:Pump', 'rdf:type', 'kg:PhysicalEntity']
      ];

      const result = await verifier.checkAddition(existing, newTriples);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject contradictory additions', async () => {
      const existing = [
        ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
        ['kg:State', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],
        ['kg:Pump', 'rdf:type', 'kg:PhysicalEntity']
      ];

      const newTriples = [
        ['kg:Pump', 'rdf:type', 'kg:State']
      ];

      const result = await verifier.checkAddition(existing, newTriples);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('verifyDomainRange', () => {
    test('should verify valid domain/range', async () => {
      const instances = [
        ['kg:HeatingProcess', 'rdf:type', 'kg:Process'],
        ['kg:Water', 'rdf:type', 'kg:PhysicalEntity'],
        ['kg:HeatingProcess', 'kg:transforms', 'kg:Water']
      ];

      const result = await verifier.verifyDomainRange(
        'kg:transforms',
        'kg:Process',
        'kg:PhysicalEntity',
        instances
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should handle empty instances', async () => {
      const result = await verifier.verifyDomainRange(
        'kg:transforms',
        'kg:Process',
        'kg:PhysicalEntity',
        []
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('verifyDisjoint', () => {
    test('should verify disjoint classes with no violations', async () => {
      const instances = [
        ['kg:Pump', 'rdf:type', 'kg:PhysicalEntity'],
        ['kg:ReadyState', 'rdf:type', 'kg:State']
      ];

      const result = await verifier.verifyDisjoint(
        'kg:PhysicalEntity',
        'kg:State',
        instances
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect disjointness violation', async () => {
      const instances = [
        ['kg:Pump', 'rdf:type', 'kg:PhysicalEntity'],
        ['kg:Pump', 'rdf:type', 'kg:State']
      ];

      const result = await verifier.verifyDisjoint(
        'kg:PhysicalEntity',
        'kg:State',
        instances
      );

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('disjointness');
    });
  });

  describe('getProof', () => {
    test('should provide proof for consistent ontology', async () => {
      const triples = [
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant']
      ];

      const result = await verifier.getProof(triples);

      expect(result.consistent).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof).toContain('SAT');
      expect(result.violations).toHaveLength(0);
    });

    test('should provide proof for inconsistent ontology', async () => {
      const triples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:X', 'rdf:type', 'kg:A'],
        ['kg:X', 'rdf:type', 'kg:B']
      ];

      const result = await verifier.getProof(triples);

      expect(result.consistent).toBe(false);
      expect(result.proof).toBeDefined();
      expect(result.proof).toContain('UNSAT');
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    test('should verify transitive subsumption', async () => {
      const triples = [
        ['kg:A', 'rdfs:subClassOf', 'kg:B'],
        ['kg:B', 'rdfs:subClassOf', 'kg:C'],
        ['kg:X', 'rdf:type', 'kg:A']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
    });

    test('should detect contradiction in class hierarchy', async () => {
      const triples = [
        ['kg:A', 'rdfs:subClassOf', 'kg:B'],
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:X', 'rdf:type', 'kg:A']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(false);
    });

    test('should verify equivalent classes', async () => {
      const triples = [
        ['kg:Human', 'owl:equivalentClass', 'kg:Person'],
        ['kg:John', 'rdf:type', 'kg:Human']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
    });

    test('should handle multiple disjoint classes', async () => {
      const triples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:B', 'owl:disjointWith', 'kg:C'],
        ['kg:A', 'owl:disjointWith', 'kg:C'],
        ['kg:X', 'rdf:type', 'kg:A'],
        ['kg:Y', 'rdf:type', 'kg:B'],
        ['kg:Z', 'rdf:type', 'kg:C']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
    });

    test('should detect violation across multiple disjoint classes', async () => {
      const triples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:B', 'owl:disjointWith', 'kg:C'],
        ['kg:A', 'owl:disjointWith', 'kg:C'],
        ['kg:X', 'rdf:type', 'kg:A'],
        ['kg:X', 'rdf:type', 'kg:B']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle self-reference in subClassOf', async () => {
      const triples = [
        ['kg:A', 'rdfs:subClassOf', 'kg:A']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
    });

    test('should handle circular subsumption (A ⊆ B ⊆ A implies equivalence)', async () => {
      const triples = [
        ['kg:A', 'rdfs:subClassOf', 'kg:B'],
        ['kg:B', 'rdfs:subClassOf', 'kg:A']
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(true);
    });

    test('should allow empty class as subclass of disjoint classes', async () => {
      // In DL: if C ⊆ A and C ⊆ B, and A ⊥ B, then C is consistent but empty
      const triples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:C', 'rdfs:subClassOf', 'kg:A'],
        ['kg:C', 'rdfs:subClassOf', 'kg:B']
      ];

      const result = await verifier.verifyConsistency(triples);

      // This is consistent! C just has no instances (is empty)
      expect(result.consistent).toBe(true);
    });

    test('should reject instance of class that is subclass of disjoint classes', async () => {
      // Adding an instance to the empty class C makes it inconsistent
      const triples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:C', 'rdfs:subClassOf', 'kg:A'],
        ['kg:C', 'rdfs:subClassOf', 'kg:B'],
        ['kg:X', 'rdf:type', 'kg:C']  // This is the problem!
      ];

      const result = await verifier.verifyConsistency(triples);

      expect(result.consistent).toBe(false);
    });
  });
});
