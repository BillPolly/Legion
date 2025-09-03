/**
 * Unit tests for CloseWindowTool
 * TDD: Test-first implementation of window closing tool
 */

import { jest } from '@jest/globals';

describe('CloseWindowTool', () => {
  let tool;
  let mockContext;
  
  beforeEach(async () => {
    mockContext = {
      resourceService: {
        closeWindow: jest.fn()
      }
    };
    
    const { CloseWindowTool } = await import('../../../src/tools/CloseWindowTool.js');
    tool = new CloseWindowTool();
  });

  describe('Tool Properties', () => {
    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('close_window');
      expect(tool.description).toContain('window');
      expect(tool.category).toBe('ui');
    });

    test('should enforce context-first parameter pattern', () => {
      expect(tool.parameterSchema[0]).toEqual(
        expect.objectContaining({
          name: 'context',
          type: 'object',
          required: true
        })
      );
    });

    test('should define windowId parameter', () => {
      expect(tool.parameterSchema[1]).toEqual(
        expect.objectContaining({
          name: 'windowId',
          type: 'string',
          required: true
        })
      );
    });
  });

  describe('Tool Execution', () => {
    test('should execute with context first parameter', async () => {
      mockContext.resourceService.closeWindow.mockResolvedValue({ closed: true });
      
      const result = await tool.execute(mockContext, 'window-123');
      
      expect(mockContext.resourceService.closeWindow).toHaveBeenCalledWith('window-123');
      expect(result.windowId).toBe('window-123');
    });

    test('should handle multiple window closes', async () => {
      mockContext.resourceService.closeWindow.mockResolvedValue({ closed: true });
      
      await tool.execute(mockContext, 'window-1');
      await tool.execute(mockContext, 'window-2');
      
      expect(mockContext.resourceService.closeWindow).toHaveBeenCalledTimes(2);
      expect(mockContext.resourceService.closeWindow).toHaveBeenCalledWith('window-1');
      expect(mockContext.resourceService.closeWindow).toHaveBeenCalledWith('window-2');
    });

    test('should return close result for agent planning', async () => {
      mockContext.resourceService.closeWindow.mockResolvedValue({ 
        closed: true,
        windowId: 'closed-window'
      });
      
      const result = await tool.execute(mockContext, 'test-window');
      
      expect(result).toEqual({
        windowId: 'test-window',
        closed: true
      });
    });

    test('should fail fast when context missing', async () => {
      await expect(tool.execute(null, 'window-id')).rejects.toThrow('Context is required');
    });

    test('should fail fast when resourceService missing', async () => {
      await expect(tool.execute({}, 'window-id')).rejects.toThrow('resourceService not available in context');
    });

    test('should fail fast when windowId missing', async () => {
      await expect(tool.execute(mockContext, null)).rejects.toThrow('Window ID is required');
      await expect(tool.execute(mockContext, '   ')).rejects.toThrow('Window ID cannot be empty');
    });
  });
});