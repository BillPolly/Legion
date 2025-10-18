/**
 * Unit tests for core DRS types
 */
import { Span } from '../../src/types/Span.js';
import { Mention } from '../../src/types/Mention.js';
import { Entity } from '../../src/types/Entity.js';
import { Event } from '../../src/types/Event.js';
import { UnaryFact } from '../../src/types/UnaryFact.js';
import { BinaryFact } from '../../src/types/BinaryFact.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';
import { ScopePlan } from '../../src/types/ScopePlan.js';
import { ClausalDRS } from '../../src/types/ClausalDRS.js';
import { RelationInventory } from '../../src/types/RelationInventory.js';

describe('Core DRS Types', () => {
  describe('Span', () => {
    test('should create a Span with start and end', () => {
      const span = new Span(0, 5);
      expect(span.start).toBe(0);
      expect(span.end).toBe(5);
    });
  });

  describe('Mention', () => {
    test('should create a Mention with all properties', () => {
      const span = new Span(0, 7);
      const mention = new Mention('m1', span, 'The cat', 'cat', 'ANIMAL', 0);

      expect(mention.id).toBe('m1');
      expect(mention.span).toBe(span);
      expect(mention.text).toBe('The cat');
      expect(mention.head).toBe('cat');
      expect(mention.coarseType).toBe('ANIMAL');
      expect(mention.sentenceId).toBe(0);
    });
  });

  describe('Entity', () => {
    test('should create an Entity with required properties', () => {
      const entity = new Entity('x1', 'Alice', 'PERSON', ['m1', 'm2'], 'SING', 'FEM');

      expect(entity.id).toBe('x1');
      expect(entity.canonical).toBe('Alice');
      expect(entity.type).toBe('PERSON');
      expect(entity.mentions).toEqual(['m1', 'm2']);
      expect(entity.number).toBe('SING');
      expect(entity.gender).toBe('FEM');
      expect(entity.kbId).toBeNull();
    });

    test('should create an Entity with optional kbId', () => {
      const entity = new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', 'wn:person.n.01');
      expect(entity.kbId).toBe('wn:person.n.01');
    });
  });

  describe('Event', () => {
    test('should create an Event with all properties', () => {
      // Create synset object for "read"
      const readSynset = { synonyms: ['read'], definition: 'interpret' };

      const event = new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
        Agent: 'x1',
        Theme: 'x2'
      });

      expect(event.id).toBe('e1');
      expect(event.lemma).toBe('read');
      expect(event.tense).toBe('PAST');
      expect(event.aspect).toBe('NONE');
      expect(event.modal).toBeNull();
      expect(event.neg).toBe(false);
      expect(event.roles).toEqual({ Agent: 'x1', Theme: 'x2' });
    });

    test('should create an Event with modal and negation', () => {
      // Create synset object for "go"
      const goSynset = { synonyms: ['go'], definition: 'move' };

      const event = new Event('e2', goSynset, 'PRESENT', 'PROGRESSIVE', 'must', true, {
        Agent: 'x1'
      });

      expect(event.modal).toBe('must');
      expect(event.neg).toBe(true);
    });
  });

  describe('UnaryFact', () => {
    test('should create a UnaryFact', () => {
      // Create synset object for "student"
      const studentSynset = { synonyms: ['student'], definition: 'a learner' };

      const fact = new UnaryFact(studentSynset, ['x1']);

      expect(fact.pred).toBe('student');
      expect(fact.args).toEqual(['x1']);
    });
  });

  describe('BinaryFact', () => {
    test('should create a BinaryFact', () => {
      // Create synset object for "in"
      const inSynset = { synonyms: ['in'], definition: 'inside' };

      const fact = new BinaryFact(inSynset, ['x1', 'x2']);

      expect(fact.pred).toBe('in');
      expect(fact.args).toEqual(['x1', 'x2']);
    });
  });

  describe('DiscourseMemory', () => {
    test('should create a DiscourseMemory with defaults', () => {
      const memory = new DiscourseMemory('The cat sat.', ['The cat sat.']);

      expect(memory.text).toBe('The cat sat.');
      expect(memory.sentences).toEqual(['The cat sat.']);
      expect(memory.mentions).toEqual([]);
      expect(memory.entities).toEqual([]);
      expect(memory.events).toEqual([]);
      expect(memory.unaryFacts).toEqual([]);
      expect(memory.binaryFacts).toEqual([]);
    });

    test('should create a DiscourseMemory with all properties', () => {
      const mention = new Mention('m1', new Span(0, 7), 'The cat', 'cat', 'ANIMAL', 0);
      const entity = new Entity('x1', 'cat', 'ANIMAL', ['m1'], 'SING', 'NEUT');

      // Create synset objects
      const sitSynset = { synonyms: ['sit'], definition: 'be seated' };
      const catSynset = { synonyms: ['cat'], definition: 'feline' };
      const onSynset = { synonyms: ['on'], definition: 'positioned on top of' };

      const event = new Event('e1', sitSynset, 'PAST', 'NONE', null, false, { Agent: 'x1' });
      const unaryFact = new UnaryFact(catSynset, ['x1']);
      const binaryFact = new BinaryFact(onSynset, ['x1', 'x2']);

      const memory = new DiscourseMemory(
        'The cat sat.',
        ['The cat sat.'],
        [mention],
        [entity],
        [event],
        [unaryFact],
        [binaryFact]
      );

      expect(memory.mentions).toHaveLength(1);
      expect(memory.entities).toHaveLength(1);
      expect(memory.events).toHaveLength(1);
      expect(memory.unaryFacts).toHaveLength(1);
      expect(memory.binaryFacts).toHaveLength(1);
    });
  });

  describe('ScopePlan', () => {
    test('should create a ScopePlan', () => {
      const plan = new ScopePlan(
        ['S0', 'S1'],
        [
          { kind: 'Every', var: 'x1', over: 'S1' },
          { kind: 'Some', var: 'x2', in: 'S1' }
        ],
        {
          events: { e1: 'S1' },
          entities: { x1: 'S1', x2: 'S1' }
        }
      );

      expect(plan.boxes).toEqual(['S0', 'S1']);
      expect(plan.ops).toHaveLength(2);
      expect(plan.ops[0].kind).toBe('Every');
      expect(plan.assign.events).toEqual({ e1: 'S1' });
    });
  });

  describe('ClausalDRS', () => {
    test('should create a ClausalDRS', () => {
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

      expect(drs.referents).toEqual(['x1', 'x2', 'e1']);
      expect(drs.conditions).toHaveLength(5);
      expect(drs.conditions[0].pred).toBe('student');
      expect(drs.conditions[3].rel).toBe('Agent');
    });
  });

  describe('RelationInventory', () => {
    test('should create a RelationInventory', () => {
      // Create synset objects
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

      expect(inventory.unaryPredicates).toHaveLength(3);
      expect(inventory.roles).toHaveLength(3);
      expect(inventory.binaryRelations).toHaveLength(3);
      expect(inventory.unaryPredicates[0]).toEqual(studentSynset);
      expect(inventory.roles[0]).toEqual(agentRole);
    });
  });
});
