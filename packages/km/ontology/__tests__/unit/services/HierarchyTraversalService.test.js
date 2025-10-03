/**
 * HierarchyTraversalService Unit Tests
 *
 * Tests hierarchy navigation (rdfs:subClassOf chains)
 * Uses mock tripleStore for fast unit tests
 */

import { jest } from '@jest/globals';
import { HierarchyTraversalService } from '../../../src/services/HierarchyTraversalService.js';

describe('HierarchyTraversalService', () => {
  let service;
  let mockTripleStore;

  beforeEach(() => {
    // Create mock tripleStore
    mockTripleStore = {
      query: jest.fn(),
    };

    service = new HierarchyTraversalService(mockTripleStore);
  });

  describe('constructor', () => {
    test('should initialize with tripleStore', () => {
      expect(service.tripleStore).toBe(mockTripleStore);
    });
  });

  describe('getAncestors', () => {
    test('should return empty array for root class (no parents)', () => {
      // Mock: owl:Thing has no parent
      mockTripleStore.query.mockReturnValue([]);

      const result = service.getAncestors('owl:Thing');

      expect(result).toEqual([]);
      expect(mockTripleStore.query).toHaveBeenCalledWith('owl:Thing', 'rdfs:subClassOf', null);
    });

    test('should return single parent for one-level hierarchy', () => {
      // Mock: Equipment → PhysicalObject (and PhysicalObject has no parent)
      mockTripleStore.query
        .mockReturnValueOnce([['kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject']]) // First call
        .mockReturnValueOnce([]); // Second call (PhysicalObject has no parent)

      const result = service.getAncestors('kg:Equipment');

      expect(result).toEqual(['kg:PhysicalObject']);
      expect(mockTripleStore.query).toHaveBeenCalledTimes(2);
      expect(mockTripleStore.query).toHaveBeenNthCalledWith(1, 'kg:Equipment', 'rdfs:subClassOf', null);
      expect(mockTripleStore.query).toHaveBeenNthCalledWith(2, 'kg:PhysicalObject', 'rdfs:subClassOf', null);
    });

    test('should return full chain for multi-level hierarchy', () => {
      // Mock: CentrifugalPump → Pump → Equipment → PhysicalObject
      mockTripleStore.query
        .mockReturnValueOnce([['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']])
        .mockReturnValueOnce([['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']])
        .mockReturnValueOnce([['kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject']])
        .mockReturnValueOnce([]); // PhysicalObject has no parent

      const result = service.getAncestors('kg:CentrifugalPump');

      expect(result).toEqual(['kg:Pump', 'kg:Equipment', 'kg:PhysicalObject']);
      expect(mockTripleStore.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('getDescendants', () => {
    test('should return empty array for leaf class (no children)', () => {
      // Mock: CentrifugalPump has no children
      mockTripleStore.query.mockReturnValue([]);

      const result = service.getDescendants('kg:CentrifugalPump');

      expect(result).toEqual([]);
      expect(mockTripleStore.query).toHaveBeenCalledWith(null, 'rdfs:subClassOf', 'kg:CentrifugalPump');
    });

    test('should return direct children', () => {
      // Mock: Equipment has two children: Pump and Tank
      mockTripleStore.query.mockReturnValue([
        ['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment'],
        ['kg:Tank', 'rdfs:subClassOf', 'kg:Equipment']
      ]);

      const result = service.getDescendants('kg:Equipment');

      expect(result).toEqual(['kg:Pump', 'kg:Tank']);
      expect(mockTripleStore.query).toHaveBeenCalledWith(null, 'rdfs:subClassOf', 'kg:Equipment');
    });

    test('should return only direct children, not grandchildren', () => {
      // Mock: Pump has one child: CentrifugalPump
      mockTripleStore.query.mockReturnValue([
        ['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']
      ]);

      const result = service.getDescendants('kg:Pump');

      expect(result).toEqual(['kg:CentrifugalPump']);
    });
  });

  describe('getHierarchyContext', () => {
    test('should return ancestors, descendants, and depth', () => {
      // Mock for ancestors: Pump → Equipment → PhysicalObject
      mockTripleStore.query
        .mockReturnValueOnce([['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']]) // getAncestors call 1
        .mockReturnValueOnce([['kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject']]) // getAncestors call 2
        .mockReturnValueOnce([]) // getAncestors call 3 (PhysicalObject has no parent)
        .mockReturnValueOnce([['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']]) // getDescendants call
        .mockReturnValueOnce([['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']]) // depth calculation call 1
        .mockReturnValueOnce([['kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject']]) // depth calculation call 2
        .mockReturnValueOnce([]); // depth calculation call 3

      const result = service.getHierarchyContext('kg:Pump');

      expect(result.class).toBe('kg:Pump');
      expect(result.ancestors).toEqual(['kg:Equipment', 'kg:PhysicalObject']);
      expect(result.descendants).toEqual(['kg:CentrifugalPump']);
      expect(result.depth).toBe(2);
    });

    test('should return correct context for root class', () => {
      // Mock for root class: no ancestors, possibly has children
      mockTripleStore.query
        .mockReturnValueOnce([]) // getAncestors call (no parents)
        .mockReturnValueOnce([['kg:Equipment', 'rdfs:subClassOf', 'kg:PhysicalObject']]) // getDescendants call
        .mockReturnValueOnce([]); // depth calculation

      const result = service.getHierarchyContext('kg:PhysicalObject');

      expect(result.class).toBe('kg:PhysicalObject');
      expect(result.ancestors).toEqual([]);
      expect(result.descendants).toEqual(['kg:Equipment']);
      expect(result.depth).toBe(0);
    });

    test('should return correct context for leaf class', () => {
      // Mock for leaf class: has ancestors, no children
      mockTripleStore.query
        .mockReturnValueOnce([['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']]) // getAncestors call 1
        .mockReturnValueOnce([['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']]) // getAncestors call 2
        .mockReturnValueOnce([]) // getAncestors call 3 (Equipment has no parent in this mock)
        .mockReturnValueOnce([]) // getDescendants call (no children)
        .mockReturnValueOnce([['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump']]) // depth calculation call 1
        .mockReturnValueOnce([['kg:Pump', 'rdfs:subClassOf', 'kg:Equipment']]) // depth calculation call 2
        .mockReturnValueOnce([]); // depth calculation call 3

      const result = service.getHierarchyContext('kg:CentrifugalPump');

      expect(result.class).toBe('kg:CentrifugalPump');
      expect(result.ancestors).toEqual(['kg:Pump', 'kg:Equipment']);
      expect(result.descendants).toEqual([]);
      expect(result.depth).toBe(2);
    });
  });
});
