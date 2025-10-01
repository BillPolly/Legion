/**
 * Integration test for /show command
 * Tests end-to-end command execution with real Handle display
 * NO MOCKS - real CLI, real Handle, real ShowMe
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImageHandle } from '@legion/showme/src/handles/ImageHandle.js';

describe('ShowCommand Integration Test', () => {
  let resourceManager;
  let cli;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  afterEach(async () => {
    if (cli) {
      await cli.shutdown();
      cli = null;
    }
  });

  test('should execute /show command with ImageHandle', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    // Create a real ImageHandle
    const imageHandle = new ImageHandle({
      id: 'test-image',
      title: 'Test Image',
      type: 'image/png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      width: 5,
      height: 5
    });

    // Get the show command
    const showCommand = cli.commandProcessor.getCommand('show');
    expect(showCommand).toBeDefined();

    // Mock browser launch and connection for testing
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };

    // Mock server actor for display
    const mockServerActor = {
      handleDisplayAsset: async () => { return; }
    };
    cli.showme.getServerActor = () => mockServerActor;

    // Mock ResourceManager.createHandleFromURI to return our test handle
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute the command
      const result = await cli.commandProcessor.execute('/show legion://test/image');

      // Verify result
      expect(result.success).toBe(true);
      expect(result.message).toContain('Displaying');
      expect(result.window).toBeDefined();
      expect(result.window.isOpen).toBe(true);

      // Verify window was tracked
      const windows = cli.showme.getWindows();
      expect(windows.length).toBe(1);
      expect(windows[0]).toBe(result.window);

    } finally {
      // Restore original method
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 15000);

  test('should execute /show command with options', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    const imageHandle = new ImageHandle({
      id: 'test-image-2',
      title: 'Test Image 2',
      type: 'image/png',
      data: 'data:image/png;base64,TEST',
      width: 10,
      height: 10
    });

    // Mock browser launch and connection for testing
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };

    // Mock server actor for display
    const mockServerActor = {
      handleDisplayAsset: async () => { return; }
    };
    cli.showme.getServerActor = () => mockServerActor;

    // Mock createHandleFromURI
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute with options (MVP: simple parsing, no quote handling)
      const result = await cli.commandProcessor.execute(
        '/show legion://test/image --width 1200 --height 900 --title MyTestImage'
      );

      expect(result.success).toBe(true);
      expect(result.window).toBeDefined();
      expect(result.window.width).toBe(1200);
      expect(result.window.height).toBe(900);
      expect(result.window.title).toBe('MyTestImage');

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 15000);

  test('should fail gracefully with invalid URI', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    // Test with empty args
    await expect(
      cli.commandProcessor.execute('/show')
    ).rejects.toThrow('URI is required');
  }, 15000);

  test('should fail gracefully with invalid width', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    await expect(
      cli.commandProcessor.execute('/show legion://test/image --width abc')
    ).rejects.toThrow('Invalid width');
  }, 15000);
});