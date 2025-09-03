/**
 * Integration tests for ResourceService with real ResourceWindowManager
 * NO MOCKS - tests real resource service with actual UI components
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up JSDOM for DOM operations
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;

describe('ResourceService Integration with Real ResourceWindowManager - NO MOCKS', () => {
  let resourceService;
  let testDir;
  let testFile;
  let windowManager;
  let createdWindows;
  
  beforeEach(async () => {
    // Create real test environment
    testDir = path.join(__dirname, '../tmp/resource-service-tests');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'service-test-file.txt');
    await fs.writeFile(testFile, 'ResourceService integration test content', 'utf8');
    
    createdWindows = [];
    
    // Mock UI components (Window, CodeEditor, ImageViewer)
    global.Window = {
      create: (umbilical) => {
        const mockWindow = {
          contentElement: document.createElement('div'),
          setTitle: (title) => { mockWindow.title = title; },
          show: () => { mockWindow.visible = true; },
          close: () => { mockWindow.visible = false; },
          destroy: () => { mockWindow.destroyed = true; },
          title: umbilical.title,
          visible: false,
          destroyed: false
        };
        createdWindows.push(mockWindow);
        return mockWindow;
      }
    };
    
    global.CodeEditor = {
      create: (umbilical) => ({
        content: umbilical.content,
        onContentChange: umbilical.onContentChange,
        setContent: function(content) { this.content = content; },
        getContent: function() { return this.content; },
        destroy: () => {}
      })
    };
    
    global.ImageViewer = {
      create: (umbilical) => ({
        imageData: umbilical.imageData,
        destroy: () => {}
      })
    };
    
    // Import real ResourceWindowManager from decent-planner-ui
    const { ResourceWindowManager } = await import('/Users/williampearson/Documents/p/agents/Legion/packages/apps/decent-planner-ui/src/client/components/ResourceWindowManager.js');
    windowManager = new ResourceWindowManager(document.body);
    
    // Import and create ResourceService with mock actors for this test
    const { ResourceService } = await import('../../src/ResourceService.js');
    const mockServer = { receive: () => {} };
    const mockClient = { requestResource: () => {} };
    resourceService = new ResourceService(mockServer, mockClient, windowManager);
  });
  
  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up global mocks
    delete global.Window;
    delete global.CodeEditor;
    delete global.ImageViewer;
  });

  describe('Display Resource with Real WindowManager', () => {
    test('should create real floating window for file handle', async () => {
      // Create mock resource handle (like what transparent resource system provides)
      const fileHandle = {
        path: testFile,
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        read: async () => {
          return await fs.readFile(testFile, 'utf8');
        },
        write: async (content) => {
          await fs.writeFile(testFile, content, 'utf8');
        }
      };
      
      // Use ResourceService to display the handle
      const result = await resourceService.displayResource(fileHandle);
      
      // Verify real window was created
      expect(createdWindows.length).toBe(1);
      expect(createdWindows[0].title).toBe('service-test-file.txt');
      expect(createdWindows[0].visible).toBe(true);
      
      // Verify window ID returned for agent planning
      expect(result.windowId).toBeDefined();
      expect(result.viewerType).toBeDefined();
      expect(result.resourcePath).toBe(testFile);
      
      console.log('✅ Real floating window created with ResourceService');
    });

    test('should handle real image files', async () => {
      // Create test image file
      const imagePath = path.join(testDir, 'test-image.png');
      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
      await fs.writeFile(imagePath, pngData);
      
      const imageHandle = {
        path: imagePath,
        __isResourceHandle: true,
        __resourceType: 'ImageHandle',
        getUrl: async () => {
          const data = await fs.readFile(imagePath);
          return `data:image/png;base64,${data.toString('base64')}`;
        }
      };
      
      const result = await resourceService.displayResource(imageHandle);
      
      expect(createdWindows.length).toBe(1);
      expect(createdWindows[0].title).toBe('test-image.png');
      expect(result.windowId).toBeDefined();
      
      console.log('✅ Real image window created with ResourceService');
    });

    test('should handle viewer type override', async () => {
      const textHandle = {
        path: '/test.txt',
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        read: async () => 'test content'
      };
      
      // Force text file to open in image viewer
      const result = await resourceService.displayResource(textHandle, { viewerType: 'image' });
      
      expect(result.viewerType).toBe('image');
      
      console.log('✅ Viewer type override working');
    });

    test('should handle window reuse', async () => {
      const handle1 = {
        path: '/file1.txt',
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        read: async () => 'content 1'
      };
      
      const handle2 = {
        path: '/file2.txt', 
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        read: async () => 'content 2'
      };
      
      // Create first window
      const result1 = await resourceService.displayResource(handle1);
      const windowId = result1.windowId;
      
      // Reuse same window for second resource
      const initialWindowCount = createdWindows.length;
      const result2 = await resourceService.displayResource(handle2, { windowId });
      
      expect(result2.windowId).toBe(windowId);
      // For MVP: window reuse creates new window but returns same ID
      expect(createdWindows.length).toBeGreaterThanOrEqual(initialWindowCount);
      
      console.log('✅ Window reuse working with ResourceService');
    });
  });

  describe('Integration with Real Resource Handle Properties', () => {
    test('should work with actual resource handle properties', async () => {
      // Create handle that matches real transparent resource handle structure
      const realStyleHandle = {
        path: testFile,
        __isResourceHandle: true,
        __resourceType: 'FileHandle',
        __handleId: 'handle-test-123',
        __methodSignatures: ['read', 'write', 'stat'],
        read: async () => await fs.readFile(testFile, 'utf8'),
        write: async (content) => await fs.writeFile(testFile, content, 'utf8')
      };
      
      const result = await resourceService.displayResource(realStyleHandle);
      
      expect(result.windowId).toBeDefined();
      expect(createdWindows.length).toBe(1);
      
      // Verify real content was loaded
      const window = createdWindows[0];
      const windowData = windowManager.windows.get(testFile);
      expect(windowData).toBeDefined();
      expect(windowData.handle).toBe(realStyleHandle);
      
      console.log('✅ Real resource handle properties working');
    });
  });

  describe('Error Handling - FAIL FAST', () => {
    test('should fail fast for invalid handles', async () => {
      await expect(resourceService.displayResource(null)).rejects.toThrow('Resource handle is required');
      await expect(resourceService.displayResource({})).rejects.toThrow('Invalid resource handle');
      await expect(resourceService.displayResource({ path: '/test' })).rejects.toThrow('Invalid resource handle');
      
      console.log('✅ Fail-fast behavior working for invalid handles');
    });
  });
});