/**
 * Integration tests for HandleMetadataExtractor with real handles
 * Phase 1, Step 1.3: Integration with ResourceManager
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('HandleMetadataExtractor Integration', () => {
  let extractor;
  let resourceManager;

  beforeAll(async () => {
    extractor = new HandleMetadataExtractor();
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  describe('Real Nomic Handle', () => {
    it('should extract metadata from real Nomic embedding handle', async () => {
      // Get real Nomic handle from ResourceManager
      const nomicURI = 'legion://local/nomic/embed';
      const nomicHandle = await resourceManager.createHandleFromURI(nomicURI);

      // Extract metadata
      const metadata = await extractor.extractMetadata(nomicHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBeDefined();
      expect(metadata.resourceDescription).toBeDefined();
      expect(metadata.capabilities).toBeDefined();
      expect(Array.isArray(metadata.capabilities)).toBe(true);
    });
  });

  describe('Real Qdrant Handle', () => {
    it('should extract metadata from real Qdrant handle', async () => {
      // Get real Qdrant handle from ResourceManager
      const qdrantURI = 'legion://local/qdrant/collections';
      const qdrantHandle = await resourceManager.createHandleFromURI(qdrantURI);

      // Extract metadata
      const metadata = await extractor.extractMetadata(qdrantHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBeDefined();
      expect(metadata.resourceDescription).toBeDefined();
      expect(metadata.capabilities).toBeDefined();
    });
  });

  describe('Simulated File Handle', () => {
    it('should extract metadata from file-like handle structure', async () => {
      // Create a file-like handle structure (simulating what a real file handle would look like)
      const fileHandle = {
        resourceType: 'filesystem',
        path: '/test/fixtures/sample-code.js',
        filePath: '/test/fixtures/sample-code.js',
        server: 'local',
        query: async () => { return []; },
        value: () => { return { path: '/test/fixtures/sample-code.js' }; }
      };

      const metadata = await extractor.extractMetadata(fileHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('file');
      expect(metadata.path).toContain('sample-code.js');
      expect(metadata.resourceDescription).toBeDefined();
    });
  });
});