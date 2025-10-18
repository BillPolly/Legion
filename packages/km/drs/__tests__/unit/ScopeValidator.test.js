/**
 * Unit tests for ScopeValidator
 */
import { ScopeValidator } from '../../src/validators/ScopeValidator.js';
import { ScopePlan } from '../../src/types/ScopePlan.js';

describe('ScopeValidator', () => {
  const entityIds = ['x1', 'x2', 'x3'];
  const eventIds = ['e1', 'e2'];

  let validator;

  beforeEach(() => {
    validator = new ScopeValidator(entityIds, eventIds);
  });

  describe('valid scope plans', () => {
    test('should validate correct scope plan', () => {
      const scopePlan = new ScopePlan(
        ['S0', 'S1'],
        [
          { kind: 'Some', var: 'x1', in: 'S1' },
          { kind: 'Every', var: 'x2', over: 'S1' }
        ],
        {
          events: { e1: 'S1', e2: 'S1' },
          entities: { x1: 'S1', x2: 'S1', x3: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate scope plan with conditional', () => {
      const scopePlan = new ScopePlan(
        ['S0', 'S1', 'S2'],
        [
          { kind: 'If', cond: 'S1', then: 'S2' }
        ],
        {
          events: { e1: 'S1', e2: 'S2' },
          entities: { x1: 'S1', x2: 'S2', x3: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(true);
    });
  });

  describe('box validation', () => {
    test('should reject operator referencing non-existent box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [
          { kind: 'Some', var: 'x1', in: 'S999' }
        ],
        {
          events: {},
          entities: { x1: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ops[0]',
          message: expect.stringContaining('box S999 does not exist')
        })
      );
    });

    test('should reject assignment to non-existent box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [],
        {
          events: {},
          entities: { x1: 'S999' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'assign.entities.x1',
          message: expect.stringContaining('box S999 does not exist')
        })
      );
    });
  });

  describe('variable validation', () => {
    test('should reject operator with invalid variable', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [
          { kind: 'Some', var: 'x999', in: 'S0' }
        ],
        {
          events: {},
          entities: { x999: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ops[0].var',
          message: expect.stringContaining('variable x999 is not a known entity or event ID')
        })
      );
    });
  });

  describe('structural validation', () => {
    test('should reject If operator with invalid condition box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [
          { kind: 'If', cond: 'S999', then: 'S0' }
        ],
        {
          events: {},
          entities: {}
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ops[0]',
          message: expect.stringContaining('box S999 does not exist')
        })
      );
    });

    test('should reject Or operator with invalid left box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [
          { kind: 'Or', left: 'S999', right: 'S0' }
        ],
        {
          events: {},
          entities: {}
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ops[0]',
          message: expect.stringContaining('box S999 does not exist')
        })
      );
    });
  });

  describe('assignment validation', () => {
    test('should reject entity not assigned to any box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [],
        {
          events: {},
          entities: { x1: 'S0' }  // x2 is missing
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'assign.entities',
          message: expect.stringContaining('entity x2 not assigned to any box')
        })
      );
    });

    test('should reject event not assigned to any box', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [],
        {
          events: {},  // e1 is missing
          entities: { x1: 'S0', x2: 'S0', x3: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'assign.events',
          message: expect.stringContaining('event e1 not assigned to any box')
        })
      );
    });

    test('should reject invalid entity in assignment', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [],
        {
          events: { e1: 'S0', e2: 'S0' },
          entities: { x1: 'S0', x2: 'S0', x3: 'S0', x999: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'assign.entities',
          message: expect.stringContaining('x999 is not a known entity ID')
        })
      );
    });
  });

  describe('multiple errors', () => {
    test('should return all validation errors', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [
          { kind: 'Some', var: 'x999', in: 'S888' }
        ],
        {
          events: {},
          entities: { x1: 'S777' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('empty scope plan', () => {
    test('should validate minimal scope plan', () => {
      const scopePlan = new ScopePlan(
        ['S0'],
        [],
        {
          events: { e1: 'S0', e2: 'S0' },
          entities: { x1: 'S0', x2: 'S0', x3: 'S0' }
        }
      );

      const result = validator.validate(scopePlan);
      expect(result.isValid).toBe(true);
    });
  });
});
