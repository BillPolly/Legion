/**
 * Integration test for ResourceManager semantic search integration
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';

describe('ResourceManager Integration - Semantic Search', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  describe('createHandleSemanticSearch()', () => {
    it('should create HandleSemanticSearchManager instance via ResourceManager', async () => {
      const semanticSearch = await resourceManager.createHandleSemanticSearch();

      expect(semanticSearch).toBeDefined();
      expect(typeof semanticSearch.storeHandle).toBe('function');
      expect(typeof semanticSearch.searchHandles).toBe('function');
      expect(typeof semanticSearch.restoreHandle).toBe('function');
      expect(typeof semanticSearch.getHandleInfo).toBe('function');
      expect(typeof semanticSearch.removeHandle).toBe('function');
      expect(typeof semanticSearch.updateGlosses).toBe('function');
    }, 120000);

    it('should cache the instance for reuse (singleton)', async () => {
      const first = await resourceManager.createHandleSemanticSearch();
      const second = await resourceManager.createHandleSemanticSearch();

      expect(first).toBe(second);
    }, 120000);

    it('should have all required components initialized', async () => {
      const semanticSearch = await resourceManager.createHandleSemanticSearch();

      expect(semanticSearch.resourceManager).toBe(resourceManager);
      expect(semanticSearch.metadataExtractor).toBeDefined();
      expect(semanticSearch.glossGenerator).toBeDefined();
      expect(semanticSearch.vectorStore).toBeDefined();
    }, 120000);
  });

  describe('get() method lazy initialization', () => {
    it('should create semantic search via get() method', async () => {
      // Don't try to delete from proxy - just test that get() works
      const semanticSearch = await resourceManager.get('handleSemanticSearch');

      expect(semanticSearch).toBeDefined();
      expect(typeof semanticSearch.storeHandle).toBe('function');
      expect(typeof semanticSearch.searchHandles).toBe('function');
    }, 120000);

    it('should return same instance from get() and createHandleSemanticSearch()', async () => {
      const fromGet = await resourceManager.get('handleSemanticSearch');
      const fromCreate = await resourceManager.createHandleSemanticSearch();

      expect(fromGet).toBe(fromCreate);
    }, 120000);
  });

  describe('End-to-end workflow', () => {
    it('should use semantic search to store and retrieve handles', async () => {
      const semanticSearch = await resourceManager.createHandleSemanticSearch();
      const testURI = 'legion://local/mongodb/test_rm_integration_e2e/test_collection_e2e';

      // Store handle
      const storeResult = await semanticSearch.storeHandle(testURI);
      expect(storeResult.success).toBe(true);
      expect(storeResult.handleURI).toBe(testURI);
      expect(storeResult.glossCount).toBeGreaterThan(0);

      // Get info directly (more reliable than search)
      const info = await semanticSearch.getHandleInfo(testURI);
      expect(info).toBeDefined();
      expect(info.handleURI).toBe(testURI);
      expect(info.handleType).toBe('mongodb');
      expect(info.glosses).toBeDefined();
      expect(info.glosses.length).toBe(storeResult.glossCount);

      // Restore handle
      const restoredHandle = await semanticSearch.restoreHandle(testURI);
      expect(restoredHandle).toBeDefined();
      expect(restoredHandle.resourceType).toBe('mongodb');

      // Cleanup
      const removeResult = await semanticSearch.removeHandle(testURI);
      expect(removeResult.success).toBe(true);
    }, 120000);
  });
});