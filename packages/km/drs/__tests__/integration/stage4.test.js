/**
 * Integration tests for Stage 4: Quantification & Scope Planning
 *
 * Tests with REAL LLM.
 * NO MOCKS - Full end-to-end integration test.
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';
import { Stage2_CoreferenceResolution } from '../../src/stages/Stage2_CoreferenceResolution.js';
import { Stage3_EventExtraction } from '../../src/stages/Stage3_EventExtraction.js';
import { Stage4_ScopePlanning } from '../../src/stages/Stage4_ScopePlanning.js';

describe('Stage 4: Quantification & Scope Planning (Integration)', () => {
  let resourceManager;
  let llmClient;
  let semanticInventory;
  let stage0, stage1, stage2, stage3, stage4;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    semanticInventory = new SemanticInventoryService(resourceManager);
    await semanticInventory.initialize();

    stage0 = new Stage0_MemoryInit();
    stage1 = new Stage1_MentionExtraction(llmClient, semanticInventory);
    stage2 = new Stage2_CoreferenceResolution(llmClient, semanticInventory);
    stage3 = new Stage3_EventExtraction(llmClient, semanticInventory);
    stage4 = new Stage4_ScopePlanning(llmClient);
  }, 60000);

  test('should create scope plan for simple sentence', async () => {
    const text = 'Alice reads.';

    let memory = stage0.process(text);
    memory = await stage1.process(memory);
    memory = await stage2.process(memory);
    memory = await stage3.process(memory);

    const scopePlan = await stage4.process(memory);

    expect(Array.isArray(scopePlan.boxes)).toBe(true);
    expect(scopePlan.boxes.length).toBeGreaterThan(0);
    expect(Array.isArray(scopePlan.ops)).toBe(true);
    expect(scopePlan.assign.entities).toBeTruthy();
    expect(scopePlan.assign.events).toBeTruthy();

    // Verify all entities are assigned
    for (const entity of memory.entities) {
      expect(scopePlan.assign.entities[entity.id]).toBeTruthy();
    }

    // Verify all events are assigned
    for (const event of memory.events) {
      expect(scopePlan.assign.events[event.id]).toBeTruthy();
    }
  }, 120000);
});
