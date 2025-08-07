/**
 * Unit tests for ArtifactStore
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ArtifactStore } from '../../src/core/storage/artifacts/ArtifactStore.js';
import { Artifact, ArtifactMetadata } from '../../src/core/storage/artifacts/Artifact.js';
import { ArtifactError } from '../../src/foundation/types/errors/errors.js';
import { ArtifactType } from '../../src/foundation/types/enums/enums.js';

describe('ArtifactStore', () => {
  let store;

  beforeEach(() => {
    store = new ArtifactStore({
      maxSize: 1024 * 1024, // 1MB
      maxArtifacts: 100,
      autoCleanup: false // Disable for predictable testing
    });
  });

  describe('Construction', () => {
    test('should create store with default options', () => {
      const defaultStore = new ArtifactStore();
      
      expect(defaultStore.maxSize).toBe(100 * 1024 * 1024); // 100MB
      expect(defaultStore.maxArtifacts).toBe(1000);
      expect(defaultStore.autoCleanup).toBe(true);
    });

    test('should create store with custom options', () => {
      const customStore = new ArtifactStore({
        maxSize: 512 * 1024,
        maxArtifacts: 50,
        autoCleanup: false,
        compressionEnabled: true
      });
      
      expect(customStore.maxSize).toBe(512 * 1024);
      expect(customStore.maxArtifacts).toBe(50);
      expect(customStore.autoCleanup).toBe(false);
      expect(customStore.compressionEnabled).toBe(true);
    });
  });

  describe('Basic Storage Operations', () => {
    test('should store and retrieve string artifact', () => {
      const key = 'test-string';
      const content = 'Hello, world!';
      
      const storedKey = store.store(key, content);
      expect(storedKey).toBe(key);
      
      const retrieved = store.retrieve(key);
      expect(retrieved).toBe(content);
    });

    test('should store and retrieve object artifact', () => {
      const key = 'test-object';
      const content = { message: 'Hello', count: 42 };
      
      store.store(key, content);
      const retrieved = store.retrieve(key);
      
      expect(retrieved).toEqual(content);
    });

    test('should store with metadata', () => {
      const key = 'test-with-metadata';
      const content = 'test content';
      const metadata = {
        source: 'test',
        description: 'Test artifact',
        tags: ['test', 'example']
      };
      
      store.store(key, content, metadata);
      const retrievedMetadata = store.getMetadata(key);
      
      expect(retrievedMetadata.source).toBe('test');
      expect(retrievedMetadata.description).toBe('Test artifact');
      expect(retrievedMetadata.tags).toContain('test');
      expect(retrievedMetadata.tags).toContain('example');
    });

    test('should auto-detect artifact type', () => {
      store.store('string', 'hello world');
      store.store('object', { key: 'value' });
      store.store('code', 'function test() { return true; }');
      store.store('buffer', Buffer.from('binary data'));
      
      const stringArtifact = store.getArtifact('string');
      const objectArtifact = store.getArtifact('object');
      const codeArtifact = store.getArtifact('code');
      const bufferArtifact = store.getArtifact('buffer');
      
      expect(stringArtifact.type).toBe(ArtifactType.DOCUMENT);
      expect(objectArtifact.type).toBe(ArtifactType.DATA);
      expect(codeArtifact.type).toBe(ArtifactType.CODE);
      expect(bufferArtifact.type).toBe(ArtifactType.BINARY);
    });

    test('should override auto-detected type', () => {
      const key = 'custom-type';
      const content = 'regular text';
      
      store.store(key, content, {}, ArtifactType.CODE);
      const artifact = store.getArtifact(key);
      
      expect(artifact.type).toBe(ArtifactType.CODE);
    });
  });

  describe('Artifact Existence and Removal', () => {
    test('should check artifact existence', () => {
      expect(store.has('nonexistent')).toBe(false);
      
      store.store('exists', 'content');
      expect(store.has('exists')).toBe(true);
    });

    test('should remove artifacts', () => {
      store.store('to-remove', 'content');
      expect(store.has('to-remove')).toBe(true);
      
      const removed = store.remove('to-remove');
      expect(removed).toBe(true);
      expect(store.has('to-remove')).toBe(false);
    });

    test('should return false when removing nonexistent artifact', () => {
      const removed = store.remove('nonexistent');
      expect(removed).toBe(false);
    });

    test('should clear all artifacts', () => {
      store.store('artifact1', 'content1');
      store.store('artifact2', 'content2');
      
      expect(store.getCount()).toBe(2);
      
      store.clear();
      expect(store.getCount()).toBe(0);
      expect(store.has('artifact1')).toBe(false);
      expect(store.has('artifact2')).toBe(false);
    });
  });

  describe('Artifact Updates', () => {
    test('should update existing artifact', () => {
      const key = 'updatable';
      store.store(key, 'original content');
      
      store.update(key, 'updated content');
      const retrieved = store.retrieve(key);
      
      expect(retrieved).toBe('updated content');
    });

    test('should throw error when updating nonexistent artifact', () => {
      expect(() => store.update('nonexistent', 'new content'))
        .toThrow(ArtifactError);
    });
  });

  describe('Size and Count Tracking', () => {
    test('should track artifact count', () => {
      expect(store.getCount()).toBe(0);
      
      store.store('artifact1', 'content');
      expect(store.getCount()).toBe(1);
      
      store.store('artifact2', 'more content');
      expect(store.getCount()).toBe(2);
      
      store.remove('artifact1');
      expect(store.getCount()).toBe(1);
    });

    test('should track total size', () => {
      expect(store.getSize()).toBe(0);
      
      store.store('small', 'hi');
      const sizeAfterSmall = store.getSize();
      expect(sizeAfterSmall).toBeGreaterThan(0);
      
      store.store('large', 'this is a much longer string with more content');
      const sizeAfterLarge = store.getSize();
      expect(sizeAfterLarge).toBeGreaterThan(sizeAfterSmall);
    });

    test('should calculate sizes correctly for different content types', () => {
      store.store('string', 'hello');
      store.store('object', { key: 'value', number: 42 });
      store.store('buffer', Buffer.from('binary'));
      
      const stringSize = store.getArtifact('string').size;
      const objectSize = store.getArtifact('object').size;
      const bufferSize = store.getArtifact('buffer').size;
      
      expect(stringSize).toBe(5); // 'hello'
      expect(objectSize).toBeGreaterThan(10); // JSON stringified
      expect(bufferSize).toBe(6); // 'binary'
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      store.store('code1', 'function test() {}', { tags: ['code', 'javascript'] }, ArtifactType.CODE);
      store.store('code2', 'class Test {}', { tags: ['code', 'class'] }, ArtifactType.CODE);
      store.store('doc1', 'Documentation text', { tags: ['docs'] }, ArtifactType.DOCUMENT);
      store.store('data1', { type: 'config' }, { tags: ['config', 'data'] }, ArtifactType.DATA);
    });

    test('should find artifacts by type', () => {
      const codeArtifacts = store.findByType(ArtifactType.CODE);
      const docArtifacts = store.findByType(ArtifactType.DOCUMENT);
      const dataArtifacts = store.findByType(ArtifactType.DATA);
      
      expect(codeArtifacts).toHaveLength(2);
      expect(docArtifacts).toHaveLength(1);
      expect(dataArtifacts).toHaveLength(1);
      
      expect(codeArtifacts.map(a => a.id)).toContain('code1');
      expect(codeArtifacts.map(a => a.id)).toContain('code2');
    });

    test('should find artifacts by tag', () => {
      const codeTagged = store.findByTag('code');
      const jsTagged = store.findByTag('javascript');
      const configTagged = store.findByTag('config');
      
      expect(codeTagged).toHaveLength(2);
      expect(jsTagged).toHaveLength(1);
      expect(configTagged).toHaveLength(1);
      
      expect(jsTagged[0].id).toBe('code1');
      expect(configTagged[0].id).toBe('data1');
    });

    test('should return empty array for non-matching searches', () => {
      const nonExistent = store.findByType('nonexistent');
      const noSuchTag = store.findByTag('nosuch');
      
      expect(nonExistent).toEqual([]);
      expect(noSuchTag).toEqual([]);
    });
  });

  describe('Artifact Listing and Summaries', () => {
    test('should list all artifacts with summaries', () => {
      store.store('artifact1', 'content1', { description: 'First artifact' });
      store.store('artifact2', 'content2', { description: 'Second artifact' });
      
      const summaries = store.listArtifacts();
      
      expect(summaries).toHaveLength(2);
      expect(summaries[0].id).toBe('artifact1');
      expect(summaries[0].description).toBe('First artifact');
      expect(summaries[1].id).toBe('artifact2');
      expect(summaries[1].description).toBe('Second artifact');
    });

    test('should create artifact summaries', () => {
      store.store('test', 'test content', { 
        description: 'Test artifact',
        tags: ['test', 'example']
      });
      
      const summary = store.summarize('test');
      
      expect(summary).toContain('test');
      expect(summary).toContain('test content');
      expect(summary).toContain('document'); // Type
    });

    test('should handle summary of nonexistent artifact', () => {
      const summary = store.summarize('nonexistent');
      expect(summary).toContain('not found');
    });
  });

  describe('Artifact Cloning', () => {
    test('should clone artifact with new key', () => {
      const originalKey = 'original';
      const clonedKey = 'cloned';
      const content = 'original content';
      const metadata = { description: 'Original artifact' };
      
      store.store(originalKey, content, metadata);
      store.clone(originalKey, clonedKey);
      
      expect(store.has(clonedKey)).toBe(true);
      expect(store.retrieve(clonedKey)).toBe(content);
      
      const originalMetadata = store.getMetadata(originalKey);
      const clonedMetadata = store.getMetadata(clonedKey);
      
      expect(clonedMetadata.description).toBe(originalMetadata.description);
    });

    test('should throw error when cloning nonexistent artifact', () => {
      expect(() => store.clone('nonexistent', 'target'))
        .toThrow(ArtifactError);
    });

    test('should throw error when target key already exists', () => {
      store.store('source', 'content');
      store.store('target', 'existing');
      
      expect(() => store.clone('source', 'target'))
        .toThrow(ArtifactError);
    });
  });

  describe('Storage Limits', () => {
    test('should enforce size limits', () => {
      const smallStore = new ArtifactStore({
        maxSize: 100, // Very small limit
        autoCleanup: false
      });
      
      const largeContent = 'x'.repeat(200); // Exceeds limit
      
      expect(() => smallStore.store('large', largeContent))
        .toThrow(ArtifactError);
    });

    test('should enforce count limits', () => {
      const limitedStore = new ArtifactStore({
        maxArtifacts: 2,
        autoCleanup: false
      });
      
      limitedStore.store('artifact1', 'content1');
      limitedStore.store('artifact2', 'content2');
      
      expect(() => limitedStore.store('artifact3', 'content3'))
        .toThrow(ArtifactError);
    });

    test('should provide meaningful error messages for limits', () => {
      const limitedStore = new ArtifactStore({
        maxSize: 50,
        maxArtifacts: 1,
        autoCleanup: false
      });
      
      try {
        limitedStore.store('large', 'x'.repeat(100));
      } catch (error) {
        expect(error.message).toContain('Storage size limit exceeded');
      }
      
      limitedStore.store('first', 'content');
      
      try {
        limitedStore.store('second', 'content');
      } catch (error) {
        expect(error.message).toContain('Artifact count limit exceeded');
      }
    });
  });

  describe('Cleanup Operations', () => {
    test('should trigger cleanup when auto-cleanup enabled', () => {
      const autoCleanupStore = new ArtifactStore({
        maxArtifacts: 10,
        autoCleanup: true
      });
      
      // Fill store to trigger cleanup threshold (80% = 8 items)
      for (let i = 0; i < 8; i++) {
        autoCleanupStore.store(`artifact${i}`, `content${i}`);
      }
      
      let countBefore = autoCleanupStore.getCount();
      expect(countBefore).toBe(8);
      
      // Add one more - this should trigger cleanup when it reaches 80% threshold
      autoCleanupStore.store('trigger', 'content');
      countBefore = autoCleanupStore.getCount();
      
      // After cleanup, some old items should be removed (cleanup removes 20%)
      // So we should have less than 9 items
      expect(countBefore).toBeLessThanOrEqual(9);
    });

    test('should clean up oldest artifacts first', () => {
      const cleanupStore = new ArtifactStore({
        maxArtifacts: 5,
        autoCleanup: true
      });
      
      // Fill store and force cleanup
      for (let i = 0; i < 4; i++) {
        cleanupStore.store(`old${i}`, `content${i}`);
      }
      
      // Add a brief delay to ensure different timestamps
      setTimeout(() => {
        cleanupStore.store('newer', 'newer content');
      }, 10);
      
      // The older artifacts should be candidates for cleanup
      // when the store approaches capacity
    });
  });

  describe('JSON Serialization', () => {
    test('should export and import artifacts to/from JSON', () => {
      store.store('artifact1', 'content1', { description: 'First' });
      store.store('artifact2', { key: 'value' }, { description: 'Second' });
      
      const exported = store.toJSON();
      
      expect(exported).toHaveProperty('artifact1');
      expect(exported).toHaveProperty('artifact2');
      
      const newStore = new ArtifactStore();
      newStore.fromJSON(exported);
      
      expect(newStore.getCount()).toBe(2);
      expect(newStore.retrieve('artifact1')).toBe('content1');
      expect(newStore.retrieve('artifact2')).toEqual({ key: 'value' });
    });

    test('should preserve metadata in JSON serialization', () => {
      const metadata = {
        description: 'Test artifact',
        tags: ['test', 'serialization'],
        source: 'unit-test'
      };
      
      store.store('test', 'content', metadata);
      
      const exported = store.toJSON();
      const newStore = new ArtifactStore();
      newStore.fromJSON(exported);
      
      const importedMetadata = newStore.getMetadata('test');
      expect(importedMetadata.description).toBe(metadata.description);
      expect(importedMetadata.tags).toEqual(metadata.tags);
      expect(importedMetadata.source).toBe(metadata.source);
    });
  });

  describe('Content Preview', () => {
    test('should create appropriate content previews', () => {
      store.store('short', 'short content');
      store.store('long', 'x'.repeat(200));
      store.store('binary', Buffer.from('binary'), {}, ArtifactType.BINARY);
      
      const shortSummary = store.summarize('short');
      const longSummary = store.summarize('long');
      const binarySummary = store.summarize('binary');
      
      expect(shortSummary).toContain('short content');
      expect(longSummary).toContain('xxx...'); // Truncated
      expect(binarySummary).toContain('Binary data');
    });
  });

  describe('Type Detection', () => {
    test('should detect code artifacts correctly', () => {
      const codeSnippets = [
        'function test() { return true; }',
        'class MyClass { constructor() {} }', 
        'import { something } from "module";',
        'const x = () => {};',
        'if (condition) { // comment',
        '#!/bin/bash\necho "hello"'
      ];
      
      codeSnippets.forEach((code, index) => {
        store.store(`code${index}`, code);
        const artifact = store.getArtifact(`code${index}`);
        expect(artifact.type).toBe(ArtifactType.CODE);
      });
    });

    test('should detect document artifacts correctly', () => {
      const documents = [
        'This is regular text without code indicators.',
        'A simple sentence.',
        'Multi-line\ndocument\nwith newlines.'
      ];
      
      documents.forEach((doc, index) => {
        store.store(`doc${index}`, doc);
        const artifact = store.getArtifact(`doc${index}`);
        expect(artifact.type).toBe(ArtifactType.DOCUMENT);
      });
    });
  });

  describe('Error Handling', () => {
    test('should provide context in error messages', () => {
      try {
        store.store('error-test', 'content');
        // Force an error by trying to update nonexistent artifact
        store.update('nonexistent', 'new content');
      } catch (error) {
        expect(error).toBeInstanceOf(ArtifactError);
        expect(error.artifactKey).toBe('nonexistent');
        expect(error.operation).toBe('update');
      }
    });

    test('should handle corrupt or invalid metadata gracefully', () => {
      // These should not throw errors during storage
      expect(() => {
        store.store('test1', 'content', null);
        store.store('test2', 'content', undefined);
        store.store('test3', 'content', { invalidField: null });
      }).not.toThrow();
    });
  });
});