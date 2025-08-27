/**
 * Unit Tests for DirectoryCreatorTool
 * Using REAL file system operations - no mocks!
 * Testing both current legacy version and future modern version
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import DirectoryCreatorTool from '../DirectoryCreatorTool.js';

describe('DirectoryCreatorTool Tests', () => {
  let testDir;
  let tool;
  
  beforeAll(async () => {
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-directory-creator-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    tool = new DirectoryCreatorTool({ basePath: testDir });
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
    it('should create DirectoryCreatorTool with proper schema', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('directory_creator');
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeDefined();
      expect(tool.schema.input).toBeDefined();
      expect(tool.schema.output).toBeDefined();
    });

    it('should require basePath parameter', () => {
      expect(() => new DirectoryCreatorTool({})).toThrow('basePath is required');
    });

    it('should use default permissions when not specified', () => {
      const defaultTool = new DirectoryCreatorTool({ basePath: testDir });
      expect(defaultTool.permissions).toBe(0o755);
    });

    it('should accept custom permissions', () => {
      const customTool = new DirectoryCreatorTool({ 
        basePath: testDir, 
        permissions: 0o750
      });
      expect(customTool.permissions).toBe(0o750);
    });
  });

  describe('Directory Creation Operations', () => {
    it('should create directories successfully', async () => {
      const result = await tool.execute({ directoryPath: 'new-directory' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.created).toBe(true);
        expect(result.data.path).toContain('new-directory');
      } else {
        expect(result.created).toBe(true);
        expect(result.path).toContain('new-directory');
      }
      
      // Verify directory was actually created
      const stats = await fs.stat(path.join(testDir, 'new-directory'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively by default', async () => {
      const result = await tool.execute({ 
        directoryPath: 'nested/deep/structure',
        recursive: true
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.created).toBe(true);
      } else {
        expect(result.created).toBe(true);
      }
      
      // Verify entire structure was created
      const stats = await fs.stat(path.join(testDir, 'nested/deep/structure'));
      expect(stats.isDirectory()).toBe(true);
      
      // Verify intermediate directories exist
      const nestedStats = await fs.stat(path.join(testDir, 'nested'));
      const deepStats = await fs.stat(path.join(testDir, 'nested/deep'));
      expect(nestedStats.isDirectory()).toBe(true);
      expect(deepStats.isDirectory()).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      // Create directory first
      await fs.mkdir(path.join(testDir, 'existing-dir'));
      
      const result = await tool.execute({ directoryPath: 'existing-dir' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.created).toBe(false);
        expect(result.data.path).toContain('existing-dir');
      } else {
        expect(result.created).toBe(false);
        expect(result.path).toContain('existing-dir');
      }
    });

    it('should support non-recursive mode', async () => {
      // First create parent directory
      await fs.mkdir(path.join(testDir, 'parent'));
      
      const result = await tool.execute({ 
        directoryPath: 'parent/child',
        recursive: false
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.created).toBe(true);
      } else {
        expect(result.created).toBe(true);
      }
      
      const stats = await fs.stat(path.join(testDir, 'parent/child'));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should fail non-recursive mode when parent does not exist', async () => {
      await expect(tool.execute({ 
        directoryPath: 'nonexistent-parent/child',
        recursive: false
      })).rejects.toThrow('Parent directory does not exist');
    });

    it('should handle relative paths correctly', async () => {
      const result = await tool.execute({ directoryPath: './relative-dir' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).not.toContain('./');
      } else {
        expect(result.path).not.toContain('./');
      }
      
      const stats = await fs.stat(path.join(testDir, 'relative-dir'));
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should validate directory path input', async () => {
      await expect(tool.execute({ directoryPath: '' }))
        .rejects.toThrow('Directory path cannot be empty');
    });

    it('should handle null directory path', async () => {
      await expect(tool.execute({ directoryPath: null }))
        .rejects.toThrow('Directory path must be a string');
    });

    it('should handle undefined directory path', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Directory path must be a string');
    });

    it('should handle file exists at target path', async () => {
      // Create a file where we want to create a directory
      await fs.writeFile(path.join(testDir, 'file-not-dir.txt'), 'content');
      
      await expect(tool.execute({ directoryPath: 'file-not-dir.txt' }))
        .rejects.toThrow();
    });

    it('should handle permission denied scenarios', async () => {
      // This test may not work on all systems due to permission handling
      if (os.platform() !== 'win32') { // Skip on Windows due to different permission model
        const restrictedTool = new DirectoryCreatorTool({ 
          basePath: '/root', // Typically not writable by regular users
          permissions: 0o755
        });
        
        // Expect this to throw due to permission denied
        await expect(restrictedTool.execute({ directoryPath: 'restricted-dir' }))
          .rejects.toThrow();
      } else {
        // On Windows, just verify the test structure is correct
        expect(tool).toBeDefined();
      }
    });
  });

  describe('Security and Path Validation', () => {
    it('should prevent path traversal attacks', async () => {
      await expect(tool.execute({ directoryPath: '../../../tmp/malicious' }))
        .rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should handle null byte injection', async () => {
      await expect(tool.execute({ directoryPath: 'test\0hidden' }))
        .rejects.toThrow('Invalid directory path');
    });

    it('should respect basePath restrictions', async () => {
      const restrictedTool = new DirectoryCreatorTool({ basePath: testDir });
      
      // Should work within basePath
      const allowedResult = await restrictedTool.execute({ directoryPath: 'allowed-dir' });
      
      if (allowedResult.success !== undefined) {
        expect(allowedResult.success).toBe(true);
      } else {
        expect(allowedResult.path).toContain('allowed-dir');
      }
      
      // Should fail outside basePath
      await expect(restrictedTool.execute({ directoryPath: '../outside-dir' }))
        .rejects.toThrow('Access denied: Path is outside allowed directory');
    });

    it('should normalize paths correctly', async () => {
      const result = await tool.execute({ directoryPath: './test/../normalize-dir' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).not.toContain('./');
        expect(result.data.path).not.toContain('../');
      } else {
        expect(result.path).not.toContain('./');
        expect(result.path).not.toContain('../');
      }
      
      const stats = await fs.stat(path.join(testDir, 'normalize-dir'));
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Permissions and Metadata', () => {
    it('should create directories with correct permissions', async () => {
      const customTool = new DirectoryCreatorTool({ 
        basePath: testDir, 
        permissions: 0o750 
      });
      
      const result = await customTool.execute({ directoryPath: 'custom-permissions' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('custom-permissions');
      }
      
      // Check permissions (on Unix-like systems)
      if (os.platform() !== 'win32') {
        const stats = await fs.stat(path.join(testDir, 'custom-permissions'));
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o750);
      }
    });

    it('should handle permission inheritance correctly', async () => {
      const result = await tool.execute({ 
        directoryPath: 'inherit-test/deep/nested',
        recursive: true
      });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('nested');
      }
      
      // Verify all levels were created
      const levels = ['inherit-test', 'inherit-test/deep', 'inherit-test/deep/nested'];
      for (const level of levels) {
        const stats = await fs.stat(path.join(testDir, level));
        expect(stats.isDirectory()).toBe(true);
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle deep directory structures efficiently', async () => {
      let deepPath = 'performance-test';
      for (let i = 0; i < 10; i++) {
        deepPath += `/level${i}`;
      }
      
      const startTime = Date.now();
      const result = await tool.execute({ 
        directoryPath: deepPath,
        recursive: true
      });
      const duration = Date.now() - startTime;
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('level9');
      }
      
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify deepest level was created
      const stats = await fs.stat(path.join(testDir, deepPath));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle concurrent directory creation', async () => {
      const operations = [];
      
      // Start multiple directory creation operations concurrently
      for (let i = 0; i < 5; i++) {
        operations.push(
          tool.execute({
            directoryPath: `concurrent-${i}`,
            recursive: true
          })
        );
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach((result, index) => {
        if (result.success !== undefined) {
          expect(result.success).toBe(true);
          expect(result.data.path).toContain(`concurrent-${index}`);
        } else {
          expect(result.path).toContain(`concurrent-${index}`);
        }
      });
      
      // Verify all directories were created
      for (let i = 0; i < 5; i++) {
        const stats = await fs.stat(path.join(testDir, `concurrent-${i}`));
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should handle special characters in directory names', async () => {
      // Create directory with special characters (within filesystem limitations)
      const specialName = 'special dir-with_chars (test)';
      const result = await tool.execute({ directoryPath: specialName });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.path).toContain(specialName);
      } else {
        expect(result.path).toContain(specialName);
      }
      
      const stats = await fs.stat(path.join(testDir, specialName));
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle very long directory names', async () => {
      // Create directory name at filesystem limit (typically 255 characters)
      const longName = 'a'.repeat(200); // Use 200 to stay well under limit
      const result = await tool.execute({ directoryPath: longName });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain(longName);
      }
      
      const stats = await fs.stat(path.join(testDir, longName));
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Integration with File System', () => {
    it('should interact correctly with existing file system', async () => {
      // Create some initial structure
      await fs.mkdir(path.join(testDir, 'existing'));
      await fs.writeFile(path.join(testDir, 'existing', 'file.txt'), 'content');
      
      // Create sibling directory
      const result = await tool.execute({ directoryPath: 'existing/sibling' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
      } else {
        expect(result.path).toContain('sibling');
      }
      
      // Verify both exist
      const existingStats = await fs.stat(path.join(testDir, 'existing'));
      const siblingStats = await fs.stat(path.join(testDir, 'existing', 'sibling'));
      const fileContent = await fs.readFile(path.join(testDir, 'existing', 'file.txt'), 'utf-8');
      
      expect(existingStats.isDirectory()).toBe(true);
      expect(siblingStats.isDirectory()).toBe(true);
      expect(fileContent).toBe('content');
    });

    it('should handle rapid create/check cycles', async () => {
      const dirName = 'rapid-cycle-test';
      
      // Create directory
      const createResult = await tool.execute({ directoryPath: dirName });
      
      // Immediately try to create again
      const recreateResult = await tool.execute({ directoryPath: dirName });
      
      if (createResult.success !== undefined) {
        expect(createResult.success).toBe(true);
        expect(createResult.data.created).toBe(true);
        
        expect(recreateResult.success).toBe(true);
        expect(recreateResult.data.created).toBe(false);
      } else {
        expect(createResult.created).toBe(true);
        expect(recreateResult.created).toBe(false);
      }
    });

    it('should preserve directory metadata on recreation attempts', async () => {
      // Create directory
      await tool.execute({ directoryPath: 'metadata-test' });
      
      // Get initial stats
      const initialStats = await fs.stat(path.join(testDir, 'metadata-test'));
      
      // Wait a moment to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Try to create again
      const result = await tool.execute({ directoryPath: 'metadata-test' });
      
      if (result.success !== undefined) {
        expect(result.success).toBe(true);
        expect(result.data.created).toBe(false);
      } else {
        expect(result.created).toBe(false);
      }
      
      // Verify stats haven't changed
      const finalStats = await fs.stat(path.join(testDir, 'metadata-test'));
      expect(finalStats.ctime).toEqual(initialStats.ctime);
      expect(finalStats.mtime).toEqual(initialStats.mtime);
    });
  });
});