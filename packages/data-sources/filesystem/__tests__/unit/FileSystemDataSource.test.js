import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';

describe('FileSystemDataSource', () => {
  let dataSource;
  const testRootPath = '/tmp/test-filesystem-datasource';

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testRootPath)) {
      fs.mkdirSync(testRootPath, { recursive: true });
    }
  });

  describe('constructor', () => {
    it('should require rootPath option', () => {
      expect(() => {
        new FileSystemDataSource();
      }).toThrow('rootPath is required');
    });

    it('should create instance with custom root path', () => {
      dataSource = new FileSystemDataSource({ rootPath: testRootPath });
      expect(dataSource.rootPath).toBe(testRootPath);
    });

    it('should normalize root path to absolute', () => {
      // Create a relative path that exists
      const relativePath = path.relative(process.cwd(), testRootPath);
      dataSource = new FileSystemDataSource({ rootPath: relativePath });
      expect(path.isAbsolute(dataSource.rootPath)).toBe(true);
      expect(dataSource.rootPath).toBe(testRootPath);
    });

    it('should accept permissions option', () => {
      dataSource = new FileSystemDataSource({ 
        rootPath: testRootPath,
        permissions: 'r' 
      });
      expect(dataSource.permissions).toBe('r');
    });
  });

  describe('DataSource interface', () => {
    beforeEach(() => {
      dataSource = new FileSystemDataSource({ rootPath: testRootPath });
    });

    it('should implement query method', () => {
      expect(typeof dataSource.query).toBe('function');
    });

    it('should implement subscribe method', () => {
      expect(typeof dataSource.subscribe).toBe('function');
    });

    it('should implement getSchema method', () => {
      expect(typeof dataSource.getSchema).toBe('function');
    });

    it('should implement update method', () => {
      expect(typeof dataSource.update).toBe('function');
    });

    it('should implement validate method', () => {
      expect(typeof dataSource.validate).toBe('function');
    });
  });

  describe('query() method - metadata operation', () => {
    beforeEach(() => {
      dataSource = new FileSystemDataSource({ rootPath: testRootPath });
      // Create a test file
      const testFile = path.join(testRootPath, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
    });

    it('should return file metadata for metadata operation', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'test.txt',
        operation: 'metadata'
      });

      expect(result).toBeDefined();
      expect(result.path).toBe(path.join(testRootPath, 'test.txt'));
      expect(result.name).toBe('test.txt');
      expect(result.size).toBeGreaterThan(0);
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
    });

    it('should return directory metadata for metadata operation', () => {
      const result = dataSource.query({
        type: 'directory',
        path: '',
        operation: 'metadata'
      });

      expect(result).toBeDefined();
      expect(result.path).toBe(testRootPath);
      expect(result.isFile).toBe(false);
      expect(result.isDirectory).toBe(true);
    });

    it('should throw error for non-existent path', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: path.join(testRootPath, 'nonexistent.txt'),
          operation: 'metadata'
        });
      }).toThrow();
    });

    it('should include requested metadata fields', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'test.txt',
        operation: 'metadata',
        metadata: ['size', 'mtime', 'mode']
      });

      expect(result.size).toBeDefined();
      expect(result.mtime).toBeDefined();
      expect(result.mode).toBeDefined();
    });
  });

  describe('getSchema() method', () => {
    beforeEach(() => {
      dataSource = new FileSystemDataSource({ rootPath: testRootPath });
    });

    it('should return filesystem schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('filesystem');
      expect(schema.operations).toBeDefined();
      expect(schema.operations.query).toBeDefined();
      expect(schema.operations.update).toBeDefined();
      expect(schema.operations.subscribe).toBeDefined();
    });

    it('should include query operations in schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.operations.query.metadata).toBeDefined();
      expect(schema.operations.query.content).toBeDefined();
      expect(schema.operations.query.search).toBeDefined();
      expect(schema.operations.query.list).toBe(true);
    });

    it('should include update operations in schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.operations.update.create).toContain('file');
      expect(schema.operations.update.create).toContain('directory');
      expect(schema.operations.update.write).toContain('file');
      expect(schema.operations.update.delete).toContain('file');
      expect(schema.operations.update.delete).toContain('directory');
    });

    it('should include limits in schema', () => {
      const schema = dataSource.getSchema();
      
      expect(schema.limits).toBeDefined();
      expect(schema.limits.maxFileSize).toBeGreaterThan(0);
      expect(schema.limits.maxPathLength).toBeGreaterThan(0);
      expect(schema.limits.maxDirectoryDepth).toBeGreaterThan(0);
    });
  });

  // Clean up
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testRootPath)) {
      fs.rmSync(testRootPath, { recursive: true, force: true });
    }
  });
});