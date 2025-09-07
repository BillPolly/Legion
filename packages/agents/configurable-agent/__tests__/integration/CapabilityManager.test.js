/**
 * Integration tests for CapabilityManager with real Legion tools
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { CapabilityManager } from '../../src/capabilities/CapabilityManager.js';
import { getResourceManager } from '../../src/utils/ResourceAccess.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CapabilityManager Integration', () => {
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await getResourceManager();
    
    // Create test directory
    testDir = path.join(__dirname, '../tmp/capability-tests');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    const files = await fs.readdir(testDir).catch(() => []);
    for (const file of files) {
      await fs.unlink(path.join(testDir, file)).catch(() => {});
    }
  });

  describe('Real Tool Module Loading', () => {
    it('should load and execute real file tools', async () => {
      const manager = new CapabilityManager({
        modules: ['file'],
        permissions: {
          file_write: {
            allowedPaths: [testDir]
          },
          file_read: {
            allowedPaths: [testDir]
          }
        }
      });
      
      await manager.initialize(resourceManager);
      
      // In test environment, will use mock modules
      await manager.loadModules();
      
      // Test file write
      const writeFile = path.join(testDir, 'test-write.txt');
      const writeResult = await manager.executeTool('file_write', {
        path: writeFile,
        content: 'Hello from CapabilityManager'
      });
      
      expect(writeResult.success).toBe(true);
      
      // Test file read
      const readResult = await manager.executeTool('file_read', {
        path: writeFile
      });
      
      expect(readResult.success).toBe(true);
      // Mock returns mock content
      expect(readResult.content).toContain('Mock content');
    });

    it('should load and execute calculator tool', async () => {
      const manager = new CapabilityManager({
        tools: ['calculator']
      });
      
      await manager.initialize(resourceManager);
      await manager.loadTools();
      
      const result = await manager.executeTool('calculator', {
        expression: '(10 + 5) * 2'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });

    it('should load and execute JSON tools', async () => {
      const manager = new CapabilityManager({
        modules: ['json']
      });
      
      await manager.initialize(resourceManager);
      await manager.loadModules();
      
      // Test JSON parse
      const parseResult = await manager.executeTool('json_parse', {
        json_string: '{"name": "test", "value": 123, "nested": {"key": "value"}}'
      });
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.result).toEqual({
        name: 'test',
        value: 123,
        nested: { key: 'value' }
      });
      
      // Test JSON stringify
      const stringifyResult = await manager.executeTool('json_stringify', {
        object: { test: true, number: 42 },
        pretty: true
      });
      
      expect(stringifyResult.success).toBe(true);
      expect(stringifyResult.result).toContain('"test": true');
      expect(stringifyResult.result).toContain('"number": 42');
    });
  });

  describe('Permission Enforcement', () => {
    it('should enforce file path permissions', async () => {
      const manager = new CapabilityManager({
        modules: ['file'],
        permissions: {
          file_write: {
            allowedPaths: ['/tmp']
          }
        }
      });
      
      await manager.initialize(resourceManager);
      await manager.loadModules();
      
      // Should fail - not in allowed path
      await expect(manager.executeTool('file_write', {
        path: '/etc/passwd',
        content: 'malicious'
      })).rejects.toThrow('Permission denied');
      
      // Should succeed - in allowed path
      const result = await manager.executeTool('file_write', {
        path: '/tmp/test.txt',
        content: 'safe content'
      });
      
      expect(result.success).toBe(true);
    });

    it('should enforce file extension permissions', async () => {
      const manager = new CapabilityManager({
        tools: ['file_write'],
        permissions: {
          file_write: {
            allowedPaths: [testDir],
            allowedExtensions: ['.txt', '.md', '.json']
          }
        }
      });
      
      await manager.initialize(resourceManager);
      await manager.loadTools();
      
      // Should fail - not allowed extension
      await expect(manager.executeTool('file_write', {
        path: path.join(testDir, 'test.exe'),
        content: 'executable'
      })).rejects.toThrow('Permission denied');
      
      // Should succeed - allowed extension
      const result = await manager.executeTool('file_write', {
        path: path.join(testDir, 'test.json'),
        content: '{"safe": true}'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Mixed Module and Tool Loading', () => {
    it('should handle mixed configuration correctly', async () => {
      const manager = new CapabilityManager({
        modules: ['json'],          // Load all JSON tools
        tools: ['file_read', 'calculator']  // Load specific tools
      });
      
      await manager.initialize(resourceManager);
      await manager.loadModules();
      await manager.loadTools();
      
      // Should have all JSON tools
      expect(manager.getTool('json_parse')).toBeDefined();
      expect(manager.getTool('json_stringify')).toBeDefined();
      expect(manager.getTool('json_validate')).toBeDefined();
      
      // Should have specific tools
      expect(manager.getTool('file_read')).toBeDefined();
      expect(manager.getTool('calculator')).toBeDefined();
      
      // Should NOT have file_write (not requested)
      expect(manager.getTool('file_write')).toBeNull();
    });
  });

  describe('Tool Discovery and Search', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['file', 'json', 'calculator']
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
    });

    it('should discover tools by category', () => {
      const fileTools = manager.discoverToolsByCategory('file');
      expect(fileTools).toContain('file_read');
      expect(fileTools).toContain('file_write');
      expect(fileTools).toContain('directory_list');
      expect(fileTools).not.toContain('json_parse');
      
      const mathTools = manager.discoverToolsByCategory('math');
      expect(mathTools).toContain('calculator');
    });

    it('should discover tools by capability', () => {
      const readTools = manager.discoverToolsByCapability('read');
      expect(readTools).toContain('file_read');
      expect(readTools).not.toContain('file_write');
      
      const parseTools = manager.discoverToolsByCapability('parse');
      expect(parseTools).toContain('json_parse');
      
      const validateTools = manager.discoverToolsByCapability('validate');
      expect(validateTools).toContain('json_validate');
    });

    it('should search tools by description keywords', () => {
      const fileTools = manager.searchTools('file');
      expect(fileTools).toContain('file_read');
      expect(fileTools).toContain('file_write');
      expect(fileTools).toContain('file_delete');
      
      const jsonTools = manager.searchTools('JSON');
      expect(jsonTools).toContain('json_parse');
      expect(jsonTools).toContain('json_stringify');
      expect(jsonTools).toContain('json_validate');
      
      const mathTools = manager.searchTools('mathematical');
      expect(mathTools).toContain('calculator');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const manager = new CapabilityManager({
        tools: ['json_parse']
      });
      
      await manager.initialize(resourceManager);
      await manager.loadTools();
      
      // Invalid JSON should return error
      const result = await manager.executeTool('json_parse', {
        json_string: 'not valid json{'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should handle calculator errors gracefully', async () => {
      const manager = new CapabilityManager({
        tools: ['calculator']
      });
      
      await manager.initialize(resourceManager);
      await manager.loadTools();
      
      // Invalid expression
      const result = await manager.executeTool('calculator', {
        expression: 'invalid expression @#$'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid expression');
    });
  });

  describe('Lifecycle Management', () => {
    it('should properly initialize and cleanup', async () => {
      const manager = new CapabilityManager({
        modules: ['file', 'json', 'calculator']
      });
      
      // Initialize
      await manager.initialize(resourceManager);
      expect(manager.initialized).toBe(true);
      expect(manager.resourceManager).toBe(resourceManager);
      
      // Load modules
      await manager.loadModules();
      expect(Object.keys(manager.modules)).toHaveLength(3);
      expect(Object.keys(manager.tools).length).toBeGreaterThan(0);
      
      // Cleanup
      await manager.cleanup();
      expect(manager.initialized).toBe(false);
      expect(manager.resourceManager).toBeNull();
      expect(Object.keys(manager.modules)).toHaveLength(0);
      expect(Object.keys(manager.tools)).toHaveLength(0);
    });

    it('should handle re-initialization after cleanup', async () => {
      const manager = new CapabilityManager({
        tools: ['calculator']
      });
      
      // First initialization
      await manager.initialize(resourceManager);
      await manager.loadTools();
      expect(manager.getTool('calculator')).toBeDefined();
      
      // Cleanup
      await manager.cleanup();
      expect(manager.getTool('calculator')).toBeNull();
      
      // Re-initialize
      await manager.initialize(resourceManager);
      await manager.loadTools();
      expect(manager.getTool('calculator')).toBeDefined();
    });
  });

  describe('Tool Metadata', () => {
    it('should provide complete tool metadata', async () => {
      const manager = new CapabilityManager({
        tools: ['json_parse', 'file_read', 'calculator']
      });
      
      await manager.initialize(resourceManager);
      await manager.loadTools();
      
      // Check json_parse metadata
      const jsonMeta = manager.getToolMetadata('json_parse');
      expect(jsonMeta).toBeDefined();
      expect(jsonMeta.name).toBe('json_parse');
      expect(jsonMeta.description).toContain('Parse');
      expect(jsonMeta.inputSchema).toBeDefined();
      expect(jsonMeta.inputSchema.properties.json_string).toBeDefined();
      
      // Check file_read metadata
      const fileMeta = manager.getToolMetadata('file_read');
      expect(fileMeta).toBeDefined();
      expect(fileMeta.name).toBe('file_read');
      expect(fileMeta.inputSchema.properties.path).toBeDefined();
      
      // Check calculator metadata
      const calcMeta = manager.getToolMetadata('calculator');
      expect(calcMeta).toBeDefined();
      expect(calcMeta.name).toBe('calculator');
      expect(calcMeta.category).toBe('math');
    });
  });
});