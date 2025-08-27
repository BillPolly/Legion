/**
 * Unit Tests for FileWriterTool
 * Using REAL file system operations - no mocks!
 * Testing both current legacy version and future modern version
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import FileWriterTool from '../FileWriterTool.js';

describe('FileWriterTool Tests', () => {
  let testDir;
  let tool;
  
  beforeAll(async () => {
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-file-writer-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    tool = new FileWriterTool({ basePath: testDir, createDirectories: true });
  });
  
  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('Tool Construction and Schema', () => {
    it('should create FileWriterTool with proper schema', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_writer');
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeDefined();
      expect(tool.schema.input).toBeDefined();
      expect(tool.schema.output).toBeDefined();
    });

    it('should require basePath parameter', () => {
      expect(() => new FileWriterTool({})).toThrow('basePath is required');
    });

    it('should use default settings when not specified', () => {
      const defaultTool = new FileWriterTool({ basePath: testDir });
      expect(defaultTool.encoding).toBe('utf-8');
      expect(defaultTool.createDirectories).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customTool = new FileWriterTool({ 
        basePath: testDir, 
        encoding: 'ascii',
        createDirectories: true
      });
      expect(customTool.encoding).toBe('ascii');
      expect(customTool.createDirectories).toBe(true);
    });
  });

  describe('File Writing Operations', () => {
    it('should write text files successfully', async () => {
      const testContent = 'Hello World Test Content';
      const result = await tool.execute({ 
        filePath: 'write-test.txt', 
        content: testContent 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).toContain('write-test.txt');
        expect(result.data.bytesWritten).toBe(testContent.length);
      } else {
        expect(result.path).toContain('write-test.txt');
        expect(result.bytesWritten).toBe(testContent.length);
      }
      
      // Verify file was actually written
      const written = await fs.readFile(path.join(testDir, 'write-test.txt'), 'utf-8');
      expect(written).toBe(testContent);
    });

    it('should write JSON objects successfully', async () => {
      const testObj = { name: 'test', value: 42, array: [1, 2, 3] };
      const result = await tool.execute({ 
        filePath: 'write-test.json', 
        content: testObj 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).toContain('write-test.json');
      } else {
        expect(result.path).toContain('write-test.json');
      }
      
      // Verify JSON was properly formatted
      const written = await fs.readFile(path.join(testDir, 'write-test.json'), 'utf-8');
      const parsed = JSON.parse(written);
      expect(parsed).toEqual(testObj);
      expect(written).toContain('  "name"'); // Should be pretty-printed
    });

    it('should handle empty content', async () => {
      const result = await tool.execute({ 
        filePath: 'empty-test.txt', 
        content: '' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.bytesWritten).toBe(0);
      } else {
        expect(result.bytesWritten).toBe(0);
      }
      
      const written = await fs.readFile(path.join(testDir, 'empty-test.txt'), 'utf-8');
      expect(written).toBe('');
    });

    it('should handle Unicode content correctly', async () => {
      const unicodeContent = 'Hello 世界 🌍 æøå';
      const result = await tool.execute({ 
        filePath: 'unicode-test.txt', 
        content: unicodeContent 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('unicode-test.txt');
      }
      
      const written = await fs.readFile(path.join(testDir, 'unicode-test.txt'), 'utf-8');
      expect(written).toBe(unicodeContent);
    });

    it('should write to subdirectories when createDirectories is true', async () => {
      const result = await tool.execute({ 
        filePath: 'nested/deep/structure/file.txt', 
        content: 'Nested content' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('file.txt');
      }
      
      const written = await fs.readFile(path.join(testDir, 'nested/deep/structure/file.txt'), 'utf-8');
      expect(written).toBe('Nested content');
    });
  });

  describe('Append Mode Operations', () => {
    beforeEach(async () => {
      // Setup initial file for append tests
      await fs.writeFile(path.join(testDir, 'append-test.txt'), 'Initial content\n');
    });

    it('should append to existing files', async () => {
      const appendContent = 'Appended content\n';
      const result = await tool.execute({ 
        filePath: 'append-test.txt', 
        content: appendContent,
        append: true 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.bytesWritten).toBe(appendContent.length);
      } else {
        expect(result.bytesWritten).toBe(appendContent.length);
      }
      
      const content = await fs.readFile(path.join(testDir, 'append-test.txt'), 'utf-8');
      expect(content).toBe('Initial content\nAppended content\n');
    });

    it('should overwrite by default (append: false)', async () => {
      const newContent = 'Overwritten content';
      const result = await tool.execute({ 
        filePath: 'append-test.txt', 
        content: newContent,
        append: false 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('append-test.txt');
      }
      
      const content = await fs.readFile(path.join(testDir, 'append-test.txt'), 'utf-8');
      expect(content).toBe(newContent);
    });

    it('should handle multiple append operations', async () => {
      const lines = ['Line 2\n', 'Line 3\n', 'Line 4\n'];
      
      for (const line of lines) {
        const result = await tool.execute({ 
          filePath: 'append-test.txt', 
          content: line,
          append: true 
        });
        
        if (result.success !== undefined) {
          expect(result.success).toBe(true);
        }
      }
      
      const content = await fs.readFile(path.join(testDir, 'append-test.txt'), 'utf-8');
      expect(content).toBe('Initial content\nLine 2\nLine 3\nLine 4\n');
    });
  });

  describe('Error Handling', () => {
    it('should validate file path input', async () => {
      const result = await tool.execute({ 
        filePath: '', 
        content: 'test' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('invalid_path');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('invalid_path');
      }
    });

    it('should handle null file path', async () => {
      const result = await tool.execute({ 
        filePath: null, 
        content: 'test' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('invalid_path');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('invalid_path');
      }
    });

    it('should handle missing content parameter', async () => {
      const result = await tool.execute({ filePath: 'test.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle directory creation failure when createDirectories is false', async () => {
      const noCreateTool = new FileWriterTool({ basePath: testDir, createDirectories: false });
      
      const result = await noCreateTool.execute({ 
        filePath: 'nonexistent/deep/path/file.txt', 
        content: 'test' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('directory_not_found');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('directory_not_found');
      }
    });

    it('should handle attempts to write to existing directory', async () => {
      await fs.mkdir(path.join(testDir, 'is-directory'));
      
      const result = await tool.execute({ 
        filePath: 'is-directory', 
        content: 'test' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('write_error');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('write_error');
      }
    });
  });

  describe('Security and Path Validation', () => {
    it('should prevent path traversal attacks', async () => {
      const result = await tool.execute({ 
        filePath: '../../../tmp/malicious.txt', 
        content: 'malicious content' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('access_denied');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('access_denied');
      }
    });

    it('should handle null byte injection', async () => {
      const result = await tool.execute({ 
        filePath: 'test.txt\0hidden.txt', 
        content: 'test content' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('invalid_path');
      } else {
        expect(result.error).toBeDefined();
        expect(result.errorType).toBe('invalid_path');
      }
    });

    it('should respect basePath restrictions', async () => {
      const restrictedTool = new FileWriterTool({ basePath: testDir });
      
      // Should work within basePath
      const allowedResult = await restrictedTool.execute({ 
        filePath: 'allowed.txt', 
        content: 'allowed content' 
      });
      
      if (allowedResult.success !== undefined) {
        expect(allowedResult.success).toBe(true);
      } else {
        expect(allowedResult.path).toContain('allowed.txt');
      }
      
      // Should fail outside basePath
      const deniedResult = await restrictedTool.execute({ 
        filePath: '../outside.txt', 
        content: 'denied content' 
      });
      
      if (deniedResult.success !== undefined) {
        expect(deniedResult.success).toBe(false);
        expect(deniedResult.data.errorType).toBe('access_denied');
      } else {
        expect(deniedResult.error).toBeDefined();
        expect(deniedResult.errorType).toBe('access_denied');
      }
    });

    it('should normalize paths correctly', async () => {
      const result = await tool.execute({ 
        filePath: './test/../normalize-test.txt', 
        content: 'normalized content' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).not.toContain('./');
        expect(result.data.path).not.toContain('../');
      } else {
        expect(result.path).not.toContain('./');
        expect(result.path).not.toContain('../');
      }
    });
  });

  describe('Content Type Handling', () => {
    it('should convert numbers to strings', async () => {
      const result = await tool.execute({ 
        filePath: 'number-test.txt', 
        content: 12345 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('number-test.txt');
      }
      
      const content = await fs.readFile(path.join(testDir, 'number-test.txt'), 'utf-8');
      expect(content).toBe('12345');
    });

    it('should convert boolean to strings', async () => {
      const result = await tool.execute({ 
        filePath: 'boolean-test.txt', 
        content: true 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('boolean-test.txt');
      }
      
      const content = await fs.readFile(path.join(testDir, 'boolean-test.txt'), 'utf-8');
      expect(content).toBe('true');
    });

    it('should stringify complex objects', async () => {
      const complexObj = {
        nested: { data: [1, 2, 3] },
        func: function() { return 'test'; },
        date: new Date('2024-01-01'),
        regex: /test/g
      };
      
      const result = await tool.execute({ 
        filePath: 'complex-object.json', 
        content: complexObj 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('complex-object.json');
      }
      
      const content = await fs.readFile(path.join(testDir, 'complex-object.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.nested.data).toEqual([1, 2, 3]);
      expect(parsed.date).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('Performance and Concurrent Operations', () => {
    it('should handle large file writes efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of data
      
      const startTime = Date.now();
      const result = await tool.execute({
        filePath: 'large-file.txt',
        content: largeContent
      });
      const duration = Date.now() - startTime;
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.bytesWritten).toBe(largeContent.length);
      } else {
        expect(result.bytesWritten).toBe(largeContent.length);
      }
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify file was written correctly
      const stats = await fs.stat(path.join(testDir, 'large-file.txt'));
      expect(stats.size).toBe(largeContent.length);
    });

    it('should handle concurrent file writes', async () => {
      const operations = [];
      
      // Start multiple file writes concurrently
      for (let i = 0; i < 5; i++) {
        operations.push(
          tool.execute({
            filePath: `concurrent-${i}.txt`,
            content: `Content for file ${i}`
          })
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach((result, index) => {
        if (result.success !== undefined) {
          expect(result.success).toBe(true);
          expect(result.data.path).toContain(`concurrent-${index}.txt`);
        } else {
          expect(result.path).toContain(`concurrent-${index}.txt`);
        }
      });
      
      // Verify all files were created correctly
      for (let i = 0; i < 5; i++) {
        const content = await fs.readFile(path.join(testDir, `concurrent-${i}.txt`), 'utf-8');
        expect(content).toBe(`Content for file ${i}`);
      }
    });
  });

  describe('Encoding Support', () => {
    it('should respect custom encoding setting', async () => {
      const asciiTool = new FileWriterTool({ basePath: testDir, encoding: 'ascii' });
      const content = 'Hello ASCII';
      
      const result = await asciiTool.execute({ 
        filePath: 'ascii-test.txt', 
        content 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('ascii-test.txt');
      }
      
      // Read with same encoding to verify
      const written = await fs.readFile(path.join(testDir, 'ascii-test.txt'), 'ascii');
      expect(written).toBe(content);
    });

    it('should handle UTF-8 encoding by default', async () => {
      const utf8Content = 'Hello 世界 🌍 æøå';
      
      const result = await tool.execute({ 
        filePath: 'utf8-test.txt', 
        content: utf8Content 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('utf8-test.txt');
      }
      
      const written = await fs.readFile(path.join(testDir, 'utf8-test.txt'), 'utf-8');
      expect(written).toBe(utf8Content);
    });
  });

  describe('File System Integration', () => {
    it('should overwrite existing files correctly', async () => {
      // Create initial file
      await fs.writeFile(path.join(testDir, 'overwrite-test.txt'), 'original content');
      
      // Overwrite with new content
      const newContent = 'new content';
      const result = await tool.execute({ 
        filePath: 'overwrite-test.txt', 
        content: newContent 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('overwrite-test.txt');
      }
      
      // Verify content was replaced
      const written = await fs.readFile(path.join(testDir, 'overwrite-test.txt'), 'utf-8');
      expect(written).toBe(newContent);
    });

    it('should create files with correct permissions', async () => {
      const result = await tool.execute({ 
        filePath: 'permission-test.txt', 
        content: 'test content' 
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('permission-test.txt');
      }
      
      // Check file is readable and writable
      const filePath = path.join(testDir, 'permission-test.txt');
      await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
      
      // Should not throw - if it does, permissions are incorrect
    });
  });
});