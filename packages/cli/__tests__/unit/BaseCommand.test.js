/**
 * Unit tests for BaseCommand
 * Tests command base class and interface
 */

import { describe, test, expect } from '@jest/globals';
import { BaseCommand } from '../../src/commands/BaseCommand.js';

describe('BaseCommand Unit Tests', () => {
  test('should create BaseCommand with name, description, usage', () => {
    const command = new BaseCommand('test', 'Test command', 'test [args]');

    expect(command.name).toBe('test');
    expect(command.description).toBe('Test command');
    expect(command.usage).toBe('test [args]');
  });

  test('should fail to create command without name', () => {
    expect(() => new BaseCommand('', 'Test', 'test')).toThrow('Command name is required');
  });

  test('should fail to create command without description', () => {
    expect(() => new BaseCommand('test', '', 'test')).toThrow('Command description is required');
  });

  test('should fail to create command without usage', () => {
    expect(() => new BaseCommand('test', 'Test', '')).toThrow('Command usage is required');
  });

  test('execute() should throw not implemented error by default', async () => {
    const command = new BaseCommand('test', 'Test', 'test');

    await expect(command.execute([])).rejects.toThrow('Command execute() must be implemented');
  });

  test('getHelp() should return formatted help text', () => {
    const command = new BaseCommand('test', 'Test command', 'test [args]');

    const help = command.getHelp();

    expect(help).toContain('test');
    expect(help).toContain('Test command');
    expect(help).toContain('test [args]');
  });

  test('should allow subclass to override execute()', async () => {
    const command = new BaseCommand('test', 'Test', 'test');
    command.execute = async (args) => `executed with ${args.length} args`;

    const result = await command.execute(['arg1', 'arg2']);
    expect(result).toBe('executed with 2 args');
  });
});