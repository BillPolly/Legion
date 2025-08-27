/**
 * ServerStartTool - Start and manage server processes
 */

import { Tool } from '@legion/tools-registry';
import { spawn } from 'child_process';

// Global process registry to track managed processes
const processRegistry = new Map();

export class ServerStartTool extends Tool {
  constructor() {
    super({
      name: 'server_start',
      description: 'Start a server process with the specified command',
      schema: {
        input: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command to start the server (e.g., "npm start", "node server.js")',
              default: 'echo "test server"'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the command (default: current directory)'
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds to wait for server start confirmation',
              default: 5000
            }
          },
          required: ['command']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the server started successfully'
            },
            pid: {
              type: 'number',
              description: 'Process ID of the started server'
            },
            command: {
              type: 'string',
              description: 'The command that was executed'
            },
            cwd: {
              type: 'string',
              description: 'Working directory where command was executed'
            },
            status: {
              type: 'string',
              description: 'Current status of the server process'
            },
            process: {
              description: 'Process reference for internal management'
            },
            error: {
              type: 'string',
              description: 'Error message if start failed'
            }
          },
          required: ['success']
        }
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'server',
      tags: ['server', 'process', 'start'],
      security: { evaluation: 'restricted' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.command === undefined || params.command === null) {
      errors.push('command is required for server start');
    }
    
    if (params.command !== undefined && typeof params.command !== 'string') {
      errors.push('command must be a string');
    }
    
    if (params.cwd !== undefined && typeof params.cwd !== 'string') {
      errors.push('cwd must be a string');
    }
    
    if (params.timeout !== undefined && typeof params.timeout !== 'number') {
      errors.push('timeout must be a number');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    const { command, cwd = process.cwd(), timeout = 5000 } = params;

    // Validate required parameters
    if (!command) {
      throw new Error('command parameter is required');
    }

    try {
      // Validate working directory exists if specified
      if (cwd !== process.cwd()) {
        try {
          const fs = await import('fs');
          await fs.promises.access(cwd);
        } catch (dirError) {
          return {
            success: false,
            error: `Working directory does not exist: ${cwd}`,
            command: command,
            cwd: cwd
          };
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
        return {
          success: false,
          error: `Failed to spawn process: ${spawnError.message}`,
          command: command,
          cwd: cwd
        };
      }

      const pid = serverProcess.pid;
      
      // Handle spawn errors
      if (!pid) {
        return {
          success: false,
          error: 'Failed to get process ID - process may not have started',
          command: command,
          cwd: cwd
        };
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
        return {
          success: false,
          error: exitError,
          command: command,
          cwd: cwd
        };
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
        return {
          success: false,
          error: 'Process was killed immediately after start',
          command: command,
          cwd: cwd
        };
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

    } catch (error) {
      return {
        success: false,
        error: `Execution error: ${error.message}`,
        command: command,
        cwd: cwd
      };
    }
  }
}

// Export registry for other tools to use
export { processRegistry };
export default ServerStartTool;