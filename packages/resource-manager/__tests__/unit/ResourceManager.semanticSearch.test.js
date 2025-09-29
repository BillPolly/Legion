/**
 * Unit tests for ResourceManager semantic search integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('ResourceManager - Semantic Search Integration', () => {
  let resourceManager;

  beforeEach(async () => {
    // Get fresh ResourceManager instance
    resourceManager = await ResourceManager.getInstance();

    // Clear any cached semantic search instance
    if (resourceManager._handleSemanticSearch) {
      delete resourceManager._handleSemanticSearch;
    }
    if (resourceManager._resources.has('handleSemanticSearch')) {
      resourceManager._resources.delete('handleSemanticSearch');
    }
  });

  describe('createHandleSemanticSearch()', () => {
    it('should create HandleSemanticSearchManager instance', async () => {
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

    it('should initialize with all required components', async () => {
      const semanticSearch = await resourceManager.createHandleSemanticSearch();

      expect(semanticSearch.resourceManager).toBe(resourceManager);
      expect(semanticSearch.metadataExtractor).toBeDefined();
      expect(semanticSearch.glossGenerator).toBeDefined();
      expect(semanticSearch.vectorStore).toBeDefined();
    }, 120000);

    it('should support force recreation with config.force', async () => {
      const first = await resourceManager.createHandleSemanticSearch();
      const second = await resourceManager.createHandleSemanticSearch({ force: true });

      // Should be different instances when forced
      expect(first).not.toBe(second);

      // But both should be valid managers
      expect(typeof first.storeHandle).toBe('function');
      expect(typeof second.storeHandle).toBe('function');
    }, 120000);
  });

  describe('get() method lazy initialization', () => {
    it('should create semantic search on first get()', async () => {
      const semanticSearch = await resourceManager.get('handleSemanticSearch');

      expect(semanticSearch).toBeDefined();
      expect(typeof semanticSearch.storeHandle).toBe('function');
    }, 120000);

    it('should return cached instance on subsequent get() calls', async () => {
      const first = await resourceManager.get('handleSemanticSearch');
      const second = await resourceManager.get('handleSemanticSearch');

      expect(first).toBe(second);
    }, 120000);

    it('should return same instance from get() and createHandleSemanticSearch()', async () => {
      const fromGet = await resourceManager.get('handleSemanticSearch');
      const fromCreate = await resourceManager.createHandleSemanticSearch();

      expect(fromGet).toBe(fromCreate);
    }, 120000);
  });

  describe('has() method', () => {
    it('should return false before semantic search is created', () => {
      const exists = resourceManager.has('handleSemanticSearch');
      expect(exists).toBe(false);
    });

    it('should return true after semantic search is created', async () => {
      await resourceManager.get('handleSemanticSearch');

      const exists = resourceManager.has('handleSemanticSearch');
      expect(exists).toBe(true);
    }, 120000);
  });
});