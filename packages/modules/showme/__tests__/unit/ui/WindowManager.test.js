/**
 * Unit Tests for WindowManager
 * 
 * Tests the core window lifecycle management system for floating windows
 * NO MOCKS - Tests real window management functionality
 * 
 * @jest-environment jsdom
 */

import { WindowManager } from '../../../src/ui/WindowManager.js';

describe('WindowManager', () => {
  let windowManager;

  beforeEach(() => {
    // Setup DOM environment for tests
    document.body.innerHTML = '';
    windowManager = new WindowManager();
  });

  afterEach(() => {
    // Clean up all windows after each test
    windowManager.closeAllWindows();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should initialize with empty window registry', () => {
      expect(windowManager.getActiveWindows()).toEqual([]);
      expect(windowManager.getWindowCount()).toBe(0);
    });

    test('should initialize with default configuration', () => {
      const config = windowManager.getConfiguration();
      
      expect(config).toHaveProperty('defaultWidth');
      expect(config).toHaveProperty('defaultHeight');
      expect(config).toHaveProperty('zIndexBase');
      expect(config.defaultWidth).toBe(800);
      expect(config.defaultHeight).toBe(600);
      expect(config.zIndexBase).toBe(1000);
    });
  });

  describe('createWindow', () => {
    test('should create window with basic parameters', () => {
      const window = windowManager.createWindow({
        id: 'test-window-1',
        title: 'Test Window',
        content: '<p>Test content</p>'
      });

      expect(window).toHaveProperty('id', 'test-window-1');
      expect(window).toHaveProperty('title', 'Test Window');
      expect(window).toHaveProperty('element');
      expect(window.element).toBeInstanceOf(HTMLElement);
      expect(windowManager.getWindowCount()).toBe(1);
    });

    test('should create window with custom dimensions', () => {
      const window = windowManager.createWindow({
        id: 'sized-window',
        title: 'Sized Window',
        content: '<p>Content</p>',
        width: 1200,
        height: 800
      });

      expect(window.width).toBe(1200);
      expect(window.height).toBe(800);
      expect(window.element.style.width).toBe('1200px');
      expect(window.element.style.height).toBe('800px');
    });

    test('should create window with custom position', () => {
      const window = windowManager.createWindow({
        id: 'positioned-window',
        title: 'Positioned Window',  
        content: '<p>Content</p>',
        x: 100,
        y: 200
      });

      expect(window.x).toBe(100);
      expect(window.y).toBe(200);
      expect(window.element.style.left).toBe('100px');
      expect(window.element.style.top).toBe('200px');
    });

    test('should auto-generate ID if not provided', () => {
      const window = windowManager.createWindow({
        title: 'Auto ID Window',
        content: '<p>Content</p>'
      });

      expect(window.id).toBeTruthy();
      expect(window.id).toMatch(/^window_\d+_[a-z0-9]+$/);
    });

    test('should set proper z-index for stacking', () => {
      const window1 = windowManager.createWindow({
        id: 'window-1',
        title: 'First Window',
        content: '<p>First</p>'
      });

      const window2 = windowManager.createWindow({
        id: 'window-2', 
        title: 'Second Window',
        content: '<p>Second</p>'
      });

      expect(window1.zIndex).toBe(1000);
      expect(window2.zIndex).toBe(1001);
      expect(window1.element.style.zIndex).toBe('1000');
      expect(window2.element.style.zIndex).toBe('1001');
    });

    test('should make newly created window the active window', () => {
      const window1 = windowManager.createWindow({
        id: 'window-1',
        title: 'First Window', 
        content: '<p>First</p>'
      });

      expect(windowManager.getActiveWindow()).toBe(window1);

      const window2 = windowManager.createWindow({
        id: 'window-2',
        title: 'Second Window',
        content: '<p>Second</p>' 
      });

      expect(windowManager.getActiveWindow()).toBe(window2);
    });

    test('should throw error for duplicate window ID', () => {
      windowManager.createWindow({
        id: 'duplicate-test',
        title: 'First Window',
        content: '<p>First</p>'
      });

      expect(() => {
        windowManager.createWindow({
          id: 'duplicate-test',
          title: 'Second Window', 
          content: '<p>Second</p>'
        });
      }).toThrow('Window with ID duplicate-test already exists');
    });
  });

  describe('window retrieval', () => {
    beforeEach(() => {
      // Create test windows
      windowManager.createWindow({
        id: 'test-1',
        title: 'Test Window 1',
        content: '<p>Content 1</p>'
      });

      windowManager.createWindow({
        id: 'test-2', 
        title: 'Test Window 2',
        content: '<p>Content 2</p>'
      });
    });

    test('should get window by ID', () => {
      const window = windowManager.getWindow('test-1');
      
      expect(window).toBeTruthy();
      expect(window.id).toBe('test-1');
      expect(window.title).toBe('Test Window 1');
    });

    test('should return null for non-existent window ID', () => {
      const window = windowManager.getWindow('non-existent');
      expect(window).toBeNull();
    });

    test('should get all active windows', () => {
      const windows = windowManager.getActiveWindows();
      
      expect(windows).toHaveLength(2);
      expect(windows.map(w => w.id)).toEqual(['test-1', 'test-2']);
    });

    test('should get correct window count', () => {
      expect(windowManager.getWindowCount()).toBe(2);
    });

    test('should check window existence', () => {
      expect(windowManager.hasWindow('test-1')).toBe(true);
      expect(windowManager.hasWindow('test-2')).toBe(true);
      expect(windowManager.hasWindow('non-existent')).toBe(false);
    });
  });

  describe('window focus and activation', () => {
    beforeEach(() => {
      windowManager.createWindow({
        id: 'focus-test-1',
        title: 'Focus Test 1',
        content: '<p>Content 1</p>'
      });

      windowManager.createWindow({
        id: 'focus-test-2',
        title: 'Focus Test 2', 
        content: '<p>Content 2</p>'
      });
    });

    test('should focus window and bring to front', () => {
      const window1 = windowManager.getWindow('focus-test-1');
      const window2 = windowManager.getWindow('focus-test-2');
      
      // Window 2 should be active initially (most recently created)
      expect(windowManager.getActiveWindow()).toBe(window2);
      
      // Focus window 1
      windowManager.focusWindow('focus-test-1');
      
      expect(windowManager.getActiveWindow()).toBe(window1);
      expect(window1.zIndex).toBeGreaterThan(window2.zIndex);
    });

    test('should handle focus of non-existent window gracefully', () => {
      expect(() => {
        windowManager.focusWindow('non-existent');
      }).not.toThrow();
      
      // Active window should remain unchanged
      const activeWindow = windowManager.getActiveWindow();
      expect(activeWindow.id).toBe('focus-test-2');
    });
  });

  describe('window closing', () => {
    beforeEach(() => {
      windowManager.createWindow({
        id: 'close-test-1',
        title: 'Close Test 1',
        content: '<p>Content 1</p>'
      });

      windowManager.createWindow({
        id: 'close-test-2',
        title: 'Close Test 2',
        content: '<p>Content 2</p>'
      });
    });

    test('should close window by ID', () => {
      expect(windowManager.getWindowCount()).toBe(2);
      
      const closed = windowManager.closeWindow('close-test-1');
      
      expect(closed).toBe(true);
      expect(windowManager.getWindowCount()).toBe(1);
      expect(windowManager.hasWindow('close-test-1')).toBe(false);
      expect(windowManager.hasWindow('close-test-2')).toBe(true);
    });

    test('should handle closing non-existent window', () => {
      const closed = windowManager.closeWindow('non-existent');
      
      expect(closed).toBe(false);
      expect(windowManager.getWindowCount()).toBe(2);
    });

    test('should remove window element from DOM when closed', () => {
      const window = windowManager.getWindow('close-test-1');
      const element = window.element;
      
      // Element should be in document
      expect(document.body.contains(element)).toBe(true);
      
      windowManager.closeWindow('close-test-1');
      
      // Element should be removed from document
      expect(document.body.contains(element)).toBe(false);
    });

    test('should update active window when active window is closed', () => {
      // Focus first window, then close it
      windowManager.focusWindow('close-test-1');
      expect(windowManager.getActiveWindow().id).toBe('close-test-1');
      
      windowManager.closeWindow('close-test-1');
      
      // Active window should switch to remaining window
      expect(windowManager.getActiveWindow().id).toBe('close-test-2');
    });

    test('should set active window to null when last window is closed', () => {
      windowManager.closeWindow('close-test-1');
      windowManager.closeWindow('close-test-2');
      
      expect(windowManager.getActiveWindow()).toBeNull();
      expect(windowManager.getWindowCount()).toBe(0);
    });

    test('should close all windows', () => {
      expect(windowManager.getWindowCount()).toBe(2);
      
      windowManager.closeAllWindows();
      
      expect(windowManager.getWindowCount()).toBe(0);
      expect(windowManager.getActiveWindow()).toBeNull();
      expect(windowManager.getActiveWindows()).toEqual([]);
    });
  });

  describe('window positioning', () => {
    test('should auto-position windows to avoid overlap', () => {
      const window1 = windowManager.createWindow({
        id: 'pos-1',
        title: 'Position Test 1',
        content: '<p>Content 1</p>'
      });

      const window2 = windowManager.createWindow({
        id: 'pos-2', 
        title: 'Position Test 2',
        content: '<p>Content 2</p>'
      });

      const window3 = windowManager.createWindow({
        id: 'pos-3',
        title: 'Position Test 3', 
        content: '<p>Content 3</p>'
      });

      // Windows should be offset to avoid exact overlap
      expect(window1.x).toBe(50);   // Default starting position
      expect(window1.y).toBe(50);
      
      expect(window2.x).toBe(80);   // Offset by 30px
      expect(window2.y).toBe(80);
      
      expect(window3.x).toBe(110);  // Offset by another 30px
      expect(window3.y).toBe(110);
    });

    test('should move window to new position', () => {
      const window = windowManager.createWindow({
        id: 'move-test',
        title: 'Move Test',
        content: '<p>Content</p>'
      });

      windowManager.moveWindow('move-test', 300, 400);

      expect(window.x).toBe(300);
      expect(window.y).toBe(400);
      expect(window.element.style.left).toBe('300px');
      expect(window.element.style.top).toBe('400px');
    });

    test('should resize window to new dimensions', () => {
      const window = windowManager.createWindow({
        id: 'resize-test',
        title: 'Resize Test',
        content: '<p>Content</p>'
      });

      windowManager.resizeWindow('resize-test', 1000, 700);

      expect(window.width).toBe(1000);
      expect(window.height).toBe(700);
      expect(window.element.style.width).toBe('1000px');
      expect(window.element.style.height).toBe('700px');
    });
  });

  describe('error handling', () => {
    test('should handle invalid window creation parameters gracefully', () => {
      expect(() => {
        windowManager.createWindow({});
      }).toThrow('Window title is required');

      expect(() => {
        windowManager.createWindow({
          title: 'Test Window'
          // Missing content
        });
      }).toThrow('Window content is required');
    });

    test('should handle invalid positioning parameters', () => {
      const window = windowManager.createWindow({
        id: 'error-test',
        title: 'Error Test',
        content: '<p>Content</p>'
      });

      // Should not throw for invalid window ID
      expect(() => {
        windowManager.moveWindow('non-existent', 100, 100);
      }).not.toThrow();

      expect(() => {
        windowManager.resizeWindow('non-existent', 800, 600);
      }).not.toThrow();
    });
  });
});