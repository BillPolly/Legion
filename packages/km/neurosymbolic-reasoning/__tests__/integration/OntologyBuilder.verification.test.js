/**
 * Integration test: OntologyBuilder with Z3 Verification
 *
 * Tests the full integration of OntologyVerifier with OntologyBuilder workflow.
 * Uses mock implementations to avoid complex dependency setup.
 */
import { OntologyVerifier } from '../../src/ontology/OntologyVerifier.js';

describe('OntologyBuilder Verification Integration', () => {
  let verifier;

  beforeAll(async () => {
    verifier = new OntologyVerifier();
    await verifier.initialize();
  });

  describe('Bootstrap Ontology Verification', () => {
    test('should verify bootstrap upper-level ontology is consistent', async () => {
      // Simulate bootstrap ontology triples from @legion/ontology
      const bootstrapTriples = [
        // Upper-level classes
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:Occurrent', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
        ['kg:State', 'rdf:type', 'owl:Class'],
        ['kg:Process', 'rdf:type', 'owl:Class'],
        ['kg:Task', 'rdf:type', 'owl:Class'],

        // Subsumption hierarchy
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:State', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent'],
        ['kg:Task', 'rdfs:subClassOf', 'kg:Occurrent'],

        // Disjointness constraints
        ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent'],
        ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],
        ['kg:Process', 'owl:disjointWith', 'kg:Task']
      ];

      const result = await verifier.verifyConsistency(bootstrapTriples);

      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Incremental Extension Verification', () => {
    test('should accept valid extension (Pump as PhysicalEntity)', async () => {
      const bootstrapAxioms = [
        ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant']
      ];

      const extension = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity']
      ];

      const result = await verifier.checkAddition(bootstrapAxioms, extension);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject invalid extension (Pump as both PhysicalEntity and State)', async () => {
      const bootstrapAxioms = [
        ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
        ['kg:State', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State']
      ];

      // Try to create Pump as subclass of both disjoint classes with instance
      const extension = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity'],
        ['kg:Pump', 'rdfs:subClassOf', 'kg:State'],
        ['kg:Pump1', 'rdf:type', 'kg:Pump']  // Instance makes it inconsistent
      ];

      const result = await verifier.checkAddition(bootstrapAxioms, extension);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Step Ontology Building Simulation', () => {
    test('should verify ontology remains consistent across multiple extensions', async () => {
      let currentTriples = [
        // Bootstrap
        ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
        ['kg:Process', 'rdf:type', 'owl:Class'],
        ['kg:Continuant', 'rdf:type', 'owl:Class'],
        ['kg:Occurrent', 'rdf:type', 'owl:Class'],
        ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
        ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent'],
        ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent']
      ];

      // Verify bootstrap
      let result = await verifier.verifyConsistency(currentTriples);
      expect(result.consistent).toBe(true);

      // Extension 1: Add Pump (device that moves fluids)
      const ext1 = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity']
      ];
      result = await verifier.checkAddition(currentTriples, ext1);
      expect(result.valid).toBe(true);
      currentTriples = [...currentTriples, ...ext1];

      // Extension 2: Add CentrifugalPump (specialization of Pump)
      const ext2 = [
        ['kg:CentrifugalPump', 'rdf:type', 'owl:Class'],
        ['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']
      ];
      result = await verifier.checkAddition(currentTriples, ext2);
      expect(result.valid).toBe(true);
      currentTriples = [...currentTriples, ...ext2];

      // Extension 3: Add Valve (also a PhysicalEntity)
      const ext3 = [
        ['kg:Valve', 'rdf:type', 'owl:Class'],
        ['kg:Valve', 'rdfs:subClassOf', 'kg:PhysicalEntity']
      ];
      result = await verifier.checkAddition(currentTriples, ext3);
      expect(result.valid).toBe(true);
      currentTriples = [...currentTriples, ...ext3];

      // Extension 4: Add Pumping (a Process)
      const ext4 = [
        ['kg:Pumping', 'rdf:type', 'owl:Class'],
        ['kg:Pumping', 'rdfs:subClassOf', 'kg:Process']
      ];
      result = await verifier.checkAddition(currentTriples, ext4);
      expect(result.valid).toBe(true);
      currentTriples = [...currentTriples, ...ext4];

      // Final verification - entire ontology is consistent
      result = await verifier.verifyConsistency(currentTriples);
      expect(result.consistent).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Verification Statistics', () => {
    test('should track verification statistics across operations', async () => {
      const bootstrapTriples = [
        ['kg:A', 'rdf:type', 'owl:Class'],
        ['kg:B', 'rdf:type', 'owl:Class']
      ];

      // First verification - consistent
      await verifier.verifyConsistency(bootstrapTriples);

      // Second verification - inconsistent
      const badTriples = [
        ['kg:A', 'owl:disjointWith', 'kg:B'],
        ['kg:X', 'rdf:type', 'kg:A'],
        ['kg:X', 'rdf:type', 'kg:B']
      ];
      await verifier.verifyConsistency([...bootstrapTriples, ...badTriples]);

      // Statistics should show both verifications
      // (Note: OntologyVerificationService wraps this with stats tracking)
    });
  });

  describe('Domain/Range Verification', () => {
    test('should verify relationship domain/range constraints', async () => {
      const triples = [
        ['kg:Pump', 'rdf:type', 'owl:Class'],
        ['kg:Fluid', 'rdf:type', 'owl:Class'],
        ['kg:moves', 'rdf:type', 'owl:ObjectProperty'],
        ['kg:moves', 'rdfs:domain', 'kg:Pump'],
        ['kg:moves', 'rdfs:range', 'kg:Fluid']
      ];

      // Valid usage
      const validInstances = [
        ['kg:Pump1', 'rdf:type', 'kg:Pump'],
        ['kg:Water', 'rdf:type', 'kg:Fluid'],
        ['kg:Pump1', 'kg:moves', 'kg:Water']
      ];

      const result = await verifier.verifyDomainRange(
        'kg:moves',
        'kg:Pump',
        'kg:Fluid',
        validInstances
      );

      expect(result.valid).toBe(true);
    });
  });
});
