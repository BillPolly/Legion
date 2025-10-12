/**
 * Unit tests for DataScriptConverter
 *
 * Tests LogicalSkeleton → DataScript query conversion.
 */

import { DataScriptConverter } from '../../src/phase4/DataScriptConverter.js';

describe('DataScriptConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new DataScriptConverter();
  });

  describe('Rule 1: Project → Find Clause', () => {
    test('should convert single variable projection', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['?x']);
    });

    test('should convert multiple variable projection', () => {
      const skeleton = {
        vars: ['?x', '?y'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?y', ':City']
        ],
        project: ['?x', '?y'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['?x', '?y']);
    });
  });

  describe('Rule 2: ISA Atoms → Type Triples', () => {
    test('should convert isa atom to type triple', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.where).toContainEqual(['?x', ':type', ':Country']);
    });

    test('should convert multiple isa atoms', () => {
      const skeleton = {
        vars: ['?x', '?y'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?y', ':City']
        ],
        project: ['?x', '?y'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.where).toContainEqual(['?x', ':type', ':Country']);
      expect(query.where).toContainEqual(['?y', ':type', ':City']);
    });
  });

  describe('Rule 3: REL Atoms → Property Triples', () => {
    test('should convert rel atom to property triple', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['rel', ':borders', '?x', ':Germany']
        ],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.where).toContainEqual(['?x', ':borders', ':Germany']);
    });

    test('should handle rel atoms with variables on both sides', () => {
      const skeleton = {
        vars: ['?x', '?y'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?y', ':Country'],
          ['rel', ':borders', '?x', '?y']
        ],
        project: ['?x', '?y'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.where).toContainEqual(['?x', ':borders', '?y']);
    });
  });

  describe('Rule 4: HAS Atoms → Attribute Triples', () => {
    test('should convert has atom to attribute triple', () => {
      const skeleton = {
        vars: ['?entity', '?v'],
        atoms: [
          ['isa', '?entity', ':Company'],
          ['has', '?entity', ':revenue', '?v']
        ],
        project: ['?v'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.where).toContainEqual(['?entity', ':revenue', '?v']);
    });
  });

  describe('Complete Conversion: "Which countries border Germany?"', () => {
    test('should convert complete skeleton correctly', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['rel', ':borders', '?x', ':Germany']
        ],
        project: ['?x'],
        order: [],
        limit: null,
        force: 'select',
        notes: []
      };

      const query = converter.convert(skeleton);

      // Expected DataScript query:
      // {
      //   find: ['?x'],
      //   where: [
      //     ['?x', ':type', ':Country'],
      //     ['?x', ':borders', ':Germany']
      //   ]
      // }

      expect(query.find).toEqual(['?x']);
      expect(query.where).toHaveLength(2);
      expect(query.where).toContainEqual(['?x', ':type', ':Country']);
      expect(query.where).toContainEqual(['?x', ':borders', ':Germany']);
    });
  });

  describe('Aggregations (Rule 6)', () => {
    test('should convert COUNT aggregation', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        project: [['COUNT', '?x']],
        force: 'aggregate'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['(count ?x)']);
    });

    test('should convert MAX aggregation', () => {
      const skeleton = {
        vars: ['?entity', '?height'],
        atoms: [
          ['isa', '?entity', ':Mountain'],
          ['has', '?entity', ':height', '?height']
        ],
        project: [['MAX', '?height']],
        force: 'aggregate'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['(max ?height)']);
    });
  });

  describe('Negation (whereNot)', () => {
    test('should convert whereNot atoms to DataScript whereNot clause', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        whereNot: [['rel', ':borders', '?x', ':France']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['?x']);
      expect(query.where).toContainEqual(['?x', ':type', ':Country']);
      expect(query.whereNot).toContainEqual(['?x', ':borders', ':France']);
    });

    test('should handle multiple whereNot atoms', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        whereNot: [
          ['rel', ':borders', '?x', ':France'],
          ['rel', ':borders', '?x', ':Germany']
        ],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.whereNot).toHaveLength(2);
      expect(query.whereNot).toContainEqual(['?x', ':borders', ':France']);
      expect(query.whereNot).toContainEqual(['?x', ':borders', ':Germany']);
    });

    test('should not include whereNot if no negated atoms', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.whereNot).toBeUndefined();
    });

    test('should handle empty whereNot array', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        whereNot: [],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.whereNot).toBeUndefined();
    });

    test('should convert whereNot isa atoms correctly', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Entity']],
        whereNot: [['isa', '?x', ':Country']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.whereNot).toContainEqual(['?x', ':type', ':Country']);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty atoms', () => {
      const skeleton = {
        vars: [],
        atoms: [],
        project: [],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual([]);
      expect(query.where).toEqual([]);
    });

    test('should handle skeleton with only type assertions', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [['isa', '?x', ':Country']],
        project: ['?x'],
        force: 'select'
      };

      const query = converter.convert(skeleton);

      expect(query.find).toEqual(['?x']);
      expect(query.where).toEqual([['?x', ':type', ':Country']]);
    });
  });
});
