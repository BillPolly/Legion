/**
 * Unit Tests for DirectoryCurrentTool
 * Using REAL file system operations - no mocks!
 */

// Test functions provided by test runner as globals
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('DirectoryCurrentTool Tests', () => {
  let testDir;
  let originalCwd;
  let DirectoryCurrentTool;
  let tool;
  
  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // We'll need to create this tool during refactoring
    try {
      const module = await import('../DirectoryCurrentTool.js');
      DirectoryCurrentTool = module.default;
    } catch (error) {
      // Tool doesn't exist yet - will be created during refactoring
      DirectoryCurrentTool = null;
    }
    
    // Create isolated test directory
    testDir = path.join(os.tmpdir(), 'legion-directory-current-tests', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    // Resolve symlinks to handle /private prefix on macOS
    testDir = await fs.realpath(testDir);
    
    if (DirectoryCurrentTool) {
      tool = new DirectoryCurrentTool({ basePath: testDir });
    }
  });
  
  afterAll(async () => {
    // Restore original working directory safely
    try {
      process.chdir(originalCwd);
    } catch (error) {
      // If original working directory doesn't exist or can't be accessed,
      // change to a safe directory instead
      process.chdir(os.homedir());
    }
    
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error.message);
    }
  });

  describe('Tool Construction', () => {
    it('should create DirectoryCurrentTool with proper schema', () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('directory_current');
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
    });

    it('should require basePath parameter', () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      expect(() => new DirectoryCurrentTool({})).toThrow();
    });
  });

  describe('Current Directory Operations', () => {
    beforeEach(async () => {
      // Clean up any existing test structure
      const currentTestDir = path.join(testDir, 'current-test');
      try {
        await fs.rm(currentTestDir, { recursive: true, force: true });
      } catch (e) {
        // Directory might not exist, that's ok
      }
      
      // Setup test directory structure
      await fs.mkdir(path.join(testDir, 'current-test'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'current-test', 'subdir'));
      
      // Reset to testDir
      process.chdir(testDir);
    });

    it('should return current working directory', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toBeDefined();
      expect(typeof result.data.currentPath).toBe('string');
      expect(path.isAbsolute(result.data.currentPath)).toBe(true);
      expect(result.data.currentPath).toBe(process.cwd());
    });

    it('should return relative path when requested', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Change to subdirectory first
      process.chdir(path.join(testDir, 'current-test'));
      
      const result = await tool.execute({ relative: true });
      
      expect(result.success).toBe(true);
      expect(result.data.basePath).toBe(testDir);
      expect(result.data.relativePath).toBeDefined();
      expect(result.data.relativePath).toBe('current-test');
      expect(result.data.currentPath).toBe(path.join(testDir, 'current-test'));
    });

    it('should handle root directory case', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // At base directory
      process.chdir(testDir);
      
      const result = await tool.execute({ relative: true });
      
      expect(result.success).toBe(true);
      expect(result.data.relativePath).toBe('.');
      expect(result.data.currentPath).toBe(testDir);
    });

    it('should provide directory metadata', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ includeMetadata: true });
      
      expect(result.success).toBe(true);
      expect(result.data.metadata).toBeDefined();
      expect(result.data.metadata.exists).toBe(true);
      expect(result.data.metadata.readable).toBe(true);
      expect(result.data.metadata.writable).toBeDefined();
      expect(result.data.metadata.size).toBeDefined();
      expect(result.data.metadata.created).toBeDefined();
      expect(result.data.metadata.modified).toBeDefined();
    });

    it('should track directory changes', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Get initial directory
      const initial = await tool.execute({});
      expect(initial.success).toBe(true);
      expect(initial.data.currentPath).toBe(await fs.realpath(testDir));
      
      // Change directory
      process.chdir(path.join(testDir, 'current-test'));
      
      // Check new directory
      const changed = await tool.execute({});
      expect(changed.success).toBe(true);
      expect(changed.data.currentPath).toBe(await fs.realpath(path.join(testDir, 'current-test')));
      expect(changed.data.currentPath).not.toBe(initial.data.currentPath);
    });

    it('should format output consistently', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ format: 'unix' });
      
      expect(result.success).toBe(true);
      expect(result.data.currentPath).toBeDefined();
      
      // Should use forward slashes for Unix format
      if (os.platform() === 'win32') {
        expect(result.data.formattedPath).not.toContain('\\');
        expect(result.data.formattedPath).toContain('/');
      }
    });
  });

  describe('Path Analysis', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, 'analysis-test'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'analysis-test', 'deep', 'nested'), { recursive: true });
      process.chdir(testDir);
    });

    it('should analyze path components', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      process.chdir(path.join(testDir, 'analysis-test', 'deep'));
      
      const result = await tool.execute({ analyzeComponents: true });
      
      expect(result.success).toBe(true);
      expect(result.data.components).toBeDefined();
      expect(Array.isArray(result.data.components)).toBe(true);
      expect(result.data.components.length).toBeGreaterThan(0);
      
      const lastComponent = result.data.components[result.data.components.length - 1];
      expect(lastComponent).toBe('deep');
    });

    it('should calculate depth from base path', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      process.chdir(path.join(testDir, 'analysis-test', 'deep', 'nested'));
      
      const result = await tool.execute({ calculateDepth: true });
      
      expect(result.success).toBe(true);
      expect(result.data.depth).toBeDefined();
      expect(typeof result.data.depth).toBe('number');
      expect(result.data.depth).toBe(3); // analysis-test/deep/nested = 3 levels
    });

    it('should identify directory type and purpose', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Create some files that indicate directory purpose
      await fs.writeFile(path.join(testDir, 'package.json'), '{"name": "test"}');
      await fs.mkdir(path.join(testDir, 'src'));
      await fs.mkdir(path.join(testDir, 'node_modules'));
      
      const result = await tool.execute({ detectType: true });
      
      expect(result.success).toBe(true);
      expect(result.data.directoryType).toBeDefined();
      expect(result.data.indicators).toBeDefined();
      expect(Array.isArray(result.data.indicators)).toBe(true);
    });
  });

  describe('Security and Validation', () => {
    it('should respect basePath restrictions for relative paths', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const restrictedTool = new DirectoryCurrentTool({ basePath: testDir });
      
      // Should work within basePath
      process.chdir(testDir);
      const result = await restrictedTool.execute({ relative: true });
      expect(result.success).toBe(true);
      expect(result.data.relativePath).toBe('.');
    });

    it('should handle directory access permissions', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const result = await tool.execute({ checkPermissions: true });
      
      expect(result.success).toBe(true);
      expect(result.data.permissions).toBeDefined();
      expect(result.data.permissions.read).toBeDefined();
      expect(result.data.permissions.write).toBeDefined();
      expect(result.data.permissions.execute).toBeDefined();
    });

    it('should validate current directory exists', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Change to a directory that we'll then delete
      const tempDir = path.join(testDir, 'temp-delete');
      await fs.mkdir(tempDir);
      process.chdir(tempDir);
      
      // Delete the directory we're in (simulating external deletion)
      process.chdir(testDir);
      await fs.rmdir(tempDir);
      
      // Try to get current directory status
      const result = await tool.execute({ validateExists: true });
      
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true); // Should be true since we're back in testDir
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very deep directory structures', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Create deep directory structure
      let deepPath = testDir;
      for (let i = 0; i < 10; i++) {
        deepPath = path.join(deepPath, `level${i}`);
        await fs.mkdir(deepPath, { recursive: true });
      }
      
      process.chdir(deepPath);
      
      const startTime = Date.now();
      const result = await tool.execute({ 
        relative: true, 
        analyzeComponents: true,
        calculateDepth: true 
      });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data.depth).toBe(10);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent directory queries', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(tool.execute({ includeMetadata: true }));
      }
      
      const results = await Promise.all(operations);
      
      // All operations should succeed and return consistent results
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.currentPath).toBe(results[0].data.currentPath);
      });
    });

    it('should handle special characters in directory names', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      // Create directory with special characters (within filesystem limitations)
      const specialDir = path.join(testDir, 'special dir-with_chars');
      await fs.mkdir(specialDir, { recursive: true });
      process.chdir(specialDir);
      
      const result = await tool.execute({ relative: true });
      
      expect(result.success).toBe(true);
      expect(result.data.relativePath).toBe('special dir-with_chars');
    });

    it('should provide consistent results across multiple calls', async () => {
      if (!DirectoryCurrentTool) {
        expect(DirectoryCurrentTool).toBeDefined();
        return;
      }
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(await tool.execute({}));
      }
      
      // All results should be identical
      results.forEach(result => {
        expect(result.currentPath).toBe(results[0].currentPath);
      });
    });
  });
});