/**
 * Tests for LegionModuleAdapter class
 * 
 * Tests integration of Legion modules with Aiur MCP server
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LegionModuleAdapter } from '../../../src/tools/LegionModuleAdapter.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

// Mock Legion module components
jest.mock('@legion/module-loader', () => ({
  ResourceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    get: jest.fn()
  })),
  ModuleFactory: jest.fn().mockImplementation(function(resourceManager) {
    this.resourceManager = resourceManager;
    this.createModule = jest.fn();
  })
}));

describe('LegionModuleAdapter', () => {
  let toolRegistry;
  let handleRegistry;
  let adapter;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    adapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
  });

  describe('Initialization', () => {
    test('should initialize ResourceManager and ModuleFactory', async () => {
      await adapter.initialize();
      
      expect(adapter.resourceManager).toBeDefined();
      expect(adapter.moduleFactory).toBeDefined();
    });

    test('should track loaded modules', () => {
      expect(adapter.listLoadedModules()).toEqual([]);
    });
  });

  describe('Single Function Tool Loading', () => {
    test('should load module with single-function tool', async () => {
      await adapter.initialize();

      // Mock a single-function Legion tool
      const mockTool = {
        name: 'simple_tool',
        description: 'A simple tool',
        getToolDescription: () => ({
          type: 'function',
          function: {
            name: 'simple_tool',
            description: 'A simple tool',
            parameters: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              },
              required: ['input']
            }
          }
        }),
        safeInvoke: jest.fn().mockResolvedValue({
          success: true,
          data: { output: 'result' }
        })
      };

      const mockModule = {
        name: 'test-module',
        getTools: () => [mockTool]
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);

      const result = await adapter.loadModule(mockModule);

      expect(result.moduleName).toBe('test-module');
      expect(result.toolsRegistered).toBe(1);
      expect(result.tools).toContain('simple_tool');
      
      // Check tool was registered
      const registeredTool = toolRegistry.getTool('simple_tool');
      expect(registeredTool).toBeDefined();
      expect(registeredTool.name).toBe('simple_tool');
      expect(registeredTool.inputSchema).toEqual({
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      });
    });
  });

  describe('Multi-Function Tool Loading', () => {
    test('should load module with multi-function tool (like FileOperationsTool)', async () => {
      await adapter.initialize();

      // Mock a multi-function Legion tool similar to FileOperationsTool
      const mockMultiTool = {
        name: 'file_operations',
        description: 'File operations tool',
        getToolDescription: () => ({
          type: 'function',
          function: {
            name: 'file_read',
            description: 'Read a file',
            parameters: {
              type: 'object',
              properties: {
                filepath: { type: 'string' }
              },
              required: ['filepath']
            }
          }
        }),
        getAllToolDescriptions: () => [
          {
            type: 'function',
            function: {
              name: 'file_read',
              description: 'Read a file',
              parameters: {
                type: 'object',
                properties: {
                  filepath: { type: 'string' }
                },
                required: ['filepath']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'file_write',
              description: 'Write to a file',
              parameters: {
                type: 'object',
                properties: {
                  filepath: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['filepath', 'content']
              }
            }
          }
        ],
        safeInvoke: jest.fn().mockImplementation(async (toolCall) => {
          const functionName = toolCall.function.name;
          if (functionName === 'file_read') {
            return { success: true, data: { content: 'file contents' } };
          } else if (functionName === 'file_write') {
            return { success: true, data: { bytesWritten: 100 } };
          }
          return { success: false, error: 'Unknown function' };
        })
      };

      const mockModule = {
        name: 'file-module',
        getTools: () => [mockMultiTool]
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);

      const result = await adapter.loadModule(mockModule);

      expect(result.moduleName).toBe('file-module');
      expect(result.toolsRegistered).toBe(1);
      
      // Check that the multi-function tool was registered
      const registeredTool = toolRegistry.getTool('file_operations');
      expect(registeredTool).toBeDefined();
      expect(registeredTool.functions).toBeDefined();
      expect(registeredTool.functions.length).toBe(2);
      
      // Check individual functions
      const fileReadFunc = registeredTool.functions.find(f => f.name === 'file_read');
      expect(fileReadFunc).toBeDefined();
      expect(fileReadFunc.description).toBe('Read a file');
      expect(fileReadFunc.inputSchema.properties.filepath).toBeDefined();
      
      const fileWriteFunc = registeredTool.functions.find(f => f.name === 'file_write');
      expect(fileWriteFunc).toBeDefined();
      expect(fileWriteFunc.description).toBe('Write to a file');
      expect(fileWriteFunc.inputSchema.properties.content).toBeDefined();
    });

    test('should execute multi-function tool functions correctly', async () => {
      await adapter.initialize();

      const mockInvoke = jest.fn().mockImplementation(async (toolCall) => {
        const functionName = toolCall.function.name;
        if (functionName === 'file_write') {
          return { success: true, data: { filepath: 'test.txt', bytesWritten: 15 } };
        }
        return { success: false, error: 'Unknown function' };
      });

      const mockMultiTool = {
        name: 'file_operations',
        description: 'File operations',
        getToolDescription: () => ({ type: 'function', function: { name: 'file_read' } }),
        getAllToolDescriptions: () => [
          {
            type: 'function',
            function: {
              name: 'file_write',
              description: 'Write file',
              parameters: { type: 'object' }
            }
          }
        ],
        safeInvoke: mockInvoke
      };

      const mockModule = {
        name: 'test',
        getTools: () => [mockMultiTool]
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);
      await adapter.loadModule(mockModule);

      const tool = toolRegistry.getTool('file_operations');
      const writeFunc = tool.functions[0];
      
      // Execute the function
      const result = await writeFunc.execute({ filepath: 'test.txt', content: 'Hello' });
      
      expect(result.success).toBe(true);
      expect(result.filepath).toBe('test.txt');
      expect(result.bytesWritten).toBe(15);
      
      // Verify the tool was called with correct format
      expect(mockInvoke).toHaveBeenCalledWith({
        id: expect.stringContaining('aiur-'),
        type: 'function',
        function: {
          name: 'file_write',
          arguments: '{"filepath":"test.txt","content":"Hello"}'
        }
      });
    });
  });

  describe('Module Dependencies', () => {
    test('should register dependencies before loading module', async () => {
      await adapter.initialize();

      const dependencies = {
        basePath: '/test/path',
        encoding: 'utf8',
        createDirectories: true
      };

      const mockModule = {
        name: 'dependent-module',
        getTools: () => []
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);

      await adapter.loadModule(mockModule, dependencies);

      // Verify dependencies were registered
      expect(adapter.resourceManager.register).toHaveBeenCalledWith('basePath', '/test/path');
      expect(adapter.resourceManager.register).toHaveBeenCalledWith('encoding', 'utf8');
      expect(adapter.resourceManager.register).toHaveBeenCalledWith('createDirectories', true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid module identifier', async () => {
      await adapter.initialize();
      
      await expect(adapter.loadModule(null)).rejects.toThrow('Module identifier must be a path string or module class');
      await expect(adapter.loadModule(123)).rejects.toThrow('Module identifier must be a path string or module class');
    });

    test('should handle module without tools', async () => {
      await adapter.initialize();

      const mockModule = {
        name: 'empty-module',
        getTools: () => []
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);

      const result = await adapter.loadModule(mockModule);
      
      expect(result.toolsRegistered).toBe(0);
      expect(result.tools).toEqual([]);
    });

    test('should handle tool conversion errors gracefully', async () => {
      await adapter.initialize();

      const mockTool = {
        name: 'broken_tool',
        // Missing required methods
      };

      const mockModule = {
        name: 'broken-module',
        getTools: () => [mockTool]
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);

      // Should not throw, but tool won't be registered properly
      const result = await adapter.loadModule(mockModule);
      expect(result.toolsRegistered).toBe(1); // Attempted to register
    });
  });

  describe('Module Management', () => {
    test('should list loaded modules', async () => {
      await adapter.initialize();

      const mockModule1 = {
        name: 'module1',
        getTools: () => [{
          name: 'tool1',
          getToolDescription: () => ({ type: 'function', function: { name: 'tool1' } })
        }]
      };

      const mockModule2 = {
        name: 'module2',
        getTools: () => [{
          name: 'tool2',
          getToolDescription: () => ({ type: 'function', function: { name: 'tool2' } })
        }]
      };

      adapter.moduleFactory.createModule
        .mockReturnValueOnce(mockModule1)
        .mockReturnValueOnce(mockModule2);

      await adapter.loadModule(mockModule1);
      await adapter.loadModule(mockModule2);

      const loaded = adapter.listLoadedModules();
      expect(loaded).toHaveLength(2);
      expect(loaded.find(m => m.name === 'module1')).toBeDefined();
      expect(loaded.find(m => m.name === 'module2')).toBeDefined();
    });

    test('should unload module and its tools', async () => {
      await adapter.initialize();

      const mockModule = {
        name: 'test-module',
        getTools: () => [{
          name: 'test_tool',
          getToolDescription: () => ({ type: 'function', function: { name: 'test_tool' } })
        }],
        cleanup: jest.fn()
      };

      adapter.moduleFactory.createModule.mockReturnValue(mockModule);
      await adapter.loadModule(mockModule);

      // Verify tool is registered
      expect(toolRegistry.hasTool('test_tool')).toBe(true);

      // Unload module
      await adapter.unloadModule('test-module');

      // Verify cleanup was called
      expect(mockModule.cleanup).toHaveBeenCalled();
      
      // Verify tool was unregistered
      expect(toolRegistry.hasTool('test_tool')).toBe(false);
      
      // Verify module is no longer listed
      expect(adapter.listLoadedModules()).toHaveLength(0);
    });
  });
});