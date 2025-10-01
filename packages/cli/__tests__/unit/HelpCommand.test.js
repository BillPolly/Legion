/**
 * Unit tests for HelpCommand
 * Tests help display functionality
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { HelpCommand } from '../../src/commands/HelpCommand.js';
import { CommandProcessor } from '../../src/commands/CommandProcessor.js';
import { BaseCommand } from '../../src/commands/BaseCommand.js';

describe('HelpCommand Unit Tests', () => {
  let helpCommand;
  let commandProcessor;

  beforeEach(() => {
    commandProcessor = new CommandProcessor();
    helpCommand = new HelpCommand(commandProcessor);
  });

  test('should create HelpCommand with correct metadata', () => {
    expect(helpCommand.name).toBe('help');
    expect(helpCommand.description).toContain('help');
    expect(helpCommand.usage).toContain('help');
  });

  test('should have commandProcessor reference', () => {
    expect(helpCommand.commandProcessor).toBe(commandProcessor);
  });

  test('execute() with no args shows all commands', async () => {
    // Register some test commands
    const cmd1 = new BaseCommand('test1', 'Test command 1', 'test1');
    cmd1.execute = async () => ({ success: true });

    const cmd2 = new BaseCommand('test2', 'Test command 2', 'test2');
    cmd2.execute = async () => ({ success: true });

    commandProcessor.register(cmd1);
    commandProcessor.register(cmd2);
    commandProcessor.register(helpCommand);

    const result = await helpCommand.execute([]);

    expect(result.success).toBe(true);
    expect(result.message).toContain('test1');
    expect(result.message).toContain('test2');
    expect(result.message).toContain('help');
  });

  test('execute() with command name shows specific help', async () => {
    const testCmd = new BaseCommand('show', 'Show command', 'show <uri>');
    testCmd.execute = async () => ({ success: true });
    testCmd.getHelp = () => 'Detailed help for show';

    commandProcessor.register(testCmd);

    const result = await helpCommand.execute(['show']);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Detailed help for show');
  });

  test('execute() throws error for unknown command', async () => {
    await expect(
      helpCommand.execute(['nonexistent'])
    ).rejects.toThrow('Unknown command: nonexistent');
  });

  test('getHelp() returns formatted help', () => {
    const help = helpCommand.getHelp();

    expect(help).toContain('/help');
    expect(help).toContain('Usage');
    expect(help).toContain('Examples');
  });
});
