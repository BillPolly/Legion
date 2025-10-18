/**
 * Unit tests for EventValidator
 */
import { EventValidator } from '../../src/validators/EventValidator.js';
import { Event } from '../../src/types/Event.js';
import { UnaryFact } from '../../src/types/UnaryFact.js';
import { BinaryFact } from '../../src/types/BinaryFact.js';
import { RelationInventory } from '../../src/types/RelationInventory.js';

describe('EventValidator', () => {
  const entityIds = ['x1', 'x2', 'x3'];

  // Create synset objects for inventory
  const studentSynset = { synonyms: ['student'], definition: 'a learner' };
  const bookSynset = { synonyms: ['book'], definition: 'written work' };
  const heavySynset = { synonyms: ['heavy'], definition: 'of great weight' };
  const agentRole = { label: 'Agent' };
  const themeRole = { label: 'Theme' };
  const patientRole = { label: 'Patient' };
  const inRel = { synonyms: ['in'], definition: 'inside' };
  const onRel = { synonyms: ['on'], definition: 'positioned on top' };
  const beforeRel = { synonyms: ['before'], definition: 'earlier than' };

  const inventory = new RelationInventory(
    [studentSynset, bookSynset, heavySynset],
    [agentRole, themeRole, patientRole],
    [inRel, onRel, beforeRel]
  );

  let validator;

  beforeEach(() => {
    validator = new EventValidator(entityIds, inventory);
  });

  describe('valid data', () => {
    test('should validate correct events and facts', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x1',
          Theme: 'x2'
        })
      ];
      const unaryFacts = [
        new UnaryFact(studentSynset, ['x1']),
        new UnaryFact(bookSynset, ['x2'])
      ];
      const binaryFacts = [
        new BinaryFact(onRel, ['x2', 'x3'])
      ];

      const result = validator.validate(events, unaryFacts, binaryFacts);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('event validation', () => {
    test('should reject duplicate event IDs', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const writeSynset = { synonyms: ['write'], definition: 'record' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, { Agent: 'x1' }),
        new Event('e1', writeSynset, 'PAST', 'NONE', null, false, { Agent: 'x2' })
      ];

      const result = validator.validate(events, [], []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'events[1].id',
          message: expect.stringContaining('duplicate event ID e1')
        })
      );
    });

    test('should reject invalid role name', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x1',
          InvalidRole: 'x2'
        })
      ];

      const result = validator.validate(events, [], []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'events[0].roles',
          message: expect.stringContaining('role InvalidRole not in inventory')
        })
      );
    });

    test('should reject invalid role target', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x999'
        })
      ];

      const result = validator.validate(events, [], []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'events[0].roles.Agent',
          message: expect.stringContaining('target x999 is not a known entity ID')
        })
      );
    });

    test('should allow role target that is an event ID', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const wantSynset = { synonyms: ['want'], definition: 'desire' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, { Agent: 'x1' }),
        new Event('e2', wantSynset, 'PAST', 'NONE', null, false, { Agent: 'x1', Theme: 'e1' })
      ];

      const result = validator.validate(events, [], []);
      expect(result.isValid).toBe(true);
    });
  });

  describe('unary fact validation', () => {
    test('should reject invalid predicate', () => {
      const invalidSynset = { synonyms: ['invalid_pred'], definition: 'not valid' };

      const unaryFacts = [
        new UnaryFact(invalidSynset, ['x1'])
      ];

      const result = validator.validate([], unaryFacts, []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'unaryFacts[0].pred',
          message: expect.stringContaining('not in inventory')
        })
      );
    });

    test('should reject arity not equal to 1', () => {
      const unaryFacts = [
        new UnaryFact(studentSynset, ['x1', 'x2'])
      ];

      const result = validator.validate([], unaryFacts, []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'unaryFacts[0].args',
          message: expect.stringContaining('must have exactly 1 argument')
        })
      );
    });

    test('should reject invalid argument', () => {
      const unaryFacts = [
        new UnaryFact(studentSynset, ['x999'])
      ];

      const result = validator.validate([], unaryFacts, []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'unaryFacts[0].args[0]',
          message: expect.stringContaining('not a valid referent')
        })
      );
    });
  });

  describe('binary fact validation', () => {
    test('should reject invalid relation', () => {
      const invalidRel = { synonyms: ['invalid_rel'], definition: 'not valid' };

      const binaryFacts = [
        new BinaryFact(invalidRel, ['x1', 'x2'])
      ];

      const result = validator.validate([], [], binaryFacts);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'binaryFacts[0].pred',
          message: expect.stringContaining('not in inventory')
        })
      );
    });

    test('should reject arity not equal to 2', () => {
      const binaryFacts = [
        new BinaryFact(inRel, ['x1'])
      ];

      const result = validator.validate([], [], binaryFacts);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'binaryFacts[0].args',
          message: expect.stringContaining('must have exactly 2 arguments')
        })
      );
    });

    test('should reject invalid arguments', () => {
      const binaryFacts = [
        new BinaryFact(inRel, ['x1', 'x999'])
      ];

      const result = validator.validate([], [], binaryFacts);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'binaryFacts[0].args[1]',
          message: expect.stringContaining('not a valid referent')
        })
      );
    });
  });

  describe('multiple errors', () => {
    test('should return all validation errors', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const invalidPredSynset = { synonyms: ['invalid'], definition: 'not valid' };
      const invalidRelSynset = { synonyms: ['invalid'], definition: 'not valid' };

      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          InvalidRole: 'x999'
        })
      ];
      const unaryFacts = [
        new UnaryFact(invalidPredSynset, ['x888'])
      ];
      const binaryFacts = [
        new BinaryFact(invalidRelSynset, ['x1'])
      ];

      const result = validator.validate(events, unaryFacts, binaryFacts);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(4);
    });
  });

  describe('empty arrays', () => {
    test('should validate empty arrays', () => {
      const result = validator.validate([], [], []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
