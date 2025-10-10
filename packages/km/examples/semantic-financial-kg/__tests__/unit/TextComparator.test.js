/**
 * Unit tests for TextComparator
 *
 * Tests LLM-based semantic comparison of original and reconstructed texts
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { TextComparator } from '../../src/verification/TextComparator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('TextComparator', () => {
  let resourceManager;
  let llmClient;
  let comparator;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create comparator
    comparator = new TextComparator(llmClient);
  }, 60000);

  test('should detect perfect match between identical texts', async () => {
    const originalText = 'Acme Corporation has reserves of 5.2 billion for 2023.';
    const reconstructedText = 'Acme Corporation has reserves of 5.2 billion for 2023.';

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result.similarityScore).toBeGreaterThanOrEqual(0.9);
    expect(result.factsMatch).toBe(true);
    expect(result.missingFacts).toHaveLength(0);
    expect(result.incorrectFacts).toHaveLength(0);
    expect(result.assessment).toBeDefined();
    expect(typeof result.assessment).toBe('string');
  }, 30000);

  test('should detect semantic match with different wording', async () => {
    const originalText = 'JPMorgan Chase set aside 3.7 billion in litigation reserves in 2012.';
    const reconstructedText = 'In 2012, JPMorgan Chase established litigation reserves totaling 3.7 billion.';

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result.similarityScore).toBeGreaterThanOrEqual(0.7);
    expect(result.factsMatch).toBe(true);
    expect(result.assessment).toBeDefined();
  }, 30000);

  test('should detect missing facts', async () => {
    const originalText = 'Acme Corporation has reserves of 5.2 billion for 2023 and 6.1 billion for 2024.';
    const reconstructedText = 'Acme Corporation has reserves of 5.2 billion for 2023.';

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result.similarityScore).toBeLessThan(1.0);
    expect(result.missingFacts.length).toBeGreaterThan(0);
    expect(result.assessment).toBeDefined();
  }, 30000);

  test('should detect incorrect facts', async () => {
    const originalText = 'Acme Corporation has reserves of 5.2 billion for 2023.';
    const reconstructedText = 'Acme Corporation has reserves of 8.5 billion for 2023.';

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result.similarityScore).toBeLessThan(0.9);
    expect(result.factsMatch).toBe(false);
    expect(result.incorrectFacts.length).toBeGreaterThan(0);
    expect(result.assessment).toBeDefined();
  }, 30000);

  test('should handle complex financial text comparison', async () => {
    const originalText = `JPMorgan Chase reported litigation reserves of 3.7 billion dollars
      in 2012, primarily related to mortgage-backed securities claims.`;
    const reconstructedText = `In 2012, JPMorgan Chase had litigation reserves of 3.7 billion.`;

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result).toBeDefined();
    expect(result.similarityScore).toBeGreaterThanOrEqual(0.0);
    expect(result.similarityScore).toBeLessThanOrEqual(1.0);
    expect(typeof result.factsMatch).toBe('boolean');
    expect(Array.isArray(result.missingFacts)).toBe(true);
    expect(Array.isArray(result.incorrectFacts)).toBe(true);
    expect(result.assessment).toBeDefined();
  }, 30000);

  test('should verify texts with threshold', async () => {
    const originalText = 'Acme Corporation has reserves of 5.2 billion for 2023.';
    const reconstructedText = 'Acme has 5.2 billion in reserves for year 2023.';

    const isMatch = await comparator.verify(originalText, reconstructedText, 0.7);

    expect(typeof isMatch).toBe('boolean');
    expect(isMatch).toBe(true);
  }, 30000);

  test('should fail verification for significantly different texts', async () => {
    const originalText = 'Acme Corporation has reserves of 5.2 billion for 2023.';
    const reconstructedText = 'XYZ Company has reserves of 10 billion for 2024.';

    const isMatch = await comparator.verify(originalText, reconstructedText, 0.7);

    expect(isMatch).toBe(false);
  }, 30000);

  test('should normalize similarity score to 0-1 range', async () => {
    const originalText = 'Test text with some facts.';
    const reconstructedText = 'Similar test text with facts.';

    const result = await comparator.compare(originalText, reconstructedText);

    expect(result.similarityScore).toBeGreaterThanOrEqual(0.0);
    expect(result.similarityScore).toBeLessThanOrEqual(1.0);
  }, 30000);
});
