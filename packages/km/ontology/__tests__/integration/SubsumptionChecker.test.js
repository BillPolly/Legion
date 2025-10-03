/**
 * SubsumptionChecker Integration Tests
 *
 * Tests subsumption checking with REAL components
 * NO MOCKS - uses actual SimpleTripleStore and HierarchyTraversalService
 */

import { SimpleTripleStore } from '@legion/rdf';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { SubsumptionChecker } from '../../src/services/SubsumptionChecker.js';

describe('SubsumptionChecker Integration', () => {
  let tripleStore;
  let hierarchyTraversal;
  let subsumptionChecker;

  beforeEach(() => {
    // Create real components
    tripleStore = new SimpleTripleStore();
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);
    subsumptionChecker = new SubsumptionChecker(tripleStore, hierarchyTraversal);

    // Build test hierarchy: PhysicalObject → Equipment → Pump → CentrifugalPump
    //                                      → Building
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

    // Add Building as sibling to Equipment (different branch)
    tripleStore.add('kg:Structure', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Structure', 'rdfs:label', '"Structure"');
    tripleStore.add('kg:Structure', 'rdfs:subClassOf', 'kg:PhysicalObject');

    tripleStore.add('kg:Building', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Building', 'rdfs:label', '"Building"');
    tripleStore.add('kg:Building', 'rdfs:subClassOf', 'kg:Structure');

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

    console.log(`✅ Built test ontology with ${tripleStore.size()} triples`);
  });

  describe('Property Subsumption with real RDF data', () => {
    test('should find property defined in direct class', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:Pump', 'operatingPressure');

      expect(result.exists).toBe(true);
      expect(result.property).toBe('kg:operatingPressure');
      expect(result.label).toBe('operatingPressure');
      expect(result.definedIn).toBe('kg:Pump');
      expect(result.inheritanceDistance).toBe(0);
      expect(result.inherited).toBe(false);

      console.log('✅ Found operatingPressure directly in Pump');
    });

    test('should find inherited property from parent', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:Pump', 'manufacturer');

      expect(result.exists).toBe(true);
      expect(result.property).toBe('kg:manufacturer');
      expect(result.label).toBe('manufacturer');
      expect(result.definedIn).toBe('kg:Equipment');
      expect(result.inheritanceDistance).toBe(1);
      expect(result.inherited).toBe(true);

      console.log('✅ Found manufacturer inherited from Equipment (distance=1)');
    });

    test('should find inherited property from grandparent', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:Pump', 'locatedIn');

      expect(result.exists).toBe(true);
      expect(result.property).toBe('kg:locatedIn');
      expect(result.label).toBe('locatedIn');
      expect(result.definedIn).toBe('kg:PhysicalObject');
      expect(result.inheritanceDistance).toBe(2);
      expect(result.inherited).toBe(true);

      console.log('✅ Found locatedIn inherited from PhysicalObject (distance=2)');
    });

    test('should find property inherited from deep ancestor', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:CentrifugalPump', 'locatedIn');

      expect(result.exists).toBe(true);
      expect(result.definedIn).toBe('kg:PhysicalObject');
      expect(result.inheritanceDistance).toBe(3); // CentrifugalPump → Pump → Equipment → PhysicalObject
      expect(result.inherited).toBe(true);

      console.log('✅ CentrifugalPump inherits locatedIn from PhysicalObject (distance=3)');
    });

    test('should return exists=false for non-existent property', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:Pump', 'nonExistentProperty');

      expect(result.exists).toBe(false);

      console.log('✅ Correctly identifies non-existent property');
    });
  });

  describe('Relationship Subsumption with real RDF data', () => {
    test('should find relationship in hierarchy', () => {
      // Pump and Tank are both Equipment
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'connectsTo');

      expect(result.exists).toBe(true);
      expect(result.relationship).toBe('kg:connectsTo');
      expect(result.label).toBe('connectsTo');
      expect(result.definedIn.domain).toBe('kg:Equipment');
      expect(result.definedIn.range).toBe('kg:Equipment');
      expect(result.inheritanceDistance).toBe(1); // Pump → Equipment
      expect(result.inherited).toBe(true);

      console.log('✅ Found connectsTo relationship in Equipment hierarchy');
    });

    test('should validate canSpecialize=true when both domain and range are subclasses (VALID)', () => {
      // Pump → Equipment ✓, Tank → Equipment ✓
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'connectsTo');

      expect(result.canSpecialize).toBe(true);
      expect(result.specializationReason).toBeNull();

      console.log('✅ Pump→Tank CAN specialize Equipment→Equipment (both subclasses)');
    });

    test('should validate canSpecialize=false when range not subclass (Rule 2 VIOLATION)', () => {
      // Pump → Equipment ✓, Building → Structure (NOT Equipment) ✗
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Building', 'connectsTo');

      expect(result.exists).toBe(true); // Relationship exists
      expect(result.canSpecialize).toBe(false); // But cannot be specialized
      expect(result.specializationReason).toContain('range constraint violated');
      expect(result.specializationReason).toContain('kg:Building');
      expect(result.specializationReason).toContain('kg:Equipment');

      console.log('✅ Pump→Building CANNOT specialize Equipment→Equipment (Building not subclass of Equipment)');
      console.log(`   Reason: ${result.specializationReason}`);
    });

    test('should validate canSpecialize=true for same domain and range', () => {
      // Equipment → Equipment (same as base)
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Equipment', 'kg:Equipment', 'connectsTo');

      expect(result.canSpecialize).toBe(true);
      expect(result.inheritanceDistance).toBe(0); // Found in Equipment itself

      console.log('✅ Equipment→Equipment CAN use connectsTo (exact match)');
    });
  });

  describe('Subsumption Rules Enforcement (from DESIGN.md)', () => {
    test('Rule 2 example: Pump→Tank specializes Equipment→Equipment (VALID)', () => {
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'connectsTo');

      // Both Pump and Tank are subclasses of Equipment
      expect(result.canSpecialize).toBe(true);

      console.log('✅ Rule 2 VALID: Pump ⊆ Equipment, Tank ⊆ Equipment');
    });

    test('Rule 2 example: Pump→Building cannot specialize Equipment→Equipment (INVALID)', () => {
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Building', 'connectsTo');

      // Pump is subclass of Equipment ✓, but Building is NOT subclass of Equipment ✗
      expect(result.canSpecialize).toBe(false);
      expect(result.specializationReason).toBeDefined();

      console.log('✅ Rule 2 INVALID: Pump ⊆ Equipment ✓, Building ⊄ Equipment ✗');
    });

    test('Rule 1: CentrifugalPump inherits ALL properties from ancestors', () => {
      // Should inherit from Pump, Equipment, and PhysicalObject
      const operatingPressure = subsumptionChecker.checkPropertySubsumption('kg:CentrifugalPump', 'operatingPressure');
      const manufacturer = subsumptionChecker.checkPropertySubsumption('kg:CentrifugalPump', 'manufacturer');
      const locatedIn = subsumptionChecker.checkPropertySubsumption('kg:CentrifugalPump', 'locatedIn');

      expect(operatingPressure.exists).toBe(true); // From Pump
      expect(manufacturer.exists).toBe(true); // From Equipment
      expect(locatedIn.exists).toBe(true); // From PhysicalObject

      console.log('✅ Rule 1: CentrifugalPump inherits ALL ancestor properties:');
      console.log(`   - operatingPressure from ${operatingPressure.definedIn} (distance ${operatingPressure.inheritanceDistance})`);
      console.log(`   - manufacturer from ${manufacturer.definedIn} (distance ${manufacturer.inheritanceDistance})`);
      console.log(`   - locatedIn from ${locatedIn.definedIn} (distance ${locatedIn.inheritanceDistance})`);
    });
  });

  describe('Edge cases and error scenarios', () => {
    test('should handle property search in root class', () => {
      const result = subsumptionChecker.checkPropertySubsumption('kg:PhysicalObject', 'locatedIn');

      expect(result.exists).toBe(true);
      expect(result.inheritanceDistance).toBe(0);
      expect(result.inherited).toBe(false);

      console.log('✅ Handles property search in root class');
    });

    test('should return exists=false for relationship not in hierarchy', () => {
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'nonExistentRelationship');

      expect(result.exists).toBe(false);

      console.log('✅ Correctly identifies non-existent relationship');
    });

    test('should handle relationship search across different branches', () => {
      // Building and Equipment are in different branches (both under PhysicalObject)
      const result = subsumptionChecker.checkRelationshipSubsumption('kg:Building', 'kg:Equipment', 'connectsTo');

      // connectsTo is defined on Equipment, not PhysicalObject or Structure
      expect(result.exists).toBe(false);

      console.log('✅ Correctly handles relationships across different hierarchy branches');
    });
  });
});
