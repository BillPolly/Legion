import { describe, test, expect, beforeEach } from '@jest/globals';
import { CommandRegistry } from '../../src/command-handler';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('initialization', () => {
    test('should create registry with handlers', () => {
      expect(registry).toBeDefined();
      expect(typeof registry.execute).toBe('function');
    });

    test('should have all required commands', () => {
      const commands = registry.getCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('open');
      expect(commands).toContain('save');
      expect(commands).toContain('replaceAll');
      expect(commands).toContain('type');
      expect(commands).toContain('chunkedInsert');
      expect(commands).toContain('setCursor');
      expect(commands).toContain('reveal');
      expect(commands).toContain('highlight');
      expect(commands).toContain('openUrl');
      expect(commands).toContain('sleep');
      expect(commands).toContain('batch');
    });

    test('should check command existence', () => {
      expect(registry.hasCommand('open')).toBe(true);
      expect(registry.hasCommand('unknownCommand')).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should throw error for unknown command', async () => {
      await expect(registry.execute('unknownCommand', {}))
        .rejects.toThrow('Unknown command: unknownCommand');
    });
  });
});
