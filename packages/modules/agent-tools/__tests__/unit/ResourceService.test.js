/**
 * Unit tests for ResourceService
 * TDD: Test-first implementation of resource service for context integration
 */

import { jest } from '@jest/globals';

describe('ResourceService', () => {
  let service;
  let mockResourceServer;
  let mockResourceClient;
  let mockWindowManager;
  
  beforeEach(async () => {
    mockResourceServer = {
      receive: jest.fn()
    };
    
    mockResourceClient = {
      requestResource: jest.fn()
    };
    
    mockWindowManager = {
      handleResourceReady: jest.fn(),
      closeWindow: jest.fn(),
      getWindowInfo: jest.fn()
    };
    
    const { ResourceService } = await import('../../src/ResourceService.js');
    service = new ResourceService(mockResourceServer, mockResourceClient, mockWindowManager);
  });

  describe('Service Initialization', () => {
    test('should initialize with actor and manager references', () => {
      expect(service.resourceServer).toBe(mockResourceServer);
      expect(service.resourceClient).toBe(mockResourceClient);
      expect(service.windowManager).toBe(mockWindowManager);
    });

    test('should fail fast when required dependencies missing', async () => {
      const { ResourceService } = await import('../../src/ResourceService.js');
      
      expect(() => new ResourceService(null, mockResourceClient, mockWindowManager))
        .toThrow('ResourceServer is required');
      expect(() => new ResourceService(mockResourceServer, null, mockWindowManager))
        .toThrow('ResourceClient is required');
      expect(() => new ResourceService(mockResourceServer, mockResourceClient, null))
        .toThrow('WindowManager is required');
    });
  });

  describe('Display Resource Method', () => {
    test('should display resource handle in floating window', async () => {
      const mockHandle = {
        path: '/test.txt',
        __isResourceHandle: true,
        __resourceType: 'FileHandle'
      };
      
      mockWindowManager.handleResourceReady.mockResolvedValue({ 
        windowId: 'test-window',
        viewerType: 'editor' 
      });
      
      const result = await service.displayResource(mockHandle);
      
      expect(result.windowId).toBe('test-window');
      expect(result.viewerType).toBe('editor');
    });

    test('should handle viewer type override', async () => {
      const mockHandle = { path: '/image.png', __isResourceHandle: true };
      const options = { viewerType: 'editor' };
      
      mockWindowManager.handleResourceReady.mockResolvedValue({ windowId: 'override-window' });
      
      await service.displayResource(mockHandle, options);
      
      expect(mockWindowManager.handleResourceReady).toHaveBeenCalledWith(
        expect.objectContaining({
          handle: mockHandle,
          viewerType: 'editor'
        })
      );
    });

    test('should handle window reuse with windowId', async () => {
      const mockHandle = { path: '/data.json', __isResourceHandle: true };
      const options = { windowId: 'existing-window' };
      
      mockWindowManager.handleResourceReady.mockResolvedValue({ windowId: 'existing-window' });
      
      const result = await service.displayResource(mockHandle, options);
      
      expect(result.windowId).toBe('existing-window');
    });

    test('should fail fast for invalid handles', async () => {
      await expect(service.displayResource(null)).rejects.toThrow('Resource handle is required');
      await expect(service.displayResource({})).rejects.toThrow('Invalid resource handle');
    });
  });

  describe('Show Notification Method', () => {
    test('should show notifications to user', async () => {
      const result = await service.showNotification('Test message', 'info', 3000);
      
      expect(result.notificationId).toBeDefined();
      expect(result.message).toBe('Test message');
      expect(result.type).toBe('info');
    });

    test('should handle different notification types', async () => {
      await service.showNotification('Success!', 'success', 5000);
      await service.showNotification('Error occurred', 'error', 0);
      
      // For MVP, just verify method completes without error
      expect(true).toBe(true);
    });
  });

  describe('Close Window Method', () => {
    test('should close windows by ID', async () => {
      mockWindowManager.closeWindow.mockResolvedValue({ closed: true });
      
      const result = await service.closeWindow('test-window');
      
      expect(mockWindowManager.closeWindow).toHaveBeenCalledWith('test-window');
      expect(result.closed).toBe(true);
    });

    test('should fail fast for missing window ID', async () => {
      await expect(service.closeWindow(null)).rejects.toThrow('Window ID is required');
    });
  });

  describe('Window Management', () => {
    test('should get list of open windows', async () => {
      mockWindowManager.getWindowInfo.mockReturnValue([
        { windowId: 'window-1', path: '/file1.txt' },
        { windowId: 'window-2', path: '/file2.txt' }
      ]);
      
      const windows = await service.getOpenWindows();
      
      expect(windows).toHaveLength(2);
      expect(windows[0].windowId).toBe('window-1');
    });
  });
});