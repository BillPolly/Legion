import { spawn } from 'child_process';
import { EventEmitter } from 'events';
// Simple UUID generator for now
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * ProcessManager - Manages child processes for local deployments
 */
class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
  }
  
  /**
   * Start a new process
   */
  async start(config) {
    const { command, cwd, env, captureOutput = false, maxOutputSize = 1024 * 1024 } = config;
    
    // Parse command
    const [cmd, ...args] = command.split(' ');
    
    // Create process ID
    const id = uuidv4();
    
    // Spawn process
    const childProcess = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false
    });
    
    // Wait for spawn or error
    try {
      await new Promise((resolve, reject) => {
        childProcess.once('spawn', resolve);
        childProcess.once('error', (err) => reject(err));
      });
    } catch (error) {
      throw new Error(`Failed to start process: ${error.message}`);
    }
    
    // Create process info
    const processInfo = {
      id,
      pid: childProcess.pid,
      command,
      cwd,
      env,
      status: 'running',
      startTime: new Date(),
      process: childProcess,
      logs: captureOutput ? { stdout: '', stderr: '', truncated: false } : null,
      maxOutputSize
    };
    
    // Store process
    this.processes.set(id, processInfo);
    
    // Set up event handlers
    this.setupProcessHandlers(id, childProcess, processInfo);
    
    return {
      id,
      pid: childProcess.pid,
      command,
      status: 'running',
      startTime: processInfo.startTime
    };
  }
  
  /**
   * Stop a process
   */
  async stop(processId, options = {}) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`Process not found: ${processId}`);
    }
    
    const { timeout = 5000 } = options;
    const { process: childProcess } = processInfo;
    
    return new Promise((resolve) => {
      let forcedKill = false;
      
      // Set up exit handler
      childProcess.once('exit', (exitCode, signal) => {
        processInfo.status = 'stopped';
        processInfo.exitCode = exitCode;
        processInfo.signal = signal;
        processInfo.stoppedAt = new Date();
        
        resolve({
          id: processId,
          exitCode,
          signal
        });
      });
      
      // Try graceful shutdown
      childProcess.kill('SIGTERM');
      
      // Force kill after timeout
      const killTimer = setTimeout(() => {
        forcedKill = true;
        childProcess.kill('SIGKILL');
      }, timeout);
      
      // Clear timer if process exits before timeout
      childProcess.once('exit', () => clearTimeout(killTimer));
    });
  }
  
  /**
   * Restart a process
   */
  async restart(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`Process not found: ${processId}`);
    }
    
    // Save config
    const { command, cwd, env, captureOutput, maxOutputSize } = processInfo;
    
    // Stop existing process
    await this.stop(processId);
    
    // Remove old process info
    this.processes.delete(processId);
    
    // Start new process with same ID
    const newProcess = await this.start({ command, cwd, env, captureOutput, maxOutputSize });
    
    // Update with original ID
    const newProcessInfo = this.processes.get(newProcess.id);
    this.processes.delete(newProcess.id);
    newProcessInfo.id = processId;
    this.processes.set(processId, newProcessInfo);
    
    return {
      ...newProcess,
      id: processId
    };
  }
  
  /**
   * Get process status
   */
  getStatus(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      return null;
    }
    
    const { id, pid, command, status, startTime } = processInfo;
    const uptime = status === 'running' ? Date.now() - startTime.getTime() : 0;
    
    return {
      id,
      pid,
      command,
      status,
      uptime,
      startTime
    };
  }
  
  /**
   * List all processes
   */
  list() {
    return Array.from(this.processes.values()).map(info => ({
      id: info.id,
      pid: info.pid,
      command: info.command,
      status: info.status,
      startTime: info.startTime
    }));
  }
  
  /**
   * Get process logs
   */
  getLogs(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo || !processInfo.logs) {
      return null;
    }
    
    return { ...processInfo.logs };
  }
  
  /**
   * Stop all processes
   */
  async stopAll() {
    const stopPromises = Array.from(this.processes.keys()).map(id => 
      this.stop(id).catch(err => console.error(`Failed to stop process ${id}:`, err))
    );
    
    await Promise.all(stopPromises);
    this.processes.clear();
  }
  
  /**
   * Clean up stopped processes
   */
  cleanup() {
    for (const [id, info] of this.processes.entries()) {
      if (info.status === 'stopped') {
        this.processes.delete(id);
      }
    }
  }
  
  /**
   * Set up process event handlers
   */
  setupProcessHandlers(id, childProcess, processInfo) {
    // Handle stdout
    if (processInfo.logs) {
      childProcess.stdout.on('data', (data) => {
        const text = data.toString();
        this.emit('process:stdout', { id, data: text });
        
        // Append to logs with size limit
        if (processInfo.logs.stdout.length + text.length <= processInfo.maxOutputSize) {
          processInfo.logs.stdout += text;
        } else {
          processInfo.logs.truncated = true;
          const remaining = processInfo.maxOutputSize - processInfo.logs.stdout.length;
          if (remaining > 0) {
            processInfo.logs.stdout += text.substring(0, remaining);
          }
        }
      });
      
      // Handle stderr
      childProcess.stderr.on('data', (data) => {
        const text = data.toString();
        this.emit('process:stderr', { id, data: text });
        
        // Append to logs with size limit
        if (processInfo.logs.stderr.length + text.length <= processInfo.maxOutputSize) {
          processInfo.logs.stderr += text;
        } else {
          processInfo.logs.truncated = true;
          const remaining = processInfo.maxOutputSize - processInfo.logs.stderr.length;
          if (remaining > 0) {
            processInfo.logs.stderr += text.substring(0, remaining);
          }
        }
      });
    }
    
    // Handle process exit
    childProcess.on('exit', (exitCode, signal) => {
      processInfo.status = 'stopped';
      processInfo.exitCode = exitCode;
      processInfo.signal = signal;
      processInfo.stoppedAt = new Date();
      
      const crashed = exitCode !== 0 && exitCode !== null;
      
      this.emit('process:exit', {
        id,
        pid: processInfo.pid,
        exitCode,
        signal,
        crashed
      });
    });
    
    // Handle errors
    childProcess.on('error', (error) => {
      this.emit('process:error', { id, error });
    });
  }
}

export default ProcessManager;