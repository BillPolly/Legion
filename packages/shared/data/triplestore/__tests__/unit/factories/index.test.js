import { describe, it, expect } from '@jest/globals';
import {
  createInMemoryTripleStore,
  createFileSystemTripleStore,
  createDataScriptTripleStore,
  createTripleStoreDataSource,
  createDefaultTripleStore
} from '../../../src/factories/index.js';
import { InMemoryProvider } from '../../../src/providers/InMemoryProvider.js';
import { FileSystemProvider } from '../../../src/providers/FileSystemProvider.js';
import { DataScriptProvider } from '../../../src/providers/DataScriptProvider.js';
import { TripleStoreDataSource } from '../../../src/core/TripleStoreDataSource.js';
import { ITripleStore } from '../../../src/core/ITripleStore.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 6: Unit tests for factory functions
 * 
 * Tests the factory functions that create triple store instances
 * with proper configuration and defaults.
 */
describe('Triple Store Factory Functions', () => {
  describe('createInMemoryTripleStore', () => {
    it('should create an InMemoryProvider instance', async () => {
      const store = createInMemoryTripleStore();
      
      expect(store).toBeInstanceOf(InMemoryProvider);
      expect(store).toBeInstanceOf(ITripleStore);
      
      // Test basic functionality
      await store.addTriple('s', 'p', 'o');
      const size = await store.size();
      expect(size).toBe(1);
    });

    it('should accept options', async () => {
      const store = createInMemoryTripleStore({ 
        initialData: [['s1', 'p1', 'o1']] 
      });
      
      // Wait a bit for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const size = await store.size();
      expect(size).toBe(1);
      
      const results = await store.query('s1', null, null);
      expect(results).toHaveLength(1);
    });
  });

  describe('createFileSystemTripleStore', () => {
    const testDir = path.join(__dirname, '../../tmp/factory-test');

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should create a FileSystemProvider instance', async () => {
      // Create a simple in-memory data source for FileSystemProvider
      const dataSource = {
        query: async () => [],
        update: async () => ({ success: true }),
        subscribe: () => () => {},
        getSchema: () => ({ type: 'memory' })
      };

      const store = createFileSystemTripleStore({ 
        dataSource,
        filePath: path.join(testDir, 'test.json')
      });
      
      expect(store).toBeInstanceOf(FileSystemProvider);
      expect(store).toBeInstanceOf(ITripleStore);
    });

    it('should require a dataSource', () => {
      expect(() => {
        createFileSystemTripleStore({ 
          filePath: path.join(testDir, 'test.json')
        });
      }).toThrow('dataSource is required');
    });

    it('should use default filePath if not provided', () => {
      const dataSource = {
        query: async () => [],
        update: async () => ({ success: true }),
        subscribe: () => () => {},
        getSchema: () => ({ type: 'memory' })
      };

      const store = createFileSystemTripleStore({ dataSource });
      
      expect(store).toBeInstanceOf(FileSystemProvider);
      // Default path should be used
      expect(store.filePath).toContain('triplestore.json');
    });
  });

  describe('createDataScriptTripleStore', () => {
    it('should create a DataScriptProvider instance', async () => {
      const store = createDataScriptTripleStore();
      
      expect(store).toBeInstanceOf(DataScriptProvider);
      expect(store).toBeInstanceOf(ITripleStore);
      
      // Test basic functionality
      await store.addTriple('s', 'p', 'o');
      const size = await store.size();
      expect(size).toBe(1);
    });

    it('should accept schema options', async () => {
      const schema = {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/age': { ':db/cardinality': ':db.cardinality/one' }
      };

      const store = createDataScriptTripleStore({ 
        schema,
        validateSchema: true 
      });
      
      expect(store).toBeInstanceOf(DataScriptProvider);
      
      // Test with schema
      await store.addTriple('person:1', 'name', 'Alice');
      await store.addTriple('person:1', 'age', 30);
      
      const results = await store.query('person:1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should handle invalid schema with validation', () => {
      const invalidSchema = {
        'invalid': { ':db/cardinality': ':db.cardinality/one' }
      };

      expect(() => {
        createDataScriptTripleStore({ 
          schema: invalidSchema,
          validateSchema: true 
        });
      }).toThrow();
    });
  });

  describe('createTripleStoreDataSource', () => {
    it('should create a TripleStoreDataSource wrapper', async () => {
      const store = createInMemoryTripleStore();
      const dataSource = createTripleStoreDataSource(store);
      
      expect(dataSource).toBeInstanceOf(TripleStoreDataSource);
      
      // Test DataSource interface
      const result = await dataSource.update({
        operation: 'add',
        subject: 's1',
        predicate: 'p1',
        object: 'o1'
      });
      expect(result.success).toBe(true);
      
      const data = await dataSource.query({
        subject: 's1',
        predicate: null,
        object: null
      });
      expect(data).toHaveLength(1);
    });

    it('should work with any ITripleStore implementation', async () => {
      // Test with each provider type
      const providers = [
        createInMemoryTripleStore(),
        createDataScriptTripleStore()
      ];

      for (const provider of providers) {
        const dataSource = createTripleStoreDataSource(provider);
        expect(dataSource).toBeInstanceOf(TripleStoreDataSource);
        
        // Each should implement the DataSource interface
        expect(typeof dataSource.query).toBe('function');
        expect(typeof dataSource.update).toBe('function');
        expect(typeof dataSource.subscribe).toBe('function');
        expect(typeof dataSource.getSchema).toBe('function');
      }
    });

    it('should validate triple store input', () => {
      expect(() => createTripleStoreDataSource(null)).toThrow();
      expect(() => createTripleStoreDataSource({})).toThrow();
      expect(() => createTripleStoreDataSource('not a store')).toThrow();
    });
  });

  describe('createDefaultTripleStore', () => {
    it('should create an InMemoryProvider by default', () => {
      const store = createDefaultTripleStore();
      
      expect(store).toBeInstanceOf(InMemoryProvider);
      expect(store).toBeInstanceOf(ITripleStore);
    });

    it('should accept type option for different providers', () => {
      const memoryStore = createDefaultTripleStore({ type: 'memory' });
      expect(memoryStore).toBeInstanceOf(InMemoryProvider);
      
      const datascriptStore = createDefaultTripleStore({ type: 'datascript' });
      expect(datascriptStore).toBeInstanceOf(DataScriptProvider);
    });

    it('should pass options to the selected provider', async () => {
      const store = createDefaultTripleStore({ 
        type: 'memory',
        initialData: [['s', 'p', 'o']]
      });
      
      // Wait a bit for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const size = await store.size();
      expect(size).toBe(1);
    });

    it('should handle filesystem type with required options', () => {
      const dataSource = {
        query: async () => [],
        update: async () => ({ success: true }),
        subscribe: () => () => {},
        getSchema: () => ({ type: 'memory' })
      };

      const store = createDefaultTripleStore({ 
        type: 'filesystem',
        dataSource,
        filePath: '/tmp/test.json'
      });
      
      expect(store).toBeInstanceOf(FileSystemProvider);
    });

    it('should throw for unknown provider type', () => {
      expect(() => {
        createDefaultTripleStore({ type: 'unknown' });
      }).toThrow('Unknown triple store type: unknown');
    });

    it('should create wrapped DataSource when asDataSource is true', () => {
      const dataSource = createDefaultTripleStore({ 
        type: 'memory',
        asDataSource: true 
      });
      
      expect(dataSource).toBeInstanceOf(TripleStoreDataSource);
      expect(typeof dataSource.query).toBe('function');
      expect(typeof dataSource.update).toBe('function');
    });
  });

  describe('Factory Composition', () => {
    it('should allow chaining factory functions', async () => {
      // Create store -> wrap in DataSource
      const store = createInMemoryTripleStore();
      const dataSource = createTripleStoreDataSource(store);
      
      // Use through DataSource interface
      await dataSource.update({
        operation: 'add',
        subject: 'test',
        predicate: 'type',
        object: 'Example'
      });
      
      const results = await dataSource.query({
        subject: 'test',
        predicate: null,
        object: null
      });
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        subject: 'test',
        predicate: 'type',
        object: 'Example'
      });
    });

    it('should support advanced configurations', () => {
      // DataScript with schema, wrapped as DataSource
      const schema = {
        ':entity/id': { ':db/unique': ':db.unique/identity' },
        ':entity/name': { ':db/cardinality': ':db.cardinality/one' }
      };

      const store = createDataScriptTripleStore({ schema });
      const dataSource = createTripleStoreDataSource(store);
      
      const schemaInfo = dataSource.getSchema();
      expect(schemaInfo.type).toBe('triplestore');
      expect(schemaInfo.provider).toBe('datascript');
      expect(schemaInfo.capabilities.datalog).toBe(true);
    });
  });
});