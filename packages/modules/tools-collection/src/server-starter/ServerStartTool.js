/**
 * ServerStartTool - Start and manage server processes
 */

import { Tool } from '@legion/tools-registry';
import { spawn } from 'child_process';

// Global process registry to track managed processes
const processRegistry = new Map();

export class ServerStartTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'start';
  }


  async _execute(params) {
    const { command, cwd = process.cwd(), timeout = 5000 } = params;

    // Validate required parameters
    if (!command) {
      throw new Error('command parameter is required');
    }

    // Validate working directory exists if specified
    if (cwd !== process.cwd()) {
      try {
        const fs = await import('fs');
        await fs.promises.access(cwd);
      } catch (dirError) {
        throw new Error(`Working directory does not exist: ${cwd}`);
      }
    }

    // Parse command into parts
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    // Start the server process
    let serverProcess;
    try {
      serverProcess = spawn(cmd, args, {
        cwd: cwd,
        shell: true,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (spawnError) {
      throw new Error(`Failed to spawn process: ${spawnError.message}`);
    }

    const pid = serverProcess.pid;
    
    // Handle spawn errors
    if (!pid) {
      throw new Error('Failed to get process ID - process may not have started');
    }

    // Set up output capturing
    const outputLines = [];
    const maxLines = 1000;

    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      outputLines.push(...lines);
      if (outputLines.length > maxLines) {
        outputLines.splice(0, outputLines.length - maxLines);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      outputLines.push(...lines);
      if (outputLines.length > maxLines) {
        outputLines.splice(0, outputLines.length - maxLines);
      }
    });

    // Handle process exit and errors
    let processExited = false;
    let exitError = null;
    
    serverProcess.on('exit', (code) => {
      processExited = true;
      processRegistry.delete(pid);
      if (code !== 0) {
        exitError = `Process exited with code ${code}`;
      }
    });
    
    serverProcess.on('error', (error) => {
      processExited = true;
      exitError = `Process error: ${error.message}`;
      processRegistry.delete(pid);
    });

    // Wait briefly to ensure process starts and check for immediate failures
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if process failed immediately with non-zero exit
    if (processExited && exitError) {
      throw new Error(exitError);
    }
    
    // For processes that exit immediately with code 0 (like echo), this is normal
    // We still register them and return success
    if (processExited && !exitError) {
      // Process completed successfully - still register for output reading
      processRegistry.set(pid, {
        process: serverProcess,
        outputLines: outputLines,
        command: command,
        cwd: cwd,
        startTime: Date.now(),
        completed: true
      });
      
      return {
        success: true,
        pid: pid,
        command: command,
        cwd: cwd,
        status: 'completed',
        process: serverProcess
      };
    }
    
    // Check if process was killed (different from natural completion)
    if (serverProcess.killed) {
      throw new Error('Process was killed immediately after start');
    }

    // Register process for management
    processRegistry.set(pid, {
      process: serverProcess,
      outputLines: outputLines,
      command: command,
      cwd: cwd,
      startTime: Date.now()
    });

    return {
      success: true,
      pid: pid,
      command: command,
      cwd: cwd,
      status: 'running',
      process: serverProcess // Include for immediate cleanup in tests
    };
  }
}

// Export registry for other tools to use
export { processRegistry };
export default ServerStartTool;