/**
 * Unit tests for Stage3_EventExtraction
 * Uses MOCKED LLM responses
 */
import { Stage3_EventExtraction } from '../../src/stages/Stage3_EventExtraction.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';
import { Entity } from '../../src/types/Entity.js';

describe('Stage3_EventExtraction', () => {
  let stage;
  let mockLLMClient;
  let mockSemanticInventory;
  let llmResponses;

  // Helper to create proper synset inventory
  const createMockInventory = () => ({
    roles: [
      { label: 'Agent' },
      { label: 'Theme' },
      { label: 'Recipient' },
      { label: 'Location' }
    ],
    unaryPredicates: [
      // Event lemmas used in tests
      { synonyms: ['read'], definition: 'interpret written text' },
      { synonyms: ['walk'], definition: 'move on foot' },
      // Property predicates
      { synonyms: ['tall'], definition: 'of great height' },
      { synonyms: ['red'], definition: 'of red color' },
      { synonyms: ['happy'], definition: 'feeling joy' }
    ],
    binaryRelations: [
      { synonyms: ['in'], definition: 'inside' },
      { synonyms: ['on'], definition: 'positioned on top' },
      { synonyms: ['before'], definition: 'earlier than' },
      { synonyms: ['after'], definition: 'later than' }
    ]
  });

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

    // Mock semantic inventory - returns relation inventory
    const relationTypesCalls = [];
    const eventLemmaLookupCalls = [];
    mockSemanticInventory = {
      semanticSearchRelationTypes: async (text, options) => {
        relationTypesCalls.push({ text, options });
        return mockSemanticInventory._nextResponse;
      },
      lookupEventLemmaSynset: async (lemmaString) => {
        eventLemmaLookupCalls.push(lemmaString);
        // Return a mock synset for any event lemma
        return {
          label: `${lemmaString}.v.01`,
          synonyms: [lemmaString],
          definition: `Mock definition for ${lemmaString}`,
          pos: 'v'
        };
      },
      _calls: relationTypesCalls,
      _eventLemmaLookupCalls: eventLemmaLookupCalls,
      _nextResponse: createMockInventory()
    };

    stage = new Stage3_EventExtraction(mockLLMClient, mockSemanticInventory);
  });

  describe('process with valid LLM output', () => {
    test('should extract event with semantic roles', async () => {
      const text = 'Alice read a book.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice read a book.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // Mock LLM to return valid event extraction
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'read',
            tense: 'PAST',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              Agent: 'x1',
              Theme: 'x2'
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      // Verify semantic inventory was called
      expect(mockSemanticInventory._calls).toHaveLength(1);
      expect(mockSemanticInventory._calls[0].text).toBe(text);

      // Verify LLM was called once (no repair needed)
      expect(mockLLMClient._calls).toHaveLength(1);

      // Verify events were extracted
      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe('e1');
      // Synset object is stored in event.synset
      expect(typeof result.events[0].synset).toBe('object');
      expect(result.events[0].synset.label).toMatch(/read/);
      // Lemma getter returns string from synset
      expect(typeof result.events[0].lemma).toBe('string');
      expect(result.events[0].lemma).toMatch(/read/);
      expect(result.events[0].tense).toBe('PAST');
      expect(result.events[0].aspect).toBe('NONE');
      expect(result.events[0].modal).toBeNull();
      expect(result.events[0].neg).toBe(false);
      expect(result.events[0].roles).toEqual({
        Agent: 'x1',
        Theme: 'x2'
      });

      // Original memory should be unchanged except events
      expect(result.text).toBe(text);
      expect(result.entities).toEqual(entities);
    });

    test('should extract unary facts', async () => {
      const text = 'Alice is tall.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice is tall.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      llmResponses.push({
        events: [],
        unaryFacts: [
          {
            pred: 'tall',
            args: ['x1']
          }
        ],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      expect(result.unaryFacts).toHaveLength(1);
      expect(result.unaryFacts[0].pred).toBe('tall');
      expect(result.unaryFacts[0].args).toEqual(['x1']);
    });

    test('should extract binary relations', async () => {
      const text = 'The book is on the table.';
      const entities = [
        new Entity('x1', 'book', 'THING', ['m1'], 'SING', 'NEUT', null),
        new Entity('x2', 'table', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['The book is on the table.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      llmResponses.push({
        events: [],
        unaryFacts: [],
        binaryFacts: [
          {
            pred: 'on',
            args: ['x1', 'x2']
          }
        ]
      });

      const result = await stage.process(memory);

      expect(result.binaryFacts).toHaveLength(1);
      expect(result.binaryFacts[0].pred).toBe('on');
      expect(result.binaryFacts[0].args).toEqual(['x1', 'x2']);
    });

    test('should handle multiple events and facts', async () => {
      const text = 'Alice read a book on the table.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null),
        new Entity('x2', 'book', 'THING', ['m2'], 'SING', 'NEUT', null),
        new Entity('x3', 'table', 'THING', ['m3'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice read a book on the table.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'read',
            tense: 'PAST',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              Agent: 'x1',
              Theme: 'x2',
              Location: 'x3'
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: [
          {
            pred: 'on',
            args: ['x2', 'x3']
          }
        ]
      });

      const result = await stage.process(memory);

      expect(result.events).toHaveLength(1);
      expect(result.binaryFacts).toHaveLength(1);
      expect(result.events[0].roles.Location).toBe('x3');
    });
  });

  describe('validation failure handling', () => {
    test('should attempt repair when role name is invalid', async () => {
      const text = 'Alice walks.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice walks.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // First call: invalid role name
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              InvalidRole: 'x1'  // Not in allowed roles
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      // Second call: valid (after repair)
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              Agent: 'x1'
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);

      // Verify final result is valid
      expect(result.events).toHaveLength(1);
      expect(result.events[0].roles).toEqual({ Agent: 'x1' });
    });

    test('should fail after one repair attempt', async () => {
      const text = 'Alice walks.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice walks.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // Both calls return invalid role
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              InvalidRole: 'x1'
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              InvalidRole: 'x1'  // Still invalid
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      await expect(stage.process(memory)).rejects.toThrow();

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);
    });

    test('should validate role targets are entity IDs', async () => {
      const text = 'Alice walks.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice walks.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // First call: invalid entity ID
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              Agent: 'x999'  // Invalid: doesn't exist
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      // Second call: valid
      llmResponses.push({
        events: [
          {
            id: 'e1',
            lemma: 'walk',
            tense: 'PRESENT',
            aspect: 'NONE',
            modal: null,
            neg: false,
            roles: {
              Agent: 'x1'
            }
          }
        ],
        unaryFacts: [],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(result.events[0].roles.Agent).toBe('x1');
    });

    test('should validate unary predicate is in inventory', async () => {
      const text = 'Alice is tall.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice is tall.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // First call: invalid predicate
      llmResponses.push({
        events: [],
        unaryFacts: [
          {
            pred: 'INVALID_PRED',
            args: ['x1']
          }
        ],
        binaryFacts: []
      });

      // Second call: valid
      llmResponses.push({
        events: [],
        unaryFacts: [
          {
            pred: 'tall',
            args: ['x1']
          }
        ],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(result.unaryFacts[0].pred).toBe('tall');
    });

    test('should validate binary relation is in inventory', async () => {
      const text = 'Book on table.';
      const entities = [
        new Entity('x1', 'book', 'THING', ['m1'], 'SING', 'NEUT', null),
        new Entity('x2', 'table', 'THING', ['m2'], 'SING', 'NEUT', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Book on table.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      // First call: invalid relation
      llmResponses.push({
        events: [],
        unaryFacts: [],
        binaryFacts: [
          {
            pred: 'INVALID_REL',
            args: ['x1', 'x2']
          }
        ]
      });

      // Second call: valid
      llmResponses.push({
        events: [],
        unaryFacts: [],
        binaryFacts: [
          {
            pred: 'on',
            args: ['x1', 'x2']
          }
        ]
      });

      const result = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(result.binaryFacts[0].pred).toBe('on');
    });
  });

  describe('edge cases', () => {
    test('should handle text with no events', async () => {
      const text = 'Alice.';
      const entities = [
        new Entity('x1', 'Alice', 'PERSON', ['m1'], 'SING', 'FEM', null)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice.'],
        [],
        entities,
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      llmResponses.push({
        events: [],
        unaryFacts: [],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      expect(result.events).toEqual([]);
      expect(result.unaryFacts).toEqual([]);
      expect(result.binaryFacts).toEqual([]);
    });

    test('should handle empty entities', async () => {
      const memory = new DiscourseMemory(
        '',
        [],
        [],
        [],
        [], [], []
      );

      // Use helper which includes event lemmas ('read', 'walk')
      mockSemanticInventory._nextResponse = createMockInventory();

      llmResponses.push({
        events: [],
        unaryFacts: [],
        binaryFacts: []
      });

      const result = await stage.process(memory);

      expect(result.events).toEqual([]);
      expect(result.unaryFacts).toEqual([]);
      expect(result.binaryFacts).toEqual([]);
    });
  });
});
