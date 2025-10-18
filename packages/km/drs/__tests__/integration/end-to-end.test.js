/**
 * End-to-End Integration Tests for Complete DRS Pipeline
 *
 * Tests the FULL pipeline from raw text to validated ClausalDRS.
 * Uses REAL LLM, REAL MongoDB, REAL Qdrant, REAL Semantic Inventory.
 * NO MOCKS - Full end-to-end integration.
 */
import { ResourceManager } from '@legion/resource-manager';
import { DRSOrchestrator } from '../../src/DRSOrchestrator.js';

describe('DRS Pipeline End-to-End Integration', () => {
  let resourceManager;
  let orchestrator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    orchestrator = new DRSOrchestrator(resourceManager);
    await orchestrator.initialize();
  }, 60000);

  test('should process simple sentence', async () => {
    const text = 'Alice reads.';

    const result = await orchestrator.run(text);

    // Verify success
    expect(result.success).toBe(true);

    // Verify text
    expect(result.text).toBe(text);

    // Verify discourse memory has entities
    expect(result.memory.entities.length).toBeGreaterThan(0);

    // Verify discourse memory has events
    expect(result.memory.events.length).toBeGreaterThan(0);

    // Verify scope plan exists
    expect(result.scopePlan).toBeTruthy();
    expect(Array.isArray(result.scopePlan.boxes)).toBe(true);
    expect(result.scopePlan.boxes.length).toBeGreaterThan(0);

    // Verify DRS exists
    expect(result.drs).toBeTruthy();
    expect(Array.isArray(result.drs.referents)).toBe(true);
    expect(result.drs.referents.length).toBeGreaterThan(0);
    expect(Array.isArray(result.drs.conditions)).toBe(true);
    expect(result.drs.conditions.length).toBeGreaterThan(0);

    // Verify validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);

    // Verify metadata
    expect(result.metadata).toBeTruthy();
    expect(Array.isArray(result.metadata.stages)).toBe(true);
    expect(result.metadata.stages.length).toBe(7); // 7 stages (0-6)
    expect(result.metadata.totalTime).toBeGreaterThan(0);
    expect(result.metadata.timestamp).toBeTruthy();

    // Verify all stages are present
    const stageNames = result.metadata.stages.map(s => s.stage);
    expect(stageNames).toContain('Stage 0: Memory Init');
    expect(stageNames).toContain('Stage 1: Mention Extraction');
    expect(stageNames).toContain('Stage 2: Coreference Resolution');
    expect(stageNames).toContain('Stage 3: Event & Relation Extraction');
    expect(stageNames).toContain('Stage 4: Scope Planning');
    expect(stageNames).toContain('Stage 5: DRS Builder');
    expect(stageNames).toContain('Stage 6: DRS Validation');
  }, 180000);

  test('should process sentence with quantifier', async () => {
    const text = 'Every student read a book.';

    const result = await orchestrator.run(text);

    // Verify success
    expect(result.success).toBe(true);

    // Verify quantifiers in DRS conditions
    const quantifierConditions = result.drs.conditions.filter(c =>
      c.rel === 'Every' || c.rel === 'Some'
    );
    expect(quantifierConditions.length).toBeGreaterThan(0);

    // Verify validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
  }, 180000);

  test('should process sentence with coreference', async () => {
    const text = 'John met Mary. She smiled.';

    const result = await orchestrator.run(text);

    // Verify success
    expect(result.success).toBe(true);

    // Verify multiple sentences
    expect(result.memory.sentences.length).toBe(2);

    // Verify entities (at least 2: John, Mary)
    expect(result.memory.entities.length).toBeGreaterThan(1);

    // Verify events (at least 2: met, smiled)
    expect(result.memory.events.length).toBeGreaterThan(1);

    // Verify validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
  }, 180000);

  test('should process sentence with negation', async () => {
    const text = 'Bob does not run.';

    const result = await orchestrator.run(text);

    // Verify success
    expect(result.success).toBe(true);

    // Verify negation operator in scope plan
    const negationOps = result.scopePlan.ops.filter(op => op.kind === 'Not');
    expect(negationOps.length).toBeGreaterThan(0);

    // Verify negation in DRS conditions
    const negationConditions = result.drs.conditions.filter(c => c.rel === 'Not');
    expect(negationConditions.length).toBeGreaterThan(0);

    // Verify validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
  }, 180000);

  test('should process conditional sentence', async () => {
    const text = 'If Bob runs, Alice reads.';

    const result = await orchestrator.run(text);

    // Verify success
    expect(result.success).toBe(true);

    // Verify conditional operator in scope plan
    const conditionalOps = result.scopePlan.ops.filter(op => op.kind === 'If');
    expect(conditionalOps.length).toBeGreaterThan(0);

    // Verify conditional in DRS conditions (Imp relation)
    const conditionalConditions = result.drs.conditions.filter(c => c.rel === 'Imp');
    expect(conditionalConditions.length).toBeGreaterThan(0);

    // Verify validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
  }, 180000);
});
