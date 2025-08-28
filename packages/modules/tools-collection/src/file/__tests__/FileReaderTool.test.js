/**
 * Unit Tests for FileReaderTool
 * Using REAL file system operations - no mocks!
 * Testing both current legacy version and future modern version
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import FileReaderTool from '../FileReaderTool.js';

describe('FileReaderTool Tests', () => {
  let testDir;
  let tool;
  
  beforeAll(async () => {
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-file-reader-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    tool = new FileReaderTool({ basePath: testDir });
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
    it('should create FileReaderTool with proper schema', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_reader');
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeDefined();
      expect(tool.schema.input).toBeDefined();
      expect(tool.schema.output).toBeDefined();
    });

    it('should require basePath parameter', () => {
      expect(() => new FileReaderTool({})).toThrow('basePath is required');
    });

    it('should use default encoding when not specified', () => {
      const defaultTool = new FileReaderTool({ basePath: testDir });
      expect(defaultTool.encoding).toBe('utf-8');
    });

    it('should accept custom encoding', () => {
      const customTool = new FileReaderTool({ basePath: testDir, encoding: 'ascii' });
      expect(customTool.encoding).toBe('ascii');
    });
  });

  describe('File Reading Operations', () => {
    beforeEach(async () => {
      // Setup test files
      await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello World Test Content');
      await fs.writeFile(path.join(testDir, 'test.json'), JSON.stringify({ key: 'value', number: 42 }, null, 2));
      await fs.writeFile(path.join(testDir, 'empty.txt'), '');
      await fs.writeFile(path.join(testDir, 'unicode.txt'), 'Hello 世界 🌍');
      
      // Create subdirectory with files
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested file content');
    });

    it('should read text files successfully', async () => {
      const result = await tool.execute({ filePath: 'test.txt' });
      
      // Test current legacy format
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Hello World Test Content');
        expect(result.data.path).toContain('test.txt');
      } else {
        // Test future modern format
        expect(result.content).toBe('Hello World Test Content');
        expect(result.path).toContain('test.txt');
      }
    });

    it('should read JSON files successfully', async () => {
      const result = await tool.execute({ filePath: 'test.json' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toContain('key');
        expect(result.data.content).toContain('value');
        expect(result.data.content).toContain('42');
      } else {
        expect(result.content).toContain('key');
        expect(result.content).toContain('value');
        expect(result.content).toContain('42');
      }
    });

    it('should handle empty files', async () => {
      const result = await tool.execute({ filePath: 'empty.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('');
      } else {
        expect(result.content).toBe('');
      }
    });

    it('should handle Unicode characters correctly', async () => {
      const result = await tool.execute({ filePath: 'unicode.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Hello 世界 🌍');
      } else {
        expect(result.content).toBe('Hello 世界 🌍');
      }
    });

    it('should read files in subdirectories', async () => {
      const result = await tool.execute({ filePath: 'subdir/nested.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Nested file content');
        expect(result.data.path).toContain('nested.txt');
      } else {
        expect(result.content).toBe('Nested file content');
        expect(result.path).toContain('nested.txt');
      }
    });

    it('should handle relative paths correctly', async () => {
      const result = await tool.execute({ filePath: './test.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Hello World Test Content');
      } else {
        expect(result.content).toBe('Hello World Test Content');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      try {
        const result = await tool.execute({ filePath: 'nonexistent.txt' });
        
        // Legacy format check
        if (result.success !== undefined) {
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.data.errorType).toBe('file_not_found');
          expect(result.data.filePath).toBe('nonexistent.txt');
        } else {
          // Modern format - should not reach here
          fail('Expected error to be thrown');
        }
      } catch (error) {
        // Modern format - error is thrown
        expect(error.message).toBeDefined();
        expect(error.cause.errorType).toBe('file_not_found');
        expect(error.cause.filePath).toBe('nonexistent.txt');
      }
    });

    it('should validate file path input', async () => {
      const result = await tool.execute({ filePath: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/File path cannot be empty/);
    });

    it('should handle null file path', async () => {
      const result = await tool.execute({ filePath: null });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/File path must be a string/);
    });

    it('should handle undefined file path', async () => {
      try {
        await tool.execute({});
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBeDefined();
      }
    });

    it('should handle directories instead of files', async () => {
      await fs.mkdir(path.join(testDir, 'is-directory'));
      
      const result = await tool.execute({ filePath: 'is-directory' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Security and Path Validation', () => {
    it('should prevent path traversal attacks', async () => {
      const result = await tool.execute({ filePath: '../../../etc/passwd' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied.*outside/);
    });

    it('should handle null byte injection', async () => {
      const result = await tool.execute({ filePath: 'test.txt\0hidden.txt' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid file path/);
    });

    it('should respect basePath restrictions', async () => {
      const restrictedTool = new FileReaderTool({ basePath: testDir });
      
      // Should work within basePath
      await fs.writeFile(path.join(testDir, 'allowed.txt'), 'allowed content');
      const allowedResult = await restrictedTool.execute({ filePath: 'allowed.txt' });
      
      if (allowedResult.success !== undefined) {
        expect(allowedResult.success).toBe(true);
      } else {
        expect(allowedResult.content).toBe('allowed content');
      }
      
      // Should fail outside basePath
      const deniedResult = await restrictedTool.execute({ filePath: '../outside.txt' });
      
      expect(deniedResult.success).toBe(false);
      expect(deniedResult.error).toMatch(/Access denied.*outside/);
    });

    it('should normalize paths correctly', async () => {
      const result = await tool.execute({ filePath: './subdir/../test.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).not.toContain('./');
        expect(result.data.path).not.toContain('../');
      } else {
        expect(result.content).toBe('Hello World Test Content');
        expect(result.path).not.toContain('./');
        expect(result.path).not.toContain('../');
      }
    });
  });

  describe('Performance and Large Files', () => {
    it('should handle moderately large files efficiently', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB
      await fs.writeFile(path.join(testDir, 'large.txt'), largeContent);
      
      const startTime = Date.now();
      const result = await tool.execute({ filePath: 'large.txt' });
      const duration = Date.now() - startTime;
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content.length).toBe(largeContent.length);
      } else {
        expect(result.content.length).toBe(largeContent.length);
      }
      
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent file reads', async () => {
      const operations = [];
      const files = ['test.txt', 'test.json', 'unicode.txt', 'subdir/nested.txt'];
      
      for (const file of files) {
        operations.push(tool.execute({ filePath: file }));
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        if (result.success !== undefined) {
          expect(result.success).toBe(true);
        } else {
          expect(result.content).toBeDefined();
        }
      });
    });
  });

  describe('Encoding Support', () => {
    it('should respect custom encoding setting', async () => {
      const binaryContent = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      await fs.writeFile(path.join(testDir, 'binary.txt'), binaryContent);
      
      const asciiTool = new FileReaderTool({ basePath: testDir, encoding: 'ascii' });
      const result = await asciiTool.execute({ filePath: 'binary.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Hello');
      } else {
        expect(result.content).toBe('Hello');
      }
    });

    it('should handle UTF-8 encoding by default', async () => {
      const utf8Content = 'Hello 世界 🌍 æøå';
      await fs.writeFile(path.join(testDir, 'utf8.txt'), utf8Content, 'utf-8');
      
      const result = await tool.execute({ filePath: 'utf8.txt' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.content).toBe(utf8Content);
      } else {
        expect(result.content).toBe(utf8Content);
      }
    });
  });

  describe('Integration with File System', () => {
    it('should handle file system changes during operation', async () => {
      // Create file
      await fs.writeFile(path.join(testDir, 'temp-file.txt'), 'initial content');
      
      // Read file
      const result1 = await tool.execute({ filePath: 'temp-file.txt' });
      
      // Modify file
      await fs.writeFile(path.join(testDir, 'temp-file.txt'), 'modified content');
      
      // Read file again
      const result2 = await tool.execute({ filePath: 'temp-file.txt' });
      
      if (result1.success !== undefined) {
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        expect(result1.data.content).toBe('initial content');
        expect(result2.data.content).toBe('modified content');
      } else {
        expect(result1.content).toBe('initial content');
        expect(result2.content).toBe('modified content');
      }
    });

    it('should handle file deletion during operation window', async () => {
      // Create file
      await fs.writeFile(path.join(testDir, 'delete-me.txt'), 'will be deleted');
      
      // Delete file immediately
      await fs.unlink(path.join(testDir, 'delete-me.txt'));
      
      // Try to read deleted file
      const result = await tool.execute({ filePath: 'delete-me.txt' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});