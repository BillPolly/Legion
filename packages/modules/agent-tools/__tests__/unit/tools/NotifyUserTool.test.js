/**
 * Unit tests for NotifyUserTool
 * TDD: Test-first implementation of user notification tool
 */

import { jest } from '@jest/globals';

describe('NotifyUserTool', () => {
  let tool;
  let mockContext;
  
  beforeEach(async () => {
    mockContext = {
      resourceService: {
        showNotification: jest.fn()
      }
    };
    
    const { NotifyUserTool } = await import('../../../src/tools/NotifyUserTool.js');
    tool = new NotifyUserTool();
  });

  describe('Tool Properties', () => {
    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('notify_user');
      expect(tool.description).toContain('notification');
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

    test('should define message parameter', () => {
      expect(tool.parameterSchema[1]).toEqual(
        expect.objectContaining({
          name: 'message',
          type: 'string',
          required: true
        })
      );
    });

    test('should define type and duration parameters', () => {
      expect(tool.parameterSchema[2].name).toBe('type');
      expect(tool.parameterSchema[3].name).toBe('duration');
      expect(tool.parameterSchema[2].required).toBe(false);
      expect(tool.parameterSchema[3].required).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    test('should execute with context first parameter', async () => {
      mockContext.resourceService.showNotification.mockResolvedValue({ notificationId: 'notif-123' });
      
      const result = await tool.execute(mockContext, 'Test message');
      
      expect(mockContext.resourceService.showNotification).toHaveBeenCalledWith('Test message', 'info', 3000);
      expect(result.notificationId).toBe('notif-123');
    });

    test('should handle different notification types', async () => {
      mockContext.resourceService.showNotification.mockResolvedValue({ notificationId: 'success-notif' });
      
      await tool.execute(mockContext, 'Success!', 'success', 5000);
      
      expect(mockContext.resourceService.showNotification).toHaveBeenCalledWith('Success!', 'success', 5000);
    });

    test('should handle progress notifications', async () => {
      mockContext.resourceService.showNotification.mockResolvedValue({ notificationId: 'progress-notif' });
      
      await tool.execute(mockContext, 'Processing...', 'progress', 0);
      
      expect(mockContext.resourceService.showNotification).toHaveBeenCalledWith('Processing...', 'progress', 0);
    });

    test('should return notification result for agent planning', async () => {
      mockContext.resourceService.showNotification.mockResolvedValue({ 
        notificationId: 'notif-456',
        type: 'info',
        displayed: true
      });
      
      const result = await tool.execute(mockContext, 'Info message');
      
      expect(result).toEqual({
        notificationId: 'notif-456',
        type: 'info',
        message: 'Info message'
      });
    });

    test('should fail fast when context missing', async () => {
      await expect(tool.execute(null, 'message')).rejects.toThrow('Context is required');
    });

    test('should fail fast when resourceService missing', async () => {
      await expect(tool.execute({}, 'message')).rejects.toThrow('resourceService not available in context');
    });

    test('should fail fast when message missing', async () => {
      await expect(tool.execute(mockContext, null)).rejects.toThrow('Message is required');
      await expect(tool.execute(mockContext, '   ')).rejects.toThrow('Message cannot be empty');
    });
  });
});