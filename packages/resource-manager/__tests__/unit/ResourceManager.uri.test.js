/**
 * Unit tests for ResourceManager URI functionality
 * 
 * Tests the URI parsing, generation, and Handle creation capabilities
 * of the ResourceManager, including caching and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('ResourceManager URI Functionality', () => {
  let resourceManager;

  beforeEach(async () => {
    // Clear singleton instance for each test
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
    
    // Create fresh instance
    resourceManager = await ResourceManager.getInstance();
  });

  afterEach(() => {
    // Clean up
    if (resourceManager && resourceManager.clearHandleCaches) {
      resourceManager.clearHandleCaches();
    }
    ResourceManager._instance = null;
    ResourceManager._initPromise = null;
  });

  describe('URI Generation', () => {
    it('should generate valid Legion URIs with default server', () => {
      const uri = resourceManager.toURI('mongodb', 'mydb/users');
      expect(uri).toBe('legion://local/mongodb/mydb/users');
    });

    it('should generate valid Legion URIs with custom server', () => {
      const uri = resourceManager.toURI('filesystem', 'project/src/main.js', 'prod');
      expect(uri).toBe('legion://prod/filesystem/project/src/main.js');
    });

    it('should handle empty paths correctly', () => {
      const uri = resourceManager.toURI('env', '');
      expect(uri).toBe('legion://local/env/');
    });

    it('should handle complex paths with multiple segments', () => {
      const uri = resourceManager.toURI('mongodb', 'database/collection/document/field');
      expect(uri).toBe('legion://local/mongodb/database/collection/document/field');
    });
  });

  describe('URI Parsing', () => {
    it('should parse valid Legion URIs correctly', () => {
      const parsed = resourceManager._parseURI('legion://local/mongodb/mydb/users');
      
      expect(parsed).toEqual({
        scheme: 'legion',
        server: 'local',
        resourceType: 'mongodb',
        path: 'mydb/users',
        fullPath: ['mydb', 'users'],
        original: 'legion://local/mongodb/mydb/users'
      });
    });

    it('should parse URIs with empty paths', () => {
      const parsed = resourceManager._parseURI('legion://server/mongodb/');
      
      expect(parsed).toEqual({
        scheme: 'legion',
        server: 'server',
        resourceType: 'mongodb',
        path: '',
        fullPath: [],
        original: 'legion://server/mongodb/'
      });
    });

    it('should parse URIs with complex paths', () => {
      const parsed = resourceManager._parseURI('legion://prod/filesystem/usr/local/bin/script.sh');
      
      expect(parsed).toEqual({
        scheme: 'legion',
        server: 'prod',
        resourceType: 'filesystem',
        path: 'usr/local/bin/script.sh',
        fullPath: ['usr', 'local', 'bin', 'script.sh'],
        original: 'legion://prod/filesystem/usr/local/bin/script.sh'
      });
    });

    it('should throw error for non-string URIs', () => {
      expect(() => resourceManager._parseURI(null)).toThrow('URI must be a non-empty string');
      expect(() => resourceManager._parseURI(undefined)).toThrow('URI must be a non-empty string');
      expect(() => resourceManager._parseURI(123)).toThrow('URI must be a non-empty string');
      expect(() => resourceManager._parseURI({})).toThrow('URI must be a non-empty string');
    });

    it('should throw error for empty string URI', () => {
      expect(() => resourceManager._parseURI('')).toThrow('URI must be a non-empty string');
    });

    it('should throw error for URIs without legion:// scheme', () => {
      expect(() => resourceManager._parseURI('http://example.com')).toThrow('URI must start with legion://');
      expect(() => resourceManager._parseURI('mongodb://localhost')).toThrow('URI must start with legion://');
      expect(() => resourceManager._parseURI('file:///path/to/file')).toThrow('URI must start with legion://');
    });

    it('should throw error for malformed URIs', () => {
      expect(() => resourceManager._parseURI('legion://')).toThrow('URI must have at least server and resource type');
      expect(() => resourceManager._parseURI('legion://server')).toThrow('URI must have at least server and resource type');
      expect(() => resourceManager._parseURI('legion:///')).toThrow('URI must have at least server and resource type');
    });

    it('should handle URIs with special characters in paths', () => {
      const parsed = resourceManager._parseURI('legion://local/mongodb/db/collection%20with%20spaces');
      
      expect(parsed.path).toBe('db/collection%20with%20spaces');
      expect(parsed.fullPath).toEqual(['db', 'collection%20with%20spaces']);
    });

    it('should preserve URI case sensitivity', () => {
      const parsed = resourceManager._parseURI('legion://LOCAL/MongoDB/MyDB/Users');
      
      expect(parsed.server).toBe('LOCAL');
      expect(parsed.resourceType).toBe('MongoDB');
      expect(parsed.path).toBe('MyDB/Users');
    });
  });

  describe('Handle Caching', () => {
    it('should initialize caches on first use', () => {
      // Caches should not exist initially
      expect(resourceManager._handleCache).toBeUndefined();
      expect(resourceManager._uriCache).toBeUndefined();
      
      // Trigger cache initialization
      resourceManager._ensureCaches();
      
      // Caches should now exist
      expect(resourceManager._handleCache).toBeDefined();
      expect(resourceManager._uriCache).toBeDefined();
    });

    it('should provide cache statistics', () => {
      resourceManager._ensureCaches();
      
      const stats = resourceManager.getHandleCacheStats();
      
      expect(stats).toHaveProperty('handles');
      expect(stats).toHaveProperty('uris');
      expect(stats.handles).toHaveProperty('currentSize');
      expect(stats.uris).toHaveProperty('currentSize');
    });

    it('should clear Handle caches', () => {
      resourceManager._ensureCaches();
      
      // Add some dummy entries
      resourceManager._handleCache.set('test-uri', { isDestroyed: () => false });
      resourceManager._uriCache.set('test-key', 'test-value');
      
      expect(resourceManager._handleCache.size).toBeGreaterThan(0);
      expect(resourceManager._uriCache.size).toBeGreaterThan(0);
      
      // Clear caches
      resourceManager.clearHandleCaches();
      
      expect(resourceManager._handleCache.size).toBe(0);
      expect(resourceManager._uriCache.size).toBe(0);
    });

    it('should invalidate Handle cache for specific patterns', () => {
      resourceManager._ensureCaches();
      
      // Add test entries
      resourceManager._handleCache.set('legion://local/mongodb/db1/collection', { 
        isDestroyed: () => false,
        destroy: jest.fn()
      });
      resourceManager._handleCache.set('legion://local/mongodb/db2/collection', { 
        isDestroyed: () => false,
        destroy: jest.fn()
      });
      resourceManager._handleCache.set('legion://local/filesystem/file.txt', { 
        isDestroyed: () => false,
        destroy: jest.fn()
      });
      
      expect(resourceManager._handleCache.size).toBe(3);
      
      // Invalidate MongoDB entries
      resourceManager.invalidateHandleCache('.*mongodb.*');
      
      expect(resourceManager._handleCache.size).toBe(1);
      expect(resourceManager._handleCache.has('legion://local/filesystem/file.txt')).toBe(true);
      expect(resourceManager._handleCache.has('legion://local/mongodb/db1/collection')).toBe(false);
    });

    it('should destroy Handles when clearing cache', () => {
      resourceManager._ensureCaches();
      
      const mockHandle1 = {
        isDestroyed: jest.fn(() => false),
        destroy: jest.fn()
      };
      
      const mockHandle2 = {
        isDestroyed: jest.fn(() => false),
        destroy: jest.fn()
      };
      
      resourceManager._handleCache.set('uri1', mockHandle1);
      resourceManager._handleCache.set('uri2', mockHandle2);
      
      resourceManager.clearHandleCaches();
      
      expect(mockHandle1.destroy).toHaveBeenCalled();
      expect(mockHandle2.destroy).toHaveBeenCalled();
    });

    it('should not destroy already destroyed Handles', () => {
      resourceManager._ensureCaches();
      
      const mockHandle = {
        isDestroyed: jest.fn(() => true),
        destroy: jest.fn()
      };
      
      resourceManager._handleCache.set('uri', mockHandle);
      
      resourceManager.clearHandleCaches();
      
      expect(mockHandle.isDestroyed).toHaveBeenCalled();
      expect(mockHandle.destroy).not.toHaveBeenCalled();
    });
  });

  describe('Handle Registry', () => {
    it('should initialize default Handle types', () => {
      const registry = resourceManager._getHandleRegistry();
      
      expect(registry).toBeDefined();
      expect(registry.has('env')).toBe(true);
      expect(registry.has('mongodb')).toBe(true);
      expect(registry.has('filesystem')).toBe(true);
      expect(registry.has('service')).toBe(true);
    });

    it('should register custom Handle types', () => {
      const registry = resourceManager._getHandleRegistry();
      
      const mockImportFunction = jest.fn(() => Promise.resolve({ CustomHandle: class {} }));
      resourceManager._registerHandleType('custom', mockImportFunction);
      
      expect(registry.has('custom')).toBe(true);
      expect(registry.get('custom')).toBe(mockImportFunction);
    });
  });

  describe('URI Roundtrip', () => {
    it('should support URI generation and parsing roundtrip', () => {
      const originalPath = 'database/collection/document';
      const originalServer = 'production';
      const originalType = 'mongodb';
      
      // Generate URI
      const uri = resourceManager.toURI(originalType, originalPath, originalServer);
      
      // Parse URI
      const parsed = resourceManager._parseURI(uri);
      
      // Verify roundtrip
      expect(parsed.server).toBe(originalServer);
      expect(parsed.resourceType).toBe(originalType);
      expect(parsed.path).toBe(originalPath);
      
      // Regenerate URI from parsed
      const regeneratedUri = resourceManager.toURI(parsed.resourceType, parsed.path, parsed.server);
      expect(regeneratedUri).toBe(uri);
    });

    it('should handle complex paths in roundtrip', () => {
      const complexPath = 'level1/level2/level3/file.with.dots-and-dashes_underscores';
      
      const uri = resourceManager.toURI('filesystem', complexPath, 'local');
      const parsed = resourceManager._parseURI(uri);
      const regeneratedUri = resourceManager.toURI(parsed.resourceType, parsed.path, parsed.server);
      
      expect(regeneratedUri).toBe(uri);
      expect(parsed.path).toBe(complexPath);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Handle type gracefully', async () => {
      const registry = resourceManager._getHandleRegistry();
      
      // Remove a default type temporarily
      const originalLoader = registry.get('mongodb');
      registry.delete('mongodb');
      
      await expect(
        resourceManager._getHandleClass('mongodb')
      ).rejects.toThrow('No Handle class registered for resource type: mongodb');
      
      // Restore
      registry.set('mongodb', originalLoader);
    });

    it('should handle URI parsing errors gracefully', () => {
      const invalidUris = [
        null,
        undefined,
        '',
        123,
        {},
        [],
        'not-a-uri',
        'http://wrong-scheme.com',
        'legion://',
        'legion://only-server'
      ];
      
      for (const invalidUri of invalidUris) {
        expect(() => resourceManager._parseURI(invalidUri)).toThrow();
      }
    });
  });

  describe('Static Methods', () => {
    it('should provide static fromURI method', async () => {
      // Mock the createHandleFromURI method
      const mockHandle = { type: 'mockHandle' };
      jest.spyOn(resourceManager, 'createHandleFromURI').mockResolvedValue(mockHandle);
      
      const result = await ResourceManager.fromURI('legion://local/env/TEST_KEY');
      
      expect(resourceManager.createHandleFromURI).toHaveBeenCalledWith('legion://local/env/TEST_KEY');
      expect(result).toBe(mockHandle);
    });
  });
});