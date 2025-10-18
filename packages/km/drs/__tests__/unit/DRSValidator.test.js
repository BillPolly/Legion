/**
 * Unit tests for DRSValidator
 */
import { DRSValidator } from '../../src/validators/DRSValidator.js';
import { ClausalDRS } from '../../src/types/ClausalDRS.js';

describe('DRSValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DRSValidator();
  });

  describe('valid DRS', () => {
    test('should validate correct DRS', () => {
      const drs = new ClausalDRS(
        ['x1', 'x2', 'e1'],
        [
          { pred: 'student', args: ['x1'] },
          { pred: 'book', args: ['x2'] },
          { pred: 'read', args: ['e1'] },
          { rel: 'Agent', args: ['e1', 'x1'] },
          { rel: 'Theme', args: ['e1', 'x2'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate DRS with quantifiers', () => {
      const drs = new ClausalDRS(
        ['x1', 'x2'],
        [
          { pred: 'student', args: ['x1'] },
          { pred: 'book', args: ['x2'] },
          { rel: 'Every', args: ['x1'] },
          { rel: 'Some', args: ['x2'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });
  });

  describe('unique referents validation', () => {
    test('should reject duplicate referents', () => {
      const drs = new ClausalDRS(
        ['x1', 'x2', 'x1'],  // x1 appears twice
        [
          { pred: 'student', args: ['x1'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'referents',
          message: expect.stringContaining('duplicate referent x1')
        })
      );
    });
  });

  describe('bound arguments validation', () => {
    test('should reject unbound argument in predicate', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { pred: 'student', args: ['x999'] }  // x999 not in referents
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'conditions[0].args[0]',
          message: expect.stringContaining('argument x999 not bound')
        })
      );
    });

    test('should reject unbound argument in relation', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1'],
        [
          { rel: 'Agent', args: ['e1', 'x999'] }  // x999 not in referents
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'conditions[0].args[1]',
          message: expect.stringContaining('argument x999 not bound')
        })
      );
    });

    test('should allow box IDs in meta-relations', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { pred: 'student', args: ['x1'] },
          { rel: 'Not', args: ['S1'] }  // S1 is a box ID, not a referent
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });
  });

  describe('role arity validation', () => {
    test('should reject role with arity != 2', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1', 'x2'],
        [
          { rel: 'Agent', args: ['e1'] }  // Only 1 argument
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'conditions[0]',
          message: expect.stringContaining('semantic role Agent must have arity 2')
        })
      );
    });

    test('should allow quantifiers with arity 1', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { pred: 'student', args: ['x1'] },
          { rel: 'Some', args: ['x1'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });
  });

  describe('format validation', () => {
    test('should validate predicate conditions', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { pred: 'student', args: ['x1'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });

    test('should validate relation conditions', () => {
      const drs = new ClausalDRS(
        ['e1', 'x1'],
        [
          { rel: 'Agent', args: ['e1', 'x1'] }
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });

    test('should reject condition without pred or rel', () => {
      const drs = new ClausalDRS(
        ['x1'],
        [
          { args: ['x1'] }  // Missing both pred and rel
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'conditions[0]',
          message: expect.stringContaining('must have either pred or rel')
        })
      );
    });
  });

  describe('multiple errors', () => {
    test('should return all validation errors', () => {
      const drs = new ClausalDRS(
        ['x1', 'x1'],  // Duplicate
        [
          { pred: 'student', args: ['x999'] },  // Unbound
          { rel: 'Agent', args: ['e1'] }  // Wrong arity and unbound
        ]
      );

      const result = validator.validate(drs);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('empty DRS', () => {
    test('should validate empty DRS', () => {
      const drs = new ClausalDRS([], []);

      const result = validator.validate(drs);
      expect(result.isValid).toBe(true);
    });
  });
});
