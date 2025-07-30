/**
 * RunNpmScriptTool - Execute npm scripts from package.json
 * 
 * Runs npm scripts with proper output capturing, error handling,
 * and progress tracking. Supports script arguments and environment variables.
 */

import { Tool, ToolResult } from '@legion/module-loader';
import { z } from 'zod';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class RunNpmScriptTool extends Tool {
  constructor() {
    super();
    this.name = 'run_npm_script';
    this.description = 'Execute an npm script from package.json';
    this.inputSchema = z.object({
        scriptName: z.string().describe('Name of the npm script to run'),
        projectPath: z.string().describe('Path to the project directory'),
        args: z.array(z.string()).optional().default([]).describe('Additional arguments to pass to the script'),
        env: z.record(z.string()).optional().describe('Environment variables to set'),
        timeout: z.number().optional().default(120000).describe('Script timeout in milliseconds'),
        silent: z.boolean().optional().default(false).describe('Suppress script output'),
        captureOutput: z.boolean().optional().default(true).describe('Capture and return script output'),
        workingDirectory: z.string().optional().describe('Working directory for script execution (relative to projectPath)')
      });
    this.outputSchema = z.object({
        status: z.enum(['completed', 'failed', 'timeout', 'not-found']).describe('Execution status'),
        exitCode: z.number().optional().describe('Script exit code'),
        output: z.string().optional().describe('Standard output from the script'),
        error: z.string().optional().describe('Standard error output'),
        executionTime: z.number().describe('Script execution time in milliseconds'),
        scriptCommand: z.string().optional().describe('The actual command that was executed')
      });
  }

  
  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
        stack: error.stack
      });
    }
  }

  async _validateEnvironment(projectPath) {
    try {
      // Check if project path exists and is a directory
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        return ToolResult.failure(`Project path is not a directory: ${projectPath}`, { toolName: this.name });
      }

      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      await fs.access(packageJsonPath);
      
      return packageJsonPath;
    } catch (error) {
      return ToolResult.failure(`Invalid project environment: ${error.message}`, { toolName: this.name });
    }
  }

  async _getScriptInfo(packageJsonPath, scriptName) {
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      const scripts = packageJson.scripts || {};
      const command = scripts[scriptName];
      
      return ToolResult.success({
        exists: !!command,
        command,
        allScripts: Object.keys(scripts)
      });
    } catch (error) {
      return ToolResult.failure(`Failed to read package.json: ${error.message}`, { toolName: this.name });
    }
  }

  async _executeScript(args, scriptCommand, startTime) {
    const cwd = args.workingDirectory 
      ? path.join(args.projectPath, args.workingDirectory)
      : args.projectPath;

    // Build npm run command
    const npmArgs = ['run', args.scriptName];
    
    // Add script arguments if provided
    if (args.args && args.args.length > 0) {
      npmArgs.push('--', ...args.args);
    }

    return new Promise((resolve) => {
      const child = spawn('npm', npmArgs, {
        cwd,
        stdio: args.captureOutput ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
        shell: true,
        env: {
          ...process.env,
          ...args.env
        }
      });

      let output = '';
      let errorOutput = '';
      let timedOut = false;

      // Capture output if requested
      if (args.captureOutput) {
        child.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          
          if (!args.silent) {
            // Emit progress with output snippets
            this.emit('progress', { 
              percentage: 50, 
              status: 'Script running...', 
              output: text.trim().split('\\n').slice(-1)[0] // Last line
            });
          }
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          
          if (!args.silent) {
            this.emit('progress', { 
              percentage: 50, 
              status: 'Script running...', 
              error: text.trim() 
            });
          }
        });
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        
        // Give it 5 seconds to gracefully shutdown
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, args.timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        const executionTime = Date.now() - startTime;
        
        if (timedOut) {
          resolve({
            status: 'timeout',
            exitCode: null,
            output: args.captureOutput ? output : undefined,
            error: args.captureOutput ? errorOutput + '\\n[Script timed out]' : 'Script timed out',
            executionTime
          });
        } else if (code === 0) {
          resolve({
            status: 'completed',
            exitCode: code,
            output: args.captureOutput ? output : undefined,
            error: args.captureOutput && errorOutput ? errorOutput : undefined,
            executionTime
          });
        } else {
          resolve({
            status: 'failed',
            exitCode: code,
            output: args.captureOutput ? output : undefined,
            error: args.captureOutput ? errorOutput || `Script exited with code ${code}` : `Script exited with code ${code}`,
            executionTime
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        
        resolve({
          status: 'failed',
          exitCode: null,
          output: args.captureOutput ? output : undefined,
          error: `Failed to execute script: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });

      // Handle process signals
      process.on('SIGINT', () => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      });

      process.on('SIGTERM', () => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      });
    });
  }
}