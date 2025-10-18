/**
 * Unit tests for Stage2_CoreferenceResolution
 * Uses MOCKED LLM responses
 */
import { Stage2_CoreferenceResolution } from '../../src/stages/Stage2_CoreferenceResolution.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';
import { Mention } from '../../src/types/Mention.js';

// Helper to create mock synset objects
function createMockSynset(label, synonyms = []) {
  return {
    label,
    synonyms: synonyms.length > 0 ? synonyms : [label.split('.')[0]],
    definition: `Mock definition for ${label}`,
    pos: 'n'
  };
}

describe('Stage2_CoreferenceResolution', () => {
  let stage;
  let mockLLMClient;
  let mockSemanticInventory;
  let llmResponses;

  // Create mock synsets for testing
  const personSynset = createMockSynset('person.n.01', ['person', 'individual']);
  const thingSynset = createMockSynset('thing.n.01', ['thing', 'object']);

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

    // Mock semantic inventory - returns synset objects
    const lookupCalls = [];
    mockSemanticInventory = {
      lookupEntityTypeSynset: async (typeString) => {
        lookupCalls.push(typeString);
        // Return a mock synset for any type string
        return createMockSynset(`${typeString}.n.01`, [typeString]);
      },
      _lookupCalls: lookupCalls
    };

    stage = new Stage2_CoreferenceResolution(mockLLMClient, mockSemanticInventory);
  });

  describe('process with valid LLM output', () => {
    test('should resolve coreference with pronouns', async () => {
      const text = 'John met Mary. She smiled.';
      const mentions = [
        new Mention('m1', { start: 0, end: 4 }, 'John', 'John', personSynset, 0),
        new Mention('m2', { start: 9, end: 13 }, 'Mary', 'Mary', personSynset, 0),
        new Mention('m3', { start: 15, end: 18 }, 'She', 'She', personSynset, 1)
      ];
      const memory = new DiscourseMemory(
        text,
        ['John met Mary.', 'She smiled.'],
        mentions,
        [], [], [], []
      );

      // Mock LLM to return valid entities (with lowercase types)
      llmResponses.push([
        {
          canonical: 'John',
          type: 'person',
          mentions: ['m1'],
          number: 'SING',
          gender: 'MASC'
        },
        {
          canonical: 'Mary',
          type: 'person',
          mentions: ['m2', 'm3'],
          number: 'SING',
          gender: 'FEM'
        }
      ]);

      const result = await stage.process(memory);

      // Verify LLM was called once (no repair needed)
      expect(mockLLMClient._calls).toHaveLength(1);

      // Verify synset lookup was called
      expect(mockSemanticInventory._lookupCalls).toHaveLength(2);
      expect(mockSemanticInventory._lookupCalls).toContain('person');

      // Verify result
      expect(result.entities).toHaveLength(2);

      // First entity: John
      expect(result.entities[0].id).toMatch(/^x\d+$/);
      expect(result.entities[0].canonical).toBe('John');
      expect(result.entities[0].type).toEqual(expect.objectContaining({
        label: 'person.n.01',
        synonyms: expect.arrayContaining(['person'])
      }));
      expect(result.entities[0].mentions).toEqual(['m1']);
      expect(result.entities[0].number).toBe('SING');
      expect(result.entities[0].gender).toBe('MASC');

      // Second entity: Mary (includes "She")
      expect(result.entities[1].id).toMatch(/^x\d+$/);
      expect(result.entities[1].canonical).toBe('Mary');
      expect(result.entities[1].type).toEqual(expect.objectContaining({
        label: 'person.n.01',
        synonyms: expect.arrayContaining(['person'])
      }));
      expect(result.entities[1].mentions).toEqual(['m2', 'm3']);
      expect(result.entities[1].number).toBe('SING');
      expect(result.entities[1].gender).toBe('FEM');

      // Original memory should be unchanged except entities
      expect(result.text).toBe(text);
      expect(result.mentions).toEqual(mentions);
    });

    test('should handle multiple entities', async () => {
      const text = 'Alice read a book.';
      const mentions = [
        new Mention('m1', { start: 0, end: 5 }, 'Alice', 'Alice', 'PERSON', 0),
        new Mention('m2', { start: 13, end: 17 }, 'book', 'book', 'THING', 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice read a book.'],
        mentions,
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = ['PERSON', 'THING'];

      llmResponses.push([
        {
          canonical: 'Alice',
          type: 'PERSON',
          mentions: ['m1'],
          number: 'SING',
          gender: 'FEM'
        },
        {
          canonical: 'book',
          type: 'THING',
          mentions: ['m2'],
          number: 'SING',
          gender: 'NEUT'
        }
      ]);

      const result = await stage.process(memory);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].mentions).toEqual(['m1']);
      expect(result.entities[1].mentions).toEqual(['m2']);
    });
  });

  describe('validation failure handling', () => {
    test('should attempt repair when LLM output is invalid', async () => {
      const text = 'John walks.';
      const mentions = [
        new Mention('m1', { start: 0, end: 4 }, 'John', 'John', 'PERSON', 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['John walks.'],
        mentions,
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = ['PERSON'];

      // First call: invalid - uses non-existent mention ID
      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m999'],  // Invalid: doesn't exist
          number: 'SING',
          gender: 'MASC'
        }
      ]);

      // Second call: valid (after repair)
      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m1'],
          number: 'SING',
          gender: 'MASC'
        }
      ]);

      const result = await stage.process(memory);

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);

      // Verify final result is valid
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].mentions).toEqual(['m1']);
    });

    test('should fail after one repair attempt', async () => {
      const text = 'John walks.';
      const mentions = [
        new Mention('m1', { start: 0, end: 4 }, 'John', 'John', 'PERSON', 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['John walks.'],
        mentions,
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = ['PERSON'];

      // Both calls return invalid entities
      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m999'],  // Always invalid
          number: 'SING',
          gender: 'MASC'
        }
      ]);

      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m999'],  // Still invalid
          number: 'SING',
          gender: 'MASC'
        }
      ]);

      await expect(stage.process(memory)).rejects.toThrow();

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);
    });

    test('should validate mentions are disjoint', async () => {
      const text = 'John and Mary.';
      const mentions = [
        new Mention('m1', { start: 0, end: 4 }, 'John', 'John', 'PERSON', 0),
        new Mention('m2', { start: 9, end: 13 }, 'Mary', 'Mary', 'PERSON', 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['John and Mary.'],
        mentions,
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = ['PERSON'];

      // First call: overlapping mentions (m1 in both entities)
      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m1'],
          number: 'SING',
          gender: 'MASC'
        },
        {
          canonical: 'Mary',
          type: 'PERSON',
          mentions: ['m1', 'm2'],  // Invalid: m1 already used
          number: 'SING',
          gender: 'FEM'
        }
      ]);

      // Second call: correct
      llmResponses.push([
        {
          canonical: 'John',
          type: 'PERSON',
          mentions: ['m1'],
          number: 'SING',
          gender: 'MASC'
        },
        {
          canonical: 'Mary',
          type: 'PERSON',
          mentions: ['m2'],
          number: 'SING',
          gender: 'FEM'
        }
      ]);

      const result = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(result.entities).toHaveLength(2);
    });

    test('should fail when entity type not found in WordNet', async () => {
      const text = 'John walks.';
      const mentions = [
        new Mention('m1', { start: 0, end: 4 }, 'John', 'John', personSynset, 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['John walks.'],
        mentions,
        [], [], [], []
      );

      // Mock semantic inventory to return null for invalid type
      mockSemanticInventory.lookupEntityTypeSynset = async (typeString) => {
        if (typeString === 'INVALID_WORDNET_TYPE') {
          return null;  // Not found in WordNet
        }
        return createMockSynset(`${typeString}.n.01`, [typeString]);
      };

      // LLM returns type that doesn't exist in WordNet
      llmResponses.push([
        {
          canonical: 'John',
          type: 'INVALID_WORDNET_TYPE',
          mentions: ['m1'],
          number: 'SING',
          gender: 'MASC'
        }
      ]);

      // Should throw error when synset lookup fails
      await expect(stage.process(memory)).rejects.toThrow('Cannot find synset for entity type');
    });
  });

  describe('edge cases', () => {
    test('should handle empty mentions', async () => {
      const memory = new DiscourseMemory(
        '',
        [],
        [],
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = [];
      llmResponses.push([]);

      const result = await stage.process(memory);

      expect(result.entities).toEqual([]);
    });

    test('should handle single mention', async () => {
      const text = 'Alice.';
      const mentions = [
        new Mention('m1', { start: 0, end: 5 }, 'Alice', 'Alice', 'PERSON', 0)
      ];
      const memory = new DiscourseMemory(
        text,
        ['Alice.'],
        mentions,
        [], [], [], []
      );

      mockSemanticInventory._nextResponse = ['PERSON'];
      llmResponses.push([
        {
          canonical: 'Alice',
          type: 'PERSON',
          mentions: ['m1'],
          number: 'SING',
          gender: 'FEM'
        }
      ]);

      const result = await stage.process(memory);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].mentions).toEqual(['m1']);
    });
  });
});
