/**
 * Unit tests for ResourceWindowManager
 * TDD: Test-first implementation of window creation with appropriate viewers
 */

import { jest } from '@jest/globals';

describe('ResourceWindowManager', () => {
  let manager;
  let mockContainer;
  let mockWindow;
  let mockCodeEditor;
  let mockImageViewer;
  
  beforeEach(async () => {
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn()
    };
    
    // Mock components that would be created
    mockWindow = {
      contentElement: { appendChild: jest.fn() },
      setTitle: jest.fn(),
      show: jest.fn(),
      close: jest.fn(),
      destroy: jest.fn()
    };
    
    mockCodeEditor = {
      setContent: jest.fn(),
      getContent: jest.fn(),
      destroy: jest.fn()
    };
    
    mockImageViewer = {
      loadImage: jest.fn(),
      destroy: jest.fn()
    };
    
    // Mock component factories
    global.Window = { create: jest.fn(() => mockWindow) };
    global.CodeEditor = { create: jest.fn(() => mockCodeEditor) };
    global.ImageViewer = { create: jest.fn(() => mockImageViewer) };
    
    const { ResourceWindowManager } = await import('../../../src/client/components/ResourceWindowManager.js');
    manager = new ResourceWindowManager(mockContainer);
  });
  
  afterEach(() => {
    // Clean up global mocks
    delete global.Window;
    delete global.CodeEditor; 
    delete global.ImageViewer;
  });

  describe('Initialization', () => {
    test('should initialize with container and empty window tracking', () => {
      expect(manager.container).toBe(mockContainer);
      expect(manager.windows).toBeDefined();
      expect(manager.windows instanceof Map).toBe(true);
      expect(manager.typeRegistry).toBeDefined();
    });
  });

  describe('Window Creation for Files', () => {
    test('should create window with CodeEditor for file handle', async () => {
      const mockFileHandle = {
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        __handleId: 'file-123',
        read: jest.fn().mockResolvedValue('file content')
      };
      
      const eventData = {
        path: '/test.txt',
        type: 'file',
        extension: '.txt',
        handle: mockFileHandle
      };
      
      await manager.handleResourceReady(eventData);
      
      // Should create window
      expect(global.Window.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dom: mockContainer,
          title: 'test.txt',
          width: 800,
          height: 600
        })
      );
      
      // Should create CodeEditor
      expect(global.CodeEditor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dom: mockWindow.contentElement,
          content: 'file content',
          language: 'javascript'
        })
      );
      
      // Should track the window
      expect(manager.windows.has('/test.txt')).toBe(true);
    });

    test('should detect correct language for different file types', async () => {
      const jsFileHandle = { __isResourceHandle: true, read: jest.fn().mockResolvedValue('const x = 1;') };
      
      await manager.handleResourceReady({
        path: '/script.js',
        type: 'file', 
        extension: '.js',
        handle: jsFileHandle
      });
      
      expect(global.CodeEditor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'javascript'
        })
      );
    });

    test('should handle file write operations through handle', async () => {
      const fileHandle = {
        __isResourceHandle: true,
        read: jest.fn().mockResolvedValue('content'),
        write: jest.fn()
      };
      
      await manager.handleResourceReady({
        path: '/editable.txt',
        type: 'file',
        extension: '.txt',
        handle: fileHandle
      });
      
      // CodeEditor should be configured with write callback
      const codeEditorCall = global.CodeEditor.create.mock.calls[0][0];
      expect(codeEditorCall.onContentChange).toBeDefined();
      
      // Test the callback works
      await codeEditorCall.onContentChange('new content');
      expect(fileHandle.write).toHaveBeenCalledWith('new content');
    });
  });

  describe('Window Creation for Images', () => {
    test('should create window with ImageViewer for image handle', async () => {
      const mockImageHandle = {
        __isResourceHandle: true,
        __resourceType: 'ImageHandle',
        getUrl: jest.fn().mockResolvedValue('data:image/png;base64,iVBOR...')
      };
      
      const eventData = {
        path: '/photo.png',
        type: 'image',
        extension: '.png', 
        handle: mockImageHandle
      };
      
      await manager.handleResourceReady(eventData);
      
      // Should create window
      expect(global.Window.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'photo.png'
        })
      );
      
      // Should create ImageViewer
      expect(global.ImageViewer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dom: mockWindow.contentElement,
          imageData: 'data:image/png;base64,iVBOR...',
          showControls: true
        })
      );
    });
  });

  describe('Window Management', () => {
    test('should close existing window when opening same resource', async () => {
      const existingWindow = { close: jest.fn(), destroy: jest.fn() };
      const existingViewer = { destroy: jest.fn() };
      
      // Set up existing window properly
      manager.windows.set('/test.txt', { 
        window: existingWindow, 
        viewer: existingViewer,
        handle: {},
        type: 'file'
      });
      
      const newHandle = {
        __isResourceHandle: true,
        read: jest.fn().mockResolvedValue('content')
      };
      
      await manager.handleResourceReady({
        path: '/test.txt',
        type: 'file',
        extension: '.txt', 
        handle: newHandle
      });
      
      expect(existingWindow.destroy).toHaveBeenCalled();
      expect(existingViewer.destroy).toHaveBeenCalled();
    });

    test('should clean up window when closed', () => {
      const windowInstance = { close: jest.fn(), destroy: jest.fn() };
      const editorInstance = { destroy: jest.fn() };
      
      manager.windows.set('/test.txt', { 
        window: windowInstance,
        viewer: editorInstance
      });
      
      manager.closeWindow('/test.txt');
      
      expect(windowInstance.destroy).toHaveBeenCalled();
      expect(editorInstance.destroy).toHaveBeenCalled();
      expect(manager.windows.has('/test.txt')).toBe(false);
    });
  });
});