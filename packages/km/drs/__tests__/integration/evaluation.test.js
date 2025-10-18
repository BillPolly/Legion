/**
 * Integration tests for DRS Evaluation (DRS-to-Text + Semantic Equivalence)
 *
 * Tests FULL round-trip with REAL LLM:
 * 1. Text → DRS (using DRSOrchestrator)
 * 2. DRS → Paraphrase (using DRSToText - deterministic)
 * 3. Original vs Paraphrase comparison (using SemanticEquivalenceEvaluator - LLM)
 *
 * NO MOCKS - Full end-to-end integration test.
 */
import { ResourceManager } from '@legion/resource-manager';
import { DRSOrchestrator } from '../../src/DRSOrchestrator.js';
import { DRSToText } from '../../src/utils/DRSToText.js';
import { SemanticEquivalenceEvaluator } from '../../src/utils/SemanticEquivalenceEvaluator.js';

describe('DRS Evaluation Integration (REAL LLM)', () => {
  let resourceManager;
  let orchestrator;
  let drsToText;
  let evaluator;
  let llmClient;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    orchestrator = new DRSOrchestrator(resourceManager);
    await orchestrator.initialize();

    drsToText = new DRSToText();
    evaluator = new SemanticEquivalenceEvaluator(llmClient);
  }, 60000);

  test('should evaluate simple sentence round-trip', async () => {
    const text = 'Alice reads.';

    // Step 1: Text → DRS
    const drsResult = await orchestrator.run(text);
    expect(drsResult.success).toBe(true);
    expect(drsResult.drs).toBeTruthy();

    // Step 2: DRS → Paraphrase (deterministic)
    const paraphrase = drsToText.generateParaphrase(drsResult.drs);
    expect(paraphrase).toBeTruthy();
    expect(typeof paraphrase).toBe('string');

    // Step 3: Evaluate semantic equivalence (REAL LLM)
    const evaluation = await evaluator.evaluate(text, paraphrase);

    expect(evaluation).toBeTruthy();
    expect(typeof evaluation.equivalent).toBe('boolean');
    expect(evaluation.confidence).toBeGreaterThanOrEqual(0.0);
    expect(evaluation.confidence).toBeLessThanOrEqual(1.0);
    expect(evaluation.explanation).toBeTruthy();
    expect(typeof evaluation.explanation).toBe('string');
    expect(evaluation.explanation.length).toBeGreaterThan(10);
  }, 180000);

  test('should evaluate quantified sentence round-trip', async () => {
    const text = 'Every student read a book.';

    // Full round-trip
    const drsResult = await orchestrator.run(text);
    expect(drsResult.success).toBe(true);

    const paraphrase = drsToText.generateParaphrase(drsResult.drs);
    expect(paraphrase).toBeTruthy();

    const evaluation = await evaluator.evaluate(text, paraphrase);

    expect(evaluation.equivalent).toBeDefined();
    expect(evaluation.confidence).toBeGreaterThanOrEqual(0.0);
    expect(evaluation.confidence).toBeLessThanOrEqual(1.0);
    expect(evaluation.explanation).toBeTruthy();
  }, 180000);

  test('should evaluate negated sentence round-trip', async () => {
    const text = 'Bob does not run.';

    // Full round-trip
    const drsResult = await orchestrator.run(text);
    expect(drsResult.success).toBe(true);

    const paraphrase = drsToText.generateParaphrase(drsResult.drs);
    expect(paraphrase).toBeTruthy();
    // Paraphrase should contain negation
    expect(paraphrase.toLowerCase()).toMatch(/not|does not|doesn't/);

    const evaluation = await evaluator.evaluate(text, paraphrase);

    expect(evaluation.equivalent).toBeDefined();
    expect(evaluation.confidence).toBeGreaterThanOrEqual(0.0);
    expect(evaluation.explanation).toBeTruthy();
  }, 180000);

  test('should evaluate conditional sentence round-trip', async () => {
    const text = 'If Bob runs, Alice reads.';

    // Full round-trip
    const drsResult = await orchestrator.run(text);
    expect(drsResult.success).toBe(true);

    const paraphrase = drsToText.generateParaphrase(drsResult.drs);
    expect(paraphrase).toBeTruthy();
    // Paraphrase should contain conditional
    expect(paraphrase.toLowerCase()).toMatch(/if|then/);

    const evaluation = await evaluator.evaluate(text, paraphrase);

    expect(evaluation.equivalent).toBeDefined();
    expect(evaluation.confidence).toBeGreaterThanOrEqual(0.0);
    expect(evaluation.explanation).toBeTruthy();
  }, 180000);

  test('should provide evaluation metadata', async () => {
    const text = 'Alice reads.';

    const drsResult = await orchestrator.run(text);
    const paraphrase = drsToText.generateParaphrase(drsResult.drs);
    const evaluation = await evaluator.evaluate(text, paraphrase);

    // Verify all evaluation fields are present
    expect(evaluation).toHaveProperty('equivalent');
    expect(evaluation).toHaveProperty('confidence');
    expect(evaluation).toHaveProperty('explanation');

    // Verify types
    expect(typeof evaluation.equivalent).toBe('boolean');
    expect(typeof evaluation.confidence).toBe('number');
    expect(typeof evaluation.explanation).toBe('string');
  }, 180000);
});
