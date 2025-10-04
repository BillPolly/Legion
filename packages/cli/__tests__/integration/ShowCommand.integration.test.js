/**
 * Integration test for /show command
 * Tests end-to-end command execution with real Handle display
 * Uses actor framework with mock remoteActor for display
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

    // Create mock remoteActor to receive display-asset messages
    const displayedAssets = [];
    const mockRemoteActor = {
      receive: (messageType, data) => {
        if (messageType === 'display-asset') {
          displayedAssets.push(data);
        }
        return { success: true };
      }
    };

    // Set the mock remoteActor (simulates browser connection)
    cli.sessionActor.remoteActor = mockRemoteActor;

    // Mock ResourceManager.createHandleFromURI to return our test handle
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute the command via sessionActor
      const result = await cli.sessionActor.receive('execute-command', {
        command: '/show legion://test/image'
      });

      // Verify result
      expect(result.success).toBe(true);
      expect(result.message).toContain('Displayed');
      expect(result.handle).toBeDefined();
      expect(result.assetData).toBeDefined();

      // Verify display-asset message was sent to remoteActor
      expect(displayedAssets.length).toBe(1);
      expect(displayedAssets[0].assetData).toBeDefined();
      expect(displayedAssets[0].assetType).toBe('image/png');

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

    // Create mock remoteActor
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

    // Mock createHandleFromURI
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute with options (MVP: simple parsing, no quote handling)
      const result = await cli.sessionActor.receive('execute-command', {
        command: '/show legion://test/image --title MyTestImage'
      });

      expect(result.success).toBe(true);
      expect(result.handle).toBeDefined();
      expect(result.title).toBe('MyTestImage');

      // Verify display-asset was sent
      expect(displayedAssets.length).toBe(1);
      expect(displayedAssets[0].title).toBe('MyTestImage');

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 15000);

  test('should fail gracefully with invalid URI', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    // Test with empty args - sessionActor returns error instead of throwing
    const result = await cli.sessionActor.receive('execute-command', {
      command: '/show'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('URI is required');
  }, 15000);

  test('should fail gracefully with invalid width', async () => {
    const port = 6500 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });
    await cli.initialize();
    await cli.start();

    // sessionActor returns error instead of throwing
    const result = await cli.sessionActor.receive('execute-command', {
      command: '/show legion://test/image --width abc'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid width');
  }, 15000);
});