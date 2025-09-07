/**
 * Unit tests for CapabilityManager
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { CapabilityManager } from '../../src/capabilities/CapabilityManager.js';
import { getResourceManager } from '../../src/utils/ResourceAccess.js';

describe('CapabilityManager', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await getResourceManager();
  });

  describe('Initialization', () => {
    it('should initialize with empty configuration', () => {
      const manager = new CapabilityManager();
      
      expect(manager).toBeDefined();
      expect(manager.modules).toEqual({});
      expect(manager.tools).toEqual({});
      expect(manager.permissions).toEqual({});
      expect(manager.resourceManager).toBeNull();
    });

    it('should initialize with module configuration', () => {
      const config = {
        modules: ['file', 'calculator', 'json'],
        permissions: {
          file: {
            allowedOperations: ['read', 'write'],
            allowedPaths: ['/tmp', '/data']
          }
        }
      };
      
      const manager = new CapabilityManager(config);
      
      expect(manager.modules).toEqual({});
      expect(manager.tools).toEqual({});
      expect(manager.permissions).toEqual(config.permissions);
      expect(manager.config).toEqual(config);
    });

    it('should initialize with tool configuration', () => {
      const config = {
        tools: ['file_read', 'file_write', 'calculator'],
        permissions: {
          file_read: { maxFileSize: 1024 * 1024 },
          file_write: { allowedPaths: ['/tmp'] }
        }
      };
      
      const manager = new CapabilityManager(config);
      
      expect(manager.config.tools).toEqual(config.tools);
      expect(manager.permissions).toEqual(config.permissions);
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfig = {
        modules: 'not-an-array'
      };
      
      expect(() => new CapabilityManager(invalidConfig)).toThrow('Invalid configuration');
    });
  });

  describe('Resource Manager Integration', () => {
    it('should connect to ResourceManager', async () => {
      const manager = new CapabilityManager();
      await manager.initialize(resourceManager);
      
      expect(manager.resourceManager).toBe(resourceManager);
      expect(manager.initialized).toBe(true);
    });

    it('should throw error if already initialized', async () => {
      const manager = new CapabilityManager();
      await manager.initialize(resourceManager);
      
      await expect(manager.initialize(resourceManager)).rejects.toThrow('CapabilityManager already initialized');
    });

    it('should throw error if ResourceManager is not provided', async () => {
      const manager = new CapabilityManager();
      
      await expect(manager.initialize()).rejects.toThrow('ResourceManager is required');
    });
  });

  describe('Module Loading', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['file', 'calculator', 'json']
      });
      await manager.initialize(resourceManager);
    });

    it('should load configured modules', async () => {
      await manager.loadModules();
      
      expect(Object.keys(manager.modules)).toContain('file');
      expect(Object.keys(manager.modules)).toContain('calculator');
      expect(Object.keys(manager.modules)).toContain('json');
    });

    it('should extract tools from loaded modules', async () => {
      await manager.loadModules();
      
      // File module tools
      expect(manager.tools['file_read']).toBeDefined();
      expect(manager.tools['file_write']).toBeDefined();
      expect(manager.tools['directory_list']).toBeDefined();
      
      // Calculator module tools
      expect(manager.tools['calculator']).toBeDefined();
      
      // JSON module tools
      expect(manager.tools['json_parse']).toBeDefined();
      expect(manager.tools['json_stringify']).toBeDefined();
    });

    it('should throw error for non-existent module', async () => {
      manager.config.modules.push('non-existent-module');
      
      await expect(manager.loadModules()).rejects.toThrow('Module not found: non-existent-module');
    });

    it('should not load modules if none configured', async () => {
      const emptyManager = new CapabilityManager();
      await emptyManager.initialize(resourceManager);
      
      await emptyManager.loadModules();
      
      expect(Object.keys(emptyManager.modules)).toHaveLength(0);
      expect(Object.keys(emptyManager.tools)).toHaveLength(0);
    });
  });

  describe('Tool Loading', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        tools: ['file_read', 'calculator', 'json_parse']
      });
      await manager.initialize(resourceManager);
    });

    it('should load individual tools without loading entire modules', async () => {
      await manager.loadTools();
      
      // Should have only the specified tools
      expect(manager.tools['file_read']).toBeDefined();
      expect(manager.tools['calculator']).toBeDefined();
      expect(manager.tools['json_parse']).toBeDefined();
      
      // Should not have other tools from the same modules
      expect(manager.tools['file_write']).toBeUndefined();
      expect(manager.tools['json_stringify']).toBeUndefined();
    });

    it('should throw error for non-existent tool', async () => {
      manager.config.tools.push('non-existent-tool');
      
      await expect(manager.loadTools()).rejects.toThrow('Tool not found: non-existent-tool');
    });

    it('should merge tools from both modules and individual tools', async () => {
      const hybridManager = new CapabilityManager({
        modules: ['json'],
        tools: ['file_read', 'calculator']
      });
      await hybridManager.initialize(resourceManager);
      
      await hybridManager.loadModules();
      await hybridManager.loadTools();
      
      // From json module
      expect(hybridManager.tools['json_parse']).toBeDefined();
      expect(hybridManager.tools['json_stringify']).toBeDefined();
      
      // From individual tools
      expect(hybridManager.tools['file_read']).toBeDefined();
      expect(hybridManager.tools['calculator']).toBeDefined();
    });
  });

  describe('Tool Retrieval', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['file', 'calculator']
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
    });

    it('should retrieve loaded tool by name', () => {
      const tool = manager.getTool('file_read');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_read');
      expect(typeof tool.execute).toBe('function');
    });

    it('should return null for non-existent tool', () => {
      const tool = manager.getTool('non-existent');
      
      expect(tool).toBeNull();
    });

    it('should list all available tools', () => {
      const tools = manager.listTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toContain('file_read');
      expect(tools).toContain('file_write');
      expect(tools).toContain('calculator');
    });

    it('should get tool metadata', () => {
      const metadata = manager.getToolMetadata('file_read');
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('file_read');
      expect(metadata.description).toBeDefined();
      expect(metadata.inputSchema).toBeDefined();
    });
  });

  describe('Permission Validation', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['file'],
        permissions: {
          file_read: {
            allowedPaths: ['/tmp', '/data'],
            maxFileSize: 1024 * 1024
          },
          file_write: {
            allowedPaths: ['/tmp'],
            allowedExtensions: ['.txt', '.json']
          }
        }
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
    });

    it('should validate tool permissions', () => {
      const valid = manager.validatePermission('file_read', {
        path: '/tmp/test.txt'
      });
      
      expect(valid).toBe(true);
    });

    it('should reject operation outside allowed paths', () => {
      const valid = manager.validatePermission('file_read', {
        path: '/etc/passwd'
      });
      
      expect(valid).toBe(false);
    });

    it('should reject write operation with disallowed extension', () => {
      const valid = manager.validatePermission('file_write', {
        path: '/tmp/test.exe',
        content: 'data'
      });
      
      expect(valid).toBe(false);
    });

    it('should allow operation when no permissions configured', () => {
      const permissiveManager = new CapabilityManager({
        modules: ['calculator']
      });
      
      const valid = permissiveManager.validatePermission('calculator', {
        expression: '2 + 2'
      });
      
      expect(valid).toBe(true);
    });

    it('should get permission rules for a tool', () => {
      const rules = manager.getPermissionRules('file_read');
      
      expect(rules).toBeDefined();
      expect(rules.allowedPaths).toEqual(['/tmp', '/data']);
      expect(rules.maxFileSize).toBe(1024 * 1024);
    });

    it('should return empty object for tool without permissions', () => {
      const rules = manager.getPermissionRules('directory_list');
      
      expect(rules).toEqual({});
    });
  });

  describe('Tool Execution', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['calculator', 'json'],
        permissions: {
          calculator: {
            maxComplexity: 100
          }
        }
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
    });

    it('should execute tool with permission check', async () => {
      const result = await manager.executeTool('calculator', {
        expression: '2 + 2'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    it('should execute json_parse tool', async () => {
      const result = await manager.executeTool('json_parse', {
        json_string: '{"key": "value", "number": 42}'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ key: 'value', number: 42 });
    });

    it('should throw error for non-existent tool execution', async () => {
      await expect(manager.executeTool('non-existent', {}))
        .rejects.toThrow('Tool not found: non-existent');
    });

    it('should throw error when permission check fails', async () => {
      // Add restrictive permission
      manager.permissions.calculator = {
        allowedOperations: ['add', 'subtract']
      };
      
      // Override validatePermission to check operations
      manager.validatePermission = (toolName, params) => {
        if (toolName === 'calculator' && params.expression.includes('*')) {
          return false;
        }
        return true;
      };
      
      await expect(manager.executeTool('calculator', {
        expression: '2 * 3'
      })).rejects.toThrow('Permission denied for tool: calculator');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const manager = new CapabilityManager({
        modules: ['file', 'calculator']
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
      
      await manager.cleanup();
      
      expect(manager.modules).toEqual({});
      expect(manager.tools).toEqual({});
      expect(manager.initialized).toBe(false);
    });

    it('should handle cleanup when not initialized', async () => {
      const manager = new CapabilityManager();
      
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Tool Discovery', () => {
    let manager;

    beforeEach(async () => {
      manager = new CapabilityManager({
        modules: ['file', 'calculator', 'json']
      });
      await manager.initialize(resourceManager);
      await manager.loadModules();
    });

    it('should discover tools by category', () => {
      const fileTools = manager.discoverToolsByCategory('file');
      
      expect(fileTools).toContain('file_read');
      expect(fileTools).toContain('file_write');
      expect(fileTools).not.toContain('calculator');
    });

    it('should discover tools by capability', () => {
      const readTools = manager.discoverToolsByCapability('read');
      
      expect(readTools).toContain('file_read');
      expect(readTools).not.toContain('file_write');
    });

    it('should search tools by description', () => {
      const tools = manager.searchTools('parse');
      
      expect(tools).toContain('json_parse');
      expect(tools).not.toContain('json_stringify');
    });
  });
});