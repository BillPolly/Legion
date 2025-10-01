/**
 * Unit tests for WindowsCommand
 * Tests window management functionality
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WindowsCommand } from '../../src/commands/WindowsCommand.js';
import { ShowMeController } from '@legion/showme';
import { OutputHandler } from '../../src/handlers/OutputHandler.js';

describe('WindowsCommand Unit Tests', () => {
  let windowsCommand;
  let showme;
  let outputHandler;

  beforeEach(async () => {
    const port = 8500 + Math.floor(Math.random() * 500);
    showme = new ShowMeController({ port });
    await showme.initialize();
    await showme.start();

    outputHandler = new OutputHandler({ useColors: false });

    windowsCommand = new WindowsCommand(showme, outputHandler);
  });

  afterEach(async () => {
    if (showme && showme.isRunning) {
      await showme.stop();
    }
  });

  test('should create WindowsCommand with correct metadata', () => {
    expect(windowsCommand.name).toBe('windows');
    expect(windowsCommand.description).toContain('window');
    expect(windowsCommand.usage).toContain('windows');
  });

  test('should have showme reference', () => {
    expect(windowsCommand.showme).toBe(showme);
  });

  test('should have outputHandler reference', () => {
    expect(windowsCommand.outputHandler).toBe(outputHandler);
  });

  test('execute() with no args lists windows', async () => {
    const result = await windowsCommand.execute([]);
    expect(result.success).toBe(true);
    expect(result.message).toContain('No open windows');
  });

  test('execute() with "list" action lists windows', async () => {
    const result = await windowsCommand.execute(['list']);
    expect(result.success).toBe(true);
  });

  test('listWindows() returns no windows message when empty', () => {
    const result = windowsCommand.listWindows();
    expect(result.success).toBe(true);
    expect(result.message).toContain('No open windows');
  });

  test('execute() with "close" requires window ID', async () => {
    await expect(
      windowsCommand.execute(['close'])
    ).rejects.toThrow('Window ID required');
  });

  test('execute() with "closeall" closes all windows', async () => {
    const result = await windowsCommand.execute(['closeall']);
    expect(result.success).toBe(true);
  });

  test('closeAllWindows() returns no windows message when empty', async () => {
    const result = await windowsCommand.closeAllWindows();
    expect(result.success).toBe(true);
    expect(result.message).toContain('No windows to close');
  });

  test('execute() throws error for unknown action', async () => {
    await expect(
      windowsCommand.execute(['invalid'])
    ).rejects.toThrow('Unknown action: invalid');
  });

  test('closeWindow() throws error for non-existent window', async () => {
    await expect(
      windowsCommand.closeWindow('nonexistent-id')
    ).rejects.toThrow('Window not found');
  });

  test('getHelp() returns formatted help', () => {
    const help = windowsCommand.getHelp();

    expect(help).toContain('/windows');
    expect(help).toContain('list');
    expect(help).toContain('close');
    expect(help).toContain('closeall');
  });
});
