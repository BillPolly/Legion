/**
 * JestExecutor - Manages Jest process execution
 * 
 * Spawns and manages Jest child processes with custom configuration
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

class JestExecutor {
  constructor() {
    this.jestProcess = null;
    this.gracefulShutdownTimeout = 5000;
    this.cleanupPromise = null;
  }

  /**
   * Load Jest configuration from project
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<Object>} Jest configuration
   */
  async loadConfig(projectPath) {
    // Try jest.config.js
    try {
      const configPath = path.join(projectPath, 'jest.config.js');
      await fs.access(configPath);
      const configUrl = pathToFileURL(configPath).href;
      const module = await import(configUrl);
      return module.default || module;
    } catch (error) {
      // File doesn't exist or can't be loaded
    }

    // Try jest.config.json
    try {
      const configPath = path.join(projectPath, 'jest.config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      // File doesn't exist or invalid JSON
    }

    // Try package.json jest field
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const packageData = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageData);
      if (packageJson.jest) {
        return packageJson.jest;
      }
    } catch (error) {
      // File doesn't exist or no jest field
    }

    // Return defaults
    return {
      testEnvironment: 'node',
      testMatch: [
        '**/__tests__/**/*.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)'
      ]
    };
  }

  /**
   * Execute Jest with the given configuration
   * 
   * @param {Object} config - Jest configuration
   * @returns {Promise<Object>} Execution result
   */
  async execute(config) {
    return new Promise((resolve, reject) => {
      const jestBinary = config.jestBinary || 'jest';
      const args = this.buildArgs(config);
      
      const spawnOptions = {
        cwd: config.projectPath || process.cwd(),
        env: {
          ...process.env,
          ...(config.env || {})
        }
      };

      // Add IPC channel if requested
      if (config.enableIPC) {
        spawnOptions.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];
      }

      this.jestProcess = spawn(jestBinary, args, spawnOptions);

      let stdout = '';
      let stderr = '';

      // Capture stdout
      this.jestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr
      this.jestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle IPC messages
      if (config.enableIPC && config.onMessage) {
        this.jestProcess.on('message', (message) => {
          config.onMessage(message);
        });
      }

      // Handle process completion
      this.jestProcess.on('close', (code) => {
        this.jestProcess = null;
        resolve({
          exitCode: code,
          stdout,
          stderr
        });
      });

      // Handle process errors
      this.jestProcess.on('error', (error) => {
        this.jestProcess = null;
        reject(error);
      });

      // Handle timeout
      if (config.timeout) {
        setTimeout(() => {
          if (this.jestProcess) {
            this.jestProcess.kill('SIGTERM');
          }
        }, config.timeout);
      }
    });
  }

  /**
   * Build command line arguments from config
   */
  buildArgs(config) {
    const args = [];

    if (config.coverage) {
      args.push('--coverage');
    }

    if (config.maxWorkers) {
      args.push(`--maxWorkers=${config.maxWorkers}`);
    }

    if (config.testMatch) {
      // Jest CLI doesn't directly accept testMatch
      // It would be passed via config file
    }

    if (config.verbose) {
      args.push('--verbose');
    }

    if (config.bail) {
      args.push('--bail');
    }

    if (config.reporters) {
      // Reporters are handled via config file
    }

    return args;
  }

  /**
   * Find Jest binary in project
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<string>} Path to Jest binary
   */
  async findJestBinary(projectPath) {
    const jestPath = path.join(projectPath, 'node_modules', '.bin', 'jest');
    
    try {
      await fs.access(jestPath);
      return jestPath;
    } catch (error) {
      throw new Error('Jest not found in project');
    }
  }

  /**
   * Merge user config with Jester requirements
   * 
   * @param {Object} userConfig - User's Jest config
   * @param {Object} jesterConfig - Jester's required config
   * @returns {Object} Merged configuration
   */
  mergeConfig(userConfig, jesterConfig) {
    const baseConfig = userConfig || {};
    const merged = { ...baseConfig, ...jesterConfig };

    // Handle reporters specially
    if (jesterConfig.reporters) {
      if (jesterConfig.preserveUserReporters && baseConfig.reporters) {
        merged.reporters = [
          ...(baseConfig.reporters || []),
          ...jesterConfig.reporters
        ];
      } else {
        merged.reporters = jesterConfig.reporters;
      }
    }

    // Remove our custom property
    delete merged.preserveUserReporters;

    return merged;
  }

  /**
   * Kill the Jest process if running
   */
  async cleanup() {
    if (!this.jestProcess) {
      return;
    }

    // If already cleaning up, return existing promise
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    this.cleanupPromise = this._performCleanup();
    return this.cleanupPromise;
  }

  async _performCleanup() {
    const process = this.jestProcess;
    
    // Send SIGTERM for graceful shutdown
    process.kill('SIGTERM');

    // Wait for graceful shutdown
    const startTime = Date.now();
    while (Date.now() - startTime < this.gracefulShutdownTimeout) {
      if (process.killed) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force kill if still running
    if (!process.killed) {
      process.kill('SIGKILL');
    }

    this.jestProcess = null;
    this.cleanupPromise = null;
  }
}

export { JestExecutor };