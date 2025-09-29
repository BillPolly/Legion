/**
 * Unit tests for NomicHandle
 * Following TDD - these tests are written before implementation
 */

import { jest } from '@jest/globals';
import { NomicHandle } from '../../../src/handles/NomicHandle.js';
import { NomicDataSource } from '../../../src/datasources/NomicDataSource.js';
import { ResourceManager } from '../../../src/ResourceManager.js';

describe('NomicHandle', () => {
  let handle;
  let dataSource;
  let resourceManager;
  let parsed;

  beforeEach(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create DataSource
    dataSource = new NomicDataSource(resourceManager);
    await dataSource.initialize();
    
    // Parsed URI components
    parsed = {
      scheme: 'legion',
      server: 'local',
      resourceType: 'nomic',
      path: 'embed',
      original: 'legion://local/nomic/embed'
    };
    
    // Create Handle
    handle = new NomicHandle(dataSource, parsed);
  });

  afterEach(() => {
    if (handle && handle.destroy) {
      handle.destroy();
    }
    if (dataSource && dataSource.cleanup) {
      dataSource.cleanup();
    }
  });

  describe('construction', () => {
    it('should require DataSource', () => {
      expect(() => new NomicHandle(null, parsed)).toThrow('DataSource is required');
    });

    it('should require parsed URI components', () => {
      expect(() => new NomicHandle(dataSource, null)).toThrow('Parsed URI components are required');
    });

    it('should create Handle with DataSource and parsed components', () => {
      expect(handle).toBeDefined();
      expect(handle.dataSource).toBe(dataSource);
      expect(handle.parsed).toBe(parsed);
      expect(handle.embeddingPath).toBe('embed');
    });

    it('should create proxy for transparent property access', () => {
      // Check that it's a Proxy
      expect(typeof handle).toBe('object');
      expect(handle.constructor.name).toBe('NomicHandle');
    });
  });

  describe('embed operations through Handle', () => {
    it('should embed text through Handle interface', async () => {
      const result = await handle.embed('test text');
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBe(768);
      expect(result.text).toBe('test text');
    });

    it('should embed batch of texts', async () => {
      const texts = ['first', 'second', 'third'];
      const result = await handle.embedBatch(texts);
      
      expect(result).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(Array.isArray(result.embeddings)).toBe(true);
      expect(result.embeddings.length).toBe(3);
      
      result.embeddings.forEach(embedding => {
        expect(embedding.length).toBe(768);
      });
    });

    it('should calculate similarity between embeddings', async () => {
      const result1 = await handle.embed('cat');
      const result2 = await handle.embed('dog');
      
      const similarity = await handle.similarity(
        result1.embedding,
        result2.embedding
      );
      
      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should find similar embeddings', async () => {
      const query = await handle.embed('query text');
      const docs = await handle.embedBatch(['doc1', 'doc2', 'doc3']);
      
      const similar = await handle.findSimilar(
        query.embedding,
        docs.embeddings,
        2
      );
      
      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);
      expect(similar.length).toBeLessThanOrEqual(2);
      
      similar.forEach(item => {
        expect(item).toHaveProperty('index');
        expect(item).toHaveProperty('similarity');
        expect(typeof item.similarity).toBe('number');
      });
    });
  });

  describe('proxy-based property access', () => {
    it('should allow transparent property access for embeddings', async () => {
      // Set an embedding via proxy
      const embedding = await handle.embed('test');
      handle.lastEmbedding = embedding;
      
      // Get via proxy
      expect(handle.lastEmbedding).toBe(embedding);
    });

    it('should handle dynamic property setting', () => {
      handle.customProperty = 'custom value';
      expect(handle.customProperty).toBe('custom value');
    });

    it('should preserve Handle methods', () => {
      expect(typeof handle.embed).toBe('function');
      expect(typeof handle.embedBatch).toBe('function');
      expect(typeof handle.similarity).toBe('function');
      expect(typeof handle.toURI).toBe('function');
      expect(typeof handle.destroy).toBe('function');
    });

    it('should handle "in" operator correctly', () => {
      expect('embed' in handle).toBe(true);
      expect('embedBatch' in handle).toBe(true);
      expect('nonExistent' in handle).toBe(false);
    });
  });

  describe('URI operations', () => {
    it('should generate correct URI', () => {
      const uri = handle.toURI();
      expect(uri).toBe('legion://local/nomic/embed');
    });

    it('should handle different embedding paths', () => {
      const customParsed = {
        ...parsed,
        path: 'embed/query'
      };
      
      const customHandle = new NomicHandle(dataSource, customParsed);
      expect(customHandle.toURI()).toBe('legion://local/nomic/embed/query');
      
      customHandle.destroy();
    });

    it('should create child Handles for sub-operations', () => {
      const child = handle.child('batch');
      
      expect(child).toBeDefined();
      expect(child.toURI()).toBe('legion://local/nomic/embed/batch');
      expect(child.dataSource).toBe(dataSource);
      
      child.destroy();
    });

    it('should get parent Handle', () => {
      const child = handle.child('batch');
      const parent = child.parent();
      
      expect(parent).toBeDefined();
      expect(parent.toURI()).toBe('legion://local/nomic/embed');
      
      child.destroy();
      parent.destroy();
    });
  });

  describe('caching through Handle', () => {
    it('should access cache statistics', () => {
      const stats = handle.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should clear cache through Handle', async () => {
      await handle.embed('cached text');
      
      const statsBefore = handle.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      handle.clearCache();
      
      const statsAfter = handle.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('metadata and schema', () => {
    it('should provide embedding metadata', () => {
      const metadata = handle.getMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('dimensions');
      expect(metadata.dimensions).toBe(768);
      expect(metadata).toHaveProperty('model');
    });

    it('should provide schema information', () => {
      const schema = handle.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type');
      expect(schema.type).toBe('nomic');
      expect(schema).toHaveProperty('operations');
      
      const operations = schema.operations;
      expect(operations).toContain('embed');
      expect(operations).toContain('embedBatch');
      expect(operations).toContain('similarity');
    });
  });

  describe('subscription support', () => {
    it('should support subscription to embedding events', () => {
      const callback = jest.fn();
      
      const subscription = handle.subscribe(callback, {
        event: 'embedding.generated'
      });
      
      expect(subscription).toBeDefined();
      expect(subscription).toHaveProperty('unsubscribe');
      expect(typeof subscription.unsubscribe).toBe('function');
      
      subscription.unsubscribe();
    });

    it('should notify on embedding generation', async () => {
      const callback = jest.fn();
      
      const subscription = handle.subscribe(callback, {
        event: 'embedding.generated'
      });
      
      await handle.embed('test subscription');
      
      // DataSource should trigger callback
      expect(callback).toHaveBeenCalled();
      
      subscription.unsubscribe();
    });
  });

  describe('validation', () => {
    it('should validate text input', () => {
      expect(handle.validateText('valid text')).toBe(true);
      expect(handle.validateText('')).toBe(true); // Empty is valid
      expect(handle.validateText(null)).toBe(false);
      expect(handle.validateText(undefined)).toBe(false);
      expect(handle.validateText(123)).toBe(false);
    });

    it('should validate embedding array', () => {
      const validEmbedding = new Array(768).fill(0);
      const invalidEmbedding = new Array(512).fill(0);
      
      expect(handle.validateEmbedding(validEmbedding)).toBe(true);
      expect(handle.validateEmbedding(invalidEmbedding)).toBe(false);
      expect(handle.validateEmbedding(null)).toBe(false);
      expect(handle.validateEmbedding('not an array')).toBe(false);
    });
  });

  describe('export and serialization', () => {
    it('should export Handle state', async () => {
      await handle.embed('test1');
      await handle.embed('test2');
      
      const exported = handle.export();
      
      expect(exported).toBeDefined();
      expect(exported).toHaveProperty('uri');
      expect(exported.uri).toBe('legion://local/nomic/embed');
      expect(exported).toHaveProperty('cacheStats');
      expect(exported.cacheStats.size).toBeGreaterThan(0);
    });

    it('should provide JSON representation', () => {
      const json = handle.toJSON();
      
      expect(json).toBeDefined();
      expect(json.type).toBe('NomicHandle');
      expect(json.uri).toBe('legion://local/nomic/embed');
      expect(json).toHaveProperty('embeddingPath');
      expect(json).toHaveProperty('dimensions');
    });

    it('should provide string representation', () => {
      const str = handle.toString();
      
      expect(typeof str).toBe('string');
      expect(str).toContain('NomicHandle');
      expect(str).toContain('legion://local/nomic/embed');
    });
  });

  describe('resource management', () => {
    it('should check if Handle is destroyed', () => {
      expect(handle.isDestroyed()).toBe(false);
      
      handle.destroy();
      
      expect(handle.isDestroyed()).toBe(true);
    });

    it('should cleanup resources on destroy', async () => {
      handle.destroy();
      
      expect(handle.isDestroyed()).toBe(true);
      await expect(handle.embed('test')).rejects.toThrow('NomicHandle has been destroyed');
    });

    it('should handle multiple destroy calls gracefully', () => {
      handle.destroy();
      
      // Should not throw
      expect(() => handle.destroy()).not.toThrow();
      expect(handle.isDestroyed()).toBe(true);
    });

    it('should clone Handle', async () => {
      // Create a fresh handle for this test
      const freshHandle = new NomicHandle(dataSource, parsed);
      const cloned = freshHandle.clone();
      
      expect(cloned).toBeDefined();
      expect(cloned).not.toBe(freshHandle);
      expect(cloned.toURI()).toBe(freshHandle.toURI());
      expect(cloned.dataSource).toBe(freshHandle.dataSource);
      
      // Should work independently
      const result = await cloned.embed('cloned test');
      expect(result.embedding).toBeDefined();
      
      cloned.destroy();
      freshHandle.destroy();
    });
  });

  describe('error handling', () => {
    it('should handle embedding errors gracefully', async () => {
      // Force an error by destroying the Handle first
      handle.destroy();
      
      await expect(handle.embed('test')).rejects.toThrow('NomicHandle has been destroyed');
    });

    it('should validate operations when destroyed', () => {
      handle.destroy();
      
      expect(() => handle.getCacheStats()).toThrow('NomicHandle has been destroyed');
      expect(() => handle.clearCache()).toThrow('NomicHandle has been destroyed');
      expect(() => handle.getMetadata()).toThrow('NomicHandle has been destroyed');
    });

    it('should provide meaningful error messages', async () => {
      const badHandle = new NomicHandle(dataSource, parsed);
      badHandle.destroy();
      
      try {
        await badHandle.embed('test');
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('destroyed');
      }
    });
  });

  describe('integration with ResourceManager Handle system', () => {
    it('should be compatible with ResourceManager Handle creation', () => {
      // Verify the Handle can be created with standard parsed URI
      const standardParsed = {
        scheme: 'legion',
        server: 'local',
        resourceType: 'nomic',
        path: 'embed',
        original: 'legion://local/nomic/embed'
      };
      
      const standardHandle = new NomicHandle(dataSource, standardParsed);
      expect(standardHandle).toBeDefined();
      expect(standardHandle.toURI()).toBe('legion://local/nomic/embed');
      
      standardHandle.destroy();
    });

    it('should support different server locations', () => {
      const remoteParsed = {
        ...parsed,
        server: 'remote',
        original: 'legion://remote/nomic/embed'
      };
      
      const remoteHandle = new NomicHandle(dataSource, remoteParsed);
      expect(remoteHandle.toURI()).toBe('legion://remote/nomic/embed');
      
      remoteHandle.destroy();
    });
  });
});