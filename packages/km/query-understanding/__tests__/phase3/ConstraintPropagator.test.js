/**
 * Unit tests for ConstraintPropagator
 */

import { ConstraintPropagator } from '../../src/phase3/ConstraintPropagator.js';

describe('ConstraintPropagator', () => {
  let propagator;

  beforeEach(() => {
    propagator = new ConstraintPropagator();
  });

  describe('Duplicate Removal', () => {
    test('should remove duplicate atoms', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?x', ':Country'],  // Duplicate
          ['rel', ':borders', '?x', ':Germany']
        ],
        project: ['?x'],
        order: [],
        limit: null,
        force: 'select',
        notes: []
      };

      const result = propagator.propagate(skeleton);

      expect(result.atoms).toHaveLength(2);
      expect(result.atoms).toContainEqual(['isa', '?x', ':Country']);
      expect(result.atoms).toContainEqual(['rel', ':borders', '?x', ':Germany']);
    });

    test('should preserve unique atoms', () => {
      const skeleton = {
        vars: ['?x', '?y'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?y', ':City'],
          ['rel', ':capital', '?x', '?y']
        ],
        project: ['?x', '?y'],
        order: [],
        limit: null,
        force: 'select',
        notes: []
      };

      const result = propagator.propagate(skeleton);

      expect(result.atoms).toHaveLength(3);
      expect(result.atoms).toContainEqual(['isa', '?x', ':Country']);
      expect(result.atoms).toContainEqual(['isa', '?y', ':City']);
      expect(result.atoms).toContainEqual(['rel', ':capital', '?x', '?y']);
    });

    test('should not mutate original skeleton', () => {
      const skeleton = {
        vars: ['?x'],
        atoms: [
          ['isa', '?x', ':Country'],
          ['isa', '?x', ':Country']
        ],
        project: ['?x'],
        order: [],
        limit: null,
        force: 'select',
        notes: []
      };

      const originalAtomsLength = skeleton.atoms.length;
      propagator.propagate(skeleton);

      expect(skeleton.atoms).toHaveLength(originalAtomsLength);
    });
  });
});
