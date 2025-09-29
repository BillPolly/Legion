/**
 * Integration tests for HandleSemanticSearchManager with real services
 * Phase 5: Complete workflow testing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HandleSemanticSearchManager } from '../../src/HandleSemanticSearchManager.js';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('HandleSemanticSearchManager Integration', () => {
  let manager;
  let resourceManager;
  let testFile;
  const testHandleURI = 'legion://local/filesystem/__tests__/fixtures/integration-test.js';

  beforeAll(async () => {
    // Setup real components
    resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');

    const metadataExtractor = new HandleMetadataExtractor();
    const glossGenerator = new HandleGlossGenerator(llmClient);
    const vectorStore = new HandleVectorStore(resourceManager);

    // Initialize generator and vector store
    await glossGenerator.initialize();
    await vectorStore.initialize();

    manager = new HandleSemanticSearchManager(
      resourceManager,
      metadataExtractor,
      glossGenerator,
      vectorStore
    );

    // Create test file
    testFile = join(process.cwd(), '__tests__/fixtures/integration-test.js');
    writeFileSync(testFile, `
/**
 * Integration test file for semantic search
 * This is a simple Express.js server for user authentication
 */

const express = require('express');
const app = express();

app.post('/api/login', (req, res) => {
  // Handle user login
  res.json({ success: true });
});

app.listen(3000);
`);

    // Clean up any existing test data
    try {
      await manager.removeHandle(testHandleURI);
    } catch (error) {
      // Ignore if doesn't exist
    }
  }, 120000);

  afterAll(async () => {
    // Clean up
    try {
      await manager.removeHandle(testHandleURI);
      unlinkSync(testFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Workflow', () => {
    it('should store handle with full workflow', async () => {
      const result = await manager.storeHandle(testHandleURI);

      expect(result.success).toBe(true);
      expect(result.handleURI).toBe(testHandleURI);
      expect(result.vectorIds).toBeDefined();
      expect(result.vectorIds.length).toBeGreaterThan(0);
      expect(result.mongoId).toBeDefined();
      expect(result.glossCount).toBeGreaterThan(0);
    }, 60000);

    it('should search for stored handle by semantic query', async () => {
      // Ensure handle is stored first
      await manager.storeHandle(testHandleURI);

      // Search for it
      const searchResult = await manager.searchHandles('express server authentication', {
        limit: 5
      });

      expect(searchResult.query).toBe('express server authentication');
      expect(searchResult.results).toBeDefined();
      expect(searchResult.totalResults).toBeGreaterThan(0);

      // Should find our test file
      const found = searchResult.results.find(r => r.handleURI === testHandleURI);
      expect(found).toBeDefined();
      expect(found.similarity).toBeGreaterThan(0.5);
      expect(found.handleType).toBe('filesystem');
      expect(found.matchedGloss).toBeDefined();
    }, 60000);

    it('should restore handle from URI', async () => {
      const handle = await manager.restoreHandle(testHandleURI);

      expect(handle).toBeDefined();
      expect(handle.uri).toContain('integration-test.js');
    }, 30000);

    it('should get handle info', async () => {
      const info = await manager.getHandleInfo(testHandleURI);

      expect(info).toBeDefined();
      expect(info.handleURI).toBe(testHandleURI);
      expect(info.handleType).toBe('filesystem');
      expect(info.metadata).toBeDefined();
      expect(info.glosses).toBeDefined();
      expect(info.glosses.length).toBeGreaterThan(0);
    }, 30000);

    it('should remove handle from index', async () => {
      // Store first
      await manager.storeHandle(testHandleURI);

      // Remove
      const result = await manager.removeHandle(testHandleURI);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThan(0);

      // Verify it's gone
      const info = await manager.getHandleInfo(testHandleURI);
      expect(info).toBeNull();
    }, 60000);
  });

  describe('Search Options', () => {
    beforeAll(async () => {
      // Ensure test handle is stored
      await manager.storeHandle(testHandleURI);
    }, 60000);

    it('should respect limit option', async () => {
      const result = await manager.searchHandles('server', { limit: 2 });

      expect(result.results.length).toBeLessThanOrEqual(2);
    }, 30000);

    it('should apply similarity threshold', async () => {
      const result = await manager.searchHandles('completely unrelated quantum physics', {
        threshold: 0.9
      });

      // Should return no results or only very similar ones
      result.results.forEach(r => {
        expect(r.similarity).toBeGreaterThanOrEqual(0.9);
      });
    }, 30000);
  });

  describe('Multiple Handles', () => {
    const testFile2 = join(process.cwd(), '__tests__/fixtures/integration-test-2.js');
    const testHandleURI2 = 'legion://local/filesystem/__tests__/fixtures/integration-test-2.js';

    beforeAll(async () => {
      // Create second test file
      writeFileSync(testFile2, `
/**
 * Data processing utility
 * Functions for data validation and transformation
 */

function validateData(data) {
  return data && typeof data === 'object';
}

function transformData(data) {
  return JSON.stringify(data);
}

module.exports = { validateData, transformData };
`);

      // Store both files
      await manager.storeHandle(testHandleURI);
      await manager.storeHandle(testHandleURI2);
    }, 120000);

    afterAll(async () => {
      try {
        await manager.removeHandle(testHandleURI2);
        unlinkSync(testFile2);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should find multiple handles in search', async () => {
      const result = await manager.searchHandles('javascript function', {
        limit: 10
      });

      expect(result.results.length).toBeGreaterThanOrEqual(2);

      // Should find both our test files
      const uris = result.results.map(r => r.handleURI);
      expect(uris).toContain(testHandleURI);
      expect(uris).toContain(testHandleURI2);
    }, 60000);

    it('should rank by semantic similarity', async () => {
      const result = await manager.searchHandles('express authentication server', {
        limit: 10
      });

      // First result should be the authentication server (more relevant)
      expect(result.results[0].handleURI).toBe(testHandleURI);
      expect(result.results[0].similarity).toBeGreaterThan(result.results[1]?.similarity || 0);
    }, 60000);
  });
});