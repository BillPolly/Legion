/**
 * Unit tests for ShowCommand
 * Tests /show command parsing and execution
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ShowCommand } from '../../src/commands/ShowCommand.js';
import { ShowMeController } from '@legion/showme';
import { ResourceManager } from '@legion/resource-manager';

describe('ShowCommand Unit Tests', () => {
  let showCommand;
  let resourceManager;
  let showme;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Create real ShowMeController for displayEngine
    const port = 6000 + Math.floor(Math.random() * 500);
    showme = new ShowMeController({ port });
    await showme.initialize();
    await showme.start();

    showCommand = new ShowCommand(showme, resourceManager);
  });

  afterEach(async () => {
    if (showme && showme.isRunning) {
      await showme.stop();
    }
  });

  test('should create ShowCommand with correct metadata', () => {
    expect(showCommand.name).toBe('show');
    expect(showCommand.description).toContain('Display a Handle');
    expect(showCommand.usage).toContain('show');
  });

  test('should have displayEngine reference', () => {
    expect(showCommand.displayEngine).toBe(showme);
  });

  test('should have resourceManager reference', () => {
    expect(showCommand.resourceManager).toBe(resourceManager);
  });

  test('parseArgs() should extract URI from args', () => {
    const parsed = showCommand.parseArgs(['legion://local/test']);

    expect(parsed.uri).toBe('legion://local/test');
    expect(parsed.options).toEqual({});
  });

  test('parseArgs() should extract URI and options', () => {
    const parsed = showCommand.parseArgs(['legion://local/test', '--width', '800', '--height', '600']);

    expect(parsed.uri).toBe('legion://local/test');
    expect(parsed.options.width).toBe(800);
    expect(parsed.options.height).toBe(600);
  });

  test('parseArgs() should handle --title option', () => {
    const parsed = showCommand.parseArgs(['legion://local/test', '--title', 'My Window']);

    expect(parsed.uri).toBe('legion://local/test');
    expect(parsed.options.title).toBe('My Window');
  });

  test('parseArgs() should throw error for missing URI', () => {
    expect(() => showCommand.parseArgs([])).toThrow('URI is required');
  });

  test('parseArgs() should throw error for invalid width', () => {
    expect(() => showCommand.parseArgs(['legion://local/test', '--width', 'abc'])).toThrow('Invalid width');
  });

  test('parseArgs() should throw error for invalid height', () => {
    expect(() => showCommand.parseArgs(['legion://local/test', '--height', 'xyz'])).toThrow('Invalid height');
  });

  test('getHelp() should return formatted help', () => {
    const help = showCommand.getHelp();

    expect(help).toContain('/show');
    expect(help).toContain('URI');
    expect(help).toContain('--width');
    expect(help).toContain('--height');
  });
});