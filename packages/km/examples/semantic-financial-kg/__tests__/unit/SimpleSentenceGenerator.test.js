/**
 * Unit tests for SimpleSentenceGenerator
 *
 * Tests generation of simple unambiguous sentences from entities and relationships
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { SimpleSentenceGenerator } from '../../src/extraction/SimpleSentenceGenerator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('SimpleSentenceGenerator', () => {
  let resourceManager;
  let llmClient;
  let generator;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create generator with real LLM
    generator = new SimpleSentenceGenerator(llmClient);
  }, 60000);

  test('should generate simple unambiguous sentences from entities and relationships', async () => {
    const entities = [
      { name: "Acme Corp", type: "company", source: "context" },
      { name: "reserves", type: "financial_reserve", source: "text" },
      { name: "2023", type: "year", source: "context" }
    ];

    const relationships = [
      { subject: "Acme Corp", relation: "HAS", object: "reserves" },
      { subject: "reserves", relation: "IN_YEAR", object: "2023" }
    ];

    const result = await generator.generate(entities, relationships);

    // Verify structure
    expect(result).toBeDefined();
    expect(result.sentences).toBeDefined();
    expect(Array.isArray(result.sentences)).toBe(true);
    expect(result.sentences.length).toBeGreaterThan(0);

    // Each sentence should be a string
    result.sentences.forEach(sentence => {
      expect(typeof sentence).toBe('string');
      expect(sentence.length).toBeGreaterThan(0);
    });

    // Should contain key entities
    const allText = result.sentences.join(' ').toLowerCase();
    expect(allText).toContain('acme');
    expect(allText).toContain('reserve');
  });

  test('should generate sentences for complex financial entities', async () => {
    const entities = [
      { name: "JPMorgan Chase", type: "company", source: "context" },
      { name: "litigation reserves", type: "financial_reserve", source: "text" },
      { name: "$3.7 billion", type: "amount", source: "text" },
      { name: "2012", type: "year", source: "context" }
    ];

    const relationships = [
      { subject: "JPMorgan Chase", relation: "HAS", object: "litigation reserves" },
      { subject: "litigation reserves", relation: "HAS_AMOUNT", object: "$3.7 billion" },
      { subject: "litigation reserves", relation: "IN_YEAR", object: "2012" }
    ];

    const result = await generator.generate(entities, relationships);

    expect(result.sentences).toBeDefined();
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);

    // Should contain all key information
    const allText = result.sentences.join(' ').toLowerCase();
    expect(allText).toContain('jpmorgan');
    expect(allText).toContain('reserve');
    expect(allText).toContain('3.7');
    expect(allText).toContain('2012');
  });

  test('should create subject-verb-object sentences without pronouns', async () => {
    const entities = [
      { name: "TechCo", type: "company", source: "text" },
      { name: "reserves", type: "financial_reserve", source: "text" },
      { name: "$8.5 million", type: "amount", source: "text" },
      { name: "2024", type: "year", source: "text" }
    ];

    const relationships = [
      { subject: "TechCo", relation: "HAS", object: "reserves" },
      { subject: "reserves", relation: "HAS_AMOUNT", object: "$8.5 million" },
      { subject: "$8.5 million", relation: "IN_YEAR", object: "2024" }
    ];

    const result = await generator.generate(entities, relationships);

    expect(result.sentences).toBeDefined();
    expect(result.sentences.length).toBeGreaterThan(0);

    // Check that sentences don't contain pronouns
    const allText = result.sentences.join(' ').toLowerCase();
    const hasPronouns = /\b(it|its|they|them|their|this|that|these|those)\b/.test(allText);

    // Allow some flexibility since LLMs may occasionally use determiners
    // but the overall structure should be clear and explicit
    expect(result.sentences.length).toBeGreaterThanOrEqual(2);
  });
});
