/**
 * Comprehensive Integration Tests for FileModule
 * Testing ALL 6 file operations with REAL components - no mocks!
 * Following TDD principles and Clean Architecture
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import FileModule from '../FileModule.js';
import FileReaderTool from '../FileReaderTool.js';
import FileWriterTool from '../FileWriterTool.js';
import DirectoryCreatorTool from '../DirectoryCreatorTool.js';

describe('FileModule Integration Tests', () => {
  let testDir;
  let fileModule;
  let fileReaderTool;
  let fileWriterTool;
  let directoryCreatorTool;
  
  beforeAll(async () => {
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-file-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize module and individual tools for comparison
    fileModule = new FileModule({ basePath: testDir });
    
    fileReaderTool = new FileReaderTool({ basePath: testDir });
    fileWriterTool = new FileWriterTool({ basePath: testDir, createDirectories: true });
    directoryCreatorTool = new DirectoryCreatorTool({ basePath: testDir });
  });
  
  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('FileModule Tool Registration', () => {
    it('should register all 6 expected file operation tools', () => {
      const tools = fileModule.getAllToolDescriptions();
      expect(tools).toHaveLength(6);
      
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_write');
      expect(toolNames).toContain('directory_create');
      expect(toolNames).toContain('directory_list');
      expect(toolNames).toContain('directory_change');
      expect(toolNames).toContain('directory_current');
    });

    it('should have proper tool descriptions with required properties', () => {
      const tools = fileModule.getAllToolDescriptions();
      
      tools.forEach(tool => {
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toMatch(/^(file_read|file_write|directory_create|directory_list|directory_change|directory_current)$/);
        expect(tool.function.description).toBeDefined();
        expect(typeof tool.function.description).toBe('string');
        expect(tool.function.parameters).toBeDefined();
        expect(typeof tool.function.parameters).toBe('object');
      });
    });
  });

  describe('File Read Operations', () => {
    beforeEach(async () => {
      // Setup test files
      const testContent = 'Hello World Test Content';
      await fs.writeFile(path.join(testDir, 'test.txt'), testContent);
      await fs.writeFile(path.join(testDir, 'test.json'), JSON.stringify({ key: 'value' }, null, 2));
    });

    it('should read text files successfully', async () => {
      const result = await fileModule.invoke('file_read', { filePath: 'test.txt' });
      
      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Hello World Test Content');
      expect(result.data.path).toContain('test.txt');
    });

    it('should read JSON files successfully', async () => {
      const result = await fileModule.invoke('file_read', { filePath: 'test.json' });
      
      expect(result.success).toBe(true);
      expect(result.data.content).toContain('key');
      expect(result.data.content).toContain('value');
    });

    it('should handle non-existent files gracefully', async () => {
      const result = await fileModule.invoke('file_read', { filePath: 'nonexistent.txt' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data.errorType).toBe('file_not_found');
    });

    it('should validate file path input', async () => {
      const result = await fileModule.invoke('file_read', { filePath: '' });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('invalid_path');
    });

    it('should match individual FileReaderTool behavior', async () => {
      const moduleResult = await fileModule.invoke('file_read', { filePath: 'test.txt' });
      const toolResult = await fileReaderTool.execute({ filePath: 'test.txt' });
      
      expect(moduleResult.success).toBe(toolResult.success);
      if (moduleResult.success) {
        expect(moduleResult.data.content).toBe(toolResult.data.content);
        expect(moduleResult.data.path).toBe(toolResult.data.path);
      }
    });
  });

  describe('File Write Operations', () => {
    it('should write text files successfully', async () => {
      const testContent = 'New file content';
      const result = await fileModule.invoke('file_write', { 
        filePath: 'new-file.txt', 
        content: testContent 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.path).toContain('new-file.txt');
      expect(result.data.bytesWritten).toBe(testContent.length);
      
      // Verify file was actually written
      const written = await fs.readFile(path.join(testDir, 'new-file.txt'), 'utf-8');
      expect(written).toBe(testContent);
    });

    it('should write JSON objects successfully', async () => {
      const testObj = { name: 'test', value: 42 };
      const result = await fileModule.invoke('file_write', { 
        filePath: 'new-file.json', 
        content: testObj 
      });
      
      expect(result.success).toBe(true);
      
      // Verify JSON was properly formatted
      const written = await fs.readFile(path.join(testDir, 'new-file.json'), 'utf-8');
      const parsed = JSON.parse(written);
      expect(parsed).toEqual(testObj);
    });

    it('should support append mode', async () => {
      // Write initial content
      await fileModule.invoke('file_write', { 
        filePath: 'append-test.txt', 
        content: 'Line 1\n' 
      });
      
      // Append additional content
      const result = await fileModule.invoke('file_write', { 
        filePath: 'append-test.txt', 
        content: 'Line 2\n',
        append: true 
      });
      
      expect(result.success).toBe(true);
      
      // Verify both lines are present
      const content = await fs.readFile(path.join(testDir, 'append-test.txt'), 'utf-8');
      expect(content).toBe('Line 1\nLine 2\n');
    });

    it('should handle invalid file paths', async () => {
      const result = await fileModule.invoke('file_write', { 
        filePath: '', 
        content: 'test' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('invalid_path');
    });

    it('should match individual FileWriterTool behavior', async () => {
      const testContent = 'Tool comparison test';
      
      const moduleResult = await fileModule.invoke('file_write', { 
        filePath: 'compare-write.txt', 
        content: testContent 
      });
      
      const toolResult = await fileWriterTool.execute({ 
        filePath: 'compare-write-tool.txt', 
        content: testContent 
      });
      
      expect(moduleResult.success).toBe(toolResult.success);
      if (moduleResult.success && toolResult.success) {
        expect(moduleResult.data.bytesWritten).toBe(toolResult.data.bytesWritten);
      }
    });
  });

  describe('Directory Create Operations', () => {
    it('should create directories successfully', async () => {
      const result = await fileModule.invoke('directory_create', { 
        directoryPath: 'new-dir' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      expect(result.data.path).toContain('new-dir');
      
      // Verify directory was actually created
      const stats = await fs.stat(path.join(testDir, 'new-dir'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const result = await fileModule.invoke('directory_create', { 
        directoryPath: 'nested/deep/structure',
        recursive: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(true);
      
      // Verify entire structure was created
      const stats = await fs.stat(path.join(testDir, 'nested/deep/structure'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      // Create directory first
      await fs.mkdir(path.join(testDir, 'existing-dir'));
      
      const result = await fileModule.invoke('directory_create', { 
        directoryPath: 'existing-dir' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.created).toBe(false);
    });

    it('should validate directory path input', async () => {
      const result = await fileModule.invoke('directory_create', { 
        directoryPath: '' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('invalid_path');
    });

    it('should match individual DirectoryCreatorTool behavior', async () => {
      const moduleResult = await fileModule.invoke('directory_create', { 
        directoryPath: 'compare-dir' 
      });
      
      const toolResult = await directoryCreatorTool.execute({ 
        directoryPath: 'compare-dir-tool' 
      });
      
      expect(moduleResult.success).toBe(toolResult.success);
      if (moduleResult.success && toolResult.success) {
        expect(moduleResult.data.created).toBe(toolResult.data.created);
      }
    });
  });

  describe('Directory List Operations', () => {
    beforeEach(async () => {
      // Setup test directory structure
      await fs.mkdir(path.join(testDir, 'list-test'));
      await fs.writeFile(path.join(testDir, 'list-test', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'list-test', 'file2.json'), '{"key":"value"}');
      await fs.mkdir(path.join(testDir, 'list-test', 'subdir'));
    });

    it('should list directory contents successfully', async () => {
      const result = await fileModule.invoke('directory_list', { 
        directoryPath: 'list-test' 
      });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data.items.length).toBe(3);
      
      const names = result.data.items.map(item => item.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.json');
      expect(names).toContain('subdir');
    });

    it('should include item details (type, size, etc)', async () => {
      const result = await fileModule.invoke('directory_list', { 
        directoryPath: 'list-test' 
      });
      
      expect(result.success).toBe(true);
      
      const file = result.data.items.find(item => item.name === 'file1.txt');
      expect(file.type).toBe('file');
      expect(file.size).toBeGreaterThan(0);
      expect(file.modified).toBeDefined();
      
      const dir = result.data.items.find(item => item.name === 'subdir');
      expect(dir.type).toBe('directory');
    });

    it('should handle non-existent directories', async () => {
      const result = await fileModule.invoke('directory_list', { 
        directoryPath: 'nonexistent-dir' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('directory_not_found');
    });

    it('should support filtering by file extensions', async () => {
      const result = await fileModule.invoke('directory_list', { 
        directoryPath: 'list-test',
        filter: '*.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].name).toBe('file1.txt');
    });
  });

  describe('Directory Change Operations', () => {
    beforeEach(async () => {
      // Setup test directories
      await fs.mkdir(path.join(testDir, 'change-test'));
      await fs.mkdir(path.join(testDir, 'change-test', 'subdir'));
    });

    it('should change current working directory', async () => {
      const result = await fileModule.invoke('directory_change', { 
        directoryPath: 'change-test' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.previousPath).toBeDefined();
      expect(result.data.currentPath).toContain('change-test');
    });

    it('should handle relative path changes', async () => {
      // First change to a subdirectory
      await fileModule.invoke('directory_change', { 
        directoryPath: 'change-test' 
      });
      
      const result = await fileModule.invoke('directory_change', { 
        directoryPath: 'subdir' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toContain('subdir');
    });

    it('should handle absolute path changes', async () => {
      const absolutePath = path.join(testDir, 'change-test');
      const result = await fileModule.invoke('directory_change', { 
        directoryPath: absolutePath 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toBe(absolutePath);
    });

    it('should handle non-existent directories', async () => {
      const result = await fileModule.invoke('directory_change', { 
        directoryPath: 'nonexistent-change-dir' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('directory_not_found');
    });

    it('should support going back to parent directory', async () => {
      // Change to subdirectory first
      await fileModule.invoke('directory_change', { 
        directoryPath: 'change-test/subdir' 
      });
      
      // Go back to parent
      const result = await fileModule.invoke('directory_change', { 
        directoryPath: '..' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toContain('change-test');
      expect(result.data.currentPath).not.toContain('subdir');
    });
  });

  describe('Directory Current Operations', () => {
    it('should return current working directory', async () => {
      const result = await fileModule.invoke('directory_current', {});
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toBeDefined();
      expect(typeof result.data.currentPath).toBe('string');
      expect(path.isAbsolute(result.data.currentPath)).toBe(true);
    });

    it('should return path relative to base path when requested', async () => {
      const result = await fileModule.invoke('directory_current', { 
        relative: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toBeDefined();
      expect(result.data.basePath).toBe(testDir);
      expect(result.data.relativePath).toBeDefined();
    });

    it('should track directory changes', async () => {
      // Get initial directory
      const initial = await fileModule.invoke('directory_current', {});
      
      // Change directory
      await fs.mkdir(path.join(testDir, 'track-test'));
      await fileModule.invoke('directory_change', { 
        directoryPath: 'track-test' 
      });
      
      // Check new directory
      const changed = await fileModule.invoke('directory_current', {});
      
      expect(initial.data.currentPath).not.toBe(changed.data.currentPath);
      expect(changed.data.currentPath).toContain('track-test');
    });
  });

  describe('Integration and Error Handling', () => {
    it('should handle security restrictions (path traversal)', async () => {
      const result = await fileModule.invoke('file_read', { 
        filePath: '../../../etc/passwd' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('access_denied');
    });

    it('should handle null byte injection attacks', async () => {
      const result = await fileModule.invoke('file_read', { 
        filePath: 'test.txt\0hidden.txt' 
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('invalid_path');
    });

    it('should support complex file operations workflow', async () => {
      // Create directory structure
      const dirResult = await fileModule.invoke('directory_create', { 
        directoryPath: 'workflow-test/nested' 
      });
      expect(dirResult.success).toBe(true);
      
      // Write configuration file
      const config = { app: 'legion', version: '1.0' };
      const writeResult = await fileModule.invoke('file_write', { 
        filePath: 'workflow-test/config.json', 
        content: config 
      });
      expect(writeResult.success).toBe(true);
      
      // Read back and verify
      const readResult = await fileModule.invoke('file_read', { 
        filePath: 'workflow-test/config.json' 
      });
      expect(readResult.success).toBe(true);
      const parsed = JSON.parse(readResult.data.content);
      expect(parsed).toEqual(config);
      
      // List directory contents
      const listResult = await fileModule.invoke('directory_list', { 
        directoryPath: 'workflow-test' 
      });
      expect(listResult.success).toBe(true);
      expect(listResult.data.items.length).toBe(2);
    });

    it('should handle concurrent file operations', async () => {
      const operations = [];
      
      // Start multiple file operations concurrently
      for (let i = 0; i < 5; i++) {
        operations.push(
          fileModule.invoke('file_write', {
            filePath: `concurrent-${i}.txt`,
            content: `Content for file ${i}`
          })
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.path).toContain(`concurrent-${index}.txt`);
      });
    });

    it('should maintain consistent error format across all operations', async () => {
      const operations = [
        () => fileModule.invoke('file_read', { filePath: '' }),
        () => fileModule.invoke('file_write', { filePath: '', content: 'test' }),
        () => fileModule.invoke('directory_create', { directoryPath: '' }),
        () => fileModule.invoke('directory_list', { directoryPath: 'nonexistent' }),
        () => fileModule.invoke('directory_change', { directoryPath: 'nonexistent' })
      ];
      
      for (const op of operations) {
        const result = await op();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.data.errorType).toBeDefined();
        expect(typeof result.data.errorType).toBe('string');
      }
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large file operations efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of data
      
      const startTime = Date.now();
      const writeResult = await fileModule.invoke('file_write', {
        filePath: 'large-file.txt',
        content: largeContent
      });
      const writeTime = Date.now() - startTime;
      
      expect(writeResult.success).toBe(true);
      expect(writeTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const readStart = Date.now();
      const readResult = await fileModule.invoke('file_read', {
        filePath: 'large-file.txt'
      });
      const readTime = Date.now() - readStart;
      
      expect(readResult.success).toBe(true);
      expect(readResult.data.content.length).toBe(largeContent.length);
      expect(readTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle directories with many files', async () => {
      // Create directory with many files
      await fs.mkdir(path.join(testDir, 'many-files'));
      
      const filePromises = [];
      for (let i = 0; i < 100; i++) {
        filePromises.push(
          fs.writeFile(path.join(testDir, 'many-files', `file-${i}.txt`), `Content ${i}`)
        );
      }
      await Promise.all(filePromises);
      
      const startTime = Date.now();
      const result = await fileModule.invoke('directory_list', {
        directoryPath: 'many-files'
      });
      const listTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBe(100);
      expect(listTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});