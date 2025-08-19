import { Tool, ToolResult } from '@legion/tools-registry';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CommandExecutor extends Tool {
  constructor() {
    super({
      name: 'command_executor',
      description: 'Execute a bash command in the terminal and return the output',
      schema: {
        input: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute (e.g., "ls -la", "pwd", "echo hello")'
            },
            timeout: {
              type: 'number',
              default: 30000,
              description: 'Optional timeout in milliseconds (default: 30000ms)'
            }
          },
          required: ['command']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the command executed successfully'
            },
            stdout: {
              type: 'string',
              description: 'Standard output from the command'
            },
            stderr: {
              type: 'string',
              description: 'Standard error output from the command'
            },
            command: {
              type: 'string',
              description: 'The command that was executed'
            },
            exitCode: {
              type: 'number',
              description: 'Exit code of the command'
            },
            errorType: {
              type: 'string',
              enum: ['timeout', 'exit_code', 'execution_error', 'dangerous_command'],
              description: 'Type of error that occurred (if any)'
            }
          },
          required: ['success', 'command']
        }
      },
      execute: async (args) => this.executeCommand(args.command, args.timeout)
    });
  }


  /**
   * Executes a bash command
   */
  async executeCommand(command, timeout = 30000) {
    try {
      console.log(`Executing command: ${command}`);
      
      // Security check for truly dangerous commands
      const dangerousPatterns = [
        /rm -rf \s*\/\s*$/,           // rm -rf / (root deletion)
        /rm -rf \s*\/\s+/,            // rm -rf / something (root with args)
        /dd if=\/dev\/zero/,          // disk wiping
        /:(){ :|:& };:/,              // fork bomb
        /mkfs\./,                     // format filesystem
        /fdisk/,                      // disk partitioning
        /> \/dev\/sd[a-z]/            // write to disk devices
      ];
      
      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      
      if (isDangerous) {
        console.warn('WARNING: Potentially dangerous command detected');
        return {
          success: false,
          command: command,
          errorType: 'dangerous_command',
          error: 'Command blocked for safety reasons'
        };
      }
      
      // Use exec with promise wrapper
      return new Promise((resolve) => {
        exec(command, {
          timeout: timeout,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          shell: '/bin/bash'
        }, (error, stdout, stderr) => {
          if (error) {
            let errorType = 'execution_error';
            
            if (error.killed && error.signal === 'SIGTERM') {
              errorType = 'timeout';
            } else if (error.code !== undefined) {
              errorType = 'exit_code';
            }
            
            resolve({
              success: false,
              command: command,
              errorType: errorType,
              exitCode: error.code,
              stdout: stdout || '',
              stderr: stderr || '',
              error: error.message
            });
          } else {
            console.log('Command executed successfully');
            
            resolve({
              success: true,
              stdout: stdout || '',
              stderr: stderr || '',
              command: command,
              exitCode: 0
            });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        command: command,
        errorType: 'execution_error',
        error: error.message
      };
    }
  }

}

// Export the tool class
export default CommandExecutor;