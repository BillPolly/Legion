/**
 * SlashCommandProcessor Tests
 * 
 * Tests the command parsing, validation and routing functionality.
 * Follows fail-fast principles with no mocks.
 */

import { SlashCommandProcessor } from '../SlashCommandProcessor.js';

describe('SlashCommandProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new SlashCommandProcessor();
  });

  describe('Command Parsing', () => {
    test('recognizes slash commands', () => {
      const result = processor.parseCommand('/help');
      expect(result.isSlashCommand).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.command).toBe('help');
    });

    test('rejects non-slash commands', () => {
      const result = processor.parseCommand('help');
      expect(result).toBeNull();
    });

    test('handles empty slash command', () => {
      const result = processor.parseCommand('/');
      expect(result.isSlashCommand).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Empty command');
    });

    test('handles unknown commands', () => {
      const result = processor.parseCommand('/unknown');
      expect(result.isSlashCommand).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown command: /unknown');
    });
  });

  describe('Argument Parsing', () => {
    test('parses simple arguments', () => {
      const result = processor.parseCommand('/help context');
      expect(result.isValid).toBe(true);
      expect(result.args.command).toBe('context');
    });

    test('parses quoted arguments', () => {
      const result = processor.parseCommand('/save "my session"');
      expect(result.isValid).toBe(true);
      expect(result.args.name).toBe('my session');
    });

    test('parses mixed quotes', () => {
      const result = processor.parseCommand("/save 'session with spaces'");
      expect(result.isValid).toBe(true);
      expect(result.args.name).toBe('session with spaces');
    });

    test('handles unterminated quotes', () => {
      expect(() => {
        processor.parseCommand('/save "unterminated');
      }).toThrow('Unterminated quote');
    });

    test('parses numeric arguments', () => {
      const result = processor.parseCommand('/history 5');
      expect(result.isValid).toBe(true);
      expect(result.args.count).toBe(5);
      expect(typeof result.args.count).toBe('number');
    });

    test('validates numeric argument types', () => {
      const result = processor.parseCommand('/history abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a number');
    });
  });

  describe('Argument Validation', () => {
    test('validates required arguments', () => {
      const result = processor.parseCommand('/save');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required');
      expect(result.usage).toBe('/save <name>');
    });

    test('allows optional arguments', () => {
      const result = processor.parseCommand('/help');
      expect(result.isValid).toBe(true);
    });

    test('rejects extra arguments', () => {
      const result = processor.parseCommand('/clear extra args');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unexpected arguments');
    });
  });

  describe('Core Commands', () => {
    test('has help command', () => {
      const spec = processor.getCommandSpec('help');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('help');
      expect(spec.category).toBe('core');
    });

    test('has context command', () => {
      const spec = processor.getCommandSpec('context');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('context');
      expect(spec.category).toBe('debug');
    });

    test('has clear command', () => {
      const spec = processor.getCommandSpec('clear');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('clear');
      expect(spec.category).toBe('core');
    });

    test('has debug command', () => {
      const spec = processor.getCommandSpec('debug');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('debug');
      expect(spec.category).toBe('debug');
    });

    test('has history command', () => {
      const spec = processor.getCommandSpec('history');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('history');
      expect(spec.category).toBe('debug');
    });

    test('has save command', () => {
      const spec = processor.getCommandSpec('save');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('save');
      expect(spec.category).toBe('session');
    });

    test('has load command', () => {
      const spec = processor.getCommandSpec('load');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('load');
      expect(spec.category).toBe('session');
    });
  });

  describe('Help Text Generation', () => {
    test('generates help for specific command', () => {
      const help = processor.generateHelpText('help');
      expect(help).toContain('/help');
      expect(help).toContain('Show available commands');
      expect(help).toContain('Usage:');
      expect(help).toContain('Arguments:');
    });

    test('generates help for command with no arguments', () => {
      const help = processor.generateHelpText('clear');
      expect(help).toContain('/clear');
      expect(help).toContain('Clear chat context');
      expect(help).not.toContain('Arguments:');
    });

    test('generates help for unknown command', () => {
      const help = processor.generateHelpText('unknown');
      expect(help).toContain('Unknown command: /unknown');
      expect(help).toContain('Use /help');
    });

    test('generates general help text', () => {
      const help = processor.generateHelpText();
      expect(help).toContain('Available Slash Commands');
      expect(help).toContain('Core Commands:');
      expect(help).toContain('Debug Commands:');
      expect(help).toContain('Session Commands:');
      expect(help).toContain('/help');
      expect(help).toContain('/context');
      expect(help).toContain('/save');
    });
  });

  describe('Command Registration', () => {
    test('allows registering new commands', () => {
      const customCommand = {
        name: 'test',
        description: 'Test command',
        usage: '/test',
        args: [],
        category: 'test'
      };

      processor.registerCommand(customCommand);
      const spec = processor.getCommandSpec('test');
      expect(spec).toBeDefined();
      expect(spec.name).toBe('test');
    });

    test('validates command registration', () => {
      expect(() => {
        processor.registerCommand({});
      }).toThrow('Command must have a name');

      expect(() => {
        processor.registerCommand({ name: 'test' });
      }).toThrow('Command must have a description');

      expect(() => {
        processor.registerCommand({ 
          name: 'test', 
          description: 'Test' 
        });
      }).toThrow('Command must have usage text');

      expect(() => {
        processor.registerCommand({ 
          name: 'test', 
          description: 'Test',
          usage: '/test'
        });
      }).toThrow('Command must have args array');
    });
  });

  describe('Category Management', () => {
    test('groups commands by category', () => {
      const coreCommands = processor.getCommandsByCategory('core');
      const debugCommands = processor.getCommandsByCategory('debug');
      const sessionCommands = processor.getCommandsByCategory('session');
      
      expect(coreCommands.length).toBeGreaterThan(0);
      expect(debugCommands.length).toBeGreaterThan(0);
      expect(sessionCommands.length).toBeGreaterThan(0);
      
      expect(coreCommands.every(cmd => cmd.category === 'core')).toBe(true);
      expect(debugCommands.every(cmd => cmd.category === 'debug')).toBe(true);
      expect(sessionCommands.every(cmd => cmd.category === 'session')).toBe(true);
    });

    test('returns empty array for unknown category', () => {
      const unknownCommands = processor.getCommandsByCategory('unknown');
      expect(unknownCommands).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('handles whitespace in commands', () => {
      const result = processor.parseCommand('  /help  context  ');
      expect(result.isValid).toBe(true);
      expect(result.command).toBe('help');
      expect(result.args.command).toBe('context');
    });

    test('handles case insensitive commands', () => {
      const result = processor.parseCommand('/HELP');
      expect(result.isValid).toBe(true);
      expect(result.command).toBe('help');
    });

    test('handles empty arguments', () => {
      const result = processor.parseCommand('/help ""');
      expect(result.isValid).toBe(true);
      expect(result.args.command).toBe('');
    });
  });
});