import { Sorts, isValidSort, getSortType } from '../../../src/dsl/Sorts.js';

describe('Sorts', () => {
  describe('Sorts enum', () => {
    test('should define Int sort', () => {
      expect(Sorts.Int).toBe('Int');
    });

    test('should define Bool sort', () => {
      expect(Sorts.Bool).toBe('Bool');
    });

    test('should define Real sort', () => {
      expect(Sorts.Real).toBe('Real');
    });

    test('should have exactly 3 sorts', () => {
      const sortKeys = Object.keys(Sorts);
      expect(sortKeys.length).toBe(3);
      expect(sortKeys).toEqual(['Int', 'Bool', 'Real']);
    });
  });

  describe('isValidSort', () => {
    test('should validate Int', () => {
      expect(isValidSort('Int')).toBe(true);
    });

    test('should validate Bool', () => {
      expect(isValidSort('Bool')).toBe(true);
    });

    test('should validate Real', () => {
      expect(isValidSort('Real')).toBe(true);
    });

    test('should reject invalid sort', () => {
      expect(isValidSort('String')).toBe(false);
    });

    test('should reject null', () => {
      expect(isValidSort(null)).toBe(false);
    });

    test('should reject undefined', () => {
      expect(isValidSort(undefined)).toBe(false);
    });

    test('should reject number', () => {
      expect(isValidSort(123)).toBe(false);
    });

    test('should be case-sensitive', () => {
      expect(isValidSort('int')).toBe(false);
      expect(isValidSort('INT')).toBe(false);
    });
  });

  describe('getSortType', () => {
    test('should return Int for integer values', () => {
      expect(getSortType(42)).toBe(Sorts.Int);
      expect(getSortType(0)).toBe(Sorts.Int);
      expect(getSortType(-10)).toBe(Sorts.Int);
    });

    test('should return Bool for boolean values', () => {
      expect(getSortType(true)).toBe(Sorts.Bool);
      expect(getSortType(false)).toBe(Sorts.Bool);
    });

    test('should return Real for float values', () => {
      expect(getSortType(3.14)).toBe(Sorts.Real);
      expect(getSortType(0.5)).toBe(Sorts.Real);
      expect(getSortType(-2.7)).toBe(Sorts.Real);
    });

    test('should return null for strings', () => {
      expect(getSortType('hello')).toBeNull();
    });

    test('should return null for objects', () => {
      expect(getSortType({})).toBeNull();
    });

    test('should return null for arrays', () => {
      expect(getSortType([])).toBeNull();
    });

    test('should return null for null', () => {
      expect(getSortType(null)).toBeNull();
    });

    test('should return null for undefined', () => {
      expect(getSortType(undefined)).toBeNull();
    });
  });
});
