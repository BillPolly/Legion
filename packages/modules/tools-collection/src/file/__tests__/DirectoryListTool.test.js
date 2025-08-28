/**
 * Unit Tests for DirectoryListTool
 * Using REAL file system operations - no mocks!
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('DirectoryListTool Tests', () => {
  let testDir;
  let DirectoryListTool;
  let tool;
  
  beforeAll(async () => {
    // We'll need to create this tool during refactoring
    try {
      const module = await import('../DirectoryListTool.js');
      DirectoryListTool = module.default;
    } catch (error) {
      // Tool doesn't exist yet - will be created during refactoring
      DirectoryListTool = null;
    }
    
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-directory-list-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    if (DirectoryListTool) {
      tool = new DirectoryListTool({ basePath: testDir });
    }
  });
  
  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('Tool Construction', () => {
    it('should create DirectoryListTool with proper schema', () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('directory_list');
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeDefined();
      expect(tool.schema.input).toBeDefined();
      expect(tool.schema.output).toBeDefined();
    });

    it('should require basePath parameter', () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      expect(() => new DirectoryListTool({})).toThrow();
    });
  });

  describe('Directory Listing', () => {
    beforeEach(async () => {
      // Clean up any existing test structure
      try {
        await fs.rm(path.join(testDir, 'list-test'), { recursive: true, force: true });
      } catch (e) {
        // Directory might not exist, that's ok
      }
      
      // Setup test directory structure
      await fs.mkdir(path.join(testDir, 'list-test'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'list-test', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'list-test', 'file2.json'), '{"key":"value"}');
      await fs.mkdir(path.join(testDir, 'list-test', 'subdir'));
      await fs.writeFile(path.join(testDir, 'list-test', 'subdir', 'nested.txt'), 'nested content');
    });

    it('should list directory contents successfully', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'list-test' });
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data.items.length).toBe(3);
      
      const names = result.data.items.map(item => item.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.json');
      expect(names).toContain('subdir');
    });

    it('should provide detailed file information', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'list-test' });
      
      expect(result.success).toBe(true);
      const file = result.data.items.find(item => item.name === 'file1.txt');
      expect(file.type).toBe('file');
      expect(file.size).toBeGreaterThan(0);
      expect(file.modified).toBeDefined();
      expect(file.path).toBeDefined();
      
      const dir = result.data.items.find(item => item.name === 'subdir');
      expect(dir.type).toBe('directory');
      expect(dir.size).toBeDefined();
    });

    it('should support filtering by extensions', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ 
        directoryPath: 'list-test',
        filter: '*.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].name).toBe('file1.txt');
    });

    it('should support recursive listing', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ 
        directoryPath: 'list-test',
        recursive: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeGreaterThan(3);
      
      const nestedFile = result.data.items.find(item => item.name === 'nested.txt');
      expect(nestedFile).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directories', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'nonexistent-dir' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Directory not found/);
    });

    it('should validate input parameters', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Directory path cannot be empty/);
    });

    it('should handle permission denied errors', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      // Try to access outside allowed basePath
      const result = await tool.execute({ directoryPath: '../../../etc' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });

    it('should handle null byte injection', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'test\0hidden' });
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid directory path/);
    });
  });

  describe('Security and Path Validation', () => {
    it('should respect basePath restrictions', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      const restrictedTool = new DirectoryListTool({ basePath: testDir });
      
      // Should work within basePath
      await fs.mkdir(path.join(testDir, 'allowed'));
      const allowedResult = await restrictedTool.execute({ directoryPath: 'allowed' });
      expect(allowedResult.success).toBe(true);
      expect(allowedResult.data.items).toBeDefined();
      
      // Should fail outside basePath
      const deniedResult = await restrictedTool.execute({ directoryPath: '../../../' });
      expect(deniedResult.success).toBe(false);
      expect(deniedResult.error).toMatch(/Access denied/);
    });

    it('should normalize paths correctly', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      await fs.mkdir(path.join(testDir, 'normalize-test'));
      
      const result = await tool.execute({ directoryPath: './normalize-test' });
      
      expect(result.success).toBe(true);
      expect(result.data.path).not.toContain('./');
    });
  });

  describe('Performance', () => {
    it('should handle large directories efficiently', async () => {
      if (!DirectoryListTool) {
        expect(DirectoryListTool).toBeDefined();
        return;
      }
      
      // Create directory with many files
      await fs.mkdir(path.join(testDir, 'large-dir'));
      
      const filePromises = [];
      for (let i = 0; i < 100; i++) {
        filePromises.push(
          fs.writeFile(path.join(testDir, 'large-dir', `file-${i}.txt`), `Content ${i}`)
        );
      }
      await Promise.all(filePromises);
      
      const startTime = Date.now();
      const result = await tool.execute({ directoryPath: 'large-dir' });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBe(100);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});