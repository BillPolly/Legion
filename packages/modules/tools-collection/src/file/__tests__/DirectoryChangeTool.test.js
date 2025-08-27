/**
 * Unit Tests for DirectoryChangeTool
 * Using REAL file system operations - no mocks!
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('DirectoryChangeTool Tests', () => {
  let testDir;
  let originalCwd;
  let DirectoryChangeTool;
  let tool;
  
  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // We'll need to create this tool during refactoring
    try {
      const module = await import('../DirectoryChangeTool.js');
      DirectoryChangeTool = module.default;
    } catch (error) {
      // Tool doesn't exist yet - will be created during refactoring
      DirectoryChangeTool = null;
    }
    
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-directory-change-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    if (DirectoryChangeTool) {
      tool = new DirectoryChangeTool({ basePath: testDir });
    }
  });
  
  afterAll(async () => {
    // Restore original working directory
    process.chdir(originalCwd);
    
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('Tool Construction', () => {
    it('should create DirectoryChangeTool with proper schema', () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('directory_change');
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeDefined();
      expect(tool.schema.input).toBeDefined();
      expect(tool.schema.output).toBeDefined();
    });

    it('should require basePath parameter', () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      expect(() => new DirectoryChangeTool({})).toThrow();
    });
  });

  describe('Directory Change Operations', () => {
    beforeEach(async () => {
      // Setup test directory structure
      await fs.mkdir(path.join(testDir, 'change-test'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'change-test', 'subdir'));
      await fs.mkdir(path.join(testDir, 'change-test', 'subdir', 'deep'));
      await fs.mkdir(path.join(testDir, 'other-dir'));
      
      // Reset to testDir
      process.chdir(testDir);
    });

    it('should change to a subdirectory successfully', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'change-test' });
      
      expect(result.success).toBe(true);
      expect(result.previousPath).toBe(testDir);
      expect(result.currentPath).toBe(path.join(testDir, 'change-test'));
      expect(process.cwd()).toBe(path.join(testDir, 'change-test'));
    });

    it('should handle relative path changes', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // First change to a directory
      await tool.execute({ directoryPath: 'change-test' });
      
      // Then change to a subdirectory using relative path
      const result = await tool.execute({ directoryPath: 'subdir' });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).toBe(path.join(testDir, 'change-test', 'subdir'));
    });

    it('should handle absolute path changes', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const absolutePath = path.join(testDir, 'change-test');
      const result = await tool.execute({ directoryPath: absolutePath });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).toBe(absolutePath);
    });

    it('should support parent directory navigation', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Change to subdirectory first
      await tool.execute({ directoryPath: 'change-test/subdir' });
      
      // Go back to parent
      const result = await tool.execute({ directoryPath: '..' });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).toBe(path.join(testDir, 'change-test'));
    });

    it('should support home directory shortcut', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Change away from testDir first
      await tool.execute({ directoryPath: 'change-test' });
      
      // Use ~ to go to base directory (simulated home)
      const result = await tool.execute({ directoryPath: '~' });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).toBe(testDir);
    });

    it('should provide path history', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Make several directory changes
      await tool.execute({ directoryPath: 'change-test' });
      await tool.execute({ directoryPath: 'subdir' });
      const result = await tool.execute({ directoryPath: '..' });
      
      expect(result.success).toBe(true);
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
      expect(result.history.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent directories', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'nonexistent-dir' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('directory_not_found');
    });

    it('should validate input parameters', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: '' });
      
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('invalid_path');
    });

    it('should handle permission denied errors', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Try to access outside allowed basePath
      const result = await tool.execute({ directoryPath: '../../../etc' });
      
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('access_denied');
    });

    it('should handle files instead of directories', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Create a file
      await fs.writeFile(path.join(testDir, 'not-a-dir.txt'), 'content');
      
      const result = await tool.execute({ directoryPath: 'not-a-dir.txt' });
      
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('not_a_directory');
    });

    it('should handle null byte injection', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: 'test\0hidden' });
      
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('invalid_path');
    });
  });

  describe('Security and Path Validation', () => {
    it('should respect basePath restrictions', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const restrictedTool = new DirectoryChangeTool({ basePath: testDir });
      
      // Should work within basePath
      const allowedResult = await restrictedTool.execute({ directoryPath: 'change-test' });
      expect(allowedResult.success).toBe(true);
      
      // Should fail outside basePath
      const deniedResult = await restrictedTool.execute({ directoryPath: '../../../' });
      expect(deniedResult.success).toBe(false);
      expect(deniedResult.errorType).toBe('access_denied');
    });

    it('should normalize paths correctly', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ directoryPath: './change-test/../change-test' });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).not.toContain('./');
      expect(result.currentPath).not.toContain('../');
      expect(result.currentPath).toBe(path.join(testDir, 'change-test'));
    });

    it('should track directory changes across tool instances', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Change directory with one tool instance
      await tool.execute({ directoryPath: 'change-test' });
      
      // Create new tool instance and verify it sees the change
      const newTool = new DirectoryChangeTool({ basePath: testDir });
      const result = await newTool.execute({ directoryPath: '.' });
      
      expect(result.success).toBe(true);
      expect(result.currentPath).toBe(path.join(testDir, 'change-test'));
    });
  });

  describe('State Management', () => {
    it('should maintain directory state between operations', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      // Make a series of directory changes
      const results = [];
      results.push(await tool.execute({ directoryPath: 'change-test' }));
      results.push(await tool.execute({ directoryPath: 'subdir' }));
      results.push(await tool.execute({ directoryPath: 'deep' }));
      results.push(await tool.execute({ directoryPath: '../..' }));
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Final location should be back at testDir/change-test
      expect(results[3].currentPath).toBe(path.join(testDir, 'change-test'));
    });

    it('should handle rapid directory changes', async () => {
      if (!DirectoryChangeTool) {
        expect(DirectoryChangeTool).toBeDefined();
        return;
      }
      
      const operations = [];
      const directories = ['change-test', 'other-dir', 'change-test/subdir', '..'];
      
      for (const dir of directories) {
        operations.push(tool.execute({ directoryPath: dir }));
      }
      
      const results = await Promise.all(operations);
      
      // All operations should complete (some may fail due to race conditions)
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});