/**
 * Unit tests for file handle metadata extraction
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';

describe('HandleMetadataExtractor - File Handles', () => {
  let extractor;

  beforeEach(() => {
    extractor = new HandleMetadataExtractor();
  });

  describe('File metadata extraction', () => {
    it('should extract metadata from JS file handle', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/path/to/script.js',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.path).toBe('/path/to/script.js');
      expect(metadata.filename).toBe('script.js');
      expect(metadata.extension).toBe('js');
      expect(metadata.fileType).toBe('file');
      expect(metadata.resourceDescription).toContain('JS file');
      expect(metadata.capabilities).toEqual(['read', 'write']);
      expect(metadata.metadata.server).toBe('local');
      expect(metadata.metadata.isFile).toBe(true);
      expect(metadata.metadata.isDirectory).toBe(false);
    });

    it('should extract metadata from JSON file handle', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/config/settings.json',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.filename).toBe('settings.json');
      expect(metadata.extension).toBe('json');
      expect(metadata.resourceDescription).toContain('JSON file');
    });

    it('should extract metadata from image file handle', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/images/photo.jpg',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.filename).toBe('photo.jpg');
      expect(metadata.extension).toBe('jpg');
      expect(metadata.resourceDescription).toContain('JPG file');
    });

    it('should handle file without extension', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/usr/bin/node',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.filename).toBe('node');
      expect(metadata.extension).toBe('');
      expect(metadata.resourceDescription).toContain('File at:');
    });

    it('should extract metadata from directory handle', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/unit',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.fileType).toBe('directory');
      expect(metadata.metadata.isDirectory).toBe(true);
      expect(metadata.metadata.isFile).toBe(false);
      expect(metadata.resourceDescription).toContain('Directory');
    });

    it('should handle non-existent file path', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/path/that/does/not/exist.txt',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.fileType).toBe('file');
      expect(metadata.metadata.exists).toBe(false);
      expect(metadata.fileSize).toBe(0);
    });

    it('should extract filename from nested path', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/very/deep/nested/path/to/document.md',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.filename).toBe('document.md');
      expect(metadata.extension).toBe('md');
    });

    it('should use filePath property if path not available', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        filePath: '/alternate/property/file.txt',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.path).toBe('/alternate/property/file.txt');
      expect(metadata.filename).toBe('file.txt');
    });

    it('should detect file type from actual file stats', async () => {
      // Use actual file that exists
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/handle-semantic-search/__tests__/unit/FileHandleMetadata.test.js',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.handleType).toBe('file');
      expect(metadata.fileType).toBe('file');
      expect(metadata.metadata.exists).toBe(true);
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.extension).toBe('js');
    });

    it('should normalize extension to lowercase', async () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/files/DOCUMENT.PDF',
        server: 'local'
      };

      const metadata = await extractor.extractMetadata(mockHandle);

      expect(metadata.extension).toBe('pdf');
      expect(metadata.resourceDescription).toContain('PDF file');
    });
  });

  describe('Analyzer registry', () => {
    it('should use filesystem analyzer for filesystem handles', () => {
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/test.txt'
      };

      const handleType = extractor.detectHandleType(mockHandle);
      expect(handleType).toBe('filesystem');

      const analyzer = extractor.getAnalyzer(mockHandle);
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
    });
  });
});