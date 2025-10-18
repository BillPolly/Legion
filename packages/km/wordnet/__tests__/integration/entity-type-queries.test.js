/**
 * Integration tests for entity type queries
 *
 * Uses REAL resources:
 * - Real SemanticSearch/Qdrant (from ResourceManager)
 * - Real embeddings
 * - Real indexed collections
 *
 * NO MOCKS per CLAUDE.md requirements
 * FAIL FAST if resources unavailable
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '../../src/semantic/SemanticInventoryService.js';

describe('Entity Type Queries Integration', () => {
  let resourceManager;
  let service;

  beforeAll(async () => {
    // Get ResourceManager (NO timeout, FAIL FAST)
    resourceManager = await ResourceManager.getInstance();

    // Create and initialize service
    service = new SemanticInventoryService(resourceManager);
    await service.initialize();
  }, 60000);

  test('should return entity types for person-related text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'John is a student who works at a company',
      { limit: 20, threshold: 0.3 }
    );

    expect(types).toBeDefined();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);

    // Should find PERSON in results
    expect(types).toContain('PERSON');

    // All results should be strings
    types.forEach(type => {
      expect(typeof type).toBe('string');
    });
  }, 30000);

  test('should return entity types for location-related text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'Paris is a beautiful city with many museums',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find LOCATION in results
    expect(types).toContain('LOCATION');
  }, 30000);

  test('should return entity types for organization-related text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'Microsoft is a technology company',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find ORGANIZATION in results
    expect(types).toContain('ORGANIZATION');
  }, 30000);

  test('should return entity types for artifact-related text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'The ancient vase is a valuable artifact',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find ARTIFACT in results
    expect(types).toContain('ARTIFACT');
  }, 30000);

  test('should return entity types for event-related text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'The concert was a major event',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find EVENT in results
    expect(types).toContain('EVENT');
  }, 30000);

  test('should respect limit parameter', async () => {
    const types = await service.semanticSearchEntityTypes(
      'people and places',
      { limit: 5, threshold: 0.3 }
    );

    expect(types.length).toBeLessThanOrEqual(5);
  }, 30000);

  test('should respect threshold parameter', async () => {
    // High threshold should return fewer results
    const strictTypes = await service.semanticSearchEntityTypes(
      'people',
      { limit: 20, threshold: 0.8 }
    );

    // Low threshold should return more results
    const lenientTypes = await service.semanticSearchEntityTypes(
      'people',
      { limit: 20, threshold: 0.2 }
    );

    expect(lenientTypes.length).toBeGreaterThanOrEqual(strictTypes.length);
  }, 30000);

  test('should handle mixed entity types in text', async () => {
    const types = await service.semanticSearchEntityTypes(
      'John works at Microsoft in Seattle and attended the conference',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find multiple relevant types
    const hasPersonOrOrg = types.includes('PERSON') || types.includes('ORGANIZATION');
    const hasLocationOrEvent = types.includes('LOCATION') || types.includes('EVENT');

    expect(hasPersonOrOrg).toBe(true);
    expect(hasLocationOrEvent).toBe(true);
  }, 30000);

  test('should use default options if not provided', async () => {
    const types = await service.semanticSearchEntityTypes('person');

    expect(types).toBeDefined();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
  }, 30000);

  test('should return appropriate types for abstract concepts', async () => {
    const types = await service.semanticSearchEntityTypes(
      'time and space',
      { limit: 20, threshold: 0.3 }
    );

    expect(types.length).toBeGreaterThan(0);

    // Should find abstract entity types
    const labels = types.join(' ').toLowerCase();
    const hasAbstractTypes = labels.includes('time') ||
                            labels.includes('location') ||
                            labels.includes('abstraction');

    expect(hasAbstractTypes).toBe(true);
  }, 30000);
});
