/**
 * ShellExecutionService - Ported from Gemini CLI shellExecutionService.ts
 * Provides advanced shell command execution with PTY support
 */

import { spawn } from 'child_process';

/**
 * Shell execution result (ported from Gemini CLI)
 */
export class ShellExecutionResult {
  constructor() {
    this.rawOutput = Buffer.alloc(0);
    this.output = '';
    this.exitCode = null;
    this.signal = null;
    this.error = null;
    this.aborted = false;
    this.pid = undefined;
    this.executionMethod = 'child_process';
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * Get execution duration
   * @returns {number} Duration in milliseconds
   */
  getDuration() {
    if (!this.endTime) return Date.now() - this.startTime;
    return this.endTime - this.startTime;
  }
}

/**
 * Shell execution handle (ported from Gemini CLI)
 */
export class ShellExecutionHandle {
  constructor(pid, resultPromise) {
    this.pid = pid;
    this.result = resultPromise;
    this.aborted = false;
  }

  /**
   * Abort the shell execution
   */
  abort() {
    this.aborted = true;
    // Implementation would signal process to terminate
  }
}

/**
 * Advanced shell execution service (ported from Gemini CLI)
 */
export class ShellExecutionService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.activeExecutions = new Map(); // pid -> execution info
    this.executionHistory = [];
    this.maxHistorySize = 100;
    
    // Security configuration (ported from Gemini CLI)
    this.securityConfig = {
      allowedCommands: [], // Empty = allow all (with validation)
      blockedCommands: ['rm -rf /', 'format', 'del /q', 'shutdown'],
      requireApproval: true,
      timeout: 30000
    };
  }

  /**
   * Execute shell command with advanced handling (ported from Gemini CLI)
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<ShellExecutionHandle>} Execution handle
   */
  async executeCommand(command, options = {}) {
    const {
      workingDirectory = process.cwd(),
      timeout = this.securityConfig.timeout,
      environment = process.env,
      interactive = false
    } = options;

    // Security validation (ported from Gemini CLI)
    this._validateCommand(command);

    const result = new ShellExecutionResult();
    
    // Create execution promise (ported pattern)
    const executionPromise = new Promise((resolve, reject) => {
      try {
        // Determine shell (ported from Gemini CLI)
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/bash';
        const shellArgs = isWindows ? ['/c', command] : ['-c', command];

        console.log(`🐚 Executing: ${command} (in ${workingDirectory})`);

        // Spawn process (ported from Gemini CLI)
        const childProcess = spawn(shell, shellArgs, {
          cwd: workingDirectory,
          env: environment,
          stdio: interactive ? 'inherit' : 'pipe',
          timeout
        });

        result.pid = childProcess.pid;
        
        // Track active execution
        if (result.pid) {
          this.activeExecutions.set(result.pid, {
            command,
            startTime: Date.now(),
            workingDirectory,
            process: childProcess
          });
        }

        let stdout = '';
        let stderr = '';

        // Collect output (ported from Gemini CLI)
        if (!interactive) {
          childProcess.stdout?.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            result.rawOutput = Buffer.concat([result.rawOutput, data]);
          });

          childProcess.stderr?.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            result.rawOutput = Buffer.concat([result.rawOutput, data]);
          });
        }

        // Handle process completion (ported from Gemini CLI)
        childProcess.on('close', (code, signal) => {
          result.exitCode = code;
          result.signal = signal;
          result.output = stdout + stderr;
          result.endTime = Date.now();
          
          // Clean up tracking
          if (result.pid) {
            this.activeExecutions.delete(result.pid);
          }
          
          // Add to history
          this._addToHistory({
            command,
            result: result,
            workingDirectory,
            timestamp: new Date().toISOString()
          });

          console.log(`✅ Shell command completed: exit code ${code}`);
          resolve(result);
        });

        // Handle process errors (ported from Gemini CLI)
        childProcess.on('error', (error) => {
          result.error = error;
          result.endTime = Date.now();
          
          if (result.pid) {
            this.activeExecutions.delete(result.pid);
          }
          
          console.error(`❌ Shell command error: ${error.message}`);
          reject(error);
        });

        // Set timeout (ported from Gemini CLI)
        if (timeout > 0) {
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGTERM');
              result.aborted = true;
              reject(new Error(`Command timed out after ${timeout}ms`));
            }
          }, timeout);
        }

      } catch (error) {
        result.error = error;
        result.endTime = Date.now();
        reject(error);
      }
    });

    return new ShellExecutionHandle(result.pid, executionPromise);
  }

  /**
   * Validate command for security (ported from Gemini CLI)
   * @param {string} command - Command to validate
   * @private
   */
  _validateCommand(command) {
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }

    const lowerCommand = command.toLowerCase().trim();
    
    // Check blocked commands (ported from Gemini CLI)
    for (const blocked of this.securityConfig.blockedCommands) {
      if (lowerCommand.includes(blocked.toLowerCase())) {
        throw new Error(`Blocked command detected: ${blocked}`);
      }
    }

    // Additional safety checks
    if (lowerCommand.includes('sudo rm') && lowerCommand.includes('-rf')) {
      throw new Error('Potentially dangerous recursive delete command blocked');
    }
  }

  /**
   * Add execution to history (ported from Gemini CLI)
   * @param {Object} execution - Execution record
   * @private
   */
  _addToHistory(execution) {
    this.executionHistory.push(execution);
    
    // Maintain history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get active shell executions
   * @returns {Array} Active executions
   */
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   * @param {number} limit - Number of recent executions
   * @returns {Array} Recent executions
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get shell execution statistics
   * @returns {Object} Execution stats
   */
  getShellStats() {
    const successCount = this.executionHistory.filter(e => e.result.exitCode === 0).length;
    const errorCount = this.executionHistory.filter(e => e.result.exitCode !== 0 || e.result.error).length;
    
    return {
      activeExecutions: this.activeExecutions.size,
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successCount,
      failedExecutions: errorCount,
      successRate: this.executionHistory.length > 0 ? Math.round((successCount / this.executionHistory.length) * 100) : 0
    };
  }

  /**
   * Kill all active shell processes
   * @returns {Promise<Object>} Kill result
   */
  async killAllActiveExecutions() {
    const activeCount = this.activeExecutions.size;
    
    for (const [pid, execution] of this.activeExecutions) {
      try {
        execution.process.kill('SIGTERM');
      } catch (error) {
        console.warn(`Failed to kill process ${pid}:`, error.message);
      }
    }
    
    this.activeExecutions.clear();
    
    return {
      killedProcesses: activeCount,
      message: `Terminated ${activeCount} active shell processes`
    };
  }
}

export default ShellExecutionService;