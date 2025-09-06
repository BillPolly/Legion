import { FileSystemTripleStore } from '@legion/kg-storage-file';
import { StorageError, ValidationError } from '@legion/kg-storage-core';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemTripleStore', () => {
  let tempDir;
  let store;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, '..', 'temp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    if (store) {
      await store.close();
      store = null;
    }
    
    // Remove temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor and Configuration', () => {
    test('should create store with JSON format by default', () => {
      const filePath = path.join(tempDir, 'test.json');
      store = new FileSystemTripleStore(filePath);
      
      const metadata = store.getMetadata();
      expect(metadata.type).toBe('file');
      expect(metadata.format).toBe('json');
      expect(metadata.filePath).toBe(path.resolve(filePath));
      expect(metadata.autoSave).toBe(true);
    });

    test('should detect format from file extension', () => {
      const turtleStore = new FileSystemTripleStore(path.join(tempDir, 'test.ttl'));
      expect(turtleStore.getMetadata().format).toBe('turtle');

      const ntriplesStore = new FileSystemTripleStore(path.join(tempDir, 'test.nt'));
      expect(ntriplesStore.getMetadata().format).toBe('ntriples');
    });

    test('should accept custom options', () => {
      const filePath = path.join(tempDir, 'test.json');
      store = new FileSystemTripleStore(filePath, {
        format: 'turtle',
        autoSave: false,
        watchForChanges: true
      });
      
      const metadata = store.getMetadata();
      expect(metadata.format).toBe('turtle');
      expect(metadata.autoSave).toBe(false);
      expect(metadata.watchForChanges).toBe(true);
    });

    test('should throw error for invalid file path', () => {
      expect(() => {
        new FileSystemTripleStore('');
      }).toThrow(ValidationError);
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        new FileSystemTripleStore(path.join(tempDir, 'test.json'), { format: 'xml' });
      }).toThrow(ValidationError);
    });
  });

  describe('Basic Operations - JSON Format', () => {
    beforeEach(() => {
      const filePath = path.join(tempDir, 'test.json');
      store = new FileSystemTripleStore(filePath);
    });

    test('should add triples correctly', async () => {
      const result = await store.addTriple('subject1', 'predicate1', 'object1');
      expect(result).toBe(true);
      
      const size = await store.size();
      expect(size).toBe(1);
    });

    test('should detect duplicate triples', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      const result = await store.addTriple('subject1', 'predicate1', 'object1');
      expect(result).toBe(false);
      
      const size = await store.size();
      expect(size).toBe(1);
    });

    test('should remove triples correctly', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      const result = await store.removeTriple('subject1', 'predicate1', 'object1');
      expect(result).toBe(true);
      
      const size = await store.size();
      expect(size).toBe(0);
    });

    test('should handle non-existent triple removal', async () => {
      const result = await store.removeTriple('nonexistent', 'predicate', 'object');
      expect(result).toBe(false);
    });

    test('should query exact triples', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      
      const results = await store.query('subject1', 'predicate1', 'object1');
      expect(results).toEqual([['subject1', 'predicate1', 'object1']]);
    });

    test('should query with patterns', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      await store.addTriple('subject1', 'predicate2', 'object2');
      await store.addTriple('subject2', 'predicate1', 'object3');
      
      // Query by subject
      const subjectResults = await store.query('subject1', null, null);
      expect(subjectResults).toHaveLength(2);
      expect(subjectResults).toContainEqual(['subject1', 'predicate1', 'object1']);
      expect(subjectResults).toContainEqual(['subject1', 'predicate2', 'object2']);
      
      // Query by predicate
      const predicateResults = await store.query(null, 'predicate1', null);
      expect(predicateResults).toHaveLength(2);
      expect(predicateResults).toContainEqual(['subject1', 'predicate1', 'object1']);
      expect(predicateResults).toContainEqual(['subject2', 'predicate1', 'object3']);
    });

    test('should clear all triples', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      await store.addTriple('subject2', 'predicate2', 'object2');
      
      await store.clear();
      const size = await store.size();
      expect(size).toBe(0);
    });
  });

  describe('File Persistence - JSON Format', () => {
    let filePath;

    beforeEach(() => {
      filePath = path.join(tempDir, 'persistence.json');
      store = new FileSystemTripleStore(filePath);
    });

    test('should save data to file automatically', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      
      // Check if file exists and contains data
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      expect(data).toEqual([['subject1', 'predicate1', 'object1']]);
    });

    test('should load data from existing file', async () => {
      // Create file with initial data
      const initialData = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];
      await fs.writeFile(filePath, JSON.stringify(initialData), 'utf8');
      
      // Create new store instance
      const newStore = new FileSystemTripleStore(filePath);
      
      const size = await newStore.size();
      expect(size).toBe(2);
      
      const results = await newStore.query(null, null, null);
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(['subject1', 'predicate1', 'object1']);
      expect(results).toContainEqual(['subject2', 'predicate2', 'object2']);
      
      await newStore.close();
    });

    test('should handle missing file gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.json');
      const newStore = new FileSystemTripleStore(nonExistentPath);
      
      const size = await newStore.size();
      expect(size).toBe(0);
      
      await newStore.close();
    });

    test('should perform atomic writes', async () => {
      await store.addTriple('subject1', 'predicate1', 'object1');
      
      // Verify no .tmp file remains
      const tempFile = filePath + '.tmp';
      const tempExists = await fs.access(tempFile).then(() => true).catch(() => false);
      expect(tempExists).toBe(false);
    });
  });

  describe('Auto-save Functionality', () => {
    test('should auto-save when enabled', async () => {
      const filePath = path.join(tempDir, 'autosave.json');
      store = new FileSystemTripleStore(filePath, { autoSave: true });
      
      await store.addTriple('subject1', 'predicate1', 'object1');
      
      // File should exist immediately
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should not auto-save when disabled', async () => {
      const filePath = path.join(tempDir, 'noautosave.json');
      store = new FileSystemTripleStore(filePath, { autoSave: false });
      
      await store.addTriple('subject1', 'predicate1', 'object1');
      
      // File should not exist yet
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
      
      // Manual save should work
      await store.save();
      const fileExistsAfterSave = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExistsAfterSave).toBe(true);
    });
  });

  describe('Type Preservation', () => {
    beforeEach(() => {
      const filePath = path.join(tempDir, 'types.json');
      store = new FileSystemTripleStore(filePath);
    });

    test('should preserve number types', async () => {
      await store.addTriple('subject', 'age', 25);
      await store.addTriple('subject', 'score', 98.5);
      
      const results = await store.query('subject', null, null);
      expect(results).toContainEqual(['subject', 'age', 25]);
      expect(results).toContainEqual(['subject', 'score', 98.5]);
    });

    test('should preserve boolean types', async () => {
      await store.addTriple('subject', 'active', true);
      await store.addTriple('subject', 'deleted', false);
      
      const results = await store.query('subject', null, null);
      expect(results).toContainEqual(['subject', 'active', true]);
      expect(results).toContainEqual(['subject', 'deleted', false]);
    });

    test('should preserve null values', async () => {
      await store.addTriple('subject', 'value', null);
      
      const results = await store.query('subject', 'value', null);
      expect(results).toEqual([['subject', 'value', null]]);
    });

    test('should preserve string types', async () => {
      await store.addTriple('subject', 'name', 'John Doe');
      await store.addTriple('subject', 'empty', '');
      
      const results = await store.query('subject', null, null);
      expect(results).toContainEqual(['subject', 'name', 'John Doe']);
      expect(results).toContainEqual(['subject', 'empty', '']);
    });
  });

  describe('Format Round-trip Tests', () => {
    test('should round-trip JSON format correctly', async () => {
      const filePath = path.join(tempDir, 'roundtrip.json');
      store = new FileSystemTripleStore(filePath, { format: 'json' });
      
      const testTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 42],
        ['subject3', 'predicate3', true],
        ['subject4', 'predicate4', null]
      ];
      
      // Add all triples
      for (const [s, p, o] of testTriples) {
        await store.addTriple(s, p, o);
      }
      
      // Create new store instance to test loading
      await store.close();
      const newStore = new FileSystemTripleStore(filePath);
      
      const results = await newStore.query(null, null, null);
      expect(results).toHaveLength(testTriples.length);
      
      for (const triple of testTriples) {
        expect(results).toContainEqual(triple);
      }
      
      await newStore.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      // Try to create store in non-existent directory without recursive creation
      const invalidPath = path.join(tempDir, 'nonexistent', 'deep', 'path', 'test.json');
      store = new FileSystemTripleStore(invalidPath, { autoSave: false });
      
      await store.addTriple('subject', 'predicate', 'object');
      
      // Manual save should handle directory creation
      await expect(store.save()).resolves.not.toThrow();
    });

    test('should handle corrupted JSON files', async () => {
      const filePath = path.join(tempDir, 'corrupted.json');
      
      // Create corrupted JSON file
      await fs.writeFile(filePath, '{ invalid json', 'utf8');
      
      store = new FileSystemTripleStore(filePath);
      
      // Should throw error when trying to load
      await expect(store.size()).rejects.toThrow(StorageError);
    });
  });

  describe('Performance Tests', () => {
    test('should handle moderate datasets efficiently', async () => {
      const filePath = path.join(tempDir, 'performance.json');
      store = new FileSystemTripleStore(filePath, { autoSave: false });
      
      const startTime = Date.now();
      
      // Add 1000 triples
      for (let i = 0; i < 1000; i++) {
        await store.addTriple(`subject${i}`, `predicate${i % 10}`, `object${i}`);
      }
      
      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Query performance
      const queryStart = Date.now();
      const results = await store.query(null, 'predicate5', null);
      const queryTime = Date.now() - queryStart;
      
      expect(results).toHaveLength(100); // Should find 100 matches
      expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Metadata', () => {
    test('should return correct metadata', () => {
      const filePath = path.join(tempDir, 'metadata.json');
      store = new FileSystemTripleStore(filePath, {
        format: 'turtle',
        autoSave: false,
        watchForChanges: true
      });
      
      const metadata = store.getMetadata();
      expect(metadata).toEqual({
        type: 'file',
        supportsTransactions: false,
        supportsPersistence: true,
        supportsAsync: true,
        maxTriples: Infinity,
        filePath: path.resolve(filePath),
        format: 'turtle',
        autoSave: false,
        watchForChanges: true
      });
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources on close', async () => {
      const filePath = path.join(tempDir, 'cleanup.json');
      store = new FileSystemTripleStore(filePath, { autoSave: false });
      
      await store.addTriple('subject', 'predicate', 'object');
      
      // Close should save if dirty and autoSave is enabled
      await store.close();
      
      // File should exist after close
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});
