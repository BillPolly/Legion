/**
 * BashTool - Execute bash commands with optional timeout
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';

// Input schema for validation
const bashToolSchema = z.object({
  command: z.string().min(1),
  description: z.string().optional(),
  timeout: z.number().int().positive().max(600000).optional().default(120000),
  working_directory: z.string().optional(),
  environment_variables: z.record(z.string()).optional(),
  capture_output: z.boolean().optional().default(true)
});

export class BashTool extends Tool {
  constructor() {
    super({
      name: 'Bash',
      description: 'Execute bash commands with optional timeout and security controls',
      inputSchema: bashToolSchema,
      execute: async (input) => this.executeCommand(input),
      getMetadata: () => this.getToolMetadata()
    });
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
          return {
            success: false,
            error: {
              code: 'SECURITY_ERROR',
              message: 'Command blocked for security reasons',
              command: command
            }
          };
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

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'Bash',
      description: 'Execute bash commands with optional timeout and security controls',
      input: {
        command: {
          type: 'string',
          required: true,
          description: 'The bash command to execute'
        },
        description: {
          type: 'string',
          required: false,
          description: 'Description of what the command does'
        },
        timeout: {
          type: 'number',
          required: false,
          description: 'Timeout in milliseconds (max 600000)'
        },
        working_directory: {
          type: 'string',
          required: false,
          description: 'Working directory for command execution'
        },
        environment_variables: {
          type: 'object',
          required: false,
          description: 'Additional environment variables'
        },
        capture_output: {
          type: 'boolean',
          required: false,
          description: 'Whether to capture stdout/stderr'
        }
      },
      output: {
        command: {
          type: 'string',
          description: 'The command that was executed'
        },
        exit_code: {
          type: 'number',
          description: 'Process exit code'
        },
        stdout: {
          type: 'string',
          description: 'Standard output'
        },
        stderr: {
          type: 'string',
          description: 'Standard error'
        },
        execution_time_ms: {
          type: 'number',
          description: 'Execution time in milliseconds'
        },
        working_directory: {
          type: 'string',
          description: 'Directory where command was executed'
        },
        timeout_occurred: {
          type: 'boolean',
          description: 'Whether timeout occurred'
        }
      }
    };
  }
}