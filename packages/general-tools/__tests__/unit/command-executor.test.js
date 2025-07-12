/**
 * Simplified unit tests for Command Executor Tool
 */

import { jest } from '@jest/globals';
import CommandExecutor from '../../src/command-executor/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

describe('CommandExecutor', () => {
  let commandExecutor;

  beforeEach(() => {
    commandExecutor = new CommandExecutor();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(commandExecutor.name).toBe('command_executor');
      expect(commandExecutor.description).toBe('Executes bash commands in the terminal');
    });
  });

  describe('getToolDescription', () => {
    test('should return correct tool description format', () => {
      const description = commandExecutor.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('command_executor_execute');
      expect(description.function.description).toContain('bash command');
      expect(description.function.parameters.required).toContain('command');
      expect(description.function.parameters.properties.command.type).toBe('string');
      expect(description.function.parameters.properties.timeout.type).toBe('number');
    });

    test('should include output schemas for success and failure', () => {
      const description = commandExecutor.getToolDescription();
      
      expect(description.function.output.success).toBeDefined();
      expect(description.function.output.failure).toBeDefined();
      expect(description.function.output.success.properties.stdout).toBeDefined();
      expect(description.function.output.success.properties.stderr).toBeDefined();
      expect(description.function.output.success.properties.exitCode).toBeDefined();
    });
  });

  describe('executeCommand method', () => {
    test('should execute simple echo command successfully', async () => {
      const result = await commandExecutor.executeCommand('echo "Hello World"');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Hello World');
      expect(result.data.exitCode).toBe(0);
    });

    test('should block dangerous commands', async () => {
      const result = await commandExecutor.executeCommand('rm -rf /');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command blocked for safety reasons');
    });

    test('should block more dangerous commands', async () => {
      const result = await commandExecutor.executeCommand('sudo rm -rf /');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command blocked for safety reasons');
    });

    test('should handle command timeout', async () => {
      const result = await commandExecutor.executeCommand('sleep 5', { timeout: 100 });

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout|ERR_OUT_OF_RANGE/);
    }, 2000);

    test('should handle missing command parameter', async () => {
      const result = await commandExecutor.executeCommand();

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });
  });

  describe('invoke method', () => {
    test('should handle valid command execution', async () => {
      const toolCall = createMockToolCall('command_executor_execute', { 
        command: 'echo "Test output"' 
      });
      
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Test output');
    });

    test('should handle missing command parameter', async () => {
      const toolCall = createMockToolCall('command_executor_execute', {});
      
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });

    test('should execute command regardless of function name', async () => {
      // CommandExecutor only has one function, so it ignores the function name
      // and just executes the command if parameters are valid
      const toolCall = createMockToolCall('unknown_function', { command: 'echo test' });
      
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('test');
    });
  });

  describe('security features', () => {
    test('should block specific dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /',
        'dd if=/dev/zero of=/dev/sda'
      ];

      for (const command of dangerousCommands) {
        const result = await commandExecutor.executeCommand(command);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Command blocked for safety reasons');
      }
    });


    test('should allow safe commands', async () => {
      const safeCommands = [
        'echo "hello"',
        'ls -la',
        'pwd',
        'whoami',
        'date'
      ];

      for (const command of safeCommands) {
        const result = await commandExecutor.executeCommand(command);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('parameter validation', () => {
    test('should validate required parameters', async () => {
      const args = {};
      
      expect(() => {
        commandExecutor.validateRequiredParameters(args, ['command']);
      }).toThrow('Missing required parameters: command');
    });

    test('should pass validation when required parameters are present', () => {
      const args = { command: 'echo test' };
      
      expect(() => {
        commandExecutor.validateRequiredParameters(args, ['command']);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle empty commands gracefully', async () => {
      const result = await commandExecutor.executeCommand('');

      validateToolResult(result);
      expect(result.success).toBe(false);
    });

    test('should handle very simple commands', async () => {
      const result = await commandExecutor.executeCommand('true');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.exitCode).toBe(0);
    });
  });
});