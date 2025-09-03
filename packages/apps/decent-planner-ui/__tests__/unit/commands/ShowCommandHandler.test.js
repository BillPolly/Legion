/**
 * Unit tests for ShowCommandHandler
 * TDD: Test-first implementation of /show command processing and window creation
 */

import { jest } from '@jest/globals';

describe('ShowCommandHandler', () => {
  let handler;
  let mockResourceActor;
  let mockContainer;
  
  beforeEach(async () => {
    mockResourceActor = {
      requestResource: jest.fn()
    };
    
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {}
    };
    
    const { ShowCommandHandler } = await import('../../../src/shared/commands/ShowCommandHandler.js');
    handler = new ShowCommandHandler(mockResourceActor, mockContainer);
  });

  describe('Initialization', () => {
    test('should initialize with resource actor and container', () => {
      expect(handler.resourceActor).toBe(mockResourceActor);
      expect(handler.container).toBe(mockContainer);
      expect(handler.typeRegistry).toBeDefined();
      expect(handler.openWindows).toBeDefined();
      expect(handler.openWindows instanceof Map).toBe(true);
    });
  });

  describe('Path Analysis', () => {
    test('should detect file type from extension', () => {
      expect(handler.getViewerType('/test.txt')).toBe('CodeEditor');
      expect(handler.getViewerType('/image.png')).toBe('ImageViewer'); 
      expect(handler.getViewerType('/script.js')).toBe('CodeEditor');
      expect(handler.getViewerType('/photo.jpg')).toBe('ImageViewer');
    });

    test('should detect directory paths', () => {
      expect(handler.getViewerType('/')).toBe('DirectoryBrowser');
      expect(handler.getViewerType('/some/directory')).toBe('DirectoryBrowser');
    });

    test('should default to CodeEditor for unknown extensions', () => {
      expect(handler.getViewerType('/unknown.xyz')).toBe('CodeEditor');
    });

    test('should detect resource type from path', () => {
      expect(handler.getResourceType('/test.txt')).toBe('file');
      expect(handler.getResourceType('/image.png')).toBe('image');
      expect(handler.getResourceType('/')).toBe('directory');
    });
  });

  describe('Command Processing', () => {
    test('should process show command with file path', async () => {
      const resourcePath = '/test/myfile.txt';
      
      // Mock resource request
      mockResourceActor.requestResource.mockResolvedValue();
      
      const result = await handler.handleShowCommand(resourcePath);
      
      expect(mockResourceActor.requestResource).toHaveBeenCalledWith(resourcePath, 'file');
      expect(result.success).toBe(true);
      expect(result.path).toBe(resourcePath);
      expect(result.viewerType).toBe('CodeEditor');
    });

    test('should process show command with image path', async () => {
      const imagePath = '/images/photo.png';
      
      const result = await handler.handleShowCommand(imagePath);
      
      expect(mockResourceActor.requestResource).toHaveBeenCalledWith(imagePath, 'image');
      expect(result.viewerType).toBe('ImageViewer');
    });

    test('should handle show command errors', async () => {
      const invalidPath = '/invalid/path.txt';
      
      mockResourceActor.requestResource.mockRejectedValue(new Error('Path not found'));
      
      await expect(handler.handleShowCommand(invalidPath)).rejects.toThrow('Path not found');
    });
  });

  describe('Window Management', () => {
    test('should track open windows by path', () => {
      const mockWindow = { id: 'window-1', close: jest.fn() };
      
      handler.registerWindow('/test.txt', mockWindow);
      
      expect(handler.openWindows.has('/test.txt')).toBe(true);
      expect(handler.openWindows.get('/test.txt')).toBe(mockWindow);
    });

    test('should close existing window when opening same resource', () => {
      const existingWindow = { id: 'existing', close: jest.fn() };
      const newWindow = { id: 'new', close: jest.fn() };
      
      handler.registerWindow('/test.txt', existingWindow);
      handler.registerWindow('/test.txt', newWindow); // Should close existing
      
      expect(existingWindow.close).toHaveBeenCalled();
      expect(handler.openWindows.get('/test.txt')).toBe(newWindow);
    });

    test('should clean up window when closed', () => {
      const mockWindow = { id: 'window-1', close: jest.fn() };
      
      handler.registerWindow('/test.txt', mockWindow);
      handler.unregisterWindow('/test.txt');
      
      expect(handler.openWindows.has('/test.txt')).toBe(false);
    });
  });

  describe('Resource Handle Events', () => {
    test('should handle resource:ready events and create window', () => {
      const mockHandle = {
        __isResourceHandle: true,
        __resourceType: 'FileHandle'
      };
      
      const eventData = {
        path: '/test.txt',
        type: 'file',
        extension: '.txt',
        handle: mockHandle
      };
      
      const result = handler.handleResourceReady(eventData);
      
      expect(result.windowCreated).toBe(true);
      expect(result.viewerType).toBe('CodeEditor');
      expect(result.path).toBe('/test.txt');
    });

    test('should handle different resource types in ready events', () => {
      const imageData = {
        path: '/image.png',
        type: 'image', 
        extension: '.png',
        handle: { __isResourceHandle: true }
      };
      
      const result = handler.handleResourceReady(imageData);
      expect(result.viewerType).toBe('ImageViewer');
    });
  });
});