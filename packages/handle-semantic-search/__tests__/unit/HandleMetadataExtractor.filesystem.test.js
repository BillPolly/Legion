/**
 * Unit tests for HandleMetadataExtractor - Filesystem handles
 * Phase 1, Step 1.3-1.4: Filesystem handle analysis
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';

describe('HandleMetadataExtractor - Filesystem', () => {
  let extractor;

  beforeEach(() => {
    extractor = new HandleMetadataExtractor();
  });

  describe('Filesystem Handle Analysis', () => {
    it('should extract metadata from filesystem handle', async () => {
      const mockFileHandle = {
        resourceType: 'filesystem',
        path: '/test/sample-code.js',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockFileHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('file');
      expect(metadata.path).toBe('/test/sample-code.js');
      expect(metadata.resourceDescription).toContain('file at:');
      expect(metadata.capabilities).toContain('read');
      expect(metadata.capabilities).toContain('write');
    });

    it('should handle filesystem handle without path', async () => {
      const mockFileHandle = {
        resourceType: 'filesystem',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockFileHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('file');
      expect(metadata.path).toBe('unknown');
    });
  });

  describe('Generic Fallback Analyzer', () => {
    it('should extract basic metadata from unknown handle type', async () => {
      const mockHandle = {
        resourceType: 'custom-type',
        server: 'local',
        query: () => {},
        update: () => {}
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('custom-type');
      expect(metadata.resourceDescription).toContain('Generic handle');
      expect(metadata.capabilities).toContain('query');
      expect(metadata.capabilities).toContain('update');
    });

    it('should detect available methods on generic handle', async () => {
      const mockHandle = {
        resourceType: 'test',
        query: () => {},
        subscribe: () => {}
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.capabilities).toContain('query');
      expect(metadata.capabilities).toContain('subscribe');
      expect(metadata.capabilities).not.toContain('update');
      expect(metadata.metadata.hasQueryMethod).toBe(true);
      expect(metadata.metadata.hasUpdateMethod).toBe(false);
    });

    it('should handle handle without any methods', async () => {
      const mockHandle = {
        someProperty: 'value'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata).toBeDefined();
      expect(metadata.handleType).toBe('generic');
      expect(metadata.capabilities).toEqual([]);
    });
  });
});