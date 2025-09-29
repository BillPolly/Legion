/**
 * Integration test for updateGlosses() operation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { HandleSemanticSearchManager } from '../../src/HandleSemanticSearchManager.js';

describe('UpdateGlosses Integration', () => {
  let resourceManager;
  let searchManager;
  const testHandleURI = 'legion://local/mongodb/test_update_db/test_update_collection';

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Initialize components
    const metadataExtractor = new HandleMetadataExtractor();
    const llmClient = await resourceManager.get('llmClient');
    const glossGenerator = new HandleGlossGenerator(llmClient);
    await glossGenerator.initialize();
    const vectorStore = new HandleVectorStore(resourceManager);
    await vectorStore.initialize();

    searchManager = new HandleSemanticSearchManager(
      resourceManager,
      metadataExtractor,
      glossGenerator,
      vectorStore
    );
  }, 120000);

  describe('Update glosses workflow', () => {
    it('should store, update, and verify updated glosses', async () => {
      // 1. Store initial handle
      const storeResult = await searchManager.storeHandle(testHandleURI);
      expect(storeResult.success).toBe(true);
      expect(storeResult.glossCount).toBeGreaterThan(0);
      const initialVectorIds = storeResult.vectorIds;
      const initialGlossCount = storeResult.glossCount;

      // 2. Get initial handle info
      const initialInfo = await searchManager.getHandleInfo(testHandleURI);
      expect(initialInfo).toBeDefined();
      expect(initialInfo.handleURI).toBe(testHandleURI);
      expect(initialInfo.glosses).toHaveLength(initialGlossCount);

      // 3. Update glosses
      const updateResult = await searchManager.updateGlosses(testHandleURI);
      expect(updateResult.success).toBe(true);
      expect(updateResult.updated).toBe(true);
      expect(updateResult.glossCount).toBeGreaterThan(0);
      expect(updateResult.vectorIds).toBeDefined();
      expect(updateResult.vectorIds.length).toBeGreaterThan(0);

      // Vector IDs should be different (new vectors created)
      expect(updateResult.vectorIds).not.toEqual(initialVectorIds);

      // 4. Verify updated handle info
      const updatedInfo = await searchManager.getHandleInfo(testHandleURI);
      expect(updatedInfo).toBeDefined();
      expect(updatedInfo.handleURI).toBe(testHandleURI);
      expect(updatedInfo.glosses).toHaveLength(updateResult.glossCount);

      // Updated timestamp should be more recent
      const initialTimestamp = new Date(initialInfo.updated_at).getTime();
      const updatedTimestamp = new Date(updatedInfo.updated_at).getTime();
      expect(updatedTimestamp).toBeGreaterThanOrEqual(initialTimestamp);

      // 5. Verify handle is still searchable
      const searchResult = await searchManager.searchHandles('database collection', { limit: 5 });
      const found = searchResult.results.find(r => r.handleURI === testHandleURI);
      expect(found).toBeDefined();

      // 6. Cleanup
      await searchManager.removeHandle(testHandleURI);
    }, 90000);

    it('should update glosses for file handles with changed content', async () => {
      const fileURI = 'legion://local/filesystem/tmp/update-test.txt';

      // Store initial file handle
      const storeResult = await searchManager.storeHandle(fileURI);
      expect(storeResult.success).toBe(true);
      const initialGlossCount = storeResult.glossCount;

      // Update the glosses (simulating file content change)
      const updateResult = await searchManager.updateGlosses(fileURI);
      expect(updateResult.success).toBe(true);
      expect(updateResult.updated).toBe(true);

      // Gloss count might be different if metadata changed
      expect(updateResult.glossCount).toBeGreaterThan(0);

      // Verify updated info
      const updatedInfo = await searchManager.getHandleInfo(fileURI);
      expect(updatedInfo).toBeDefined();
      expect(updatedInfo.handleType).toBe('file');

      // Cleanup
      await searchManager.removeHandle(fileURI);
    }, 90000);
  });
});