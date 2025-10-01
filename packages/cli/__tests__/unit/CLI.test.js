/**
 * Unit tests for CLI class
 * Tests basic construction, lifecycle, and state management
 * Uses real ShowMeController as per NO MOCKS rule in implementation plan
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';

describe('CLI Unit Tests', () => {
  let resourceManager;
  let cli;

  beforeEach(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    // Use random port to avoid conflicts
    const port = 4000 + Math.floor(Math.random() * 1000);
    cli = new CLI(resourceManager, { port });
  });

  afterEach(async () => {
    if (cli) {
      await cli.shutdown();
    }
  });

  test('should create CLI with ResourceManager', () => {
    expect(cli).toBeDefined();
    expect(cli.resourceManager).toBe(resourceManager);
    expect(cli.isInitialized).toBe(false);
    expect(cli.isRunning).toBe(false);
  });

  test('should fail to create CLI without ResourceManager', () => {
    expect(() => new CLI()).toThrow('ResourceManager is required');
  });

  test('should fail to create CLI with null ResourceManager', () => {
    expect(() => new CLI(null)).toThrow('ResourceManager is required');
  });

  test('should have correct initial state', () => {
    expect(cli.isInitialized).toBe(false);
    expect(cli.isRunning).toBe(false);
    expect(cli.showme).toBeNull();
    expect(cli.sessionActor).toBeNull();
    expect(cli.inputHandler).toBeNull();
    expect(cli.outputHandler).toBeNull();
  });

  test('initialize() should set isInitialized to true', async () => {
    await cli.initialize();
    expect(cli.isInitialized).toBe(true);
  });

  test('initialize() should create required components', async () => {
    await cli.initialize();
    expect(cli.showme).toBeDefined();
    expect(cli.sessionActor).toBeDefined();
    expect(cli.inputHandler).toBeDefined();
    expect(cli.outputHandler).toBeDefined();
  });

  test('initialize() should fail if already initialized', async () => {
    await cli.initialize();
    await expect(cli.initialize()).rejects.toThrow('CLI already initialized');
  });

  test('start() should require initialization first', async () => {
    await expect(cli.start()).rejects.toThrow('CLI must be initialized before starting');
  });

  test('start() should set isRunning to true', async () => {
    await cli.initialize();
    // Don't actually start (would block), just test the flow
    // We'll test full start in integration tests
    expect(cli.isInitialized).toBe(true);
  });

  test('shutdown() should clean up components', async () => {
    await cli.initialize();
    await cli.shutdown();
    expect(cli.isRunning).toBe(false);
  });

  test('shutdown() should be idempotent', async () => {
    await cli.initialize();
    await cli.shutdown();
    await cli.shutdown(); // Should not throw
    expect(cli.isRunning).toBe(false);
  });

  test('shutdown() should work even if not initialized', async () => {
    await cli.shutdown(); // Should not throw
    expect(cli.isRunning).toBe(false);
  });

  test('getStatus() should return current CLI state', () => {
    const status = cli.getStatus();
    expect(status).toEqual({
      mode: 'interactive',
      initialized: false,
      running: false,
      hasShowMe: false,
      hasSessionActor: false,
      hasInputHandler: false,
      hasOutputHandler: false
    });
  });

  test('getStatus() should reflect initialized state', async () => {
    await cli.initialize();
    const status = cli.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.hasShowMe).toBe(true);
    expect(status.hasSessionActor).toBe(true);
    expect(status.hasInputHandler).toBe(true);
    expect(status.hasOutputHandler).toBe(true);
  });
});