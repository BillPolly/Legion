import { Tool, ToolResult } from '@legion/tools-registry';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CommandExecutor extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
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