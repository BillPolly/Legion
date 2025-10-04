import { ReasonCommand } from '../../src/commands/ReasonCommand.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ReasonCommand', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  describe('Constructor', () => {
    test('should create instance', () => {
      const cmd = new ReasonCommand(resourceManager);
      expect(cmd).toBeInstanceOf(ReasonCommand);
      expect(cmd.name).toBe('reason');
    });

    test('should have proper metadata', () => {
      const cmd = new ReasonCommand(resourceManager);
      expect(cmd.description).toBeDefined();
      expect(cmd.usage).toBeDefined();
    });
  });

  describe('execute()', () => {
    test('should execute simple question', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const result = await cmd.execute(['Is there a number greater than 5?']);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.answer).toBeDefined();
      expect(result.data.proof).toBeDefined();
      expect(result.message).toBeDefined();
    });

    test('should parse --constraint flags', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = [
        'Should we deploy?',
        '--constraint', 'tests_passing == true',
        '--constraint', 'coverage > 80'
      ];

      const result = await cmd.execute(args);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should parse --fact flags', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = [
        'Is deployment safe?',
        '--fact', 'tests_passing = true',
        '--fact', 'coverage = 85'
      ];

      const result = await cmd.execute(args);

      expect(result.success).toBe(true);
    });

    test('should handle mixed facts and constraints', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = [
        'Can we proceed?',
        '--fact', 'status = ready',
        '--constraint', 'status == ready'
      ];

      const result = await cmd.execute(args);

      expect(result.success).toBe(true);
    });

    test('should format output message', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const result = await cmd.execute(['Test question']);

      expect(result.message).toContain('Answer:');
      expect(result.message).toContain('Confidence:');
      expect(result.message).toContain('Proof:');
    });

    test('should return error on missing question', async () => {
      const cmd = new ReasonCommand(resourceManager);

      const result = await cmd.execute([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Question is required');
    });

    test('should return error on empty question', async () => {
      const cmd = new ReasonCommand(resourceManager);

      const result = await cmd.execute(['']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Question is required');
    });

    test('should handle errors gracefully', async () => {
      const cmd = new ReasonCommand(resourceManager);

      // Pass invalid arguments that might cause errors
      const result = await cmd.execute(['???', '--constraint', 'invalid syntax here!!!']);

      // Should still return a result structure
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('getHelp()', () => {
    test('should return help text', () => {
      const cmd = new ReasonCommand(resourceManager);
      const help = cmd.getHelp();

      expect(help).toContain('/reason');
      expect(help).toContain('Usage:');
      expect(help).toContain('--constraint');
      expect(help).toContain('--fact');
      expect(help).toContain('Examples:');
    });
  });

  describe('Argument Parsing', () => {
    test('should extract question from first argument', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = cmd._parseArgs(['My question', '--fact', 'x = 5']);

      expect(args.question).toBe('My question');
    });

    test('should collect all constraints', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = cmd._parseArgs([
        'Question',
        '--constraint', 'a > 5',
        '--constraint', 'b < 10'
      ]);

      expect(args.constraints).toEqual(['a > 5', 'b < 10']);
    });

    test('should collect all facts', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = cmd._parseArgs([
        'Question',
        '--fact', 'x = 5',
        '--fact', 'y = 10'
      ]);

      expect(args.facts).toEqual(['x = 5', 'y = 10']);
    });

    test('should handle question with spaces', async () => {
      const cmd = new ReasonCommand(resourceManager);
      const args = cmd._parseArgs([
        'Is there a number greater than 5?',
        '--constraint', 'x > 5'
      ]);

      expect(args.question).toBe('Is there a number greater than 5?');
    });
  });
});
