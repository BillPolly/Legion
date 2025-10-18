/**
 * Unit tests for Stage5_DRSBuilder
 * Deterministic (NO LLM) - tests pure algorithmic translation
 */
import { Stage5_DRSBuilder } from '../../src/stages/Stage5_DRSBuilder.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';
import { Entity } from '../../src/types/Entity.js';
import { Event } from '../../src/types/Event.js';
import { ScopePlan } from '../../src/types/ScopePlan.js';

describe('Stage5_DRSBuilder', () => {
  let stage;

  beforeEach(() => {
    stage = new Stage5_DRSBuilder();
  });

  describe('referent collection', () => {
    test('should collect all entity and event referents', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {})
      ];
      const memory = new DiscourseMemory(
        'Alice read a book.',
        ['Alice read a book.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      expect(drs.referents).toContain('x1');
      expect(drs.referents).toContain('x2');
      expect(drs.referents).toContain('e1');
      expect(drs.referents).toHaveLength(3);
    });
  });

  describe('type predicates', () => {
    test('should add type predicates for all entities', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        'Alice read a book.',
        ['Alice read a book.'],
        [],
        entities,
        [],
        [],
        []
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      const personPred = drs.conditions.find(c => c.pred === 'PERSON');
      const thingPred = drs.conditions.find(c => c.pred === 'THING');

      expect(personPred).toBeTruthy();
      expect(personPred.args).toEqual(['x1']);
      expect(thingPred).toBeTruthy();
      expect(thingPred.args).toEqual(['x2']);
    });
  });

  describe('attribute predicates', () => {
    test('should add attribute predicates from unaryFacts', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const unaryFacts = [
        { pred: 'tall', args: ['x1'] },
        { pred: 'smart', args: ['x1'] }
      ];
      const memory = new DiscourseMemory(
        'Alice is tall and smart.',
        ['Alice is tall and smart.'],
        [],
        entities,
        [],
        unaryFacts,
        []
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      const tallPred = drs.conditions.find(c => c.pred === 'tall');
      const smartPred = drs.conditions.find(c => c.pred === 'smart');

      expect(tallPred).toBeTruthy();
      expect(tallPred.args).toEqual(['x1']);
      expect(smartPred).toBeTruthy();
      expect(smartPred.args).toEqual(['x1']);
    });
  });

  describe('event predicates', () => {
    test('should add event predicates for all events', () => {
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const writeSynset = { synonyms: ['write'], definition: 'record' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {}),
        new Event('e2', writeSynset, 'PRESENT', 'NONE', null, false, {})
      ];
      const memory = new DiscourseMemory(
        'Alice read and wrote.',
        ['Alice read and wrote.'],
        [],
        [],
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      const readPred = drs.conditions.find(c => c.pred === 'read');
      const writePred = drs.conditions.find(c => c.pred === 'write');

      expect(readPred).toBeTruthy();
      expect(readPred.args).toEqual(['e1']);
      expect(writePred).toBeTruthy();
      expect(writePred.args).toEqual(['e2']);
    });
  });

  describe('role relations', () => {
    test('should add role relations from event roles', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x1',
          Theme: 'x2'
        })
      ];
      const memory = new DiscourseMemory(
        'Alice read a book.',
        ['Alice read a book.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      const agentRel = drs.conditions.find(c => c.rel === 'Agent');
      const themeRel = drs.conditions.find(c => c.rel === 'Theme');

      expect(agentRel).toBeTruthy();
      expect(agentRel.args).toEqual(['e1', 'x1']);
      expect(themeRel).toBeTruthy();
      expect(themeRel.args).toEqual(['e1', 'x2']);
    });
  });

  describe('binary relations', () => {
    test('should add binary relations from binaryFacts', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'Bob', 'PERSON', ['m2'], 'SING', 'MASC', null)
      ];
      const binaryFacts = [
        { pred: 'loves', args: ['x1', 'x2'] },
        { pred: 'knows', args: ['x2', 'x1'] }
      ];
      const memory = new DiscourseMemory(
        'Alice loves Bob. Bob knows Alice.',
        ['Alice loves Bob.', 'Bob knows Alice.'],
        [],
        entities,
        [],
        [],
        binaryFacts
      );
      const scopePlan = new ScopePlan(['S0'], [], { entities: {}, events: {} });

      const drs = stage.process(memory, scopePlan);

      const lovesRel = drs.conditions.find(c => c.rel === 'loves');
      const knowsRel = drs.conditions.find(c => c.rel === 'knows');

      expect(lovesRel).toBeTruthy();
      expect(lovesRel.args).toEqual(['x1', 'x2']);
      expect(knowsRel).toBeTruthy();
      expect(knowsRel.args).toEqual(['x2', 'x1']);
    });
  });

  describe('scope operator translation', () => {
    test('should translate Some operator', () => {
      const entities = [
        new Entity('x1', 'book', 'THING', ['m1'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        'A book exists.',
        ['A book exists.'],
        [],
        entities,
        [],
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1'],
        [{ kind: 'Some', var: 'x1', in: 'S1' }],
        { entities: { x1: 'S1' }, events: {} }
      );

      const drs = stage.process(memory, scopePlan);

      const someRel = drs.conditions.find(c => c.rel === 'Some');
      expect(someRel).toBeTruthy();
      expect(someRel.args).toEqual(['x1']);
    });

    test('should translate Every operator', () => {
      const entities = [
        new Entity('x1', 'student', 'PERSON', ['m1'], 'PLUR', 'UNKNOWN', null)
      ];
      const memory = new DiscourseMemory(
        'Every student studies.',
        ['Every student studies.'],
        [],
        entities,
        [],
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1'],
        [{ kind: 'Every', var: 'x1', over: 'S1' }],
        { entities: { x1: 'S1' }, events: {} }
      );

      const drs = stage.process(memory, scopePlan);

      const everyRel = drs.conditions.find(c => c.rel === 'Every');
      expect(everyRel).toBeTruthy();
      expect(everyRel.args).toEqual(['x1']);
    });

    test('should translate Not operator', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const sleepSynset = { synonyms: ['sleep'], definition: 'rest' };
      const events = [
        new Event('e1', sleepSynset, 'PRESENT', 'NONE', null, true, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        'Alice does not sleep.',
        ['Alice does not sleep.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1'],
        [{ kind: 'Not', box: 'S1' }],
        { entities: { x1: 'S0' }, events: { e1: 'S1' } }
      );

      const drs = stage.process(memory, scopePlan);

      const notRel = drs.conditions.find(c => c.rel === 'Not');
      expect(notRel).toBeTruthy();
      expect(notRel.args).toEqual(['S1']);
    });

    test('should translate If operator', () => {
      const entities = [
        new Entity('x1', 'it', 'THING', ['m1'], 'SING', 'NEUT', null)
      ];
      const rainSynset = { synonyms: ['rain'], definition: 'precipitate water' };
      const staySynset = { synonyms: ['stay'], definition: 'remain' };
      const events = [
        new Event('e1', rainSynset, 'PRESENT', 'NONE', null, false, { Theme: 'x1' }),
        new Event('e2', staySynset, 'PRESENT', 'NONE', null, false, {})
      ];
      const memory = new DiscourseMemory(
        'If it rains, I stay home.',
        ['If it rains, I stay home.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1', 'S2'],
        [{ kind: 'If', cond: 'S1', then: 'S2' }],
        { entities: { x1: 'S1' }, events: { e1: 'S1', e2: 'S2' } }
      );

      const drs = stage.process(memory, scopePlan);

      const ifRel = drs.conditions.find(c => c.rel === 'Imp');
      expect(ifRel).toBeTruthy();
      expect(ifRel.args).toEqual(['S1', 'S2']);
    });

    test('should translate Or operator', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const staySynset = { synonyms: ['stay'], definition: 'remain' };
      const goSynset = { synonyms: ['go'], definition: 'move' };
      const events = [
        new Event('e1', staySynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' }),
        new Event('e2', goSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        'Alice stays or goes.',
        ['Alice stays or goes.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1', 'S2'],
        [{ kind: 'Or', left: 'S1', right: 'S2' }],
        { entities: { x1: 'S0' }, events: { e1: 'S1', e2: 'S2' } }
      );

      const drs = stage.process(memory, scopePlan);

      const orRel = drs.conditions.find(c => c.rel === 'Or');
      expect(orRel).toBeTruthy();
      expect(orRel.args).toEqual(['S1', 'S2']);
    });
  });

  describe('complete DRS building', () => {
    test('should build complete DRS for simple sentence', () => {
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x1',
          Theme: 'x2'
        })
      ];
      const memory = new DiscourseMemory(
        'Alice read a book.',
        ['Alice read a book.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1'],
        [{ kind: 'Some', var: 'x2', in: 'S1' }],
        { entities: { x1: 'S0', x2: 'S1' }, events: { e1: 'S0' } }
      );

      const drs = stage.process(memory, scopePlan);

      // Verify referents
      expect(drs.referents).toEqual(['x1', 'x2', 'e1']);

      // Verify conditions include all expected types
      const personPred = drs.conditions.find(c => c.pred === 'PERSON');
      const thingPred = drs.conditions.find(c => c.pred === 'THING');
      const readPred = drs.conditions.find(c => c.pred === 'read');
      const agentRel = drs.conditions.find(c => c.rel === 'Agent');
      const themeRel = drs.conditions.find(c => c.rel === 'Theme');
      const someRel = drs.conditions.find(c => c.rel === 'Some');

      expect(personPred).toBeTruthy();
      expect(thingPred).toBeTruthy();
      expect(readPred).toBeTruthy();
      expect(agentRel).toBeTruthy();
      expect(themeRel).toBeTruthy();
      expect(someRel).toBeTruthy();
    });

    test('should build complete DRS with universal quantifier', () => {
      const entities = [
        new Entity('x1', 'student', 'PERSON', ['m1'], 'PLUR', 'UNKNOWN', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, {
          Agent: 'x1',
          Theme: 'x2'
        })
      ];
      const memory = new DiscourseMemory(
        'Every student read a book.',
        ['Every student read a book.'],
        [],
        entities,
        events,
        [],
        []
      );
      const scopePlan = new ScopePlan(
        ['S0', 'S1', 'S2'],
        [
          { kind: 'Every', var: 'x1', over: 'S1' },
          { kind: 'Some', var: 'x2', in: 'S2' }
        ],
        { entities: { x1: 'S1', x2: 'S2' }, events: { e1: 'S1' } }
      );

      const drs = stage.process(memory, scopePlan);

      // Verify both quantifiers
      const everyRel = drs.conditions.find(c => c.rel === 'Every');
      const someRel = drs.conditions.find(c => c.rel === 'Some');

      expect(everyRel).toBeTruthy();
      expect(everyRel.args).toEqual(['x1']);
      expect(someRel).toBeTruthy();
      expect(someRel.args).toEqual(['x2']);
    });
  });
});
