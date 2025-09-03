/**
 * Unit tests for DisplayResourceTool
 * TDD: Test-first implementation of resource display tool with context-first pattern
 */

import { jest } from '@jest/globals';

describe('DisplayResourceTool', () => {
  let tool;
  let mockContext;
  
  beforeEach(async () => {
    mockContext = {
      resourceService: {
        displayResource: jest.fn()
      }
    };
    
    const { DisplayResourceTool } = await import('../../../src/tools/DisplayResourceTool.js');
    tool = new DisplayResourceTool();
  });

  describe('Tool Properties', () => {
    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('display_resource');
      expect(tool.description).toContain('resource handle');
      expect(tool.category).toBe('ui');
    });

    test('should enforce context-first parameter pattern', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema[0]).toEqual(
        expect.objectContaining({
          name: 'context',
          type: 'object',
          required: true
        })
      );
    });

    test('should define resourceHandle parameter', () => {
      expect(tool.parameterSchema[1]).toEqual(
        expect.objectContaining({
          name: 'resourceHandle', 
          type: 'object',
          required: true
        })
      );
    });

    test('should define options parameter', () => {
      expect(tool.parameterSchema[2]).toEqual(
        expect.objectContaining({
          name: 'options',
          type: 'object',
          required: false
        })
      );
    });
  });

  describe('Tool Execution', () => {
    test('should execute with context first parameter', async () => {
      const mockHandle = {
        path: '/test.txt',
        __isResourceHandle: true,
        __resourceType: 'FileHandle'
      };
      
      mockContext.resourceService.displayResource.mockResolvedValue({ windowId: 'window-123' });
      
      const result = await tool.execute(mockContext, mockHandle);
      
      expect(mockContext.resourceService.displayResource).toHaveBeenCalledWith(mockHandle, {});
      expect(result.windowId).toBeDefined();
    });

    test('should pass options to resource service', async () => {
      const mockHandle = { path: '/image.png', __isResourceHandle: true };
      const options = { viewerType: 'editor', windowId: 'existing-window' };
      
      mockContext.resourceService.displayResource.mockResolvedValue({ windowId: 'window-456' });
      
      await tool.execute(mockContext, mockHandle, options);
      
      expect(mockContext.resourceService.displayResource).toHaveBeenCalledWith(mockHandle, options);
    });

    test('should return window ID for agent planning', async () => {
      const mockHandle = { 
        path: '/data.json',
        __isResourceHandle: true,
        __resourceType: 'FileHandle'
      };
      
      mockContext.resourceService.displayResource.mockResolvedValue({ 
        windowId: 'json-window',
        viewerType: 'editor'
      });
      
      const result = await tool.execute(mockContext, mockHandle);
      
      expect(result).toEqual({
        windowId: 'json-window',
        viewerType: 'editor',
        resourcePath: '/data.json'
      });
    });

    test('should fail fast when context missing', async () => {
      const mockHandle = { path: '/test.txt' };
      
      await expect(tool.execute(null, mockHandle)).rejects.toThrow('Context is required');
    });

    test('should fail fast when resourceService missing', async () => {
      const mockHandle = { path: '/test.txt' };
      const badContext = {};
      
      await expect(tool.execute(badContext, mockHandle)).rejects.toThrow('resourceService not available in context');
    });

    test('should fail fast when handle invalid', async () => {
      await expect(tool.execute(mockContext, null)).rejects.toThrow('Resource handle is required');
      await expect(tool.execute(mockContext, {})).rejects.toThrow('Invalid resource handle');
    });
  });
});