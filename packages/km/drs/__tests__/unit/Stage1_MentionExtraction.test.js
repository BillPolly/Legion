/**
 * Unit tests for Stage1_MentionExtraction
 * Uses MOCKED LLM responses and MOCKED semantic inventory
 */
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';
import { DiscourseMemory } from '../../src/types/DiscourseMemory.js';

// Helper to create mock synset objects
function createMockSynset(label, synonyms = []) {
  return {
    label,
    synonyms: synonyms.length > 0 ? synonyms : [label.split('.')[0]],
    definition: `Mock definition for ${label}`,
    pos: 'n'
  };
}

describe('Stage1_MentionExtraction', () => {
  let stage;
  let mockLLMClient;
  let mockSemanticInventory;
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

    stage = new Stage1_MentionExtraction(mockLLMClient, mockSemanticInventory);
  });

  describe('process with valid LLM output', () => {
    test('should extract mentions from simple sentence', async () => {
      const text = 'The cat sat on the mat.';
      const memory = new DiscourseMemory(
        text,
        ['The cat sat on the mat.'],
        [], [], [], [], []
      );

      // Mock LLM to return valid mentions (with lowercase type strings)
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 7 },
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        },
        {
          id: 'm2',
          span: { start: 19, end: 22 },
          text: 'mat',
          head: 'mat',
          coarseType: 'artifact',
          sentenceId: 0
        }
      ]);

      const result = await stage.process(memory);

      // Verify synset lookup was called for each mention
      expect(mockSemanticInventory._lookupCalls).toHaveLength(2);
      expect(mockSemanticInventory._lookupCalls).toContain('animal');
      expect(mockSemanticInventory._lookupCalls).toContain('artifact');

      // Verify LLM was called once (no repair needed)
      expect(mockLLMClient._calls).toHaveLength(1);

      // Verify result
      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].id).toBe('m1');
      expect(result.mentions[0].text).toBe('cat');
      expect(result.mentions[0].coarseType).toEqual(expect.objectContaining({
        label: 'animal.n.01',
        synonyms: expect.arrayContaining(['animal'])
      }));
      expect(result.mentions[1].id).toBe('m2');
      expect(result.mentions[1].text).toBe('mat');
      expect(result.mentions[1].coarseType).toEqual(expect.objectContaining({
        label: 'artifact.n.01',
        synonyms: expect.arrayContaining(['artifact'])
      }));

      // Original memory should be unchanged except mentions
      expect(result.text).toBe(text);
      expect(result.sentences).toEqual(['The cat sat on the mat.']);
      expect(result.entities).toEqual([]);
      expect(result.events).toEqual([]);
    });

    test('should handle multiple sentences', async () => {
      const text = 'Alice reads. Bob writes.';
      const memory = new DiscourseMemory(
        text,
        ['Alice reads.', 'Bob writes.'],
        [], [], [], [], []
      );

      llmResponses.push([
        {
          id: 'm1',
          span: { start: 0, end: 5 },
          text: 'Alice',
          head: 'Alice',
          coarseType: 'person',
          sentenceId: 0
        },
        {
          id: 'm2',
          span: { start: 13, end: 16 },
          text: 'Bob',
          head: 'Bob',
          coarseType: 'person',
          sentenceId: 1
        }
      ]);

      const result = await stage.process(memory);

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].sentenceId).toBe(0);
      expect(result.mentions[1].sentenceId).toBe(1);
    });
  });

  describe('validation failure handling', () => {
    test('should attempt repair when LLM output is invalid', async () => {
      const text = 'The cat sat.';
      const memory = new DiscourseMemory(
        text,
        ['The cat sat.'],
        [], [], [], [], []
      );

      // First call: invalid mention (wrong span)
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 100 },  // Invalid: beyond text length
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      // Second call: valid mention (after repair)
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 7 },
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      const result = await stage.process(memory);

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);

      // Verify final result is valid
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].span.end).toBe(7);
    });

    test('should fail after one repair attempt', async () => {
      const text = 'The cat sat.';
      const memory = new DiscourseMemory(
        text,
        ['The cat sat.'],
        [], [], [], [], []
      );

// Both calls return invalid mentions
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 100 },  // Always invalid
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 100 },  // Still invalid
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      await expect(stage.process(memory)).rejects.toThrow();

      // Verify LLM was called twice (initial + one repair)
      expect(mockLLMClient._calls).toHaveLength(2);
    });

    test('should validate mention spans match text', async () => {
      const text = 'The cat sat.';
      const memory = new DiscourseMemory(
        text,
        ['The cat sat.'],
        [], [], [], [], []
      );

// First call: mention text doesn't match actual text
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 7 },
          text: 'dog',  // Doesn't match actual text "cat"
          head: 'dog',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      // Second call: correct text
      llmResponses.push([
        {
          id: 'm1',
          span: { start: 4, end: 7 },
          text: 'cat',
          head: 'cat',
          coarseType: 'animal',
          sentenceId: 0
        }
      ]);

      const result = await stage.process(memory);

      expect(mockLLMClient._calls).toHaveLength(2);
      expect(result.mentions[0].text).toBe('cat');
    });

  });

  describe('edge cases', () => {
    test('should handle empty text', async () => {
      const memory = new DiscourseMemory(
        '',
        [],
        [], [], [], [], []
      );

      llmResponses.push([]);

      const result = await stage.process(memory);

      expect(result.mentions).toEqual([]);
    });

    test('should handle text with no mentions', async () => {
      const text = 'Hello world!';
      const memory = new DiscourseMemory(
        text,
        ['Hello world!'],
        [], [], [], [], []
      );

      llmResponses.push([]);

      const result = await stage.process(memory);

      expect(result.mentions).toEqual([]);
    });
  });
});
