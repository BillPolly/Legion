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
            },
            error: {
              type: 'string',
              description: 'Error message if execution failed'
            }
          },
          required: ['success', 'command']
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
      category: 'system',
      tags: ['command', 'execution', 'bash'],
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
      errors.push('command is required for execution');
    }
    
    if (params.command !== undefined && typeof params.command !== 'string') {
      errors.push('command must be a string');
    }
    
    if (params.timeout !== undefined && typeof params.timeout !== 'number') {
      errors.push('timeout must be a number');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async _execute(params) {
    // Validate required parameters
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters must be an object');
    }
    
    if (params.command === undefined || params.command === null) {
      throw new Error('command parameter is required');
    }
    
    const result = await this.executeCommand(params.command, params.timeout);
    
    // If command execution failed, throw error to trigger Tool base class error handling
    if (!result.success) {
      const error = new Error(result.error || 'Command execution failed');
      error.cause = result; // Attach full result as error cause
      throw error;
    }
    
    // Return just the data part for successful execution
    return result;
  }


  /**
   * Executes a bash command
   */
  async executeCommand(command, timeout = 30000) {
    try {
      // Handle empty command
      if (!command || command.trim() === '') {
        return {
          success: true,
          stdout: '',
          stderr: '',
          command: command || '',
          exitCode: 0
        };
      }
      
      // Note: Removed console.log for production - use proper logging via ResourceManager
      
      // Security check for truly dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf\s*\/\s*$/,          // rm -rf / (root deletion)
        /rm\s+-rf\s+\/\s*$/,          // rm -rf / with extra args
        /rm\s+-rf\s*\/\s+/,           // rm -rf / something (root with args)
        /dd\s+if=\/dev\/zero/,        // disk wiping
        /:\(\)\{\s*:\|:\&\s*\};\:/,   // fork bomb
        /mkfs\./,                     // format filesystem
        /fdisk/,                      // disk partitioning
        />\s*\/dev\/sd[a-z]/          // write to disk devices
      ];
      
      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      
      if (isDangerous) {
        // Note: Removed console.warn for production - use proper logging
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
            // Note: Removed console.log for production
            
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