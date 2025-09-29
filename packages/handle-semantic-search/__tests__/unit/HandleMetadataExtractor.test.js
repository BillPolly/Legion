/**
 * Unit tests for HandleMetadataExtractor
 * Phase 1, Step 1.2: Handle type detection and basic structure
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';

describe('HandleMetadataExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new HandleMetadataExtractor();
  });

  describe('Constructor and Initialization', () => {
    it('should create an instance', () => {
      expect(extractor).toBeInstanceOf(HandleMetadataExtractor);
    });

    it('should have analyzer registry', () => {
      expect(extractor.analyzers).toBeDefined();
      expect(extractor.analyzers).toBeInstanceOf(Map);
    });

    it('should have registered analyzers for known types', () => {
      expect(extractor.analyzers.has('mongodb')).toBe(true);
      expect(extractor.analyzers.has('filesystem')).toBe(true);
      expect(extractor.analyzers.has('generic')).toBe(true);
    });
  });

  describe('Handle Type Detection', () => {
    it('should detect MongoDB handle type', () => {
      const mockMongoHandle = {
        resourceType: 'mongodb',
        database: 'testdb',
        collection: 'users'
      };

      const type = extractor.detectHandleType(mockMongoHandle);
      expect(type).toBe('mongodb');
    });

    it('should detect filesystem handle type', () => {
      const mockFileHandle = {
        resourceType: 'filesystem',
        path: '/test/file.txt'
      };

      const type = extractor.detectHandleType(mockFileHandle);
      expect(type).toBe('filesystem');
    });

    it('should detect generic type for unknown handles', () => {
      const mockHandle = {
        resourceType: 'unknown-type'
      };

      const type = extractor.detectHandleType(mockHandle);
      expect(type).toBe('generic');
    });

    it('should detect generic type for handles without resourceType', () => {
      const mockHandle = {
        someProperty: 'value'
      };

      const type = extractor.detectHandleType(mockHandle);
      expect(type).toBe('generic');
    });
  });

  describe('Analyzer Selection', () => {
    it('should get MongoDB analyzer for MongoDB handle', () => {
      const mockMongoHandle = {
        resourceType: 'mongodb'
      };

      const analyzer = extractor.getAnalyzer(mockMongoHandle);
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should get filesystem analyzer for file handle', () => {
      const mockFileHandle = {
        resourceType: 'filesystem'
      };

      const analyzer = extractor.getAnalyzer(mockFileHandle);
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should get generic analyzer for unknown handle types', () => {
      const mockHandle = {
        resourceType: 'unknown'
      };

      const analyzer = extractor.getAnalyzer(mockHandle);
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
    });
  });
});