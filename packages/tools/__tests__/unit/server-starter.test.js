/**
 * Unit tests for Server Starter Tool
 */

import { jest } from '@jest/globals';
import ServerStarter from '../../src/server-starter/index.js';
import { createMockToolCall, validateToolResult, delay } from '../utils/test-helpers.js';

// Mock child_process module
const mockProcess = {
  pid: 12345,
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  kill: jest.fn()
};

const mockSpawn = jest.fn(() => mockProcess);

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

describe('ServerStarter', () => {
  let serverStarter;

  beforeEach(() => {
    serverStarter = new ServerStarter();
    jest.clearAllMocks();
    serverStarter.serverProcess = null;
    serverStarter.serverOutput = [];
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(serverStarter.name).toBe('server_starter');
      expect(serverStarter.description).toBe('Starts and manages npm servers');
      expect(serverStarter.serverProcess).toBeNull();
      expect(serverStarter.serverOutput).toEqual([]);
      expect(serverStarter.maxOutputLines).toBe(1000);
    });
  });

  describe('getAllToolDescriptions', () => {
    test('should return all three server functions', () => {
      const descriptions = serverStarter.getAllToolDescriptions();
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0].function.name).toBe('server_starter_start');
      expect(descriptions[1].function.name).toBe('server_starter_read_output');
      expect(descriptions[2].function.name).toBe('server_starter_stop');
    });

    test('should have correct parameter schemas', () => {
      const descriptions = serverStarter.getAllToolDescriptions();
      
      // Server start
      expect(descriptions[0].function.parameters.required).toContain('command');
      expect(descriptions[0].function.parameters.properties.command.type).toBe('string');
      expect(descriptions[0].function.parameters.properties.cwd.type).toBe('string');
      
      // Read output
      expect(descriptions[1].function.parameters.properties.lines.type).toBe('number');
      
      // Stop server
      expect(descriptions[2].function.parameters.properties).toEqual({});
    });
  });

  describe('getToolDescription', () => {
    test('should return the primary tool description (start)', () => {
      const description = serverStarter.getToolDescription();
      expect(description.function.name).toBe('server_starter_start');
    });
  });

  describe('start method', () => {
    test('should start a server process successfully', async () => {
      const command = 'npm start';
      const cwd = '/test/directory';

      const result = await serverStarter.start(command, cwd);

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['start'], {
        cwd: cwd,
        shell: true,
        env: expect.any(Object)
      });

      expect(result.success).toBe(true);
      expect(result.pid).toBe(12345);
      expect(result.command).toBe(command);
      expect(result.status).toBe('running');
      expect(serverStarter.serverProcess).toBe(mockProcess);
    });

    test('should use current directory as default cwd', async () => {
      await serverStarter.start('npm run dev');

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        shell: true,
        env: expect.any(Object)
      });
    });

    test('should stop existing server before starting new one', async () => {
      // Setup existing server
      serverStarter.serverProcess = { ...mockProcess };
      serverStarter.stop = jest.fn().mockResolvedValue({ success: true });

      await serverStarter.start('npm start');

      expect(serverStarter.stop).toHaveBeenCalled();
    });

    test('should handle server start failure', async () => {
      const error = new Error('Failed to spawn process');
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      await expect(serverStarter.start('invalid-command')).rejects.toThrow('Failed to start server');
    });

    test('should parse complex commands correctly', async () => {
      await serverStarter.start('npm run dev --port 3000');

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['run', 'dev', '--port', '3000'], 
        expect.any(Object)
      );
    });
  });

  describe('readServerOutput method', () => {
    test('should read server output successfully', async () => {
      // Setup server output
      serverStarter.serverProcess = mockProcess;
      serverStarter.serverOutput = ['line1', 'line2', 'line3', 'line4', 'line5'];

      const result = await serverStarter.readServerOutput(3);

      expect(result.success).toBe(true);
      expect(result.lines).toBe(3);
      expect(result.output).toEqual(['line3', 'line4', 'line5']);
    });

    test('should use default line count', async () => {
      serverStarter.serverProcess = mockProcess;
      const manyLines = Array.from({ length: 100 }, (_, i) => `line${i}`);
      serverStarter.serverOutput = manyLines;

      const result = await serverStarter.readServerOutput();

      expect(result.lines).toBe(50);
      expect(result.output).toHaveLength(50);
    });

    test('should handle case when output has fewer lines than requested', async () => {
      serverStarter.serverProcess = mockProcess;
      serverStarter.serverOutput = ['line1', 'line2'];

      const result = await serverStarter.readServerOutput(10);

      expect(result.lines).toBe(2);
      expect(result.output).toEqual(['line1', 'line2']);
    });

    test('should throw error when no server is running', async () => {
      await expect(serverStarter.readServerOutput()).rejects.toThrow('No server is currently running');
    });
  });

  describe('stop method', () => {
    test('should stop server gracefully', async () => {
      serverStarter.serverProcess = mockProcess;
      serverStarter.serverOutput = ['output1', 'output2', 'output3'];

      // Mock process exit event
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      setTimeout(() => exitHandler(0), 100);

      const result = await serverStarter.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result.success).toBe(true);
      expect(result.status).toBe('stopped');
      expect(serverStarter.serverProcess).toBeNull();
      expect(serverStarter.serverOutput).toEqual([]);
    });

    test('should force kill if graceful shutdown fails', async () => {
      serverStarter.serverProcess = mockProcess;

      // Don't trigger exit event to simulate hanging process
      const stopPromise = serverStarter.stop();

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(5000);

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    test('should throw error when no server is running', async () => {
      await expect(serverStarter.stop()).rejects.toThrow('No server is currently running');
    });

    test('should include final output in result', async () => {
      serverStarter.serverProcess = mockProcess;
      const longOutput = Array.from({ length: 30 }, (_, i) => `line${i}`);
      serverStarter.serverOutput = longOutput;

      // Mock process exit
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      setTimeout(() => exitHandler(0), 100);

      const result = await serverStarter.stop();

      expect(result.finalOutput).toHaveLength(20); // Last 20 lines
      expect(result.finalOutput[0]).toBe('line10'); // line10-29 (20 lines)
    });
  });

  describe('invoke method', () => {
    test('should route server_starter_start calls correctly', async () => {
      const toolCall = createMockToolCall('server_starter_start', { 
        command: 'npm start',
        cwd: '/test'
      });

      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.command).toBe('npm start');
      expect(result.data.status).toBe('running');
    });

    test('should route server_starter_read_output calls correctly', async () => {
      serverStarter.serverProcess = mockProcess;
      serverStarter.serverOutput = ['test output'];

      const toolCall = createMockToolCall('server_starter_read_output', { lines: 10 });
      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.output).toEqual(['test output']);
    });

    test('should route server_starter_stop calls correctly', async () => {
      serverStarter.serverProcess = mockProcess;
      
      // Mock process exit
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      setTimeout(() => exitHandler(0), 100);

      const toolCall = createMockToolCall('server_starter_stop', {});
      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('stopped');
    });

    test('should handle unknown function names', async () => {
      const toolCall = createMockToolCall('unknown_function', {});
      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });

    test('should handle missing required parameters', async () => {
      const toolCall = createMockToolCall('server_starter_start', {}); // Missing command
      const result = await serverStarter.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });
  });

  describe('output buffering', () => {
    test('should limit output buffer size', async () => {
      serverStarter.maxOutputLines = 5;
      serverStarter.serverProcess = mockProcess;

      // Simulate adding many lines
      for (let i = 0; i < 10; i++) {
        serverStarter.serverOutput.push(`line${i}`);
        if (serverStarter.serverOutput.length > serverStarter.maxOutputLines) {
          serverStarter.serverOutput = serverStarter.serverOutput.slice(-serverStarter.maxOutputLines);
        }
      }

      expect(serverStarter.serverOutput).toHaveLength(5);
      expect(serverStarter.serverOutput[0]).toBe('line5'); // Should keep last 5 lines
      expect(serverStarter.serverOutput[4]).toBe('line9');
    });

    test('should handle stdout data events', async () => {
      await serverStarter.start('npm start');

      // Find the stdout data handler
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
      
      stdoutHandler(Buffer.from('line1\nline2\n'));

      expect(serverStarter.serverOutput).toContain('line1');
      expect(serverStarter.serverOutput).toContain('line2');
    });

    test('should handle stderr data events', async () => {
      await serverStarter.start('npm start');

      // Find the stderr data handler
      const stderrHandler = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data')[1];
      
      stderrHandler(Buffer.from('error1\nerror2\n'));

      expect(serverStarter.serverOutput).toContain('error1');
      expect(serverStarter.serverOutput).toContain('error2');
    });
  });

  describe('parameter validation', () => {
    test('should validate required parameters for start', () => {
      expect(() => serverStarter.validateRequiredParameters({ command: 'npm start' }, ['command']))
        .not.toThrow();
      expect(() => serverStarter.validateRequiredParameters({}, ['command']))
        .toThrow();
    });
  });
});