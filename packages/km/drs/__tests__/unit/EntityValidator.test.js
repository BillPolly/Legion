/**
 * Unit tests for EntityValidator
 */
import { EntityValidator } from '../../src/validators/EntityValidator.js';
import { Entity } from '../../src/types/Entity.js';
import { Mention } from '../../src/types/Mention.js';
import { Span } from '../../src/types/Span.js';

describe('EntityValidator', () => {
  const mentions = [
    new Mention('m1', new Span(0, 5), 'Alice', 'Alice', 'PERSON', 0),
    new Mention('m2', new Span(10, 13), 'she', 'she', 'PERSON', 0),
    new Mention('m3', new Span(20, 23), 'Bob', 'Bob', 'PERSON', 1),
    new Mention('m4', new Span(30, 33), 'cat', 'cat', 'ANIMAL', 2)
  ];

  const allowedTypes = ['PERSON', 'ANIMAL', 'THING'];

  let validator;

  beforeEach(() => {
    validator = new EntityValidator(mentions, allowedTypes);
  });

  describe('valid entities', () => {
    test('should validate correct entities', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1', 'm2'], 'SING', 'FEM'),
        new Entity('x2', 'Bob', 'PERSON', ['m3'], 'SING', 'MASC'),
        new Entity('x3', 'cat', 'ANIMAL', ['m4'], 'SING', 'NEUT')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('disjoint mentions validation', () => {
    test('should reject overlapping mention arrays', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1', 'm2'], 'SING', 'FEM'),
        new Entity('x2', 'Bob', 'PERSON', ['m2', 'm3'], 'SING', 'MASC')  // m2 appears in both
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[1].mentions',
          message: expect.stringContaining('mention m2 already belongs to another entity')
        })
      );
    });

    test('should reject multiple entities with same mention', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM'),
        new Entity('x2', 'Bob', 'PERSON', ['m1'], 'SING', 'MASC')  // m1 appears twice
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mention existence validation', () => {
    test('should reject non-existent mention ID', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1', 'm999'], 'SING', 'FEM')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[0].mentions',
          message: expect.stringContaining('mention m999 does not exist')
        })
      );
    });

    test('should reject entity with no mentions', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', [], 'SING', 'FEM')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[0].mentions',
          message: expect.stringContaining('must have at least one mention')
        })
      );
    });
  });

  describe('type validation', () => {
    test('should reject type not in allowedTypes', () => {
      const entities = [
        new Entity('x1', 'Alice', 'INVALID_TYPE', ['m1'], 'SING', 'FEM')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[0].type',
          message: expect.stringContaining('not in allowed types')
        })
      );
    });
  });

  describe('gender validation', () => {
    test('should reject invalid gender', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'INVALID')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[0].gender',
          message: expect.stringContaining('must be one of')
        })
      );
    });
  });

  describe('number validation', () => {
    test('should reject invalid number', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'INVALID', 'FEM')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities[0].number',
          message: expect.stringContaining('must be one of')
        })
      );
    });
  });

  describe('multiple errors', () => {
    test('should return all validation errors', () => {
      const entities = [
        new Entity('x1', 'Alice', 'INVALID_TYPE', ['m999'], 'INVALID', 'INVALID'),
        new Entity('x2', 'Bob', 'PERSON', [], 'SING', 'MASC')
      ];

      const result = validator.validate(entities);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('empty array', () => {
    test('should validate empty entity array', () => {
      const result = validator.validate([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
