/**
 * Integration tests for FileModule with Aiur MCP Server
 * 
 * Tests real FileModule loading and tool registration
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LegionModuleAdapter } from '../../src/tools/LegionModuleAdapter.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../src/handles/HandleRegistry.js';
import FileModule from '../../../general-tools/src/file/FileModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-files');

describe('FileModule Integration with Aiur', () => {
  let toolRegistry;
  let handleRegistry;
  let adapter;
  let testFilePath;

  beforeEach(async () => {
    // Setup registries and adapter
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    adapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
    
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    testFilePath = path.join(TEST_DIR, 'test.txt');
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Module Loading', () => {
    test('should load FileModule with required dependencies', async () => {
      await adapter.initialize();
      
      const result = await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      expect(result.moduleName).toBe('file');
      expect(result.toolsRegistered).toBe(1);
      expect(result.tools).toContain('file_operations');
    });

    test('should fail without required dependencies', async () => {
      await adapter.initialize();
      
      await expect(adapter.loadModule(FileModule)).rejects.toThrow();
    });
  });

  describe('Tool Registration', () => {
    test('should register file_operations as multi-function tool', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      const tool = toolRegistry.getTool('file_operations');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_operations');
      expect(tool.functions).toBeDefined();
      expect(Array.isArray(tool.functions)).toBe(true);
    });

    test('should expose all file operations as separate functions', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      const tool = toolRegistry.getTool('file_operations');
      const functionNames = tool.functions.map(f => f.name);
      
      expect(functionNames).toContain('file_read');
      expect(functionNames).toContain('file_write');
      expect(functionNames).toContain('directory_create');
      expect(functionNames).toContain('directory_list');
      expect(functionNames).toContain('directory_current');
      expect(functionNames).toContain('directory_change');
    });

    test('should have proper MCP schema for each function', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      const tool = toolRegistry.getTool('file_operations');
      const fileWrite = tool.functions.find(f => f.name === 'file_write');
      
      expect(fileWrite).toBeDefined();
      expect(fileWrite.description).toBe('Create a new file and write text content to it');
      expect(fileWrite.inputSchema).toBeDefined();
      expect(fileWrite.inputSchema.type).toBe('object');
      expect(fileWrite.inputSchema.properties.filepath).toBeDefined();
      expect(fileWrite.inputSchema.properties.content).toBeDefined();
      expect(fileWrite.inputSchema.required).toContain('filepath');
      expect(fileWrite.inputSchema.required).toContain('content');
    });
  });

  describe('File Operations Execution', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });
    });

    test('should execute file_write through MCP interface', async () => {
      const tool = toolRegistry.getTool('file_operations');
      const fileWrite = tool.functions.find(f => f.name === 'file_write');
      
      const result = await fileWrite.execute({
        filepath: testFilePath,
        content: 'Hello from Aiur MCP!'
      });

      expect(result.success).toBe(true);
      expect(result.filepath).toBe(testFilePath);
      expect(result.bytesWritten).toBe(20);
      
      // Verify file was actually written
      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toBe('Hello from Aiur MCP!');
    });

    test('should execute file_read through MCP interface', async () => {
      // First write a file
      await fs.writeFile(testFilePath, 'Test content for reading');
      
      const tool = toolRegistry.getTool('file_operations');
      const fileRead = tool.functions.find(f => f.name === 'file_read');
      
      const result = await fileRead.execute({
        filepath: testFilePath
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Test content for reading');
      expect(result.filepath).toBe(testFilePath);
      expect(result.size).toBe(24);
    });

    test('should create directories through MCP interface', async () => {
      const tool = toolRegistry.getTool('file_operations');
      const dirCreate = tool.functions.find(f => f.name === 'directory_create');
      
      const newDir = path.join(TEST_DIR, 'new-directory');
      const result = await dirCreate.execute({
        dirpath: newDir
      });

      expect(result.success).toBe(true);
      expect(result.dirpath).toBe(newDir);
      expect(result.created).toBe(true);
      
      // Verify directory exists
      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should list directory contents through MCP interface', async () => {
      // Create some test files
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(TEST_DIR, 'subdir'));
      
      const tool = toolRegistry.getTool('file_operations');
      const dirList = tool.functions.find(f => f.name === 'directory_list');
      
      const result = await dirList.execute({
        dirpath: TEST_DIR
      });

      expect(result.success).toBe(true);
      expect(result.dirpath).toBe(TEST_DIR);
      expect(result.contents).toHaveLength(3);
      
      const names = result.contents.map(item => item.name);
      expect(names).toContain('file1.txt');
      expect(names).toContain('file2.txt');
      expect(names).toContain('subdir');
      
      const subdir = result.contents.find(item => item.name === 'subdir');
      expect(subdir.type).toBe('directory');
      
      const file1 = result.contents.find(item => item.name === 'file1.txt');
      expect(file1.type).toBe('file');
      expect(file1.size).toBe(8);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });
    });

    test('should handle file not found errors', async () => {
      const tool = toolRegistry.getTool('file_operations');
      const fileRead = tool.functions.find(f => f.name === 'file_read');
      
      const result = await fileRead.execute({
        filepath: path.join(TEST_DIR, 'nonexistent.txt')
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ENOENT');
      expect(result.filepath).toBeDefined();
    });

    test('should handle missing required parameters', async () => {
      const tool = toolRegistry.getTool('file_operations');
      const fileWrite = tool.functions.find(f => f.name === 'file_write');
      
      // Missing content parameter
      const result = await fileWrite.execute({
        filepath: testFilePath
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    test('should handle invalid file paths', async () => {
      const tool = toolRegistry.getTool('file_operations');
      const fileWrite = tool.functions.find(f => f.name === 'file_write');
      
      const result = await fileWrite.execute({
        filepath: '',
        content: 'test'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('MCP Tool Discovery', () => {
    test('should make file operations discoverable as MCP tools', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      // Simulate MCP tool discovery
      const allTools = toolRegistry.getAllTools();
      const fileOpsTool = allTools.find(t => t.name === 'file_operations');
      
      expect(fileOpsTool).toBeDefined();
      expect(fileOpsTool.category).toBe('legion');
      expect(fileOpsTool.tags).toContain('imported');
      expect(fileOpsTool.tags).toContain('legion-module');
    });

    test('should provide correct metadata for tool discovery', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      const metadata = toolRegistry.getToolMetadata('file_operations');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('file_operations');
      expect(metadata.category).toBe('legion');
      expect(metadata.registeredAt).toBeDefined();
    });
  });

  describe('Integration with Aiur Features', () => {
    test('should work with handle resolution in parameters', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      // Create a handle with file content
      const contentHandle = handleRegistry.create('test_content', {
        data: 'Content from handle',
        type: 'text'
      });

      // This would normally be resolved by HandleResolver
      // For this test, we'll simulate the resolved parameters
      const tool = toolRegistry.getTool('file_operations');
      const fileWrite = tool.functions.find(f => f.name === 'file_write');
      
      const result = await fileWrite.execute({
        filepath: testFilePath,
        content: 'Content from handle' // Simulating resolved @test_content
      });

      expect(result.success).toBe(true);
      
      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toBe('Content from handle');
    });

    test('should support saveAs functionality', async () => {
      await adapter.initialize();
      await adapter.loadModule(FileModule, {
        basePath: TEST_DIR,
        encoding: 'utf8',
        createDirectories: true,
        permissions: 0o755
      });

      const tool = toolRegistry.getTool('file_operations');
      const fileRead = tool.functions.find(f => f.name === 'file_read');
      
      // Write test content
      await fs.writeFile(testFilePath, 'Content to save');
      
      // Execute with saveAs (would be handled by the MCP server)
      const result = await fileRead.execute({
        filepath: testFilePath,
        saveAs: 'file_content' // This would trigger auto-save in MCP server
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Content to save');
      // saveAs processing happens at MCP server level, not tool level
    });
  });
});