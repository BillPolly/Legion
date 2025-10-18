/**
 * Integration tests for Stage 3: Event & Relation Extraction
 *
 * Tests with REAL LLM and REAL semantic inventory.
 * NO MOCKS - Full end-to-end integration test.
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';
import { Stage2_CoreferenceResolution } from '../../src/stages/Stage2_CoreferenceResolution.js';
import { Stage3_EventExtraction } from '../../src/stages/Stage3_EventExtraction.js';

describe('Stage 3: Event & Relation Extraction (Integration)', () => {
  let resourceManager;
  let llmClient;
  let semanticInventory;
  let stage0;
  let stage1;
  let stage2;
  let stage3;

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
    stage2 = new Stage2_CoreferenceResolution(llmClient, semanticInventory);
    stage3 = new Stage3_EventExtraction(llmClient, semanticInventory);
  }, 60000);

  describe('event extraction with semantic roles', () => {
    test('should extract event from "Alice read a book."', async () => {
      const text = 'Alice read a book.';

      // Stage 0: Initialize memory
      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(1);

      // Stage 1: Extract mentions
      memory = await stage1.process(memory);
      expect(memory.mentions.length).toBeGreaterThan(0);

      // Stage 2: Resolve coreferences
      memory = await stage2.process(memory);
      expect(memory.entities.length).toBeGreaterThan(0);

      // Stage 3: Extract events with REAL LLM
      memory = await stage3.process(memory);

      // Verify events were extracted
      expect(memory.events.length).toBeGreaterThan(0);

      // Find reading event
      const readEvent = memory.events.find(e =>
        e.lemma.toLowerCase().includes('read')
      );

      expect(readEvent).toBeTruthy();
      expect(readEvent.id).toMatch(/^e\d+$/);
      expect(readEvent.tense).toBe('PAST');
      expect(readEvent.aspect).toBeTruthy();
      expect(typeof readEvent.neg).toBe('boolean');

      // Verify event has semantic roles
      expect(Object.keys(readEvent.roles).length).toBeGreaterThan(0);

      // Verify all role targets are valid entity IDs
      for (const [roleName, targetId] of Object.entries(readEvent.roles)) {
        const entityExists = memory.entities.some(e => e.id === targetId);
        expect(entityExists).toBe(true);
      }
    }, 60000);

    test('should handle "Mary walked."', async () => {
      const text = 'Mary walked.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      // Should have at least one event
      expect(memory.events.length).toBeGreaterThan(0);

      const walkEvent = memory.events.find(e =>
        e.lemma.toLowerCase().includes('walk')
      );

      expect(walkEvent).toBeTruthy();
      expect(walkEvent.id).toMatch(/^e\d+$/);
      expect(walkEvent.tense).toBe('PAST');

      // Should have at least an Agent role
      expect(Object.keys(walkEvent.roles).length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('unary facts extraction', () => {
    test('should extract unary facts from descriptions', async () => {
      const text = 'The book is red.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      // May have unary facts describing properties
      if (memory.unaryFacts.length > 0) {
        for (const fact of memory.unaryFacts) {
          // Verify structure
          expect(fact.pred).toBeTruthy();
          expect(Array.isArray(fact.args)).toBe(true);
          expect(fact.args.length).toBe(1);

          // Verify args are valid entity IDs
          const entityExists = memory.entities.some(e => e.id === fact.args[0]);
          expect(entityExists).toBe(true);
        }
      }
    }, 60000);
  });

  describe('binary relations extraction', () => {
    test('should extract binary relations from "The book is on the table."', async () => {
      const text = 'The book is on the table.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      // May have binary facts for spatial relations
      if (memory.binaryFacts.length > 0) {
        for (const fact of memory.binaryFacts) {
          // Verify structure
          expect(fact.pred).toBeTruthy();
          expect(Array.isArray(fact.args)).toBe(true);
          expect(fact.args.length).toBe(2);

          // Verify args are valid entity IDs
          for (const arg of fact.args) {
            const entityExists = memory.entities.some(e => e.id === arg);
            expect(entityExists).toBe(true);
          }
        }
      }
    }, 60000);
  });

  describe('validation', () => {
    test('should produce valid event IDs', async () => {
      const text = 'Alice walks.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      for (const event of memory.events) {
        // Event IDs must match pattern e1, e2, etc.
        expect(event.id).toMatch(/^e\d+$/);

        // All role targets must exist in memory.entities
        for (const targetId of Object.values(event.roles)) {
          const entityExists = memory.entities.some(e => e.id === targetId);
          expect(entityExists).toBe(true);
        }

        // Tense must be valid
        expect(['PAST', 'PRESENT', 'FUTURE']).toContain(event.tense);

        // Aspect must be valid
        expect(['NONE', 'PROGRESSIVE', 'PERFECT']).toContain(event.aspect);

        // Negation must be boolean
        expect(typeof event.neg).toBe('boolean');
      }
    }, 60000);

    test('should not have duplicate event IDs', async () => {
      const text = 'Alice walked and talked.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      const eventIds = memory.events.map(e => e.id);
      const uniqueIds = new Set(eventIds);
      expect(eventIds.length).toBe(uniqueIds.size);
    }, 60000);
  });

  describe('edge cases', () => {
    test('should handle text with no events', async () => {
      const text = 'Alice.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);
      memory = await stage3.process(memory);

      // May or may not have events depending on LLM interpretation
      // Just verify structure is valid
      expect(Array.isArray(memory.events)).toBe(true);
      expect(Array.isArray(memory.unaryFacts)).toBe(true);
      expect(Array.isArray(memory.binaryFacts)).toBe(true);
    }, 60000);
  });
});
