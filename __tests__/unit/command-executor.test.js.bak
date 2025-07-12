/**
 * Unit tests for Command Executor Tool
 */

import { jest } from '@jest/globals';
import CommandExecutor from '../../src/command-executor/index.js';
import { createMockToolCall, validateToolResult, createMockExecResult } from '../utils/test-helpers.js';

// Mock child_process module
const mockExec = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  exec: mockExec
}));

// Mock promisify to return our mock exec
jest.unstable_mockModule('util', () => ({
  promisify: jest.fn(() => mockExec)
}));

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
      expect(description.function.output.success.properties.stdout.type).toBe('string');
      expect(description.function.output.failure.properties.errorType.enum).toContain('timeout');
    });
  });

  describe('executeCommand method', () => {
    test('should execute simple commands successfully', async () => {
      const mockOutput = {
        stdout: 'Hello World\n',
        stderr: ''
      };
      mockExec.mockResolvedValue(mockOutput);

      const result = await commandExecutor.executeCommand('echo "Hello World"');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('Hello World\n');
      expect(result.data.stderr).toBe('');
      expect(result.data.command).toBe('echo "Hello World"');
      expect(result.data.exitCode).toBe(0);
    });

    test('should handle commands with stderr output', async () => {
      const mockOutput = {
        stdout: 'Warning: something happened\n',
        stderr: 'This is a warning\n'
      };
      mockExec.mockResolvedValue(mockOutput);

      const result = await commandExecutor.executeCommand('ls /nonexistent 2>/dev/null || echo "Warning: something happened"');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('Warning: something happened\n');
      expect(result.data.stderr).toBe('This is a warning\n');
    });

    test('should block dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /',
        'dd if=/dev/zero of=/dev/sda',
        'rm -rf / --no-preserve-root'
      ];

      for (const command of dangerousCommands) {
        const result = await commandExecutor.executeCommand(command);

        validateToolResult(result);
        expect(result.success).toBe(false);
        expect(result.data.errorType).toBe('dangerous_command');
        expect(result.error).toContain('blocked for safety');
      }
    });

    test('should handle command timeout', async () => {
      const error = new Error('Command timed out');
      error.killed = true;
      error.signal = 'SIGTERM';
      mockExec.mockRejectedValue(error);

      const result = await commandExecutor.executeCommand('sleep 60', 1000);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('timeout');
      expect(result.error).toContain('timed out');
    });

    test('should handle non-zero exit codes', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'Some output';
      error.stderr = 'Error occurred';
      mockExec.mockRejectedValue(error);

      const result = await commandExecutor.executeCommand('exit 1');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('exit_code');
      expect(result.data.exitCode).toBe(1);
      expect(result.data.stdout).toBe('Some output');
      expect(result.data.stderr).toBe('Error occurred');
      expect(result.error).toContain('exit code 1');
    });

    test('should handle execution errors', async () => {
      const error = new Error('Command not found');
      mockExec.mockRejectedValue(error);

      const result = await commandExecutor.executeCommand('nonexistentcommand');

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('execution_error');
      expect(result.error).toContain('Failed to execute command');
    });

    test('should use custom timeout', async () => {
      const mockOutput = { stdout: 'success', stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      await commandExecutor.executeCommand('echo test', 5000);

      expect(mockExec).toHaveBeenCalledWith(
        'echo test',
        expect.objectContaining({
          timeout: 5000,
          maxBuffer: 1024 * 1024 * 10,
          shell: '/bin/bash'
        })
      );
    });

    test('should use default timeout when not specified', async () => {
      const mockOutput = { stdout: 'success', stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      await commandExecutor.executeCommand('echo test');

      expect(mockExec).toHaveBeenCalledWith(
        'echo test',
        expect.objectContaining({
          timeout: 30000
        })
      );
    });
  });

  describe('invoke method', () => {
    test('should handle valid command execution', async () => {
      const mockOutput = { stdout: 'file1.txt\nfile2.txt\n', stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      const toolCall = createMockToolCall('command_executor_execute', { 
        command: 'ls *.txt' 
      });
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('file1.txt\nfile2.txt\n');
      expect(result.data.command).toBe('ls *.txt');
    });

    test('should handle command with custom timeout', async () => {
      const mockOutput = { stdout: 'completed', stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      const toolCall = createMockToolCall('command_executor_execute', { 
        command: 'long-running-task',
        timeout: 60000
      });
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        'long-running-task',
        expect.objectContaining({ timeout: 60000 })
      );
    });

    test('should handle missing command parameter', async () => {
      const toolCall = createMockToolCall('command_executor_execute', {});
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        id: 'test-call',
        type: 'function',
        function: {
          name: 'command_executor_execute',
          arguments: 'invalid json'
        }
      };
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('execution_error');
    });

    test('should pass through command execution failures', async () => {
      const error = new Error('Command failed');
      error.code = 127;
      mockExec.mockRejectedValue(error);

      const toolCall = createMockToolCall('command_executor_execute', { 
        command: 'nonexistent-command' 
      });
      const result = await commandExecutor.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('exit_code');
      expect(result.data.exitCode).toBe(127);
    });
  });

  describe('execute method (legacy)', () => {
    test('should execute successfully and return data', async () => {
      const mockOutput = { stdout: 'success', stderr: '', command: 'test', exitCode: 0 };
      mockExec.mockResolvedValue({ stdout: 'success', stderr: '' });

      const result = await commandExecutor.execute('echo test');

      expect(result.stdout).toBe('success');
      expect(result.command).toBe('echo test');
      expect(result.exitCode).toBe(0);
    });

    test('should throw error on command failure', async () => {
      const error = new Error('Command failed');
      mockExec.mockRejectedValue(error);

      await expect(commandExecutor.execute('false')).rejects.toThrow();
    });
  });

  describe('parameter validation', () => {
    test('should validate required command parameter', () => {
      expect(() => commandExecutor.validateRequiredParameters({ command: 'ls' }, ['command']))
        .not.toThrow();
      expect(() => commandExecutor.validateRequiredParameters({}, ['command']))
        .toThrow();
    });
  });

  describe('security features', () => {
    test('should have comprehensive dangerous command detection', () => {
      const testCases = [
        { cmd: 'rm -rf /', expectBlocked: true },
        { cmd: 'dd if=/dev/zero', expectBlocked: true },
        { cmd: 'ls -la', expectBlocked: false },
        { cmd: 'echo "rm -rf /"', expectBlocked: false }, // Quoted, safe
        { cmd: 'cat file.txt', expectBlocked: false },
        { cmd: 'mkdir test && rm -rf /', expectBlocked: true }
      ];

      testCases.forEach(async ({ cmd, expectBlocked }) => {
        if (expectBlocked) {
          const result = await commandExecutor.executeCommand(cmd);
          expect(result.success).toBe(false);
          expect(result.data.errorType).toBe('dangerous_command');
        }
      });
    });

    test('should configure shell and buffer limits', async () => {
      const mockOutput = { stdout: 'test', stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      await commandExecutor.executeCommand('echo test');

      expect(mockExec).toHaveBeenCalledWith(
        'echo test',
        expect.objectContaining({
          shell: '/bin/bash',
          maxBuffer: 1024 * 1024 * 10
        })
      );
    });
  });

  describe('edge cases', () => {
    test('should handle empty stdout/stderr', async () => {
      const mockOutput = { stdout: undefined, stderr: undefined };
      mockExec.mockResolvedValue(mockOutput);

      const result = await commandExecutor.executeCommand('true');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('');
      expect(result.data.stderr).toBe('');
    });

    test('should handle very long command output', async () => {
      const longOutput = 'x'.repeat(1000000); // 1MB of output
      const mockOutput = { stdout: longOutput, stderr: '' };
      mockExec.mockResolvedValue(mockOutput);

      const result = await commandExecutor.executeCommand('generate-large-output');

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe(longOutput);
    });
  });
});