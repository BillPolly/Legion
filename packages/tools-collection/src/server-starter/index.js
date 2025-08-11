import { Tool, ToolResult } from '@legion/tools';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class ServerStarter extends Tool {
  constructor() {
    super({
      name: 'server_starter',
      description: 'Starts and manages npm servers'
    });
    this.serverProcess = null;
    this.serverOutput = [];
    this.maxOutputLines = 1000;
  }

  /**
   * Returns all tool functions in standard function calling format
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'server_starter_start',
          description: 'Start an npm server with the specified command',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The npm command to start the server (e.g., "npm start", "npm run dev")'
              },
              cwd: {
                type: 'string',
                description: 'Optional working directory for the command (default: current directory)'
              }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'server_starter_read_output',
          description: 'Read the output from the running server',
          parameters: {
            type: 'object',
            properties: {
              lines: {
                type: 'number',
                description: 'Number of lines to read from the end (default: 50)'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'server_starter_stop',
          description: 'Stop the currently running server',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ];
  }

  /**
   * Returns the primary tool function description
   */
  getToolDescription() {
    return this.getAllToolDescriptions()[0];
  }

  /**
   * Invokes the server starter with the given tool call
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      let result;

      switch (toolCall.function.name) {
        case 'server_starter_start':
          this.validateRequiredParameters(args, ['command']);
          result = await this.start(args.command, args.cwd);
          break;
        case 'server_starter_read_output':
          result = await this.readServerOutput(args.lines || 50);
          break;
        case 'server_starter_stop':
          result = await this.stop();
          break;
        default:
          throw new Error(`Unknown function: ${toolCall.function.name}`);
      }

      return ToolResult.success(result);
    } catch (error) {
      return ToolResult.failure(
        error.message || 'Server operation failed',
        {
          operation: toolCall.function.name,
          errorType: 'execution_error'
        }
      );
    }
  }

  /**
   * Starts a server process
   */
  async start(command, cwd = process.cwd()) {
    try {
      // Stop any existing server
      if (this.serverProcess) {
        await this.stop();
      }

      console.log(`Starting server with command: ${command} in ${cwd}`);
      
      // Parse command into command and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Start the server process
      this.serverProcess = spawn(cmd, args, {
        cwd: cwd,
        shell: true,
        env: { ...process.env }
      });

      this.serverOutput = [];

      // Capture stdout
      this.serverProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        this.serverOutput.push(...lines);
        if (this.serverOutput.length > this.maxOutputLines) {
          this.serverOutput = this.serverOutput.slice(-this.maxOutputLines);
        }
        console.log(`Server stdout: ${data}`);
      });

      // Capture stderr
      this.serverProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        this.serverOutput.push(...lines);
        if (this.serverOutput.length > this.maxOutputLines) {
          this.serverOutput = this.serverOutput.slice(-this.maxOutputLines);
        }
        console.error(`Server stderr: ${data}`);
      });

      // Handle process exit
      this.serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
        this.serverProcess = null;
      });

      // Wait a bit to ensure server starts
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        pid: this.serverProcess.pid,
        command: command,
        status: 'running'
      };
    } catch (error) {
      throw new Error(`Failed to start server: ${error.message}`);
    }
  }

  /**
   * Reads output from the running server
   */
  async readServerOutput(lines = 50) {
    if (!this.serverProcess) {
      throw new Error('No server is currently running');
    }

    const outputLines = this.serverOutput.slice(-lines);
    
    return {
      success: true,
      lines: outputLines.length,
      output: outputLines
    };
  }

  /**
   * Stops the running server
   */
  async stop() {
    if (!this.serverProcess) {
      throw new Error('No server is currently running');
    }

    try {
      console.log('Stopping server...');
      
      // Send SIGTERM to gracefully stop
      this.serverProcess.kill('SIGTERM');
      
      // Wait up to 5 seconds for graceful shutdown
      await new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          // Force kill if not stopped
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);

        this.serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const finalOutput = this.serverOutput.slice(-20);
      this.serverProcess = null;
      this.serverOutput = [];

      return {
        success: true,
        status: 'stopped',
        finalOutput: finalOutput
      };
    } catch (error) {
      throw new Error(`Failed to stop server: ${error.message}`);
    }
  }
}

export default ServerStarter;