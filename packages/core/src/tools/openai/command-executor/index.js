const OpenAICompatibleTool = require('../../base/openai-compatible-tool');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CommandExecutorOpenAI extends OpenAICompatibleTool {
  constructor() {
    super();
    this.name = 'command_executor';
    this.description = 'Executes bash commands in the terminal';
  }

  /**
   * Returns the tool description in OpenAI function calling format
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
      const result = await this.execute(args.command, args.timeout);
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        result
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Executes a bash command
   */
  async execute(command, timeout = 30000) {
    try {
      console.log(`Executing command: ${command}`);
      
      // Security warning for production use
      if (command.includes('rm -rf') || command.includes('dd if=')) {
        console.warn('WARNING: Potentially dangerous command detected');
      }
      
      // Execute the command with timeout
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: '/bin/bash'
      });
      
      console.log('Command executed successfully');
      
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        command: command
      };
    } catch (error) {
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${timeout}ms: ${command}`);
      } else if (error.code) {
        throw new Error(`Command failed with exit code ${error.code}: ${error.message}`);
      }
      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }
}

module.exports = CommandExecutorOpenAI;