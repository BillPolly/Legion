/**
 * SubsumptionChecker Unit Tests
 *
 * Tests subsumption checking (property/relationship inheritance)
 * Uses mock tripleStore and hierarchyTraversal for fast unit tests
 */

import { jest } from '@jest/globals';
import { SubsumptionChecker } from '../../../src/services/SubsumptionChecker.js';

describe('SubsumptionChecker', () => {
  let checker;
  let mockTripleStore;
  let mockHierarchyTraversal;

  beforeEach(() => {
    mockTripleStore = {
      query: jest.fn(),
    };

    mockHierarchyTraversal = {
      getAncestors: jest.fn(),
    };

    checker = new SubsumptionChecker(mockTripleStore, mockHierarchyTraversal);
  });

  describe('constructor', () => {
    test('should initialize with tripleStore and hierarchyTraversal', () => {
      expect(checker.tripleStore).toBe(mockTripleStore);
      expect(checker.hierarchyTraversal).toBe(mockHierarchyTraversal);
    });
  });

  describe('checkPropertySubsumption', () => {
    test('should return exists=false for new property not in hierarchy', () => {
      // Mock: Pump has Equipment as ancestor
      mockHierarchyTraversal.getAncestors.mockReturnValue(['kg:Equipment']);

      // Mock: No properties found in kg:Pump or kg:Equipment
      mockTripleStore.query.mockReturnValue([]);

      const result = checker.checkPropertySubsumption('kg:Pump', 'newProperty');

      expect(result.exists).toBe(false);
    });

    test('should find property in direct class', () => {
      // Mock: Pump has no ancestors (for this test)
      mockHierarchyTraversal.getAncestors.mockReturnValue([]);

      // Mock: Pump has operatingPressure property
      mockTripleStore.query
        .mockReturnValueOnce([['kg:operatingPressure', 'rdfs:domain', 'kg:Pump']]) // Properties in kg:Pump
        .mockReturnValueOnce([[null, null, '"operatingPressure"']]); // Label query

      const result = checker.checkPropertySubsumption('kg:Pump', 'operatingPressure');

      expect(result.exists).toBe(true);
      expect(result.property).toBe('kg:operatingPressure');
      expect(result.label).toBe('operatingPressure');
      expect(result.definedIn).toBe('kg:Pump');
      expect(result.inheritanceDistance).toBe(0);
      expect(result.inherited).toBe(false);
    });

    test('should find inherited property from ancestor', () => {
      // Mock: Pump → Equipment
      mockHierarchyTraversal.getAncestors.mockReturnValue(['kg:Equipment']);

      // Mock: Pump has no properties, Equipment has 'manufacturer'
      mockTripleStore.query
        .mockReturnValueOnce([]) // No properties in kg:Pump
        .mockReturnValueOnce([['kg:manufacturer', 'rdfs:domain', 'kg:Equipment']]) // Properties in kg:Equipment
        .mockReturnValueOnce([[null, null, '"manufacturer"']]); // Label query

      const result = checker.checkPropertySubsumption('kg:Pump', 'manufacturer');

      expect(result.exists).toBe(true);
      expect(result.property).toBe('kg:manufacturer');
      expect(result.label).toBe('manufacturer');
      expect(result.definedIn).toBe('kg:Equipment');
      expect(result.inheritanceDistance).toBe(1);
      expect(result.inherited).toBe(true);
    });

    test('should return correct inheritanceDistance for deep hierarchy', () => {
      // Mock: CentrifugalPump → Pump → Equipment → PhysicalObject
      mockHierarchyTraversal.getAncestors.mockReturnValue(['kg:Pump', 'kg:Equipment', 'kg:PhysicalObject']);

      // Mock: Property found in PhysicalObject
      mockTripleStore.query
        .mockReturnValueOnce([]) // No properties in CentrifugalPump
        .mockReturnValueOnce([]) // No properties in Pump
        .mockReturnValueOnce([]) // No properties in Equipment
        .mockReturnValueOnce([['kg:locatedIn', 'rdfs:domain', 'kg:PhysicalObject']]) // Property in PhysicalObject
        .mockReturnValueOnce([[null, null, '"locatedIn"']]);

      const result = checker.checkPropertySubsumption('kg:CentrifugalPump', 'locatedIn');

      expect(result.inheritanceDistance).toBe(3);
      expect(result.inherited).toBe(true);
    });
  });

  describe('checkRelationshipSubsumption', () => {
    test('should return exists=false when relationship not found', () => {
      // Mock: Pump → Equipment
      mockHierarchyTraversal.getAncestors
        .mockReturnValueOnce(['kg:Equipment']) // Domain hierarchy
        .mockReturnValueOnce(['kg:Equipment']); // Range hierarchy

      // Mock: No relationships found
      mockTripleStore.query.mockReturnValue([]);

      const result = checker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'newRelationship');

      expect(result.exists).toBe(false);
    });

    test('should find relationship in hierarchy', () => {
      // Mock: Pump → Equipment, Tank → Equipment
      mockHierarchyTraversal.getAncestors
        .mockReturnValueOnce(['kg:Equipment']) // Domain hierarchy
        .mockReturnValueOnce(['kg:Equipment']); // Range hierarchy

      // Mock: connectsTo relationship found in Equipment
      mockTripleStore.query
        .mockReturnValueOnce([]) // No relationships in kg:Pump
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:domain', 'kg:Equipment']]) // Relationship in Equipment
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']]) // Type check
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']]) // Range
        .mockReturnValueOnce([[null, null, '"connectsTo"']]); // Label

      const result = checker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'connectsTo');

      expect(result.exists).toBe(true);
      expect(result.relationship).toBe('kg:connectsTo');
      expect(result.label).toBe('connectsTo');
      expect(result.definedIn.domain).toBe('kg:Equipment');
      expect(result.definedIn.range).toBe('kg:Equipment');
      expect(result.inheritanceDistance).toBe(1);
      expect(result.inherited).toBe(true);
    });

    test('should validate canSpecialize=true when domain and range are subclasses (valid)', () => {
      // Mock: Pump → Equipment, Tank → Equipment
      mockHierarchyTraversal.getAncestors
        .mockReturnValueOnce(['kg:Equipment']) // Domain hierarchy (Pump → Equipment)
        .mockReturnValueOnce(['kg:Equipment']); // Range hierarchy (Tank → Equipment)

      // Mock: connectsTo(Equipment, Equipment) exists
      mockTripleStore.query
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:domain', 'kg:Equipment']]) // Relationship in Equipment
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']]) // Type check
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']]) // Range
        .mockReturnValueOnce([[null, null, '"connectsTo"']]); // Label

      const result = checker.checkRelationshipSubsumption('kg:Pump', 'kg:Tank', 'connectsTo');

      // Pump ⊆ Equipment ✓, Tank ⊆ Equipment ✓ → canSpecialize=true
      expect(result.canSpecialize).toBe(true);
      expect(result.specializationReason).toBeNull();
    });

    test('should validate canSpecialize=false when range not subclass (Rule 2 violation)', () => {
      // Mock: Pump → Equipment, Building → Structure (NOT Equipment)
      mockHierarchyTraversal.getAncestors
        .mockReturnValueOnce(['kg:Equipment']) // Domain hierarchy (Pump → Equipment)
        .mockReturnValueOnce(['kg:Structure']); // Range hierarchy (Building → Structure, NOT Equipment)

      // Mock: connectsTo(Equipment, Equipment) exists
      mockTripleStore.query
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:domain', 'kg:Equipment']]) // Relationship in Equipment
        .mockReturnValueOnce([['kg:connectsTo', 'rdf:type', 'owl:ObjectProperty']]) // Type check
        .mockReturnValueOnce([['kg:connectsTo', 'rdfs:range', 'kg:Equipment']]) // Range
        .mockReturnValueOnce([[null, null, '"connectsTo"']]); // Label

      const result = checker.checkRelationshipSubsumption('kg:Pump', 'kg:Building', 'connectsTo');

      // Pump ⊆ Equipment ✓, Building ⊄ Equipment ✗ → canSpecialize=false
      expect(result.canSpecialize).toBe(false);
      expect(result.specializationReason).toContain('range constraint violated');
    });
  });

  describe('isSubClassOfOrEqual', () => {
    test('should return true when classes are equal', () => {
      const result = checker.isSubClassOfOrEqual('kg:Equipment', 'kg:Equipment', []);

      expect(result).toBe(true);
    });

    test('should return true when testClass is subclass of baseClass', () => {
      const hierarchy = ['kg:Equipment', 'kg:PhysicalObject'];

      const result = checker.isSubClassOfOrEqual('kg:Pump', 'kg:Equipment', hierarchy);

      expect(result).toBe(true);
    });

    test('should return false when testClass is not subclass of baseClass', () => {
      const hierarchy = ['kg:Structure', 'kg:PhysicalObject'];

      const result = checker.isSubClassOfOrEqual('kg:Building', 'kg:Equipment', hierarchy);

      expect(result).toBe(false);
    });
  });

  describe('getSpecializationFailureReason', () => {
    test('should explain domain broadening failure', () => {
      const reason = checker.getSpecializationFailureReason(
        'kg:PhysicalObject', 'kg:Equipment', // proposed
        'kg:Equipment', 'kg:Equipment', // base
        false, true // domainValid=false, rangeValid=true
      );

      expect(reason).toContain('Domain');
      expect(reason).toContain('broadens');
    });

    test('should explain range constraint violation', () => {
      const reason = checker.getSpecializationFailureReason(
        'kg:Pump', 'kg:Building', // proposed
        'kg:Equipment', 'kg:Equipment', // base
        true, false // domainValid=true, rangeValid=false
      );

      expect(reason).toContain('Range');
      expect(reason).toContain('range constraint violated');
    });

    test('should explain both constraints violated', () => {
      const reason = checker.getSpecializationFailureReason(
        'kg:PhysicalObject', 'kg:Building', // proposed
        'kg:Equipment', 'kg:Equipment', // base
        false, false // both invalid
      );

      expect(reason).toContain('Domain');
      expect(reason).toContain('AND');
      expect(reason).toContain('range');
    });

    test('should return null when both constraints valid', () => {
      const reason = checker.getSpecializationFailureReason(
        'kg:Pump', 'kg:Tank', // proposed
        'kg:Equipment', 'kg:Equipment', // base
        true, true // both valid
      );

      expect(reason).toBeNull();
    });
  });

  describe('isSimilar', () => {
    test('should match exact strings', () => {
      expect(checker.isSimilar('operatingPressure', 'operatingPressure')).toBe(true);
    });

    test('should match ignoring case', () => {
      expect(checker.isSimilar('OperatingPressure', 'operatingpressure')).toBe(true);
    });

    test('should match ignoring underscores and hyphens', () => {
      expect(checker.isSimilar('operating_pressure', 'operating-pressure')).toBe(true);
      expect(checker.isSimilar('operating-pressure', 'operatingpressure')).toBe(true);
    });

    test('should match ignoring spaces', () => {
      expect(checker.isSimilar('operating pressure', 'operatingpressure')).toBe(true);
    });

    test('should not match different strings', () => {
      expect(checker.isSimilar('operatingPressure', 'flowRate')).toBe(false);
    });

    test('should handle null/undefined', () => {
      expect(checker.isSimilar(null, 'test')).toBe(false);
      expect(checker.isSimilar('test', null)).toBe(false);
      expect(checker.isSimilar(undefined, 'test')).toBe(false);
    });
  });
});
