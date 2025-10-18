/**
 * Unit tests for Stage6_DRSValidation
 * Tests validation rules for ClausalDRS
 */
import { Stage6_DRSValidation } from '../../src/stages/Stage6_DRSValidation.js';
import { ClausalDRS } from '../../src/types/ClausalDRS.js';

describe('Stage6_DRSValidation', () => {
  let stage;

  beforeEach(() => {
    stage = new Stage6_DRSValidation();
  });

  describe('unique referents validation', () => {
    test('should pass with unique referents', () => {
      const drs = new ClausalDRS(
        ['x1', 'x2', 'e1'],
        [{ pred: 'PERSON', args: ['x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should fail with duplicate referents', () => {
      const drs = new ClausalDRS(
        ['x1', 'x1', 'e1'],
        [{ pred: 'PERSON', args: ['x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate referent: x1');
    });
  });

  describe('bound arguments validation', () => {
    test('should pass when all arguments are bound referents', () => {
      const drs = new ClausalDRS(
        ['x1', 'e1'],
        [
          { pred: 'PERSON', args: ['x1'] },
          { pred: 'walk', args: ['e1'] },
          { rel: 'Agent', args: ['e1', 'x1'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should fail when predicate argument is unbound', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [{ pred: 'PERSON', args: ['x999'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unbound argument "x999" in condition');
    });

    test('should fail when relation argument is unbound', () => {
      const drs = new ClausalDRS(
        ['x1', 'e1'],
        [{ rel: 'Agent', args: ['e1', 'x999'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unbound argument "x999" in condition');
    });

    test('should allow box IDs in meta-relations (Not, Imp, Or)', () => {
      const drs = new ClausalDRS(
        ['x1', 'e1'],
        [
          { rel: 'Not', args: ['S1'] },
          { rel: 'Imp', args: ['S1', 'S2'] },
          { rel: 'Or', args: ['S1', 'S2'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('format validation', () => {
    test('should pass with valid predicate format', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [{ pred: 'PERSON', args: ['x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
    });

    test('should pass with valid relation format', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1'],
        [{ rel: 'Agent', args: ['e1', 'x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
    });

    test('should fail with condition missing both pred and rel', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [{ args: ['x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition must have either "pred" or "rel" field');
    });

    test('should fail with condition having both pred and rel', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [{ pred: 'PERSON', rel: 'Agent', args: ['x1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition cannot have both "pred" and "rel" fields');
    });

    test('should fail with condition missing args', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [{ pred: 'PERSON' }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition must have "args" field');
    });
  });

  describe('role arity validation', () => {
    test('should pass when semantic roles have arity 2', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1', 'x2'],
        [
          { rel: 'Agent', args: ['e1', 'x1'] },
          { rel: 'Theme', args: ['e1', 'x2'] },
          { rel: 'Location', args: ['e1', 'x2'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
    });

    test('should fail when semantic role has arity != 2', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1'],
        [{ rel: 'Agent', args: ['e1'] }]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Semantic role "Agent" must have arity 2, got 1');
    });

    test('should allow quantifiers with different arity', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { rel: 'Some', args: ['x1'] },
          { rel: 'Every', args: ['x1'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
    });

    test('should allow meta-relations with different arity', () => {
      const drs = new ClausalDRS(
        [],
        [
          { rel: 'Not', args: ['S1'] },
          { rel: 'Imp', args: ['S1', 'S2'] },
          { rel: 'Or', args: ['S1', 'S2'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
    });
  });

  describe('complete validation', () => {
    test('should pass valid DRS with multiple conditions', () => {
      const drs = new ClausalDRS(
        ['x1', 'x2', 'e1'],
        [
          { pred: 'PERSON', args: ['x1'] },
          { pred: 'THING', args: ['x2'] },
          { pred: 'read', args: ['e1'] },
          { rel: 'Agent', args: ['e1', 'x1'] },
          { rel: 'Theme', args: ['e1', 'x2'] },
          { rel: 'Some', args: ['x2'] }
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should collect all validation errors', () => {
      const drs = new ClausalDRS(
        ['x1', 'x1', 'e1'],  // Duplicate
        [
          { pred: 'PERSON', args: ['x999'] },  // Unbound
          { args: ['x1'] },  // Missing pred/rel
          { rel: 'Agent', args: ['e1'] }  // Wrong arity
        ]
      );

      const result = stage.process(drs);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Duplicate referent: x1');
      expect(result.errors).toContain('Condition must have either "pred" or "rel" field');
      expect(result.errors).toContain('Semantic role "Agent" must have arity 2, got 1');
    });
  });
});
