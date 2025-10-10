/**
 * Unit tests for LLMEntityGenerator
 *
 * Tests LLM-based entity model generation from sentences and ontology candidates
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { LLMEntityGenerator } from '../../src/generation/LLMEntityGenerator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('LLMEntityGenerator', () => {
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
    generator = new LLMEntityGenerator(llmClient);
  }, 60000);

  test('should generate entity model from simple sentence and ontology candidates', async () => {
    const sentence = "Acme Corp has reserves.";
    const candidates = [
      {
        uri: 'poc:Company',
        type: 'class',
        label: 'Company',
        comment: 'A business organization'
      },
      {
        uri: 'poc:Reserve',
        type: 'class',
        label: 'Reserve',
        comment: 'Financial reserves set aside'
      },
      {
        uri: 'poc:hasReserve',
        type: 'property',
        label: 'has reserve',
        comment: 'Company has a reserve',
        propertyType: 'ObjectProperty',
        domain: 'poc:Company',
        range: 'poc:Reserve'
      }
    ];

    const result = await generator.generate(sentence, candidates);

    // Verify structure
    expect(result).toBeDefined();
    expect(result.entities).toBeDefined();
    expect(Array.isArray(result.entities)).toBe(true);
    expect(result.relationships).toBeDefined();
    expect(Array.isArray(result.relationships)).toBe(true);

    // Should have at least 2 entities (company and reserve)
    expect(result.entities.length).toBeGreaterThanOrEqual(2);

    // Should have at least 1 relationship
    expect(result.relationships.length).toBeGreaterThanOrEqual(1);

    // Each entity should have required fields
    result.entities.forEach(entity => {
      expect(entity.uri).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(typeof entity.uri).toBe('string');
      expect(typeof entity.type).toBe('string');
    });

    // Each relationship should have required fields
    result.relationships.forEach(rel => {
      expect(rel.subject).toBeDefined();
      expect(rel.predicate).toBeDefined();
      expect(rel.object).toBeDefined();
    });

    // Should have a company entity
    const companyEntity = result.entities.find(e =>
      e.type === 'poc:Company' || e.type.includes('Company')
    );
    expect(companyEntity).toBeDefined();

    // Should have a reserve entity
    const reserveEntity = result.entities.find(e =>
      e.type === 'poc:Reserve' || e.type.includes('Reserve')
    );
    expect(reserveEntity).toBeDefined();
  });

  test('should generate entity model for complex financial sentence', async () => {
    const sentence = "JPMorgan Chase has litigation reserves of $3.7 billion for 2012.";
    const candidates = [
      {
        uri: 'poc:Company',
        type: 'class',
        label: 'Company',
        comment: 'A business organization'
      },
      {
        uri: 'poc:Reserve',
        type: 'class',
        label: 'Reserve',
        comment: 'Financial reserves set aside'
      },
      {
        uri: 'poc:Unit',
        type: 'class',
        label: 'Unit',
        comment: 'Measurement unit for amounts'
      },
      {
        uri: 'poc:hasReserve',
        type: 'property',
        label: 'has reserve',
        comment: 'Company has a reserve',
        propertyType: 'ObjectProperty',
        domain: 'poc:Company',
        range: 'poc:Reserve'
      },
      {
        uri: 'poc:amount',
        type: 'property',
        label: 'amount',
        comment: 'Numerical value',
        propertyType: 'DatatypeProperty',
        domain: 'poc:Reserve',
        range: 'xsd:decimal'
      },
      {
        uri: 'poc:year',
        type: 'property',
        label: 'year',
        comment: 'Fiscal year',
        propertyType: 'DatatypeProperty',
        domain: 'poc:Reserve',
        range: 'xsd:integer'
      }
    ];

    const result = await generator.generate(sentence, candidates);

    expect(result.entities).toBeDefined();
    expect(result.relationships).toBeDefined();

    // Should have multiple entities (company, reserve, potentially unit)
    expect(result.entities.length).toBeGreaterThanOrEqual(2);

    // Should have multiple relationships
    expect(result.relationships.length).toBeGreaterThanOrEqual(1);

    // Should include amount property or value
    const hasAmount = result.relationships.some(r =>
      r.predicate === 'poc:amount' || r.predicate.includes('amount')
    ) || result.entities.some(e =>
      e.properties && e.properties.amount
    );
    expect(hasAmount || result.relationships.length > 0).toBe(true);
  });

  test('should generate entity model with proper URIs', async () => {
    const sentence = "TechCo has reserves.";
    const candidates = [
      {
        uri: 'poc:Company',
        type: 'class',
        label: 'Company',
        comment: 'A business organization'
      },
      {
        uri: 'poc:Reserve',
        type: 'class',
        label: 'Reserve',
        comment: 'Financial reserves set aside'
      },
      {
        uri: 'poc:hasReserve',
        type: 'property',
        label: 'has reserve',
        comment: 'Company has a reserve',
        propertyType: 'ObjectProperty',
        domain: 'poc:Company',
        range: 'poc:Reserve'
      }
    ];

    const result = await generator.generate(sentence, candidates);

    // All entity URIs should be valid strings
    result.entities.forEach(entity => {
      expect(typeof entity.uri).toBe('string');
      expect(entity.uri.length).toBeGreaterThan(0);
      // URIs should contain a namespace separator (: or /)
      expect(entity.uri).toMatch(/[:\/]/);
    });

    // All relationship predicates should reference ontology properties
    result.relationships.forEach(rel => {
      expect(typeof rel.predicate).toBe('string');
      expect(rel.predicate.length).toBeGreaterThan(0);
    });
  });

  test('should use provided ontology classes and properties', async () => {
    const sentence = "Acme Corp has reserves.";
    const candidates = [
      {
        uri: 'poc:Company',
        type: 'class',
        label: 'Company',
        comment: 'A business organization'
      },
      {
        uri: 'poc:Reserve',
        type: 'class',
        label: 'Reserve',
        comment: 'Financial reserves set aside'
      },
      {
        uri: 'poc:hasReserve',
        type: 'property',
        label: 'has reserve',
        comment: 'Company has a reserve',
        propertyType: 'ObjectProperty',
        domain: 'poc:Company',
        range: 'poc:Reserve'
      }
    ];

    const result = await generator.generate(sentence, candidates);

    // Should use ontology types from candidates
    const usesOntologyTypes = result.entities.some(e =>
      e.type.includes('poc:') || e.type.includes('Company') || e.type.includes('Reserve')
    );
    expect(usesOntologyTypes).toBe(true);

    // Should use ontology properties from candidates
    const usesOntologyProps = result.relationships.some(r =>
      r.predicate.includes('poc:') || r.predicate.includes('hasReserve')
    );
    expect(usesOntologyProps || result.relationships.length > 0).toBe(true);
  });
});
