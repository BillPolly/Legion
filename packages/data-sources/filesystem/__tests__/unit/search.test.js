/**
 * Unit tests for FileSystemDataSource search operations
 * Tests glob pattern matching, regex search, and content search
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemDataSource - search operations', () => {
  const testRoot = path.join(__dirname, '../tmp/search-test');
  let dataSource;
  
  beforeAll(() => {
    // Create complex test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    
    // Create files at root
    fs.writeFileSync(path.join(testRoot, 'readme.md'), '# Test Project\nThis is a test file with search content.');
    fs.writeFileSync(path.join(testRoot, 'package.json'), '{"name": "test", "version": "1.0.0"}');
    fs.writeFileSync(path.join(testRoot, '.gitignore'), 'node_modules\n*.log');
    
    // Create src directory with JS files
    fs.mkdirSync(path.join(testRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testRoot, 'src/index.js'), 'console.log("Hello World");');
    fs.writeFileSync(path.join(testRoot, 'src/utils.js'), 'export function search() { return "found"; }');
    fs.writeFileSync(path.join(testRoot, 'src/config.json'), '{"search": true, "key": "value"}');
    
    // Create nested structure
    fs.mkdirSync(path.join(testRoot, 'src/components'), { recursive: true });
    fs.writeFileSync(path.join(testRoot, 'src/components/App.jsx'), 'import React from "react";\nexport default function App() {}');
    fs.writeFileSync(path.join(testRoot, 'src/components/Search.jsx'), 'export function Search() { return <div>Search</div>; }');
    
    // Create test directory
    fs.mkdirSync(path.join(testRoot, 'test'), { recursive: true });
    fs.writeFileSync(path.join(testRoot, 'test/search.test.js'), 'describe("search", () => {});');
    fs.writeFileSync(path.join(testRoot, 'test/utils.test.js'), 'test("utils", () => {});');
    
    // Create docs directory
    fs.mkdirSync(path.join(testRoot, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(testRoot, 'docs/search.md'), '# Search Documentation\nHow to search files');
    fs.writeFileSync(path.join(testRoot, 'docs/api.md'), '# API Documentation');
    
    // Initialize datasource
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  describe('glob pattern search', () => {
    it('should find files matching simple glob pattern', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '*.json'
      });
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2); // package.json, src/config.json
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('package.json');
      expect(paths).toContain('src/config.json');
    });
    
    it('should find files with extension glob', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*.js'
      });
      
      expect(result.length).toBe(4); // index.js, utils.js, search.test.js, utils.test.js
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/index.js');
      expect(paths).toContain('src/utils.js');
      expect(paths).toContain('test/search.test.js');
      expect(paths).toContain('test/utils.test.js');
    });
    
    it('should find files in specific directory', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: 'src/**/*.js'
      });
      
      expect(result.length).toBe(2); // Only JS files in src
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/index.js');
      expect(paths).toContain('src/utils.js');
    });
    
    it('should find JSX files', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*.jsx'
      });
      
      expect(result.length).toBe(2);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/components/App.jsx');
      expect(paths).toContain('src/components/Search.jsx');
    });
    
    it('should find markdown files', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*.md'
      });
      
      expect(result.length).toBe(3); // readme.md, docs/search.md, docs/api.md
    });
    
    it('should support negation patterns', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*.js',
        exclude: ['**/test/**']
      });
      
      expect(result.length).toBe(2); // Only src files, not test files
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/index.js');
      expect(paths).toContain('src/utils.js');
      expect(paths).not.toContain('test/search.test.js');
    });
    
    it('should limit search depth', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '*.json',
        maxDepth: 0  // 0 means only root level
      });
      
      expect(result.length).toBe(1); // Only package.json at root
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('package.json');
      expect(paths).not.toContain('src/config.json');
    });
    
    it('should include hidden files when specified', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '.*',
        includeHidden: true
      });
      
      expect(result.length).toBeGreaterThan(0);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('.gitignore');
    });
  });
  
  describe('regex pattern search', () => {
    it('should find files matching regex pattern', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'regex',
        value: 'search\\..*\\.js$'
      });
      
      expect(result.length).toBe(1);
      expect(result[0].relativePath).toBe('test/search.test.js');
    });
    
    it('should find files with case-insensitive regex', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'regex',
        value: 'SEARCH',
        flags: 'i'
      });
      
      expect(result.length).toBeGreaterThan(0);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/components/Search.jsx');
      expect(paths).toContain('test/search.test.js');
      expect(paths).toContain('docs/search.md');
    });
    
    it('should match complex regex patterns', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'regex',
        value: 'utils.*\\.jsx?$'  // Match any file with 'utils' in the name ending in .js or .jsx
      });
      
      expect(result.length).toBe(2);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/utils.js');
      expect(paths).toContain('test/utils.test.js');
    });
  });
  
  describe('content search', () => {
    it('should find files containing search string', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'search'
      });
      
      expect(result.length).toBeGreaterThan(0);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('readme.md'); // Contains "search content"
      expect(paths).toContain('src/utils.js'); // Contains function search()
      expect(paths).toContain('src/config.json'); // Contains "search": true
    });
    
    it('should find files with case-insensitive content search', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'HELLO',
        caseSensitive: false
      });
      
      expect(result.length).toBe(1);
      expect(result[0].relativePath).toBe('src/index.js'); // Contains "Hello World"
    });
    
    it('should include line numbers in results', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'Hello World',
        includeLineNumbers: true
      });
      
      expect(result.length).toBe(1);
      expect(result[0].relativePath).toBe('src/index.js');
      expect(result[0].matches).toBeDefined();
      expect(result[0].matches[0]).toEqual({
        line: 1,
        column: 14,
        text: 'console.log("Hello World");'
      });
    });
    
    it('should support regex in content search', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'export\\s+(function|default)',
        regex: true
      });
      
      expect(result.length).toBeGreaterThan(0);
      
      const paths = result.map(r => r.relativePath);
      expect(paths).toContain('src/utils.js');
      expect(paths).toContain('src/components/App.jsx');
      expect(paths).toContain('src/components/Search.jsx');
    });
    
    it('should limit content search to specific file types', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'search',
        fileTypes: ['md']
      });
      
      const paths = result.map(r => r.relativePath);
      paths.forEach(path => {
        expect(path.endsWith('.md')).toBe(true);
      });
    });
    
    it('should exclude binary files from content search', () => {
      // Create a binary file
      const binaryPath = path.join(testRoot, 'binary.dat');
      fs.writeFileSync(binaryPath, Buffer.from([0xFF, 0xFE, 0x00, 0x73, 0x65, 0x61, 0x72, 0x63, 0x68]));
      
      const result = dataSource.query({
        operation: 'search',
        pattern: 'content',
        value: 'search',
        excludeBinary: true
      });
      
      const paths = result.map(r => r.relativePath);
      expect(paths).not.toContain('binary.dat');
      
      // Clean up
      fs.unlinkSync(binaryPath);
    });
  });
  
  describe('combined search options', () => {
    it('should search with multiple patterns', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: ['*.js', '*.jsx']
      });
      
      expect(result.length).toBe(6); // All JS and JSX files
    });
    
    it('should apply filters to search results', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*',
        filter: {
          minSize: 50, // At least 50 bytes
          type: 'file'
        }
      });
      
      result.forEach(item => {
        expect(item.stats.size).toBeGreaterThanOrEqual(50);
        expect(item.stats.isFile).toBe(true);
      });
    });
    
    it('should sort search results', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*.js',
        sort: {
          by: 'name',
          order: 'asc'
        }
      });
      
      const names = result.map(r => r.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
    
    it('should limit number of results', () => {
      const result = dataSource.query({
        operation: 'search',
        pattern: 'glob',
        value: '**/*',
        limit: 5
      });
      
      expect(result.length).toBe(5);
    });
  });
});