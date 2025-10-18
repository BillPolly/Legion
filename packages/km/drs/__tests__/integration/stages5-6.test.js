/**
 * Integration tests for Stages 5 & 6: DRS Builder & Validation
 *
 * Tests with REAL LLM for stages 1-4, then deterministic stages 5-6
 * NO MOCKS - Full end-to-end integration test
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from '../../src/stages/Stage1_MentionExtraction.js';
import { Stage2_CoreferenceResolution } from '../../src/stages/Stage2_CoreferenceResolution.js';
import { Stage3_EventExtraction } from '../../src/stages/Stage3_EventExtraction.js';
import { Stage4_ScopePlanning } from '../../src/stages/Stage4_ScopePlanning.js';
import { Stage5_DRSBuilder } from '../../src/stages/Stage5_DRSBuilder.js';
import { Stage6_DRSValidation } from '../../src/stages/Stage6_DRSValidation.js';

describe('Stages 5 & 6: DRS Builder & Validation (Integration)', () => {
  let resourceManager;
  let llmClient;
  let semanticInventory;
  let stage0, stage1, stage2, stage3, stage4, stage5, stage6;

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
    stage5 = new Stage5_DRSBuilder();
    stage6 = new Stage6_DRSValidation();
  }, 60000);

  test('should build and validate DRS for simple sentence', async () => {
    const text = 'Alice reads.';

    // Run stages 0-4 with REAL LLM
    let memory = stage0.process(text);
    memory = await stage1.process(memory);
    memory = await stage2.process(memory);
    memory = await stage3.process(memory);
    const scopePlan = await stage4.process(memory);

    // Run stage 5: Deterministic DRS building
    const drs = stage5.process(memory, scopePlan);

    // Verify DRS structure
    expect(Array.isArray(drs.referents)).toBe(true);
    expect(drs.referents.length).toBeGreaterThan(0);
    expect(Array.isArray(drs.conditions)).toBe(true);
    expect(drs.conditions.length).toBeGreaterThan(0);

    // Verify referents include entities and events
    const hasEntityRef = drs.referents.some(r => r.startsWith('x'));
    const hasEventRef = drs.referents.some(r => r.startsWith('e'));
    expect(hasEntityRef).toBe(true);
    expect(hasEventRef).toBe(true);

    // Verify conditions include predicates and relations
    const hasPredicates = drs.conditions.some(c => c.pred);
    const hasRelations = drs.conditions.some(c => c.rel);
    expect(hasPredicates).toBe(true);
    expect(hasRelations).toBe(true);

    // Run stage 6: Validation
    const validation = stage6.process(drs);

    // DRS should be valid
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  }, 120000);

  test('should build and validate DRS with quantifier', async () => {
    const text = 'Alice read a book.';

    let memory = stage0.process(text);
    memory = await stage1.process(memory);
    memory = await stage2.process(memory);
    memory = await stage3.process(memory);
    const scopePlan = await stage4.process(memory);

    const drs = stage5.process(memory, scopePlan);

    // Verify DRS includes quantifier
    const hasSomeQuantifier = drs.conditions.some(
      c => c.rel === 'Some' && c.args.length === 1
    );
    expect(hasSomeQuantifier).toBe(true);

    // Validate
    const validation = stage6.process(drs);
    expect(validation.valid).toBe(true);
  }, 120000);

  test('should build and validate DRS with event and roles', async () => {
    const text = 'Alice read a book.';

    let memory = stage0.process(text);
    memory = await stage1.process(memory);
    memory = await stage2.process(memory);
    memory = await stage3.process(memory);
    const scopePlan = await stage4.process(memory);

    const drs = stage5.process(memory, scopePlan);

    // Verify DRS includes event predicate
    const hasEventPred = drs.conditions.some(
      c => c.pred && c.args.length === 1 && c.args[0].startsWith('e')
    );
    expect(hasEventPred).toBe(true);

    // Verify DRS includes semantic roles (Agent, Theme, etc.)
    const hasRole = drs.conditions.some(
      c => c.rel && c.args.length === 2 && c.args[0].startsWith('e')
    );
    expect(hasRole).toBe(true);

    // Validate
    const validation = stage6.process(drs);
    expect(validation.valid).toBe(true);
  }, 120000);

  test('should include all entity types and event predicates', async () => {
    const text = 'Alice walks.';

    let memory = stage0.process(text);
    memory = await stage1.process(memory);
    memory = await stage2.process(memory);
    memory = await stage3.process(memory);
    const scopePlan = await stage4.process(memory);

    const drs = stage5.process(memory, scopePlan);

    // Should have entity type predicates
    const hasTypePred = drs.conditions.some(
      c => c.pred && c.args.some(a => a.startsWith('x'))
    );
    expect(hasTypePred).toBe(true);

    // Should have event predicate
    const hasEventPred = drs.conditions.some(
      c => c.pred && c.args.some(a => a.startsWith('e'))
    );
    expect(hasEventPred).toBe(true);

    const validation = stage6.process(drs);
    expect(validation.valid).toBe(true);
  }, 120000);
});
