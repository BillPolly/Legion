/**
 * Unit tests for EntityRelationshipExtractor
 *
 * Tests extraction of entities and relationships from raw text using LLM
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { EntityRelationshipExtractor } from '../../src/extraction/EntityRelationshipExtractor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('EntityRelationshipExtractor', () => {
  let resourceManager;
  let llmClient;
  let extractor;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create extractor with real LLM
    extractor = new EntityRelationshipExtractor(llmClient);
  }, 60000);

  test('should extract entities and relationships from raw text with context', async () => {
    const rawText = "Acme had big reserves last year";
    const context = {
      company: "Acme Corp",
      year: 2023
    };

    const result = await extractor.extract(rawText, context);

    // Verify structure
    expect(result).toBeDefined();
    expect(result.entities).toBeDefined();
    expect(Array.isArray(result.entities)).toBe(true);
    expect(result.relationships).toBeDefined();
    expect(Array.isArray(result.relationships)).toBe(true);

    // Should extract company entity (from text or context)
    const companyEntity = result.entities.find(e =>
      e.name.toLowerCase().includes('acme')
    );
    expect(companyEntity).toBeDefined();
    expect(companyEntity.type).toBeDefined();
    // LLMs may attribute to either text or context - both acceptable
    expect(['text', 'context']).toContain(companyEntity.source);

    // Should extract reserves entity (from text)
    const reserveEntity = result.entities.find(e =>
      e.name.toLowerCase().includes('reserve')
    );
    expect(reserveEntity).toBeDefined();
    expect(reserveEntity.type).toBeDefined();
    expect(reserveEntity.source).toBe('text');

    // Should extract year entity (from context)
    const yearEntity = result.entities.find(e =>
      e.name === '2023' || e.name.includes('2023')
    );
    expect(yearEntity).toBeDefined();
    expect(yearEntity.type).toBeDefined();

    // Should extract relationship between company and reserves
    const hasRelationship = result.relationships.find(r =>
      r.subject.toLowerCase().includes('acme') &&
      r.object.toLowerCase().includes('reserve')
    );
    expect(hasRelationship).toBeDefined();
    expect(hasRelationship.relation).toBeDefined();
  });

  test('should extract entities and relationships from complex financial text', async () => {
    const rawText = "The current year included expense of $3.7 billion for additional litigation reserves";
    const context = {
      company: "JPMorgan Chase & Co.",
      fiscalYear: 2012,
      documentYear: 2013,
      source: "JPMorgan 2013 Annual Report"
    };

    const result = await extractor.extract(rawText, context);

    // Should extract company (from context)
    const companyEntity = result.entities.find(e =>
      e.name.toLowerCase().includes('jpmorgan')
    );
    expect(companyEntity).toBeDefined();
    expect(companyEntity.source).toBe('context');

    // Should extract reserves (from text)
    const reserveEntity = result.entities.find(e =>
      e.name.toLowerCase().includes('reserve')
    );
    expect(reserveEntity).toBeDefined();
    expect(reserveEntity.source).toBe('text');

    // Should extract amount (from text)
    const amountEntity = result.entities.find(e =>
      e.name.includes('3.7') || e.name.includes('billion')
    );
    expect(amountEntity).toBeDefined();
    expect(amountEntity.source).toBe('text');

    // Should extract year (from context - "current year" = fiscal year)
    const yearEntity = result.entities.find(e =>
      e.name === '2012' || e.name.includes('2012')
    );
    expect(yearEntity).toBeDefined();

    // Should have at least 3 relationships
    expect(result.relationships.length).toBeGreaterThanOrEqual(3);
  });

  test('should handle simple financial fact', async () => {
    const rawText = "TechCo reserves increased to $8.5 million in 2024";
    const context = {
      company: "TechCo Inc.",
      year: 2024
    };

    const result = await extractor.extract(rawText, context);

    // Should extract all entities
    expect(result.entities.length).toBeGreaterThanOrEqual(3);

    // Should extract company
    const companyEntity = result.entities.find(e =>
      e.name.toLowerCase().includes('techco')
    );
    expect(companyEntity).toBeDefined();

    // Should extract amount
    const amountEntity = result.entities.find(e =>
      e.name.includes('8.5') || e.name.includes('million')
    );
    expect(amountEntity).toBeDefined();

    // Should have relationships
    expect(result.relationships.length).toBeGreaterThan(0);
  });
});
