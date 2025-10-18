/**
 * Integration tests for relation type queries
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

describe('Relation Type Queries Integration', () => {
  let resourceManager;
  let service;

  beforeAll(async () => {
    // Get ResourceManager (NO timeout, FAIL FAST)
    resourceManager = await ResourceManager.getInstance();

    // Create and initialize service
    service = new SemanticInventoryService(resourceManager);
    await service.initialize();
  }, 60000);

  test('should return relation inventory for action text', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'The chef cooked dinner in the kitchen using a knife',
      { limit: 50, threshold: 0.3 }
    );

    expect(inventory).toBeDefined();
    expect(inventory.roles).toBeDefined();
    expect(inventory.unaryPredicates).toBeDefined();
    expect(inventory.binaryRelations).toBeDefined();

    expect(Array.isArray(inventory.roles)).toBe(true);
    expect(Array.isArray(inventory.unaryPredicates)).toBe(true);
    expect(Array.isArray(inventory.binaryRelations)).toBe(true);

    // Should have some results in each category
    expect(inventory.roles.length).toBeGreaterThan(0);
    expect(inventory.binaryRelations.length).toBeGreaterThan(0);
    // Note: predicates collection is empty (deferred), so length = 0 is expected
  }, 30000);

  test('should find Agent role for action text', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'Alice gave Bob a gift',
      { limit: 50, threshold: 0.3 }
    );

    // Should find Agent role (Alice is the agent)
    expect(inventory.roles).toContain('Agent');
  }, 30000);

  test('should find Theme role for action text', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'They moved the table',
      { limit: 50, threshold: 0.3 }
    );

    // Should find Theme role (table is the theme)
    expect(inventory.roles).toContain('Theme');
  }, 30000);

  test('should find Recipient role for transfer actions', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'John sent Mary a letter',
      { limit: 50, threshold: 0.3 }
    );

    // Should find Recipient role (Mary is the recipient)
    expect(inventory.roles).toContain('Recipient');
  }, 30000);

  test('should find Location role for location text', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'They met at the park',
      { limit: 50, threshold: 0.3 }
    );

    // Should find Location role
    expect(inventory.roles).toContain('Location');
  }, 30000);

  test('should find Instrument role for tool usage', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'He cut the bread with a knife',
      { limit: 50, threshold: 0.3 }
    );

    // Should find Instrument role (knife is the instrument)
    expect(inventory.roles).toContain('Instrument');
  }, 30000);

  test('should find spatial relations', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'The book is on the table in the room',
      { limit: 50, threshold: 0.3 }
    );

    // Should find spatial prepositions
    const hasSpatial = inventory.binaryRelations.includes('on') ||
                      inventory.binaryRelations.includes('in');

    expect(hasSpatial).toBe(true);
  }, 30000);

  test('should find temporal relations', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'The meeting happened before lunch but after breakfast',
      { limit: 50, threshold: 0.3 }
    );

    // Should find temporal prepositions
    const hasTemporal = inventory.binaryRelations.includes('before') ||
                       inventory.binaryRelations.includes('after');

    expect(hasTemporal).toBe(true);
  }, 30000);

  test('should respect threshold parameter', async () => {
    // High threshold
    const strictInventory = await service.semanticSearchRelationTypes(
      'agent performing action',
      { limit: 50, threshold: 0.8 }
    );

    // Low threshold
    const lenientInventory = await service.semanticSearchRelationTypes(
      'agent performing action',
      { limit: 50, threshold: 0.2 }
    );

    // Lenient should return more results
    expect(lenientInventory.roles.length).toBeGreaterThanOrEqual(strictInventory.roles.length);
  }, 30000);

  test('should use default options if not provided', async () => {
    const inventory = await service.semanticSearchRelationTypes('action');

    expect(inventory).toBeDefined();
    expect(inventory.roles).toBeDefined();
    expect(Array.isArray(inventory.roles)).toBe(true);
  }, 30000);

  test('should handle complex multi-role scenarios', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'The chef carefully cooked dinner in the kitchen using a sharp knife for the guests yesterday',
      { limit: 50, threshold: 0.3 }
    );

    // Should find multiple roles
    const roles = inventory.roles;
    const hasMultipleRoles = roles.length >= 3;

    expect(hasMultipleRoles).toBe(true);

    // Should include core roles
    const hasCoreRoles = roles.includes('Agent') || roles.includes('Theme');
    expect(hasCoreRoles).toBe(true);
  }, 30000);

  test('should return all three inventory fields populated', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'people doing things in places',
      { limit: 50, threshold: 0.3 }
    );

    // All fields should exist (even if predicates is empty)
    expect(inventory).toHaveProperty('roles');
    expect(inventory).toHaveProperty('unaryPredicates');
    expect(inventory).toHaveProperty('binaryRelations');

    // Roles and relations should have results
    expect(inventory.roles.length).toBeGreaterThan(0);
    expect(inventory.binaryRelations.length).toBeGreaterThan(0);

    // Predicates is expected to be empty (collection not indexed yet)
    expect(inventory.unaryPredicates.length).toBe(0);
  }, 30000);

  test('should return string labels for all results', async () => {
    const inventory = await service.semanticSearchRelationTypes(
      'action with roles and relations',
      { limit: 50, threshold: 0.3 }
    );

    // All results should be strings
    inventory.roles.forEach(role => {
      expect(typeof role).toBe('string');
    });

    inventory.unaryPredicates.forEach(pred => {
      expect(typeof pred).toBe('string');
    });

    inventory.binaryRelations.forEach(rel => {
      expect(typeof rel).toBe('string');
    });
  }, 30000);
});
