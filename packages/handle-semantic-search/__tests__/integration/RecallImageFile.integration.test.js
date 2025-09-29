/**
 * Integration test for recalling image files
 * Tests the complete workflow: store image → search for it → recall and use it
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';

describe('Recall Image File Integration', () => {
  let resourceManager;
  let semanticSearch;
  let testImagePath;
  let testImageURI;

  beforeAll(async () => {
    // Get ResourceManager and semantic search
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.createHandleSemanticSearch();

    // Create test image file
    testImagePath = '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/tmp/cat-photo.jpg';
    testImageURI = `legion://local/filesystem${testImagePath}`;

    // Ensure the file exists
    await fs.mkdir('/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/tmp', { recursive: true });
    await fs.writeFile(testImagePath, 'This is a test image file representing a cat photo');
  }, 120000);

  afterAll(async () => {
    // Cleanup
    try {
      await semanticSearch.removeHandle(testImageURI);
      await fs.unlink(testImagePath);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Store and recall image file', () => {
    it('should store an image file handle', async () => {
      const result = await semanticSearch.storeHandle(testImageURI);

      expect(result.success).toBe(true);
      expect(result.handleURI).toBe(testImageURI);
      expect(result.glossCount).toBeGreaterThan(0);
      expect(result.vectorIds).toBeDefined();
      expect(result.vectorIds.length).toBeGreaterThan(0);

      console.log(`Stored image with ${result.glossCount} glosses`);
    }, 60000);

    it('should verify stored image metadata', async () => {
      const info = await semanticSearch.getHandleInfo(testImageURI);

      expect(info).toBeDefined();
      expect(info.handleURI).toBe(testImageURI);
      expect(info.handleType).toBe('file');
      expect(info.metadata).toBeDefined();
      expect(info.metadata.filename).toBe('cat-photo.jpg');
      expect(info.metadata.extension).toBe('jpg');
      expect(info.metadata.isFile).toBe(true);
      expect(info.glosses).toBeDefined();
      expect(info.glosses.length).toBeGreaterThan(0);

      console.log('Image metadata:', {
        filename: info.metadata.filename,
        extension: info.metadata.extension,
        glossCount: info.glosses.length
      });
    }, 10000);

    it('should recall image using semantic search for "cat photo"', async () => {
      const recalled = await semanticSearch.recallHandles('cat photo picture', {
        limit: 5,
        threshold: 0.3
      });

      expect(recalled.length).toBeGreaterThan(0);

      // Find our cat photo
      const catPhoto = recalled.find(r => r.handleURI === testImageURI);
      expect(catPhoto).toBeDefined();

      console.log('Recalled cat photo:');
      console.log(`  URI: ${catPhoto.handleURI}`);
      console.log(`  Similarity: ${catPhoto.similarity}`);
      console.log(`  Handle type: ${catPhoto.handleType}`);
      console.log(`  File: ${catPhoto.handle.filePath}`);
    }, 30000);

    it('should recall image using semantic search for "jpg image"', async () => {
      const recalled = await semanticSearch.recallHandles('jpg image file', {
        limit: 10,
        threshold: 0.3
      });

      expect(recalled.length).toBeGreaterThan(0);

      const jpgImage = recalled.find(r => r.handleURI === testImageURI);
      expect(jpgImage).toBeDefined();
      expect(jpgImage.handle).toBeDefined();
      expect(jpgImage.handle.filePath).toBe(testImagePath);

      console.log(`Found JPG image with similarity: ${jpgImage.similarity}`);
    }, 30000);

    it('should filter recalls to only file handles', async () => {
      const recalled = await semanticSearch.recallHandles('photo', {
        limit: 10,
        handleTypes: ['file']
      });

      // All results should be file handles
      for (const item of recalled) {
        expect(item.handleType).toBe('file');
        expect(item.handle.resourceType).toBe('filesystem');
      }

      console.log(`Found ${recalled.length} file handles`);
    }, 30000);

    it('should use recalled image handle to read file', async () => {
      const recalled = await semanticSearch.recallHandles('cat photo', {
        limit: 1
      });

      expect(recalled.length).toBeGreaterThan(0);

      const { handle } = recalled[0];

      // Verify we can use the handle
      expect(handle.filePath).toBe(testImagePath);
      expect(handle.resourceType).toBe('filesystem');

      // Read the file using the recalled handle's path
      const content = await fs.readFile(handle.filePath, 'utf-8');
      expect(content).toContain('cat photo');

      console.log('Successfully read file content via recalled handle');
    }, 30000);

    it('should recall with restoreHandle for direct access', async () => {
      const handle = await semanticSearch.restoreHandle(testImageURI);

      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('filesystem');
      expect(handle.filePath).toBe(testImagePath);

      console.log('Directly restored handle from URI');
    }, 10000);
  });

  describe('Complete recall workflow', () => {
    it('should demonstrate full workflow: store → search → recall → use', async () => {
      console.log('\n=== Complete Image Recall Workflow ===\n');

      // 1. Store
      console.log('Step 1: Store image handle...');
      const storeResult = await semanticSearch.storeHandle(testImageURI);
      console.log(`  ✓ Stored with ${storeResult.glossCount} glosses\n`);

      // 2. Search semantically
      console.log('Step 2: Search for "photo of a cat"...');
      const recalled = await semanticSearch.recallHandles('photo of a cat', {
        limit: 3,
        threshold: 0.3
      });
      console.log(`  ✓ Found ${recalled.length} matching handles\n`);

      // 3. Use the first result
      if (recalled.length > 0) {
        const first = recalled[0];
        console.log('Step 3: Use the recalled handle:');
        console.log(`  URI: ${first.handleURI}`);
        console.log(`  Similarity: ${first.similarity.toFixed(3)}`);
        console.log(`  File path: ${first.handle.filePath}`);
        console.log(`  Can read: ${first.handle.filePath === testImagePath}`);

        // Verify we can use it
        const stats = await fs.stat(first.handle.filePath);
        console.log(`  File size: ${stats.size} bytes`);
        console.log('\n  ✓ Handle is working and ready to use!\n');
      }
    }, 60000);
  });
});