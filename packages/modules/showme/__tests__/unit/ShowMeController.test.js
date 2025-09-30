/**
 * Unit tests for ShowMeController
 * Tests basic construction and properties
 * Real behavior tested in integration tests
 */

import { ShowMeController } from '../../src/ShowMeController.js';

describe('ShowMeController', () => {
  test('should create controller with default options', () => {
    const controller = new ShowMeController();

    expect(controller.port).toBe(3700);
    expect(controller.autoLaunch).toBe(false);
    expect(controller.isInitialized).toBe(false);
    expect(controller.isRunning).toBe(false);
    expect(controller.server).toBeNull();
    expect(controller.windows).toBeInstanceOf(Map);
    expect(controller.windows.size).toBe(0);
    expect(controller.windowCounter).toBe(0);
  });

  test('should create controller with custom port', () => {
    const controller = new ShowMeController({ port: 4000 });
    expect(controller.port).toBe(4000);
  });

  test('should create controller with custom autoLaunch', () => {
    const controller = new ShowMeController({ autoLaunch: true });
    expect(controller.autoLaunch).toBe(true);
  });

  test('should create controller with custom browser options', () => {
    const controller = new ShowMeController({
      browserOptions: {
        app: false,
        width: 1920,
        height: 1080
      }
    });

    expect(controller.browserOptions.app).toBe(false);
    expect(controller.browserOptions.width).toBe(1920);
    expect(controller.browserOptions.height).toBe(1080);
  });

  test('getWindows() should return empty array initially', () => {
    const controller = new ShowMeController();
    const windows = controller.getWindows();

    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBe(0);
  });

  test('getWindow() should return null for non-existent window', () => {
    const controller = new ShowMeController();
    const window = controller.getWindow('non-existent-id');

    expect(window).toBeNull();
  });

  test('getServerActor() should return null if not initialized', () => {
    const controller = new ShowMeController();
    const actor = controller.getServerActor();

    expect(actor).toBeNull();
  });

  test('getStatus() should return correct initial status', () => {
    const controller = new ShowMeController({ port: 3800 });
    const status = controller.getStatus();

    expect(status).toEqual({
      initialized: false,
      running: false,
      port: 3800,
      openWindows: 0,
      url: null
    });
  });

  test('_removeWindow() should remove window from tracking', () => {
    const controller = new ShowMeController();

    // Manually add windows to test removal
    controller.windows.set('window-1', { id: 'window-1' });
    controller.windows.set('window-2', { id: 'window-2' });

    expect(controller.windows.size).toBe(2);

    controller._removeWindow('window-1');

    expect(controller.windows.size).toBe(1);
    expect(controller.windows.has('window-1')).toBe(false);
    expect(controller.windows.has('window-2')).toBe(true);
  });
});