/**
 * Integration tests for Stage 1: Mention Extraction
 *
 * Tests with REAL LLM and REAL semantic inventory.
 * NO MOCKS - Full end-to-end integration test.
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';

describe('Stage 1: Mention Extraction (Integration)', () => {
  let resourceManager;
  let llmClient;
  let semanticInventory;
  let stage0;
  let stage1;

  beforeAll(async () => {
    // Get singleton ResourceManager (no timeout)
    resourceManager = await ResourceManager.getInstance();

    // Get REAL LLM client
    llmClient = await resourceManager.get('llmClient');

    // Initialize REAL semantic inventory service
    semanticInventory = new SemanticInventoryService(resourceManager);
    await semanticInventory.initialize();

    // Initialize stages
    stage0 = new Stage0_MemoryInit();
    stage1 = new Stage1_MentionExtraction(llmClient, semanticInventory);
  }, 60000);

  describe('simple sentences', () => {
    test('should extract mentions from "The cat sat on the mat."', async () => {
      const text = 'The cat sat on the mat.';

      // Stage 0: Initialize memory
      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(1);

      // Stage 1: Extract mentions with REAL LLM
      memory = await stage1.process(memory);

      // Verify mentions were extracted
      expect(memory.mentions.length).toBeGreaterThan(0);

      // Verify all mentions have valid structure
      for (const mention of memory.mentions) {
        expect(mention.id).toMatch(/^m\d+$/);
        expect(mention.span.start).toBeGreaterThanOrEqual(0);
        expect(mention.span.end).toBeLessThanOrEqual(text.length);
        expect(mention.span.end).toBeGreaterThan(mention.span.start);
        expect(mention.text).toBe(text.substring(mention.span.start, mention.span.end));
        expect(mention.head).toBeTruthy();
        expect(mention.coarseType).toBeTruthy();
        expect(mention.sentenceId).toBe(0);
      }

      // Likely mentions: "cat" and "mat"
      const mentionTexts = memory.mentions.map(m => m.text);
      expect(mentionTexts.some(t => t.includes('cat'))).toBe(true);
    }, 30000);

    test('should extract mentions from "Alice reads. Bob writes."', async () => {
      const text = 'Alice reads. Bob writes.';

      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(2);

      memory = await stage1.process(memory);

      expect(memory.mentions.length).toBeGreaterThan(0);

      // Verify mentions
      for (const mention of memory.mentions) {
        expect(mention.id).toMatch(/^m\d+$/);
        expect(mention.span.start).toBeGreaterThanOrEqual(0);
        expect(mention.span.end).toBeLessThanOrEqual(text.length);
        expect(mention.text).toBe(text.substring(mention.span.start, mention.span.end));
        expect([0, 1]).toContain(mention.sentenceId);
      }

      // Should find "Alice" and "Bob"
      const mentionTexts = memory.mentions.map(m => m.text);
      expect(mentionTexts.some(t => t.includes('Alice'))).toBe(true);
      expect(mentionTexts.some(t => t.includes('Bob'))).toBe(true);
    }, 30000);
  });

  describe('entity types', () => {
    test('should assign appropriate entity types', async () => {
      const text = 'London is a city.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);

      expect(memory.mentions.length).toBeGreaterThan(0);

      // Find mention containing "London"
      const londonMention = memory.mentions.find(m => m.text.includes('London'));
      expect(londonMention).toBeTruthy();

      // Entity type should be location-related (check synset)
      const validLocationTypes = ['location', 'place', 'city', 'gpe'];
      const synonyms = londonMention.coarseType.synonyms || [];
      const label = londonMention.coarseType.label || '';
      const hasLocationType = validLocationTypes.some(type =>
        synonyms.some(syn => syn.toLowerCase().includes(type)) ||
        label.toLowerCase().includes(type)
      );
      expect(hasLocationType).toBe(true);
    }, 30000);

    test('should handle person entities', async () => {
      const text = 'John is a teacher.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);

      expect(memory.mentions.length).toBeGreaterThan(0);

      // Find mention containing "John"
      const johnMention = memory.mentions.find(m => m.text.includes('John'));
      expect(johnMention).toBeTruthy();

      // Entity type should be person-related (check synset)
      const validPersonTypes = ['person', 'human', 'individual'];
      const synonyms = johnMention.coarseType.synonyms || [];
      const label = johnMention.coarseType.label || '';
      const hasPersonType = validPersonTypes.some(type =>
        synonyms.some(syn => syn.toLowerCase().includes(type)) ||
        label.toLowerCase().includes(type)
      );
      expect(hasPersonType).toBe(true);
    }, 30000);
  });

  describe('complex discourse', () => {
    test('should handle longer text with multiple entities', async () => {
      const text = 'Every student read a book. Some students enjoyed it.';

      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(2);

      memory = await stage1.process(memory);

      expect(memory.mentions.length).toBeGreaterThan(0);

      // Verify all mentions are valid
      for (const mention of memory.mentions) {
        expect(mention.id).toMatch(/^m\d+$/);
        expect(mention.span.start).toBeGreaterThanOrEqual(0);
        expect(mention.span.end).toBeLessThanOrEqual(text.length);
        expect(mention.text).toBe(text.substring(mention.span.start, mention.span.end));
        expect([0, 1]).toContain(mention.sentenceId);
      }

      // Should find mentions for "student(s)", "book", "it"
      const mentionTexts = memory.mentions.map(m => m.text.toLowerCase());
      const hasStudent = mentionTexts.some(t => t.includes('student'));
      const hasBook = mentionTexts.some(t => t.includes('book'));

      expect(hasStudent || hasBook).toBe(true);
    }, 30000);
  });

  describe('validation', () => {
    test('should produce valid mention spans', async () => {
      const text = 'The quick brown fox jumps.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);

      for (const mention of memory.mentions) {
        // Span must be within text bounds
        expect(mention.span.start).toBeGreaterThanOrEqual(0);
        expect(mention.span.end).toBeLessThanOrEqual(text.length);

        // Text must match actual substring
        const actualText = text.substring(mention.span.start, mention.span.end);
        expect(mention.text).toBe(actualText);

        // Span must be non-empty
        expect(mention.span.end).toBeGreaterThan(mention.span.start);
      }
    }, 30000);

    test('should assign entity types from semantic inventory', async () => {
      const text = 'A dog barked.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);

      // At least one mention should be found
      expect(memory.mentions.length).toBeGreaterThan(0);

      // All coarseTypes should be synset objects with label or synonyms
      for (const mention of memory.mentions) {
        expect(typeof mention.coarseType).toBe('object');
        expect(mention.coarseType).not.toBeNull();
        // Must have either label or synonyms
        const hasLabel = mention.coarseType.label && mention.coarseType.label.length > 0;
        const hasSynonyms = mention.coarseType.synonyms && mention.coarseType.synonyms.length > 0;
        expect(hasLabel || hasSynonyms).toBe(true);
      }
    }, 30000);
  });
});
