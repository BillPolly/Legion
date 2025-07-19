import { jest } from '@jest/globals';

// Mock child_process module before importing ProcessManager
const mockProcess = {
  pid: 12345,
  stdout: { on: jest.fn(), pipe: jest.fn() },
  stderr: { on: jest.fn(), pipe: jest.fn() },
  on: jest.fn(),
  once: jest.fn(),
  kill: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockSpawn = jest.fn(() => mockProcess);

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

// Import ProcessManager after mocking
const ProcessManager = (await import('../../../src/utils/ProcessManager.js')).default;

describe('ProcessManager', () => {
  let processManager;

  beforeEach(() => {
    processManager = new ProcessManager();
    jest.clearAllMocks();
    
    // Reset mock for each test
    mockSpawn.mockReturnValue(mockProcess);
    
    // Reset mock function implementations
    mockProcess.on.mockImplementation((event, callback) => mockProcess);
    mockProcess.once.mockImplementation((event, callback) => mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Process Starting', () => {
    test('should start a process with command', async () => {
      const config = {
        command: 'node server.js',
        cwd: '/test/path',
        env: { PORT: '3000' }
      };

      // Simulate successful spawn
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') {
          setTimeout(() => callback(), 0);
        }
        return mockProcess;
      });

      const result = await processManager.start(config);

      expect(mockSpawn).toHaveBeenCalledWith('node', ['server.js'], {
        cwd: '/test/path',
        env: expect.objectContaining({ PORT: '3000' }),
        shell: false
      });

      expect(result).toEqual({
        id: expect.any(String),
        pid: 12345,
        command: 'node server.js',
        status: 'running',
        startTime: expect.any(Date)
      });
    });

    test('should handle npm scripts', async () => {
      const config = {
        command: 'npm start',
        cwd: '/test/path'
      };

      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      await processManager.start(config);

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['start'], expect.any(Object));
    });

    test('should handle spawn errors', async () => {
      const config = {
        command: 'invalid-command',
        cwd: '/test/path'
      };

      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(new Error('spawn ENOENT'));
        }
        return mockProcess;
      });

      await expect(processManager.start(config)).rejects.toThrow('Failed to start process: spawn ENOENT');
    });

    test('should track multiple processes', async () => {
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const process1 = await processManager.start({ command: 'node app1.js' });
      
      // Create new mock for second process
      const mockProcess2 = {
        pid: 12346,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => mockProcess2),
        once: jest.fn((event, callback) => {
          if (event === 'spawn') callback();
          return mockProcess2;
        }),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValueOnce(mockProcess2);
      
      const process2 = await processManager.start({ command: 'node app2.js' });

      const processes = processManager.list();
      expect(processes).toHaveLength(2);
      expect(processes[0].id).toBe(process1.id);
      expect(processes[1].id).toBe(process2.id);
    });
  });

  describe('Process Lifecycle', () => {
    let processId;

    beforeEach(async () => {
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const result = await processManager.start({ command: 'node server.js' });
      processId = result.id;
    });

    test('should stop a process gracefully', async () => {
      // Create a promise that resolves when exit is called
      const stopPromise = processManager.stop(processId);
      
      // Find and call the exit handler
      const exitCall = mockProcess.once.mock.calls.find(call => call[0] === 'exit');
      if (exitCall && exitCall[1]) {
        exitCall[1](0, null);
      }

      const result = await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result).toEqual({
        id: processId,
        exitCode: 0,
        signal: null
      });
    });

    test('should force kill after timeout', async () => {
      jest.useFakeTimers();
      
      const stopPromise = processManager.stop(processId, { timeout: 100 });

      // Advance timer past timeout
      jest.advanceTimersByTime(150);
      
      // Find and call the exit handler
      const exitCall = mockProcess.once.mock.calls.find(call => call[0] === 'exit');
      if (exitCall && exitCall[1]) {
        exitCall[1](null, 'SIGKILL');
      }

      const result = await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(result.signal).toBe('SIGKILL');
      
      jest.useRealTimers();
    });

    test.skip('should restart a process', async () => {
      // Mock successful stop
      const newMockProcess = {
        pid: 54321,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => newMockProcess),
        once: jest.fn((event, callback) => {
          if (event === 'spawn') callback();
          if (event === 'exit') callback(0, null);
          return newMockProcess;
        }),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValueOnce(newMockProcess);

      const result = await processManager.restart(processId);

      expect(result.pid).toBe(54321);
      expect(result.id).toBe(processId); // Same ID maintained
    }, 10000);

    test('should get process status', () => {
      const status = processManager.getStatus(processId);

      expect(status).toEqual({
        id: processId,
        pid: 54321, // Updated after restart
        command: 'node server.js',
        status: 'running',
        uptime: expect.any(Number),
        startTime: expect.any(Date)
      });
    });

    test('should handle process crash', async () => {
      const onExit = jest.fn();
      processManager.on('process:exit', onExit);

      // Get the process info to access handlers
      const processInfo = processManager.processes.get(processId);
      
      // Simulate process crash by calling exit handler
      const exitHandler = processInfo.process.on.mock.calls.find(call => call[0] === 'exit');
      if (exitHandler && exitHandler[1]) {
        exitHandler[1](1, null);
      }

      expect(onExit).toHaveBeenCalledWith({
        id: processId,
        pid: 12345,
        exitCode: 1,
        signal: null,
        crashed: true
      });

      const status = processManager.getStatus(processId);
      expect(status.status).toBe('stopped');
    });
  });

  describe('Process Monitoring', () => {
    test('should collect stdout data', async () => {
      const onData = jest.fn();
      
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const result = await processManager.start({ 
        command: 'node server.js',
        captureOutput: true 
      });

      processManager.on('process:stdout', onData);

      // Get the stdout handler
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data');
      if (stdoutHandler && stdoutHandler[1]) {
        stdoutHandler[1](Buffer.from('Server started on port 3000\n'));
      }

      expect(onData).toHaveBeenCalledWith({
        id: result.id,
        data: 'Server started on port 3000\n'
      });
    });

    test('should collect stderr data', async () => {
      const onError = jest.fn();
      
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const result = await processManager.start({ 
        command: 'node server.js',
        captureOutput: true 
      });

      processManager.on('process:stderr', onError);

      // Get the stderr handler
      const stderrHandler = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data');
      if (stderrHandler && stderrHandler[1]) {
        stderrHandler[1](Buffer.from('Error: Connection failed\n'));
      }

      expect(onError).toHaveBeenCalledWith({
        id: result.id,
        data: 'Error: Connection failed\n'
      });
    });

    test('should limit output buffer size', async () => {
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const result = await processManager.start({ 
        command: 'node server.js',
        captureOutput: true,
        maxOutputSize: 100 // 100 bytes
      });

      // Get the stdout handler
      const stdoutHandler = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data');
      if (stdoutHandler && stdoutHandler[1]) {
        stdoutHandler[1](Buffer.from('A'.repeat(150)));
      }

      const logs = processManager.getLogs(result.id);
      expect(logs.stdout.length).toBeLessThanOrEqual(100);
      expect(logs.truncated).toBe(true);
    });
  });

  describe('Process Cleanup', () => {
    test('should clean up stopped processes', async () => {
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });

      const result = await processManager.start({ command: 'node server.js' });
      
      // Simulate stop
      const stopPromise = processManager.stop(result.id);
      const exitCall = mockProcess.once.mock.calls.find(call => call[0] === 'exit');
      if (exitCall && exitCall[1]) {
        exitCall[1](0, null);
      }
      await stopPromise;

      processManager.cleanup();

      const processes = processManager.list();
      expect(processes).toHaveLength(0);
    });

    test('should stop all processes on shutdown', async () => {
      mockProcess.once.mockImplementation((event, callback) => {
        if (event === 'spawn') callback();
        if (event === 'exit') callback(0, null);
        return mockProcess;
      });

      await processManager.start({ command: 'node app1.js' });
      await processManager.start({ command: 'node app2.js' });

      await processManager.stopAll();

      expect(mockProcess.kill).toHaveBeenCalledTimes(2);
      expect(processManager.list()).toHaveLength(0);
    });
  });
});