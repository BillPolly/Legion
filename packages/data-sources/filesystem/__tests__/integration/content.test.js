import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileSystemDataSource - Content Query Operations', () => {
  let dataSource;
  let testDir;
  
  beforeEach(() => {
    // Create a unique test directory in temp
    testDir = path.join(os.tmpdir(), `fs-datasource-content-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test files with various content types
    fs.writeFileSync(path.join(testDir, 'text.txt'), 'Hello, World!\nLine 2\nLine 3');
    fs.writeFileSync(path.join(testDir, 'json.json'), JSON.stringify({ key: 'value', number: 42 }, null, 2));
    fs.writeFileSync(path.join(testDir, 'binary.dat'), Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]));
    fs.writeFileSync(path.join(testDir, 'large.txt'), 'x'.repeat(10000));
    fs.writeFileSync(path.join(testDir, 'empty.txt'), '');
    
    dataSource = new FileSystemDataSource({ rootPath: testDir });
  });
  
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('UTF-8 content reading', () => {
    it('should read text file content as UTF-8', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'text.txt',
        operation: 'content'
      });
      
      expect(result).toBe('Hello, World!\nLine 2\nLine 3');
      expect(typeof result).toBe('string');
    });
    
    it('should read JSON file content as UTF-8', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'json.json',
        operation: 'content',
        encoding: 'utf8'
      });
      
      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.key).toBe('value');
      expect(parsed.number).toBe(42);
    });
    
    it('should read empty file', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'empty.txt',
        operation: 'content'
      });
      
      expect(result).toBe('');
    });
  });
  
  describe('Buffer content reading', () => {
    it('should read binary file as buffer', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'binary.dat',
        operation: 'content',
        encoding: 'buffer'
      });
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(5);
      expect(result[0]).toBe(0x00);
      expect(result[4]).toBe(0xFF);
    });
    
    it('should read text file as buffer', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'text.txt',
        operation: 'content',
        encoding: 'buffer'
      });
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf8')).toBe('Hello, World!\nLine 2\nLine 3');
    });
  });
  
  describe('Base64 content reading', () => {
    it('should read binary file as base64', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'binary.dat',
        operation: 'content',
        encoding: 'base64'
      });
      
      expect(typeof result).toBe('string');
      // Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]) in base64
      expect(result).toBe('AAECA/8=');
    });
    
    it('should read text file as base64', () => {
      const result = dataSource.query({
        type: 'file',
        path: 'text.txt',
        operation: 'content',
        encoding: 'base64'
      });
      
      expect(typeof result).toBe('string');
      const decoded = Buffer.from(result, 'base64').toString('utf8');
      expect(decoded).toBe('Hello, World!\nLine 2\nLine 3');
    });
  });
  
  describe('Error handling', () => {
    it('should throw error for non-existent file', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'nonexistent.txt',
          operation: 'content'
        });
      }).toThrow('File not found');
    });
    
    it('should throw error when reading directory as file', () => {
      fs.mkdirSync(path.join(testDir, 'subdir'));
      
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'subdir',
          operation: 'content'
        });
      }).toThrow('Path is not a file');
    });
    
    it('should throw error for invalid encoding', () => {
      expect(() => {
        dataSource.query({
          type: 'file',
          path: 'text.txt',
          operation: 'content',
          encoding: 'invalid'
        });
      }).toThrow('Invalid encoding');
    });
  });
});