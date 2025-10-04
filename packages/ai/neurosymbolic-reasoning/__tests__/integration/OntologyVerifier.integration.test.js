/**
 * Integration tests for OntologyVerifier with real @legion/ontology data
 */
import { OntologyVerifier } from '../../src/ontology/OntologyVerifier.js';
import { getBootstrapTriples } from '../../../../km/ontology/src/bootstrap/upper-level-ontology.js';

describe('OntologyVerifier Integration with @legion/ontology', () => {
  let verifier;

  beforeAll(async () => {
    verifier = new OntologyVerifier();
    await verifier.initialize();
  });

  describe('Bootstrap Ontology Verification', () => {
    test('should verify full bootstrap ontology from @legion/ontology', async () => {
      const bootstrapTriples = getBootstrapTriples();

      // Filter to only axiom triples (remove labels, comments, etc.)
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' ||
               p === 'rdfs:subClassOf' ||
               p === 'owl:disjointWith' ||
               p === 'rdfs:domain' ||
               p === 'rdfs:range' ||
               p === 'owl:equivalentClass' ||
               p === 'owl:inverseOf';
      });

      console.log(`Testing ${axiomTriples.length} axioms from bootstrap ontology`);

      const result = await verifier.verifyConsistency(axiomTriples);

      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should verify Continuant/Occurrent disjointness from bootstrap', async () => {
      const triples = getBootstrapTriples();

      // Extract just the disjointness axiom and class declarations
      const relevantTriples = triples.filter(([s, p, o]) => {
        return (p === 'owl:disjointWith' && s === 'kg:Continuant' && o === 'kg:Occurrent') ||
               (p === 'rdf:type' && o === 'owl:Class' && (s === 'kg:Continuant' || s === 'kg:Occurrent'));
      });

      const result = await verifier.verifyConsistency(relevantTriples);

      expect(result.consistent).toBe(true);
    });

    test('should verify PhysicalEntity/State disjointness from bootstrap', async () => {
      const triples = getBootstrapTriples();

      const relevantTriples = triples.filter(([s, p, o]) => {
        return (p === 'owl:disjointWith' && s === 'kg:PhysicalEntity' && o === 'kg:State') ||
               (p === 'rdfs:subClassOf' && (s === 'kg:PhysicalEntity' || s === 'kg:State')) ||
               (p === 'rdf:type' && o === 'owl:Class');
      });

      const result = await verifier.verifyConsistency(relevantTriples);

      expect(result.consistent).toBe(true);
    });

    test('should verify Process/Task disjointness from bootstrap', async () => {
      const triples = getBootstrapTriples();

      const relevantTriples = triples.filter(([s, p, o]) => {
        return (p === 'owl:disjointWith' && s === 'kg:Process' && o === 'kg:Task') ||
               (p === 'rdfs:subClassOf' && (s === 'kg:Process' || s === 'kg:Task')) ||
               (p === 'rdf:type' && o === 'owl:Class');
      });

      const result = await verifier.verifyConsistency(relevantTriples);

      expect(result.consistent).toBe(true);
    });
  });

  describe('Instance Validation against Bootstrap', () => {
    test('should accept valid Pump instance', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      // Add a pump instance
      const withInstance = [
        ...axiomTriples,
        ['kg:Pump1', 'rdf:type', 'kg:PhysicalEntity']
      ];

      const result = await verifier.verifyConsistency(withInstance);

      expect(result.consistent).toBe(true);
    });

    test('should reject instance that violates disjointness', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      // Add instance that's both PhysicalEntity and State (violates disjointness)
      const withViolation = [
        ...axiomTriples,
        ['kg:BadEntity', 'rdf:type', 'kg:PhysicalEntity'],
        ['kg:BadEntity', 'rdf:type', 'kg:State']
      ];

      const result = await verifier.verifyConsistency(withViolation);

      expect(result.consistent).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should reject instance that's both Continuant and Occurrent', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      const withViolation = [
        ...axiomTriples,
        ['kg:BadThing', 'rdf:type', 'kg:PhysicalEntity'],  // PhysicalEntity ⊆ Continuant
        ['kg:BadThing', 'rdf:type', 'kg:Process']  // Process ⊆ Occurrent
      ];

      const result = await verifier.verifyConsistency(withViolation);

      expect(result.consistent).toBe(false);
    });
  });

  describe('Domain/Range Verification with Bootstrap Relationships', () => {
    test('should verify transforms relationship domain/range', async () => {
      const bootstrapTriples = getBootstrapTriples();

      // Find transforms relationship triples
      const transformsTriples = bootstrapTriples.filter(([s, p, o]) => {
        return s === 'kg:transforms' ||
               (p === 'rdf:type' && o === 'owl:Class') ||
               (p === 'rdfs:subClassOf');
      });

      // Extract domain and range
      const domainTriple = bootstrapTriples.find(([s, p, o]) =>
        s === 'kg:transforms' && p === 'rdfs:domain'
      );
      const rangeTriple = bootstrapTriples.find(([s, p, o]) =>
        s === 'kg:transforms' && p === 'rdfs:range'
      );

      if (domainTriple && rangeTriple) {
        const domain = domainTriple[2];
        const range = rangeTriple[2];

        const instances = [
          ['kg:Heating', 'rdf:type', domain],
          ['kg:Water', 'rdf:type', range],
          ['kg:Heating', 'kg:transforms', 'kg:Water']
        ];

        const result = await verifier.verifyDomainRange('kg:transforms', domain, range, instances);

        expect(result.valid).toBe(true);
      }
    });
  });

  describe('checkAddition with Bootstrap', () => {
    test('should accept adding new PhysicalEntity subclass', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      const newTriples = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity']
      ];

      const result = await verifier.checkAddition(axiomTriples, newTriples);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject adding class that violates disjointness', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      // Try to add a class that's subclass of both PhysicalEntity and State
      const newTriples = [
        ['kg:BadClass', 'rdf:type', 'owl:Class'],
        ['kg:BadClass', 'rdfs:subClassOf', 'kg:PhysicalEntity'],
        ['kg:BadClass', 'rdfs:subClassOf', 'kg:State'],
        ['kg:Instance', 'rdf:type', 'kg:BadClass']  // Adding instance makes it inconsistent
      ];

      const result = await verifier.checkAddition(axiomTriples, newTriples);

      expect(result.valid).toBe(false);
    });

    test('should accept adding Process subclass', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      });

      const newTriples = [
        ['kg:HeatingProcess', 'rdf:type', 'owl:Class'],
        ['kg:HeatingProcess', 'rdfs:subClassOf', 'kg:Process']
      ];

      const result = await verifier.checkAddition(axiomTriples, newTriples);

      expect(result.valid).toBe(true);
    });
  });

  describe('Proof Generation with Bootstrap', () => {
    test('should provide detailed proof for bootstrap consistency', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return p === 'rdf:type' || p === 'rdfs:subClassOf' || p === 'owl:disjointWith';
      }).slice(0, 20);  // Use subset for faster test

      const result = await verifier.getProof(axiomTriples);

      expect(result.consistent).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof).toContain('SAT');
    });

    test('should provide proof explaining disjointness violation', async () => {
      const bootstrapTriples = getBootstrapTriples();
      const axiomTriples = bootstrapTriples.filter(([s, p, o]) => {
        return (p === 'owl:disjointWith' && s === 'kg:PhysicalEntity' && o === 'kg:State') ||
               (p === 'rdf:type' && o === 'owl:Class');
      });

      const withViolation = [
        ...axiomTriples,
        ['kg:X', 'rdf:type', 'kg:PhysicalEntity'],
        ['kg:X', 'rdf:type', 'kg:State']
      ];

      const result = await verifier.getProof(withViolation);

      expect(result.consistent).toBe(false);
      expect(result.proof).toContain('UNSAT');
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
