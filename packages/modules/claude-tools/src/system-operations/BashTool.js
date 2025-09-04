/**
 * BashTool - Execute bash commands with optional timeout
 */

import { Tool } from '@legion/tools-registry';
import { spawn } from 'child_process';
import path from 'path';

export class BashTool extends Tool {
  constructor() {
    super({
      name: 'Bash',
      description: 'Executes bash commands in a persistent shell session with security measures and timeout controls',
      schema: {
        input: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              minLength: 1,
              description: 'The command to execute'
            },
            description: {
              type: 'string',
              description: 'Clear, concise description of what this command does in 5-10 words'
            },
            timeout: {
              type: 'integer',
              minimum: 1,
              maximum: 600000,
              description: 'Optional timeout in milliseconds (max 600000ms / 10 minutes)',
              default: 120000
            },
            working_directory: {
              type: 'string',
              description: 'Working directory for command execution (defaults to current directory)'
            },
            environment_variables: {
              type: 'object',
              additionalProperties: {
                type: 'string'
              },
              description: 'Additional environment variables to set for the command'
            },
            capture_output: {
              type: 'boolean',
              description: 'Whether to capture stdout/stderr output',
              default: true
            }
          },
          required: ['command']
        },
        output: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The command that was executed'
            },
            exit_code: {
              type: 'integer',
              description: 'Process exit code (0 indicates success)'
            },
            stdout: {
              type: 'string',
              description: 'Standard output from the command (truncated if > 30000 characters)'
            },
            stderr: {
              type: 'string',
              description: 'Standard error output from the command (truncated if > 30000 characters)'
            },
            execution_time_ms: {
              type: 'number',
              description: 'Time taken to execute the command in milliseconds'
            },
            working_directory: {
              type: 'string',
              description: 'Directory where the command was executed'
            },
            timeout_occurred: {
              type: 'boolean',
              description: 'Whether the command was terminated due to timeout'
            }
          },
          required: ['command', 'exit_code', 'stdout', 'stderr', 'execution_time_ms', 'working_directory', 'timeout_occurred']
        }
      }
    });
  }

  async _execute(input) {
    return await this.executeCommand(input);
  }

  /**
   * Execute a bash command
   */
  async executeCommand(input) {
    try {
      const {
        command,
        description,
        timeout = 120000,
        working_directory = process.cwd(),
        environment_variables = {},
        capture_output = true
      } = input;

      // Security check - block dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf\s+\//, // rm -rf /
        /:\(\)\{\s*:\|\s*:/, // Fork bomb
        />\s*\/dev\/sd/, // Direct disk write
        /dd\s+if=.*of=\/dev\// // dd to devices
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          const error = new Error('Command blocked for security reasons');
          error.code = 'SECURITY_ERROR';
          throw error;
        }
      }

      return new Promise((resolve) => {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // Spawn the process
        const proc = spawn('bash', ['-c', command], {
          cwd: working_directory,
          env: { ...process.env, ...environment_variables },
          shell: false // We're already using bash -c
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 5000);
        }, timeout);

        // Capture output
        if (capture_output) {
          proc.stdout.on('data', (data) => {
            stdout += data.toString();
            // Truncate if too large
            if (stdout.length > 30000) {
              stdout = stdout.substring(0, 30000) + '\n... [output truncated]';
            }
          });

          proc.stderr.on('data', (data) => {
            stderr += data.toString();
            // Truncate if too large
            if (stderr.length > 30000) {
              stderr = stderr.substring(0, 30000) + '\n... [output truncated]';
            }
          });
        }

        // Handle process exit
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          const executionTime = Date.now() - startTime;

          if (timedOut) {
            resolve({
              success: false,
              error: {
                code: 'OPERATION_TIMEOUT',
                message: `Command timed out after ${timeout}ms`,
                command: command,
                timeout: timeout,
                stdout: stdout,
                stderr: stderr
              }
            });
          } else {
            resolve({
              success: true,
              data: {
                command: command,
                exit_code: code,
                stdout: stdout,
                stderr: stderr,
                execution_time_ms: executionTime,
                working_directory: working_directory,
                timeout_occurred: false
              }
            });
          }
        });

        // Handle process error
        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: {
              code: 'EXECUTION_ERROR',
              message: `Failed to execute command: ${error.message}`,
              command: command,
              details: error.stack
            }
          });
        });
      });

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to execute command: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

}