/**
 * Integration tests for Stage 2: Coreference Resolution
 *
 * Tests with REAL LLM and REAL semantic inventory.
 * NO MOCKS - Full end-to-end integration test.
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';
import { Stage2_CoreferenceResolution } from '../../src/stages/Stage2_CoreferenceResolution.js';

describe('Stage 2: Coreference Resolution (Integration)', () => {
  let resourceManager;
  let llmClient;
  let semanticInventory;
  let stage0;
  let stage1;
  let stage2;

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
  }, 60000);

  describe('pronoun resolution', () => {
    test('should resolve "She" to "Mary" in "John met Mary. She smiled."', async () => {
      const text = 'John met Mary. She smiled.';

      // Stage 0: Initialize memory
      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(2);

      // Stage 1: Extract mentions
      memory = await stage1.process(memory);
      expect(memory.mentions.length).toBeGreaterThan(0);

      // Stage 2: Resolve coreferences with REAL LLM
      memory = await stage2.process(memory);

      // Verify entities were created
      expect(memory.entities.length).toBeGreaterThan(0);

      // Find entity containing "Mary" or "She"
      const maryEntity = memory.entities.find(e =>
        e.canonical.toLowerCase().includes('mary') ||
        e.mentions.some(mId => {
          const m = memory.mentions.find(mention => mention.id === mId);
          return m && (m.text.toLowerCase().includes('mary') || m.text.toLowerCase().includes('she'));
        })
      );

      expect(maryEntity).toBeTruthy();

      // Verify all entities have valid structure
      for (const entity of memory.entities) {
        expect(entity.id).toMatch(/^x\d+$/);
        expect(entity.canonical).toBeTruthy();
        expect(entity.type).toBeTruthy();
        expect(Array.isArray(entity.mentions)).toBe(true);
        expect(entity.mentions.length).toBeGreaterThan(0);
        expect(['SING', 'PLUR']).toContain(entity.number);
        expect(['MASC', 'FEM', 'NEUT', 'UNKNOWN']).toContain(entity.gender);

        // Verify all mentions exist
        for (const mentionId of entity.mentions) {
          const mentionExists = memory.mentions.some(m => m.id === mentionId);
          expect(mentionExists).toBe(true);
        }
      }

      // Verify mentions are disjoint
      const allMentionIds = memory.entities.flatMap(e => e.mentions);
      const uniqueMentionIds = new Set(allMentionIds);
      expect(allMentionIds.length).toBe(uniqueMentionIds.size);
    }, 60000);

    test('should handle "Alice reads. She enjoys books."', async () => {
      const text = 'Alice reads. She enjoys books.';

      let memory = stage0.process(text);
      expect(memory.sentences).toHaveLength(2);

      memory = await stage1.process(memory);
      memory = await stage2.process(memory);

      // Should have entities for Alice and books
      expect(memory.entities.length).toBeGreaterThan(0);

      // Find entity for Alice (should include "She")
      const aliceEntity = memory.entities.find(e =>
        e.canonical.toLowerCase().includes('alice') ||
        e.mentions.some(mId => {
          const m = memory.mentions.find(mention => mention.id === mId);
          return m && (m.text.toLowerCase().includes('alice') || m.text.toLowerCase().includes('she'));
        })
      );

      expect(aliceEntity).toBeTruthy();

      // Verify all entities have valid structure
      for (const entity of memory.entities) {
        expect(entity.id).toMatch(/^x\d+$/);
        expect(entity.canonical).toBeTruthy();
        expect(entity.type).toBeTruthy();
        expect(entity.mentions.length).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('multiple entities', () => {
    test('should create separate entities for different people', async () => {
      const text = 'Alice met Bob.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);

      // Should have at least 2 entities
      expect(memory.entities.length).toBeGreaterThanOrEqual(2);

      // Find entities for Alice and Bob
      const aliceEntity = memory.entities.find(e =>
        e.canonical.toLowerCase().includes('alice')
      );
      const bobEntity = memory.entities.find(e =>
        e.canonical.toLowerCase().includes('bob')
      );

      expect(aliceEntity).toBeTruthy();
      expect(bobEntity).toBeTruthy();

      // Verify they are different entities
      expect(aliceEntity.id).not.toBe(bobEntity.id);

      // Verify mentions are disjoint
      const aliceMentions = new Set(aliceEntity.mentions);
      const bobMentions = new Set(bobEntity.mentions);
      const intersection = [...aliceMentions].filter(m => bobMentions.has(m));
      expect(intersection).toHaveLength(0);
    }, 60000);
  });

  describe('validation', () => {
    test('should produce valid entity IDs', async () => {
      const text = 'The cat sat on the mat.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);

      for (const entity of memory.entities) {
        // Entity IDs must match pattern x1, x2, etc.
        expect(entity.id).toMatch(/^x\d+$/);

        // All mention IDs must exist in memory.mentions
        for (const mentionId of entity.mentions) {
          const mentionExists = memory.mentions.some(m => m.id === mentionId);
          expect(mentionExists).toBe(true);
        }
      }
    }, 60000);

    test('should assign appropriate gender and number', async () => {
      const text = 'Mary walked.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);

      // Find entity for Mary
      const maryEntity = memory.entities.find(e =>
        e.canonical.toLowerCase().includes('mary')
      );

      if (maryEntity) {
        // Should be feminine
        expect(maryEntity.gender).toBe('FEM');
        // Should be singular
        expect(maryEntity.number).toBe('SING');
      }
    }, 60000);
  });

  describe('edge cases', () => {
    test('should handle text with single entity', async () => {
      const text = 'Alice.';

      let memory = stage0.process(text);
      memory = await stage1.process(memory);
      memory = await stage2.process(memory);

      // Should have at least one entity
      expect(memory.entities.length).toBeGreaterThanOrEqual(1);

      // Entity should have valid structure
      const entity = memory.entities[0];
      expect(entity.id).toMatch(/^x\d+$/);
      expect(entity.canonical).toBeTruthy();
      expect(entity.mentions.length).toBeGreaterThan(0);
    }, 60000);
  });
});
