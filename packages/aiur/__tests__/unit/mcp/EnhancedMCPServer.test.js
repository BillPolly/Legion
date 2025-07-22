/**
 * Tests for Enhanced MCP Server with Handle Integration
 * 
 * Tests MCP server functionality with handle creation, resolution, and management
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnhancedMCPServer } from '../../../src/mcp/EnhancedMCPServer.js';

describe('EnhancedMCPServer', () => {
  let server;

  beforeEach(() => {
    server = new EnhancedMCPServer({
      name: 'test-aiur',
      version: '1.0.0'
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Basic MCP Server Functionality', () => {
    test('should initialize with handle registry', () => {
      expect(server.handleRegistry).toBeDefined();
      expect(server.handleResolver).toBeDefined();
      expect(typeof server.handleRegistry.create).toBe('function');
      expect(typeof server.handleResolver.resolve).toBe('function');
    });

    test('should provide server info', () => {
      const info = server.getServerInfo();
      expect(info.name).toBe('test-aiur');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toContain('handle-management');
      expect(info.capabilities).toContain('parameter-resolution');
    });

    test('should list available tools', () => {
      const tools = server.listTools();
      expect(Array.isArray(tools)).toBe(true);
      
      // Should include handle management tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('handle_create');
      expect(toolNames).toContain('handle_get');
      expect(toolNames).toContain('handle_list');
      expect(toolNames).toContain('handle_delete');
    });

    test('should list resources including handles', async () => {
      // Create some test handles
      server.handleRegistry.create('testHandle1', { data: 'test1' });
      server.handleRegistry.create('testHandle2', { data: 'test2' });

      const resources = await server.listResources();
      expect(Array.isArray(resources)).toBe(true);
      
      // Should include handle resources
      const handleResources = resources.filter(r => r.uri.startsWith('handle://'));
      expect(handleResources.length).toBe(2);
      
      const uris = handleResources.map(r => r.uri);
      expect(uris).toContain('handle://testHandle1');
      expect(uris).toContain('handle://testHandle2');
    });
  });

  describe('Handle Management Tools', () => {
    test('should create handle via handle_create tool', async () => {
      const result = await server.callTool('handle_create', {
        name: 'testRepo',
        data: { owner: 'facebook', name: 'react' },
        options: { ttl: 3600000 }
      });

      expect(result.success).toBe(true);
      expect(result.handleId).toBeDefined();
      expect(result.name).toBe('testRepo');
      
      // Verify handle was created
      expect(server.handleRegistry.existsByName('testRepo')).toBe(true);
    });

    test('should retrieve handle via handle_get tool', async () => {
      // Create a handle first
      const handleId = server.handleRegistry.create('getTest', { value: 42 });

      const result = await server.callTool('handle_get', {
        name: 'getTest'
      });

      expect(result.success).toBe(true);
      expect(result.handle).toBeDefined();
      expect(result.handle.name).toBe('getTest');
      expect(result.handle.data).toEqual({ value: 42 });
      expect(result.handle.id).toBe(handleId);
    });

    test('should list handles via handle_list tool', async () => {
      // Create some handles
      server.handleRegistry.create('handle1', { data: 'one' });
      server.handleRegistry.create('handle2', { data: 'two' });
      server.handleRegistry.create('handle3', { data: 'three' });

      const result = await server.callTool('handle_list', {});

      expect(result.success).toBe(true);
      expect(result.handles).toBeDefined();
      expect(result.handles.length).toBe(3);
      expect(result.count).toBe(3);
      
      const names = result.handles.map(h => h.name);
      expect(names).toContain('handle1');
      expect(names).toContain('handle2');
      expect(names).toContain('handle3');
    });

    test('should delete handle via handle_delete tool', async () => {
      // Create a handle first
      const handleId = server.handleRegistry.create('deleteMe', { data: 'temp' });

      expect(server.handleRegistry.existsByName('deleteMe')).toBe(true);

      const result = await server.callTool('handle_delete', {
        name: 'deleteMe'
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
      
      // Verify handle was deleted
      expect(server.handleRegistry.existsByName('deleteMe')).toBe(false);
    });

    test('should handle errors in handle operations', async () => {
      // Try to get non-existent handle
      const result1 = await server.callTool('handle_get', {
        name: 'nonExistent'
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Handle not found');

      // Try to delete non-existent handle
      const result2 = await server.callTool('handle_delete', {
        name: 'nonExistent'
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
    });
  });

  describe('Parameter Resolution', () => {
    beforeEach(() => {
      // Create test handles for resolution
      server.handleRegistry.create('repo', { owner: 'facebook', name: 'react' });
      server.handleRegistry.create('config', { port: 3000, env: 'development' });
      server.handleRegistry.create('user', { name: 'testUser', id: 123 });
    });

    test('should resolve simple handle references in parameters', async () => {
      // Mock a tool that uses handle parameters
      const mockTool = {
        name: 'mock_tool',
        description: 'A mock tool for testing',
        inputSchema: {
          type: 'object',
          properties: {
            repository: { type: 'object' },
            userId: { type: 'number' }
          }
        },
        execute: async (params) => {
          return { 
            repository: params.repository,
            userId: params.userId,
            success: true 
          };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('mock_tool', {
        repository: '@repo',
        userId: 456
      });

      expect(result.success).toBe(true);
      expect(result.repository).toEqual({ owner: 'facebook', name: 'react' });
      expect(result.userId).toBe(456);
    });

    test('should resolve nested handle references', async () => {
      const mockTool = {
        name: 'nested_tool',
        description: 'Tool with nested parameters',
        inputSchema: {
          type: 'object',
          properties: {
            settings: { type: 'object' }
          }
        },
        execute: async (params) => {
          return { settings: params.settings, success: true };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('nested_tool', {
        settings: {
          database: '@config',
          user: '@user',
          staticValue: 'unchanged'
        }
      });

      expect(result.success).toBe(true);
      expect(result.settings.database).toEqual({ port: 3000, env: 'development' });
      expect(result.settings.user).toEqual({ name: 'testUser', id: 123 });
      expect(result.settings.staticValue).toBe('unchanged');
    });

    test('should resolve handle references in arrays', async () => {
      const mockTool = {
        name: 'array_tool',
        description: 'Tool with array parameters',
        inputSchema: {
          type: 'object',
          properties: {
            items: { type: 'array' }
          }
        },
        execute: async (params) => {
          return { items: params.items, success: true };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('array_tool', {
        items: ['@repo', '@config', 'static']
      });

      expect(result.success).toBe(true);
      expect(result.items[0]).toEqual({ owner: 'facebook', name: 'react' });
      expect(result.items[1]).toEqual({ port: 3000, env: 'development' });
      expect(result.items[2]).toBe('static');
    });

    test('should handle missing handle references gracefully', async () => {
      const mockTool = {
        name: 'error_tool',
        description: 'Tool that should fail with missing handle',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'object' }
          }
        },
        execute: async (params) => {
          return { data: params.data, success: true };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('error_tool', {
        data: '@nonExistentHandle'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Handle not found: nonExistentHandle');
    });
  });

  describe('SaveAs Response Handling', () => {
    test('should create handle from tool response with saveAs', async () => {
      const mockTool = {
        name: 'create_data',
        description: 'Tool that creates data',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        },
        execute: async (params) => {
          return { 
            data: { processed: params.value.toUpperCase() },
            success: true,
            saveAs: 'processedData'
          };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('create_data', {
        value: 'hello world'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ processed: 'HELLO WORLD' });
      
      // Check that handle was created
      expect(server.handleRegistry.existsByName('processedData')).toBe(true);
      const handle = server.handleRegistry.getByName('processedData');
      expect(handle.data).toEqual({ processed: 'HELLO WORLD' });
    });

    test('should handle saveAs with options', async () => {
      const mockTool = {
        name: 'create_with_options',
        description: 'Tool that creates data with handle options',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        },
        execute: async (params) => {
          return { 
            data: { value: params.value },
            success: true,
            saveAs: {
              name: 'temporaryData',
              options: { ttl: 5000 }
            }
          };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('create_with_options', {
        value: 'temp data'
      });

      expect(result.success).toBe(true);
      
      // Check that handle was created with TTL
      expect(server.handleRegistry.existsByName('temporaryData')).toBe(true);
      const handle = server.handleRegistry.getByName('temporaryData');
      expect(handle.data).toEqual({ value: 'temp data' });
      expect(handle.metadata.ttl).toBe(5000);
    });

    test('should prevent overwriting existing handles without explicit permission', async () => {
      // Create an existing handle
      server.handleRegistry.create('existingHandle', { original: 'data' });

      const mockTool = {
        name: 'overwrite_test',
        description: 'Tool that tries to overwrite',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        },
        execute: async (params) => {
          return { 
            data: { new: params.value },
            success: true,
            saveAs: 'existingHandle'
          };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('overwrite_test', {
        value: 'new value'
      });

      // Tool should succeed but with a warning about overwrite
      expect(result.success).toBe(true);
      expect(result.warning).toContain('overwritten');
      
      // Handle should be updated
      const handle = server.handleRegistry.getByName('existingHandle');
      expect(handle.data).toEqual({ new: 'new value' });
    });
  });

  describe('Resource Management', () => {
    test('should provide handle resource content', async () => {
      // Create a test handle
      server.handleRegistry.create('resourceTest', { 
        content: 'This is resource content',
        metadata: { type: 'text' }
      });

      const resource = await server.readResource('handle://resourceTest');

      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(resource.mimeType).toBe('application/json');
      
      const content = JSON.parse(resource.contents);
      expect(content.content).toBe('This is resource content');
      expect(content.metadata.type).toBe('text');
    });

    test('should handle non-existent resource requests', async () => {
      await expect(server.readResource('handle://nonExistent'))
        .rejects
        .toThrow('Handle not found: nonExistent');
    });

    test('should provide resource notifications when handles change', () => {
      const notifications = [];
      server.onResourceUpdate = (uri) => {
        notifications.push(uri);
      };

      // Create a handle - should trigger notification
      server.handleRegistry.create('watchedHandle', { data: 'test' });
      
      expect(notifications).toContain('handle://watchedHandle');
    });
  });

  describe('Configuration and Options', () => {
    test('should configure handle registry type', () => {
      const lruServer = new EnhancedMCPServer({
        name: 'lru-test',
        version: '1.0.0',
        handleRegistryType: 'lru',
        handleRegistryOptions: { maxSize: 100 }
      });

      expect(lruServer.handleRegistry.getMaxSize()).toBe(100);
      lruServer.close();
    });

    test('should configure TTL handle registry', () => {
      const ttlServer = new EnhancedMCPServer({
        name: 'ttl-test',
        version: '1.0.0',
        handleRegistryType: 'ttl',
        handleRegistryOptions: { defaultTTL: 60000 }
      });

      expect(ttlServer.handleRegistry.defaultTTL).toBe(60000);
      ttlServer.close();
    });

    test('should allow disabling parameter resolution', async () => {
      const noResolveServer = new EnhancedMCPServer({
        name: 'no-resolve-test',
        version: '1.0.0',
        enableParameterResolution: false
      });

      // Create a handle
      noResolveServer.handleRegistry.create('testHandle', { data: 'test' });

      const mockTool = {
        name: 'no_resolve_tool',
        description: 'Tool that should not resolve parameters',
        inputSchema: {
          type: 'object',
          properties: {
            reference: { type: 'string' }
          }
        },
        execute: async (params) => {
          return { reference: params.reference, success: true };
        }
      };

      noResolveServer.addTool(mockTool);

      const result = await noResolveServer.callTool('no_resolve_tool', {
        reference: '@testHandle'
      });

      expect(result.success).toBe(true);
      expect(result.reference).toBe('@testHandle'); // Should not be resolved
      
      noResolveServer.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle tool execution errors gracefully', async () => {
      const errorTool = {
        name: 'error_tool',
        description: 'Tool that throws an error',
        inputSchema: {
          type: 'object',
          properties: {
            shouldError: { type: 'boolean' }
          }
        },
        execute: async (params) => {
          if (params.shouldError) {
            throw new Error('Intentional error');
          }
          return { success: true };
        }
      };

      server.addTool(errorTool);

      const result = await server.callTool('error_tool', {
        shouldError: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional error');
    });

    test('should handle invalid tool names', async () => {
      const result = await server.callTool('nonExistentTool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    test('should handle circular references in parameters', async () => {
      // Create handles with circular references
      const handle1Data = { name: 'handle1', ref: '@handle2' };
      const handle2Data = { name: 'handle2', ref: '@handle1' };
      
      server.handleRegistry.create('handle1', handle1Data);
      server.handleRegistry.create('handle2', handle2Data);

      const mockTool = {
        name: 'circular_tool',
        description: 'Tool that might encounter circular references',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'object' }
          }
        },
        execute: async (params) => {
          return { data: params.data, success: true };
        }
      };

      server.addTool(mockTool);

      const result = await server.callTool('circular_tool', {
        data: { start: '@handle1' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular reference detected');
    });
  });
});