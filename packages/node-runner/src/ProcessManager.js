import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import treeKill from 'tree-kill';
import crypto from 'crypto';

/**
 * Manages the lifecycle of Node.js processes
 */
export class ProcessManager extends EventEmitter {
  constructor(logManager = null) {
    super();
    this.processes = new Map();
    this.logManager = logManager;
    this.setupCleanupHandlers();
  }

  /**
   * Generate unique process ID
   */
  generateId(command) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `process-${timestamp}-${random}`;
  }

  /**
   * Start a new process
   */
  async startProcess(command, args = [], options = {}) {
    const processId = options.id || this.generateId(command);
    
    if (this.processes.has(processId)) {
      throw new Error(`Process with ID ${processId} already exists`);
    }

    const {
      cwd = process.cwd(),
      env = process.env,
      shell = false,
      detached = false,
      stdio = 'pipe'
    } = options;

    try {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell,
        detached,
        stdio
      });

      const processInfo = {
        id: processId,
        command,
        args,
        options,
        process: child,
        pid: child.pid,
        startTime: new Date(),
        status: 'running',
        exitCode: null,
        logs: {
          stdout: [],
          stderr: []
        }
      };

      // Handle process events
      child.on('error', (error) => {
        processInfo.status = 'error';
        this.emit('process-error', { processId, error });
      });

      child.on('exit', (code, signal) => {
        processInfo.status = 'exited';
        processInfo.exitCode = code;
        processInfo.exitSignal = signal;
        processInfo.endTime = new Date();
        this.emit('process-exit', { processId, code, signal });
      });

      // Capture output if stdio is pipe
      if (stdio === 'pipe') {
        // If we have a LogManager, use it for capturing logs
        if (this.logManager && child.stdout && child.stderr) {
          await this.logManager.captureLogs({
            source: {
              type: 'process',
              id: processId,
              pid: child.pid,
              stdout: child.stdout,
              stderr: child.stderr
            }
          });
          
          // Also set up the process log capture reference
          processInfo.logCaptureEnabled = true;
        }
        
        // Still emit events for backward compatibility and real-time monitoring
        if (child.stdout) {
          child.stdout.on('data', (data) => {
            const text = data.toString();
            // Only buffer logs if no LogManager is present
            if (!this.logManager) {
              processInfo.logs.stdout.push({
                timestamp: new Date(),
                data: text
              });
            }
            this.emit('stdout', { processId, data: text });
          });
        }

        if (child.stderr) {
          child.stderr.on('data', (data) => {
            const text = data.toString();
            // Only buffer logs if no LogManager is present
            if (!this.logManager) {
              processInfo.logs.stderr.push({
                timestamp: new Date(),
                data: text
              });
            }
            this.emit('stderr', { processId, data: text });
          });
        }
      }

      this.processes.set(processId, processInfo);
      this.emit('process-start', { processId, pid: child.pid });

      return {
        id: processId,
        pid: child.pid,
        status: 'running',
        startTime: processInfo.startTime
      };
    } catch (error) {
      throw new Error(`Failed to start process: ${error.message}`);
    }
  }

  /**
   * Stop a process
   */
  async stopProcess(processId, options = {}) {
    const processInfo = this.processes.get(processId);
    
    if (!processInfo) {
      throw new Error(`Process ${processId} not found`);
    }

    if (processInfo.status !== 'running') {
      return {
        id: processId,
        status: processInfo.status,
        message: 'Process already stopped'
      };
    }

    const { force = false, timeout = 5000 } = options;
    const { process: child, pid } = processInfo;

    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
      };

      // Set up timeout for graceful shutdown
      if (!force) {
        timeoutId = setTimeout(() => {
          cleanup();
          // Force kill if graceful shutdown times out
          treeKill(pid, 'SIGKILL', (err) => {
            if (err) {
              reject(new Error(`Failed to force kill process: ${err.message}`));
            } else {
              processInfo.status = 'killed';
              resolve({
                id: processId,
                status: 'killed',
                message: 'Process force killed after timeout'
              });
            }
          });
        }, timeout);
      }

      // Listen for process exit
      child.once('exit', async () => {
        cleanup();
        processInfo.status = 'stopped';
        
        // Stop log capture if enabled
        if (this.logManager && processInfo.logCaptureEnabled) {
          try {
            await this.logManager.stopCapture(processId);
          } catch (error) {
            // Log capture might already be stopped
          }
        }
        
        resolve({
          id: processId,
          status: 'stopped',
          message: 'Process stopped gracefully'
        });
      });

      // Send termination signal
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      treeKill(pid, signal, (err) => {
        if (err) {
          cleanup();
          reject(new Error(`Failed to stop process: ${err.message}`));
        }
      });
    });
  }

  /**
   * Restart a process
   */
  async restartProcess(processId, newOptions = {}) {
    const processInfo = this.processes.get(processId);
    
    if (!processInfo) {
      throw new Error(`Process ${processId} not found`);
    }

    const { command, args, options: originalOptions } = processInfo;
    const mergedOptions = { ...originalOptions, ...newOptions, id: processId };

    // Stop the process first
    if (processInfo.status === 'running') {
      await this.stopProcess(processId);
    }

    // Remove from map so we can restart with same ID
    this.processes.delete(processId);

    // Start with merged options
    return this.startProcess(command, args, mergedOptions);
  }

  /**
   * Get process information
   */
  getProcess(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      return null;
    }

    const { logs, ...info } = processInfo;
    return {
      ...info,
      memory: info.process.killed ? null : process.memoryUsage(),
      uptime: info.startTime ? Date.now() - info.startTime.getTime() : 0
    };
  }

  /**
   * List all processes
   */
  listProcesses() {
    const processes = [];
    
    for (const [id, processInfo] of this.processes) {
      const { process: child, logs, ...info } = processInfo;
      processes.push({
        ...info,
        memory: child.killed ? null : process.memoryUsage(),
        uptime: info.startTime ? Date.now() - info.startTime.getTime() : 0
      });
    }

    return processes;
  }

  /**
   * Kill process on specific port
   */
  async killProcessOnPort(port) {
    try {
      // Use execa to find process on port
      const { execa } = await import('execa');
      
      let pid;
      if (process.platform === 'win32') {
        // Windows command
        const { stdout } = await execa('netstat', ['-ano']);
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            pid = parts[parts.length - 1];
            break;
          }
        }
      } else {
        // Unix/Linux/Mac command
        try {
          const { stdout } = await execa('lsof', ['-ti', `:${port}`]);
          pid = stdout.trim();
        } catch (error) {
          // Try alternative command
          const { stdout } = await execa('sh', ['-c', `ss -lptn 'sport = :${port}' | grep -oP '(?<=pid=)\\d+'`]);
          pid = stdout.trim();
        }
      }

      if (pid) {
        process.kill(pid, 'SIGKILL');
        return {
          success: true,
          port,
          pid,
          message: `Killed process ${pid} on port ${port}`
        };
      } else {
        return {
          success: false,
          port,
          message: `No process found on port ${port}`
        };
      }
    } catch (error) {
      throw new Error(`Failed to kill process on port ${port}: ${error.message}`);
    }
  }

  /**
   * Get process logs
   */
  getProcessLogs(processId, options = {}) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`Process ${processId} not found`);
    }

    const { stream = 'all', limit = 100 } = options;

    // If LogManager is available and log capture is enabled, get logs from there
    if (this.logManager && processInfo.logCaptureEnabled) {
      const sources = [];
      if (stream === 'stdout' || stream === 'all') {
        sources.push(`${processId}-stdout`);
      }
      if (stream === 'stderr' || stream === 'all') {
        sources.push(`${processId}-stderr`);
      }
      
      // Get logs from LogManager
      const allLogs = [];
      for (const sourceId of sources) {
        try {
          const result = this.logManager.capture.getBufferedLogs(sourceId, { limit });
          allLogs.push(...result.logs);
        } catch (error) {
          // Source might not exist, continue
        }
      }
      
      // Convert LogManager format to ProcessManager format
      return allLogs.map(log => ({
        timestamp: log.timestamp,
        data: log.message,
        type: log.type
      })).slice(-limit);
    }

    // Fall back to internal buffers if no LogManager
    const logs = [];
    if (stream === 'stdout' || stream === 'all') {
      logs.push(...processInfo.logs.stdout.slice(-limit));
    }
    if (stream === 'stderr' || stream === 'all') {
      logs.push(...processInfo.logs.stderr.slice(-limit));
    }

    // Sort by timestamp
    logs.sort((a, b) => a.timestamp - b.timestamp);
    return logs;
  }

  /**
   * Clear process logs
   */
  clearProcessLogs(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`Process ${processId} not found`);
    }

    processInfo.logs.stdout = [];
    processInfo.logs.stderr = [];

    return {
      id: processId,
      message: 'Logs cleared'
    };
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanupHandlers() {
    const cleanup = async () => {
      console.log('Cleaning up processes...');
      const runningProcesses = Array.from(this.processes.values())
        .filter(p => p.status === 'running');

      await Promise.all(
        runningProcesses.map(p => 
          this.stopProcess(p.id, { force: true }).catch(() => {})
        )
      );
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Cleanup all processes
   */
  async cleanup() {
    const runningProcesses = Array.from(this.processes.values())
      .filter(p => p.status === 'running');

    await Promise.all(
      runningProcesses.map(p => 
        this.stopProcess(p.id, { force: true })
      )
    );

    this.processes.clear();
  }
}