/**
 * Unit tests for SemanticEquivalenceEvaluator
 *
 * Tests LLM-based semantic evaluation with mocked responses.
 */
import { SemanticEquivalenceEvaluator } from '../../src/utils/SemanticEquivalenceEvaluator.js';

describe('SemanticEquivalenceEvaluator', () => {
  let mockLLMClient;
  let evaluator;

  beforeEach(() => {
    // Mock LLM client
    mockLLMClient = {
      complete: async (prompt) => {
        // Return mock response based on prompt content
        return { response: '' }; // Will be replaced by specific tests
      }
    };

    evaluator = new SemanticEquivalenceEvaluator(mockLLMClient);
  });

  test('should evaluate equivalent texts as equivalent', async () => {
    // Mock LLM response: equivalent
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: true,
      confidence: 0.95,
      explanation: 'Both texts describe the same reading event with the same participants.'
    });

    const result = await evaluator.evaluate(
      'Alice reads a book.',
      'Alice reads a book.'
    );

    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.explanation).toBeTruthy();
    expect(typeof result.explanation).toBe('string');
  });

  test('should evaluate non-equivalent texts as non-equivalent', async () => {
    // Mock LLM response: not equivalent
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: false,
      confidence: 1.0,
      explanation: 'The original states Bob does NOT run, but the paraphrase states Bob runs - opposite meanings.'
    });

    const result = await evaluator.evaluate(
      'Bob does not run.',
      'Bob runs.'
    );

    expect(result.equivalent).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.explanation).toBeTruthy();
  });

  test('should handle texts with different wording but same meaning', async () => {
    // Mock LLM response: equivalent despite different wording
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: true,
      confidence: 0.9,
      explanation: 'Both describe the same action, just with different vocabulary.'
    });

    const result = await evaluator.evaluate(
      'Alice reads.',
      'A person reads.'
    );

    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.0);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  test('should handle quantifier preservation', async () => {
    // Mock LLM response: equivalent with quantifiers
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: true,
      confidence: 0.95,
      explanation: 'Universal quantifier "every" is preserved in both texts.'
    });

    const result = await evaluator.evaluate(
      'Every student read a book.',
      'Every student read a book.'
    );

    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('should detect missing quantifiers', async () => {
    // Mock LLM response: not equivalent due to missing quantifier
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: false,
      confidence: 0.9,
      explanation: 'Original has universal quantifier "every" which is missing in the paraphrase.'
    });

    const result = await evaluator.evaluate(
      'Every student reads.',
      'A student reads.'
    );

    expect(result.equivalent).toBe(false);
  });

  test('should handle conditional preservation', async () => {
    // Mock LLM response: equivalent with conditional
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: true,
      confidence: 0.85,
      explanation: 'The conditional structure (if-then) is preserved in both texts.'
    });

    const result = await evaluator.evaluate(
      'If Bob runs, Alice reads.',
      'If a person runs then a person reads.'
    );

    expect(result.equivalent).toBe(true);
  });

  test('should return confidence score in valid range', async () => {
    // Mock LLM response with confidence score
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: true,
      confidence: 0.75,
      explanation: 'Texts are similar but with minor differences.'
    });

    const result = await evaluator.evaluate(
      'Alice reads.',
      'Alice is reading.'
    );

    expect(result.confidence).toBeGreaterThanOrEqual(0.0);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  test('should provide explanation for judgment', async () => {
    // Mock LLM response with explanation
    mockLLMClient.complete = async () => JSON.stringify({
      equivalent: false,
      confidence: 0.95,
      explanation: 'The roles are reversed - Alice and Bob swap positions as agent and patient.'
    });

    const result = await evaluator.evaluate(
      'Alice gave Bob a book.',
      'Bob gave Alice a book.'
    );

    expect(result.explanation).toBeTruthy();
    expect(result.explanation.length).toBeGreaterThan(10);
    expect(typeof result.explanation).toBe('string');
  });
});
