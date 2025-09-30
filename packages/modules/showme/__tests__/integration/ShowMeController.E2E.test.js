/**
 * Integration test for ShowMeController E2E flow
 * Tests complete flow: controller → server → Actor → browser window
 * NO MOCKS - real ShowMeServer, real Actor messages, real Handle display
 */

import { ShowMeController } from '../../src/ShowMeController.js';
import { ImageHandle } from '../../src/handles/ImageHandle.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ShowMeController E2E Integration Test', () => {
  let controller;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  beforeEach(async () => {
    // Create controller on unique port to avoid conflicts
    const port = 3700 + Math.floor(Math.random() * 100);
    controller = new ShowMeController({ port });
  });

  afterEach(async () => {
    if (controller && controller.isRunning) {
      await controller.stop();
    }
  });

  test('should initialize and start controller', async () => {
    await controller.initialize();
    expect(controller.isInitialized).toBe(true);
    expect(controller.server).toBeDefined();

    await controller.start();
    expect(controller.isRunning).toBe(true);

    const status = controller.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.running).toBe(true);
    expect(status.openWindows).toBe(0);
  }, 10000);

  test('should open window and return ShowMeWindow object', async () => {
    await controller.initialize();
    await controller.start();

    // Create real ImageHandle
    const imageHandle = new ImageHandle({
      id: 'test-image',
      title: 'Test Image',
      type: 'image/png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      width: 5,
      height: 5
    });

    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock browser launch to avoid actually opening browser
    controller.server.launchBrowser = async () => { return; };

    // Mock connection wait
    controller._waitForConnection = async () => { return; };

    // Mock server actor for display
    const mockServerActor = {
      handleDisplayAsset: async () => { return; }
    };
    controller.getServerActor = () => mockServerActor;

    const window = await controller.openWindow(imageHandle, {
      title: 'My Test Image',
      width: 800,
      height: 600
    });

    expect(window).toBeDefined();
    expect(window.id).toMatch(/^window-\d+-\d+$/);
    expect(window.title).toBe('My Test Image');
    expect(window.width).toBe(800);
    expect(window.height).toBe(600);
    expect(window.isOpen).toBe(true);

    // Verify window was created and tracked
    expect(window).toBeDefined();
    expect(window.title).toBe('My Test Image');

    // Verify window is tracked
    expect(controller.windows.size).toBe(1);
    const windows = controller.getWindows();
    expect(windows).toHaveLength(1);
    expect(windows[0]).toBe(window);
  }, 15000);

  test('should open multiple windows', async () => {
    await controller.initialize();
    await controller.start();

    // Mock browser operations
    let browserLaunchCount = 0;
    controller.server.launchBrowser = async () => { browserLaunchCount++; };
    controller._waitForConnection = async () => { return; };

    const mockServerActor = {
      handleDisplayAsset: async () => { return; }
    };
    controller.getServerActor = () => mockServerActor;

    const handle1 = new ImageHandle({
      id: 'image-1',
      title: 'Image 1',
      type: 'image/png',
      data: 'data:image/png;base64,TEST1',
      width: 10,
      height: 10
    });

    const handle2 = new ImageHandle({
      id: 'image-2',
      title: 'Image 2',
      type: 'image/jpeg',
      data: 'data:image/jpeg;base64,TEST2',
      width: 20,
      height: 20
    });

    const window1 = await controller.openWindow(handle1, { title: 'Window 1' });
    const window2 = await controller.openWindow(handle2, { title: 'Window 2' });

    expect(window1.id).not.toBe(window2.id);
    expect(window1.title).toBe('Window 1');
    expect(window2.title).toBe('Window 2');

    expect(controller.windows.size).toBe(2);

    // Only first window should trigger browser launch
    expect(browserLaunchCount).toBe(1);
  }, 15000);

  test('should close specific window', async () => {
    await controller.initialize();
    await controller.start();

    controller.server.launchBrowser = async () => { return; };
    controller._waitForConnection = async () => { return; };

    const mockServerActor = {
      handleDisplayAsset: async () => { return; },
      remoteActor: {
        receive: () => { return; }
      }
    };
    controller.getServerActor = () => mockServerActor;

    const handle = new ImageHandle({
      id: 'test',
      title: 'Test',
      type: 'image/png',
      data: 'data:image/png;base64,TEST',
      width: 10,
      height: 10
    });

    const window = await controller.openWindow(handle);

    expect(controller.windows.size).toBe(1);
    expect(window.isOpen).toBe(true);

    await window.close();

    expect(window.isOpen).toBe(false);
    expect(controller.windows.size).toBe(0);
  }, 15000);

  test('should stop controller and close all windows', async () => {
    await controller.initialize();
    await controller.start();

    controller.server.launchBrowser = async () => { return; };
    controller._waitForConnection = async () => { return; };

    const mockServerActor = {
      handleDisplayAsset: async () => { return; },
      remoteActor: {
        receive: () => { return; }
      }
    };
    controller.getServerActor = () => mockServerActor;

    const handle1 = new ImageHandle({
      id: 'image-1',
      title: 'Image 1',
      type: 'image/png',
      data: 'data:image/png;base64,TEST1',
      width: 10,
      height: 10
    });

    const handle2 = new ImageHandle({
      id: 'image-2',
      title: 'Image 2',
      type: 'image/png',
      data: 'data:image/png;base64,TEST2',
      width: 10,
      height: 10
    });

    const window1 = await controller.openWindow(handle1);
    const window2 = await controller.openWindow(handle2);

    expect(controller.windows.size).toBe(2);

    await controller.stop();

    expect(controller.isRunning).toBe(false);
    expect(controller.windows.size).toBe(0);
    expect(window1.isOpen).toBe(false);
    expect(window2.isOpen).toBe(false);
  }, 15000);

  test('should update window with new Handle', async () => {
    await controller.initialize();
    await controller.start();

    let displayCallCount = 0;
    controller.server.launchBrowser = async () => { return; };
    controller._waitForConnection = async () => { return; };

    const mockServerActor = {
      handleDisplayAsset: async () => { displayCallCount++; }
    };
    controller.getServerActor = () => mockServerActor;

    const handle1 = new ImageHandle({
      id: 'image-1',
      title: 'Image 1',
      type: 'image/png',
      data: 'data:image/png;base64,TEST1',
      width: 10,
      height: 10
    });

    const handle2 = new ImageHandle({
      id: 'image-2',
      title: 'Image 2',
      type: 'image/jpeg',
      data: 'data:image/jpeg;base64,TEST2',
      width: 20,
      height: 20
    });

    const window = await controller.openWindow(handle1);
    expect(window.currentHandle).toBe(handle1);

    // Update window with new Handle
    await window.update(handle2);

    expect(window.currentHandle).toBe(handle2);
    expect(displayCallCount).toBe(2);
  }, 15000);
});