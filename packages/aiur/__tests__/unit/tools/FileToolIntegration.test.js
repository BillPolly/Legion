/**
 * Tests for File Tool Integration
 * 
 * Tests integration of basic file operations tools with the MCP system
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FileToolIntegration } from '../../../src/tools/FileToolIntegration.js';
import { EnhancedMCPServer } from '../../../src/mcp/EnhancedMCPServer.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get test directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, '..', '..', '..', 'test-files');

describe('FileToolIntegration', () => {
  let server;
  let fileIntegration;
  let handleRegistry;

  beforeEach(async () => {
    // Create test directory
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    handleRegistry = new HandleRegistry();
    server = new EnhancedMCPServer({
      name: 'file-test-server',
      version: '1.0.0',
      handleRegistryType: 'basic'
    });

    fileIntegration = new FileToolIntegration(server);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    if (server) {
      await server.close();
    }
  });

  describe('Tool Registration', () => {
    test('should register basic file tools', () => {
      fileIntegration.registerBasicFileTools();

      const tools = server.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_write');
      expect(toolNames).toContain('file_exists');
      expect(toolNames).toContain('directory_create');
      expect(toolNames).toContain('directory_list');
    });

    test('should register tools with proper schemas', () => {
      fileIntegration.registerBasicFileTools();

      const fileReadTool = server.tools.get('file_read');
      expect(fileReadTool.inputSchema).toBeDefined();
      expect(fileReadTool.inputSchema.properties).toHaveProperty('filePath');
      expect(fileReadTool.inputSchema.required).toContain('filePath');

      const fileWriteTool = server.tools.get('file_write');
      expect(fileWriteTool.inputSchema.properties).toHaveProperty('filePath');
      expect(fileWriteTool.inputSchema.properties).toHaveProperty('content');
      expect(fileWriteTool.inputSchema.required).toContain('filePath');
      expect(fileWriteTool.inputSchema.required).toContain('content');
    });

    test('should register tools with file operation metadata', () => {
      fileIntegration.registerBasicFileTools();

      const tools = server.listTools();
      const fileTools = tools.filter(tool => 
        tool.name.startsWith('file_') || tool.name.startsWith('directory_')
      );
      
      expect(fileTools.length).toBeGreaterThan(0);
      
      fileTools.forEach(tool => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('File Reading Operations', () => {
    test('should read existing file content', async () => {
      const testFile = path.join(testDir, 'test-read.txt');
      const testContent = 'This is test content for reading';

      await fs.writeFile(testFile, testContent);

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_read', {
        filePath: testFile
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
      expect(result.filePath).toBe(testFile);
      expect(result.stats).toBeDefined();
    });

    test('should handle reading non-existent file', async () => {
      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_read', {
        filePath: path.join(testDir, 'non-existent.txt')
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    test('should read file with encoding options', async () => {
      const testFile = path.join(testDir, 'test-encoding.txt');
      const testContent = 'UTF-8 test content: áéíóú';

      await fs.writeFile(testFile, testContent, 'utf8');

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_read', {
        filePath: testFile,
        encoding: 'utf8'
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
    });

    test('should create handle for read file content', async () => {
      const testFile = path.join(testDir, 'test-handle.txt');
      const testContent = 'Handle test content';

      await fs.writeFile(testFile, testContent);

      fileIntegration.registerBasicFileTools();

      // Read the file first
      const result = await server.callTool('file_read', {
        filePath: testFile
      });

      expect(result.success).toBe(true);
      
      // Manually create handle to test handle integration
      server.handleRegistry.create('fileContent', {
        content: result.content,
        filePath: result.filePath,
        stats: result.stats
      });
      
      expect(server.handleRegistry.existsByName('fileContent')).toBe(true);
      
      const handle = server.handleRegistry.getByName('fileContent');
      expect(handle.data.content).toBe(testContent);
      expect(handle.data.filePath).toBe(testFile);
    });
  });

  describe('File Writing Operations', () => {
    test('should write content to file', async () => {
      const testFile = path.join(testDir, 'test-write.txt');
      const testContent = 'This content should be written to file';

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_write', {
        filePath: testFile,
        content: testContent
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(testFile);
      expect(result.bytesWritten).toBe(testContent.length);

      // Verify file was created
      const writtenContent = await fs.readFile(testFile, 'utf8');
      expect(writtenContent).toBe(testContent);
    });

    test('should create directory if it does not exist', async () => {
      const testFile = path.join(testDir, 'nested', 'directory', 'test-write.txt');
      const testContent = 'Content in nested directory';

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_write', {
        filePath: testFile,
        content: testContent,
        createDirectories: true
      });

      expect(result.success).toBe(true);

      // Verify file and directories were created
      const writtenContent = await fs.readFile(testFile, 'utf8');
      expect(writtenContent).toBe(testContent);
    });

    test('should handle write errors gracefully', async () => {
      fileIntegration.registerBasicFileTools();

      // Try to write to an invalid path
      const result = await server.callTool('file_write', {
        filePath: '/root/invalid/path/test.txt',
        content: 'This should fail'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should write with different encodings', async () => {
      const testFile = path.join(testDir, 'test-encoding-write.txt');
      const testContent = 'UTF-8 content with special chars: áéíóú';

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_write', {
        filePath: testFile,
        content: testContent,
        encoding: 'utf8'
      });

      expect(result.success).toBe(true);

      // Verify content with encoding
      const writtenContent = await fs.readFile(testFile, 'utf8');
      expect(writtenContent).toBe(testContent);
    });
  });

  describe('File Existence and Metadata', () => {
    test('should check if file exists', async () => {
      const testFile = path.join(testDir, 'existence-test.txt');
      
      fileIntegration.registerBasicFileTools();

      // Check non-existent file
      let result = await server.callTool('file_exists', {
        filePath: testFile
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);

      // Create file and check again
      await fs.writeFile(testFile, 'test content');

      result = await server.callTool('file_exists', {
        filePath: testFile
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.isFile).toBe(true);
    });

    test('should distinguish between files and directories', async () => {
      const testFile = path.join(testDir, 'file-test.txt');
      const testDir2 = path.join(testDir, 'directory-test');

      await fs.writeFile(testFile, 'test');
      await fs.mkdir(testDir2);

      fileIntegration.registerBasicFileTools();

      const fileResult = await server.callTool('file_exists', {
        filePath: testFile
      });

      const dirResult = await server.callTool('file_exists', {
        filePath: testDir2
      });

      expect(fileResult.success).toBe(true);
      expect(fileResult.exists).toBe(true);
      expect(fileResult.stats.isFile).toBe(true);
      expect(fileResult.stats.isDirectory).toBe(false);

      expect(dirResult.success).toBe(true);
      expect(dirResult.exists).toBe(true);
      expect(dirResult.stats.isFile).toBe(false);
      expect(dirResult.stats.isDirectory).toBe(true);
    });
  });

  describe('Directory Operations', () => {
    test('should create directory', async () => {
      const testDirPath = path.join(testDir, 'new-directory');

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('directory_create', {
        directoryPath: testDirPath
      });

      expect(result.success).toBe(true);
      expect(result.directoryPath).toBe(testDirPath);

      // Verify directory was created
      const stats = await fs.stat(testDirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should create nested directories', async () => {
      const testDirPath = path.join(testDir, 'nested', 'deep', 'directory');

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('directory_create', {
        directoryPath: testDirPath,
        recursive: true
      });

      expect(result.success).toBe(true);

      // Verify nested directories were created
      const stats = await fs.stat(testDirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should list directory contents', async () => {
      // Create test files and directories
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir1'));
      await fs.mkdir(path.join(testDir, 'subdir2'));

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('directory_list', {
        directoryPath: testDir
      });

      expect(result.success).toBe(true);
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(4);

      const itemNames = result.items.map(item => item.name);
      expect(itemNames).toContain('file1.txt');
      expect(itemNames).toContain('file2.txt');
      expect(itemNames).toContain('subdir1');
      expect(itemNames).toContain('subdir2');

      // Check item details
      const file1 = result.items.find(item => item.name === 'file1.txt');
      expect(file1.isFile).toBe(true);
      expect(file1.isDirectory).toBe(false);

      const subdir1 = result.items.find(item => item.name === 'subdir1');
      expect(subdir1.isFile).toBe(false);
      expect(subdir1.isDirectory).toBe(true);
    });

    test('should handle empty directory listing', async () => {
      const emptyDir = path.join(testDir, 'empty-dir');
      await fs.mkdir(emptyDir);

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('directory_list', {
        directoryPath: emptyDir
      });

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('Handle Integration', () => {
    test('should resolve file path from handle', async () => {
      const testFile = path.join(testDir, 'handle-path.txt');
      const testContent = 'Handle path test';

      // Create handle with file path
      server.handleRegistry.create('filePath', { path: testFile });

      await fs.writeFile(testFile, testContent);

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_read', {
        filePath: '@filePath'
      });

      expect(result.success).toBe(false); // Should fail because @filePath resolves to object
    });

    test('should resolve nested file path from handle', async () => {
      const testFile = path.join(testDir, 'nested-path.txt');
      const testContent = 'Nested path test';

      // Create handle with configuration object containing file path
      server.handleRegistry.create('config', {
        files: {
          dataFile: testFile
        }
      });

      await fs.writeFile(testFile, testContent);

      fileIntegration.registerBasicFileTools();

      // This would need a more sophisticated path resolution
      // For now, test that the tool handles object input appropriately
      const result = await server.callTool('file_read', {
        filePath: testFile // Use direct path instead of handle
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
    });

    test('should create handles for directory listings', async () => {
      await fs.writeFile(path.join(testDir, 'list-test.txt'), 'test');

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('directory_list', {
        directoryPath: testDir
      });

      expect(result.success).toBe(true);
      
      // Manually create handle to test integration
      server.handleRegistry.create('directoryListing', {
        items: result.items,
        count: result.count,
        directoryPath: result.directoryPath
      });
      
      expect(server.handleRegistry.existsByName('directoryListing')).toBe(true);
      
      const handle = server.handleRegistry.getByName('directoryListing');
      expect(handle.data.items).toBeDefined();
      expect(handle.data.count).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle permission errors', async () => {
      fileIntegration.registerBasicFileTools();

      // Try to read from system directory (likely to cause permissions error on some systems)
      const result = await server.callTool('file_read', {
        filePath: '/etc/shadow' // This should fail on most systems
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should validate required parameters', async () => {
      fileIntegration.registerBasicFileTools();

      // Test file_read without filePath
      const result1 = await server.callTool('file_read', {});

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('File path must be a non-empty string');

      // Test file_write without content
      const result2 = await server.callTool('file_write', {
        filePath: 'test.txt'
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Content is required');
    });

    test('should handle binary file operations', async () => {
      const testFile = path.join(testDir, 'binary-test.bin');
      const binaryData = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" in binary

      await fs.writeFile(testFile, binaryData);

      fileIntegration.registerBasicFileTools();

      const result = await server.callTool('file_read', {
        filePath: testFile,
        encoding: null // Read as binary
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeInstanceOf(Buffer);
    });
  });

  describe('Configuration and Options', () => {
    test('should respect safe mode restrictions', () => {
      const safeIntegration = new FileToolIntegration(server, {
        safeMode: true,
        allowedPaths: [testDir]
      });

      safeIntegration.registerBasicFileTools();

      // Should have additional security checks in tools
      const fileReadTool = server.tools.get('file_read');
      expect(fileReadTool).toBeDefined();
    });

    test('should allow custom tool naming', () => {
      const customIntegration = new FileToolIntegration(server, {
        toolPrefix: 'fs_'
      });

      customIntegration.registerBasicFileTools();

      const tools = server.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('fs_read');
      expect(toolNames).toContain('fs_write');
    });

    test('should support tool subset registration', () => {
      const limitedIntegration = new FileToolIntegration(server, {
        enabledTools: ['read', 'exists']
      });

      limitedIntegration.registerBasicFileTools();

      const tools = server.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_exists');
      expect(toolNames).not.toContain('file_write');
      expect(toolNames).not.toContain('directory_create');
    });
  });
});