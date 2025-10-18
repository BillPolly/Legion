/**
 * Unit tests for Stage4_ScopePlanning
 * Uses MOCKED LLM responses
 */
import { Stage4_ScopePlanning } from '../../src/stages/Stage4_ScopePlanning.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';
import { Entity } from '../../src/types/Entity.js';
import { Event } from '../../src/types/Event.js';

describe('Stage4_ScopePlanning', () => {
  let stage;
  let mockLLMClient;
  let llmResponses;

  beforeEach(() => {
    // Reset response queue
    llmResponses = [];

    // Mock LLM client - manual mock compatible with ES6 modules
    const completeCalls = [];
    mockLLMClient = {
      complete: async (prompt, maxTokens) => {
        completeCalls.push({ prompt, maxTokens });
        // Pop from response queue (returns JSON string)
        const response = llmResponses.shift();
        return JSON.stringify(response);
      },
      _calls: completeCalls
    };

    stage = new Stage4_ScopePlanning(mockLLMClient);
  });

  describe('process with valid LLM output', () => {
    test('should create scope plan for simple indefinite', async () => {
      const text = 'Alice read a book.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, { Agent: 'x1', Theme: 'x2' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice read a book.'],
        [],
        entities,
        events,
        [], []
      );

      // Mock LLM to return valid scope plan
      llmResponses.push({
        boxes: ['S0', 'S1'],
        ops: [
          { kind: 'Some', var: 'x2', in: 'S1' }
        ],
        assign: {
          entities: { x1: 'S0', x2: 'S1' },
          events: { e1: 'S0' }
        }
      });

      const scopePlan = await stage.process(memory);

      // Verify LLM was called once (no repair needed)
      expect(mockLLMClient._calls).toHaveLength(1);

      // Verify scope plan structure
      expect(scopePlan.boxes).toEqual(['S0', 'S1']);
      expect(scopePlan.ops).toHaveLength(1);
      expect(scopePlan.ops[0].kind).toBe('Some');
      expect(scopePlan.ops[0].var).toBe('x2');
      expect(scopePlan.ops[0].in).toBe('S1');
      expect(scopePlan.assign.entities).toEqual({ x1: 'S0', x2: 'S1' });
      expect(scopePlan.assign.events).toEqual({ e1: 'S0' });
    });

    test('should handle universal quantifier', async () => {
      const text = 'Every student read a book.';
      const entities = [
        new Entity('x1', 'student', 'PERSON', ['m1'], 'PLUR', 'UNKNOWN', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, { Agent: 'x1', Theme: 'x2' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Every student read a book.'],
        [],
        entities,
        events,
        [], []
      );

      llmResponses.push({
        boxes: ['S0', 'S1', 'S2'],
        ops: [
          { kind: 'Every', var: 'x1', over: 'S1' },
          { kind: 'Some', var: 'x2', in: 'S2' }
        ],
        assign: {
          entities: { x1: 'S1', x2: 'S2' },
          events: { e1: 'S1' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(scopePlan.boxes).toEqual(['S0', 'S1', 'S2']);
      expect(scopePlan.ops).toHaveLength(2);
      expect(scopePlan.ops[0].kind).toBe('Every');
      expect(scopePlan.ops[1].kind).toBe('Some');
    });

    test('should handle negation', async () => {
      const text = 'Alice did not read the book.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, true, { Agent: 'x1', Theme: 'x2' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice did not read the book.'],
        [],
        entities,
        events,
        [], []
      );

      llmResponses.push({
        boxes: ['S0', 'S1'],
        ops: [
          { kind: 'Not', box: 'S1' }
        ],
        assign: {
          entities: { x1: 'S0', x2: 'S0' },
          events: { e1: 'S1' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(scopePlan.ops).toHaveLength(1);
      expect(scopePlan.ops[0].kind).toBe('Not');
      expect(scopePlan.ops[0].box).toBe('S1');
    });

    test('should handle conditional', async () => {
      const text = 'If it rains, Alice stays home.';
      const entities = [
        new Entity('x1', 'it', 'THING', ['m1'], 'SING', 'NEUT', null),
        new Entity('x2', 'Alice', 'PERSON', ['m2'], 'SING', 'FEM', null),
        new Entity('x3', 'home', 'LOCATION', ['m3'], 'SING', 'NEUT', null)
      ];
      const rainSynset = { synonyms: ['rain'], definition: 'precipitate water' };
      const staySynset = { synonyms: ['stay'], definition: 'remain' };
      const events = [
        new Event('e1', rainSynset, 'PRESENT', 'NONE', null, false, { Theme: 'x1' }),
        new Event('e2', staySynset, 'PRESENT', 'NONE', null, false, { Agent: 'x2', Location: 'x3' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['If it rains, Alice stays home.'],
        [],
        entities,
        events,
        [], []
      );

      llmResponses.push({
        boxes: ['S0', 'S1', 'S2'],
        ops: [
          { kind: 'If', cond: 'S1', then: 'S2' }
        ],
        assign: {
          entities: { x1: 'S1', x2: 'S2', x3: 'S2' },
          events: { e1: 'S1', e2: 'S2' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(scopePlan.ops).toHaveLength(1);
      expect(scopePlan.ops[0].kind).toBe('If');
      expect(scopePlan.ops[0].cond).toBe('S1');
      expect(scopePlan.ops[0].then).toBe('S2');
    });
  });

  describe('validation failure handling', () => {
    test('should attempt repair when box reference is invalid', async () => {
      const text = 'Alice reads.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice reads.'],
        [],
        entities,
        events,
        [], []
      );

      // First call: invalid box reference
      llmResponses.push({
        boxes: ['S0'],
        ops: [
          { kind: 'Some', var: 'x1', in: 'S999' }  // Invalid: box doesn't exist
        ],
        assign: {
          entities: { x1: 'S0' },
          events: { e1: 'S0' }
        }
      });

      // Second call: valid (after repair)
      llmResponses.push({
        boxes: ['S0', 'S1'],
        ops: [
          { kind: 'Some', var: 'x1', in: 'S1' }
        ],
        assign: {
          entities: { x1: 'S1' },
          events: { e1: 'S0' }
        }
      });

      const scopePlan = await stage.process(memory);

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);

      // Verify final result is valid
      expect(scopePlan.ops[0].in).toBe('S1');
    });

    test('should fail after one repair attempt', async () => {
      const text = 'Alice reads.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice reads.'],
        [],
        entities,
        events,
        [], []
      );

      // Both calls return invalid box references
      llmResponses.push({
        boxes: ['S0'],
        ops: [
          { kind: 'Some', var: 'x1', in: 'S999' }
        ],
        assign: {
          entities: { x1: 'S0' },
          events: { e1: 'S0' }
        }
      });

      llmResponses.push({
        boxes: ['S0'],
        ops: [
          { kind: 'Some', var: 'x1', in: 'S999' }  // Still invalid
        ],
        assign: {
          entities: { x1: 'S0' },
          events: { e1: 'S0' }
        }
      });

      await expect(stage.process(memory)).rejects.toThrow();

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);
    });

    test('should validate all entities are assigned', async () => {
      const text = 'Alice and Bob walk.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'Bob', 'PERSON', ['m2'], 'SING', 'MASC', null)
      ];
      const walkSynset = { synonyms: ['walk'], definition: 'move on foot' };
      const events = [
        new Event('e1', walkSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice and Bob walk.'],
        [],
        entities,
        events,
        [], []
      );

      // First call: missing entity assignment
      llmResponses.push({
        boxes: ['S0'],
        ops: [],
        assign: {
          entities: { x1: 'S0' },  // Missing x2
          events: { e1: 'S0' }
        }
      });

      // Second call: all entities assigned
      llmResponses.push({
        boxes: ['S0'],
        ops: [],
        assign: {
          entities: { x1: 'S0', x2: 'S0' },
          events: { e1: 'S0' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(Object.keys(scopePlan.assign.entities)).toHaveLength(2);
    });

    test('should validate var references are entity IDs', async () => {
      const text = 'Alice reads.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice reads.'],
        [],
        entities,
        events,
        [], []
      );

      // First call: invalid var reference
      llmResponses.push({
        boxes: ['S0', 'S1'],
        ops: [
          { kind: 'Some', var: 'x999', in: 'S1' }  // Invalid: entity doesn't exist
        ],
        assign: {
          entities: { x1: 'S0' },
          events: { e1: 'S0' }
        }
      });

      // Second call: valid
      llmResponses.push({
        boxes: ['S0', 'S1'],
        ops: [
          { kind: 'Some', var: 'x1', in: 'S1' }
        ],
        assign: {
          entities: { x1: 'S1' },
          events: { e1: 'S0' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(scopePlan.ops[0].var).toBe('x1');
    });
  });

  describe('edge cases', () => {
    test('should handle text with no quantifiers', async () => {
      const text = 'Alice walks.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const walkSynset = { synonyms: ['walk'], definition: 'move on foot' };
      const events = [
        new Event('e1', walkSynset, 'PRESENT', 'NONE', null, false, { Agent: 'x1' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice walks.'],
        [],
        entities,
        events,
        [], []
      );

      llmResponses.push({
        boxes: ['S0'],
        ops: [],
        assign: {
          entities: { x1: 'S0' },
          events: { e1: 'S0' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(scopePlan.boxes).toEqual(['S0']);
      expect(scopePlan.ops).toEqual([]);
    });

    test('should handle multiple operators', async () => {
      const text = 'Every student read some book.';
      const entities = [
        new Entity('x1', 'student', 'PERSON', ['m1'], 'PLUR', 'UNKNOWN', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'PLUR', 'NEUT', null)
      ];
      const readSynset = { synonyms: ['read'], definition: 'interpret' };
      const events = [
        new Event('e1', readSynset, 'PAST', 'NONE', null, false, { Agent: 'x1', Theme: 'x2' })
      ];
      const memory = new DiscourseMemory(
        text,
        ['Every student read some book.'],
        [],
        entities,
        events,
        [], []
      );

      llmResponses.push({
        boxes: ['S0', 'S1', 'S2'],
        ops: [
          { kind: 'Every', var: 'x1', over: 'S1' },
          { kind: 'Some', var: 'x2', in: 'S2' }
        ],
        assign: {
          entities: { x1: 'S1', x2: 'S2' },
          events: { e1: 'S1' }
        }
      });

      const scopePlan = await stage.process(memory);

      expect(scopePlan.ops).toHaveLength(2);
    });
  });
});
