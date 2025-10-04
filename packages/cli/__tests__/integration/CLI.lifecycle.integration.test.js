/**
 * Integration test for CLI lifecycle
 * Tests full CLI lifecycle with real ResourceManager
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
    expect(cli.sessionActor).toBeDefined();
    expect(cli.inputHandler).toBeDefined();
    expect(cli.outputHandler).toBeDefined();

    // Start
    await cli.start();
    expect(cli.isRunning).toBe(true);

    // Shutdown
    await cli.shutdown();
    expect(cli.isRunning).toBe(false);
  }, 15000);

  test('should maintain component references through lifecycle', async () => {
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();

    const sessionActorRef = cli.sessionActor;
    const inputHandlerRef = cli.inputHandler;
    const outputHandlerRef = cli.outputHandler;

    await cli.start();

    // References should remain the same
    expect(cli.sessionActor).toBe(sessionActorRef);
    expect(cli.inputHandler).toBe(inputHandlerRef);
    expect(cli.outputHandler).toBe(outputHandlerRef);

    await cli.shutdown();
  }, 15000);

  test('should provide accurate status through lifecycle', async () => {
    const port = 5000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });

    // Initial status
    let status = cli.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.running).toBe(false);

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
  }, 15000);
});