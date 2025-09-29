/**
 * Integration tests for file handle semantic search
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';
import { HandleSemanticSearchManager } from '../../src/HandleSemanticSearchManager.js';
import fs from 'fs/promises';

describe('File Handle Semantic Search Integration', () => {
  let resourceManager;
  let searchManager;
  let testFilePath;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Create test file
    testFilePath = '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/tmp/test-document.md';
    await fs.mkdir('/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/tmp', { recursive: true });
    await fs.writeFile(testFilePath, `# Test Documentation

This is a test markdown document for semantic search testing.

## Features
- Markdown formatting
- Code examples
- Documentation structure

## Purpose
This document is used to test the semantic search capabilities of the Legion framework.
It demonstrates how file handles can be indexed and searched using natural language queries.
`);

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

  afterAll(async () => {
    // Cleanup
    try {
      await fs.unlink(testFilePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  describe('File handle indexing and search', () => {
    it('should index a markdown file and retrieve metadata', async () => {
      const fileURI = `legion://local/filesystem${testFilePath}`;

      // Store the file handle
      const result = await searchManager.storeHandle(fileURI);

      expect(result.success).toBe(true);
      expect(result.handleURI).toBe(fileURI);
      expect(result.vectorIds).toBeDefined();
      expect(result.vectorIds.length).toBeGreaterThan(0);
      expect(result.glossCount).toBeGreaterThan(0);

      // Retrieve handle info
      const info = await searchManager.getHandleInfo(fileURI);
      expect(info).toBeDefined();
      expect(info.handleType).toBe('file');
      expect(info.metadata.extension).toBe('md');
      expect(info.metadata.filename).toBe('test-document.md');
      expect(info.metadata.isFile).toBe(true);
    }, 60000);

    it('should find markdown file using semantic search', async () => {
      const results = await searchManager.searchHandles(
        'documentation testing framework',
        { limit: 5 }
      );

      expect(results.results.length).toBeGreaterThan(0);

      const matchedFile = results.results.find(r =>
        r.handleURI.includes('test-document.md')
      );

      expect(matchedFile).toBeDefined();
      expect(matchedFile.handleType).toBe('file');
      expect(matchedFile.metadata.extension).toBe('md');
    }, 30000);

    it('should filter search results by file type', async () => {
      const results = await searchManager.searchHandles(
        'documentation',
        {
          limit: 10,
          handleTypes: ['file']
        }
      );

      expect(results.results.length).toBeGreaterThan(0);

      // All results should be file handles
      for (const result of results.results) {
        expect(result.handleType).toBe('file');
      }
    }, 30000);

    it('should restore file handle from URI', async () => {
      const fileURI = `legion://local/filesystem${testFilePath}`;

      const handle = await searchManager.restoreHandle(fileURI);

      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('filesystem');
      expect(handle.filePath).toBe(testFilePath);
    }, 10000);

    it('should remove file handle from index', async () => {
      const fileURI = `legion://local/filesystem${testFilePath}`;

      const result = await searchManager.removeHandle(fileURI);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeGreaterThan(0);

      // Verify it's removed
      const info = await searchManager.getHandleInfo(fileURI);
      expect(info).toBeNull();
    }, 10000);
  });
});