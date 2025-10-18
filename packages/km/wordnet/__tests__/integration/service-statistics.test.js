/**
 * Integration tests for SemanticInventoryService statistics
 *
 * Uses REAL resources:
 * - Real SemanticSearch/Qdrant (from ResourceManager)
 * - Real indexed collections
 *
 * NO MOCKS per CLAUDE.md requirements
 * FAIL FAST if resources unavailable
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '../../src/semantic/SemanticInventoryService.js';

describe('Service Statistics Integration', () => {
  let resourceManager;
  let service;

  beforeAll(async () => {
    // Get ResourceManager (NO timeout, FAIL FAST)
    resourceManager = await ResourceManager.getInstance();

    // Create and initialize service
    service = new SemanticInventoryService(resourceManager);
    await service.initialize();
  }, 60000);

  test('should return statistics from all collections', async () => {
    const stats = await service.getStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('entityTypes');
    expect(stats).toHaveProperty('semanticRoles');
    expect(stats).toHaveProperty('unaryPredicates');
    expect(stats).toHaveProperty('binaryRelations');
    expect(stats).toHaveProperty('total');

    // All properties should be numbers
    expect(typeof stats.entityTypes).toBe('number');
    expect(typeof stats.semanticRoles).toBe('number');
    expect(typeof stats.unaryPredicates).toBe('number');
    expect(typeof stats.binaryRelations).toBe('number');
    expect(typeof stats.total).toBe('number');
  }, 30000);

  test('should have correct counts for indexed collections', async () => {
    const stats = await service.getStats();

    // Expected counts from Phase 2 indexing
    expect(stats.entityTypes).toBe(20);
    expect(stats.semanticRoles).toBe(15);
    expect(stats.binaryRelations).toBe(28);

    // Predicates collection is deferred (not indexed yet)
    expect(stats.unaryPredicates).toBe(0);
  }, 30000);

  test('should calculate total correctly', async () => {
    const stats = await service.getStats();

    const calculatedTotal = stats.entityTypes + stats.semanticRoles + stats.unaryPredicates + stats.binaryRelations;

    expect(stats.total).toBe(calculatedTotal);
    expect(stats.total).toBe(63); // 20 + 15 + 0 + 28
  }, 30000);

  test('should return non-negative counts', async () => {
    const stats = await service.getStats();

    expect(stats.entityTypes).toBeGreaterThanOrEqual(0);
    expect(stats.semanticRoles).toBeGreaterThanOrEqual(0);
    expect(stats.unaryPredicates).toBeGreaterThanOrEqual(0);
    expect(stats.binaryRelations).toBeGreaterThanOrEqual(0);
    expect(stats.total).toBeGreaterThanOrEqual(0);
  }, 30000);

  test('should have required collections indexed', async () => {
    const stats = await service.getStats();

    // Required collections must have data
    expect(stats.entityTypes).toBeGreaterThan(0);
    expect(stats.semanticRoles).toBeGreaterThan(0);
    expect(stats.binaryRelations).toBeGreaterThan(0);
  }, 30000);

  test('should throw if called before initialize', async () => {
    const uninitializedService = new SemanticInventoryService(resourceManager);

    await expect(uninitializedService.getStats()).rejects.toThrow(
      'SemanticInventoryService not initialized'
    );
  });
});
