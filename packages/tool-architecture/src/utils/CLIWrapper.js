/**
 * CLI Tool Wrapping utilities
 * Utilities for wrapping command-line tools as executable tools
 */

import { Tool } from '../modules/Tool.js';
import { generateHandle } from './HandleManager.js';
import { spawn, exec, execSync } from 'child_process';

/**
 * CLIWrapper class for wrapping CLI commands
 */
export class CLIWrapper {
  constructor(command, options = {}) {
    this.command = command;
    this.spawn = options.spawn || spawn;
    this.exec = options.exec || exec;
    this.execSync = options.execSync || execSync;
    this.processes = new Map();
  }

  /**
   * Execute a command with arguments
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async execute(args, options = {}) {
    const fullCommand = this.command ? `${this.command} ${args.join(' ')}` : args.join(' ');
    
    return new Promise((resolve, reject) => {
      let timedOut = false;
      let timeoutId;

      // Set up timeout if specified
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(new Error('Command timed out'));
        }, options.timeout);
      }

      // Prepare execution options and callback
      const hasOptions = options.cwd || options.env;
      const execOptions = {};
      if (options.cwd) execOptions.cwd = options.cwd;
      if (options.env) execOptions.env = { ...process.env, ...options.env };

      const callback = (error, stdout, stderr) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut) return;

        if (error) {
          resolve({
            success: false,
            exitCode: error.code || 1,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : error.message,
            error: error.message
          });
        } else {
          resolve({
            success: true,
            exitCode: 0,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : ''
          });
        }
      };

      // Execute the command with or without options
      if (hasOptions) {
        this.exec(fullCommand, execOptions, callback);
      } else {
        this.exec(fullCommand, callback);
      }
    });
  }

  /**
   * Spawn a process for streaming output
   * @param {Array} args - Command arguments
   * @param {Object} options - Spawn options
   * @returns {Promise<Object>} Process result
   */
  async spawnCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = this.spawn(this.command, args, options);
      
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr
        });
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Pipe multiple commands
   * @param {...Array} commands - Commands to pipe
   * @returns {Promise<Object>} Piped result
   */
  async pipe(...commands) {
    // Extract options if last argument is an object
    let options = {};
    if (commands.length > 0 && !Array.isArray(commands[commands.length - 1])) {
      options = commands.pop();
    }

    const fullCommand = commands.map(cmd => cmd.join(' ')).join(' | ');
    
    return new Promise((resolve) => {
      const exec = options.exec || this.exec;
      exec(fullCommand, (error, stdout, stderr) => {
        resolve({
          success: !error,
          exitCode: error ? error.code || 1 : 0,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : ''
        });
      });
    });
  }

  /**
   * Run interactive command with stdin
   * @param {Array} args - Command arguments
   * @param {string} input - Input to send to stdin
   * @returns {Promise<Object>} Process result
   */
  async interactive(args, input) {
    return new Promise((resolve) => {
      const process = this.spawn(this.command, args);
      
      // Send input to stdin
      if (input) {
        process.stdin.write(input);
      }
      process.stdin.end();

      let stdout = '';
      let stderr = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr
        });
      });
    });
  }

  /**
   * Start a long-running process
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Process handle
   */
  async startProcess(args) {
    const process = this.spawn(this.command, args);
    const handle = {
      type: 'process',
      pid: process.pid,
      command: `${this.command} ${args.join(' ')}`,
      process
    };

    this.processes.set(handle.pid, process);
    return handle;
  }

  /**
   * Stop a long-running process
   * @param {Object} handle - Process handle
   * @returns {Promise<void>}
   */
  async stopProcess(handle) {
    const process = handle.process || this.processes.get(handle.pid);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(handle.pid);
    }
  }
}

/**
 * Create a CLI tool from configuration
 * @param {Object} config - Tool configuration
 * @returns {Tool} Created tool
 */
export function createCLITool(config) {
  const execute = async (input, options = {}) => {
    // Build arguments
    let args;
    if (typeof config.args === 'function') {
      args = config.args(input);
    } else {
      args = config.args.map(arg => {
        // Replace template variables
        if (typeof arg === 'string' && arg.includes('${')) {
          return arg.replace(/\${(\w+)}/g, (match, key) => {
            return input[key] || '';
          });
        }
        return arg;
      });
    }

    // Validate input if schema provided
    if (config.inputSchema) {
      const valid = validateInput(input, config.inputSchema);
      if (!valid) {
        throw new Error('Input validation failed');
      }
    }

    // Execute command
    const execFunc = options.exec || exec;
    const fullCommand = `${config.command} ${args.join(' ')}`;
    
    return new Promise((resolve, reject) => {
      execFunc(fullCommand, (error, stdout, stderr) => {
        if (error && !config.allowErrors) {
          reject(error);
        } else {
          const output = stdout ? stdout.toString() : '';
          
          // Parse output if parser provided
          if (config.parseOutput) {
            const parsed = config.parseOutput(output);
            resolve(parsed);
          } else {
            resolve({
              success: !error,
              exitCode: error ? error.code || 1 : 0,
              stdout: output,
              stderr: stderr ? stderr.toString() : ''
            });
          }
        }
      });
    });
  };

  return {
    execute,
    getMetadata: () => ({
      description: config.description || `CLI tool: ${config.command}`,
      command: config.command,
      input: config.inputSchema || {},
      output: config.outputSchema || {}
    })
  };
}

/**
 * Validate input against schema
 * @param {Object} input - Input to validate
 * @param {Object} schema - Validation schema
 * @returns {boolean} True if valid
 */
function validateInput(input, schema) {
  if (schema.type !== 'object') return true;
  
  for (const [key, propSchema] of Object.entries(schema.properties || {})) {
    if (propSchema.required && !(key in input)) {
      return false;
    }
    if (key in input && propSchema.type) {
      const actualType = typeof input[key];
      if (actualType !== propSchema.type) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Parse command output
 * @param {string} output - Raw output
 * @param {string|Function} format - Format type or parser function
 * @returns {any} Parsed output
 */
export function parseOutput(output, format) {
  if (typeof format === 'function') {
    return format(output);
  }

  switch (format) {
    case 'json':
      return JSON.parse(output);
    
    case 'csv':
      const lines = output.trim().split('\n');
      const headers = lines[0].split(',');
      return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });
        return obj;
      });
    
    case 'lines':
      return output.trim().split('\n');
    
    default:
      return output;
  }
}

/**
 * Handle process exit code
 * @param {number} code - Exit code
 * @param {string} signal - Signal if process was killed
 * @returns {Object} Exit code information
 */
export function handleExitCode(code, signal) {
  if (signal) {
    return {
      success: false,
      signal,
      category: 'terminated'
    };
  }

  if (code === 0) {
    return { success: true, code: 0 };
  }

  let category = 'general_error';
  if (code === 127) category = 'command_not_found';
  else if (code === 130) category = 'interrupted';
  else if (code === 137) category = 'killed';

  return {
    success: false,
    code,
    category
  };
}

/**
 * Convert stream to string
 * @param {Stream} stream - Input stream
 * @returns {Promise<string>} String content
 */
export async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    
    stream.on('data', chunk => {
      data += chunk.toString();
    });
    
    stream.on('end', () => {
      resolve(data);
    });
    
    stream.on('error', error => {
      reject(error);
    });
  });
}