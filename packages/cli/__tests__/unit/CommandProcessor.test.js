/**
 * Unit tests for CommandProcessor
 * Tests command registration, parsing, and routing
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CommandProcessor } from '../../src/commands/CommandProcessor.js';
import { BaseCommand } from '../../src/commands/BaseCommand.js';

describe('CommandProcessor Unit Tests', () => {
  let processor;

  beforeEach(() => {
    processor = new CommandProcessor();
  });

  test('should create CommandProcessor', () => {
    expect(processor).toBeDefined();
    expect(processor.commands).toBeInstanceOf(Map);
    expect(processor.commands.size).toBe(0);
  });

  test('should register a command', () => {
    const command = new BaseCommand('test', 'Test command', 'test [args]');
    command.execute = async () => 'executed';

    processor.register(command);

    expect(processor.commands.size).toBe(1);
    expect(processor.commands.has('test')).toBe(true);
    expect(processor.commands.get('test')).toBe(command);
  });

  test('should fail to register command without name', () => {
    const command = new BaseCommand('test', 'Test', 'test');
    command.name = ''; // Remove name after creation

    expect(() => processor.register(command)).toThrow('Command must have a name');
  });

  test('should fail to register duplicate command', () => {
    const command1 = new BaseCommand('test', 'Test 1', 'test');
    const command2 = new BaseCommand('test', 'Test 2', 'test');

    processor.register(command1);
    expect(() => processor.register(command2)).toThrow('Command test already registered');
  });

  test('should parse slash command correctly', () => {
    const result = processor.parse('/show handle://test');

    expect(result.command).toBe('show');
    expect(result.args).toEqual(['handle://test']);
    expect(result.raw).toBe('/show handle://test');
  });

  test('should parse slash command with multiple args', () => {
    const result = processor.parse('/show handle://test --width 800 --height 600');

    expect(result.command).toBe('show');
    expect(result.args).toEqual(['handle://test', '--width', '800', '--height', '600']);
  });

  test('should handle command without slash', () => {
    const result = processor.parse('show handle://test');

    expect(result.command).toBe('show');
    expect(result.args).toEqual(['handle://test']);
  });

  test('should throw error for empty command', () => {
    expect(() => processor.parse('')).toThrow('Command cannot be empty');
  });

  test('should throw error for whitespace-only command', () => {
    expect(() => processor.parse('   ')).toThrow('Command cannot be empty');
  });

  test('should execute registered command', async () => {
    const command = new BaseCommand('test', 'Test', 'test');
    command.execute = async (args) => `executed with ${args.length} args`;

    processor.register(command);

    const result = await processor.execute('test arg1 arg2');

    expect(result).toBe('executed with 2 args');
  });

  test('should throw error for unknown command', async () => {
    await expect(processor.execute('unknown')).rejects.toThrow('Unknown command: unknown');
  });

  test('should get command by name', () => {
    const command = new BaseCommand('test', 'Test', 'test');
    processor.register(command);

    const retrieved = processor.getCommand('test');
    expect(retrieved).toBe(command);
  });

  test('should return null for non-existent command', () => {
    const retrieved = processor.getCommand('nonexistent');
    expect(retrieved).toBeNull();
  });

  test('should get all command names', () => {
    const cmd1 = new BaseCommand('test1', 'Test 1', 'test1');
    const cmd2 = new BaseCommand('test2', 'Test 2', 'test2');

    processor.register(cmd1);
    processor.register(cmd2);

    const names = processor.getCommandNames();
    expect(names).toEqual(['test1', 'test2']);
  });

  test('should get all commands', () => {
    const cmd1 = new BaseCommand('test1', 'Test 1', 'test1');
    const cmd2 = new BaseCommand('test2', 'Test 2', 'test2');

    processor.register(cmd1);
    processor.register(cmd2);

    const commands = processor.getCommands();
    expect(commands).toHaveLength(2);
    expect(commands).toContain(cmd1);
    expect(commands).toContain(cmd2);
  });
});