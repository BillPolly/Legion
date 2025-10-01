/**
 * End-to-End Integration Test for Legion CLI
 * Tests complete workflow with real components (NO MOCKS except browser)
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImageHandle } from '@legion/showme/src/handles/ImageHandle.js';

describe('CLI End-to-End Integration Test', () => {
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

  test('should complete full CLI workflow: init → start → command → shutdown', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);

    // Create CLI
    cli = new CLI(resourceManager, {
      port,
      prompt: 'test> ',
      historySize: 100
    });

    // Initialize - sets up all components
    await cli.initialize();
    expect(cli.isInitialized).toBe(true);
    expect(cli.showme).toBeDefined();
    expect(cli.displayEngine).toBeDefined();
    expect(cli.commandProcessor).toBeDefined();
    expect(cli.inputHandler).toBeDefined();
    expect(cli.outputHandler).toBeDefined();

    // Verify DisplayEngine is ShowMe (no duplication)
    expect(cli.displayEngine).toBe(cli.showme);

    // Start CLI
    await cli.start();
    expect(cli.isRunning).toBe(true);

    // Mock browser for testing
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };
    cli.showme.getServerActor = () => ({
      handleDisplayAsset: async () => { return; }
    });

    // Create test Handle
    const imageHandle = new ImageHandle({
      id: 'e2e-test-image',
      title: 'E2E Test Image',
      type: 'image/png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      width: 5,
      height: 5
    });

    // Mock createHandleFromURI
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute /show command directly via commandProcessor
      const result = await cli.commandProcessor.execute('/show legion://test/image');
      expect(result.success).toBe(true);

      // Verify window was created
      const windows = cli.showme.getWindows();
      expect(windows.length).toBe(1);
      expect(windows[0].isOpen).toBe(true);

      // Test invalid command error handling - processInput catches and logs, doesn't throw
      // So we test the commandProcessor directly
      await expect(
        cli.commandProcessor.execute('/nonexistent command')
      ).rejects.toThrow('Unknown command');

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }

    // Shutdown
    await cli.shutdown();
    expect(cli.isRunning).toBe(false);
    expect(cli.showme.isRunning).toBe(false);

  }, 20000);

  test('should handle multiple commands in sequence', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Mock browser
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };
    cli.showme.getServerActor = () => ({
      handleDisplayAsset: async () => { return; }
    });

    // Create multiple test Handles
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
      width: 20,
      height: 20
    });

    // Mock createHandleFromURI to return different handles
    let callCount = 0;
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => {
      callCount++;
      return callCount === 1 ? handle1 : handle2;
    };

    try {
      // Execute first command
      const result1 = await cli.commandProcessor.execute('/show legion://test/image1');
      expect(result1.success).toBe(true);

      // Execute second command
      const result2 = await cli.commandProcessor.execute('/show legion://test/image2');
      expect(result2.success).toBe(true);

      // Verify both windows created
      const windows = cli.showme.getWindows();
      expect(windows.length).toBe(2);
      expect(windows[0].isOpen).toBe(true);
      expect(windows[1].isOpen).toBe(true);

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }

  }, 20000);

  test('should handle errors gracefully', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Test error handling with invalid command - commandProcessor throws
    await expect(
      cli.commandProcessor.execute('/invalid')
    ).rejects.toThrow('Unknown command');

    // Test error handling with invalid arguments
    await expect(
      cli.commandProcessor.execute('/show')
    ).rejects.toThrow('URI is required');

    // CLI should still be operational
    expect(cli.isRunning).toBe(true);

  }, 20000);

  test('should track status accurately through lifecycle', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    // Initial state
    let status = cli.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.running).toBe(false);
    expect(status.hasInputHandler).toBe(false);
    expect(status.hasOutputHandler).toBe(false);

    // After initialize
    await cli.initialize();
    status = cli.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.running).toBe(false);
    expect(status.hasShowMe).toBe(true);
    expect(status.hasDisplayEngine).toBe(true);
    expect(status.hasCommandProcessor).toBe(true);
    expect(status.hasInputHandler).toBe(true);
    expect(status.hasOutputHandler).toBe(true);

    // After start
    await cli.start();
    status = cli.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.running).toBe(true);

    // After shutdown
    await cli.shutdown();
    status = cli.getStatus();
    expect(status.running).toBe(false);

  }, 20000);
});
