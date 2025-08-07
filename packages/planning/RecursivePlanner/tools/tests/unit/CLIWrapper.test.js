/**
 * Tests for CLI Tool Wrapping
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  CLIWrapper,
  createCLITool,
  parseOutput,
  handleExitCode,
  streamToString
} from '../../src/utils/CLIWrapper.js';

// Mock child_process
const mockSpawn = jest.fn();
const mockExec = jest.fn();
const mockExecSync = jest.fn();

describe('CLI Tool Wrapping', () => {
  describe('CLIWrapper - Command execution', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = new CLIWrapper('git', {
        spawn: mockSpawn,
        exec: mockExec,
        execSync: mockExecSync
      });
      mockSpawn.mockClear();
      mockExec.mockClear();
      mockExecSync.mockClear();
    });

    test('should execute simple command', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, 'output', '');
      });

      const result = await wrapper.execute(['status']);
      
      expect(mockExec).toHaveBeenCalledWith(
        'git status',
        expect.any(Function)
      );
      expect(result.stdout).toBe('output');
      expect(result.exitCode).toBe(0);
    });

    test('should handle command with arguments', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, 'commit message', '');
      });

      const result = await wrapper.execute(['log', '-1', '--oneline']);
      
      expect(mockExec).toHaveBeenCalledWith(
        'git log -1 --oneline',
        expect.any(Function)
      );
      expect(result.stdout).toBe('commit message');
    });

    test('should handle command errors', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        const error = new Error('Command failed');
        error.code = 128;
        callback(error, '', 'fatal: not a git repository');
      });

      const result = await wrapper.execute(['status']);
      
      expect(result.exitCode).toBe(128);
      expect(result.stderr).toContain('not a git repository');
      expect(result.success).toBe(false);
    });

    test('should support spawn for streaming', async () => {
      const mockProcess = {
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Simulate stdout data
      mockProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          handler(Buffer.from('line1\n'));
          handler(Buffer.from('line2\n'));
        }
      });

      // Simulate process exit
      mockProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          handler(0);
        }
      });

      const result = await wrapper.spawnCommand(['log', '--oneline']);
      
      expect(mockSpawn).toHaveBeenCalledWith('git', ['log', '--oneline'], {});
      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
    });

    test('should support options like cwd and env', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, 'success', '');
      });

      const result = await wrapper.execute(['status'], {
        cwd: '/path/to/repo',
        env: { GIT_AUTHOR_NAME: 'Test' }
      });

      expect(mockExec).toHaveBeenCalledWith(
        'git status',
        {
          cwd: '/path/to/repo',
          env: expect.objectContaining({ GIT_AUTHOR_NAME: 'Test' })
        },
        expect.any(Function)
      );
    });

    test('should support timeout', async () => {
      let timeoutId;
      mockExec.mockImplementation((cmd, options, callback) => {
        timeoutId = setTimeout(() => {
          callback(null, { stdout: 'completed', stderr: '' });
        }, 1000);
      });

      const promise = wrapper.execute(['status'], { timeout: 500 });

      await expect(promise).rejects.toThrow('Command timed out');
      clearTimeout(timeoutId);
    });
  });

  describe('createCLITool - Tool creation from CLI', () => {
    test('should create tool from simple CLI command', async () => {
      const tool = createCLITool({
        command: 'echo',
        args: ['${message}'],
        description: 'Echo a message'
      });

      mockExec.mockImplementation((cmd, callback) => {
        callback(null, 'Hello World', '');
      });

      const result = await tool.execute({ message: 'Hello World' }, { exec: mockExec });
      expect(result.stdout).toBe('Hello World');
    });

    test('should support argument templates', async () => {
      const tool = createCLITool({
        command: 'curl',
        args: ['-X', '${method}', '${url}'],
        description: 'Make HTTP request'
      });

      mockExec.mockImplementation((cmd, callback) => {
        expect(cmd).toBe('curl -X GET https://api.example.com');
        callback(null, '{"status":"ok"}', '');
      });

      await tool.execute({ 
        method: 'GET', 
        url: 'https://api.example.com' 
      }, { exec: mockExec });
    });

    test('should support conditional arguments', async () => {
      const tool = createCLITool({
        command: 'ls',
        args: (input) => {
          const args = [];
          if (input.all) args.push('-a');
          if (input.long) args.push('-l');
          args.push(input.path || '.');
          return args;
        }
      });

      mockExec.mockImplementation((cmd, callback) => {
        expect(cmd).toBe('ls -a -l /home');
        callback(null, 'files', '');
      });

      await tool.execute({ 
        all: true, 
        long: true,
        path: '/home'
      }, { exec: mockExec });
    });

    test('should support output parsing', async () => {
      const tool = createCLITool({
        command: 'docker',
        args: ['ps', '--format', 'json'],
        parseOutput: (stdout) => {
          return stdout.split('\n')
            .filter(line => line)
            .map(line => JSON.parse(line));
        }
      });

      mockExec.mockImplementation((cmd, callback) => {
        callback(null, '{"id":"abc123","name":"container1"}\n{"id":"def456","name":"container2"}', '');
      });

      const result = await tool.execute({}, { exec: mockExec });
      expect(result).toEqual([
        { id: 'abc123', name: 'container1' },
        { id: 'def456', name: 'container2' }
      ]);
    });

    test('should validate input schema', async () => {
      const tool = createCLITool({
        command: 'git',
        args: ['commit', '-m', '${message}'],
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', required: true }
          }
        }
      });

      await expect(tool.execute({})).rejects.toThrow('Input validation failed');
      
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, 'committed', '');
      });

      const result = await tool.execute({ message: 'test' }, { exec: mockExec });
      expect(result.stdout).toBe('committed');
    });
  });

  describe('Output parsing utilities', () => {
    test('parseOutput should handle JSON', () => {
      const output = '{"key":"value","number":42}';
      const parsed = parseOutput(output, 'json');
      expect(parsed).toEqual({ key: 'value', number: 42 });
    });

    test('parseOutput should handle CSV', () => {
      const output = 'name,age\nJohn,30\nJane,25';
      const parsed = parseOutput(output, 'csv');
      expect(parsed).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' }
      ]);
    });

    test('parseOutput should handle line-based output', () => {
      const output = 'line1\nline2\nline3';
      const parsed = parseOutput(output, 'lines');
      expect(parsed).toEqual(['line1', 'line2', 'line3']);
    });

    test('parseOutput should handle custom parser', () => {
      const output = 'key1=value1;key2=value2';
      const parser = (str) => {
        const obj = {};
        str.split(';').forEach(pair => {
          const [key, value] = pair.split('=');
          obj[key] = value;
        });
        return obj;
      };
      
      const parsed = parseOutput(output, parser);
      expect(parsed).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('Error handling', () => {
    test('handleExitCode should categorize exit codes', () => {
      expect(handleExitCode(0)).toEqual({ success: true, code: 0 });
      expect(handleExitCode(1)).toEqual({ 
        success: false, 
        code: 1, 
        category: 'general_error' 
      });
      expect(handleExitCode(127)).toEqual({ 
        success: false, 
        code: 127, 
        category: 'command_not_found' 
      });
      expect(handleExitCode(130)).toEqual({ 
        success: false, 
        code: 130, 
        category: 'interrupted' 
      });
    });

    test('should handle signals', () => {
      const result = handleExitCode(null, 'SIGTERM');
      expect(result.success).toBe(false);
      expect(result.signal).toBe('SIGTERM');
      expect(result.category).toBe('terminated');
    });
  });

  describe('Stream utilities', () => {
    test('streamToString should convert stream to string', async () => {
      const { Readable } = await import('stream');
      const stream = Readable.from(['Hello', ' ', 'World']);
      
      const result = await streamToString(stream);
      expect(result).toBe('Hello World');
    });

    test('should handle stream errors', async () => {
      const { Readable } = await import('stream');
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        }
      });

      await expect(streamToString(stream)).rejects.toThrow('Stream error');
    });
  });

  describe('Advanced CLI patterns', () => {
    test('should support piping commands', async () => {
      const wrapper = new CLIWrapper();
      
      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('|')) {
          callback(null, 'piped output', '');
        }
      });

      const result = await wrapper.pipe(
        ['ps', 'aux'],
        ['grep', 'node'],
        ['wc', '-l'],
        { exec: mockExec }
      );

      expect(mockExec).toHaveBeenCalledWith(
        'ps aux | grep node | wc -l',
        expect.any(Function)
      );
    });

    test('should support interactive commands with stdin', async () => {
      const mockProcess = {
        stdin: { write: jest.fn(), end: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      mockProcess.on.mockImplementation((event, handler) => {
        if (event === 'close') handler(0);
      });

      const wrapper = new CLIWrapper('python', { spawn: mockSpawn });
      await wrapper.interactive(['script.py'], 'input data\n');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('input data\n');
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });

    test('should create resource handles for long-running processes', async () => {
      const wrapper = new CLIWrapper('server', { spawn: mockSpawn });
      
      const mockProcess = {
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess);

      const handle = await wrapper.startProcess(['--port', '3000']);
      
      expect(handle.type).toBe('process');
      expect(handle.pid).toBe(12345);
      expect(handle.command).toBe('server --port 3000');
      
      // Test cleanup
      await wrapper.stopProcess(handle);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});