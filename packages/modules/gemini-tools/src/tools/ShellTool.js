/**
 * ShellTool - Ported from Gemini CLI shell.ts to Legion patterns
 * Executes shell commands with proper security and output handling
 */

import { Tool } from '@legion/tools-registry';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Tool for executing shell commands (ported from Gemini CLI's shell.ts)
 */
class ShellTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.shortName = 'shell';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath } = moduleOrConfig || {};
      
      super({
        name: 'shell_command',
        shortName: 'shell',
        description: 'Executes shell commands (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute'
              },
              working_directory: {
                type: 'string',
                description: 'Working directory for command execution (optional)'
              },
              timeout: {
                type: 'number',
                description: 'Command timeout in milliseconds (default: 30000)',
                default: 30000
              }
            },
            required: ['command']
          },
          output: {
            type: 'object',
            properties: {
              stdout: {
                type: 'string',
                description: 'Standard output from the command'
              },
              stderr: {
                type: 'string',
                description: 'Standard error from the command'
              },
              exit_code: {
                type: 'number',
                description: 'Exit code of the command'
              },
              command: {
                type: 'string',
                description: 'The command that was executed'
              }
            },
            required: ['stdout', 'stderr', 'exit_code', 'command']
          }
        }
      });

      this.basePath = basePath || process.cwd();
    }
  }

  /**
   * Execute shell command (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for executing command
   * @returns {Promise<Object>} The result of command execution
   */
  async _execute(args) {
    return new Promise((resolve, reject) => {
      try {
        const { command, working_directory, timeout = 30000 } = args;

        // Validate input (ported from Gemini CLI validation)
        if (typeof command !== 'string') {
          throw new Error('Command must be a string');
        }

        if (command.trim() === '') {
          throw new Error('Command cannot be empty');
        }

        // Security checks (ported from Gemini CLI)
        const dangerousCommands = ['rm -rf /', 'format', 'del /q'];
        const isLowerCommand = command.toLowerCase();
        for (const dangerous of dangerousCommands) {
          if (isLowerCommand.includes(dangerous.toLowerCase())) {
            throw new Error('Potentially dangerous command blocked');
          }
        }

        // Set working directory
        const cwd = working_directory ? path.resolve(working_directory) : this.basePath;

        // Parse command for shell execution (ported logic from Gemini CLI)
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/bash';
        const shellArgs = isWindows ? ['/c', command] : ['-c', command];

        // Spawn process (ported from Gemini CLI process handling)
        const child = spawn(shell, shellArgs, {
          cwd,
          env: process.env,
          stdio: 'pipe',
          timeout
        });

        let stdout = '';
        let stderr = '';

        // Collect output (ported from Gemini CLI output handling)
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // Handle process errors (ported from Gemini CLI error handling)
        child.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(new Error(`Command execution failed: ${error.message}`));
        });

        // Set timeout (ported from Gemini CLI timeout handling)
        const timeoutId = setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${timeout}ms`));
          }
        }, timeout);

        // Handle process completion (ported from Gemini CLI)
        child.on('close', (code) => {
          clearTimeout(timeoutId);
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exit_code: code || 0,
            command
          });
        });

      } catch (error) {
        // Legion pattern: fail fast, no fallbacks
        reject(new Error(error.message || 'Failed to execute command'));
      }
    });
  }
}

export default ShellTool;