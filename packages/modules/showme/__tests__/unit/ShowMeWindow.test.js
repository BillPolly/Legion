/**
 * Unit tests for ShowMeWindow
 */

import { ShowMeWindow } from '../../src/ShowMeWindow.js';

// Simple mock function creator
const createMockFn = (returnValue) => {
  const fn = function(...args) {
    fn.calls.push(args);
    fn.callCount++;
    return returnValue;
  };
  fn.calls = [];
  fn.callCount = 0;
  return fn;
};

describe('ShowMeWindow', () => {
  let mockController;
  let window;
  let mockServerActor;

  beforeEach(() => {
    // Create mock server actor
    mockServerActor = {
      handleDisplayAsset: createMockFn(Promise.resolve()),
      remoteActor: {
        receive: createMockFn()
      }
    };

    // Create mock controller
    mockController = {
      port: 3700,
      getServerActor: createMockFn(mockServerActor),
      _removeWindow: createMockFn()
    };

    window = new ShowMeWindow('test-window-1', mockController, {
      title: 'Test Window',
      width: 800,
      height: 600
    });
  });

  test('should create window with correct properties', () => {
    expect(window.id).toBe('test-window-1');
    expect(window.title).toBe('Test Window');
    expect(window.width).toBe(800);
    expect(window.height).toBe(600);
    expect(window.isOpen).toBe(true);
    expect(window.currentHandle).toBeNull();
    expect(window.url).toBe('http://localhost:3700/showme?windowId=test-window-1');
  });

  test('should use default options when not provided', () => {
    const defaultWindow = new ShowMeWindow('test-2', mockController);
    expect(defaultWindow.title).toBe('ShowMe Window');
    expect(defaultWindow.width).toBe(1000);
    expect(defaultWindow.height).toBe(700);
  });

  test('update() should display Handle in window', async () => {
    const mockHandle = {
      resourceType: 'image',
      getData: createMockFn()
    };

    await window.update(mockHandle);

    expect(mockServerActor.handleDisplayAsset.callCount).toBe(1);
    const call = mockServerActor.handleDisplayAsset.calls[0][0];
    expect(call.assetId).toMatch(/window-test-window-1/);
    expect(call.assetType).toBe('image');
    expect(call.title).toBe('Test Window');
    expect(call.asset).toBe(mockHandle);
    expect(window.currentHandle).toBe(mockHandle);
  });

  test('update() should throw error if window is closed', async () => {
    window.isOpen = false;
    const mockHandle = { resourceType: 'image' };

    await expect(window.update(mockHandle)).rejects.toThrow('Cannot update closed window test-window-1');
  });

  test('update() should throw error if server actor not available', async () => {
    mockController.getServerActor = createMockFn(null);
    const mockHandle = { resourceType: 'image' };

    await expect(window.update(mockHandle)).rejects.toThrow('ShowMeServer not initialized');
  });

  test('setTitle() should update window title', async () => {
    await window.setTitle('New Title');

    expect(window.title).toBe('New Title');
    expect(mockServerActor.remoteActor.receive.callCount).toBe(1);
    expect(mockServerActor.remoteActor.receive.calls[0]).toEqual(['set-title', { title: 'New Title' }]);
  });

  test('setTitle() should throw error if window is closed', async () => {
    window.isOpen = false;

    await expect(window.setTitle('New Title')).rejects.toThrow('Cannot set title on closed window test-window-1');
  });

  test('close() should close window and notify controller', async () => {
    await window.close();

    expect(window.isOpen).toBe(false);
    expect(window.currentHandle).toBeNull();
    expect(mockServerActor.remoteActor.receive.callCount).toBe(1);
    expect(mockServerActor.remoteActor.receive.calls[0]).toEqual(['close-window', { windowId: 'test-window-1' }]);
    expect(mockController._removeWindow.callCount).toBe(1);
    expect(mockController._removeWindow.calls[0]).toEqual(['test-window-1']);
  });

  test('close() should not throw error if already closed', async () => {
    await window.close();
    await expect(window.close()).resolves.not.toThrow();
    expect(window.isOpen).toBe(false);
  });

  test('getHandle() should return current Handle', () => {
    const mockHandle = { resourceType: 'image' };
    window.currentHandle = mockHandle;

    expect(window.getHandle()).toBe(mockHandle);
  });

  test('getHandle() should return null if no Handle displayed', () => {
    expect(window.getHandle()).toBeNull();
  });

  test('getState() should return window state', () => {
    const state = window.getState();

    expect(state).toEqual({
      id: 'test-window-1',
      title: 'Test Window',
      width: 800,
      height: 600,
      isOpen: true,
      url: 'http://localhost:3700/showme?windowId=test-window-1',
      hasHandle: false
    });
  });

  test('getState() should reflect hasHandle when Handle is present', async () => {
    const mockHandle = { resourceType: 'image' };
    await window.update(mockHandle);

    const state = window.getState();
    expect(state.hasHandle).toBe(true);
  });
});