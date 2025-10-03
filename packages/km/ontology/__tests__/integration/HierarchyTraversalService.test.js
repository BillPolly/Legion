/**
 * HierarchyTraversalService Integration Tests
 *
 * Tests hierarchy navigation with REAL SimpleTripleStore
 * NO MOCKS - uses actual RDF data
 */

import { SimpleTripleStore } from '@legion/rdf';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';

describe('HierarchyTraversalService Integration', () => {
  let tripleStore;
  let service;

  beforeEach(() => {
    // Create real SimpleTripleStore
    tripleStore = new SimpleTripleStore();
    service = new HierarchyTraversalService(tripleStore);

    // Build equipment hierarchy: PhysicalObject → Equipment → Pump → CentrifugalPump
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

    // Add sibling classes
    tripleStore.add('kg:Tank', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Tank', 'rdfs:label', '"Tank"');
    tripleStore.add('kg:Tank', 'rdfs:subClassOf', 'kg:Equipment');

    tripleStore.add('kg:Compressor', 'rdf:type', 'owl:Class');
    tripleStore.add('kg:Compressor', 'rdfs:label', '"Compressor"');
    tripleStore.add('kg:Compressor', 'rdfs:subClassOf', 'kg:Equipment');

    console.log(`✅ Built test hierarchy with ${tripleStore.size()} triples`);
  });

  describe('getAncestors with real RDF data', () => {
    test('should traverse hierarchy from leaf to root', () => {
      const ancestors = service.getAncestors('kg:CentrifugalPump');

      expect(ancestors).toEqual(['kg:Pump', 'kg:Equipment', 'kg:PhysicalObject']);
      console.log('✅ CentrifugalPump ancestors:', ancestors);
    });

    test('should get single ancestor', () => {
      const ancestors = service.getAncestors('kg:Equipment');

      expect(ancestors).toEqual(['kg:PhysicalObject']);
      console.log('✅ Equipment ancestors:', ancestors);
    });

    test('should return empty for root class', () => {
      const ancestors = service.getAncestors('kg:PhysicalObject');

      expect(ancestors).toEqual([]);
      console.log('✅ PhysicalObject has no ancestors (root class)');
    });
  });

  describe('getDescendants with real RDF data', () => {
    test('should find all direct children of Equipment', () => {
      const descendants = service.getDescendants('kg:Equipment');

      expect(descendants).toHaveLength(3);
      expect(descendants).toContain('kg:Pump');
      expect(descendants).toContain('kg:Tank');
      expect(descendants).toContain('kg:Compressor');
      console.log('✅ Equipment descendants:', descendants);
    });

    test('should find single child', () => {
      const descendants = service.getDescendants('kg:Pump');

      expect(descendants).toEqual(['kg:CentrifugalPump']);
      console.log('✅ Pump descendants:', descendants);
    });

    test('should return empty for leaf class', () => {
      const descendants = service.getDescendants('kg:CentrifugalPump');

      expect(descendants).toEqual([]);
      console.log('✅ CentrifugalPump has no descendants (leaf class)');
    });
  });

  describe('getHierarchyContext with real RDF data', () => {
    test('should provide full context for middle node (Pump)', () => {
      const context = service.getHierarchyContext('kg:Pump');

      expect(context.class).toBe('kg:Pump');
      expect(context.ancestors).toEqual(['kg:Equipment', 'kg:PhysicalObject']);
      expect(context.descendants).toEqual(['kg:CentrifugalPump']);
      expect(context.depth).toBe(2);

      console.log('✅ Pump hierarchy context:');
      console.log('   - Ancestors:', context.ancestors);
      console.log('   - Descendants:', context.descendants);
      console.log('   - Depth:', context.depth);
    });

    test('should provide context for root class', () => {
      const context = service.getHierarchyContext('kg:PhysicalObject');

      expect(context.class).toBe('kg:PhysicalObject');
      expect(context.ancestors).toEqual([]);
      expect(context.descendants).toContain('kg:Equipment');
      expect(context.depth).toBe(0);

      console.log('✅ PhysicalObject hierarchy context (root class):');
      console.log('   - Depth:', context.depth);
      console.log('   - Descendants:', context.descendants);
    });

    test('should provide context for leaf class', () => {
      const context = service.getHierarchyContext('kg:CentrifugalPump');

      expect(context.class).toBe('kg:CentrifugalPump');
      expect(context.ancestors).toEqual(['kg:Pump', 'kg:Equipment', 'kg:PhysicalObject']);
      expect(context.descendants).toEqual([]);
      expect(context.depth).toBe(3);

      console.log('✅ CentrifugalPump hierarchy context (leaf class):');
      console.log('   - Ancestors:', context.ancestors);
      console.log('   - Depth:', context.depth);
    });
  });

  describe('real-world hierarchy scenarios', () => {
    test('should handle equipment hierarchy with complex relationships', () => {
      // Verify the full hierarchy is correctly stored
      const allClasses = tripleStore.query(null, 'rdf:type', 'owl:Class');
      expect(allClasses.length).toBeGreaterThanOrEqual(6);

      // Verify all subClassOf relationships
      const allSubclassRelations = tripleStore.query(null, 'rdfs:subClassOf', null);
      expect(allSubclassRelations.length).toBe(5); // Equipment, Pump, CentrifugalPump, Tank, Compressor

      console.log('✅ Full hierarchy verified:');
      console.log('   - Total classes:', allClasses.length);
      console.log('   - Total subClassOf relations:', allSubclassRelations.length);
    });

    test('should correctly identify sibling classes', () => {
      const equipmentChildren = service.getDescendants('kg:Equipment');

      // Pump, Tank, and Compressor are siblings (all children of Equipment)
      expect(equipmentChildren).toHaveLength(3);
      expect(equipmentChildren).toContain('kg:Pump');
      expect(equipmentChildren).toContain('kg:Tank');
      expect(equipmentChildren).toContain('kg:Compressor');

      // Verify siblings have same parent
      const pumpAncestors = service.getAncestors('kg:Pump');
      const tankAncestors = service.getAncestors('kg:Tank');
      const compressorAncestors = service.getAncestors('kg:Compressor');

      expect(pumpAncestors[0]).toBe('kg:Equipment');
      expect(tankAncestors[0]).toBe('kg:Equipment');
      expect(compressorAncestors[0]).toBe('kg:Equipment');

      console.log('✅ Sibling classes correctly identified:');
      console.log('   - Equipment children:', equipmentChildren);
    });
  });
});
