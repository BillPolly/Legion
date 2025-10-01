/**
 * Integration test for CLI lifecycle
 * Tests full CLI lifecycle with real ResourceManager and ShowMe
 * NO MOCKS - real components as per implementation plan
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';

describe('CLI Lifecycle Integration Test', () => {
  let resourceManager;
  let cli;

  beforeAll(async () => {
    // Get real ResourceManager singleton - only once for all tests
    resourceManager = await ResourceManager.getInstance();
  }, 10000);

  afterEach(async () => {
    if (cli) {
      await cli.shutdown();
      cli = null;
    }
  });

  test('should complete full lifecycle: initialize → start → shutdown', async () => {
    // Use random port to avoid conflicts
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    // Verify initial state
    expect(cli.isInitialized).toBe(false);
    expect(cli.isRunning).toBe(false);

    // Initialize
    await cli.initialize();
    expect(cli.isInitialized).toBe(true);
    expect(cli.showme).toBeDefined();
    expect(cli.showme.isInitialized).toBe(true);
    expect(cli.showme.isRunning).toBe(true);
    expect(cli.displayEngine).toBeDefined();
    expect(cli.commandProcessor).toBeDefined();

    // Start
    await cli.start();
    expect(cli.isRunning).toBe(true);

    // Shutdown
    await cli.shutdown();
    expect(cli.isRunning).toBe(false);
    expect(cli.showme.isRunning).toBe(false);
  }, 15000);

  test('should handle ShowMe lifecycle correctly', async () => {
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();

    // Verify ShowMe is running
    expect(cli.showme.isRunning).toBe(true);
    expect(cli.showme.server).toBeDefined();

    // Verify ShowMe port
    expect(cli.showme.port).toBe(port);

    // Shutdown should stop ShowMe
    await cli.shutdown();
    expect(cli.showme.isRunning).toBe(false);
  }, 15000);

  test('should maintain component references through lifecycle', async () => {
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();

    const showmeRef = cli.showme;
    const displayEngineRef = cli.displayEngine;
    const commandProcessorRef = cli.commandProcessor;

    await cli.start();

    // References should remain the same
    expect(cli.showme).toBe(showmeRef);
    expect(cli.displayEngine).toBe(displayEngineRef);
    expect(cli.commandProcessor).toBe(commandProcessorRef);

    await cli.shutdown();
  }, 15000);

  test('should provide accurate status through lifecycle', async () => {
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    // Initial status
    let status = cli.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.running).toBe(false);
    expect(status.hasShowMe).toBe(false);

    // After initialize
    await cli.initialize();
    status = cli.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.running).toBe(false);
    expect(status.hasShowMe).toBe(true);
    expect(status.hasDisplayEngine).toBe(true);
    expect(status.hasCommandProcessor).toBe(true);

    // After start
    await cli.start();
    status = cli.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.running).toBe(true);

    // After shutdown
    await cli.shutdown();
    status = cli.getStatus();
    expect(status.running).toBe(false);
  }, 15000);
});