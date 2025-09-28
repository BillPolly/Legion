import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemProvider } from '../../src/providers/FileSystemProvider.js';
import { LocalFileSystemDataSource } from '@legion/filesystem';
import fs from 'fs/promises';
import path from 'path';

/**
 * Integration tests for FileSystemProvider with real LocalFileSystemDataSource
 * 
 * These tests verify that FileSystemProvider works correctly with real filesystem
 * operations through the DataSource abstraction.
 */
describe('FileSystemProvider Integration Tests', () => {
  const testDir = path.join(process.cwd(), '__tests__/tmp/filesystem-provider-integration');
  let dataSource;

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
    await fs.mkdir(testDir, { recursive: true });
    
    // Create real LocalFileSystemDataSource
    dataSource = new LocalFileSystemDataSource({ rootPath: testDir });
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Operations with Real Filesystem', () => {
    it('should create FileSystemProvider with LocalFileSystemDataSource', () => {
      const filePath = path.join(testDir, 'data.json');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider).toBeDefined();
      expect(provider.dataSource).toBe(dataSource);
      expect(provider.format).toBe('json');
    });

    it('should save and load triples to/from real file', async () => {
      const filePath = path.join(testDir, 'triples.json');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Add some triples
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:2', 'hasName', 'Bob');
      
      // Save to file
      await provider.save();
      
      // Verify file exists on disk
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      const triples = JSON.parse(content);
      
      expect(triples).toHaveLength(3);
      expect(triples).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(triples).toContainEqual(['user:1', 'hasAge', 30]);
      expect(triples).toContainEqual(['user:2', 'hasName', 'Bob']);
    });

    it('should load existing file on first query', async () => {
      const filePath = path.join(testDir, 'existing.json');
      
      // Pre-create file with triples
      const triples = [
        ['product:1', 'hasName', 'Widget'],
        ['product:1', 'hasPrice', 9.99],
        ['product:2', 'hasName', 'Gadget']
      ];
      await fs.writeFile(filePath, JSON.stringify(triples, null, 2), 'utf8');
      
      // Create provider (file not loaded yet)
      const provider = new FileSystemProvider(dataSource, filePath);
      expect(provider.loaded).toBe(false);
      
      // Query should trigger load
      const size = await provider.size();
      expect(size).toBe(3);
      expect(provider.loaded).toBe(true);
      
      // Verify triples are accessible
      const results = await provider.query('product:1', null, null);
      expect(results).toHaveLength(2);
    });

    it('should handle non-existent file gracefully', async () => {
      const filePath = path.join(testDir, 'nonexistent.json');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Should start with empty store
      const size = await provider.size();
      expect(size).toBe(0);
      
      // Add triple and save
      await provider.addTriple('x', 'y', 'z');
      await provider.save();
      
      // File should now exist
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Multiple Format Support', () => {
    it('should save and load JSON format', async () => {
      const filePath = path.join(testDir, 'data.json');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.save();
      
      // Reload in new provider
      const provider2 = new FileSystemProvider(dataSource, filePath);
      const size = await provider2.size();
      expect(size).toBe(1);
      
      const results = await provider2.query('user:1', 'hasName', null);
      expect(results[0][2]).toBe('Alice');
    });

    it('should save and load Turtle format', async () => {
      const filePath = path.join(testDir, 'data.ttl');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('turtle');
      
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice');
      await provider.save();
      
      // Verify file content is Turtle format
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain('<http://example.org/user1>');
      expect(content).toContain('<http://example.org/name>');
      expect(content).toContain('"Alice"');
      
      // Reload and verify
      const provider2 = new FileSystemProvider(dataSource, filePath);
      const results = await provider2.query('http://example.org/user1', 'http://example.org/name', null);
      expect(results[0][2]).toBe('Alice');
    });

    it('should save and load N-Triples format', async () => {
      const filePath = path.join(testDir, 'data.nt');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      expect(provider.format).toBe('ntriples');
      
      await provider.addTriple('http://example.org/user1', 'http://example.org/name', 'Alice');
      await provider.save();
      
      // Verify file content is N-Triples format
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain('<http://example.org/user1>');
      expect(content).toContain('<http://example.org/name>');
      expect(content).toContain('"Alice"');
      
      // Reload and verify
      const provider2 = new FileSystemProvider(dataSource, filePath);
      const results = await provider2.query('http://example.org/user1', 'http://example.org/name', null);
      expect(results[0][2]).toBe('Alice');
    });
  });

  describe('Auto-save Feature', () => {
    it('should auto-save when auto-save is enabled', async () => {
      const filePath = path.join(testDir, 'autosave.json');
      const provider = new FileSystemProvider(dataSource, filePath, { autoSave: true });
      
      // Add triple - should trigger auto-save
      await provider.addTriple('x', 'y', 'z');
      
      // File should exist immediately
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      // File should contain the triple
      const content = await fs.readFile(filePath, 'utf8');
      const triples = JSON.parse(content);
      expect(triples).toHaveLength(1);
    });

    it('should not auto-save when auto-save is disabled', async () => {
      const filePath = path.join(testDir, 'noautosave.json');
      const provider = new FileSystemProvider(dataSource, filePath, { autoSave: false });
      
      // Add triple - should NOT trigger auto-save
      await provider.addTriple('x', 'y', 'z');
      
      // File should NOT exist yet
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
      
      // Manual save should work
      await provider.save();
      
      const existsAfterSave = await fs.access(filePath).then(() => true).catch(() => false);
      expect(existsAfterSave).toBe(true);
    });
  });

  describe('Complete Knowledge Graph Workflow', () => {
    it('should build, save, and query a complete knowledge graph', async () => {
      const filePath = path.join(testDir, 'knowledge-graph.json');
      const provider = new FileSystemProvider(dataSource, filePath);
      
      // Build a knowledge graph
      await provider.addTriple('user:1', 'hasName', 'Alice');
      await provider.addTriple('user:1', 'hasAge', 30);
      await provider.addTriple('user:1', 'livesIn', 'city:nyc');
      await provider.addTriple('user:1', 'worksAt', 'company:abc');
      
      await provider.addTriple('user:2', 'hasName', 'Bob');
      await provider.addTriple('user:2', 'hasAge', 25);
      await provider.addTriple('user:2', 'livesIn', 'city:sf');
      
      await provider.addTriple('city:nyc', 'hasName', 'New York City');
      await provider.addTriple('city:sf', 'hasName', 'San Francisco');
      
      // Save
      await provider.save();
      
      // Create new provider and load
      const provider2 = new FileSystemProvider(dataSource, filePath);
      
      // Query in various ways
      const aliceFacts = await provider2.query('user:1', null, null);
      expect(aliceFacts).toHaveLength(4);
      
      const allNames = await provider2.query(null, 'hasName', null);
      expect(allNames.length).toBeGreaterThanOrEqual(4);
      
      const youngPeople = await provider2.query(null, 'hasAge', 25);
      expect(youngPeople).toHaveLength(1);
      expect(youngPeople[0][0]).toBe('user:2');
      
      const size = await provider2.size();
      expect(size).toBe(9);
    });
  });
});