import { Tool, ToolResult } from '@legion/module-loader';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class CommandExecutor extends Tool {
  constructor() {
    super();
    this.name = 'command_executor';
    this.description = 'Executes bash commands in the terminal';
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'command_executor_execute',
        description: 'Execute a bash command in the terminal and return the output',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute (e.g., "ls -la", "pwd", "echo hello")'
            },
            timeout: {
              type: 'number',
              description: 'Optional timeout in milliseconds (default: 30000ms)'
            }
          },
          required: ['command']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              stdout: {
                type: 'string',
                description: 'Standard output from the command'
              },
              stderr: {
                type: 'string',
                description: 'Standard error output from the command (may be empty)'
              },
              command: {
                type: 'string',
                description: 'The command that was executed'
              },
              exitCode: {
                type: 'number',
                description: 'Exit code of the command (0 for success)'
              }
            },
            required: ['stdout', 'stderr', 'command']
          },
          failure: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command that failed'
              },
              errorType: {
                type: 'string',
                enum: ['timeout', 'exit_code', 'execution_error', 'dangerous_command'],
                description: 'Type of error that occurred'
              },
              exitCode: {
                type: 'number',
                description: 'Exit code if the command completed but failed'
              },
              stdout: {
                type: 'string',
                description: 'Any partial stdout before failure'
              },
              stderr: {
                type: 'string',
                description: 'Error output from the command'
              }
            },
            required: ['command', 'errorType']
          }
        }
      }
    };
  }

  /**
   * Invokes the command executor with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['command']);
      
      // Execute the command
      return await this.executeCommand(args.command, args.timeout);
    } catch (error) {
      // Handle parameter validation errors
      return ToolResult.failure(
        error.message,
        { 
          command: toolCall.function.arguments ? 
            JSON.parse(toolCall.function.arguments).command : 'unknown',
          errorType: 'execution_error'
        }
      );
    }
  }

  /**
   * Executes a bash command
   */
  async executeCommand(command, timeout = 30000) {
    try {
      console.log(`Executing command: ${command}`);
      
      // Security check for dangerous commands
      if (command.includes('rm -rf /') || command.includes('dd if=/dev/zero')) {
        console.warn('WARNING: Potentially dangerous command detected');
        return ToolResult.failure(
          'Command blocked for safety reasons',
          {
            command: command,
            errorType: 'dangerous_command'
          }
        );
      }
      
      // Execute the command with timeout
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: '/bin/bash'
      });
      
      console.log('Command executed successfully');
      
      return ToolResult.success({
        stdout: stdout || '',
        stderr: stderr || '',
        command: command,
        exitCode: 0
      });
    } catch (error) {
      let errorType = 'execution_error';
      let errorMessage = `Failed to execute command: ${error.message}`;
      let data = {
        command: command,
        errorType: errorType
      };
      
      if (error.killed && error.signal === 'SIGTERM') {
        errorType = 'timeout';
        errorMessage = `Command timed out after ${timeout}ms`;
      } else if (error.code !== undefined) {
        errorType = 'exit_code';
        errorMessage = `Command failed with exit code ${error.code}`;
        data.exitCode = error.code;
        data.stdout = error.stdout || '';
        data.stderr = error.stderr || '';
      }
      
      data.errorType = errorType;
      
      return ToolResult.failure(errorMessage, data);
    }
  }

  /**
   * Legacy execute method for CLI compatibility
   */
  async execute(command, timeout = 30000) {
    const result = await this.executeCommand(command, timeout);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }
}

// Export the Tool class for direct use (backward compatibility)
export { CommandExecutor };

// Default export for the module.json system
export default CommandExecutor;