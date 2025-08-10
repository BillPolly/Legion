/**
 * @fileoverview ProcessManager - Manages Node.js process execution and lifecycle
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { generateId } from '../utils/index.js';

export class ProcessManager {
  constructor(logStorage) {
    this.logStorage = logStorage;
    this.processes = new Map(); // processId -> { process, info }
  }

  /**
   * Start a new Node.js process
   * @param {Object} options - Process options
   * @param {string} options.command - Command to execute
   * @param {string[]} options.args - Command arguments
   * @param {string} options.workingDir - Working directory
   * @param {string} options.sessionId - Session ID for logging
   * @param {Object} options.instrumentation - Sidewinder instrumentation options
   * @returns {Promise<{processId: string, process: ChildProcess}>}
   */
  async start({ command, args = [], workingDir, sessionId, instrumentation }) {
    // Validate inputs
    if (!command || typeof command !== 'string' || command.trim() === '') {
      throw new Error('Command is required');
    }

    if (!workingDir || !existsSync(workingDir)) {
      throw new Error('Working directory does not exist');
    }

    const processId = generateId();
    const startTime = new Date();
    
    // Prepare environment and args for instrumentation
    let processEnv = { ...process.env };
    let processArgs = [...args];
    
    // Add Sidewinder instrumentation if configured
    if (instrumentation && instrumentation.enabled) {
      // Check if this is a Node.js process
      if (command === 'node' || command.endsWith('/node')) {
        try {
          const { Sidewinder } = await import('@legion/sidewinder');
          
          const sidewinder = new Sidewinder({
            wsPort: instrumentation.wsPort || process.env.SIDEWINDER_WS_PORT || 9898,
            wsHost: instrumentation.wsHost || 'localhost',
            sessionId: sessionId || processId,
            profile: instrumentation.profile || 'standard',
            hooks: instrumentation.hooks,
            debug: instrumentation.debug || false,
            ...instrumentation
          });
          
          // Prepare injection script
          const injectPath = await sidewinder.prepare();
          
          // Add --require flag before the script
          const scriptIndex = processArgs.findIndex(arg => !arg.startsWith('-'));
          if (scriptIndex >= 0) {
            processArgs.splice(scriptIndex, 0, '--require', injectPath);
          } else {
            processArgs.unshift('--require', injectPath);
          }
          
          console.log(`[ProcessManager] Sidewinder instrumentation enabled for ${sessionId}`);
        } catch (err) {
          console.error('[ProcessManager] Failed to setup Sidewinder:', err);
          // Continue without instrumentation
        }
      }
    }

    // Spawn the process
    const childProcess = spawn(command, processArgs, {
      cwd: workingDir,
      stdio: 'pipe',
      env: processEnv
    });

    // Store process info
    const processInfo = {
      processId,
      command,
      args,
      workingDir,
      sessionId,
      startTime,
      status: 'running',
      pid: childProcess.pid
    };

    this.processes.set(processId, {
      process: childProcess,
      info: processInfo
    });

    // Set up logging for stdout
    childProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        this.logStorage.logMessage({
          sessionId,
          processId,
          source: 'stdout',
          message,
          timestamp: new Date()
        }).catch(err => console.error('Failed to log stdout:', err));
      }
    });

    // Set up logging for stderr
    childProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        this.logStorage.logMessage({
          sessionId,
          processId,
          source: 'stderr',
          message,
          timestamp: new Date()
        }).catch(err => console.error('Failed to log stderr:', err));
      }
    });

    // Handle process events
    childProcess.on('spawn', () => {
      this.logStorage.logMessage({
        sessionId,
        processId,
        source: 'system',
        message: `Process started: ${command} ${args.join(' ')} (PID: ${childProcess.pid})`,
        timestamp: new Date()
      }).catch(err => console.error('Failed to log spawn:', err));
    });

    childProcess.on('exit', (code, signal) => {
      // Small delay to ensure stdout/stderr events are processed first
      setTimeout(() => {
        const processEntry = this.processes.get(processId);
        if (processEntry) {
          processEntry.info.status = 'exited';
          processEntry.info.exitCode = code;
          processEntry.info.signal = signal;
          processEntry.info.endTime = new Date();
        }

        this.logStorage.logMessage({
          sessionId,
          processId,
          source: 'system',
          message: `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
          timestamp: new Date()
        }).catch(err => console.error('Failed to log exit:', err));
      }, 10);
    });

    childProcess.on('error', (error) => {
      const processEntry = this.processes.get(processId);
      if (processEntry) {
        processEntry.info.status = 'error';
        processEntry.info.error = error.message;
      }

      this.logStorage.logMessage({
        sessionId,
        processId,
        source: 'system',
        message: `Process error: ${error.message}`,
        timestamp: new Date()
      }).catch(err => console.error('Failed to log error:', err));
    });

    return { processId, process: childProcess };
  }

  /**
   * Get list of running process IDs
   * @returns {string[]} Array of process IDs
   */
  getRunningProcesses() {
    const running = [];
    for (const [processId, { info }] of this.processes.entries()) {
      if (info.status === 'running') {
        running.push(processId);
      }
    }
    return running;
  }

  /**
   * Get process information by ID
   * @param {string} processId - Process ID
   * @returns {Object|null} Process information or null if not found
   */
  getProcessInfo(processId) {
    const processEntry = this.processes.get(processId);
    return processEntry ? { ...processEntry.info } : null;
  }

  /**
   * Kill a process by ID
   * @param {string} processId - Process ID
   * @returns {Promise<boolean>} True if killed, false if not found
   */
  async kill(processId) {
    const processEntry = this.processes.get(processId);
    if (!processEntry) {
      return false;
    }

    const { process: childProcess, info } = processEntry;

    // If already exited, just update status
    if (info.status !== 'running') {
      return true;
    }

    try {
      childProcess.kill('SIGTERM');
      
      // Give process time to exit gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // If still running, force kill
      if (!childProcess.killed && info.status === 'running') {
        childProcess.kill('SIGKILL');
      }

      info.status = 'killed';
      return true;
    } catch (error) {
      // Process might already be dead
      return true;
    }
  }

  /**
   * Kill all running processes
   * @returns {Promise<void>}
   */
  async killAll() {
    const running = this.getRunningProcesses();
    const killPromises = running.map(processId => this.kill(processId));
    await Promise.all(killPromises);

    // Clean up terminated processes from memory
    for (const [processId, { info }] of this.processes.entries()) {
      if (info.status !== 'running') {
        this.processes.delete(processId);
      }
    }
  }
}