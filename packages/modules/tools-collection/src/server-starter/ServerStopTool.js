/**
 * ServerStopTool - Stop managed server processes
 */

import { Tool } from '@legion/tools-registry';
import { processRegistry } from './ServerStartTool.js';

export class ServerStopTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'stop';
  }

  async _execute(params) {
    const { pid, force = false } = params;

    // Validate required parameters
    if (pid === undefined || pid === null) {
      throw new Error('pid parameter is required');
    }

    // Look up the process in the registry
    const processInfo = processRegistry.get(pid);
    
    if (!processInfo) {
      throw new Error(`Process with ID ${pid} not found or not managed by server starter`);
    }

    const { process: serverProcess, outputLines } = processInfo;
    
    // Check if process is already terminated
    if (serverProcess.killed || serverProcess.exitCode !== null) {
      processRegistry.delete(pid);
      throw new Error(`Process with ID ${pid} is already terminated`);
    }

    let signal;
    let exitCode = null;
    const timeout = 5000;
    
    try {
      if (!force) {
        // Attempt graceful shutdown with SIGTERM
        signal = 'SIGTERM';
        serverProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown with timeout
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            // Force kill if graceful timeout
            try {
              signal = 'SIGKILL';
              serverProcess.kill('SIGKILL');
              resolve();
            } catch (killError) {
              reject(killError);
            }
          }, timeout);

          serverProcess.on('exit', (code) => {
            exitCode = code;
            clearTimeout(timer);
            resolve();
          });
        });
      } else {
        // Force kill immediately
        signal = 'SIGKILL';
        serverProcess.kill('SIGKILL');
        
        // Wait for exit
        await new Promise((resolve) => {
          serverProcess.on('exit', (code) => {
            exitCode = code;
            resolve();
          });
          // Set a timeout in case process doesn't exit
          setTimeout(resolve, 1000);
        });
      }
      
      // Remove from registry
      processRegistry.delete(pid);
      
      // Return just the data - execute() will wrap it
      return {
        pid: pid,
        signal: signal,
        exitCode: exitCode,
        success: true  // Include for backward compatibility in data structure
      };
    } catch (error) {
      throw new Error(`Failed to stop process: ${error.message}`);
    }
  }
}

export default ServerStopTool;