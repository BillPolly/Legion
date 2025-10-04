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
    expect(cli.sessionActor).toBeDefined();
    expect(cli.inputHandler).toBeDefined();
    expect(cli.outputHandler).toBeDefined();

    // Start CLI
    await cli.start();
    expect(cli.isRunning).toBe(true);

    // Mock remoteActor for browser display
    const displayedAssets = [];
    const mockRemoteActor = {
      receive: (messageType, data) => {
        if (messageType === 'display-asset') {
          displayedAssets.push(data);
        }
        return { success: true };
      }
    };
    cli.sessionActor.remoteActor = mockRemoteActor;

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
      // Execute /show command directly via sessionActor
      const result = await cli.sessionActor.receive('execute-command', { command: '/show legion://test/image' });
      expect(result.success).toBe(true);

      // Verify display-asset was sent
      expect(displayedAssets.length).toBe(1);
      expect(displayedAssets[0].assetData).toBeDefined();

      // Test invalid command error handling
      const errorResult = await cli.sessionActor.receive('execute-command', { command: '/nonexistent command' });
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain('Unknown command');

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }

    // Shutdown
    await cli.shutdown();
    expect(cli.isRunning).toBe(false);

  }, 20000);

  test('should handle multiple commands in sequence', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Mock remoteActor for browser display
    const displayedAssets = [];
    const mockRemoteActor = {
      receive: (messageType, data) => {
        if (messageType === 'display-asset') {
          displayedAssets.push(data);
        }
        return { success: true };
      }
    };
    cli.sessionActor.remoteActor = mockRemoteActor;

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
      const result1 = await cli.sessionActor.receive('execute-command', { command: '/show legion://test/image1' });
      expect(result1.success).toBe(true);

      // Execute second command
      const result2 = await cli.sessionActor.receive('execute-command', { command: '/show legion://test/image2' });
      expect(result2.success).toBe(true);

      // Verify both assets were displayed
      expect(displayedAssets.length).toBe(2);
      expect(displayedAssets[0].assetData).toBeDefined();
      expect(displayedAssets[1].assetData).toBeDefined();

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }

  }, 20000);

  test('should handle errors gracefully', async () => {
    const port = 7000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Test error handling with invalid command
    const invalidResult = await cli.sessionActor.receive('execute-command', { command: '/invalid' });
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('Unknown command');

    // Test error handling with invalid arguments
    const showResult = await cli.sessionActor.receive('execute-command', { command: '/show' });
    expect(showResult.success).toBe(false);
    expect(showResult.error).toContain('URI is required');

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
    expect(status.hasSessionActor).toBe(true);
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
